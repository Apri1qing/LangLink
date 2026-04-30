import { Camera } from 'lucide-react'

interface ViewfinderProps {
  onClick?: () => void
  hint?: string
}

export function Viewfinder({ onClick, hint = '拍摄菜单、路牌或标识' }: ViewfinderProps) {
  return (
    <button
      onClick={onClick}
      className="w-full h-full bg-black rounded-2xl flex flex-col items-center justify-center gap-3 active:scale-[0.995] transition-transform"
    >
      <span className="w-16 h-16 rounded-full glass-control-dark flex items-center justify-center" aria-hidden>
        <Camera size={30} strokeWidth={1.9} />
      </span>
      <span className="text-[#6B6B6B] text-sm">{hint}</span>
    </button>
  )
}
