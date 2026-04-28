import { useEffect, useRef, useState } from 'react'
import type { OcrRegion } from '../../types'
import { locationToPercent } from '../../utils/bboxMap'

interface PhotoOverlayProps {
  imageDataUrl: string
  regions: OcrRegion[]
  showTranslated: boolean
  isLoading?: boolean
  onToggle: () => void
  onDelete: () => void
}

/**
 * 相机模式拍照后的常驻视图：原图 + 译文气泡叠加层。
 * - 左上角按钮切换：显示原图 / 显示译文叠加
 * - 右下角按钮：删除，回到初始黑框
 */
export function PhotoOverlay({
  imageDataUrl,
  regions,
  showTranslated,
  isLoading = false,
  onToggle,
  onDelete,
}: PhotoOverlayProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    // 重置尺寸（换图时）
    setImgSize(null)
  }, [imageDataUrl])

  const handleLoad = () => {
    const el = imgRef.current
    if (el) setImgSize({ w: el.naturalWidth, h: el.naturalHeight })
  }

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
      <img
        ref={imgRef}
        src={imageDataUrl}
        alt="Captured"
        onLoad={handleLoad}
        className="w-full h-full object-cover"
      />

      {/* 译文气泡叠加层 */}
      {showTranslated && imgSize && regions.map((r, i) => {
        const rect = locationToPercent(r.location, imgSize.w, imgSize.h)
        if (!rect) return null
        return (
          <div
            key={i}
            className="absolute flex items-center justify-center text-center"
            style={{
              left: `${rect.left}%`,
              top: `${rect.top}%`,
              width: `${rect.width}%`,
              minHeight: `${rect.height}%`,
              background: 'rgba(255, 255, 255, 0.92)',
              color: '#1A1A1A',
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 'clamp(10px, 2.6vw, 16px)',
              lineHeight: 1.2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              pointerEvents: 'none',
              whiteSpace: 'normal',
              overflow: 'hidden',
            }}
          >
            {r.translatedText}
          </div>
        )
      })}

      {/* Loading 遮罩 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="px-4 py-2 bg-white/90 text-[#1A1A1A] rounded-full text-sm">
            识别中…
          </div>
        </div>
      )}

      {/* 左上角：切换原图 / 译文 */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={showTranslated ? '显示原图' : '显示译文'}
        className="absolute top-3 left-3 w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-95 backdrop-blur-sm"
      >
        <span className="text-lg" aria-hidden>{showTranslated ? '🌐' : '👁'}</span>
      </button>

      {/* 右下角：删除 */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="删除照片"
        className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-95 backdrop-blur-sm"
      >
        <span className="text-lg" aria-hidden>🗑</span>
      </button>
    </div>
  )
}
