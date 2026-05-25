export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const user_id = url.searchParams.get('user_id')

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let fetchUrl = `${SUPABASE_URL}/rest/v1/feedback_with_email?order=created_at.asc`
  if (user_id) fetchUrl += `&user_id=eq.${user_id}`

  const res = await fetch(fetchUrl, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
