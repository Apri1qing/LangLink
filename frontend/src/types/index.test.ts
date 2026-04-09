import { describe, it, expect } from 'vitest'
import { SUPPORTED_LANGUAGES, AUDIO_FORMATS } from '../types'

describe('SUPPORTED_LANGUAGES', () => {
  it('should contain 17 languages', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(17)
  })

  it('should include Chinese and Japanese', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code)
    expect(codes).toContain('zh')
    expect(codes).toContain('ja')
  })

  it('should have valid code and name for each language', () => {
    SUPPORTED_LANGUAGES.forEach((lang) => {
      expect(lang.code).toBeTruthy()
      expect(lang.code.length).toBeGreaterThan(0)
      expect(lang.name).toBeTruthy()
      expect(lang.name.length).toBeGreaterThan(0)
    })
  })

  it('should have unique language codes', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code)
    const uniqueCodes = new Set(codes)
    expect(uniqueCodes.size).toBe(codes.length)
  })

  it('should include common languages for travel', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code)
    // Chinese, Japanese, English, Korean, Thai
    expect(codes).toContain('zh')
    expect(codes).toContain('ja')
    expect(codes).toContain('en')
    expect(codes).toContain('ko')
    expect(codes).toContain('th')
  })
})

describe('AUDIO_FORMATS', () => {
  it('should support webm format', () => {
    expect(AUDIO_FORMATS).toContain('audio/webm')
  })

  it('should support common audio formats', () => {
    expect(AUDIO_FORMATS).toContain('audio/webm')
    expect(AUDIO_FORMATS).toContain('audio/mp3')
    expect(AUDIO_FORMATS).toContain('audio/wav')
    expect(AUDIO_FORMATS).toContain('audio/ogg')
  })
})
