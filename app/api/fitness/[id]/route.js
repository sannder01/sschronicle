// app/api/fitness/[id]/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error:'Unauthorized' }, { status:401 })
  await query('DELETE FROM fitness_meals WHERE id=$1 AND user_id=$2', [params.id, session.user.id])
  return Response.json({ success:true })
}
