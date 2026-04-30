// Test if gummy needs streaming mode
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
    const { audio } = await req.json()
    console.log('Testing gummy streaming mode, audio length:', audio?.length || 0)

    const { WebSocket } = await import('https://esm.sh/ws@8.16.0')

    const ws = new WebSocket(WS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
      }
    })

    const taskId = generateUUID()
    const messages: string[] = []

    await new Promise<void>((resolve, reject) => {
      let resolved = false
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true
          console.log('Timeout reached')
          ws.close()
          resolve()
        }
      }, 15000)

      ws.on('open', () => {
        console.log('WebSocket connected')

        // Send task with streaming: 'out' instead of 'duplex'
        const runTask = {
          header: {
            streaming: 'out',  // Changed from 'duplex'
            task_id: taskId,
            action: 'run-task',
          },
          payload: {
            model: 'gummy-realtime-v1',
            parameters: {
              sample_rate: 16000,
              format: 'wav',  // Try WAV format
              transcription_enabled: true,
              translation_enabled: false,
            },
            input: {
              audio: audio || 'dGVzdA==',
            },
            task: 'asr',
            task_group: 'audio',
            function: 'recognition',
          },
        }

        ws.send(JSON.stringify(runTask))
        console.log('Task sent with streaming: out, format: wav')
      })

      ws.on('message', (data: Uint8Array | string) => {
        const msg = typeof data === 'string' ? data : new TextDecoder().decode(data)
        console.log('Message:', msg.substring(0, 500))
        messages.push(msg)

        try {
          const parsed = JSON.parse(msg)

          if (parsed.header?.event === 'task-finished' || parsed.header?.event === 'task-failed') {
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
