import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TranslationSheet } from './TranslationSheet'
import { useAppStore } from '../../stores/appStore'

const speakTextMock = vi.fn()
const playAudioUrlMock = vi.fn()
vi.mock('../../hooks/useVoice', () => ({
  speakText: (...args: unknown[]) => speakTextMock(...args),
  useVoice: vi.fn(() => ({ isRecording: false, startRecording: vi.fn(), stopRecording: vi.fn() })),
}))
vi.mock('../../services/audioUnlock', () => ({
  playAudioUrl: (...args: unknown[]) => playAudioUrlMock(...args),
}))

describe('TranslationSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    playAudioUrlMock.mockResolvedValue(undefined)
    vi.useFakeTimers()
    useAppStore.setState({
      isTranslating: false,
      translationError: null,
      translationType: 'voice',
    })
  })

  it('should render original and translated text', () => {
    render(
      <TranslationSheet
        originalText="你好"
        translatedText="こんにちは"
        sourceLangName="中文"
        targetLangName="日本語"
        targetLang="ja"
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('你好')).toBeTruthy()
    expect(screen.getByText('こんにちは')).toBeTruthy()
  })

  it('should show loading copy when translating', () => {
    useAppStore.setState({ isTranslating: true })
    render(
      <TranslationSheet
        originalText=""
        translatedText=""
        sourceLangName="中文"
        targetLangName="日本語"
        targetLang="ja"
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText(/正在连接并识别|识别中/)).toBeTruthy()
  })

  it('auto-plays TTS exactly once after translation completes', () => {
    useAppStore.setState({ isTranslating: false, translationError: null })
    render(
      <TranslationSheet
        originalText="你好"
        translatedText="こんにちは"
        sourceLangName="中文"
        targetLangName="日本語"
        targetLang="ja"
        onClose={vi.fn()}
      />
    )
    act(() => { vi.advanceTimersByTime(300) })
    expect(speakTextMock).toHaveBeenCalledTimes(1)
    expect(speakTextMock).toHaveBeenCalledWith('こんにちは', 'ja')
  })

  it('does not auto-play while translation is in progress', () => {
    useAppStore.setState({ isTranslating: true, translationError: null })
    render(
      <TranslationSheet
        originalText="你好"
        translatedText="こんにちは"
        sourceLangName="中文"
        targetLangName="日本語"
        targetLang="ja"
        onClose={vi.fn()}
      />
    )
    act(() => { vi.advanceTimersByTime(300) })
    expect(speakTextMock).not.toHaveBeenCalled()
  })

  it('can render without a full-screen backdrop while streaming', () => {
    useAppStore.setState({ isTranslating: true, translationError: null })
    const { container } = render(
      <TranslationSheet
        originalText="你好"
        translatedText="こんにちは"
        sourceLangName="中文"
        targetLangName="日本語"
        targetLang="ja"
        isNonModal
        onClose={vi.fn()}
      />
    )
    expect(container.querySelector('.inset-0')).toBeNull()
    expect(screen.getByText('こんにちは')).toBeTruthy()
  })

  it('shows a waiting play button while translated text is ready but TTS is pending', () => {
    render(
      <TranslationSheet
        originalText="你好"
        translatedText="こんにちは"
        sourceLangName="中文"
        targetLangName="日本語"
        targetLang="ja"
        ttsStatus="pending"
        onClose={vi.fn()}
      />
    )
    const button = screen.getByRole('button', { name: '语音生成中' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.className).toContain('animate-pulse')
  })
})
