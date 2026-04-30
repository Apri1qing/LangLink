import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useVoiceTranslateContext } from '../../contexts/useVoiceTranslateContext'
import { TopBar } from '../common/TopBar'
import { DualPill } from '../common/DualPill'
import { PhrasesWrap } from '../common/PhrasesWrap'
import { ConversationBubble } from './ConversationBubble'
import { getPhrases, translatePhrase } from '../../services/phrases'
import { recordTranslation, newSession } from '../../services/sessions'
import { SUPPORTED_LANGUAGES, type Phrase } from '../../types'
import { unlockAudioContext, playAudioUrl } from '../../services/audioUnlock'
import { speakText } from '../../hooks/useVoice'
import { Plus } from 'lucide-react'

export function VoiceMode() {
  const {
    messages,
    languagePair,
    setTranslationResult,
    isTranslating,
    voiceCapturing,
    voiceStreaming,
    originalText,
    translatedText,
  } = useAppStore()
  const {
    isLeftRecording,
    isRightRecording,
    recordingSide,
    startLeftRecording,
    startRightRecording,
    stopRecording,
  } = useVoiceTranslateContext()
  const isRecording = isLeftRecording || isRightRecording
  const scrollRef = useRef<HTMLDivElement>(null)
  const [phrases] = useState<Phrase[]>(() => getPhrases())

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
        // 直接播放 — AudioContext 已在 unlockAudioContext() 手势中解锁
        if (audioUrl) {
          void playAudioUrl(audioUrl)
        } else {
          speakText(translated, languagePair.B)
        }
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
  const showActiveBubble = isRecording || isTranslating || voiceCapturing || voiceStreaming
  const activeBubbleIsUser = recordingSide === 'right'

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, showActiveBubble, originalText, translatedText])

  const activeBubble = (
    <div className={`flex ${activeBubbleIsUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 ${
          activeBubbleIsUser
            ? 'rounded-br-sm bg-[#1A1A1A] text-white'
            : 'rounded-bl-sm bg-[#F0EDE8] text-[#2D2D2D]'
        }`}
      >
        {originalText ? (
          <>
            <p className={`text-xs ${activeBubbleIsUser ? 'text-white/65' : 'text-[#888888]'}`}>
              原文：{originalText}
            </p>
            <p className="text-sm font-medium mt-1 whitespace-pre-wrap">
              {translatedText || '翻译中...'}
            </p>
          </>
        ) : (
          <p className="text-sm opacity-70 animate-pulse">识别中...</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F2EDE8]">
      <TopBar />

      {/* 聊天区 — 白色圆角框，与相机取景框对应 */}
      <div className="min-h-0 flex-1 px-4 py-2">
        <div className="relative w-full h-full bg-white rounded-2xl overflow-hidden">
          <div
            ref={scrollRef}
            className={`h-full overflow-y-auto px-4 pt-4 scrollbar-hide ${
              messages.length > 0 ? 'pb-20' : 'pb-4'
            }`}
          >
            {messages.length === 0 && !showActiveBubble ? (
              <div className="flex flex-col items-center justify-center h-full text-[#AAAAAA]">
                <p className="text-sm">点击下方按钮开始对话</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <ConversationBubble key={message.id} message={message} />
                ))}
                {showActiveBubble && activeBubble}
              </div>
            )}
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              aria-label="新对话"
              onClick={newSession}
              className="absolute bottom-3 right-3 w-12 h-12 rounded-full glass-control-dark text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus size={25} strokeWidth={2.4} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* 双 pill */}
      <div className="shrink-0 py-1.5">
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
      <div
        className="shrink-0 px-4 pt-1"
        style={{ paddingBottom: 'max(0.5rem, min(env(safe-area-inset-bottom), 0.75rem))' }}
      >
        <PhrasesWrap phrases={phrases} onPhraseClick={handlePhraseClick} />
      </div>
    </div>
  )
}
