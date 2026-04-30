// Test DashScope HTTP-based ASR API
const DASHSCOPE_API_KEY = Deno.env.get('DASHSCOPE_API_KEY')!

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
    const { audio, sourceLang } = await req.json()

    console.log('ASR HTTP Test: audio length =', audio?.length || 0, 'sourceLang =', sourceLang)

    // Try DashScope speech recognition API via HTTP
    // Using the correct API endpoint format
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/speech/recognition', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'paraformer-v1',
        input: {
          audio: audio,
        },
        parameters: {
          sample_rate: 16000,
          language: sourceLang || 'zh',
        },
      }),
    })

    console.log('ASR HTTP response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ASR HTTP error:', errorText)
      throw new Error(`ASR HTTP error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('ASR HTTP response:', JSON.stringify(data).substring(0, 500))

    return Response.json({
      success: true,
      data: data,
    })
  } catch (error) {
    console.error('ASR HTTP test failed:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
})
