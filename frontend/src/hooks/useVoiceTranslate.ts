import { useCallback, useEffect, useRef, useState } from 'react'
import { useVoice } from './useVoice'
import { convertToPCM } from './useVoice'
import { createPcmReadableStream, startPcmFromMicrophone } from './usePcmStream'
import { useAppStore } from '../stores/appStore'
import {
  supportsRequestBodyStream,
  translateText,
  type VoiceTranslateStreamEvent,
  voiceTtsOnly,
  voiceTranslateFromPcm,
  voiceTranslatePcmRequestStream,
} from '../services/translation'
import { recordTranslation } from '../services/sessions'
import type { LanguageCode, VoiceTranslateResponse } from '../types'

type PcmSession = {
  close: () => void
  stopMic: () => Promise<void>
  fetchPromise: Promise<VoiceTranslateResponse>
  ac: AbortController
  sourceLang: LanguageCode
  targetLang: LanguageCode
}

/**
 * v1.4: 方向由 UI 决定 —— `startLeftRecording` 说外语（pair.B → pair.A），
 * `startRightRecording` 说母语（pair.A → pair.B）。没有自动检测 / reconcile。
 */
type PillSide = 'left' | 'right'

async function completeVoiceResult(
  result: VoiceTranslateResponse,
  sourceLang: LanguageCode,
  targetLang: LanguageCode,
): Promise<VoiceTranslateResponse> {
  const originalText = result.originalText?.trim() ?? ''
  let translatedText = result.translatedText?.trim() ?? ''
  let audioUrl = result.audioUrl || undefined

  const needsFallback =
    !!originalText &&
    sourceLang !== targetLang &&
    (!translatedText || translatedText === originalText)

  if (!needsFallback) {
    return {
      originalText,
      translatedText,
      ...(audioUrl ? { audioUrl } : {}),
      ...(result.ttsError ? { ttsError: result.ttsError } : {}),
    }
  }

  translatedText = await translateText(originalText, sourceLang, targetLang)
  try {
    const tts = await voiceTtsOnly(translatedText, targetLang)
    audioUrl = tts.audioUrl || audioUrl
  } catch (err) {
    console.warn('Voice TTS fallback failed:', err)
  }

  return {
    originalText,
    translatedText,
    ...(audioUrl ? { audioUrl } : {}),
  }
}

function makeVoiceStreamEventHandler(sourceLang: LanguageCode, targetLang: LanguageCode) {
  return (event: VoiceTranslateStreamEvent) => {
    const store = useAppStore.getState()
    if (event.type === 'started') {
      store.setVoiceStreamStarted(sourceLang, targetLang)
      return
    }
    if (event.type === 'text_complete') {
      store.setVoiceTextComplete(event.originalText, event.translatedText, sourceLang, targetLang)
      return
    }
    if (event.type === 'tts_complete') {
      store.setVoiceTtsReady(event.audioUrl)
      return
    }
    if (event.type === 'tts_error') {
      store.setVoiceTtsError(event.error)
    }
  }
}

export function useVoiceTranslate() {
  const { setVoiceCaptureActive } = useAppStore()
  const [recordingSide, setRecordingSide] = useState<PillSide | null>(null)
  const recordingSideRef = useRef<PillSide | null>(null)
  const pendingLangsRef = useRef<{ source: LanguageCode; target: LanguageCode } | null>(null)
  const pcmSessionRef = useRef<PcmSession | null>(null)
  const [pcmActive, setPcmActive] = useState(false)
  const pcmStartRef = useRef(0)
  const [pcmDuration, setPcmDuration] = useState(0)

  useEffect(() => {
    if (!pcmActive) {
      setPcmDuration(0)
      return
    }
    pcmStartRef.current = Date.now()
    const id = window.setInterval(() => {
      setPcmDuration((Date.now() - pcmStartRef.current) / 1000)
    }, 100)
    return () => clearInterval(id)
  }, [pcmActive])

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    const side = recordingSideRef.current
    const langs = pendingLangsRef.current
    if (!side || !langs) return

    const {
      setTranslationResult: putResult,
      setVoiceTranslationProgress,
      setIsTranslating: setTrans,
      setTranslationError: setErr,
    } = useAppStore.getState()

    try {
      setErr(null)
      setVoiceTranslationProgress('', '', langs.source, langs.target)
      const pcmData = await convertToPCM(blob)
      const handleEvent = makeVoiceStreamEventHandler(langs.source, langs.target)
      const result = await voiceTranslateFromPcm(
        pcmData,
        langs.source,
        langs.target,
        'audio/pcm',
        undefined,
        (d) => setVoiceTranslationProgress(d.originalText, d.translatedText, langs.source, langs.target),
        handleEvent,
      )

      const completed = await completeVoiceResult(result, langs.source, langs.target)

      putResult(
        completed.originalText || '',
        completed.translatedText || '',
        'voice',
        completed.audioUrl || null,
        langs.source,
        langs.target,
      )
      recordTranslation({
        type: 'voice',
        originalText: completed.originalText || '',
        translatedText: completed.translatedText || '',
        sourceLang: langs.source,
        targetLang: langs.target,
        audioUrl: completed.audioUrl || null,
      })
    } catch (err) {
      console.error('Voice translation error:', err)
      const msg = err instanceof Error ? err.message : '语音翻译失败'
      setErr(msg)
      setTrans(false)
    } finally {
      recordingSideRef.current = null
      pendingLangsRef.current = null
      setRecordingSide(null)
    }
  }, [])

  const { isRecording, duration, startRecording, stopRecording, error } = useVoice({
    onRecordingComplete: handleRecordingComplete,
    onError: (err) => {
      console.error('Recording error:', err)
      const msg = err instanceof Error ? err.message : '录音失败'
      const { setTranslationError: setErr, setIsTranslating: setTrans } = useAppStore.getState()
      setErr(msg)
      setTrans(false)
      recordingSideRef.current = null
      pendingLangsRef.current = null
      setRecordingSide(null)
    },
  })

  const startPcmStreamingTranslate = useCallback(
    async (source: LanguageCode, target: LanguageCode) => {
      const { setVoiceCaptureActive, setTranslationError: setErr } = useAppStore.getState()

      setErr(null)
      setVoiceCaptureActive(true, source, target)
      setPcmActive(true)

      const { stream, enqueue, close } = createPcmReadableStream()
      const ac = new AbortController()

      const fetchPromise = voiceTranslatePcmRequestStream(
        stream,
        source,
        target,
        ac.signal,
        (d) => useAppStore.getState().setVoiceTranslationProgress(d.originalText, d.translatedText, source, target),
        makeVoiceStreamEventHandler(source, target),
      )

      const { stop: stopMic, ok } = await startPcmFromMicrophone(
        (u8) => enqueue(u8),
        (e) => {
          console.error('PCM stream error:', e)
          setErr(e.message)
          useAppStore.getState().setIsTranslating(false)
          ac.abort()
          close()
        },
      )

      if (!ok) {
        ac.abort()
        close()
        try {
          await fetchPromise
        } catch {
          /* aborted */
        }
        setPcmActive(false)
        useAppStore.getState().setIsTranslating(false)
        recordingSideRef.current = null
        pendingLangsRef.current = null
        setRecordingSide(null)
        return
      }

      setPcmActive(true)
      pcmSessionRef.current = { close, stopMic, fetchPromise, ac, sourceLang: source, targetLang: target }
    },
    [],
  )

  const startForSide = useCallback(
    async (side: PillSide) => {
      const { languagePair: pair } = useAppStore.getState()
      const source: LanguageCode = side === 'left' ? pair.B : pair.A
      const target: LanguageCode = side === 'left' ? pair.A : pair.B
      recordingSideRef.current = side
      pendingLangsRef.current = { source, target }
      setRecordingSide(side)
      setVoiceCaptureActive(true, source, target)
      if (supportsRequestBodyStream()) {
        await startPcmStreamingTranslate(source, target)
      } else {
        await startRecording()
      }
    },
    [setVoiceCaptureActive, startRecording, startPcmStreamingTranslate],
  )

  const startLeftRecording = useCallback(() => startForSide('left'), [startForSide])
  const startRightRecording = useCallback(() => startForSide('right'), [startForSide])

  const stop = useCallback(async () => {
    if (pcmSessionRef.current) {
      useAppStore.getState().setTranslationError(null)
      const { close, stopMic, fetchPromise, ac, sourceLang, targetLang } = pcmSessionRef.current
      pcmSessionRef.current = null

      try {
        await stopMic()
      } catch (e) {
        console.warn('stopMic', e)
      }
      close()
      setPcmActive(false)
      useAppStore.getState().setVoiceCaptureActive(false, sourceLang, targetLang)

      const {
        setTranslationResult: putResult,
        setTranslationError: setErr,
        setIsTranslating: setTrans,
      } = useAppStore.getState()

      void fetchPromise
        .then(async (result) => {
          const completed = await completeVoiceResult(result, sourceLang, targetLang)
          putResult(
            completed.originalText || '',
            completed.translatedText || '',
            'voice',
            completed.audioUrl || null,
            sourceLang,
            targetLang,
          )
          if (completed.ttsError) {
            useAppStore.getState().setVoiceTtsError(completed.ttsError)
          }
          recordTranslation({
            type: 'voice',
            originalText: completed.originalText || '',
            translatedText: completed.translatedText || '',
            sourceLang,
            targetLang,
            audioUrl: completed.audioUrl || null,
          })
        })
        .catch((err) => {
          if (ac.signal.aborted) {
            setTrans(false)
          } else {
            console.error('Voice translation error:', err)
            const msg = err instanceof Error ? err.message : '语音翻译失败'
            setErr(msg)
            setTrans(false)
          }
        })
        .finally(() => {
          recordingSideRef.current = null
          pendingLangsRef.current = null
          setRecordingSide(null)
        })
      return
    }

    if (!isRecording) return
    useAppStore.getState().setTranslationError(null)
    const langs = pendingLangsRef.current
    useAppStore.getState().setVoiceCaptureActive(false, langs?.source, langs?.target)
    const ended = await stopRecording()
    if (!ended) {
      useAppStore.getState().setIsTranslating(false)
      recordingSideRef.current = null
      pendingLangsRef.current = null
      setRecordingSide(null)
    }
  }, [isRecording, stopRecording])

  const combinedRecording = isRecording || pcmActive
  const combinedDuration = pcmActive ? pcmDuration : duration

  return {
    isRecording: combinedRecording,
    isLeftRecording: combinedRecording && recordingSide === 'left',
    isRightRecording: combinedRecording && recordingSide === 'right',
    recordingSide,
    duration: combinedDuration,
    startLeftRecording,
    startRightRecording,
    stopRecording: stop,
    error,
  }
}
