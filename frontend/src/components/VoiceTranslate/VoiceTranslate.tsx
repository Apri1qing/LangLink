import { useState, useEffect, useCallback } from 'react'
import { useVoice, blobToBase64, playAudio } from '../../hooks/useVoice'
import { checkQuota } from '../../services/quota'
import { voiceTranslate } from '../../services/translation'
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

  const { isRecording, duration, startRecording, stopRecording, error: recordingError } = useVoice({
    onRecordingComplete: handleRecordingComplete,
    onError: (err) => setError(err.message),
  })

  // Check quota on mount
  useEffect(() => {
    checkQuota().then(({ allowed, remaining: rem }) => {
      setRemaining(rem)
      if (!allowed) {
        setShowQuotaWarning(true)
      }
    })
  }, [])

  async function handleRecordingComplete(blob: Blob, recordedDuration: number) {
    console.log(`Recording complete: ${recordedDuration}s`)

    setIsLoading(true)
    setError('')

    try {
      // Convert to base64
      const audioBase64 = await blobToBase64(blob)

      // Call translation API
      const result = await voiceTranslate(audioBase64, sourceLang, targetLang, 'audio/webm')

      setOriginalText(result.originalText || '')
      setTranslatedText(result.translatedText || '')
      setShowResult(true)

      // Auto-play translated audio
      if (result.audioUrl) {
        playAudio(result.audioUrl)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecording = useCallback(async () => {
    if (showQuotaWarning) {
      setError('今日翻译次数已用完')
      return
    }

    if (isRecording) {
      await stopRecording()
    } else {
      setError('')
      setShowResult(false)
      await startRecording()
    }
  }, [isRecording, showQuotaWarning, startRecording, stopRecording])

  return (
    <div className="max-w-md mx-auto">
      {/* Quota Warning Banner */}
      {showQuotaWarning && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            ⚠️ 今日免费翻译次数已用完（{remaining ?? 0} 次剩余）
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
          disabled={isLoading || showQuotaWarning}
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
