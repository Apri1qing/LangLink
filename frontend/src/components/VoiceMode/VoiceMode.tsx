import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useVoiceTranslateContext } from '../../contexts/VoiceTranslateContext'
import { TopBar } from '../common/TopBar'
import { DualPill } from '../common/DualPill'
import { PhrasesWrap } from '../common/PhrasesWrap'
import { ConversationBubble } from './ConversationBubble'
import { getPhrases, translatePhrase } from '../../services/phrases'
import { recordTranslation, newSession } from '../../services/sessions'
import { SUPPORTED_LANGUAGES, type Phrase } from '../../types'
import { unlockAudioContext } from '../../services/audioUnlock'

export function VoiceMode() {
  const {
    messages,
    languagePair,
    setTranslationResult,
    isTranslating,
    originalText,
    translatedText,
  } = useAppStore()
  const {
    isLeftRecording,
    isRightRecording,
    startLeftRecording,
    startRightRecording,
    stopRecording,
  } = useVoiceTranslateContext()
  const isRecording = isLeftRecording || isRightRecording
  const [phrases, setPhrases] = useState<Phrase[]>([])

  useEffect(() => {
    setPhrases(getPhrases())
  }, [])

  const langName = (code: string) =>
    SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? code

  const handleLeftToggle = useCallback(() => {
    // 在用户手势同步上下文中解锁 AudioContext，便于后续自动播放
    unlockAudioContext()
    if (isLeftRecording) void stopRecording()
    else if (!isRecording) void startLeftRecording()
  }, [isLeftRecording, isRecording, startLeftRecording, stopRecording])

  const handleRightToggle = useCallback(() => {
    unlockAudioContext()
    if (isRightRecording) void stopRecording()
    else if (!isRecording) void startRightRecording()
  }, [isRightRecording, isRecording, startRightRecording, stopRecording])

  const handlePhraseClick = useCallback(
    async (phrase: Phrase) => {
      unlockAudioContext()
      try {
        const { translated, audioUrl } = await translatePhrase(phrase, languagePair.B)
        setTranslationResult(
          phrase.text,
          translated,
          'phrase',
          audioUrl ?? null,
          phrase.source_lang,
          languagePair.B,
        )
        recordTranslation({
          type: 'phrase',
          originalText: phrase.text,
          translatedText: translated,
          sourceLang: phrase.source_lang,
          targetLang: languagePair.B,
          audioUrl: audioUrl ?? null,
        })
      } catch (err) {
        console.error('Phrase translate error:', err)
      }
    },
    [languagePair.B, setTranslationResult],
  )

  // 录音中或翻译中：在历史气泡之后渲染一个"活跃气泡"，实时反映 originalText/translatedText
  const showActiveBubble = isRecording || isTranslating

  return (
    <div className="flex flex-col h-full bg-[#F2EDE8]">
      <TopBar />

      {/* 聊天区填充剩余空间 */}
      <div className="relative flex-1 min-h-0 px-4 py-4 overflow-y-auto">
        {messages.length === 0 && !showActiveBubble ? (
          <div className="flex flex-col items-center justify-center h-full text-[#AAAAAA]">
            <p className="text-sm">点击下方按钮开始对话</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <ConversationBubble key={message.id} message={message} />
            ))}
            {showActiveBubble && (
              <div className="flex justify-end">
                <div className="bg-[#1A1A1A] text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%]">
                  {originalText ? (
                    <>
                      <p className="text-xs opacity-70">{originalText}</p>
                      <p className="text-sm font-medium mt-1">
                        {translatedText || '翻译中…'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm opacity-70 animate-pulse">识别中…</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {messages.length > 0 && (
          <button
            type="button"
            aria-label="新对话"
            onClick={newSession}
            className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-[#1A1A1A] text-white text-xl flex items-center justify-center shadow-lg active:scale-95"
          >
            ＋
          </button>
        )}
      </div>

      {/* 双 pill */}
      <div className="py-2">
        <DualPill
          leftLabel={langName(languagePair.B)}
          rightLabel={langName(languagePair.A)}
          isLeftRecording={isLeftRecording}
          isRightRecording={isRightRecording}
          onLeftToggle={handleLeftToggle}
          onRightToggle={handleRightToggle}
        />
      </div>

      {/* 常用语 */}
      <div className="px-4 pb-6">
        <PhrasesWrap phrases={phrases} onPhraseClick={handlePhraseClick} />
      </div>
    </div>
  )
}
