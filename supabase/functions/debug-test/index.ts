// Debug test function to verify base64 encoding
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
    const { audio, sourceLang, targetLang } = await req.json()

    console.log('Received audio length:', audio?.length || 0)
    console.log('Source lang:', sourceLang)
    console.log('Target lang:', targetLang)

    // Test base64 decode
    let audioData: Uint8Array | null = null
    let decodeError = ''
    if (audio) {
      try {
        const binaryString = atob(audio)
        audioData = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          audioData[i] = binaryString.charCodeAt(i)
        }
        console.log('Decoded audio length:', audioData.length)
        console.log('First 10 bytes:', Array.from(audioData.slice(0, 10)))
      } catch (e) {
        decodeError = String(e)
        console.error('Decode error:', e)
      }
    }

    // Try to re-encode to verify
    let reEncoded = ''
    if (audioData) {
      try {
        const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        let result = ''
        for (let i = 0; i < audioData.length; i += 3) {
          const b1 = audioData[i]
          const b2 = audioData[i + 1] ?? 0
          const b3 = audioData[i + 2] ?? 0
          result += table[b1 >> 2]
          result += table[((b1 & 3) << 4) | (b2 >> 4)]
          result += audioData[i + 1] !== undefined ? table[((b2 & 15) << 2) | (b3 >> 6)] : '='
          result += audioData[i + 2] !== undefined ? table[b3 & 63] : '='
        }
        reEncoded = result
        console.log('Re-encoded length:', reEncoded.length)
      } catch (e) {
        console.error('Re-encode error:', e)
      }
    }

    return Response.json({
      success: true,
      receivedAudioLength: audio?.length || 0,
      decodedAudioLength: audioData?.length || 0,
      first10Bytes: audioData ? Array.from(audioData.slice(0, 10)) : null,
      reEncodedLength: reEncoded.length,
      decodeError,
      roundTripMatch: reEncoded === audio,
    })
  } catch (error) {
    console.error('Debug test error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
})
