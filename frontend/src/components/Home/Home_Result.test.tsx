import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Home_Result } from './Home_Result'
import { useAppStore } from '../../stores/appStore'

describe('Home_Result', () => {
  it('should render translation results', () => {
    useAppStore.setState({
      originalText: '你好',
      translatedText: 'こんにちは',
      sourceLang: 'zh',
      targetLang: 'ja',
    })

    render(<Home_Result />)

    expect(screen.getByText('你好')).toBeTruthy()
    expect(screen.getByText('こんにちは')).toBeTruthy()
  })

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn()
    useAppStore.setState({
      originalText: '你好',
      translatedText: 'こんにちは',
      sourceLang: 'zh',
      targetLang: 'ja',
    })

    render(<Home_Result onClose={onClose} />)

    // Find and click the close/back button
    const closeBtn = screen.getByRole('button', { name: '←' })
    closeBtn.click()

    expect(onClose).toHaveBeenCalled()
  })
})
