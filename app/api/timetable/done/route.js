import { api, json } from '@/lib/api'
import { listDone } from '@/lib/timetable'
import { date } from '@/lib/validation'
import { ApiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

export const GET = api(async (req, _context, { user }) => {
  const day = date(new URL(req.url).searchParams.get('day'), 'day')
  if (!day) throw new ApiError(400, 'Invalid day.', 'VALIDATION_ERROR')
  return json(await listDone(user.id, day))
})
