// In-memory rate limit store: { [ip]: { count, windowStart } }
// Resets naturally when the serverless function cold-starts, but persists within a warm instance.
// For true persistence across instances, swap this with Vercel KV / Redis.
const attempts = {}

const MAX_TRIES = 5
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Derive client IP from Vercel headers
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  const now = Date.now()
  const record = attempts[ip] || { count: 0, windowStart: now }

  // Reset window if an hour has passed
  if (now - record.windowStart >= WINDOW_MS) {
    record.count = 0
    record.windowStart = now
  }

  // Already locked out?
  if (record.count >= MAX_TRIES) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - record.windowStart)) / 1000)
    attempts[ip] = record
    return res.status(429).json({ ok: false, locked: true, retryAfter })
  }

  const { pin } = req.body

  if (pin && pin === process.env.ADMIN_PIN) {
    // Success — reset counter and return a short-lived session token
    attempts[ip] = { count: 0, windowStart: now }
    const token = Buffer.from(`${process.env.ADMIN_PIN}:${Math.floor(now / (1000 * 60 * 60 * 24))}`).toString('base64')
    return res.status(200).json({ ok: true, token })
  }

  // Wrong PIN
  record.count += 1
  attempts[ip] = record
  const remaining = MAX_TRIES - record.count
  return res.status(401).json({ ok: false, locked: false, remaining })
}