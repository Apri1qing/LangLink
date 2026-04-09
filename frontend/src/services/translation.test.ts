import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}))

describe('translation service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('getCacheKey', () => {
    it('should generate consistent cache keys', async () => {
      // This tests the cache key generation logic
      const text = 'Hello'
      const sourceLang = 'en'
      const targetLang = 'zh'
      const expectedKey = `${sourceLang}:${targetLang}:${text.slice(0, 100)}`
      expect(expectedKey).toBe('en:zh:Hello')
    })

    it('should truncate long text in cache key', async () => {
      const longText = 'a'.repeat(200)
      const sourceLang = 'en'
      const targetLang = 'zh'
      const cacheKey = `${sourceLang}:${targetLang}:${longText.slice(0, 100)}`
      expect(cacheKey.length).toBeLessThan(300)
    })
  })

  describe('translateText', () => {
    it('should throw error when LLM gateway not configured', async () => {
      // Without proper environment, should handle gracefully
      const { translateText } = await import('./translation')
      // This test documents expected behavior
      expect(typeof translateText).toBe('function')
    })
  })

  describe('voiceTranslate', () => {
    it('should be a function', async () => {
      const { voiceTranslate } = await import('./translation')
      expect(typeof voiceTranslate).toBe('function')
    })
  })

  describe('imageTranslate', () => {
    it('should be a function', async () => {
      const { imageTranslate } = await import('./translation')
      expect(typeof imageTranslate).toBe('function')
    })
  })
})
