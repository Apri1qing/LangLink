import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Menu } from './Menu'

describe('Menu', () => {
  it('should display sessions list', () => {
    const sessions = [
      { id: '1', type: 'voice' as const, sourceLang: 'zh', targetLang: 'ja', lastMessage: '你好', timestamp: Date.now() },
    ]
    render(<Menu sessions={sessions} />)
    expect(screen.getByText('你好')).toBeTruthy()
  })

  it('should display empty state when no sessions', () => {
    render(<Menu sessions={[]} />)
    expect(screen.getByText('暂无历史会话')).toBeTruthy()
  })

  it('should call onSessionClick when session is clicked', () => {
    const sessions = [
      { id: '1', type: 'voice' as const, sourceLang: 'zh', targetLang: 'ja', lastMessage: '你好', timestamp: Date.now() },
    ]
    const onSessionClick = vi.fn()
    render(<Menu sessions={sessions} onSessionClick={onSessionClick} />)
    screen.getByText('你好').click()
    expect(onSessionClick).toHaveBeenCalledWith(sessions[0])
  })

  it('should call onPhraseDelete when delete is clicked', () => {
    const phrases = [{ id: 1, text: '你好', translation: 'こんにちは' }]
    const onPhraseDelete = vi.fn()
    render(<Menu phrases={phrases} onPhraseDelete={onPhraseDelete} />)
    const deleteBtn = document.querySelector('button:last-child') as HTMLButtonElement | null
    deleteBtn?.click()
    expect(onPhraseDelete).toHaveBeenCalledWith(1)
  })

  it('should call onSessionDelete when session delete is clicked', () => {
    const sessions = [
      { id: 'abc', type: 'voice' as const, sourceLang: 'zh', targetLang: 'ja', lastMessage: '你好', timestamp: Date.now() },
    ]
    const onSessionDelete = vi.fn()
    render(<Menu sessions={sessions} onSessionDelete={onSessionDelete} />)
    const deleteBtn = document.querySelectorAll('button:last-child')
    ;(deleteBtn[0] as HTMLButtonElement).click()
    expect(onSessionDelete).toHaveBeenCalledWith('abc')
  })

  it('should show add form when onAddPhrase provided', () => {
    render(<Menu onAddPhrase={vi.fn()} />)
    expect(screen.getByRole('button', { name: /添加常用语/ })).toBeTruthy()
  })
})
