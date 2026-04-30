import { useCallback, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useVoiceTranslateContext } from '../../contexts/useVoiceTranslateContext'
import { imageTranslate } from '../../services/translation'
import { TopBar } from '../common/TopBar'
import { Viewfinder } from '../common/Viewfinder'
import { DualPill } from '../common/DualPill'
import { PhrasesWrap } from '../common/PhrasesWrap'
import { CameraCapture } from '../common/CameraCapture'
import { PhotoOverlay } from '../common/PhotoOverlay'
import { TranslationSheet } from '../common/TranslationSheet'
import { getPhrases, translatePhrase } from '../../services/phrases'
import { recordTranslation } from '../../services/sessions'
import { unlockAudioContext, playAudioUrl } from '../../services/audioUnlock'
import { speakText } from '../../hooks/useVoice'
import { SUPPORTED_LANGUAGES, type Phrase } from '../../types'

export function Home() {
  const {
    languagePair,
    capturedImage,
    ocrRegions,
    showTranslatedOverlay,
    setCapturedImage,
    setOcrRegions,
    setShowTranslatedOverlay,
    clearCapturedPhoto,
    setTranslationResult,
    clearTranslationResult,
    originalText,
    translatedText,
    translationAudioUrl,
    translationType,
    translationError,
    isTranslating,
    lastSourceLang,
    lastTargetLang,
  } = useAppStore()
  const {
    isLeftRecording,
    isRightRecording,
    startLeftRecording,
    startRightRecording,
    stopRecording,
  } = useVoiceTranslateContext()
  const isRecording = isLeftRecording || isRightRecording
  const [showCamera, setShowCamera] = useState(false)
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  const [phrases] = useState<Phrase[]>(() => getPhrases())

  const langName = useCallback(
    (code: string) => SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? code,
    [],
  )

  const leftLabel = langName(languagePair.B) // 外语：点左 pill 说外语
  const rightLabel = langName(languagePair.A) // 母语：点右 pill 说母语

  const handleTakePhoto = () => setShowCamera(true)
  const handleCloseCamera = () => setShowCamera(false)

  const handleCapturePhoto = async (imageData: string) => {
    setShowCamera(false)
    setCapturedImage(imageData)
    setOcrRegions([])
    setShowTranslatedOverlay(true)
    setIsOcrLoading(true)
    try {
      // sourceLang 传 'auto' 仅为兼容，qwen-vl-ocr advanced_recognition 自动识别多语种
      const result = await imageTranslate(imageData, 'auto', languagePair.A, {
        nativeLang: languagePair.A,
        foreignLang: languagePair.B,
      })
      if (result.regions && result.regions.length > 0) {
        setOcrRegions(result.regions)
      }
      recordTranslation({
        type: 'photo',
        originalText: result.originalText,
        translatedText: result.translatedText,
        sourceLang: languagePair.B, // 拍照方向：外→母；source 语言未知时标为外语
        targetLang: languagePair.A,
        imageDataUrl: imageData,
      })
    } catch (err) {
      console.error('Image translate error:', err)
    } finally {
      setIsOcrLoading(false)
    }
  }

  const handlePhraseClick = useCallback(
    async (phrase: Phrase) => {
      // 用户手势同步上下文中解锁 AudioContext，便于后续自动播放绕过 iOS 限制
      unlockAudioContext()
      try {
        const { translated, audioUrl } = await translatePhrase(phrase, languagePair.B)
        setTranslationResult(phrase.text, translated, 'phrase', audioUrl ?? null, phrase.source_lang, languagePair.B)
        // 直接播放 — AudioContext 已在 unlockAudioContext() 手势中解锁，可绕过 iOS 自动播放限制
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

  const handleLeftToggle = useCallback(() => {
    unlockAudioContext()
    if (isLeftRecording) {
      void stopRecording()
    } else if (!isRecording) {
      void startLeftRecording()
    }
  }, [isLeftRecording, isRecording, startLeftRecording, stopRecording])

  const handleRightToggle = useCallback(() => {
    unlockAudioContext()
    if (isRightRecording) {
      void stopRecording()
    } else if (!isRecording) {
      void startRightRecording()
    }
  }, [isRightRecording, isRecording, startRightRecording, stopRecording])

  const hasVoiceResult = !!originalText && (translationType === 'voice' || translationType === 'phrase')
  const showSheet = isTranslating || !!translationError || hasVoiceResult

  // 翻译方向：正在录音时依赖 pill side；收到结果后依赖 lastSourceLang/lastTargetLang
  const activeSource = isLeftRecording
    ? languagePair.B
    : isRightRecording
      ? languagePair.A
      : lastSourceLang ?? languagePair.A
  const activeTarget = isLeftRecording
    ? languagePair.A
    : isRightRecording
      ? languagePair.B
      : lastTargetLang ?? languagePair.B

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F2EDE8]">
      <TopBar />

      {/* Viewfinder / PhotoOverlay / CameraCapture */}
      <div className="min-h-0 flex-1 px-4 py-2">
        <div className="w-full h-full">
          {showCamera ? (
            <CameraCapture onCapture={handleCapturePhoto} onClose={handleCloseCamera} />
          ) : capturedImage ? (
            <PhotoOverlay
              imageDataUrl={capturedImage}
              regions={ocrRegions}
              showTranslated={showTranslatedOverlay}
              isLoading={isOcrLoading}
              onToggle={() => setShowTranslatedOverlay(!showTranslatedOverlay)}
              onDelete={clearCapturedPhoto}
            />
          ) : (
            <Viewfinder onClick={handleTakePhoto} />
          )}
        </div>
      </div>

      {/* 双 pill（按下说话） */}
      <div className="shrink-0 py-2">
        <DualPill
          leftLabel={leftLabel}
          rightLabel={rightLabel}
          isLeftRecording={isLeftRecording}
          isRightRecording={isRightRecording}
          onLeftToggle={handleLeftToggle}
          onRightToggle={handleRightToggle}
        />
      </div>

      {/* 常用语 */}
      <div className="shrink-0 px-4 pb-3">
        <PhrasesWrap phrases={phrases} onPhraseClick={handlePhraseClick} />
      </div>

      {/* 语音翻译底卡：仅在相机模式下 pill 录音 / 点 phrase 后显示 */}
      {showSheet && (
        <TranslationSheet
          originalText={originalText}
          translatedText={translatedText}
          audioUrl={translationAudioUrl}
          sourceLangName={langName(activeSource)}
          targetLangName={langName(activeTarget)}
          targetLang={activeTarget}
          onClose={clearTranslationResult}
        />
      )}
    </div>
  )
}
