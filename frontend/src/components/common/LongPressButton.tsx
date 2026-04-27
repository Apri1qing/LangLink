import { useLongPress } from '../../hooks/useLongPress'

interface LongPressButtonProps {
  onLongPressStart: () => void
  onLongPressEnd: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export function LongPressButton({
  onLongPressStart,
  onLongPressEnd,
  children,
  className = '',
  disabled = false,
}: LongPressButtonProps) {
  const { isPressed, handlers } = useLongPress({
    onLongPressStart,
    onLongPressEnd,
    threshold: 300,
  })

  return (
    <button
      {...handlers}
      disabled={disabled}
      className={`${className} ${isPressed ? 'scale-95' : ''} transition-transform ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {children}
    </button>
  )
}
