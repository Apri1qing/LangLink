import { useAppStore } from '../../stores/appStore'
import type { DisplayMode } from '../../stores/appStore'

/**
 * 常驻顶部栏：左-历史、中-模式切换（照片/语音）、右-设置。
 * 与 PR4/PR5 的 Home/VoiceMode 保持一致的视觉语言。
 */
export function TopBar() {
  const { displayMode, setDisplayMode, setPage } = useAppStore()

  const openHistory = () => setPage('history')
  const openSettings = () => setPage('settings')
  const switchMode = (mode: DisplayMode) => setDisplayMode(mode)

  const iconBtn =
    'w-11 h-11 flex items-center justify-center rounded-full active:scale-95 transition-transform'

  const modeBtn = (active: boolean) =>
    `${iconBtn} ${active ? 'opacity-100' : 'opacity-40'}`

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#F2EDE8]">
      <button
        type="button"
        aria-label="历史会话"
        onClick={openHistory}
        className={iconBtn}
      >
        <span className="text-xl" aria-hidden>🕒</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="照片模式"
          onClick={() => switchMode('photo')}
          className={modeBtn(displayMode === 'photo')}
        >
          <span className="text-xl" aria-hidden>📷</span>
        </button>
        <button
          type="button"
          aria-label="语音模式"
          onClick={() => switchMode('voice')}
          className={modeBtn(displayMode === 'voice')}
        >
          <span className="text-xl" aria-hidden>🎙</span>
        </button>
      </div>

      <button
        type="button"
        aria-label="设置"
        onClick={openSettings}
        className={iconBtn}
      >
        <span className="text-xl" aria-hidden>⚙</span>
      </button>
    </div>
  )
}
