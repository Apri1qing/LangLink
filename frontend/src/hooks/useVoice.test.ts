import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock FileReader
const mockFileReaderResult = 'data:audio/webm;base64,dGVzdA=='

// Store onloadend callback for later invocation
function createMockFileReader() {
  let onloadendHandler: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null

  return {
    get onloadend() {
      return onloadendHandler
    },
    set onloadend(handler) {
      onloadendHandler = handler
    },
    result: mockFileReaderResult,
    readAsDataURL: (_blob: Blob) => {
      // Call onloadend after a tick to simulate async FileReader behavior
      setTimeout(() => {
        if (onloadendHandler) {
          const event = { target: { result: mockFileReaderResult } } as ProgressEvent<FileReader>
          onloadendHandler.call({} as FileReader, event)
        }
      }, 0)
    },
    onerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

vi.stubGlobal('FileReader', createMockFileReader as unknown as typeof FileReader)

// Mock URL
const mockUrls = new Map<string, string>()
vi.stubGlobal('URL', {
  createObjectURL: (blob: Blob) => {
    const url = `blob:${blob.size}`
    mockUrls.set(url, url)
    return url
  },
  revokeObjectURL: (url: string) => mockUrls.delete(url),
})

// Mock mediaDevices
const mockStop = vi.fn()
vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: mockStop }],
    }),
  },
})

describe('useVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUrls.clear()
  })

  describe('blobToBase64', () => {
    it('should convert blob to base64 string', async () => {
      const { blobToBase64 } = await import('./useVoice')
      const blob = new Blob(['test content'], { type: 'audio/webm' })
      const result = await blobToBase64(blob)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('playAudio', () => {
    it('should be a function', async () => {
      const { playAudio } = await import('./useVoice')
      expect(typeof playAudio).toBe('function')
    })
  })
})
