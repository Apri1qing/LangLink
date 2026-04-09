// Supabase Edge Function: voice-translate
// Voice translation: ASR → LLM → TTS

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')!

// Aliyun ASR configuration
const ASR_ENDPOINT = Deno.env.get('ALIYUN_ASR_ENDPOINT')!
const ASR_APPKEY = Deno.env.get('ALIYUN_ASR_APPKEY')!
const ASR_ACCESS_KEY_ID = Deno.env.get('ALIYUN_ASR_ACCESS_KEY_ID')!
const ASR_ACCESS_KEY_SECRET = Deno.env.get('ALIYUN_ASR_ACCESS_KEY_SECRET')!

// Aliyun TTS configuration
const TTS_ENDPOINT = Deno.env.get('ALIYUN_TTS_ENDPOINT')!
const TTS_APPKEY = Deno.env.get('ALIYUN_TTS_APPKEY')!
const TTS_ACCESS_KEY_ID = Deno.env.get('ALIYUN_TTS_ACCESS_KEY_ID')!
const TTS_ACCESS_KEY_SECRET = Deno.env.get('ALIYUN_TTS_ACCESS_KEY_SECRET')!

// LLM Gateway URL (same project)
const LLM_GATEWAY_URL = `${SUPABASE_URL}/functions/v1/llm-gateway`

interface TranslateRequest {
  audio: string // base64 encoded audio
  sourceLang: string
  targetLang: string
  format?: string
}

// Generate Aliyun signature
async function generateAliyunSignature(
  accessKeySecret: string,
  parameters: Record<string, string>
): Promise<string> {
  const sortedParams = Object.keys(parameters).sort()
  const stringToSign = sortedParams
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(parameters[key])}`)
    .join('&')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(accessKeySecret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(stringToSign)
  )

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

// Speech Recognition (ASR) using Aliyun
async function speechToText(audioBase64: string): Promise<string> {
  const appKey = ASR_APPKEY
  const format = 'opu' // Required format for Aliyun ASR

  const response = await fetch(`${ASR_ENDPOINT}/stream?q=asr&format=${format}&appkey=${appKey}&lang=zh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/' + format,
      'Authorization': `Authorization`,
    },
    body: Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0)),
  })

  if (!response.ok) {
    throw new Error(`ASR failed: ${response.status}`)
  }

  const text = await response.text()
  return text
}

// Text-to-Speech (TTS) using Aliyun
async function textToSpeech(text: string, lang: string): Promise<Uint8Array> {
  const voiceMap: Record<string, string> = {
    'zh': 'xiaoyun',
    'ja': 'aiqi',
    'en': 'xiaoyu',
    'ko': 'aiyuxin',
  }

  const voice = voiceMap[lang] || 'xiaoyun'

  const params = new URLSearchParams({
    appkey: TTS_APPKEY,
    text,
    voice,
    format: 'mp3',
  })

  const signature = await generateAliyunSignature(TTS_ACCESS_KEY_SECRET, {
    appkey: TTS_APPKEY,
    text,
    voice,
    format: 'mp3',
  })

  const response = await fetch(`${TTS_ENDPOINT}?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Authorization': `HmacSHA1 AccessKeyId=${TTS_ACCESS_KEY_ID}, Signature=${signature}`,
    },
  })

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

// Translate text using LLM Gateway
async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const response = await fetch(LLM_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      text,
      sourceLang,
      targetLang,
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM translation failed: ${response.status}`)
  }

  const data = await response.json()
  return data.translatedText
}

// Deno serve handler
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { audio, sourceLang, targetLang } = await req.json() as TranslateRequest

    if (!audio || !sourceLang || !targetLang) {
      return Response.json(
        { error: 'audio, sourceLang, and targetLang are required' },
        { status: 400 }
      )
    }

    console.log(`Processing voice translation: ${sourceLang} -> ${targetLang}`)

    // Step 1: ASR - Speech to Text
    let originalText: string
    try {
      originalText = await speechToText(audio)
    } catch (asrError) {
      console.error('ASR failed:', asrError)
      // Fallback: return error since ASR is required
      return Response.json(
        { error: 'Speech recognition failed. Please speak clearly and try again.' },
        { status: 422 }
      )
    }

    // Step 2: LLM - Translate
    let translatedText: string
    try {
      translatedText = await translateText(originalText, sourceLang, targetLang)
    } catch (llmError) {
      console.error('LLM translation failed:', llmError)
      return Response.json(
        { error: 'Translation failed. Please try again.' },
        { status: 500 }
      )
    }

    // Step 3: TTS - Text to Speech (optional, for target language)
    let audioUrl: string | undefined
    try {
      const ttsAudio = await textToSpeech(translatedText, targetLang)

      // Upload to Supabase Storage
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      const fileName = `voice_${Date.now()}.mp3`

      const { data, error } = await supabase.storage
        .from('translations')
        .upload(fileName, ttsAudio, {
          contentType: 'audio/mp3',
        })

      if (error) {
        console.error('Storage upload failed:', error)
      } else {
        const { data: urlData } = supabase.storage
          .from('translations')
          .getPublicUrl(fileName)
        audioUrl = urlData.publicUrl
      }
    } catch (ttsError) {
      console.warn('TTS failed, continuing without audio:', ttsError)
      // TTS is optional, continue without audio
    }

    return Response.json({
      success: true,
      originalText,
      translatedText,
      audioUrl,
      sourceLang,
      targetLang,
    })
  } catch (error) {
    console.error('Voice translate error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
})
