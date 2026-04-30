// Test gummy with different audio samples
const WS_ENDPOINT = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'
const DASHSCOPE_API_KEY = Deno.env.get('DASHSCOPE_API_KEY')!

function generateUUID(): string {
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  )
}

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
    const { testCase } = await req.json()
    console.log('Testing gummy with case:', testCase || 'default')

    const { WebSocket } = await import('https://esm.sh/ws@8.16.0')

    const ws = new WebSocket(WS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
      }
    })

    const taskId = generateUUID()
    const messages: string[] = []
    let testAudio = ''

    // Different test cases
    switch (testCase) {
      case 'empty':
        testAudio = '' // Empty audio
        break
      case 'short':
        testAudio = 'AAAA' // 3 bytes of zeros
        break
      case 'silence-100ms':
        // 100ms of silence at 16kHz = 1600 samples = 3200 bytes
        testAudio = 'A'.repeat(4267) // base64 for 3200 bytes of zeros
        break
      case 'url':
        // Try URL format instead of base64
        testAudio = 'https://example.com/test.pcm'
        break
      default:
        testAudio = 'dGVzdA==' // "test" in base64
    }

    await new Promise<void>((resolve, reject) => {
      let resolved = false
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true
          ws.close()
          resolve()
        }
      }, 10000)

      ws.on('open', () => {
        console.log('WebSocket connected')

        // Test 1: Send task WITHOUT audio first
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
              translation_enabled: false,
            },
            input: testCase === 'no-audio' ? {} : {
              audio: testAudio,
            },
            task: 'asr',
            task_group: 'audio',
            function: 'recognition',
          },
        }

        ws.send(JSON.stringify(runTask))
        console.log('Task sent with audio:', testAudio.substring(0, 50))
      })

      ws.on('message', (data: Uint8Array | string) => {
        const msg = typeof data === 'string' ? data : new TextDecoder().decode(data)
        console.log('Message:', msg.substring(0, 300))
        messages.push(msg)

        try {
          const parsed = JSON.parse(msg)

          if (parsed.header?.event === 'task-started') {
            console.log('Task started, NOT sending finish - waiting for results')
            // Don't send finish, just wait for results
          } else if (parsed.header?.event === 'result-generated') {
            console.log('Got result:', JSON.stringify(parsed.payload))
          } else if (parsed.header?.event === 'task-finished' || parsed.header?.event === 'task-failed') {
            console.log('Task ended:', parsed.header.event)
            if (!resolved) {
              resolved = true
              clearTimeout(timeoutId)
              ws.close()
              resolve()
            }
          }
        } catch {
          // Not JSON
        }
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          reject(error)
        }
      })

      ws.on('close', () => {
        console.log('WebSocket closed')
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutId)
          resolve()
        }
      })
    })

    return Response.json({
      success: true,
      testCase: testCase || 'default',
      messages,
    })
  } catch (error) {
    console.error('Test failed:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
})
