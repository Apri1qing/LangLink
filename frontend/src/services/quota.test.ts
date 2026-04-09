import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock environment
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
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  },
}))

describe('quota service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkQuota', () => {
    it('should be a function', async () => {
      const { checkQuota } = await import('./quota')
      expect(typeof checkQuota).toBe('function')
    })

    it('should return object with allowed and remaining properties', async () => {
      const { checkQuota } = await import('./quota')
      const result = await checkQuota()
      expect(result).toHaveProperty('allowed')
      expect(result).toHaveProperty('remaining')
      expect(typeof result.allowed).toBe('boolean')
      expect(typeof result.remaining).toBe('number')
    })
  })

  describe('getUserQuota', () => {
    it('should be a function', async () => {
      const { getUserQuota } = await import('./quota')
      expect(typeof getUserQuota).toBe('function')
    })
  })
})
