import { useAppStore, type ConversationMessage } from '../../stores/appStore'
import { speakText } from '../../hooks/useVoice'

interface ConversationBubbleProps {
  message: ConversationMessage
}

export function ConversationBubble({ message }: ConversationBubbleProps) {
  const sourceLang = useAppStore((s) => s.sourceLang)
  // "Me" = the message was recorded in my direction (sourceLang matches current source)
  const isUser = message.sourceLang === sourceLang

  const handlePlay = () => {
    if (message.audioUrl) {
      try {
        new Audio(message.audioUrl).play().catch(() => speakText(message.translatedText, message.targetLang))
        return
      } catch {
        /* fall through */
      }
    }
    speakText(message.translatedText, message.targetLang)
  }

  const bubble = (
    <div
      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-[#1A1A1A] text-white rounded-br-sm'
          : 'bg-[#F2EDE8] text-[#2D2D2D] rounded-bl-sm'
      }`}
    >
      <p className="text-sm font-medium whitespace-pre-wrap">{message.translatedText}</p>
      <p className={`text-xs mt-1 ${isUser ? 'text-gray-400' : 'text-[#888888]'}`}>
        原文：{message.originalText}
      </p>
    </div>
  )

  const playBtn = (
    <button
      type="button"
      onClick={handlePlay}
      aria-label="播放翻译"
      className="w-8 h-8 shrink-0 rounded-full bg-white border border-[#E8E3DD] text-[#2D2D2D] text-xs flex items-center justify-center active:scale-95"
    >
      ▶
    </button>
  )

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isUser ? (
        <>
          {bubble}
          {playBtn}
        </>
      ) : (
        <>
          {playBtn}
          {bubble}
        </>
      )}
    </div>
  )
}
