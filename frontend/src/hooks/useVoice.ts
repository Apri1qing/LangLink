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

// Get the best supported MIME type for recording
function getSupportedMimeType(): string {
  const types = [
    'audio/mp4',
    'audio/mp4;codecs=mp4a',
    'audio/aac',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log('Using MIME type:', type)
      return type
    }
  }
  
  // Fallback - let browser decide
  console.warn('No preferred MIME type supported, using default')
  return ''
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
  /** When user releases before getUserMedia / MediaRecorder is ready, drop the in-flight start */
  const abortStartRef = useRef(false)

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      chunksRef.current = []
      abortStartRef.current = false

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      if (abortStartRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const mimeType = getSupportedMimeType()
      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      console.log('MediaRecorder mimeType:', mediaRecorder.mimeType)

      mediaRecorder.ondataavailable = (event) => {
        console.log('ondataavailable size:', event.data.size)
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
        console.log('onstop: chunks=', chunksRef.current.length, 'blobSize=', blob.size)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)

        const recordedDuration = (Date.now() - startTimeRef.current) / 1000
        setDuration(recordedDuration)

        options.onRecordingComplete?.(blob, recordedDuration)

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
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
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        abortStartRef.current = true
        resolve(null)
        return
      }

      abortStartRef.current = false

      const recordedDuration = (Date.now() - startTimeRef.current) / 1000

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      setIsRecording(false)
      setDuration(recordedDuration)

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        console.log('stopRecording onstop: chunks=', chunksRef.current.length, 'blobSize=', blob.size)
        setAudioUrl(URL.createObjectURL(blob))
        options.onRecordingComplete?.(blob, recordedDuration)
        resolve({ blob, duration: recordedDuration })
      }

      recorder.stop()
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

// Convert Blob to PCM 16kHz mono format required by gummy
// Uses a more compatible approach for iOS Safari
export async function convertToPCM(blob: Blob, targetSampleRate = 16000): Promise<Uint8Array> {
  try {
    console.log('Converting blob:', blob.type, 'size:', blob.size)
    
    // For iOS Safari, we need to use a different approach
    // Create an audio element to decode the audio
    const audio = new Audio()
    const url = URL.createObjectURL(blob)
    
    return new Promise((resolve, reject) => {
      audio.onloadedmetadata = async () => {
        try {
          // Create audio context
          const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
          
          // Fetch and decode
          const response = await fetch(url)
          const arrayBuffer = await response.arrayBuffer()
          
          let audioBuffer: AudioBuffer
          
          try {
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
          } catch (decodeError) {
            console.error('decodeAudioData failed:', decodeError)
            // For formats that can't be decoded, return empty PCM
            // The server should handle the raw blob
            reject(new Error('Audio format not supported for decoding'))
            return
          }
          
          console.log('Decoded audio:', audioBuffer.duration, 's,', audioBuffer.numberOfChannels, 'channels, sampleRate:', audioBuffer.sampleRate)
          
          // Resample to targetSampleRate
          const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * targetSampleRate, targetSampleRate)
          const bufferSource = offlineCtx.createBufferSource()
          bufferSource.buffer = audioBuffer
          bufferSource.connect(offlineCtx.destination)
          bufferSource.start()
          
          const renderedBuffer = await offlineCtx.startRendering()
          console.log('Resampled to:', renderedBuffer.duration, 's,', renderedBuffer.numberOfChannels, 'channels,', renderedBuffer.sampleRate, 'Hz')
          
          // Get mono channel data
          const channelData = renderedBuffer.getChannelData(0)
          
          // Convert Float32Array (-1..1) to Int16Array (-32768..32767)
          const pcmData = new Int16Array(channelData.length)
          for (let i = 0; i < channelData.length; i++) {
            const s = Math.max(-1, Math.min(1, channelData[i]))
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          
          const uint8Array = new Uint8Array(pcmData.buffer)
          
          audioContext.close()
          URL.revokeObjectURL(url)
          
          console.log('PCM output:', uint8Array.length, 'bytes')
          resolve(uint8Array)
        } catch (error) {
          URL.revokeObjectURL(url)
          reject(error)
        }
      }
      
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load audio'))
      }
      
      audio.src = url
    })
  } catch (error) {
    console.error('PCM conversion failed:', error)
    throw error
  }
}

// Convert Uint8Array to base64 asynchronously (safe for large data)
export async function uint8ArrayToBase64(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve) => {
    // Copy to regular ArrayBuffer to avoid SharedArrayBuffer issues
    const arrayBuffer = new ArrayBuffer(bytes.length)
    const view = new Uint8Array(arrayBuffer)
    view.set(bytes)
    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' })
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.readAsDataURL(blob)
  })
}

// Play audio from URL or Blob
export function playAudio(url: string | Blob): void {
  const audio = new Audio()
  audio.src = url instanceof Blob ? URL.createObjectURL(url) : url
  audio.play()
}

// Browser-native Web Speech API TTS
const ttsLangMap: Record<string, string> = {
  'zh': 'zh-CN', 'ja': 'ja-JP', 'en': 'en-US', 'ko': 'ko-KR',
  'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE', 'it': 'it-IT',
  'pt': 'pt-BR', 'ru': 'ru-RU', 'ar': 'ar-SA', 'hi': 'hi-IN',
  'th': 'th-TH', 'vi': 'vi-VN', 'id': 'id-ID', 'ms': 'ms-MY', 'tl': 'fil-PH',
}

export function speakText(text: string, lang: string): void {
  if (!text || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = ttsLangMap[lang] || lang
  utterance.rate = 1.0
  utterance.pitch = 1.0
  window.speechSynthesis.speak(utterance)
}

// Browser native Speech Recognition API type
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
    webkitAudioContext: typeof AudioContext
  }
}

// Check if browser supports Web Speech API
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' &&
    (window.SpeechRecognition !== undefined || window.webkitSpeechRecognition !== undefined)
}

// Recognize speech using browser's native Web Speech API
export function recognizeWithBrowserSpeech(
  sourceLang: string,
  onResult: (text: string) => void,
  onError: (error: string) => void
): { stop: () => void } {
  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition

  if (!SpeechRecognitionClass) {
    onError('Speech recognition not supported in this browser')
    return { stop: () => {} }
  }

  const recognition = new SpeechRecognitionClass()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = ttsLangMap[sourceLang] || sourceLang

  let finalTranscript = ''

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interimTranscript = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += transcript
      } else {
        interimTranscript += transcript
      }
    }
    onResult(finalTranscript + interimTranscript)
  }

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    console.error('Speech recognition error:', event.error)
    onError(event.error)
  }

  recognition.onend = () => {
    console.log('Speech recognition ended')
  }

  recognition.start()
  console.log('Speech recognition started with lang:', recognition.lang)

  return {
    stop: () => {
      recognition.stop()
    },
  }
}
