export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function sbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

const CORS = { 'Access-Control-Allow-Origin': '*' }

export default async function handler(req) {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...CORS,
        'Access-Control-Allow-Methods': 'GET,POST,DELETE',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  // ── GET: fetch everything (requests + votes + replies) ──────────────────
  if (req.method === 'GET') {
    const [reqRes, voteRes, replyRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/feature_requests?order=created_at.desc`, { headers: sbHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/feature_votes`, { headers: sbHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/feature_replies?order=created_at.asc`, { headers: sbHeaders() }),
    ])

    const [requests, votes, replies] = await Promise.all([
      reqRes.json(), voteRes.json(), replyRes.json(),
    ])

    return new Response(JSON.stringify({ requests, votes, replies }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // ── POST: developer reply to a feature request ───────────────────────────
  if (req.method === 'POST') {
    const { feature_id, content } = await req.json()

    if (!feature_id || !content) {
      return new Response(JSON.stringify({ error: 'feature_id and content are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/feature_replies`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        feature_id,
        content,
        author_name: 'DEVELOPER',
        voter_id: 'developer',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // ── DELETE: remove a feature request OR a single reply ──────────────────
  // /api/feature-requests?type=request&id=...
  // /api/feature-requests?type=reply&id=...
  if (req.method === 'DELETE') {
    const type = url.searchParams.get('type')
    const id = url.searchParams.get('id')

    if (!id || (type !== 'request' && type !== 'reply')) {
      return new Response(JSON.stringify({ error: 'type (request|reply) and id are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const table = type === 'request' ? 'feature_requests' : 'feature_replies'

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}