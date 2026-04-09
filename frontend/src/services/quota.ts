// Frontend quota service
// Checks user quota status

import { supabase } from './supabase'
import type { UserQuota } from '../types'

export async function getUserQuota(): Promise<UserQuota | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching quota:', error)
    return null
  }

  return data
}

export async function checkQuota(): Promise<{ allowed: boolean; remaining: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { allowed: true, remaining: 0 } // Anonymous users, no quota check
  }

  const today = new Date().toISOString().split('T')[0]

  // Try to call rate-limiter edge function
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
  if (functionsUrl) {
    try {
      const { data, error } = await supabase.functions.invoke('rate-limiter', {
        body: {
          user_id: user.id,
          type: 'voice',
          source_lang: 'zh',
          target_lang: 'en',
          api_calls: 1,
        },
      })

      if (error) {
        console.error('Rate limiter error:', error)
        // Fallback to direct query
        return await checkQuotaDirect(user.id, today)
      }

      return { allowed: data.allowed, remaining: data.remaining }
    } catch {
      // Fallback to direct query
      return await checkQuotaDirect(user.id, today)
    }
  }

  return await checkQuotaDirect(user.id, today)
}

async function checkQuotaDirect(
  userId: string,
  today: string
): Promise<{ allowed: boolean; remaining: number }> {
  const { data, error } = await supabase
    .from('user_quotas')
    .select('daily_limit, daily_used, last_reset_date')
    .eq('user_id', userId)
    .single()

  if (error && error.code === 'PGRST116') {
    // No quota record, allow
    return { allowed: true, remaining: 50 }
  }

  if (error) {
    console.error('Error checking quota:', error)
    return { allowed: true, remaining: 0 }
  }

  // Check if reset is needed
  if (data.last_reset_date !== today) {
    return { allowed: true, remaining: data.daily_limit }
  }

  // Check quota
  if (data.daily_used >= data.daily_limit) {
    return { allowed: false, remaining: 0 }
  }

  return {
    allowed: true,
    remaining: data.daily_limit - data.daily_used,
  }
}
