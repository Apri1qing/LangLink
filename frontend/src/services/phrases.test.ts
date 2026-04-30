import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./translation', () => ({
  translateText: vi.fn(async (t: string) => `tr:${t}`),
}))

describe('phrases service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('enforces MAX_PHRASES (10) limit on addPhrase', async () => {
    const { addPhrase, getPhrases, MAX_PHRASES } = await import('./phrases')
    expect(MAX_PHRASES).toBe(10)

    // Defaults seed ~6; fill up to 10, then assert next add throws.
    let current = getPhrases().length
    let idx = 0
    while (current < MAX_PHRASES) {
      addPhrase(`extra-${idx++}`, 'zh')
      current = getPhrases().length
    }
    expect(getPhrases().length).toBe(MAX_PHRASES)
    expect(() => addPhrase('overflow', 'zh')).toThrow(/上限/)
  })

  it('addPhrase below limit succeeds and appends', async () => {
    localStorage.setItem('traveltalk_phrases', JSON.stringify([]))
    const { addPhrase, getPhrases } = await import('./phrases')
    const initial = getPhrases().length
    addPhrase('hello', 'zh')
    expect(getPhrases().length).toBe(initial + 1)
  })
})
