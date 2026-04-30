import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { type LanguageCode, type OcrRegion } from '../types'
import type { LanguagePair } from '../utils/languageDirection'
import { generateUUID } from '../utils/uuid'

export type AppPageState = 'home' | 'settings' | 'history'
export type DisplayMode = 'photo' | 'voice'
export type TranslationType = 'voice' | 'photo' | 'phrase'

export interface ConversationMessage {
  id: string
  type: TranslationType
  originalText: string
  translatedText: string
  sourceLang: LanguageCode
  targetLang: LanguageCode
  audioUrl?: string | null
  imageDataUrl?: string
  timestamp: number
}

export interface AppState {
  // Page state
  currentPage: AppPageState
  displayMode: DisplayMode

  // Language (v1.3: languagePair 为主，sourceLang/targetLang 为派生状态，保持兼容)
  languagePair: LanguagePair
  sourceLang: LanguageCode
  targetLang: LanguageCode

  // Translation result
  originalText: string
  translatedText: string
  translationType: TranslationType
  /** TTS URL or data URL from voice-translate Edge Function */
  translationAudioUrl: string | null
  /** v1.4: 最近一次翻译的源/目标语言（底卡展示与 TTS 播放用） */
  lastSourceLang: LanguageCode | null
  lastTargetLang: LanguageCode | null

  /** Last voice/image translate error for UI */
  translationError: string | null
  /** Non-fatal TTS failure after voice text completed; text remains usable for browser speech fallback. */
  voiceTtsError: string | null

  // Loading state
  isTranslating: boolean
  voiceCapturing: boolean
  voiceStreaming: boolean
  voiceTextComplete: boolean
  voiceTtsPending: boolean
  voiceTtsReady: boolean

  // Voice Mode — current session's messages (render source)
  messages: ConversationMessage[]
  currentSessionId: string | null

  // Image/Photo state
  capturedImage: string | null  // base64 data URL
  /** v1.4: OCR 识别 + 翻译的文字区域（叠加层渲染依据） */
  ocrRegions: OcrRegion[]
  /** v1.4: 是否显示译文叠加层（false 显示原图） */
  showTranslatedOverlay: boolean

  // Actions
  setPage: (page: AppPageState) => void
  setDisplayMode: (mode: DisplayMode) => void
  setSourceLang: (lang: LanguageCode) => void
  setTargetLang: (lang: LanguageCode) => void
  setLanguagePair: (pair: LanguagePair) => void
  setTranslationResult: (
    original: string,
    translated: string,
    type?: TranslationType,
    audioUrl?: string | null,
    sourceLang?: LanguageCode,
    targetLang?: LanguageCode
  ) => void
  /** 流式识别中间帧：更新文案，保持 isTranslating，清空音频直至最终 setTranslationResult */
  setVoiceTranslationProgress: (
    original: string,
    translated: string,
    sourceLang?: LanguageCode,
    targetLang?: LanguageCode
  ) => void
  setVoiceCaptureActive: (
    active: boolean,
    sourceLang?: LanguageCode,
    targetLang?: LanguageCode
  ) => void
  setVoiceStreamStarted: (sourceLang?: LanguageCode, targetLang?: LanguageCode) => void
  setVoiceTextComplete: (
    original: string,
    translated: string,
    sourceLang?: LanguageCode,
    targetLang?: LanguageCode
  ) => void
  setVoiceTtsReady: (audioUrl?: string | null) => void
  setVoiceTtsError: (message: string) => void
  clearTranslationResult: () => void
  setTranslationError: (message: string | null) => void
  setIsTranslating: (value: boolean) => void
  addMessage: (msg: ConversationMessage) => void
  setMessages: (msgs: ConversationMessage[]) => void
  clearMessages: () => void
  setCurrentSessionId: (id: string | null) => void
  switchLanguage: () => void
  setCapturedImage: (image: string | null) => void
  setOcrRegions: (regions: OcrRegion[]) => void
  setShowTranslatedOverlay: (value: boolean) => void
  clearCapturedPhoto: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
  // Initial state
  currentPage: 'home',
  displayMode: 'photo',
  languagePair: { A: 'zh', B: 'ja' },
  sourceLang: 'zh',
  targetLang: 'ja',
  originalText: '',
  translatedText: '',
  translationType: 'voice',
  translationAudioUrl: null,
  lastSourceLang: null,
  lastTargetLang: null,
  translationError: null,
  voiceTtsError: null,
  isTranslating: false,
  voiceCapturing: false,
  voiceStreaming: false,
  voiceTextComplete: false,
  voiceTtsPending: false,
  voiceTtsReady: false,
  messages: [],
  currentSessionId: null,
  capturedImage: null,
  ocrRegions: [],
  showTranslatedOverlay: true,

  // Actions
  setPage: (page) => set({ currentPage: page }),

  setDisplayMode: (mode) => set({ displayMode: mode }),

  setSourceLang: (lang) =>
    set((state) => ({
      sourceLang: lang,
      languagePair: { ...state.languagePair, A: lang },
    })),

  setTargetLang: (lang) =>
    set((state) => ({
      targetLang: lang,
      languagePair: { ...state.languagePair, B: lang },
    })),

  setLanguagePair: (pair) =>
    set({
      languagePair: pair,
      sourceLang: pair.A,
      targetLang: pair.B,
    }),

  setTranslationResult: (original, translated, type = 'voice', audioUrl = null, sourceLang, targetLang) =>
    set((state) => ({
      originalText: original,
      translatedText: translated,
      translationType: type,
      translationAudioUrl: audioUrl ?? null,
      translationError: null,
      voiceTtsError: null,
      isTranslating: false,
      voiceCapturing: false,
      voiceStreaming: false,
      voiceTextComplete: true,
      voiceTtsPending: false,
      voiceTtsReady: !!audioUrl,
      lastSourceLang: sourceLang ?? state.lastSourceLang,
      lastTargetLang: targetLang ?? state.lastTargetLang,
    })),

  setVoiceTranslationProgress: (original, translated, sourceLang, targetLang) =>
    set((state) => ({
      originalText: original,
      translatedText: translated,
      translationType: 'voice',
      translationError: null,
      voiceTtsError: null,
      translationAudioUrl: null,
      isTranslating: true,
      voiceStreaming: true,
      voiceTextComplete: false,
      voiceTtsPending: false,
      voiceTtsReady: false,
      lastSourceLang: sourceLang ?? state.lastSourceLang,
      lastTargetLang: targetLang ?? state.lastTargetLang,
    })),

  setVoiceCaptureActive: (active, sourceLang, targetLang) =>
    set((state) => ({
      voiceCapturing: active,
      voiceStreaming: active ? true : state.voiceStreaming,
      voiceTextComplete: active ? false : state.voiceTextComplete,
      voiceTtsPending: active ? false : state.voiceTtsPending,
      voiceTtsReady: active ? false : state.voiceTtsReady,
      voiceTtsError: active ? null : state.voiceTtsError,
      translationType: 'voice',
      translationError: active ? null : state.translationError,
      translationAudioUrl: active ? null : state.translationAudioUrl,
      isTranslating: active ? true : state.isTranslating,
      lastSourceLang: sourceLang ?? state.lastSourceLang,
      lastTargetLang: targetLang ?? state.lastTargetLang,
    })),

  setVoiceStreamStarted: (sourceLang, targetLang) =>
    set((state) => ({
      voiceStreaming: true,
      voiceTextComplete: false,
      voiceTtsPending: false,
      voiceTtsReady: false,
      voiceTtsError: null,
      translationType: 'voice',
      translationError: null,
      translationAudioUrl: null,
      isTranslating: true,
      lastSourceLang: sourceLang ?? state.lastSourceLang,
      lastTargetLang: targetLang ?? state.lastTargetLang,
    })),

  setVoiceTextComplete: (original, translated, sourceLang, targetLang) =>
    set((state) => ({
      originalText: original,
      translatedText: translated,
      translationType: 'voice',
      translationAudioUrl: null,
      translationError: null,
      voiceTtsError: null,
      voiceCapturing: false,
      voiceStreaming: false,
      voiceTextComplete: true,
      voiceTtsPending: true,
      voiceTtsReady: false,
      isTranslating: true,
      lastSourceLang: sourceLang ?? state.lastSourceLang,
      lastTargetLang: targetLang ?? state.lastTargetLang,
    })),

  setVoiceTtsReady: (audioUrl = null) =>
    set({
      translationAudioUrl: audioUrl ?? null,
      voiceTtsError: null,
      voiceTtsPending: false,
      voiceTtsReady: true,
      isTranslating: false,
    }),

  setVoiceTtsError: (message) =>
    set({
      voiceTtsError: message,
      voiceTtsPending: false,
      voiceTtsReady: false,
      isTranslating: false,
    }),

  clearTranslationResult: () =>
    set({
      originalText: '',
      translatedText: '',
      translationType: 'voice',
      translationAudioUrl: null,
      translationError: null,
      voiceTtsError: null,
      isTranslating: false,
      voiceCapturing: false,
      voiceStreaming: false,
      voiceTextComplete: false,
      voiceTtsPending: false,
      voiceTtsReady: false,
      lastSourceLang: null,
      lastTargetLang: null,
    }),

  setTranslationError: (message) =>
    set({
      translationError: message,
      ...(message
        ? {
            isTranslating: false,
            voiceCapturing: false,
            voiceStreaming: false,
            voiceTtsPending: false,
          }
        : {}),
    }),

  setIsTranslating: (value) =>
    set({
      isTranslating: value,
      ...(value
        ? {}
        : {
            voiceCapturing: false,
            voiceStreaming: false,
            voiceTtsPending: false,
          }),
    }),

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  setMessages: (msgs) => set({ messages: msgs }),

  clearMessages: () => set({ messages: [] }),

  setCurrentSessionId: (id) => set({ currentSessionId: id }),

  switchLanguage: () =>
    set((state) => ({
      sourceLang: state.targetLang,
      targetLang: state.sourceLang,
      languagePair: { A: state.targetLang, B: state.sourceLang },
    })),

  setCapturedImage: (image) => set({ capturedImage: image }),

  setOcrRegions: (regions) => set({ ocrRegions: regions }),

  setShowTranslatedOverlay: (value) => set({ showTranslatedOverlay: value }),

  clearCapturedPhoto: () =>
    set({
      capturedImage: null,
      ocrRegions: [],
      showTranslatedOverlay: true,
    }),
    }),
    {
      name: 'traveltalk-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        languagePair: state.languagePair,
        sourceLang: state.sourceLang,
        targetLang: state.targetLang,
      }),
    },
  ),
)

/** Re-exported here to keep id generation logic uniform with session service. */
export { generateUUID }
