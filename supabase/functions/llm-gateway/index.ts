// Supabase Edge Function: llm-gateway
// Text translation via DashScope qwen-plus

import {
  DASHSCOPE,
  DASHSCOPE_API_KEY,
  LANG_MAP,
} from '../_shared/models.ts'

interface TranslateRequest {
  text: string
  sourceLang: string
  targetLang: string
}

async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const sourceName = LANG_MAP[sourceLang] || sourceLang
  const targetName = LANG_MAP[targetLang] || targetLang

  const systemPrompt =
    `You are a professional translator. Translate the following text from ${sourceName} to ${targetName}. Only output the translation, no explanations or quotes.`

  const response = await fetch(DASHSCOPE.text.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
    },
    body: JSON.stringify({
      model: DASHSCOPE.text.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()

  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content.trim()
  }

  throw new Error('Unexpected response format')
}

/** Exported for use by other functions (e.g. voice-translate fallback). */
export { translateText as translate }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as TranslateRequest
    const { text, sourceLang, targetLang } = body

    if (!text || !sourceLang || !targetLang) {
      return Response.json(
        { error: 'text, sourceLang and targetLang are required' },
        { status: 400, headers: corsHeaders },
      )
    }

    const translatedText = await translateText(text, sourceLang, targetLang)

    return Response.json(
      {
        success: true,
        originalText: text,
        translatedText,
        sourceLang,
        targetLang,
      },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error('LLM Gateway error:', error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Translation failed',
      },
      { status: 500, headers: corsHeaders },
    )
  }
})
