import { useAppStore, type ConversationMessage } from '../../stores/appStore'
import { speakText } from '../../hooks/useVoice'
import { Play } from 'lucide-react'

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

  if (isUser) {
    // 右侧气泡（深色），播放按钮在气泡左内侧
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-br-sm px-4 py-3 bg-[#1A1A1A] text-white">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={handlePlay}
              aria-label="播放翻译"
              className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-white/18 text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <Play size={13} fill="currentColor" strokeWidth={0} aria-hidden />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium whitespace-pre-wrap">{message.translatedText}</p>
              <p className="text-xs mt-1 text-gray-400">原文：{message.originalText}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 左侧气泡（浅色），播放按钮在气泡右内侧
  return (
    <div className="flex justify-start">
      <div className="max-w-[82%] rounded-2xl rounded-bl-sm px-4 py-3 bg-[#F0EDE8] text-[#2D2D2D]">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium whitespace-pre-wrap">{message.translatedText}</p>
            <p className="text-xs mt-1 text-[#888888]">原文：{message.originalText}</p>
          </div>
          <button
            type="button"
            onClick={handlePlay}
            aria-label="播放翻译"
            className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-black/10 text-[#2D2D2D] flex items-center justify-center active:scale-95 transition-transform"
          >
            <Play size={13} fill="currentColor" strokeWidth={0} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
