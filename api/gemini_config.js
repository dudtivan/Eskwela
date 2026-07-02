import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('gemini_config').select('*').eq('id', 1).single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { enabled, hourly_limit } = req.body
    const update = { updated_at: new Date().toISOString() }
    if (typeof enabled === 'boolean') update.enabled = enabled
    if (typeof hourly_limit === 'number' && hourly_limit > 0) update.hourly_limit = hourly_limit

    const { data, error } = await supabase.from('gemini_config').update(update).eq('id', 1).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  return res.status(405).end()
}