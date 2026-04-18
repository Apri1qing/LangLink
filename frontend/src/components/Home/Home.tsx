import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useVoiceTranslate } from '../../hooks/useVoiceTranslate'
import { imageTranslate } from '../../services/translation'
import { VoiceBar } from '../common/VoiceBar'
import { Viewfinder } from '../common/Viewfinder'
import { ModeSwitcher } from '../common/ModeSwitcher'
import { PhrasesWrap } from '../common/PhrasesWrap'
import { CameraCapture } from '../common/CameraCapture'
import { getPhrases } from '../../services/phrases'
import type { Phrase } from '../../types'

interface HomeProps {
  onManagePhrases?: () => void
}

export function Home({ onManagePhrases }: HomeProps) {
  const { displayMode, sourceLang, targetLang, setTranslationResult } = useAppStore()
  const { isRecording, startRecording, stopRecording } = useVoiceTranslate()
  const [showCamera, setShowCamera] = useState(false)
  const [phrases, setPhrases] = useState<Phrase[]>([])

  useEffect(() => {
    setPhrases(getPhrases())
  }, [])

  const handleTakePhoto = () => {
    setShowCamera(true)
  }

  const handleCloseCamera = () => {
    setShowCamera(false)
  }

  const handleCapturePhoto = async (imageData: string) => {
    setShowCamera(false)
    try {
      const result = await imageTranslate(imageData, sourceLang, targetLang)
      setTranslationResult(result.originalText, result.translatedText, 'photo')
    } catch (err) {
      console.error('Image translate error:', err)
    }
  }

  const handlePressStart = useCallback(() => {
    startRecording()
  }, [startRecording])

  const handlePressEnd = useCallback(() => {
    stopRecording()
  }, [stopRecording])

  const handlePhraseClick = useCallback((phrase: { text: string; translation?: string }) => {
    if (phrase.translation) {
      setTranslationResult(phrase.text, phrase.translation, 'phrase')
    }
  }, [setTranslationResult])

  return (
    <div className="flex flex-col min-h-full bg-[#F2EDE8]">
      {/* Voice Bar */}
      <VoiceBar />

      {/* Main Content Area */}
      <div className="flex-1 px-4 py-4">
        {showCamera ? (
          <CameraCapture onCapture={handleCapturePhoto} onClose={handleCloseCamera} />
        ) : displayMode === 'photo' ? (
          /* Photo Mode - Viewfinder */
          <Viewfinder onClick={handleTakePhoto} />
        ) : (
          /* Voice Mode - Long Press Button */
          <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
            <button
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={handlePressStart}
              onTouchEnd={handlePressEnd}
              className={`w-32 h-32 rounded-full text-4xl flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-red-500 scale-95'
                  : 'bg-[#D94F00] active:scale-95'
              }`}
            >
              {isRecording ? '⏹' : '🎤'}
            </button>
            <p className="mt-4 text-sm text-[#6B6B6B]">
              {isRecording ? '录音中...' : '按住说话'}
            </p>
          </div>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="px-4 py-3">
        <ModeSwitcher />
      </div>

      {/* Phrases */}
      <div className="px-4 pb-6">
        <PhrasesWrap phrases={phrases} onManageClick={onManagePhrases} onPhraseClick={handlePhraseClick} />
      </div>
    </div>
  )
}
