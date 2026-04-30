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
})
