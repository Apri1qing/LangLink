import { createContext } from 'react'
import { useVoiceTranslate } from '../hooks/useVoiceTranslate'

export type VoiceTranslateCtx = ReturnType<typeof useVoiceTranslate>

export const VoiceTranslateContext = createContext<VoiceTranslateCtx | null>(null)
