import { useEffect, useState } from 'react'
import { SubPageTopBar } from '../common/SubPageTopBar'
import { useAppStore } from '../../stores/appStore'
import { SUPPORTED_LANGUAGES, type LanguageCode, type Phrase } from '../../types'
import { getPhrases, addPhrase, deletePhrase, precachePhrasesFor } from '../../services/phrases'

const MAX_PHRASES = 10

export function Settings() {
  const pair = useAppStore((s) => s.languagePair)
  const setLanguagePair = useAppStore((s) => s.setLanguagePair)

  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newText, setNewText] = useState('')

  useEffect(() => {
    setPhrases(getPhrases())
  }, [])

  const handleAdd = () => {
    const text = newText.trim()
    if (!text) return
    addPhrase(text, pair.A)
    setPhrases(getPhrases())
    setNewText('')
    setShowAddForm(false)
  }

  const handleDelete = (id: number) => {
    deletePhrase(id)
    setPhrases(getPhrases())
  }

  const handlePairChange = (key: 'A' | 'B', value: LanguageCode) => {
    const newPair = { ...pair, [key]: value }
    setLanguagePair(newPair)
    // 后台预缓存：新外语（B）的译文 + TTS 音频
    void precachePhrasesFor(newPair.B)
  }

  const atLimit = phrases.length >= MAX_PHRASES

  return (
    <div className="flex flex-col h-full bg-[#F2EDE8]">
      <SubPageTopBar title="设置" />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-8">
        {/* 互译语言 */}
        <section>
          <h3 className="text-xs font-semibold text-[#6B6B6B] tracking-wider mb-3 uppercase">
            互译语言
          </h3>
          <div className="bg-white rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <select
                aria-label="外语"
                value={pair.B}
                onChange={(e) => handlePairChange('B', e.target.value as LanguageCode)}
                className="flex-1 px-3 py-2 border border-[#D8D2CA] rounded-lg text-sm bg-white text-[#1A1A1A]"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
              <span className="text-[#6B6B6B] text-lg" aria-hidden>↔</span>
              <select
                aria-label="母语"
                value={pair.A}
                onChange={(e) => handlePairChange('A', e.target.value as LanguageCode)}
                className="flex-1 px-3 py-2 border border-[#D8D2CA] rounded-lg text-sm bg-white text-[#1A1A1A]"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 常用语管理 */}
        <section>
          <h3 className="text-xs font-semibold text-[#6B6B6B] tracking-wider mb-3 uppercase">
            常用语管理
          </h3>
          <div className="bg-white rounded-2xl overflow-hidden">
            {phrases.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#AAAAAA] text-sm">
                暂无常用语
              </div>
            ) : (
              phrases.map((phrase, index) => (
                <div key={phrase.id}>
                  <div className="flex items-center justify-between px-4 py-4">
                    <p className="flex-1 text-sm text-[#1A1A1A] truncate">{phrase.text}</p>
                    <button
                      type="button"
                      aria-label={`删除 ${phrase.text}`}
                      onClick={() => handleDelete(phrase.id)}
                      className="w-11 h-11 flex items-center justify-center text-[#D94F00] text-lg font-bold active:scale-95"
                    >
                      −
                    </button>
                  </div>
                  {index < phrases.length - 1 && (
                    <div className="h-px bg-[#D8D2CA] mx-4" />
                  )}
                </div>
              ))
            )}

            {atLimit ? (
              <div className="px-4 py-4 text-center text-xs text-[#AAAAAA] border-t border-[#D8D2CA]">
                已达上限（10条）
              </div>
            ) : showAddForm ? (
              <div className="px-4 py-4 space-y-3 border-t border-[#D8D2CA]">
                <input
                  type="text"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="输入常用语原文"
                  className="w-full px-3 py-2 border border-[#D8D2CA] rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setNewText('')
                    }}
                    className="flex-1 py-2 text-sm text-[#6B6B6B] active:scale-95"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="flex-1 py-2 bg-[#1A1A1A] text-white text-sm rounded-lg active:scale-95"
                  >
                    添加
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 text-[#1A1A1A] text-sm font-medium border-t border-[#D8D2CA] active:scale-95"
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
