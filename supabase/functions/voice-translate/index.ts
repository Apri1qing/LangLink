// Voice Translation using Aliyun gummy WebSocket + TTS
// ASR + Translation in one step via WebSocket, then TTS

const DASHSCOPE_API_KEY = Deno.env.get('DASHSCOPE_API_KEY')!
const TTS_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const WS_ENDPOINT = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'

interface VoiceTranslateRequest {
  audio: string // base64 encoded audio
  sourceLang: string
  targetLang: string
}

// Language code mapping for gummy
const langMap: Record<string, string> = {
  'zh': 'zh',
  'ja': 'ja',
  'en': 'en',
  'ko': 'ko',
  'es': 'es',
  'fr': 'fr',
  'de': 'de',
  'it': 'it',
  'pt': 'pt',
  'ru': 'ru',
  'ar': 'ar',
  'hi': 'hi',
  'th': 'th',
  'vi': 'vi',
  'id': 'id',
  'ms': 'ms',
  'tl': 'fil',
}

// Voice mapping for TTS
const voiceMap: Record<string, string> = {
  'zh': 'Cherry',
  'ja': 'Yunjia',
  'en': 'Emily',
  'ko': 'Yunu',
  'es': 'Linda',
  'fr': 'Julie',
  'de': 'Katarina',
  'it': ' Elsa',
  'pt': 'Camila',
  'ru': 'Alyona',
  'ar': 'Sami',
  'hi': 'Mithra',
  'th': 'Michele',
  'vi': 'Mai',
  'id': 'Catherine',
  'ms': 'Lisa',
  'tl': 'Pilar',
}

// Generate UUID for task_id
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  )
}

// WebSocket语音识别+翻译
async function speechToTextAndTranslate(
  audioData: Uint8Array,
  sourceLang: string,
  targetLang: string
): Promise<{ transcription: string; translation: string }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_ENDPOINT)
    let resultText = ''
    let translationText = ''
    const taskId = generateUUID()

    // Convert audio to base64
    const audioBase64 = btoa(String.fromCharCode(...audioData))

    ws.onopen = () => {
      // 发送 run-task 消息（按照文档格式）
      const runTask = {
        header: {
          streaming: 'duplex',
          task_id: taskId,
          action: 'run-task',
        },
        payload: {
          model: 'gummy-realtime-v1',
          parameters: {
            sample_rate: 16000,
            format: 'pcm',
            transcription_enabled: true,
            translation_enabled: true,
            translation_target_languages: [langMap[targetLang] || 'en'],
          },
          input: {
            audio: audioBase64,
          },
          task: 'asr',
          task_group: 'audio',
          function: 'recognition',
        },
      }
      ws.send(JSON.stringify(runTask))
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data)
        console.log('Gummy message:', JSON.stringify(msg).substring(0, 300))

        if (msg.header?.event === 'task-started') {
          console.log('Task started')
          // 发送二进制音频
          ws.send(audioData)
        } else if (msg.header?.event === 'result-generated') {
          const output = msg.payload?.output
          if (output?.transcription?.text) {
            resultText = output.transcription.text
          }
          if (output?.translations?.[0]?.text) {
            translationText = output.translations[0].text
          }
        } else if (msg.header?.event === 'task-finished') {
          ws.close()
          resolve({ transcription: resultText, translation: translationText })
        } else if (msg.header?.event === 'task-failed') {
          ws.close()
          reject(new Error(`Gummy error: ${msg.payload?.error_message || 'Unknown error'}`))
        }
      }
    }

    ws.onerror = (error) => {
      reject(new Error(`WebSocket error: ${error}`))
    }

    ws.onclose = () => {
      if (!resultText && !translationText) {
        reject(new Error('Connection closed before receiving results'))
      }
    }
  })
}

// TTS语音合成
async function textToSpeech(text: string, lang: string): Promise<Uint8Array> {
  const voice = voiceMap[lang] || 'Emily'

  const response = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen3-tts-flash',
      input: {
        text,
      },
      parameters: {
        voice,
        language_type: 'auto',
        stream: false,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`TTS error: ${response.status}`)
  }

  const data = await response.json()
  if (data.status_code !== 200) {
    throw new Error(`TTS error: ${data.message || 'Unknown error'}`)
  }

  // 返回 Base64 音频数据
  const audioBase64 = data.output?.audio?.data
  if (!audioBase64) {
    throw new Error('No audio data in TTS response')
  }

  // 解码 Base64 为 Uint8Array
  const binaryString = atob(audioBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
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
    const { audio, sourceLang, targetLang } = await req.json() as VoiceTranslateRequest

    if (!audio || !sourceLang || !targetLang) {
      return Response.json(
        { error: 'audio, sourceLang, and targetLang are required' },
        { status: 400 }
      )
    }

    console.log(`Voice translate: ${sourceLang} -> ${targetLang}`)

    // 解码音频
    const audioData = Uint8Array.from(atob(audio), c => c.charCodeAt(0))

    // 步骤1: 语音识别+翻译 (gummy WebSocket)
    let transcription = ''
    let translation = ''
    try {
      const result = await speechToTextAndTranslate(audioData, sourceLang, targetLang)
      transcription = result.transcription
      translation = result.translation
    } catch (asrError) {
      console.error('ASR+Translation failed:', asrError)
      return Response.json(
        { error: 'Speech recognition failed. Please speak clearly and try again.' },
        { status: 422 }
      )
    }

    // 步骤2: TTS (可选，如果失败不影响主要功能)
    let audioUrl: string | undefined
    try {
      const ttsAudio = await textToSpeech(translation, targetLang)

      // 上传到 Supabase Storage
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const fileName = `voice_${Date.now()}.mp3`

      const uploadResponse = await fetch(
        `${supabaseUrl}/storage/v1/object/translations/${fileName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'audio/mp3',
          },
          body: ttsAudio,
        }
      )

      if (uploadResponse.ok) {
        audioUrl = `${supabaseUrl}/storage/v1/object/public/translations/${fileName}`
      }
    } catch (ttsError) {
      console.warn('TTS failed, continuing without audio:', ttsError)
    }

    return Response.json({
      success: true,
      originalText: transcription,
      translatedText: translation,
      audioUrl,
    })
  } catch (error) {
    console.error('Voice translate error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
})
