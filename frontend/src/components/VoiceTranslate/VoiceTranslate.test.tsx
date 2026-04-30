import { afterEach, describe, expect, it, vi } from 'vitest'
/// <reference types="vitest/globals" />
import { cleanup, render, screen } from '@testing-library/react'

const mockCheckQuota = vi.fn()
const mockIsSpeechRecognitionSupported = vi.fn()

vi.mock('../../services/quota', () => ({
  checkQuota: (...args: unknown[]) => mockCheckQuota(...args),
}))

vi.mock('../../hooks/useVoice', () => ({
  useVoice: () => ({
    isRecording: false,
    duration: 0,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    audioUrl: null,
    error: null,
  }),
  isSpeechRecognitionSupported: (...args: unknown[]) => mockIsSpeechRecognitionSupported(...args),
  recognizeWithBrowserSpeech: vi.fn(),
  convertToPCM: vi.fn(),
  uint8ArrayToBase64: vi.fn(),
}))

vi.mock('../../services/translation', () => ({
  translateText: vi.fn(),
  voiceTranslate: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('VoiceTranslate', () => {
  it('keeps the record button enabled in gummy mode when browser speech recognition is unsupported', async () => {
    mockCheckQuota.mockResolvedValue({ allowed: true, remaining: 5 })
    mockIsSpeechRecognitionSupported.mockReturnValue(false)

    const { default: VoiceTranslate } = await import('./VoiceTranslate')

    render(<VoiceTranslate />)

    const gummyToggle = screen.getByRole('checkbox')
    const recordButton = screen.getByRole('button', { name: '🎤' })

    expect((gummyToggle as HTMLInputElement).checked).toBe(true)
    expect((recordButton as HTMLButtonElement).disabled).toBe(false)
  })
})
