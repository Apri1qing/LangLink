import { useAppStore } from '../../stores/appStore'
import { VoiceBar } from '../common/VoiceBar'
import { Viewfinder } from '../common/Viewfinder'
import { ModeSwitcher } from '../common/ModeSwitcher'
import { TranslationSheet } from '../common/TranslationSheet'
import { SUPPORTED_LANGUAGES } from '../../types'

interface Home_ResultProps {
  onClose?: () => void
}

export function Home_Result({ onClose }: Home_ResultProps) {
  const { originalText, translatedText, sourceLang, targetLang, clearTranslationResult } = useAppStore()

  const sourceLangName = SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang)?.name ?? sourceLang
  const targetLangName = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name ?? targetLang

  const handleClose = () => {
    clearTranslationResult()
    onClose?.()
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F2EDE8] relative">
      {/* Back NavBar */}
      <div className="flex items-center px-4 py-3">
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center bg-[#1A1A1A] text-white rounded-full"
        >
          ←
        </button>
      </div>

      {/* Voice Bar */}
      <VoiceBar />

      {/* Viewfinder - always visible */}
      <div className="flex-1 px-4 py-4">
        <Viewfinder hint="相机画面始终可见" />
      </div>

      {/* Mode Switcher */}
      <div className="px-4 py-3">
        <ModeSwitcher />
      </div>

      {/* Translation Sheet */}
      <TranslationSheet
        originalText={originalText}
        translatedText={translatedText}
        sourceLangName={sourceLangName}
        targetLangName={targetLangName}
        targetLang={targetLang}
        onClose={handleClose}
        autoCloseMs={3000}
      />
    </div>
  )
}
