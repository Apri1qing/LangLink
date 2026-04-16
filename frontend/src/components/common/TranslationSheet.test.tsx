import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TranslationSheet } from './TranslationSheet'

describe('TranslationSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('should show auto close hint', () => {
    render(
      <TranslationSheet
        originalText="你好"
        translatedText="こんにちは"
        sourceLangName="中文"
        targetLangName="日本語"
        targetLang="ja"
        onClose={vi.fn()}
        autoCloseMs={3000}
      />
    )
    expect(screen.getByText('3秒后自动关闭')).toBeTruthy()
  })

  it('should call onClose after autoCloseMs', async () => {
    const onClose = vi.fn()
    render(
      <TranslationSheet
        originalText="你好"
        translatedText="こんにちは"
        sourceLangName="中文"
        targetLangName="日本語"
        targetLang="ja"
        onClose={onClose}
        autoCloseMs={3000}
      />
    )

    vi.advanceTimersByTime(3000)
    expect(onClose).toHaveBeenCalled()
  })

  it('should clear timeout on unmount', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <TranslationSheet
        originalText="你好"
        translatedText="こんにちは"
        sourceLangName="中文"
        targetLangName="日本語"
        targetLang="ja"
        onClose={onClose}
        autoCloseMs={3000}
      />
    )

    unmount()
    vi.advanceTimersByTime(3000)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('should not call onClose before timeout', () => {
    const onClose = vi.fn()
    render(
      <TranslationSheet
        originalText="你好"
        translatedText="こんにちは"
        sourceLangName="中文"
        targetLangName="日本語"
        targetLang="ja"
        onClose={onClose}
        autoCloseMs={3000}
      />
    )

    vi.advanceTimersByTime(2000) // only 2 seconds
    expect(onClose).not.toHaveBeenCalled()
  })
})
