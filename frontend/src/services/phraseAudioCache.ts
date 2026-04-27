/**
 * phraseAudioCache.ts
 *
 * Dexie (IndexedDB) storage for phrase TTS audio blobs.
 * Avoids 5 MB localStorage limit when caching base64 audio.
 *
 * Schema: phrase_audio { id (auto), phraseId, lang, blob, cachedAt }
 */

import Dexie, { type Table } from 'dexie'

export interface PhraseAudioEntry {
  id?: number
  phraseId: number
  lang: string
  /** Audio blob — mp3 bytes downloaded from TTS URL */
  blob: Blob
  cachedAt: number
}

class PhraseAudioDB extends Dexie {
  phrase_audio!: Table<PhraseAudioEntry, number>

  constructor() {
    super('traveltalk-phrase-audio')
    this.version(1).stores({
      phrase_audio: '++id, [phraseId+lang], cachedAt',
    })
  }
}

const db = new PhraseAudioDB()

/** Store a Blob for a phrase+lang pair. Overwrites existing entry. */
export async function storeAudioBlob(phraseId: number, lang: string, blob: Blob): Promise<void> {
  // Delete existing entry first
  await db.phrase_audio.where('[phraseId+lang]').equals([phraseId, lang]).delete()
  await db.phrase_audio.add({ phraseId, lang, blob, cachedAt: Date.now() })
}

/** Retrieve a Blob for a phrase+lang pair, or null if not cached. */
export async function getAudioBlob(phraseId: number, lang: string): Promise<Blob | null> {
  const entry = await db.phrase_audio
    .where('[phraseId+lang]')
    .equals([phraseId, lang])
    .first()
  return entry?.blob ?? null
}

/** Get a data URL for a phrase+lang pair (for Audio src), or null if not cached. */
export async function getAudioDataUrl(phraseId: number, lang: string): Promise<string | null> {
  const blob = await getAudioBlob(phraseId, lang)
  if (!blob) return null
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Delete all entries for a phrase (called on deletePhrase). */
export async function deleteAudioForPhrase(phraseId: number): Promise<void> {
  await db.phrase_audio.where('phraseId').equals(phraseId).delete()
}

/** Evict entries older than 7 days to prevent unbounded growth. */
export async function evictStaleAudio(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - maxAgeMs
  await db.phrase_audio.where('cachedAt').below(cutoff).delete()
}
