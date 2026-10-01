import { json, readJson } from '@/lib/api'
import { query } from '@/lib/db'
import { trackingRoute, userTimezone, listHabits } from '@/lib/tracking-server'
import { habitInput } from '@/lib/tracking-validation'
import { todayInZone } from '@/lib/dates'

export const GET = trackingRoute(async (_req, _context, { user }) =>
  json(await listHabits(user.id)),
)
export const POST = trackingRoute(async (req, _context, { user }) => {
  const form = habitInput(await readJson(req)),
    timezone = await userTimezone(user.id)
  const habit = (
    await query(
      'INSERT INTO habits(user_id,name,description,frequency,days,color,timezone,start_date,sort_order) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,COALESCE((SELECT max(sort_order)+1 FROM habits WHERE user_id=$1),0)) RETURNING id',
      [
        user.id,
        form.name,
        form.description,
        form.frequency,
        JSON.stringify(form.days),
        form.color,
        timezone,
        todayInZone(timezone),
      ],
    )
  ).rows[0]
  return json(habit, 201)
})
