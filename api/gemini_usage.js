import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [hourRes, dayRes] = await Promise.all([
    supabase.from('gemini_usage_log').select('*', { count: 'exact', head: true }).gte('created_at', oneHourAgo),
    supabase.from('gemini_usage_log').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
  ])

  return res.status(200).json({
    last_hour: hourRes.count ?? 0,
    last_24h: dayRes.count ?? 0,
  })
}