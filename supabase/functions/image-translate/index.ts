// Image Translation using Aliyun qwen-vl-ocr + LLM
// OCR + Translation via qwen-vl-ocr, then LLM translation

const DASHSCOPE_API_KEY = Deno.env.get('DASHSCOPE_API_KEY')!
const OCR_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const LLM_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

interface ImageTranslateRequest {
  image: string // base64 encoded image
  sourceLang: string
  targetLang: string
}

// Language code mapping for OCR
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

// LLM Gateway for translation
interface LLMConfig {
  apiKey: string
  model: string
}

// Get LLM configs from environment - uses DASHSCOPE_API_KEY by default
function getLLMConfigs(): LLMConfig[] {
  const configs: LLMConfig[] = []

  // Check for user-configured LLM APIs first
  // LLM_API_1
  const api1 = Deno.env.get('LLM_API_1')
  const key1 = Deno.env.get('LLM_API_KEY_1')
  const model1 = Deno.env.get('LLM_MODEL_1')
  if (api1 && key1 && model1) {
    configs.push({ apiKey: key1, model: model1 })
  }

  // LLM_API_2
  const api2 = Deno.env.get('LLM_API_2')
  const key2 = Deno.env.get('LLM_API_KEY_2')
  const model2 = Deno.env.get('LLM_MODEL_2')
  if (api2 && key2 && model2) {
    configs.push({ apiKey: key2, model: model2 })
  }

  // Fallback to DASHSCOPE_API_KEY with qwen model if no custom APIs configured
  if (configs.length === 0) {
    configs.push({
      apiKey: DASHSCOPE_API_KEY,
      model: 'qwen-plus',
    })
  }

  return configs
}

// OCR using qwen-vl-ocr
async function ocrImage(imageBase64: string): Promise<string> {
  const response = await fetch(OCR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-vl-ocr-latest',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Please extract all text from this image. Return only the extracted text, preserving the layout as much as possible.',
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OCR error: ${response.status}`)
  }

  const data = await response.json()
  if (data.error) {
    throw new Error(`OCR error: ${data.error.message || 'Unknown error'}`)
  }

  // Extract text from response
  const extractedText = data.choices?.[0]?.message?.content
  if (!extractedText) {
    throw new Error('No text extracted from image')
  }

  return extractedText
}

// Translate text using LLM (round-robin)
let currentLLMIndex = 0

async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const configs = getLLMConfigs()
  if (configs.length === 0) {
    throw new Error('No LLM API configured')
  }

  const sourceLangName = langMap[sourceLang] || sourceLang
  const targetLangName = langMap[targetLang] || targetLang

  const startIndex = currentLLMIndex
  let lastError: Error | null = null

  for (let i = 0; i < configs.length; i++) {
    const idx = (startIndex + i) % configs.length
    const config = configs[idx]

    try {
      const response = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. Translate the following text from ${sourceLangName} to ${targetLangName}. Only return the translated text, no explanations.`,
            },
            {
              role: 'user',
              content: text,
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`LLM error: ${response.status}`)
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(`LLM error: ${data.error.message || 'Unknown error'}`)
      }

      const translatedText = data.choices?.[0]?.message?.content
      if (!translatedText) {
        throw new Error('No translation returned')
      }

      currentLLMIndex = idx
      return translatedText
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      console.error(`LLM ${config.model} failed:`, e)
    }
  }

  throw lastError || new Error('All LLM APIs failed')
}

// Deno serve handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { image, sourceLang, targetLang } = await req.json() as ImageTranslateRequest

    if (!image || !sourceLang || !targetLang) {
      return Response.json(
        { error: 'image, sourceLang, and targetLang are required' },
        { status: 400 }
      )
    }

    console.log(`Image translate: ${sourceLang} -> ${targetLang}`)

    // Step 1: OCR using qwen-vl-ocr
    let originalText = ''
    try {
      originalText = await ocrImage(image)
      console.log('OCR result:', originalText.substring(0, 100) + '...')
    } catch (ocrError) {
      console.error('OCR failed:', ocrError)
      return Response.json(
        { error: 'Failed to extract text from image. Please ensure the image is clear and contains readable text.' },
        { status: 422 }
      )
    }

    // Step 2: Translate using LLM
    let translatedText = ''
    try {
      translatedText = await translateText(originalText, sourceLang, targetLang)
      console.log('Translation result:', translatedText.substring(0, 100) + '...')
    } catch (translateError) {
      console.error('Translation failed:', translateError)
      return Response.json(
        { error: 'Failed to translate text. Please try again.' },
        { status: 422 }
      )
    }

    return Response.json({
      success: true,
      originalText,
      translatedText,
    })
  } catch (error) {
    console.error('Image translate error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
})
