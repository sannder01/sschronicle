// app/api/habits/[id]/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error:'Unauthorized' }, { status:401 })

  const { id } = await params
  const { name, description, frequency, days, color } = await req.json()

  const daysValue = frequency === 'custom' && Array.isArray(days)
    ? JSON.stringify(days)
    : null

  const result = await query(
    'UPDATE habits SET name=$1, description=$2, frequency=$3, days=$4::jsonb, color=$5 WHERE id=$6 AND user_id=$7 RETURNING *',
    [name, description||null, frequency||'daily', daysValue, color||'#8B5CF6', id, session.user.id]
  )

  if (!result.rows.length) return Response.json({ error:'Not found' }, { status:404 })
  return Response.json(result.rows[0])
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error:'Unauthorized' }, { status:401 })

  const { id } = await params
  await query('DELETE FROM habit_logs WHERE habit_id = $1', [id])
  await query('DELETE FROM habits WHERE id = $1 AND user_id = $2', [id, session.user.id])
  return Response.json({ ok:true })
}
