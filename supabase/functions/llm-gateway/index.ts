// Supabase Edge Function: llm-gateway
// Multi-API load balancer for LLM translation

const API_CONFIGS = [
  {
    name: 'api-1',
    endpoint: Deno.env.get('LLM_API_1') || '',
    apiKey: Deno.env.get('LLM_API_KEY_1') || '',
    model: Deno.env.get('LLM_MODEL_1') || 'gpt-4o',
  },
  {
    name: 'api-2',
    endpoint: Deno.env.get('LLM_API_2') || '',
    apiKey: Deno.env.get('LLM_API_KEY_2') || '',
    model: Deno.env.get('LLM_MODEL_2') || 'gpt-4o',
  },
].filter(config => config.endpoint && config.apiKey)

interface TranslateRequest {
  text: string
  sourceLang: string
  targetLang: string
}

let currentIndex = 0

async function translateWithAPI(
  config: typeof API_CONFIGS[0],
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const langMap: Record<string, string> = {
    'zh': 'Chinese',
    'ja': 'Japanese',
    'en': 'English',
    'ko': 'Korean',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'id': 'Indonesian',
    'ms': 'Malay',
    'tl': 'Filipino',
  }

  const sourceName = langMap[sourceLang] || sourceLang
  const targetName = langMap[targetLang] || targetLang

  const systemPrompt = `You are a professional translator. Translate the following text from ${sourceName} to ${targetName}. Only output the translation, no explanations or quotes.`

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
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

  // OpenAI format
  if (data.choices && data.choices[0]?.message?.content) {
    return data.choices[0].message.content.trim()
  }

  // Anthropic format
  if (data.content && data.content[0]?.text) {
    return data.content[0].text.trim()
  }

  throw new Error('Unexpected response format')
}

export async function translate(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (API_CONFIGS.length === 0) {
    throw new Error('No LLM API configured')
  }

  const startIndex = currentIndex

  for (let i = 0; i < API_CONFIGS.length; i++) {
    const index = (startIndex + i) % API_CONFIGS.length
    const config = API_CONFIGS[index]

    try {
      const result = await translateWithAPI(config, text, sourceLang, targetLang)
      currentIndex = index // Success, use this API next time
      return result
    } catch (error) {
      console.error(`LLM API ${config.name} failed:`, error)
    }
  }

  throw new Error('All LLM APIs failed')
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
    const { text, sourceLang, targetLang } = await req.json()

    if (!text || !sourceLang || !targetLang) {
      return Response.json(
        { error: 'text, sourceLang, and targetLang are required' },
        { status: 400 }
      )
    }

    const translatedText = await translate(text, sourceLang, targetLang)

    return Response.json({
      success: true,
      originalText: text,
      translatedText,
      sourceLang,
      targetLang,
    })
  } catch (error) {
    console.error('LLM Gateway error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Translation failed' },
      { status: 500 }
    )
  }
})
