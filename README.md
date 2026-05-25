# 🛠️ Eskwela Developer Console

A web dashboard for replying to user messages from the Eskwela app.

## Stack
- **Next.js 14** (App Router)
- **Supabase** (your existing `feedback_messages` table)
- **Vercel** (deployment)

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# 3. Run locally
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Import the repo in [vercel.com/new](https://vercel.com/new)
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy ✅

## Supabase Table

Your existing `feedback_messages` table is used as-is:

| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| user_id | text | the app user's ID |
| message | text | the message content |
| is_developer | boolean | `false` = user, `true` = you replying |
| created_at | timestamptz | auto |

No migrations needed — the app reads and writes to the table the Android app already uses.

## Features
- See all user conversations in the sidebar
- Unread badge counts (messages after your last reply)
- Click a user to open the chat thread
- Reply with Enter (Shift+Enter for new line)
- Auto-refreshes every 4 seconds
- Fully matches Eskwela's dark navy aesthetic
