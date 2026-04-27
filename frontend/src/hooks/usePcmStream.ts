/**
 * 麦克风 → 16kHz mono s16le PCM 块（用于 Gummy 流式上传）
 */

export function createPcmReadableStream(): {
  stream: ReadableStream<Uint8Array>
  enqueue: (chunk: Uint8Array) => void
  close: () => void
} {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    stream,
    enqueue(chunk: Uint8Array) {
      if (chunk.length > 0) controller?.enqueue(chunk)
    },
    close() {
      try {
        controller?.close()
      } catch {
        /* noop */
      }
      controller = null
    },
  }
}

/**
 * ScriptProcessor 拉取 PCM；需接 Gain(0) 到 destination 才会在部分浏览器上触发回调。
 */
export async function startPcmFromMicrophone(
  onPcm: (pcm: Uint8Array) => void,
  onError: (e: Error) => void
): Promise<{ stop: () => Promise<void>; ok: boolean }> {
  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let processor: ScriptProcessorNode | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let mute: GainNode | null = null

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  } catch (e) {
    onError(e instanceof Error ? e : new Error('getUserMedia failed'))
    return { stop: async () => {}, ok: false }
  }

  try {
    audioContext = new AudioContext({ sampleRate: 16000 })
  } catch {
    try {
      audioContext = new AudioContext()
    } catch (e) {
      mediaStream.getTracks().forEach((t) => t.stop())
      onError(e instanceof Error ? e : new Error('AudioContext failed'))
      return { stop: async () => {}, ok: false }
    }
  }

  const ctx = audioContext
  const inRate = ctx.sampleRate
  const outRate = 16000
  const ratio = outRate / inRate

  sourceNode = ctx.createMediaStreamSource(mediaStream)
  const bufferSize = 2048
  processor = ctx.createScriptProcessor(bufferSize, 1, 1)

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0)
    let samples = input
    if (Math.abs(inRate - outRate) > 1) {
      const outLen = Math.max(1, Math.floor(input.length * ratio))
      const resampled = new Float32Array(outLen)
      for (let i = 0; i < outLen; i++) {
        const srcIdx = Math.min(input.length - 1, Math.floor(i / ratio))
        resampled[i] = input[srcIdx] ?? 0
      }
      samples = resampled
    }
    const int16 = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    onPcm(new Uint8Array(int16.buffer))
  }

  mute = ctx.createGain()
  mute.gain.value = 0
  sourceNode.connect(processor)
  processor.connect(mute)
  mute.connect(ctx.destination)

  return {
    ok: true,
    stop: async () => {
      try {
        processor?.disconnect()
        sourceNode?.disconnect()
        mute?.disconnect()
      } catch {
        /* noop */
      }
      mediaStream?.getTracks().forEach((t) => t.stop())
      try {
        await ctx.close()
      } catch {
        /* noop */
      }
      processor = null
      sourceNode = null
      mute = null
      audioContext = null
      mediaStream = null
    },
  }
}
