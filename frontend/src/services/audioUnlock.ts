// iOS Safari / PWA standalone 音频解锁服务
// 在第一次用户手势时创建并恢复 AudioContext，之后通过它播放音频可绕过自动播放策略

type AudioCtxCtor = typeof AudioContext

function getAudioCtxCtor(): AudioCtxCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    AudioContext?: AudioCtxCtor
    webkitAudioContext?: AudioCtxCtor
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

let _ctx: AudioContext | null = null

/** 必须在用户手势同步上下文中调用一次，后续 play 才能绕过 iOS 自动播放限制。 */
export function unlockAudioContext(): AudioContext | null {
  const Ctor = getAudioCtxCtor()
  if (!Ctor) return null
  if (!_ctx) {
    try {
      _ctx = new Ctor()
    } catch (e) {
      console.warn('[AudioUnlock] new AudioContext failed:', e)
      return null
    }
  }
  if (_ctx.state === 'suspended') {
    void _ctx.resume().catch((e) => {
      console.warn('[AudioUnlock] resume failed:', e)
    })
  }
  return _ctx
}

export function getAudioContext(): AudioContext | null {
  return _ctx
}

/**
 * 通过已解锁的 AudioContext 播放音频 URL（绕过 iOS PWA 自动播放限制）。
 * 调用前应已在用户手势中调用过 unlockAudioContext()；若尚未解锁则尝试懒解锁。
 */
export async function playAudioUrl(url: string): Promise<void> {
  const ctx = _ctx ?? unlockAudioContext()
  if (!ctx) {
    // 没有 AudioContext 支持，回退到 HTMLAudioElement
    const audio = new Audio(url)
    audio.setAttribute('playsInline', 'true')
    await audio.play()
    return
  }
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch (e) {
      console.warn('[AudioUnlock] resume in play failed:', e)
    }
  }
  const resp = await fetch(url)
  const buffer = await resp.arrayBuffer()
  const decoded = await ctx.decodeAudioData(buffer.slice(0))
  const source = ctx.createBufferSource()
  source.buffer = decoded
  source.connect(ctx.destination)
  source.start(0)
}
