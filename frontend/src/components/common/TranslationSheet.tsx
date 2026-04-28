import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react'
import { speakText } from '../../hooks/useVoice'
import { useAppStore } from '../../stores/appStore'
import { playAudioUrl } from '../../services/audioUnlock'

interface TranslationSheetProps {
  originalText: string
  translatedText: string
  audioUrl?: string | null
  sourceLangName: string
  targetLangName: string
  targetLang: string
  onClose: () => void
}

const sheetBottomClass =
  'pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-2'

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
  onClose,
}: TranslationSheetProps) {
  const hasAutoPlayedRef = useRef(false)
  const dragStartY = useRef<number | null>(null)
  const [dragDy, setDragDy] = useState(0)
  const { isTranslating, translationError, setTranslationError, translationType } = useAppStore()

  useEffect(() => {
    if (isTranslating) {
      hasAutoPlayedRef.current = false
    }
  }, [isTranslating])

  // Sheet 展示期间禁用页面滚动，避免下滑 sheet 时误触发页面滚动/下拉刷新
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

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
    if (isTranslating || translationError || !translatedText.trim() || hasAutoPlayedRef.current) return

    hasAutoPlayedRef.current = true
    const t = window.setTimeout(() => {
      void playTranslated(audioUrl, translatedText, targetLang)
    }, 200)

    return () => clearTimeout(t)
  }, [isTranslating, translationError, translatedText, targetLang, audioUrl, translationType])

  const handleReplay = useCallback(() => {
    void playTranslated(audioUrl, translatedText, targetLang)
  }, [audioUrl, translatedText, targetLang])

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

  const backdrop = (
    <div
      className="fixed inset-0 z-20 bg-black/30"
      style={{ touchAction: 'none' }}
      onClick={onClose}
      onTouchMove={(e) => e.preventDefault()}
      aria-hidden
    />
  )

  if (isTranslating) {
    const hasPartial = !!(originalText || translatedText)
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

        <div className="flex flex-col items-center py-4">
          <div className="w-12 h-12 rounded-full bg-[#F2EDE8] flex items-center justify-center mb-2">
            <span className="text-xl animate-pulse">⏳</span>
          </div>
          <p className="text-base text-[#6B6B6B]">
            {hasPartial ? '识别中，随句子陆续显示' : '正在连接并识别…'}
          </p>
        </div>

        {hasPartial && (
          <div className="border-t border-[#EEEAE4] pt-4 pb-2 space-y-3 max-h-[45vh] overflow-y-auto">
            {originalText ? (
              <div>
                <p className="text-xs text-[#888888] mb-1 uppercase tracking-wider flex items-center gap-2">
                  {sourceLangName}
                  <span className="text-[10px] font-normal normal-case text-[#D94F00]">更新中</span>
                </p>
                <p className="text-base text-[#2D2D2D] leading-relaxed">{originalText}</p>
              </div>
            ) : null}
            {translatedText ? (
              <div>
                <p className="text-xs text-[#888888] mb-1 uppercase tracking-wider flex items-center gap-2">
                  {targetLangName}
                  <span className="text-[10px] font-normal normal-case text-[#D94F00]">更新中</span>
                </p>
                <p className="text-xl font-semibold text-[#2D2D2D] leading-snug">{translatedText}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
      </>
    )
  }

  if (translationError) {
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
      </>
    )
  }

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

      {originalText && (
        <div className="mb-3">
          <p className="text-xs text-[#888888] mb-1 uppercase tracking-wider">{sourceLangName}</p>
          <p className="text-base text-[#2D2D2D]">{originalText}</p>
        </div>
      )}

      {translatedText && (
        <div className="mb-3">
          <p className="text-xs text-[#888888] mb-1 uppercase tracking-wider">{targetLangName}</p>
          <p className="text-2xl font-semibold text-[#2D2D2D] leading-snug">{translatedText}</p>
        </div>
      )}

      <div className="flex justify-center mb-4">
        <button
          type="button"
          onClick={handleReplay}
          className="px-5 py-2 rounded-full bg-[#1A1A1A] text-white text-sm font-medium"
        >
          ▶ 播放译文
        </button>
      </div>
    </div>
    </>
  )
}
