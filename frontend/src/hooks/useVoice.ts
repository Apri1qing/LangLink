// Voice recording hook
import { useState, useRef, useCallback } from 'react'

export interface UseVoiceOptions {
  onRecordingComplete?: (blob: Blob, duration: number) => void
  onError?: (error: Error) => void
}

export interface UseVoiceReturn {
  isRecording: boolean
  duration: number
  startRecording: () => Promise<void>
  stopRecording: () => Promise<{ blob: Blob; duration: number } | null>
  audioUrl: string | null
  error: string | null
}

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<number | null>(null)

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      chunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)

        const recordedDuration = (Date.now() - startTimeRef.current) / 1000
        setDuration(recordedDuration)

        options.onRecordingComplete?.(blob, recordedDuration)

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.onerror = () => {
        setError('Recording failed')
        options.onError?.(new Error('Recording failed'))
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // Collect data every 100ms

      startTimeRef.current = Date.now()
      setIsRecording(true)
      setDuration(0)

      // Update duration every 100ms
      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000)
      }, 100)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording'
      setError(errorMessage)
      options.onError?.(err instanceof Error ? err : new Error(errorMessage))
    }
  }, [options])

  const stopRecording = useCallback(async (): Promise<{ blob: Blob; duration: number } | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null)
        return
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const recordedDuration = (Date.now() - startTimeRef.current) / 1000

        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        setIsRecording(false)
        setDuration(recordedDuration)
        setAudioUrl(URL.createObjectURL(blob))

        options.onRecordingComplete?.(blob, recordedDuration)
        resolve({ blob, duration: recordedDuration })
      }

      mediaRecorderRef.current.stop()
    })
  }, [options])

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    audioUrl,
    error,
  }
}

// Convert Blob (audio/webm) to PCM format required by gummy
export async function convertToPCM(blob: Blob, targetSampleRate = 16000): Promise<Uint8Array> {
  // Decode audio using Web Audio API
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext({ sampleRate: targetSampleRate })
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

  // Get mono channel data at target sample rate
  const channelData = audioBuffer.getChannelData(0)

  // Convert Float32Array to Int16Array (PCM 16-bit)
  const pcmData = new Int16Array(channelData.length)
  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]))
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  // Convert to Uint8Array
  const uint8Array = new Uint8Array(pcmData.buffer)
  audioContext.close()

  return uint8Array
}

// Convert Blob to Base64 (original function)
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      resolve(base64.split(',')[1]) // Remove data URL prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Play audio from URL or Blob
export function playAudio(url: string | Blob): void {
  const audio = new Audio()
  audio.src = url instanceof Blob ? URL.createObjectURL(url) : url
  audio.play()
}
