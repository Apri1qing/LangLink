import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'

interface Session {
  id: string
  type: 'voice' | 'photo' | 'phrase'
  sourceLang: string
  targetLang: string
  lastMessage: string
  timestamp: number
}

interface Phrase {
  id: number
  text: string
  translation?: string
}

interface MenuProps {
  sessions?: Session[]
  phrases?: Phrase[]
  onSessionClick?: (session: Session) => void
  onSessionDelete?: (sessionId: string) => void
  onPhraseDelete?: (phraseId: number) => void
  onAddPhrase?: (text: string, translation: string) => void
}

export function Menu({
  sessions = [],
  phrases = [],
  onSessionClick,
  onSessionDelete,
  onPhraseDelete,
  onAddPhrase,
}: MenuProps) {
  const { setPage } = useAppStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newText, setNewText] = useState('')
  const [newTranslation, setNewTranslation] = useState('')

  const handleBack = () => {
    setPage('home')
  }

  const handleAdd = () => {
    if (newText.trim() && newTranslation.trim()) {
      onAddPhrase?.(newText.trim(), newTranslation.trim())
      setNewText('')
      setNewTranslation('')
      setShowAddForm(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F5F0EB]">
      {/* NavBar */}
      <div className="flex items-center justify-between px-4 py-4">
        <button
          onClick={handleBack}
          className="w-8 h-8 flex items-center justify-center bg-[#1A1A1A] text-white rounded-full"
        >
          ←
        </button>
        <span className="text-base font-semibold text-[#1A1A1A]">设置</span>
        <div className="w-8" />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4 space-y-8">
        {/* History Sessions */}
        <section>
          <h3 className="text-xs font-semibold text-[#999999] tracking-wider mb-3 uppercase">
            历史会话
          </h3>
          <div className="bg-white rounded-2xl overflow-hidden">
            {sessions.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#AAAAAA] text-sm">
                暂无历史会话
              </div>
            ) : (
              sessions.map((session, index) => (
                <div key={session.id}>
                  <div className="flex items-center justify-between px-4 py-4 hover:bg-gray-50">
                    <button
                      onClick={() => onSessionClick?.(session)}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm text-[#2D2D2D] truncate">{session.lastMessage}</p>
                      <p className="text-xs text-[#888888] mt-1">
                        {new Date(session.timestamp).toLocaleDateString()}
                      </p>
                    </button>
                    <button
                      onClick={() => onSessionDelete?.(session.id)}
                      className="w-8 h-8 flex items-center justify-center text-[#FF3B30] text-lg font-bold"
                    >
                      -
                    </button>
                  </div>
                  {index < sessions.length - 1 && (
                    <div className="h-px bg-[#F0EBE5] mx-4" />
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Phrases Management */}
        <section>
          <h3 className="text-xs font-semibold text-[#999999] tracking-wider mb-3 uppercase">
            常用语管理
          </h3>
          <div className="bg-white rounded-2xl overflow-hidden">
            {phrases.map((phrase, index) => (
              <div key={phrase.id}>
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex-1">
                    <p className="text-sm text-[#2D2D2D]">{phrase.text}</p>
                    {phrase.translation && (
                      <p className="text-xs text-[#888888] mt-1">{phrase.translation}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onPhraseDelete?.(phrase.id)}
                    className="w-8 h-8 flex items-center justify-center text-[#FF3B30] text-lg font-bold"
                  >
                    -
                  </button>
                </div>
                {index < phrases.length - 1 && (
                  <div className="h-px bg-[#F0EBE5] mx-4" />
                )}
              </div>
            ))}
            {showAddForm ? (
              <div className="px-4 py-4 space-y-3">
                <input
                  type="text"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="原文"
                  className="w-full px-3 py-2 border border-[#E5E0DB] rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={newTranslation}
                  onChange={(e) => setNewTranslation(e.target.value)}
                  placeholder="翻译"
                  className="w-full px-3 py-2 border border-[#E5E0DB] rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-2 text-sm text-[#888888]"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAdd}
                    className="flex-1 py-2 bg-[#D94F00] text-white text-sm rounded-lg"
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 text-[#A8B5A0] text-sm font-medium"
              >
                <span className="text-lg">+</span>
                <span>添加常用语</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
