import { createClient } from '@supabase/supabase-js'

let supabase = null
function getClient() {
  if (supabase) return supabase
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(`Missing env vars — SUPABASE_URL: ${url ? 'set' : 'MISSING'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? 'set' : 'MISSING'}`)
  }
  supabase = createClient(url, key)
  return supabase
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const client = getClient()

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [hourRes, dayRes, recentRes] = await Promise.all([
      client.from('gemini_usage_log').select('*', { count: 'exact', head: true }).gte('created_at', oneHourAgo),
      client.from('gemini_usage_log').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
      client.from('gemini_usage_log').select('id, created_at').order('created_at', { ascending: false }).limit(20),
    ])

    if (hourRes.error || dayRes.error || recentRes.error) {
      const err = hourRes.error || dayRes.error || recentRes.error
      console.error('gemini-usage error:', err)
      return res.status(500).json({ error: err.message })
    }

    return res.status(200).json({
      last_hour: hourRes.count ?? 0,
      last_24h: dayRes.count ?? 0,
      recent: recentRes.data ?? [],
    })
  } catch (e) {
    console.error('gemini-usage unhandled error:', e)
    return res.status(500).json({ error: e.message || 'Unknown server error' })
  }
}