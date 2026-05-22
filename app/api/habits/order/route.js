// app/api/habits/order/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0)
    return Response.json({ error: 'ids must be a non-empty array' }, { status: 400 })

  // Update sort_order for each habit, verifying ownership via user_id
  await Promise.all(
    ids.map((id, index) =>
      query(
        'UPDATE habits SET sort_order = $1 WHERE id = $2 AND user_id = $3',
        [index, id, session.user.id]
      )
    )
  )

  return Response.json({ ok: true })
}
