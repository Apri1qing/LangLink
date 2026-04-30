import { useState } from 'react'
import { SubPageTopBar } from '../common/SubPageTopBar'
import { useAppStore } from '../../stores/appStore'
import { getSessions, type Session } from '../../services/sessions'

/**
 * 历史会话列表页。点击进入会话 → 切换到 voiceMode 展示。
 */
export function History() {
  const { setPage, setDisplayMode, setMessages, setCurrentSessionId } = useAppStore()
  const [sessions] = useState<Session[]>(() => getSessions())

  const loadSession = (session: Session) => {
    setMessages(
      session.messages.map((m) => ({
        id: m.id,
        type: m.type,
        originalText: m.originalText,
        translatedText: m.translatedText,
        sourceLang: m.sourceLang,
        targetLang: m.targetLang,
        audioUrl: m.audioUrl,
        imageDataUrl: m.imageDataUrl,
        timestamp: m.timestamp,
      })),
    )
    setCurrentSessionId(session.id)
    setDisplayMode('voice')
    setPage('home')
  }

  return (
    <div className="flex flex-col h-full bg-[#F2EDE8]">
      <SubPageTopBar title="历史会话" />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <h3 className="text-xs font-semibold text-[#6B6B6B] tracking-wider mb-3 uppercase">
          历史会话
        </h3>

        {sessions.length === 0 ? (
          <div className="bg-white rounded-2xl px-4 py-12 text-center text-[#AAAAAA] text-sm">
            暂无历史会话
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden">
            {sessions.map((session, index) => (
              <div key={session.id}>
                <button
                  type="button"
                  onClick={() => loadSession(session)}
                  className="w-full text-left px-4 py-4 active:bg-[#F2EDE8]"
                >
                  <p className="text-sm text-[#1A1A1A] truncate">
                    {session.lastMessage || '（空会话）'}
                  </p>
                  <p className="text-xs text-[#6B6B6B] mt-1">
                    {new Date(session.updatedAt).toLocaleDateString()} · {session.messages.length} 条
                  </p>
                </button>
                {index < sessions.length - 1 && (
                  <div className="h-px bg-[#D8D2CA] mx-4" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
