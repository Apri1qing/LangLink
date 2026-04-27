/**
 * Centralized DashScope model configuration for all Edge Functions.
 * Change models here — all functions pick up the change on next deploy.
 */

export const DASHSCOPE = {
  /** Text translation (llm-gateway + image-translate batch translate) */
  text: {
    endpoint:
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
  },

  /** Image OCR with bounding boxes */
  ocr: {
    endpoint:
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    model: 'qwen-vl-ocr-latest',
    task: 'advanced_recognition',
  },

  /** Real-time speech ASR + translation (WebSocket) */
  asr: {
    endpoint: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference',
    model: 'gummy-realtime-v1',
  },

  /** TTS — synthesize translated text to audio */
  tts: {
    endpoint:
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    model: 'qwen3-tts-flash',
    voice: 'Cherry', // multilingual voice
  },
} as const

export const DASHSCOPE_API_KEY = Deno.env.get('DASHSCOPE_API_KEY')!

/** Language name map shared across functions */
export const LANG_MAP: Record<string, string> = {
  zh: 'Chinese',
  ja: 'Japanese',
  en: 'English',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Filipino',
}
