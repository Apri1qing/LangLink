import { createContext, useContext, type ReactNode } from 'react'
import { useVoiceTranslate } from '../hooks/useVoiceTranslate'

type VoiceTranslateCtx = ReturnType<typeof useVoiceTranslate>

const VoiceTranslateContext = createContext<VoiceTranslateCtx | null>(null)

export function VoiceTranslateProvider({ children }: { children: ReactNode }) {
  const value = useVoiceTranslate()
  return <VoiceTranslateContext.Provider value={value}>{children}</VoiceTranslateContext.Provider>
}

export function useVoiceTranslateContext(): VoiceTranslateCtx {
  const ctx = useContext(VoiceTranslateContext)
  if (!ctx) {
    throw new Error('useVoiceTranslateContext must be used within VoiceTranslateProvider')
  }
  return ctx
}
