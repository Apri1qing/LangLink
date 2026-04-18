import { create } from 'zustand'
import { type LanguageCode } from '../types'

export type AppPageState = 'home' | 'recording' | 'result' | 'menu' | 'voiceMode'
export type DisplayMode = 'photo' | 'voice'
export type TranslationType = 'voice' | 'photo' | 'phrase'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  originalText: string
  translatedText: string
  timestamp: number
}

export interface AppState {
  // Page state
  currentPage: AppPageState
  displayMode: DisplayMode

  // Language
  sourceLang: LanguageCode
  targetLang: LanguageCode

  // Translation result
  originalText: string
  translatedText: string
  translationType: TranslationType

  // Voice Mode
  messages: ConversationMessage[]

  // Image/Photo state
  capturedImage: string | null  // base64 data URL

  // Actions
  setPage: (page: AppPageState) => void
  setDisplayMode: (mode: DisplayMode) => void
  setSourceLang: (lang: LanguageCode) => void
  setTargetLang: (lang: LanguageCode) => void
  setTranslationResult: (original: string, translated: string, type?: TranslationType) => void
  clearTranslationResult: () => void
  addMessage: (msg: Omit<ConversationMessage, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  switchLanguage: () => void
  setCapturedImage: (image: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  currentPage: 'home',
  displayMode: 'photo',
  sourceLang: 'zh',
  targetLang: 'ja',
  originalText: '',
  translatedText: '',
  translationType: 'voice',
  messages: [],
  capturedImage: null,

  // Actions
  setPage: (page) => set({ currentPage: page }),

  setDisplayMode: (mode) => set({ displayMode: mode }),

  setSourceLang: (lang) => set({ sourceLang: lang }),

  setTargetLang: (lang) => set({ targetLang: lang }),

  setTranslationResult: (original, translated, type = 'voice') =>
    set({
      originalText: original,
      translatedText: translated,
      translationType: type,
      currentPage: 'result',
    }),

  clearTranslationResult: () =>
    set({
      originalText: '',
      translatedText: '',
      translationType: 'voice',
      currentPage: 'home',
    }),

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      ],
    })),

  clearMessages: () => set({ messages: [] }),

  switchLanguage: () =>
    set((state) => ({
      sourceLang: state.targetLang,
      targetLang: state.sourceLang,
    })),

  setCapturedImage: (image) => set({ capturedImage: image }),
}))
