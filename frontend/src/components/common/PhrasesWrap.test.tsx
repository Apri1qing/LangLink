import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhrasesWrap } from './PhrasesWrap'
import type { Phrase } from '../../types'

vi.mock('../../hooks/useVoice', () => ({
  speakText: vi.fn(),
  useVoice: vi.fn(() => ({ isRecording: false, startRecording: vi.fn(), stopRecording: vi.fn() })),
}))

const ts = new Date().toISOString()

function makePhrase(id: number, text: string): Phrase {
  return {
    id,
    text,
    source_lang: 'zh',
    translations: {},
    usage_count: 0,
    created_at: ts,
    updated_at: ts,
  }
}

const PHRASES: Phrase[] = [
  makePhrase(1, '多少钱'),
  makePhrase(2, '厕所在哪'),
  makePhrase(3, '谢谢'),
]

describe('PhrasesWrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders at most 10 phrases even if more are supplied', () => {
    const many = Array.from({ length: 15 }, (_, i) => makePhrase(i + 1, `短语${i + 1}`))
    render(<PhrasesWrap phrases={many} />)
    expect(screen.getByText('短语1')).toBeTruthy()
    expect(screen.getByText('短语10')).toBeTruthy()
    expect(screen.queryByText('短语11')).toBeNull()
  })

  it('calls onPhraseClick when a phrase is clicked', () => {
    const onPhraseClick = vi.fn()
    render(<PhrasesWrap phrases={PHRASES} onPhraseClick={onPhraseClick} />)
    fireEvent.click(screen.getByText('多少钱'))
    expect(onPhraseClick).toHaveBeenCalledWith(PHRASES[0])
  })

  it('renders nothing when phrases list is empty', () => {
    const { container } = render(<PhrasesWrap phrases={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('does not call speakText directly on phrase click', async () => {
    const { speakText } = await import('../../hooks/useVoice')
    render(<PhrasesWrap phrases={PHRASES} onPhraseClick={vi.fn()} />)
    fireEvent.click(screen.getByText('多少钱'))
    expect(speakText).not.toHaveBeenCalled()
  })
})
