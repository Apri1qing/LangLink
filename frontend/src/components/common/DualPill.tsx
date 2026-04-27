interface DualPillProps {
  leftLabel: string
  rightLabel: string
  isLeftRecording: boolean
  isRightRecording: boolean
  onLeftToggle: () => void
  onRightToggle: () => void
  disabled?: boolean
}

/**
 * 双 pill 录音按钮。
 * - 点按 toggle（按下开始 / 再按结束）
 * - pill 上显示源语言名（无 icon）
 * - 录音中该 pill 背景变 `#D94F00`
 * - 两 pill 同时只能有一个在录音中，另一个 disabled
 */
export function DualPill({
  leftLabel,
  rightLabel,
  isLeftRecording,
  isRightRecording,
  onLeftToggle,
  onRightToggle,
  disabled = false,
}: DualPillProps) {
  const otherRecording = isLeftRecording || isRightRecording
  const baseCls =
    'flex-1 py-3 rounded-full text-base font-medium transition-all active:scale-[0.98] disabled:opacity-40'

  return (
    <div className="flex items-center gap-3 px-4">
      <button
        type="button"
        onClick={onLeftToggle}
        disabled={disabled || (otherRecording && !isLeftRecording)}
        aria-label={isLeftRecording ? '结束录音' : `${leftLabel} 开始录音`}
        className={`${baseCls} ${
          isLeftRecording ? 'bg-[#D94F00] text-white' : 'bg-[#1A1A1A] text-white'
        }`}
      >
        {isLeftRecording ? '● 点击结束' : leftLabel}
      </button>
      <button
        type="button"
        onClick={onRightToggle}
        disabled={disabled || (otherRecording && !isRightRecording)}
        aria-label={isRightRecording ? '结束录音' : `${rightLabel} 开始录音`}
        className={`${baseCls} ${
          isRightRecording ? 'bg-[#D94F00] text-white' : 'bg-[#D8D2CA] text-[#1A1A1A]'
        }`}
      >
        {isRightRecording ? '● 点击结束' : rightLabel}
      </button>
    </div>
  )
}
