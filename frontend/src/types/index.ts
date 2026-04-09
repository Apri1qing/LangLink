// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'en', name: 'English' },
  { code: 'ko', name: '한국어' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'tl', name: 'Filipino' },
] as const

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code']

// Translation types
export interface VoiceTranslateRequest {
  audio: string // base64 encoded audio
  sourceLang: LanguageCode
  targetLang: LanguageCode
  format: string // audio/webm, audio/mp3, etc.
}

export interface VoiceTranslateResponse {
  originalText: string
  translatedText: string
  audioUrl: string
}

export interface ImageTranslateRequest {
  image: File
  sourceLang?: LanguageCode | 'auto'
  targetLang: LanguageCode
}

export interface ImageTranslateResponse {
  originalText: string
  translatedText: string
  translatedImageUrl: string
}

// Phrase types
export interface Phrase {
  id: number
  user_id?: string
  text: string
  translation?: string
  source_lang: LanguageCode
  target_lang: LanguageCode
  audio_url?: string
  usage_count: number
  created_at: string
  updated_at: string
}

export interface PhraseCreateRequest {
  text: string
  translation?: string
  source_lang: LanguageCode
  target_lang: LanguageCode
}

export interface PhraseUpdateRequest {
  text?: string
  translation?: string
  source_lang?: LanguageCode
  target_lang?: LanguageCode
}

// User quota types
export interface UserQuota {
  user_id: string
  plan: 'free' | 'pro'
  daily_limit: number
  daily_used: number
  last_reset_date: string
}

// API response types
export interface ApiResponse<T> {
  code: number
  message?: string
  data?: T
  error?: string
}

// Audio recording types
export interface RecordingState {
  isRecording: boolean
  duration: number
  audioBlob?: Blob
}

// Supported audio formats
export const AUDIO_FORMATS = [
  'audio/webm',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
] as const

export type AudioFormat = typeof AUDIO_FORMATS[number]
