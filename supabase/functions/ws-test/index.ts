// Simple WebSocket test with DashScope
const WS_ENDPOINT = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'
const DASHSCOPE_API_KEY = 'sk-beff95031efb433c83bd6326e05c44a7'

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
    console.log('Testing WebSocket connection to DashScope...')
    const { WebSocket } = await import('https://esm.sh/ws@8.16.0')

    const ws = new WebSocket(WS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
      }
    })

    console.log('WebSocket created, waiting for open...')

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        console.log('WebSocket connected!')
        resolve()
      })
      ws.on('error', (e) => {
        console.error('WebSocket error:', e)
        reject(new Error('WebSocket connection failed'))
      })
      setTimeout(() => reject(new Error('WebSocket timeout')), 10000)
    })

    // Send a simple task
    const taskId = 'test123456789012345678901234'
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
          translation_target_languages: ['ja'],
        },
        input: {
          audio: 'dGVzdA==', // "test" in base64
        },
        task: 'asr',
        task_group: 'audio',
        function: 'recognition',
      },
    }

    ws.send(JSON.stringify(runTask))
    console.log('Task sent, waiting for response...')

    // Wait for messages
    const messages: string[] = []
    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data: Uint8Array | string) => {
        const msg = typeof data === 'string' ? data : new TextDecoder().decode(data)
        console.log('Received message:', msg.substring(0, 200))
        messages.push(msg)

        // Try to parse and check for specific events
        try {
          const parsed = JSON.parse(msg)
          if (parsed.header?.event === 'task-started' ||
              parsed.header?.event === 'task-failed' ||
              parsed.header?.event === 'task-finished') {
            console.log('Got final event:', parsed.header.event)
            ws.close()
            resolve()
          }
        } catch {
          // Not JSON, ignore
        }
      })
      ws.on('error', reject)
      setTimeout(() => {
        ws.close()
        resolve()
      }, 15000)
    })

    ws.close()

    return Response.json({
      success: true,
      message: 'WebSocket test completed',
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
