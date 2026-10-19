import { api, json, readJson, ApiError } from '@/lib/api'
import { query } from '@/lib/db'
import { DIARY_BODY_BYTES, emptyDiary, validDiaryDate, validateDiary } from '@/lib/diary/format.mjs'

function date(day) {
  if (!validDiaryDate(day)) throw new ApiError(400, 'Invalid diary date', 'INVALID_DATE')
  return day
}
const blank = (day) => ({ entry_date: day, version: 0, document: emptyDiary() })

export const GET = api(async (_req, { params }, { user }) => {
  const day = date(params.day)
  const { rows } = await query('SELECT * FROM diary_entries WHERE user_id=$1 AND entry_date=$2', [user.id, day])
  return json(rows[0] || blank(day))
})

export const PUT = api(async (req, { params }, { user }) => {
  const day = date(params.day)
  const body = await readJson(req, DIARY_BODY_BYTES)
  if (!Number.isSafeInteger(body.version) || body.version < 0 || body.version >= 2147483647)
    throw new ApiError(400, 'A diary version is required', 'VERSION_REQUIRED')
  let document
  try { document = validateDiary(body.document) }
  catch { throw new ApiError(400, 'Invalid or oversized diary document', 'INVALID_DOCUMENT') }
  // Atomic compare-and-swap also protects simultaneous creation of the same day.
  const { rows } = body.version === 0
    ? await query(
        `INSERT INTO diary_entries(user_id, entry_date, document) VALUES($1,$2,$3::jsonb)
        ON CONFLICT(user_id, entry_date) DO NOTHING RETURNING *`,
        [user.id, day, JSON.stringify(document)],
      )
    : await query(
        `UPDATE diary_entries SET document=$3::jsonb, version=version+1, updated_at=NOW()
        WHERE user_id=$1 AND entry_date=$2 AND version=$4 RETURNING *`,
        [user.id, day, JSON.stringify(document), body.version],
      )
  if (!rows.length) {
    const current = (await query('SELECT * FROM diary_entries WHERE user_id=$1 AND entry_date=$2', [user.id, day])).rows[0]
    throw new ApiError(409, 'This page changed in another window', 'VERSION_CONFLICT', { current: current || blank(day) })
  }
  return json(rows[0])
})
