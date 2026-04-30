import type { Phrase } from '../../types'

interface PhrasesWrapProps {
  phrases: Phrase[]
  onPhraseClick?: (phrase: Phrase) => void
}

export function PhrasesWrap({ phrases, onPhraseClick }: PhrasesWrapProps) {
  const displayed = phrases.slice(0, 10)
  if (displayed.length === 0) return null
  return (
    <div className="py-1">
      <div className="px-1 mb-1">
        <span className="text-[#AAAAAA] text-xs font-medium tracking-wide">常用语</span>
      </div>
      <div
        className="grid grid-rows-2 grid-flow-col gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ gridAutoColumns: 'max-content' }}
      >
        {displayed.map((phrase) => (
          <button
            key={phrase.id}
            onClick={() => onPhraseClick?.(phrase)}
            className="min-h-9 px-4 py-1.5 bg-[#C8C1B9] text-[#2D2D2D] text-sm font-medium rounded-full whitespace-nowrap active:scale-95 transition-transform snap-start"
          >
            {phrase.text}
          </button>
        ))}
      </div>
    </div>
  )
}
