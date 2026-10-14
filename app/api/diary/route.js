import { api, json } from '@/lib/api'
import { query } from '@/lib/db'

export const GET = api(async (_req, _context, { user }) => {
  const { rows } = await query(
    `SELECT entry_date, updated_at, version, LEFT(document->>'text', 120) AS preview,
    document->>'mood' AS mood FROM diary_entries WHERE user_id=$1 ORDER BY entry_date DESC`,
    [user.id],
  )
  return json(rows)
})
