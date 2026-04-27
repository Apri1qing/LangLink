import type { LanguageCode, Phrase, PhraseTranslation } from '../types'
import { translateText, voiceTtsOnly } from './translation'
import { storeAudioBlob, getAudioBlob, deleteAudioForPhrase } from './phraseAudioCache'

const STORAGE_KEY = 'traveltalk_phrases'
export const MAX_PHRASES = 10

type DefaultPhraseSeed = Pick<Phrase, 'text' | 'source_lang'>

const DEFAULT_PHRASES: DefaultPhraseSeed[] = [
  { text: '多少钱', source_lang: 'zh' },
  { text: '地铁站在哪里', source_lang: 'zh' },
  { text: '可以刷卡吗', source_lang: 'zh' },
  { text: '这个是什么', source_lang: 'zh' },
  { text: '谢谢', source_lang: 'zh' },
  { text: '洗手间在哪里', source_lang: 'zh' },
]

function buildDefaults(): Phrase[] {
  const ts = new Date().toISOString()
  return DEFAULT_PHRASES.map((p, i) => ({
    id: i + 1,
    text: p.text,
    source_lang: p.source_lang,
    translations: {},
    usage_count: 0,
    created_at: ts,
    updated_at: ts,
  }))
}

interface LegacyPhrase {
  id: number
  text: string
  translation?: string
  source_lang: LanguageCode
  target_lang?: LanguageCode
  audio_url?: string
  usage_count?: number
  created_at?: string
  updated_at?: string
}

function isLegacy(p: unknown): p is LegacyPhrase {
  return !!p && typeof p === 'object' && 'translation' in p && !('translations' in p)
}

function migrateLegacyPhrase(p: LegacyPhrase): Phrase {
  const translations: Record<string, PhraseTranslation> = {}
  if (p.translation && p.target_lang) {
    translations[p.target_lang] = {
      translated: p.translation,
      ...(p.audio_url ? { audioUrl: p.audio_url } : {}),
    }
  }
  return {
    id: p.id,
    text: p.text,
    source_lang: p.source_lang,
    translations,
    usage_count: p.usage_count ?? 0,
    created_at: p.created_at ?? new Date().toISOString(),
    updated_at: p.updated_at ?? new Date().toISOString(),
  }
}

function getStoredPhrases(): Phrase[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as unknown[]
      const needsMigration = parsed.some(isLegacy)
      if (!needsMigration) return parsed as Phrase[]
      const migrated = parsed.map((p) => (isLegacy(p) ? migrateLegacyPhrase(p) : (p as Phrase)))
      savePhrases(migrated)
      return migrated
    }
  } catch {
    console.error('Failed to load phrases from storage')
  }
  const phrases = buildDefaults()
  savePhrases(phrases)
  return phrases
}

function savePhrases(phrases: Phrase[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(phrases))
  } catch {
    console.error('Failed to save phrases to storage')
  }
}

export function getPhrases(): Phrase[] {
  return getStoredPhrases()
}

export function addPhrase(text: string, sourceLang: LanguageCode): Phrase {
  const phrases = getStoredPhrases()
  if (phrases.length >= MAX_PHRASES) {
    throw new Error('常用语已达上限（10条）')
  }
  const ts = new Date().toISOString()
  const newPhrase: Phrase = {
    id: Date.now(),
    text,
    source_lang: sourceLang,
    translations: {},
    usage_count: 0,
    created_at: ts,
    updated_at: ts,
  }
  phrases.push(newPhrase)
  savePhrases(phrases)
  return newPhrase
}

export function deletePhrase(id: number): void {
  const phrases = getStoredPhrases()
  const filtered = phrases.filter((p) => p.id !== id)
  savePhrases(filtered)
  // Clean up cached audio for deleted phrase (fire-and-forget)
  void deleteAudioForPhrase(id)
}

export function incrementUsage(id: number): void {
  const phrases = getStoredPhrases()
  const phrase = phrases.find((p) => p.id === id)
  if (phrase) {
    phrase.usage_count++
    phrase.updated_at = new Date().toISOString()
    savePhrases(phrases)
  }
}

function setPhraseTranslation(id: number, targetLang: LanguageCode, cache: PhraseTranslation): void {
  const phrases = getStoredPhrases()
  const phrase = phrases.find((p) => p.id === id)
  if (!phrase) return
  phrase.translations[targetLang] = cache
  phrase.updated_at = new Date().toISOString()
  savePhrases(phrases)
}

/**
 * Get translation for a phrase at the given target language.
 * 1. Text: cached in localStorage, else calls LLM.
 * 2. Audio: cached as Blob in IndexedDB (pre-cached), else falls back to the
 *    TTS audioUrl stored in the text cache, else undefined (caller uses Web Speech).
 */
export async function translatePhrase(
  phrase: Phrase,
  targetLang: LanguageCode,
): Promise<PhraseTranslation> {
  // --- Text translation ---
  let translated = phrase.translations?.[targetLang]?.translated
  if (!translated) {
    translated = await translateText(phrase.text, phrase.source_lang, targetLang)
    const entry: PhraseTranslation = { translated }
    setPhraseTranslation(phrase.id, targetLang, entry)
  }

  incrementUsage(phrase.id)

  // --- Audio: try IndexedDB Blob first (pre-cached, never expires) ---
  const cachedBlob = await getAudioBlob(phrase.id, targetLang)
  if (cachedBlob) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(cachedBlob)
    })
    return { translated, audioUrl: dataUrl }
  }

  // --- Fallback: use stored audioUrl (may expire after 24h) ---
  const cachedAudioUrl = phrase.translations?.[targetLang]?.audioUrl
  return { translated, audioUrl: cachedAudioUrl }
}

/**
 * Retrieve cached audio Blob for a phrase+lang pair.
 * Returns null if not yet cached — caller should fall back to TTS or Web Speech.
 */
export { getAudioBlob as getPhraseAudioBlob }

/**
 * Pre-cache translations + TTS audio for all phrases in the given target language.
 * Runs in the background (fire-and-forget); skips phrases that are already cached.
 *
 * Call this when the user changes their language pair in Settings.
 */
export async function precachePhrasesFor(targetLang: LanguageCode): Promise<void> {
  const phrases = getPhrases()
  console.log(`[precache] Starting for ${phrases.length} phrases → ${targetLang}`)

  for (const phrase of phrases) {
    try {
      // 1. Ensure text translation is cached in localStorage
      let translated = phrase.translations?.[targetLang]?.translated
      if (!translated) {
        translated = await translateText(phrase.text, phrase.source_lang, targetLang)
        const entry: PhraseTranslation = { translated }
        setPhraseTranslation(phrase.id, targetLang, entry)
      }

      // 2. Ensure TTS audio is cached in IndexedDB (skip if already present)
      const existingBlob = await getAudioBlob(phrase.id, targetLang)
      if (existingBlob) {
        console.log(`[precache] Phrase ${phrase.id} "${phrase.text.slice(0, 20)}" already has audio`)
        continue
      }

      // 3. Call TTS and download the mp3 to a Blob
      const ttsResult = await voiceTtsOnly(translated, targetLang)
      const audioUrl = ttsResult.audioUrl
      if (!audioUrl) {
        console.warn(`[precache] No audioUrl for phrase ${phrase.id}`)
        continue
      }

      // Fetch the mp3 URL and store as Blob
      const resp = await fetch(audioUrl)
      if (!resp.ok) {
        console.warn(`[precache] Failed to download audio for phrase ${phrase.id}: ${resp.status}`)
        continue
      }
      const blob = await resp.blob()
      await storeAudioBlob(phrase.id, targetLang, blob)
      console.log(`[precache] Cached audio for phrase ${phrase.id} "${phrase.text.slice(0, 20)}" → ${targetLang}`)
    } catch (err) {
      // Non-fatal: log and continue with next phrase
      console.warn(`[precache] Failed for phrase ${phrase.id}:`, err)
    }
  }

  console.log(`[precache] Done for ${targetLang}`)
}
