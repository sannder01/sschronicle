import { json, readJson } from '@/lib/api'
import { transaction } from '@/lib/db'
import { trackingRoute } from '@/lib/tracking-server'
import { habitInput, trackingId, TrackingError } from '@/lib/tracking-validation'

export const PATCH = trackingRoute(async (req, { params }, { user }) => {
  const form = habitInput(await readJson(req))
  const result = await transaction(async (client) => {
    const existing = await client.query(
      'SELECT id FROM habits WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [trackingId(params.id), user.id],
    )
    if (!existing.rowCount) throw new TrackingError('Habit not found', 404)
    return (
      await client.query(
        'UPDATE habits SET name=$3,description=$4,frequency=$5,days=$6::jsonb,color=$7,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING id',
        [
          trackingId(params.id),
          user.id,
          form.name,
          form.description,
          form.frequency,
          JSON.stringify(form.days),
          form.color,
        ],
      )
    ).rows[0]
  })
  return json(result)
})
export const DELETE = trackingRoute(async (_req, { params }, { user }) => {
  const id = trackingId(params.id)
  await transaction(async (client) => {
    const existing = await client.query(
      'SELECT id FROM habits WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [id, user.id],
    )
    if (!existing.rowCount) throw new TrackingError('Habit not found', 404)
    await client.query('DELETE FROM habit_logs WHERE habit_id=$1 AND user_id=$2', [id, user.id])
    await client.query('DELETE FROM habits WHERE id=$1 AND user_id=$2', [id, user.id])
  })
  return json({ ok: true })
})
