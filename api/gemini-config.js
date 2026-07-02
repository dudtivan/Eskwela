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
    const client = getClient()

    if (req.method === 'GET') {
      const { data, error } = await client.from('gemini_config').select('*').eq('id', 1).single()
      if (error) {
        console.error('gemini-config GET error:', error)
        return res.status(500).json({ error: error.message })
      }
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      let body = req.body
      if (!body) {
        return res.status(400).json({ error: 'Missing request body' })
      }
      if (typeof body === 'string') {
        try { body = JSON.parse(body) }
        catch { return res.status(400).json({ error: 'Invalid JSON body' }) }
      }

      const { enabled, hourly_limit } = body
      const update = { updated_at: new Date().toISOString() }
      if (typeof enabled === 'boolean') update.enabled = enabled
      if (typeof hourly_limit === 'number' && hourly_limit > 0) update.hourly_limit = hourly_limit

      if (Object.keys(update).length === 1) {
        return res.status(400).json({ error: 'No valid fields to update (expected enabled: boolean or hourly_limit: number)' })
      }

      const { data, error } = await client
        .from('gemini_config')
        .update(update)
        .eq('id', 1)
        .select()
        .single()

      if (error) {
        console.error('gemini-config POST error:', error)
        return res.status(500).json({ error: error.message })
      }
      return res.status(200).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('gemini-config unhandled error:', e)
    return res.status(500).json({ error: e.message || 'Unknown server error' })
  }
}