import { useState, useEffect, useCallback, useRef } from 'react'
import { useVoice, isSpeechRecognitionSupported, recognizeWithBrowserSpeech, convertToPCM, uint8ArrayToBase64, speakText } from '../../hooks/useVoice'
import { checkQuota } from '../../services/quota'
import { translateText, voiceTranslate } from '../../services/translation'
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../../types'

export default function VoiceTranslate() {
  const [sourceLang, setSourceLang] = useState<LanguageCode>('zh')
  const [targetLang, setTargetLang] = useState<LanguageCode>('ja')
  const [originalText, setOriginalText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState<number | null>(null)
  const [showQuotaWarning, setShowQuotaWarning] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [useGummy, setUseGummy] = useState(true)

  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const lastTranslateKeyRef = useRef('')

  const { isRecording, duration, startRecording, stopRecording, error: recordingError } = useVoice({
    onRecordingComplete: handleRecordingComplete,
    onError: (err) => setError(err.message),
  })

  // Check quota on mount and speech support
  useEffect(() => {
    checkQuota().then(({ allowed, remaining: rem }) => {
      setRemaining(rem)
      if (!allowed) {
        setShowQuotaWarning(true)
      }
    })
    setIsSupported(isSpeechRecognitionSupported())
  }, [])

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const handleRecording = useCallback(async () => {
    if (showQuotaWarning) {
      setError('今日翻译次数已用完')
      return
    }

    if (isRecording) {
      // Stop speech recognition or recording
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      await stopRecording()
    } else {
      setError('')
      setShowResult(false)
      setOriginalText('')
      setTranslatedText('')

      if (useGummy) {
        // Use gummy WebSocket via Edge Function
        await startRecording()
      } else {
        // Use browser Web Speech API
        if (!isSpeechRecognitionSupported()) {
          setError('您的浏览器不支持语音识别，请使用Chrome或Edge浏览器')
          setIsSupported(false)
          return
        }

        setIsLoading(true)
        startRecording()

        // Start browser speech recognition
        recognitionRef.current = recognizeWithBrowserSpeech(
          sourceLang,
          (transcript) => {
            setOriginalText(transcript)
          },
          (err) => {
            console.error('Speech recognition error:', err)
            if (err === 'no-speech') {
              setError('没有检测到语音，请重试')
            } else if (err !== 'aborted') {
              setError(`语音识别错误: ${err}`)
            }
          }
        )
      }
    }
  }, [isRecording, showQuotaWarning, startRecording, stopRecording, sourceLang, useGummy])

  // Handle recording complete for gummy mode
  async function handleRecordingComplete(blob: Blob, recordedDuration: number) {
    if (!useGummy) return

    console.log(`Recording complete: ${recordedDuration}s, size: ${blob.size}`)

    setIsLoading(true)
    setError('')

    try {
      // Convert webm audio to PCM format for gummy
      const pcmData = await convertToPCM(blob)
      console.log(`Converted to PCM: ${pcmData.length} bytes`)

      // Convert to base64 for Edge Function
      const base64 = await uint8ArrayToBase64(pcmData)
      console.log(`Audio base64 length: ${base64.length}`)

      // Call Edge Function which handles gummy WebSocket
      const result = await voiceTranslate(base64, sourceLang, targetLang, 'audio/pcm')
      console.log('Translation result:', result)

      setOriginalText(result.originalText || '')
      setTranslatedText(result.translatedText || '')
      setShowResult(true)

      // Auto-play TTS for translated text (browser-native Web Speech API)
      if (result.translatedText) {
        speakText(result.translatedText, targetLang)
      }
    } catch (err) {
      console.error('Translation error:', err)
      setError(err instanceof Error ? err.message : 'Translation failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Translate when original text changes (only for browser speech mode)
  useEffect(() => {
    const translateKey = `${sourceLang}:${targetLang}:${originalText}`
    if (useGummy || !originalText || lastTranslateKeyRef.current === translateKey) return

    const doTranslate = async () => {
      try {
        const translated = await translateText(originalText, sourceLang, targetLang)
        lastTranslateKeyRef.current = translateKey
        setTranslatedText(translated)
        setShowResult(true)
      } catch (err) {
        console.error('Translation error:', err)
        setError(err instanceof Error ? err.message : '翻译失败')
      } finally {
        setIsLoading(false)
      }
    }

    // Debounce translation
    const timer = setTimeout(doTranslate, 500)
    return () => clearTimeout(timer)
  }, [originalText, sourceLang, targetLang, useGummy])

  return (
    <div className="max-w-md mx-auto">
      {/* Mode Toggle */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={useGummy}
            onChange={(e) => setUseGummy(e.target.checked)}
            className="rounded"
          />
          使用 Gummy API（实验性）
        </label>
      </div>

      {/* Quota Warning Banner */}
      {showQuotaWarning && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            今日免费翻译次数已用完（{remaining ?? 0} 次剩余）
          </p>
          <button
            onClick={() => setShowQuotaWarning(false)}
            className="mt-2 text-xs text-yellow-600 hover:text-yellow-800"
          >
            知道了
          </button>
        </div>
      )}

      {/* Language Selector */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value as LanguageCode)}
          disabled={isLoading}
          className="px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-heading)] disabled:opacity-50"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>

        <span className="text-[var(--color-text)]">→</span>

        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
          disabled={isLoading}
          className="px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-heading)] disabled:opacity-50"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Recording Button */}
      <div className="flex flex-col items-center">
        <button
          onClick={handleRecording}
          disabled={isLoading || showQuotaWarning || (!useGummy && !isSupported)}
          className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl transition-all ${
            isRecording
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? '⏳' : isRecording ? '⏹' : '🎤'}
        </button>
        <p className="mt-4 text-sm text-[var(--color-text)]">
          {isLoading
            ? '翻译中...'
            : isRecording
              ? `录音中 ${duration.toFixed(1)}s - 点击结束`
              : '点击开始录音'}
        </p>
        <p className="mt-2 text-xs text-[var(--color-text)]">
          剩余 {remaining ?? '--'} 次翻译
        </p>
        {!useGummy && !isSupported && (
          <p className="mt-2 text-xs text-red-500">
            浏览器不支持语音识别，请使用Chrome或Edge
          </p>
        )}
      </div>

      {/* Result Display */}
      {showResult && (originalText || translatedText) && (
        <div className="mt-8 p-4 bg-[var(--color-primary-bg)] rounded-lg">
          {originalText && (
            <div className="mb-4">
              <p className="text-xs text-[var(--color-text)] mb-1">
                <span className="font-medium">原文:</span> {SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang)?.name}
              </p>
              <p className="text-lg text-[var(--color-text-heading)]">{originalText}</p>
            </div>
          )}
          {translatedText && (
            <div>
              <p className="text-xs text-[var(--color-text)] mb-1">
                <span className="font-medium">翻译:</span> {SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name}
              </p>
              <p className="text-2xl font-bold text-[var(--color-text-heading)]">{translatedText}</p>
              <button
                onClick={() => speakText(translatedText, targetLang)}
                className="mt-2 px-3 py-1 text-xs bg-[var(--color-primary)] text-white rounded-full hover:bg-[var(--color-primary)]/90"
              >
                🔊 播放翻译
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recording Error */}
      {(error || recordingError) && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error || recordingError}</p>
        </div>
      )}
    </div>
  )
}
