// Test setup file
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { afterEach as cleanupHooks } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Supabase client
vi.mock('./services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
  isSupabaseConfigured: false,
}))
