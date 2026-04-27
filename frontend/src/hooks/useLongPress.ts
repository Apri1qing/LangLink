import { useState, useCallback, useRef } from 'react'

interface UseLongPressOptions {
  onLongPressStart?: () => void
  onLongPressEnd?: () => void
  threshold?: number
}

export function useLongPress(
  { onLongPressStart, onLongPressEnd, threshold = 300 }: UseLongPressOptions = {}
) {
  const [isPressed, setIsPressed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = useCallback(() => {
    setIsPressed(true)
    timerRef.current = setTimeout(() => {
      onLongPressStart?.()
    }, threshold)
  }, [onLongPressStart, threshold])

  const end = useCallback(() => {
    setIsPressed(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    onLongPressEnd?.()
  }, [onLongPressEnd])

  const cancel = useCallback(() => {
    setIsPressed(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return {
    isPressed,
    handlers: {
      onMouseDown: start,
      onMouseUp: end,
      onMouseLeave: cancel,
      onTouchStart: start,
      onTouchEnd: end,
    },
  }
}
