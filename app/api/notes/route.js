import db from '@/lib/db'

export async function GET() {
  const result = await db.query(`
    SELECT * FROM notes
    ORDER BY updated_at DESC
  `)

  return Response.json(result.rows)
}

export async function POST(req) {
  const body = await req.json()

  const { id, folderId, title, content } = body

  await db.query(
    `
    INSERT INTO notes (id, folder_id, title, content)
    VALUES ($1, $2, $3, $4)
    `,
    [id, folderId, title, content]
  )

  return Response.json({ success: true })
}