import { api, json, readJson } from '@/lib/api'
import { query } from '@/lib/db'
import { consumeRateLimit } from '@/lib/rate-limit'
import { requestLearningSuggestion } from '@/lib/learning-ai'
import { ownerMap, ownerNode, id } from '@/lib/learning'
import { text, oneOf } from '@/lib/validation'
import { ApiError } from '@/lib/api-error.js'
export const dynamic = 'force-dynamic'
const model = () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
export const GET = api(async () =>
  json({ available: Boolean(process.env.GROQ_API_KEY?.trim()), model: model() }),
)
export const POST = api(async (req, ctx, { user }) => {
  if (!process.env.GROQ_API_KEY?.trim())
    throw new ApiError(503, 'AI assistant is not configured.', 'AI_NOT_CONFIGURED')
  const body = await readJson(req, 8192)
  const mode = oneOf(
    body.mode,
    ['structure', 'route', 'dependencies', 'breakdown', 'questions', 'improve'],
    'mode',
  )
  const topic =
    body.topic === undefined ? '' : text(body.topic, { field: 'topic', max: 500, min: 0 })
  const goal = body.goal === undefined ? '' : text(body.goal, { field: 'goal', max: 500, min: 0 })
  const level =
    body.level === undefined ? '' : text(body.level, { field: 'level', max: 500, min: 0 })
  const limited = await consumeRateLimit('learning-ai:' + user.id, 20, 3600)
  if (!limited.allowed) throw new ApiError(429, 'Too many AI requests.', 'RATE_LIMITED')
  let context = { topic, goal, level, existingIds: [] },
    language = 'ru'
  const settings = (
    await query("SELECT settings->>'language' AS language FROM users WHERE id=$1", [user.id])
  ).rows[0]?.language
  language = settings === 'en' ? 'en' : 'ru'
  if (body.map_id !== undefined) {
    const map = await ownerMap({ query }, user.id, id(body.map_id, 'map_id'))
    const { rows: nodes } = await query(
      'SELECT id,kind,title,status FROM learning_nodes WHERE user_id=$1 AND map_id=$2 ORDER BY position,id',
      [user.id, map.id],
    )
    context = {
      ...context,
      map: { title: map.title, topic: map.topic, description: map.description },
      nodes,
      existingIds: nodes.map((n) => n.id),
    }
  }
  if (body.node_id !== undefined) {
    const node = await ownerNode({ query }, user.id, id(body.node_id, 'node_id'))
    if (body.map_id !== undefined && Number(node.map_id) !== Number(body.map_id))
      throw new ApiError(404, 'Node not found.', 'NOT_FOUND')
    context.selectedNode = { id: node.id, kind: node.kind, title: node.title, status: node.status }
    if (body.map_id === undefined) {
      const map = await ownerMap({ query }, user.id, node.map_id)
      const { rows: nodes } = await query(
        'SELECT id,kind,title,status FROM learning_nodes WHERE user_id=$1 AND map_id=$2 ORDER BY position,id',
        [user.id, map.id],
      )
      context.map = { title: map.title, topic: map.topic, description: map.description }
      context.nodes = nodes
      context.existingIds = nodes.map((n) => n.id)
    }
  }
  const suggestion = await requestLearningSuggestion({ mode, language, context })
  return json({ suggestion })
})
