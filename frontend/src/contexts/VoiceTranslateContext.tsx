import { type ReactNode } from 'react'
import { useVoiceTranslate } from '../hooks/useVoiceTranslate'
import { VoiceTranslateContext } from './VoiceTranslateContextValue'

export function VoiceTranslateProvider({ children }: { children: ReactNode }) {
  const value = useVoiceTranslate()
  return <VoiceTranslateContext.Provider value={value}>{children}</VoiceTranslateContext.Provider>
}
