import { useEffect, useRef } from 'react'
import { useCamera } from '../../hooks/useCamera'
import { Check, RotateCcw, X } from 'lucide-react'

interface CameraCaptureProps {
  /** 用户确认"使用照片"后触发，携带 base64 图像 */
  onCapture?: (imageData: string) => void
  /** 关闭相机（不使用照片） */
  onClose?: () => void
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const { capturedImage, isCapturing, videoRef, startCamera, stopCamera, capturePhoto, clearPhoto } = useCamera()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [startCamera, stopCamera])

  const handleShutter = async () => {
    // 仅拍照到内部预览，不立刻回调；由"使用照片"确认
    await capturePhoto()
  }

  const handleRetake = () => {
    clearPhoto()
  }

  const handleConfirm = () => {
    if (!capturedImage) return
    stopCamera()
    onCapture?.(capturedImage)
  }

  const handleClose = () => {
    stopCamera()
    onClose?.()
  }

  // Escape 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (capturedImage) {
    return (
      <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
        <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
          <button
            onClick={handleRetake}
            className="h-12 px-5 glass-control text-[#1A1A1A] rounded-full font-medium flex items-center gap-2 active:scale-95 transition-transform"
          >
            <RotateCcw size={18} aria-hidden />
            重拍
          </button>
          <button
            onClick={handleConfirm}
            className="h-12 px-5 glass-control-dark text-white rounded-full font-medium flex items-center gap-2 active:scale-95 transition-transform"
          >
            <Check size={18} aria-hidden />
            使用照片
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <button
          onClick={handleShutter}
          disabled={isCapturing}
          className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 active:scale-95 transition-transform disabled:opacity-50"
        />
      </div>
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 w-11 h-11 rounded-full glass-control-dark text-white flex items-center justify-center active:scale-95 transition-transform"
      >
        <X size={21} aria-hidden />
      </button>
    </div>
  )
}
