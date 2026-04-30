// Gummy WebSocket voice recognition + translation
// npm:ws works on Supabase Edge; esm.sh/ws breaks optional deps (bufferutil / utf-8-validate).
// @ts-expect-error npm specifier resolved by Edge runtime
import WebSocket from 'npm:ws@8.18.0'

import { DASHSCOPE, DASHSCOPE_API_KEY } from '../_shared/models.ts'

const WS_ENDPOINT = DASHSCOPE.asr.endpoint

interface VoiceTranslateRequest {
  audio: string // base64 encoded PCM 16kHz mono
  sourceLang: string
  targetLang: string
}

// Gummy supported languages.
const langMap: Record<string, string> = {
  'zh': 'zh', 'en': 'en', 'ja': 'ja', 'ko': 'ko',
  'fr': 'fr', 'de': 'de', 'ru': 'ru', 'it': 'it', 'es': 'es',
}

function generateUUID(): string {
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  )
}

const ttsVoiceMap: Record<string, string> = {
  'zh': 'Cherry', 'en': 'Cherry', 'ja': 'Cherry', 'ko': 'Cherry',
  'fr': 'Cherry', 'de': 'Cherry', 'ru': 'Cherry', 'it': 'Cherry', 'es': 'Cherry',
}

const ttsLangMap: Record<string, string> = {
  'zh': 'Chinese', 'en': 'English', 'ja': 'Japanese', 'ko': 'Korean',
  'fr': 'French', 'de': 'German', 'ru': 'Russian', 'it': 'Italian', 'es': 'Spanish',
}

async function callTTS(text: string, targetLang: string): Promise<string> {
  if (!text.trim()) return ''

  const voice = ttsVoiceMap[targetLang] || ttsVoiceMap['en']
  const language = ttsLangMap[targetLang] || 'Chinese'
  console.log('[TTS] Generating audio for:', text.substring(0, 50), 'voice:', voice, 'lang:', language)

  const response = await fetch(DASHSCOPE.tts.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DASHSCOPE.tts.model,
      input: {
        text,
        voice,
        language_type: language,
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[TTS] Error:', response.status, errText)
    return ''
  }

  const result = await response.json()

  const audioUrl = result.output?.audio?.url
    || result.output?.url
    || result.output?.audio_url
  if (audioUrl) {
    console.log('[TTS] Audio URL:', audioUrl)
    return audioUrl
  }

  const audioData = result.output?.audio?.data
    || result.output?.data
    || result.output?.audio_base64
  if (audioData) {
    console.log('[TTS] Audio base64 length:', audioData.length)
    return 'data:audio/mp3;base64,' + audioData
  }

  console.error('[TTS] No audio found in response. Keys:', Object.keys(result.output || {}))
  return ''
}

function wsCloseReasonToString(reason: unknown): string {
  if (reason == null) return ''
  if (typeof reason === 'string') return reason
  if (reason instanceof Uint8Array) {
    return reason.byteLength ? new TextDecoder().decode(reason) : ''
  }
  if (typeof (reason as { toString?: () => string }).toString === 'function') {
    return String(reason)
  }
  return ''
}

/** Gummy duplex 流：官方建议每 100ms 发送一段 100ms 的 PCM，避免 IdleTimeout。 */
const GUMMY_CHUNK_MS = 100
const GUMMY_BYTES_PER_SEC = 16000 * 2
const GUMMY_CHUNK_BYTES = Math.floor((GUMMY_BYTES_PER_SEC * GUMMY_CHUNK_MS) / 1000)

/** 尾部静音（ms），帮助 VAD 收口末句 */
const TAIL_SILENCE_MS = 1800
/** finish-task 前等待 */
const PRE_FINISH_DELAY_MS = 500
/** finish-task 发出后等待 task-finished / 末句的宽限期 */
const AFTER_FINISH_GRACE_MS = 45_000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function padTailSilencePcm(pcm: Uint8Array, silenceMs: number): Uint8Array {
  const extra = Math.floor((silenceMs / 1000) * GUMMY_BYTES_PER_SEC)
  if (extra <= 0) return pcm
  const out = new Uint8Array(pcm.length + extra)
  out.set(pcm)
  return out
}

type DeltaCallback = (p: { originalText: string; translatedText: string }) => void

type RunSpeechInput =
  | { kind: 'buffer'; audioData: Uint8Array }
  | { kind: 'stream'; reader: ReadableStreamDefaultReader<Uint8Array> }

function computeTimeoutMs(audioBytes: number, streamInput: boolean): number {
  const audioDurationSec = audioBytes / GUMMY_BYTES_PER_SEC
  const pacedUploadMs = audioBytes === 0
    ? 0
    : (Math.max(1, Math.ceil(audioBytes / GUMMY_CHUNK_BYTES)) - 1) * GUMMY_CHUNK_MS
  const processingBudgetMs = Math.min(180_000, Math.max(75_000, 45_000 + audioDurationSec * 18_000))
  if (streamInput) {
    return Math.min(900_000, Math.max(120_000, processingBudgetMs + pacedUploadMs + 120_000))
  }
  return processingBudgetMs + pacedUploadMs
}

/**
 * forceSourceLang: 'specific'（默认）= 传 langMap[sourceLang]；
 *                 'auto'             = 省略 source_language，让 Gummy 自动检测。
 * 用于诊断假设 1：Gummy 是否把 source_language 当软提示而 auto-detect 主导。
 */
type ForceSourceLangMode = 'specific' | 'auto'

async function runSpeechSession(
  input: RunSpeechInput,
  sourceLang: string,
  targetLang: string,
  debug: boolean,
  onDelta?: DeltaCallback,
  forceSourceLang: ForceSourceLangMode = 'specific',
): Promise<{ transcription: string; translation: string; rawMessages?: string[] }> {
  const taskId = generateUUID()
  const streamInput = input.kind === 'stream'

  let approxBytes = input.kind === 'buffer' ? input.audioData.length : 0
  const timeoutMs = computeTimeoutMs(approxBytes, streamInput)

  console.log(
    '[WS] runSpeechSession',
    input.kind,
    'approxBytes:',
    approxBytes,
    'timeoutMs:',
    timeoutMs,
    'forceSourceLang:',
    forceSourceLang,
  )

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'user-agent': 'traveltalk-edge/1.0',
      },
    })

    let resultText = ''
    let translationText = ''
    let wsError = ''
    let timeoutId: number | null = null
    let isSettled = false
    let lastPartialText = ''
    const transcriptionBySentence = new Map<number, string>()
    const translationBySentence = new Map<number, string>()
    const rawMessages: string[] = []

    const mergeBySentenceId = (m: Map<number, string>): string =>
      [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t).join('')

    const settle = (
      callback: (value: { transcription: string; translation: string } | Error) => void,
      value: { transcription: string; translation: string } | Error
    ) => {
      if (isSettled) return
      isSettled = true
      if (timeoutId) clearTimeout(timeoutId)
      try {
        ws.close()
      } catch { /* noop */ }
      callback(value)
    }

    const runTimeoutHandler = () => {
      console.log('[WS] Timeout fired')
      const partialTx = resultText || lastPartialText || mergeBySentenceId(transcriptionBySentence)
      const partialTl = translationText || mergeBySentenceId(translationBySentence)
      try {
        ws.close()
      } catch { /* noop */ }
      if (partialTx || partialTl) {
        console.log('[WS] Partial result on timeout — transcription:', partialTx?.slice(0, 80), 'translation:', partialTl?.slice(0, 80))
        settle(resolve, {
          transcription: partialTx || '',
          translation: partialTl || '',
          ...(debug ? { rawMessages } : {}),
        } as any)
      } else {
        settle(reject, new Error(`WebSocket timeout`))
      }
    }

    const scheduleTimeout = (ms: number) => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(runTimeoutHandler, ms) as unknown as number
    }

    scheduleTimeout(timeoutMs)

    const onFinishTaskSent = () => {
      console.log('[WS] finish-task sent, grace window', AFTER_FINISH_GRACE_MS, 'ms')
      scheduleTimeout(AFTER_FINISH_GRACE_MS)
    }

    ws.on('open', () => {
      console.log('[WS] Connected! Sending run-task...')
      const runTask = {
        header: {
          streaming: 'duplex',
          task_id: taskId,
          action: 'run-task',
        },
        payload: {
          model: DASHSCOPE.asr.model,
          parameters: {
            sample_rate: 16000,
            format: 'pcm',
            max_end_silence: 800,
            transcription_enabled: true,
            // forceSourceLang='auto' → 省略字段，让 Gummy 自动检测（诊断假设1用）
            ...(forceSourceLang === 'auto'
              ? {}
              : { source_language: langMap[sourceLang] }),
            translation_enabled: targetLang !== sourceLang,
            translation_target_languages: [langMap[targetLang] || 'en'],
          },
          input: {},
          task: 'asr',
          task_group: 'audio',
          function: 'recognition',
        },
      }
      console.log('[WS] >>> run-task:', JSON.stringify(runTask))
      ws.send(JSON.stringify(runTask))
      console.log('[WS] run-task sent, waiting for task-started...')
    })

    ws.on('message', (data: Uint8Array | string) => {
      const dataStr = typeof data === 'string' ? data
        : data instanceof Uint8Array ? new TextDecoder().decode(data)
        : ''

      if (!dataStr) {
        return
      }

      if (debug) rawMessages.push(dataStr)
      console.log('[WS] MSG:', dataStr.substring(0, 600))

      try {
        const msg = JSON.parse(dataStr)
        const event = msg.header?.event

        if (event === 'task-started') {
          void (async () => {
            try {
              if (input.kind === 'buffer') {
                const padded = padTailSilencePcm(input.audioData, TAIL_SILENCE_MS)
                console.log('[WS] buffer mode, padded bytes:', padded.length, 'original:', input.audioData.length)
                let offset = 0
                let frameIdx = 0
                while (offset < padded.length && !isSettled) {
                  const end = Math.min(offset + GUMMY_CHUNK_BYTES, padded.length)
                  ws.send(padded.slice(offset, end))
                  if (frameIdx === 0) {
                    console.log('[WS] >>> binary frame', frameIdx, 'bytes:', end - offset, 'totalSent:', end)
                  }
                  frameIdx++
                  offset = end
                  if (offset < padded.length && !isSettled) {
                    await delay(GUMMY_CHUNK_MS)
                  }
                }
              } else {
                const reader = input.reader
                let buffer = new Uint8Array(0)
                const append = (chunk: Uint8Array) => {
                  if (chunk.length === 0) return
                  const n = new Uint8Array(buffer.length + chunk.length)
                  n.set(buffer)
                  n.set(chunk, buffer.length)
                  buffer = n
                }
                while (true) {
                  if (isSettled) break
                  const { done, value } = await reader.read()
                  if (done) break
                  if (value?.length) {
                    append(value)
                    approxBytes += value.length
                  }
                  while (buffer.length >= GUMMY_CHUNK_BYTES && !isSettled) {
                    ws.send(buffer.slice(0, GUMMY_CHUNK_BYTES))
                    buffer = buffer.slice(GUMMY_CHUNK_BYTES)
                    await delay(GUMMY_CHUNK_MS)
                  }
                }
                if (buffer.length > 0 && !isSettled) {
                  const pad = new Uint8Array(GUMMY_CHUNK_BYTES)
                  pad.set(buffer.subarray(0, Math.min(buffer.length, GUMMY_CHUNK_BYTES)))
                  ws.send(pad)
                  await delay(GUMMY_CHUNK_MS)
                }
                const tail = new Uint8Array(Math.floor((TAIL_SILENCE_MS / 1000) * GUMMY_BYTES_PER_SEC))
                let t = 0
                while (t < tail.length && !isSettled) {
                  const end = Math.min(t + GUMMY_CHUNK_BYTES, tail.length)
                  ws.send(tail.slice(t, end))
                  t = end
                  if (t < tail.length && !isSettled) await delay(GUMMY_CHUNK_MS)
                }
                console.log('[WS] stream mode done, approxBytes:', approxBytes, 'expectedDurationSec:', (approxBytes / GUMMY_BYTES_PER_SEC).toFixed(1))
              }
            } catch (e) {
              console.error('[WS] Audio send failed:', e)
            }
            if (isSettled) return
            await delay(PRE_FINISH_DELAY_MS)
            if (isSettled) return
            console.log('[WS] sending finish-task...')
            try {
              const finishTask = {
                header: {
                  streaming: 'duplex',
                  task_id: taskId,
                  action: 'finish-task',
                },
                payload: { input: {} },
              }
              console.log('[WS] >>> finish-task:', JSON.stringify(finishTask))
              ws.send(JSON.stringify(finishTask))
              onFinishTaskSent()
            } catch (e) {
              console.error('[WS] finish-task send failed:', e)
            }
          })()
        } else if (event === 'result-generated') {
          const output = msg.payload?.output || {}

          const transcription = output?.transcription
          if (transcription?.text != null) {
            const sid = typeof transcription.sentence_id === 'number' ? transcription.sentence_id : 0
            transcriptionBySentence.set(sid, transcription.text)
            lastPartialText = mergeBySentenceId(transcriptionBySentence)
            console.log('[WS] Transcription update:', lastPartialText, '| lang:', transcription.lang ?? 'N/A', '| sentence_end:', transcription.sentence_end ?? 'N/A')
          }

          const sentence = output?.sentence
          if (sentence?.text && !transcription) {
            const sid = typeof sentence.sentence_id === 'number' ? sentence.sentence_id : 0
            transcriptionBySentence.set(sid, sentence.text)
            lastPartialText = mergeBySentenceId(transcriptionBySentence)
            console.log('[WS] Transcription (sentence):', lastPartialText)
          }

          const translations = output?.translations
          if (Array.isArray(translations)) {
            for (const t of translations) {
              if (t?.text != null) {
                const sid = typeof t.sentence_id === 'number' ? t.sentence_id : 0
                translationBySentence.set(sid, t.text)
                if (t.lang) {
                  console.log('[WS] Translation lang:', t.lang, '| text:', String(t.text).substring(0, 60))
                }
              }
            }
            if (translationBySentence.size > 0) {
              translationText = mergeBySentenceId(translationBySentence)
              console.log('[WS] Translation merged:', translationText)
            }
          }

          const ox = mergeBySentenceId(transcriptionBySentence)
          const tx = mergeBySentenceId(translationBySentence)
          if (onDelta && (ox || tx)) {
            onDelta({ originalText: ox, translatedText: tx })
          }
        } else if (event === 'task-finished') {
          const mergedTx = mergeBySentenceId(transcriptionBySentence)
          const mergedTl = mergeBySentenceId(translationBySentence)
          if (!resultText && (mergedTx || lastPartialText)) {
            resultText = mergedTx || lastPartialText
            console.log('[WS] Using merged transcription:', resultText)
          }
          if (mergedTl) translationText = mergedTl
          console.log('[WS] Task finished! transcription:', resultText, '| translation:', translationText)
          settle(resolve, { transcription: resultText, translation: translationText, ...(debug ? { rawMessages } : {}) } as any)
        } else if (event === 'task-failed') {
          const errCode = msg.header?.error_code
          const errMsg = msg.header?.error_message || msg.payload?.error_message
          console.error('[WS] Gummy task-failed:', errCode, errMsg, '| full header:', JSON.stringify(msg.header))
          const partialTx = resultText || lastPartialText || mergeBySentenceId(transcriptionBySentence)
          const partialTl = translationText || mergeBySentenceId(translationBySentence)
          const isIdleTimeout = errCode === 'IdleTimeout'
            || String(errMsg || '').toLowerCase().includes('idle')
          if (isIdleTimeout && (partialTx || partialTl)) {
            console.warn('[WS] IdleTimeout with partial result — returning success with transcript/translation')
            settle(resolve, {
              transcription: partialTx || '',
              translation: partialTl || '',
              ...(debug ? { rawMessages } : {}),
            } as any)
          } else {
            settle(reject, new Error(`Gummy error${errCode ? ` [${errCode}]` : ''}: ${errMsg || 'Unknown error'}`))
          }
        }
      } catch (e) {
        console.error('[WS] Parse error:', e, 'raw:', dataStr.substring(0, 200))
      }
    })

    ws.on('error', (error: Error) => {
      console.error('[WS] Error:', error?.message || error)
      wsError = error?.message || 'WebSocket error'
      settle(reject, new Error(wsError))
    })

    ws.on('close', (code: number, reason: Buffer) => {
      const reasonStr = wsCloseReasonToString(reason)
      console.log('[WS] Closed, code:', code, 'reason:', reasonStr)
      if (isSettled) return
      const transcription = resultText || lastPartialText
      const translation = translationText
      if (transcription || translation) {
        settle(resolve, {
          transcription: transcription || '',
          translation: translation || '',
          ...(debug ? { rawMessages } : {}),
        } as any)
      } else {
        settle(reject, new Error(wsError || reasonStr || `Connection closed (code: ${code})`))
      }
    })
  })
}

async function speechToTextAndTranslate(
  audioData: Uint8Array,
  sourceLang: string,
  targetLang: string,
  debug = false,
  onDelta?: DeltaCallback,
  forceSourceLang: ForceSourceLangMode = 'specific',
): Promise<{ transcription: string; translation: string; audioUrl?: string; rawMessages?: string[] }> {
  return runSpeechSession(
    { kind: 'buffer', audioData },
    sourceLang,
    targetLang,
    debug,
    onDelta,
    forceSourceLang,
  )
}

async function speechToTextAndTranslateFromStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  sourceLang: string,
  targetLang: string,
  debug = false,
  onDelta?: DeltaCallback,
  forceSourceLang: ForceSourceLangMode = 'specific',
): Promise<{ transcription: string; translation: string; rawMessages?: string[] }> {
  return runSpeechSession(
    { kind: 'stream', reader },
    sourceLang,
    targetLang,
    debug,
    onDelta,
    forceSourceLang,
  )
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function ndjsonResponse(
  run: (send: (obj: Record<string, unknown>) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {
          /* closed */
        }
      }
      void (async () => {
        try {
          await run(send)
        } finally {
          try {
            controller.close()
          } catch {
            /* noop */
          }
        }
      })()
    },
  })
  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/x-ndjson; charset=utf-8',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const ct = req.headers.get('content-type') || ''

  if (req.method === 'POST' && ct.includes('application/octet-stream')) {
    const url = new URL(req.url)
    const sourceLang = url.searchParams.get('sourceLang')
    const targetLang = url.searchParams.get('targetLang')
    const skipTts = url.searchParams.get('skipTts') === 'true'
    const debug = url.searchParams.get('debug') === 'true'
    const forceSourceLangRaw = url.searchParams.get('forceSourceLang')
    const forceSourceLang: ForceSourceLangMode =
      forceSourceLangRaw === 'auto' ? 'auto' : 'specific'

    if (!sourceLang || !targetLang) {
      return Response.json(
        { error: 'sourceLang and targetLang query params are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const body = req.body
    if (!body) {
      return Response.json({ error: 'Request body required' }, { status: 400, headers: corsHeaders })
    }

    const reader = body.getReader()

    console.log(`[FN] voice-translate stream PCM ${sourceLang}->${targetLang} forceSourceLang:${forceSourceLang}`)

    return ndjsonResponse(async (send) => {
      try {
        send({ type: 'started' })
        const result = await speechToTextAndTranslateFromStream(
          reader,
          sourceLang,
          targetLang,
          debug,
          (d) => {
            send({
              type: 'delta',
              originalText: d.originalText,
              translatedText: d.translatedText,
            })
          },
          forceSourceLang,
        ) as { transcription: string; translation: string; rawMessages?: string[] }

        send({
          type: 'text_complete',
          success: true,
          originalText: result.transcription,
          translatedText: result.translation,
          ttsStatus: skipTts ? 'skipped' : 'pending',
          ...(debug && result.rawMessages ? { rawMessages: result.rawMessages } : {}),
        })

        let audioUrl = ''
        let ttsError = ''
        if (!skipTts) {
          try {
            audioUrl = await callTTS(result.translation, targetLang)
            send({
              type: 'tts_complete',
              audioUrl,
            })
          } catch (ttsErr) {
            console.error('[FN] TTS failed (non-fatal):', ttsErr)
            ttsError = ttsErr instanceof Error ? ttsErr.message : 'TTS failed'
            send({
              type: 'tts_error',
              error: ttsError,
            })
          }
        }

        send({
          type: 'complete',
          success: true,
          originalText: result.transcription,
          translatedText: result.translation,
          audioUrl,
          ...(ttsError ? { ttsError } : {}),
          ...(debug && result.rawMessages ? { rawMessages: result.rawMessages } : {}),
        })
      } catch (error) {
        console.error('[FN] stream PCM error:', error)
        send({
          type: 'complete',
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        })
      }
    })
  }

  try {
    const body = await req.json() as VoiceTranslateRequest & {
      debug?: boolean
      skipTts?: boolean
      ttsOnly?: boolean
      text?: string
      format?: string
      stream?: boolean
    }

    if (body.ttsOnly === true) {
      const text = body.text
      const targetLang = body.targetLang
      if (text == null || typeof text !== 'string' || !targetLang) {
        return Response.json(
          { error: 'ttsOnly requires text and targetLang' },
          { status: 400, headers: corsHeaders }
        )
      }
      const audioUrl = await callTTS(text.trim(), targetLang)
      return Response.json({
        success: true,
        originalText: '',
        translatedText: text.trim(),
        audioUrl,
      }, { headers: corsHeaders })
    }

    const { audio, sourceLang, targetLang, debug, skipTts, stream } = body
    const forceSourceLangJson: ForceSourceLangMode =
      (body as Record<string, unknown>).forceSourceLang === 'auto' ? 'auto' : 'specific'

    if (!audio || !sourceLang || !targetLang) {
      return Response.json(
        { error: 'audio, sourceLang and targetLang are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(
      `[FN] voice-translate ${sourceLang}->${targetLang}, audio:${audio.length} chars base64, skipTts:${!!skipTts}, stream:${!!stream}, forceSourceLang:${forceSourceLangJson}`
    )

    const binaryString = atob(audio)
    const audioData = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      audioData[i] = binaryString.charCodeAt(i) & 0xff
    }

    if (stream === true) {
      return ndjsonResponse(async (send) => {
        try {
          send({ type: 'started' })
          const result = await speechToTextAndTranslate(
            audioData,
            sourceLang,
            targetLang,
            !!debug,
            (d) => {
              send({
                type: 'delta',
                originalText: d.originalText,
                translatedText: d.translatedText,
              })
            },
            forceSourceLangJson,
          ) as { transcription: string; translation: string; rawMessages?: string[] }

          send({
            type: 'text_complete',
            success: true,
            originalText: result.transcription,
            translatedText: result.translation,
            ttsStatus: skipTts ? 'skipped' : 'pending',
            ...(debug && result.rawMessages ? { rawMessages: result.rawMessages } : {}),
          })

          let audioUrl = ''
          let ttsError = ''
          if (!skipTts) {
            try {
              audioUrl = await callTTS(result.translation, targetLang)
              send({
                type: 'tts_complete',
                audioUrl,
              })
            } catch (ttsErr) {
              console.error('[FN] TTS failed (non-fatal):', ttsErr)
              ttsError = ttsErr instanceof Error ? ttsErr.message : 'TTS failed'
              send({
                type: 'tts_error',
                error: ttsError,
              })
            }
          }

          send({
            type: 'complete',
            success: true,
            originalText: result.transcription,
            translatedText: result.translation,
            audioUrl,
            ...(ttsError ? { ttsError } : {}),
            ...(debug && result.rawMessages ? { rawMessages: result.rawMessages } : {}),
          })
        } catch (error) {
          console.error('[FN] stream error:', error)
          send({
            type: 'complete',
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
          })
        }
      })
    }

    const { transcription, translation, rawMessages } = await speechToTextAndTranslate(
      audioData,
      sourceLang,
      targetLang,
      !!debug,
      undefined,
      forceSourceLangJson,
    ) as any

    let audioUrl = ''
    if (!skipTts) {
      try {
        audioUrl = await callTTS(translation, targetLang)
      } catch (ttsErr) {
        console.error('[FN] TTS failed (non-fatal):', ttsErr)
      }
    }

    return Response.json({
      success: true,
      originalText: transcription,
      translatedText: translation,
      audioUrl,
      ...(debug ? { rawMessages } : {}),
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('[FN] Error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
})
