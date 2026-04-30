// Translation API service
// Handles translation requests with caching

import { supabase } from './supabase'
import type { VoiceTranslateResponse, ImageTranslateResponse, LanguageCode } from '../types'
import { uint8ArrayToBase64 } from '../hooks/useVoice'

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Generate cache key
function getCacheKey(text: string, sourceLang: string, targetLang: string): string {
  return `${sourceLang}:${targetLang}:${text.slice(0, 100)}`
}

// Check cache first
async function getCachedTranslation(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  const cacheKey = getCacheKey(text, sourceLang, targetLang)

  const { data, error } = await supabase
    .from('translations_cache')
    .select('translated_text')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) {
    return null
  }

  return data.translated_text
}

// Save to cache
async function saveToCache(
  text: string,
  sourceLang: string,
  targetLang: string,
  translatedText: string
): Promise<void> {
  const cacheKey = getCacheKey(text, sourceLang, targetLang)

  await supabase.from('translations_cache').insert({
    source_lang: sourceLang,
    target_lang: targetLang,
    source_text: text.slice(0, 1000),
    translated_text: translatedText.slice(0, 1000),
    cache_key: cacheKey,
  })
}

// Call LLM Gateway
async function callLLMGateway(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (!FUNCTIONS_URL) {
    throw new Error('LLM Gateway not configured')
  }

  // Get session token if available, otherwise use anon key
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token || SUPABASE_ANON_KEY

  const response = await fetch(`${FUNCTIONS_URL}/llm-gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      text,
      sourceLang,
      targetLang,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Translation failed')
  }

  const data = await response.json()
  return data.translatedText
}

// Main translation function
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  // Try cache first
  const cached = await getCachedTranslation(text, sourceLang, targetLang)
  if (cached) {
    return cached
  }

  // Call LLM Gateway
  const translated = await callLLMGateway(text, sourceLang, targetLang)

  // Save to cache (don't await)
  saveToCache(text, sourceLang, targetLang, translated).catch(console.error)

  return translated
}

export interface VoiceTranslateRequestOptions {
  skipTts?: boolean
  signal?: AbortSignal
  /** Per-request ceiling; chunked pipeline uses longer outer budget */
  timeoutMs?: number
}

const DEFAULT_VOICE_TIMEOUT_MS = 180_000

function mergeAbortSignals(outer: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const c = new AbortController()
  const tid = window.setTimeout(() => c.abort(), timeoutMs)
  const onOuterAbort = () => {
    window.clearTimeout(tid)
    c.abort()
  }
  if (outer) {
    if (outer.aborted) onOuterAbort()
    else outer.addEventListener('abort', onOuterAbort)
  }
  return {
    signal: c.signal,
    cleanup: () => {
      window.clearTimeout(tid)
      if (outer) outer.removeEventListener('abort', onOuterAbort)
    },
  }
}

// Voice translation API (single PCM base64 payload)
export async function voiceTranslate(
  audioBase64: string,
  sourceLang: LanguageCode,
  targetLang: LanguageCode,
  format: string,
  options?: VoiceTranslateRequestOptions
): Promise<VoiceTranslateResponse> {
  if (!FUNCTIONS_URL) {
    throw new Error('Edge Functions not configured')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token || SUPABASE_ANON_KEY

  const timeoutMs = options?.timeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS
  const { signal, cleanup } = mergeAbortSignals(options?.signal, timeoutMs)

  try {
    const response = await fetch(`${FUNCTIONS_URL}/voice-translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        audio: audioBase64,
        sourceLang,
        targetLang,
        format,
        skipTts: options?.skipTts === true,
      }),
      signal,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: string }).error || 'Voice translation failed')
    }

    return await response.json()
  } finally {
    cleanup()
  }
}

/** TTS only (after chunked ASR merge) */
export async function voiceTtsOnly(
  text: string,
  targetLang: LanguageCode,
  options?: Pick<VoiceTranslateRequestOptions, 'signal' | 'timeoutMs'>
): Promise<VoiceTranslateResponse> {
  if (!FUNCTIONS_URL) {
    throw new Error('Edge Functions not configured')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token || SUPABASE_ANON_KEY

  const timeoutMs = options?.timeoutMs ?? 90_000
  const { signal, cleanup } = mergeAbortSignals(options?.signal, timeoutMs)

  try {
    const response = await fetch(`${FUNCTIONS_URL}/voice-translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        ttsOnly: true,
        text: text.trim(),
        targetLang,
      }),
      signal,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: string }).error || 'TTS request failed')
    }

    return await response.json()
  } finally {
    cleanup()
  }
}

/** 16-bit mono 16kHz PCM */
export const PCM_BYTES_PER_SEC = 16000 * 2

/** 尾部补静音，便于 Gummy VAD 在 finish-task 前收口最后一句（默认 800ms 断句阈值）。 */
export function padPcmTrailingSilenceMs(pcm: Uint8Array, silenceMs: number): Uint8Array {
  if (silenceMs <= 0 || pcm.length === 0) return pcm
  const extra = Math.floor((silenceMs / 1000) * PCM_BYTES_PER_SEC)
  if (extra <= 0) return pcm
  const out = new Uint8Array(pcm.length + extra)
  out.set(pcm)
  return out
}

const PCM_CHUNK_SEC = 18
const PCM_OVERLAP_SEC = 1

export function splitPcmIntoChunks(pcm: Uint8Array): Uint8Array[] {
  const chunkBytes = PCM_CHUNK_SEC * PCM_BYTES_PER_SEC
  const stepBytes = (PCM_CHUNK_SEC - PCM_OVERLAP_SEC) * PCM_BYTES_PER_SEC
  if (pcm.length === 0) return []
  if (pcm.length <= chunkBytes) return [pcm]

  const chunks: Uint8Array[] = []
  for (let offset = 0; offset < pcm.length; offset += stepBytes) {
    const end = Math.min(offset + chunkBytes, pcm.length)
    chunks.push(pcm.slice(offset, end))
    if (end >= pcm.length) break
  }
  return chunks
}

/** Chrome/Edge：fetch 可传 ReadableStream body；Safari 常不支持，需降级整段 POST */
export function supportsRequestBodyStream(): boolean {
  if (typeof ReadableStream === 'undefined') return false
  if (typeof navigator === 'undefined') return true
  const ua = navigator.userAgent
  if (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg/.test(ua)) return false
  return true
}

async function* readNdjsonStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split('\n')
      buf = parts.pop() ?? ''
      for (const line of parts) {
        const t = line.trim()
        if (t) yield JSON.parse(t) as Record<string, unknown>
      }
    }
    const tail = buf.trim()
    if (tail) yield JSON.parse(tail) as Record<string, unknown>
  } finally {
    reader.releaseLock()
  }
}

/**
 * 浏览器 ReadableStream PCM → Edge octet-stream → Gummy（边说边出 delta）
 */
export async function voiceTranslatePcmRequestStream(
  body: ReadableStream<Uint8Array>,
  sourceLang: LanguageCode,
  targetLang: LanguageCode,
  signal: AbortSignal | undefined,
  onDelta?: (p: { originalText: string; translatedText: string }) => void
): Promise<VoiceTranslateResponse> {
  if (!FUNCTIONS_URL) {
    throw new Error('Edge Functions not configured')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token || SUPABASE_ANON_KEY
  const qs = new URLSearchParams({ sourceLang, targetLang })
  const timeoutMs = 900_000
  const { signal: mergedSignal, cleanup } = mergeAbortSignals(signal, timeoutMs)

  try {
    const response = await fetch(`${FUNCTIONS_URL}/voice-translate?${qs}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `Bearer ${token}`,
      },
      body,
      duplex: 'half',
      signal: mergedSignal,
    } as RequestInit & { duplex: 'half' })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: string }).error || 'Voice translation failed')
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    let final: VoiceTranslateResponse | null = null
    for await (const ev of readNdjsonStream(response.body, mergedSignal)) {
      if (ev.type === 'delta' && onDelta) {
        onDelta({
          originalText: String(ev.originalText ?? ''),
          translatedText: String(ev.translatedText ?? ''),
        })
      }
      if (ev.type === 'complete') {
        if (ev.success === true) {
          final = {
            originalText: String(ev.originalText ?? ''),
            translatedText: String(ev.translatedText ?? ''),
            audioUrl: typeof ev.audioUrl === 'string' ? ev.audioUrl : undefined,
          }
        } else {
          throw new Error(String(ev.error ?? 'Voice translation failed'))
        }
      }
    }

    if (!final) {
      throw new Error('Stream ended without complete event')
    }
    return final
  } finally {
    cleanup()
  }
}

/**
 * 单次 Edge 请求 + NDJSON：`delta` 对齐 Gummy `result-generated`（按句合并），`complete` 含 TTS。
 * PCM 尾部静音由 Edge 统一处理。
 */
async function voiceTranslatePcmStreaming(
  pcm: Uint8Array,
  sourceLang: LanguageCode,
  targetLang: LanguageCode,
  format: string,
  signal: AbortSignal | undefined,
  onDelta?: (p: { originalText: string; translatedText: string }) => void
): Promise<VoiceTranslateResponse> {
  if (!FUNCTIONS_URL) {
    throw new Error('Edge Functions not configured')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token || SUPABASE_ANON_KEY
  const b64 = await uint8ArrayToBase64(pcm)
  const sec = pcm.length / PCM_BYTES_PER_SEC
  const timeoutMs = Math.min(600_000, 60_000 + sec * 25_000)
  const { signal: mergedSignal, cleanup } = mergeAbortSignals(signal, timeoutMs)

  try {
    const response = await fetch(`${FUNCTIONS_URL}/voice-translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        audio: b64,
        sourceLang,
        targetLang,
        format,
        stream: true,
      }),
      signal: mergedSignal,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: string }).error || 'Voice translation failed')
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    let final: VoiceTranslateResponse | null = null
    for await (const ev of readNdjsonStream(response.body, mergedSignal)) {
      if (ev.type === 'delta' && onDelta) {
        onDelta({
          originalText: String(ev.originalText ?? ''),
          translatedText: String(ev.translatedText ?? ''),
        })
      }
      if (ev.type === 'complete') {
        if (ev.success === true) {
          final = {
            originalText: String(ev.originalText ?? ''),
            translatedText: String(ev.translatedText ?? ''),
            audioUrl: typeof ev.audioUrl === 'string' ? ev.audioUrl : undefined,
          }
        } else {
          throw new Error(String(ev.error ?? 'Voice translation failed'))
        }
      }
    }

    if (!final) {
      throw new Error('Stream ended without complete event')
    }
    return final
  } finally {
    cleanup()
  }
}

/**
 * 从录音 PCM 走 Gummy 流式识别（Edge NDJSON），长句按句逐步显示；最终一次 TTS。
 */
export async function voiceTranslateFromPcm(
  pcm: Uint8Array,
  sourceLang: LanguageCode,
  targetLang: LanguageCode,
  format: string,
  signal?: AbortSignal,
  onDelta?: (p: { originalText: string; translatedText: string }) => void
): Promise<VoiceTranslateResponse> {
  return voiceTranslatePcmStreaming(pcm, sourceLang, targetLang, format, signal, onDelta)
}

// Image translation API（v1.4: targetLang 固定为 pair.A 由调用方决定；sourceLang 透传但后端不再特别处理）
export async function imageTranslate(
  imageBase64: string,
  sourceLang: LanguageCode | 'auto',
  targetLang: LanguageCode,
  options?: {
    nativeLang?: LanguageCode
    foreignLang?: LanguageCode
  },
): Promise<ImageTranslateResponse> {
  if (!FUNCTIONS_URL) {
    throw new Error('Edge Functions not configured')
  }

  // Get session token if available, otherwise use anon key
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token || SUPABASE_ANON_KEY

  const response = await fetch(`${FUNCTIONS_URL}/image-translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      image: imageBase64.replace(/^data:image\/\w+;base64,/, ''), // Strip data URI prefix
      sourceLang,
      targetLang,
      ...options,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Image translation failed')
  }

  const data = await response.json()
  return data
}
