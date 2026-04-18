import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      originalText: '',
      translatedText: '',
      currentPage: 'home',
    })
  })

  it('should set translation result and page to result', () => {
    useAppStore.getState().setTranslationResult('你好', 'こんにちは')
    const state = useAppStore.getState()
    expect(state.originalText).toBe('你好')
    expect(state.translatedText).toBe('こんにちは')
    expect(state.currentPage).toBe('result')
  })

  it('should record translation type in store', () => {
    // setTranslationResult should accept and store type
    useAppStore.getState().setTranslationResult('你好', 'こんにちは', 'phrase')
    const state = useAppStore.getState()
    // This will fail until we add translationType to the store
    expect((state as any).translationType).toBe('phrase')
  })

  it('should clear translation result and return to home', () => {
    useAppStore.getState().setTranslationResult('你好', 'こんにちは')
    useAppStore.getState().clearTranslationResult()
    const state = useAppStore.getState()
    expect(state.originalText).toBe('')
    expect(state.translatedText).toBe('')
    expect(state.currentPage).toBe('home')
  })
})
