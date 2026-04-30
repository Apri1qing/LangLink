import type { LanguageCode } from '../types'

/**
 * 用户语言对：A = 母语（native），B = 外语（foreign）。
 * 语音翻译方向由用户按哪个 pill 决定，不再自动推断。
 */
export interface LanguagePair {
  A: LanguageCode
  B: LanguageCode
}
