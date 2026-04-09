// Translation API service
// Handles translation requests with caching

import { supabase } from './supabase'
import type { ApiResponse, VoiceTranslateResponse, ImageTranslateResponse } from '../types'

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL

// Generate cache key
function getCacheKey(text: string, sourceLang: string, targetLang: string): string {
  return `${sourceLang}:${targetLang}:${text.slice(0, 100)}`
}

// Check cache first
export async function getCachedTranslation(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  const cacheKey = getCacheKey(text, sourceLang, targetLang)

  const { data, error } = await supabase
    .from('translations_cache')
    .select('translated_text')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) {
    return null
  }

  return data.translated_text
}

// Save to cache
async function saveToCache(
  text: string,
  sourceLang: string,
  targetLang: string,
  translatedText: string
): Promise<void> {
  const cacheKey = getCacheKey(text, sourceLang, targetLang)

  await supabase.from('translations_cache').insert({
    source_lang: sourceLang,
    target_lang: targetLang,
    source_text: text.slice(0, 1000),
    translated_text: translatedText.slice(0, 1000),
    cache_key: cacheKey,
  })
}

// Call LLM Gateway
async function callLLMGateway(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (!FUNCTIONS_URL) {
    throw new Error('LLM Gateway not configured')
  }

  const response = await fetch(`${FUNCTIONS_URL}/llm-gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
    },
    body: JSON.stringify({
      text,
      sourceLang,
      targetLang,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Translation failed')
  }

  const data = await response.json()
  return data.translatedText
}

// Main translation function
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  // Try cache first
  const cached = await getCachedTranslation(text, sourceLang, targetLang)
  if (cached) {
    return cached
  }

  // Call LLM Gateway
  const translated = await callLLMGateway(text, sourceLang, targetLang)

  // Save to cache (don't await)
  saveToCache(text, sourceLang, targetLang, translated).catch(console.error)

  return translated
}

// Voice translation API
export async function voiceTranslate(
  audioBase64: string,
  sourceLang: string,
  targetLang: string,
  format: string
): Promise<VoiceTranslateResponse> {
  if (!FUNCTIONS_URL) {
    throw new Error('Edge Functions not configured')
  }

  const response = await fetch(`${FUNCTIONS_URL}/voice-translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
    },
    body: JSON.stringify({
      audio: audioBase64,
      sourceLang,
      targetLang,
      format,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Voice translation failed')
  }

  const data = await response.json()
  return data
}

// Image translation API
export async function imageTranslate(
  imageFile: File,
  sourceLang: string,
  targetLang: string
): Promise<ImageTranslateResponse> {
  if (!FUNCTIONS_URL) {
    throw new Error('Edge Functions not configured')
  }

  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('sourceLang', sourceLang)
  formData.append('targetLang', targetLang)

  const response = await fetch(`${FUNCTIONS_URL}/image-translate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Image translation failed')
  }

  const data = await response.json()
  return data
}
