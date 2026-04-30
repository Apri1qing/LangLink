import { useContext } from 'react'
import { VoiceTranslateContext } from './VoiceTranslateContextValue'

export function useVoiceTranslateContext() {
  const ctx = useContext(VoiceTranslateContext)
  if (!ctx) {
    throw new Error('useVoiceTranslateContext must be used within VoiceTranslateProvider')
  }
  return ctx
}
