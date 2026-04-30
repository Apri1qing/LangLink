import { useAppStore } from '../../stores/appStore'
import type { DisplayMode } from '../../stores/appStore'
import { Camera, Clock3, Mic, Settings } from 'lucide-react'

/**
 * 常驻顶部栏：左-历史、中-模式切换（照片/语音）、右-设置。
 * 与 PR4/PR5 的 Home/VoiceMode 保持一致的视觉语言。
 */
export function TopBar() {
  const { displayMode, setDisplayMode, setPage, clearTranslationResult } = useAppStore()

  const openHistory = () => setPage('history')
  const openSettings = () => setPage('settings')
  const switchMode = (mode: DisplayMode) => {
    if (displayMode === 'voice' && mode === 'photo') {
      clearTranslationResult()
    }
    setDisplayMode(mode)
  }

  const iconBtn =
    'w-11 h-11 flex items-center justify-center rounded-full glass-control active:scale-95 transition-all'

  const modeBtn = (active: boolean) =>
    `w-11 h-11 flex items-center justify-center rounded-full active:scale-95 transition-all ${
      active ? 'glass-control-dark' : 'glass-control text-[#6B6B6B]'
    }`

  return (
    <div className="flex shrink-0 items-center justify-between px-4 py-3 bg-[#F2EDE8]">
      <button
        type="button"
        aria-label="历史会话"
        onClick={openHistory}
        className={iconBtn}
      >
        <Clock3 size={21} strokeWidth={2.2} aria-hidden />
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="照片模式"
          onClick={() => switchMode('photo')}
          className={modeBtn(displayMode === 'photo')}
        >
          <Camera size={21} strokeWidth={2.2} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="语音模式"
          onClick={() => switchMode('voice')}
          className={modeBtn(displayMode === 'voice')}
        >
          <Mic size={21} strokeWidth={2.2} aria-hidden />
        </button>
      </div>

      <button
        type="button"
        aria-label="设置"
        onClick={openSettings}
        className={iconBtn}
      >
        <Settings size={21} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  )
}
