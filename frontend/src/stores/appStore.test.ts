import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      originalText: '',
      translatedText: '',
      currentPage: 'home',
      translationError: null,
      lastSourceLang: null,
      lastTargetLang: null,
      voiceCapturing: false,
      voiceStreaming: false,
      voiceTextComplete: false,
      voiceTtsPending: false,
      voiceTtsReady: false,
    })
  })

  it('should set translation result without changing currentPage', () => {
    useAppStore.getState().setTranslationResult('你好', 'こんにちは', 'voice', null, 'zh', 'ja')
    const state = useAppStore.getState()
    expect(state.originalText).toBe('你好')
    expect(state.translatedText).toBe('こんにちは')
    expect(state.currentPage).toBe('home') // v1.4: 不再跳转
    expect(state.lastSourceLang).toBe('zh')
    expect(state.lastTargetLang).toBe('ja')
  })

  it('should record translation type in store', () => {
    useAppStore.getState().setTranslationResult('你好', 'こんにちは', 'phrase')
    const state = useAppStore.getState()
    expect(state.translationType).toBe('phrase')
  })

  it('should clear translation result and reset direction', () => {
    useAppStore.getState().setTranslationResult('你好', 'こんにちは', 'voice', null, 'zh', 'ja')
    useAppStore.getState().clearTranslationResult()
    const state = useAppStore.getState()
    expect(state.originalText).toBe('')
    expect(state.translatedText).toBe('')
    expect(state.lastSourceLang).toBeNull()
    expect(state.lastTargetLang).toBeNull()
  })

  it('tracks capture, text completion, pending tts, and later tts readiness separately', () => {
    const store = useAppStore.getState()

    store.setVoiceCaptureActive(true, 'zh', 'ja')
    expect(useAppStore.getState()).toMatchObject({
      voiceCapturing: true,
      voiceStreaming: true,
      voiceTextComplete: false,
      voiceTtsPending: false,
      voiceTtsReady: false,
      isTranslating: true,
      lastSourceLang: 'zh',
      lastTargetLang: 'ja',
    })

    store.setVoiceTextComplete('你好', 'こんにちは', 'zh', 'ja')
    expect(useAppStore.getState()).toMatchObject({
      originalText: '你好',
      translatedText: 'こんにちは',
      voiceCapturing: false,
      voiceStreaming: false,
      voiceTextComplete: true,
      voiceTtsPending: true,
      voiceTtsReady: false,
      translationAudioUrl: null,
      isTranslating: true,
    })

    store.setVoiceTtsReady('https://audio.example/hello.mp3')
    expect(useAppStore.getState()).toMatchObject({
      voiceTextComplete: true,
      voiceTtsPending: false,
      voiceTtsReady: true,
      translationAudioUrl: 'https://audio.example/hello.mp3',
      isTranslating: false,
    })
  })
})
