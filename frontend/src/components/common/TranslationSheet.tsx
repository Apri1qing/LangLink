import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react'
import { speakText } from '../../hooks/useVoice'
import { useAppStore } from '../../stores/appStore'
import { playAudioUrl } from '../../services/audioUnlock'
import { LoaderCircle, Play } from 'lucide-react'

interface TranslationSheetProps {
  originalText: string
  translatedText: string
  audioUrl?: string | null
  sourceLangName: string
  targetLangName: string
  targetLang: string
  isStreaming?: boolean
  ttsStatus?: 'idle' | 'pending' | 'ready' | 'error'
  onPlayWhenReady?: () => void
  isNonModal?: boolean
  onClose: () => void
}

const sheetBottomClass =
  'pb-4 pt-2'

async function playTranslated(
  audioUrl: string | null | undefined,
  text: string,
  lang: string
): Promise<void> {
  if (audioUrl) {
    try {
      await playAudioUrl(audioUrl)
      return
    } catch (e) {
      console.warn('[TranslationSheet] audioUrl play failed, fallback TTS', e)
    }
  }
  speakText(text, lang)
}

export function TranslationSheet({
  originalText,
  translatedText,
  audioUrl = null,
  sourceLangName,
  targetLangName,
  targetLang,
  isStreaming,
  ttsStatus = audioUrl ? 'ready' : 'idle',
  onPlayWhenReady,
  isNonModal = false,
  onClose,
}: TranslationSheetProps) {
  const hasAutoPlayedRef = useRef(false)
  const dragStartY = useRef<number | null>(null)
  const [dragDy, setDragDy] = useState(0)
  const { isTranslating, translationError, setTranslationError, translationType } = useAppStore()
  const streaming = isStreaming ?? isTranslating
  const isTtsPending = ttsStatus === 'pending'
  const showPlayButton = !!translatedText.trim()

  useEffect(() => {
    if (streaming) {
      hasAutoPlayedRef.current = false
    }
  }, [streaming])

  // Modal sheet 展示期间禁用页面滚动，避免下滑 sheet 时误触发页面滚动/下拉刷新
  useEffect(() => {
    if (isNonModal) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isNonModal])

  // Escape 键关闭（桌面端）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  /** 流式结束（isTranslating=false）后自动播放译文一次；识别/流式过程中不播放 */
  useEffect(() => {
    if (translationType === 'phrase') return // phrase handler plays directly
    if (streaming || isTtsPending || translationError || !translatedText.trim() || hasAutoPlayedRef.current) return

    hasAutoPlayedRef.current = true
    const t = window.setTimeout(() => {
      void playTranslated(audioUrl, translatedText, targetLang)
    }, 200)

    return () => clearTimeout(t)
  }, [streaming, isTtsPending, translationError, translatedText, targetLang, audioUrl, translationType])

  const handleReplay = useCallback(() => {
    if (isTtsPending) {
      onPlayWhenReady?.()
      return
    }
    void playTranslated(audioUrl, translatedText, targetLang)
  }, [audioUrl, translatedText, targetLang, isTtsPending, onPlayWhenReady])

  // Pointer events for desktop
  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY
    setDragDy(0)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onHandlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current == null) return
    const dy = e.clientY - dragStartY.current
    if (dy > 0) setDragDy(dy)
  }

  const onHandlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current != null && e.clientY - dragStartY.current > 80) {
      onClose()
    }
    dragStartY.current = null
    setDragDy(0)
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      /* noop */
    }
  }

  // Sheet-level touch handlers — must NOT preventDefault on touchstart
  // so taps on inner buttons still register.
  const onSheetTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    dragStartY.current = e.touches[0].clientY
    setDragDy(0)
  }

  const onSheetTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (dragStartY.current == null) return
    const dy = e.touches[0].clientY - dragStartY.current
    if (dy > 5) {
      e.preventDefault()
      setDragDy(dy)
    }
  }

  const onHandleTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (dragStartY.current != null) {
      const touch = e.changedTouches[0]
      if (touch.clientY - dragStartY.current > 80) {
        onClose()
      }
    }
    dragStartY.current = null
    setDragDy(0)
  }

  const backdrop = isNonModal ? null : (
    <div
      className="fixed inset-0 z-20 bg-black/30"
      style={{ touchAction: 'none' }}
      onClick={onClose}
      onTouchMove={(e) => e.preventDefault()}
      aria-hidden
    />
  )

  return (
    <>
    {backdrop}
    <div
      className={`fixed z-30 bottom-0 left-0 right-0 mx-auto w-full max-w-[390px] bg-white rounded-t-[20px] px-6 animate-slide-up shadow-[0_-8px_32px_rgba(0,0,0,0.12)] ${sheetBottomClass}`}
      style={{
        touchAction: 'none',
        ...(dragDy ? { transform: `translateY(${Math.min(dragDy, 120)}px)` } : {}),
      }}
      onPointerDown={onHandlePointerDown}
      onPointerMove={onHandlePointerMove}
      onPointerUp={onHandlePointerUp}
      onPointerCancel={onHandlePointerUp}
      onTouchStart={onSheetTouchStart}
      onTouchMove={onSheetTouchMove}
      onTouchEnd={onHandleTouchEnd}
    >
      <div className="flex justify-center mb-3 select-none">
        <div className="w-9 h-1 bg-[#C9C4BE] rounded-full" />
      </div>

      <div className="space-y-4 max-h-[45vh] overflow-y-auto pb-1">
        {translationError ? (
          <div>
            <p className="text-sm font-medium text-[#B42318] mb-2">翻译失败</p>
            <p className="text-sm text-[#6B6B6B] mb-4 break-words">{translationError}</p>
            <button
              type="button"
              onClick={() => {
                setTranslationError(null)
                onClose()
              }}
              className="w-full py-3 rounded-full bg-[#1A1A1A] text-white text-sm font-medium"
            >
              关闭
            </button>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs text-[#888888] mb-1 uppercase tracking-wider">{sourceLangName}</p>
              <p className={`text-base leading-relaxed ${originalText ? 'text-[#2D2D2D]' : 'text-[#9A948E] animate-pulse'}`}>
                {originalText || '识别中…'}
              </p>
            </div>

            <div>
              <p className="text-xs text-[#888888] mb-1 uppercase tracking-wider">{targetLangName}</p>
              <div className="flex items-start gap-3">
                <p className={`flex-1 min-w-0 font-semibold leading-snug break-words ${
                  translatedText ? 'text-2xl text-[#2D2D2D]' : 'text-xl text-[#9A948E] animate-pulse'
                }`}>
                  {translatedText || '翻译中…'}
                </p>
                {showPlayButton && (
                  <button
                    type="button"
                    onClick={handleReplay}
                    disabled={isTtsPending}
                    aria-label={isTtsPending ? '语音生成中' : '播放译文'}
                    className={`mt-0.5 w-10 h-10 shrink-0 rounded-full glass-control-dark text-white flex items-center justify-center transition-transform ${
                      isTtsPending ? 'opacity-80 animate-pulse cursor-wait' : 'active:scale-95'
                    }`}
                  >
                    {isTtsPending ? (
                      <LoaderCircle size={18} className="animate-spin" aria-hidden />
                    ) : (
                      <Play size={16} fill="currentColor" strokeWidth={0} aria-hidden />
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  )
}
