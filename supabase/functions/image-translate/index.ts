// Image Translation: qwen-vl-ocr advanced_recognition → per-region translations
// v1.5: uses _shared/models.ts; adds diagnostic logging for OCR + translate.

import {
  DASHSCOPE,
  DASHSCOPE_API_KEY,
  LANG_MAP,
} from '../_shared/models.ts'

interface ImageTranslateRequest {
  image: string // base64 encoded image (data URL prefix stripped by caller)
  sourceLang?: string
  targetLang: string
}

interface OcrWord {
  text: string
  location: number[] // [x1,y1, x2,y2, x3,y3, x4,y4]
}

interface OcrRegion {
  originalText: string
  translatedText: string
  location: number[]
}

/**
 * OCR with bounding boxes via qwen-vl-ocr advanced_recognition task.
 */
async function ocrWithBboxes(imageBase64: string): Promise<OcrWord[]> {
  console.log(
    '[OCR] Sending request, image length:',
    imageBase64.length,
    'prefix:',
    imageBase64.substring(0, 60),
  )

  const response = await fetch(DASHSCOPE.ocr.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DASHSCOPE.ocr.model,
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { image: `data:image/jpeg;base64,${imageBase64}` },
              { text: 'Read all texts in the image.' },
            ],
          },
        ],
      },
      parameters: {
        ocr_options: { task: DASHSCOPE.ocr.task },
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[OCR] HTTP error:', response.status, errText.slice(0, 300))
    throw new Error(`OCR HTTP ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = await response.json()
  if (data.code || data.message) {
    console.error('[OCR] API error:', data.code, data.message)
    throw new Error(`OCR error: ${data.message || data.code}`)
  }

  const choices = data?.output?.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('OCR: no choices in response')
  }

  const content = choices[0]?.message?.content
  let contentText = ''
  if (typeof content === 'string') {
    contentText = content
  } else if (Array.isArray(content)) {
    for (const c of content) {
      if (typeof c?.text === 'string') {
        contentText = c.text
        break
      }
    }
  }

  if (!contentText) {
    throw new Error('OCR: empty content')
  }

  console.log('[OCR] Raw content (first 500):', contentText.substring(0, 500))

  // Try parsing JSON; fallback to plain text if it fails.
  let parsed: { words_info?: unknown } | null = null
  try {
    const jsonStart = contentText.indexOf('{')
    const jsonEnd = contentText.lastIndexOf('}')
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      parsed = JSON.parse(contentText.slice(jsonStart, jsonEnd + 1)) as {
        words_info?: unknown
      }
    }
  } catch (_e) {
    parsed = null
  }

  const rawWords = parsed?.words_info
  if (Array.isArray(rawWords) && rawWords.length > 0) {
    const out: OcrWord[] = []
    for (const w of rawWords as Array<Record<string, unknown>>) {
      const text = typeof w.text === 'string' ? w.text : ''
      const loc = w.location
      if (
        text &&
        Array.isArray(loc) &&
        loc.length === 8 &&
        loc.every((n) => typeof n === 'number')
      ) {
        out.push({ text, location: loc as number[] })
      }
    }
    if (out.length > 0) {
      console.log('[OCR] Parsed', out.length, 'words with bboxes')
      return out
    }
  }

  // Plain text fallback: split by lines, placeholder coordinates
  const fallbackText = contentText.trim()
  if (!fallbackText) throw new Error('OCR: no text extracted')
  console.log('[OCR] Fallback: plain text, no bboxes')
  return [{ text: fallbackText, location: [0, 0, 1, 0, 1, 1, 0, 1] }]
}

/**
 * Batch translate an array of texts in one LLM call.
 */
async function batchTranslate(
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  if (texts.length === 0) return []

  const targetLangName = LANG_MAP[targetLang] || targetLang
  const systemPrompt =
    `You are a professional translator. Translate each of the following texts to ${targetLangName}. ` +
    `Reply ONLY with a JSON array of strings in the same order and length. No explanations, no code fences.`
  const userPayload = JSON.stringify(texts)

  console.log(
    '[Translate] Batch translating',
    texts.length,
    'texts to',
    targetLangName,
  )
  console.log('[Translate] Input texts:', userPayload.substring(0, 300))

  const response = await fetch(DASHSCOPE.text.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DASHSCOPE.text.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPayload },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[Translate] HTTP error:', response.status, errText.slice(0, 300))
    throw new Error(`LLM HTTP ${response.status}`)
  }

  const data = await response.json()
  if (data.error) {
    console.error('[Translate] API error:', data.error)
    throw new Error(`LLM error: ${data.error.message ?? 'unknown'}`)
  }

  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('LLM: empty content')

  console.log('[Translate] Raw LLM content (first 500):', content.substring(0, 500))

  const jsonStart = content.indexOf('[')
  const jsonEnd = content.lastIndexOf(']')
  if (jsonStart < 0 || jsonEnd <= jsonStart)
    throw new Error('LLM: no JSON array in response')
  const arr = JSON.parse(content.slice(jsonStart, jsonEnd + 1))
  if (!Array.isArray(arr) || arr.length !== texts.length) {
    throw new Error(
      `LLM: array length mismatch (got ${Array.isArray(arr) ? arr.length : 'non-array'}, want ${texts.length})`,
    )
  }
  return arr.map((s) => (typeof s === 'string' ? s : String(s)))
}

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
    const body = (await req.json()) as ImageTranslateRequest
    const { image, targetLang } = body
    if (!image || !targetLang) {
      return Response.json(
        { error: 'image and targetLang are required' },
        { status: 400, headers: corsHeaders },
      )
    }

    console.log(`[FN] image-translate → ${targetLang}`)

    let words: OcrWord[] = []
    try {
      words = await ocrWithBboxes(image)
      console.log(`[FN] OCR: ${words.length} regions`)
    } catch (e) {
      console.error('[FN] OCR failed:', e)
      return Response.json(
        { error: 'Failed to extract text from image.' },
        { status: 422, headers: corsHeaders },
      )
    }

    let translated: string[] = []
    try {
      translated = await batchTranslate(
        words.map((w) => w.text),
        targetLang,
      )
    } catch (e) {
      console.error('[FN] Translate failed:', e)
      return Response.json(
        { error: 'Failed to translate text.' },
        { status: 422, headers: corsHeaders },
      )
    }

    const regions: OcrRegion[] = words.map((w, i) => ({
      originalText: w.text,
      translatedText: translated[i] ?? '',
      location: w.location,
    }))

    return Response.json(
      {
        success: true,
        originalText: words.map((w) => w.text).join('\n'),
        translatedText: translated.join('\n'),
        regions,
      },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error('[FN] image-translate error:', error)
    return Response.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Internal server error',
      },
      { status: 500, headers: corsHeaders },
    )
  }
})
