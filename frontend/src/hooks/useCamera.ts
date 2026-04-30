import { useState, useCallback, useRef, useEffect } from 'react'

export function useCamera() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      setIsReady(false)
      
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      console.log('[useCamera] Requesting camera access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      })
      
      console.log('[useCamera] Camera access granted, tracks:', stream.getTracks().length)
      streamRef.current = stream
      
      // Bind stream to video element immediately
      if (videoRef.current) {
        console.log('[useCamera] Binding stream to video element')
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
          console.log('[useCamera] Video playing')
          setIsReady(true)
        } catch (playErr) {
          console.warn('[useCamera] Auto-play failed:', playErr)
          // Try playing on next frame
          requestAnimationFrame(() => {
            videoRef.current?.play().then(() => {
              console.log('[useCamera] Video playing (retry)')
              setIsReady(true)
            }).catch((e) => {
              console.error('[useCamera] Play retry failed:', e)
            })
          })
        }
      } else {
        console.warn('[useCamera] videoRef not available yet')
      }
      
      return stream
    } catch (err) {
      console.error('[useCamera] Camera error:', err)
      setError(err instanceof Error ? err.message : 'Camera access denied')
      throw err
    }
  }, [])

  // Effect to bind stream when videoRef becomes available
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        console.log('[useCamera] Effect binding stream to video')
        videoRef.current.srcObject = streamRef.current
        videoRef.current.play().then(() => {
          console.log('[useCamera] Video playing (effect)')
          setIsReady(true)
        }).catch((err) => {
          console.warn('[useCamera] Play failed (effect):', err)
        })
      }
    }
  })

  const stopCamera = useCallback(() => {
    console.log('[useCamera] Stopping camera')
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsReady(false)
  }, [])

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) {
      console.error('[useCamera] Video element or stream not available')
      return null
    }

    setIsCapturing(true)

    try {
      const video = videoRef.current
      
      // Wait for video to be ready
      if (video.readyState < 2) {
        console.log('[useCamera] Waiting for video to be ready...')
        await new Promise((resolve) => {
          video.onloadeddata = resolve
        })
      }
      
      const sourceWidth = video.videoWidth || 1280
      const sourceHeight = video.videoHeight || 720
      const frameWidth = video.clientWidth || sourceWidth
      const frameHeight = video.clientHeight || sourceHeight
      const sourceAspect = sourceWidth / sourceHeight
      const frameAspect = frameWidth / frameHeight

      let sx = 0
      let sy = 0
      let sw = sourceWidth
      let sh = sourceHeight

      if (sourceAspect > frameAspect) {
        sw = Math.round(sourceHeight * frameAspect)
        sx = Math.round((sourceWidth - sw) / 2)
      } else if (sourceAspect < frameAspect) {
        sh = Math.round(sourceWidth / frameAspect)
        sy = Math.round((sourceHeight - sh) / 2)
      }

      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh

      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)

      setCapturedImage(dataUrl)
      return dataUrl
    } catch (err) {
      console.error('[useCamera] Capture error:', err)
      return null
    } finally {
      setIsCapturing(false)
    }
  }, [])

  const clearPhoto = useCallback(() => {
    setCapturedImage(null)
  }, [])

  return {
    capturedImage,
    isCapturing,
    isReady,
    error,
    videoRef,
    startCamera,
    stopCamera,
    capturePhoto,
    clearPhoto,
  }
}
