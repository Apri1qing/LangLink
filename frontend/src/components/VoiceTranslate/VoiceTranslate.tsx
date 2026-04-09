import { useState, useEffect } from 'react'
import { checkQuota } from '../../services/quota'
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../../types'

export default function VoiceTranslate() {
  const [isRecording, setIsRecording] = useState(false)
  const [sourceLang, setSourceLang] = useState<LanguageCode>('zh')
  const [targetLang, setTargetLang] = useState<LanguageCode>('ja')
  const [originalText] = useState('')
  const [translatedText] = useState('')
  const [, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState<number | null>(null)
  const [showQuotaWarning, setShowQuotaWarning] = useState(false)

  // Check quota on mount
  useEffect(() => {
    checkQuota().then(({ allowed, remaining: rem }) => {
      setRemaining(rem)
      if (!allowed) {
        setShowQuotaWarning(true)
      }
    })
  }, [])

  const handleQuotaExceeded = () => {
    setShowQuotaWarning(true)
    setError('今日翻译次数已用完，请明天再来或升级到 Pro 版本')
  }

  // Suppress unused warning
  void handleQuotaExceeded

  const handleRecording = () => {
    if (showQuotaWarning) {
      setError('今日翻译次数已用完')
      return
    }

    if (isRecording) {
      setIsRecording(false)
      // TODO: Stop recording and process
    } else {
      setIsRecording(true)
      // TODO: Start recording
    }
  }

  // Suppress unused warnings
  void setIsLoading

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
          className="px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-heading)]"
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
          className="px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text-heading)]"
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
          disabled={showQuotaWarning}
          className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl transition-all ${
            isRecording
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>
        <p className="mt-4 text-sm text-[var(--color-text)]">
          {isRecording ? '点击结束录音' : '点击开始录音'}
        </p>
        <p className="mt-2 text-xs text-[var(--color-text)]">
          剩余 {remaining ?? '--'} 次翻译
        </p>
      </div>

      {/* Result Display */}
      {(originalText || translatedText) && (
        <div className="mt-8 p-4 bg-[var(--color-primary-bg)] rounded-lg">
          {originalText && (
            <div className="mb-4">
              <p className="text-xs text-[var(--color-text)] mb-1">原文</p>
              <p className="text-lg text-[var(--color-text-heading)]">{originalText}</p>
            </div>
          )}
          {translatedText && (
            <div>
              <p className="text-xs text-[var(--color-text)] mb-1">翻译</p>
              <p className="text-2xl font-bold text-[var(--color-text-heading)]">{translatedText}</p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
