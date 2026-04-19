import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { chatId } = await req.json()
  if (!chatId) return Response.json({ error: 'chatId required' }, { status: 400 })

  await query(`
    INSERT INTO tg_connections (user_id, chat_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET chat_id = EXCLUDED.chat_id, updated_at = NOW()
  `, [session.user.id, String(chatId)])

  return Response.json({ success: true })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await query(
    'SELECT chat_id FROM tg_connections WHERE user_id = $1',
    [session.user.id]
  )
  return Response.json({ chatId: result.rows[0]?.chat_id || null })
}
