// Supabase Edge Function: rate-limiter
// Checks and manages user daily quota

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface QuotaResult {
  allowed: boolean
  remaining: number
  reset_needed: boolean
}

export async function checkAndIncrementQuota(
  userId: string,
  incrementBy: number = 1
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const today = new Date().toISOString().split('T')[0]

  // Get current quota
  const { data: quota, error } = await supabase
    .from('user_quotas')
    .select('daily_limit, daily_used, last_reset_date')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is ok
    console.error('Error fetching quota:', error)
    throw new Error('Failed to check quota')
  }

  // No quota record exists, create one
  if (!quota) {
    const { error: insertError } = await supabase.from('user_quotas').insert({
      user_id: userId,
      daily_limit: 50,
      daily_used: incrementBy,
      last_reset_date: today,
    })

    if (insertError) {
      console.error('Error creating quota:', insertError)
      throw new Error('Failed to create quota')
    }

    return { allowed: true, remaining: 49 }
  }

  // Check if reset is needed (new day)
  if (quota.last_reset_date !== today) {
    await supabase
      .from('user_quotas')
      .update({
        daily_used: incrementBy,
        last_reset_date: today,
      })
      .eq('user_id', userId)

    return { allowed: true, remaining: quota.daily_limit - incrementBy }
  }

  // Check quota
  if (quota.daily_used + incrementBy > quota.daily_limit) {
    return { allowed: false, remaining: Math.max(0, quota.daily_limit - quota.daily_used) }
  }

  // Increment usage
  const { error: updateError } = await supabase
    .from('user_quotas')
    .update({
      daily_used: quota.daily_used + incrementBy,
    })
    .eq('user_id', userId)

  if (updateError) {
    console.error('Error incrementing quota:', updateError)
    throw new Error('Failed to update quota')
  }

  return {
    allowed: true,
    remaining: quota.daily_limit - quota.daily_used - incrementBy,
  }
}

export async function logTranslation(
  userId: string | undefined,
  type: 'voice' | 'image' | 'phrase',
  sourceLang: string,
  targetLang: string,
  apiCalls: number = 1
) {
  if (!userId) return // Anonymous user, skip logging

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  await supabase.from('translation_logs').insert({
    user_id: userId,
    type,
    source_lang: sourceLang,
    target_lang: targetLang,
    api_calls: apiCalls,
  })
}

// Deno serve handler for direct testing
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
    const { user_id, type, source_lang, target_lang, api_calls } = await req.json()

    if (!user_id) {
      return Response.json(
        { error: 'user_id is required' },
        { status: 400 }
      )
    }

    // Check and increment quota
    const { allowed, remaining } = await checkAndIncrementQuota(user_id, api_calls || 1)

    if (!allowed) {
      return Response.json(
        {
          error: 'Daily quota exceeded',
          remaining: 0,
          message: 'Please upgrade to Pro for more translations',
        },
        { status: 429 }
      )
    }

    // Log the translation
    await logTranslation(user_id, type || 'voice', source_lang || 'zh', target_lang || 'en', api_calls || 1)

    return Response.json({
      success: true,
      remaining,
    })
  } catch (error) {
    console.error('Rate limiter error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
