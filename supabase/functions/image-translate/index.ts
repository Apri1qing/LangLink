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
  targetLang?: string
  nativeLang?: string
  foreignLang?: string
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
 * Convert rotate_rect [cx, cy, w, h, angle_deg] to 8-point polygon
 * [x1,y1, x2,y2, x3,y3, x4,y4] (top-left → clockwise).
 */
function rotateRectToPolygon(r: number[]): number[] | null {
  if (r.length !== 5) return null
  const [cx, cy, w, h, angleDeg] = r
  const angle = (angleDeg * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const hw = w / 2
  const hh = h / 2
  // Corners relative to center (top-left, top-right, bottom-right, bottom-left)
  const corners: [number, number][] = [
    [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
  ]
  return corners.flatMap(([dx, dy]) => [
    Math.round(cx + dx * cos - dy * sin),
    Math.round(cy + dx * sin + dy * cos),
  ])
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

  // Extract JSON from possible code fences (```json ... ```)
  let jsonText = contentText
  const fenceMatch = contentText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) jsonText = fenceMatch[1].trim()

  // Try parsing JSON — handle both formats:
  //   Format A (words_info): {"words_info": [{"text": "...", "location": [8 pts]}]}
  //   Format B (rotate_rect): [{"text": "...", "rotate_rect": [cx,cy,w,h,angle]}]
  let parsed: unknown = null
  try {
    // Try array first (Format B), then object (Format A)
    const startArr = jsonText.indexOf('[')
    const startObj = jsonText.indexOf('{')
    if (startArr >= 0 && (startObj < 0 || startArr < startObj)) {
      const endArr = jsonText.lastIndexOf(']')
      if (endArr > startArr) parsed = JSON.parse(jsonText.slice(startArr, endArr + 1))
    } else if (startObj >= 0) {
      const endObj = jsonText.lastIndexOf('}')
      if (endObj > startObj) parsed = JSON.parse(jsonText.slice(startObj, endObj + 1))
    }
  } catch (_e) {
    parsed = null
  }

  // Format A: {words_info: [{text, location:[8 pts]}]}
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    const rawWords = obj.words_info
    if (Array.isArray(rawWords) && rawWords.length > 0) {
      const out: OcrWord[] = []
      for (const w of rawWords as Array<Record<string, unknown>>) {
        const text = typeof w.text === 'string' ? w.text.trim() : ''
        const loc = w.location
        if (text && Array.isArray(loc) && loc.length === 8 && loc.every((n) => typeof n === 'number')) {
          out.push({ text, location: loc as number[] })
        }
      }
      if (out.length > 0) {
        console.log('[OCR] Format A (words_info): parsed', out.length, 'words')
        return out
      }
    }
  }

  // Format B: [{text, rotate_rect:[cx,cy,w,h,angle]}]
  if (Array.isArray(parsed) && parsed.length > 0) {
    const out: OcrWord[] = []
    for (const w of parsed as Array<Record<string, unknown>>) {
      const text = typeof w.text === 'string' ? w.text.trim() : ''
      const rr = w.rotate_rect
      if (text && Array.isArray(rr) && rr.length === 5 && rr.every((n) => typeof n === 'number')) {
        const location = rotateRectToPolygon(rr as number[])
        if (location) out.push({ text, location })
      }
    }
    if (out.length > 0) {
      console.log('[OCR] Format B (rotate_rect): parsed', out.length, 'words')
      return out
    }
  }

  // Plain text fallback: split by newlines, each line gets full-width placeholder bbox
  const lines = contentText.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) throw new Error('OCR: no text extracted')
  console.log('[OCR] Fallback: plain text,', lines.length, 'lines')
  return lines.map((text, i) => ({
    text,
    location: [0, i * 20, 100, i * 20, 100, (i + 1) * 20, 0, (i + 1) * 20],
  }))
}

/**
 * Batch translate an array of texts in one LLM call.
 */
async function batchTranslate(
  texts: string[],
  targetLang: string,
  options?: { nativeLang?: string; foreignLang?: string },
): Promise<string[]> {
  if (texts.length === 0) return []

  const targetLangName = LANG_MAP[targetLang] || targetLang
  const nativeLangName = options?.nativeLang ? (LANG_MAP[options.nativeLang] || options.nativeLang) : ''
  const foreignLangName = options?.foreignLang ? (LANG_MAP[options.foreignLang] || options.foreignLang) : ''
  const systemPrompt = options?.nativeLang && options?.foreignLang
    ? `You are a professional travel translator. Native language: ${nativeLangName}. Foreign language: ${foreignLangName}. ` +
      `For each input text, translate native-language text to ${foreignLangName}, and translate all other readable text to ${nativeLangName}. ` +
      `Do not return the original text unchanged unless it is only a number, symbol, brand name, or proper noun. ` +
      `Reply ONLY with a JSON array of strings in the same order and length. No explanations, no code fences.`
    : `You are a professional translator. Translate each of the following texts to ${targetLangName}. ` +
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
    const { image, nativeLang, foreignLang } = body
    const targetLang = body.targetLang || nativeLang
    if (!image || !targetLang) {
      return Response.json(
        { error: 'image and targetLang/nativeLang are required' },
        { status: 400, headers: corsHeaders },
      )
    }

    console.log(
      `[FN] image-translate → ${targetLang}`,
      nativeLang && foreignLang ? `(pair ${nativeLang}<->${foreignLang})` : '',
    )

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
        { nativeLang, foreignLang },
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
