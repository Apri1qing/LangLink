interface ViewfinderProps {
  onClick?: () => void
  hint?: string
}

export function Viewfinder({ onClick, hint = '拍摄菜单、路牌或标识' }: ViewfinderProps) {
  return (
    <button
      onClick={onClick}
      className="w-full h-full bg-black rounded-2xl flex flex-col items-center justify-center gap-3"
    >
      <span className="text-6xl" aria-hidden>📷</span>
      <span className="text-[#6B6B6B] text-sm">{hint}</span>
    </button>
  )
}
