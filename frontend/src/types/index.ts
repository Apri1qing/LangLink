// Supported languages (must match gummy ASR and qwen3-tts-flash supported languages)
export const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ru', name: 'Русский' },
  { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Español' },
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
  audioUrl?: string
  /** Non-fatal TTS failure after text translation completed. UI may fallback to browser speech. */
  ttsError?: string
}

export interface ImageTranslateRequest {
  image: File
  sourceLang?: LanguageCode | 'auto'
  targetLang: LanguageCode
  nativeLang?: LanguageCode
  foreignLang?: LanguageCode
}

/** v1.4: qwen-vl-ocr advanced_recognition 返回的单条文字区域 */
export interface OcrRegion {
  originalText: string
  translatedText: string
  /** 原图坐标（像素）。8 个值：[x1,y1, x2,y2, x3,y3, x4,y4]（顺序：左上→右上→右下→左下） */
  location: number[]
}

export interface ImageTranslateResponse {
  originalText: string
  translatedText: string
  translatedImageUrl?: string
  /** v1.4: 每个识别区域 + 译文 + 位置；前端据此渲染叠加层 */
  regions?: OcrRegion[]
}

// Phrase types
export interface PhraseTranslation {
  translated: string
  audioUrl?: string
}

export interface Phrase {
  id: number
  user_id?: string
  text: string
  source_lang: LanguageCode
  /** Lazy-cached translations keyed by target language code */
  translations: Record<string, PhraseTranslation>
  usage_count: number
  created_at: string
  updated_at: string
}

export interface PhraseCreateRequest {
  text: string
  source_lang: LanguageCode
}

export interface PhraseUpdateRequest {
  text?: string
  source_lang?: LanguageCode
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
