import { describe, it, expectTypeOf } from 'vitest'
import type { LanguagePair } from './languageDirection'

describe('LanguagePair', () => {
  it('has A and B language codes', () => {
    expectTypeOf<LanguagePair>().toHaveProperty('A')
    expectTypeOf<LanguagePair>().toHaveProperty('B')
  })
})
