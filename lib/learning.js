import { query, transaction } from './db.js'
import { ApiError } from './api-error.js'
import { positiveId, text, oneOf, hexColor, boolean } from './validation.js'
import { mapStats, wouldCreateCycle } from './learning-shape.mjs'

const fail = (message, code = 'VALIDATION_ERROR', status = 400) => {
  throw new ApiError(status, message, code)
}
const kinds = ['topic', 'subtopic', 'goal']
const statuses = ['not_started', 'learning', 'review', 'mastered']
export const id = (value, field = 'id') => positiveId(value, field)
export const maybeText = (value, field, max, fallback = '') =>
  value === undefined ? fallback : text(value, { field, max, min: 0 })
export const kindValue = (value) => oneOf(value, kinds, 'kind')
export const statusValue = (value) => oneOf(value, statuses, 'status')

export async function ownerMap(client, userId, mapId, lock = false) {
  const { rows } = await client.query(
    `SELECT * FROM learning_maps WHERE id=$1 AND user_id=$2${lock ? ' FOR UPDATE' : ''}`,
    [id(mapId), userId],
  )
  if (!rows[0]) throw new ApiError(404, 'Map not found.', 'NOT_FOUND')
  return rows[0]
}
export async function ownerNode(client, userId, nodeId, lock = false) {
  const { rows } = await client.query(
    `SELECT * FROM learning_nodes WHERE id=$1 AND user_id=$2${lock ? ' FOR UPDATE' : ''}`,
    [id(nodeId), userId],
  )
  if (!rows[0]) throw new ApiError(404, 'Node not found.', 'NOT_FOUND')
  return rows[0]
}
export async function validateMapParent(client, userId, currentId, parentId) {
  if (parentId == null) return null
  parentId = id(parentId, 'parent_id')
  const { rows } = await client.query('SELECT id,parent_id FROM learning_maps WHERE user_id=$1', [
    userId,
  ])
  const maps = rows
  if (!maps.some((m) => Number(m.id) === parentId))
    throw new ApiError(404, 'Parent map not found.', 'NOT_FOUND')
  const nesting = maps
    .filter((m) => m.parent_id != null)
    .map((m) => ({ from_id: m.parent_id, to_id: m.id }))
  if (currentId && wouldCreateCycle(nesting, parentId, currentId))
    fail('Map nesting would create a cycle.', 'CYCLE')
  const parents = new Map(
    maps.map((m) => [Number(m.id), m.parent_id == null ? null : Number(m.parent_id)]),
  )
  let parentDepth = 0,
    cursor = parentId
  while (cursor != null) {
    parentDepth++
    cursor = parents.get(cursor) ?? null
    if (parentDepth > 5) break
  }
  let subtreeHeight = 0,
    changed = true
  const descendants = new Map([[Number(currentId), 0]])
  while (changed) {
    changed = false
    for (const m of maps)
      if (
        m.parent_id != null &&
        descendants.has(Number(m.parent_id)) &&
        !descendants.has(Number(m.id))
      ) {
        descendants.set(Number(m.id), descendants.get(Number(m.parent_id)) + 1)
        subtreeHeight = Math.max(subtreeHeight, descendants.get(Number(m.id)))
        changed = true
      }
  }
  if (parentDepth + 1 + subtreeHeight > 4)
    fail('Map nesting is limited to four levels.', 'DEPTH_LIMIT')
  return parentId
}
export async function mapStatsFor(userId, mapIds, client = { query }) {
  if (!mapIds.length) return new Map()
  const { rows: maps } = await client.query(
    'SELECT id,parent_id FROM learning_maps WHERE user_id=$1',
    [userId],
  )
  const { rows: nodes } = await client.query(
    'SELECT n.* FROM learning_nodes n WHERE n.user_id=$1',
    [userId],
  )
  const result = new Map()
  for (const target of mapIds) {
    const subtree = new Set([Number(target)])
    let grew = true
    while (grew) {
      grew = false
      for (const m of maps)
        if (m.parent_id != null && subtree.has(Number(m.parent_id)) && !subtree.has(Number(m.id))) {
          subtree.add(Number(m.id))
          grew = true
        }
    }
    result.set(Number(target), mapStats(nodes.filter((n) => subtree.has(Number(n.map_id)))))
  }
  return result
}
export async function listMaps(userId) {
  const { rows } = await query(
    'SELECT * FROM learning_maps WHERE user_id=$1 ORDER BY position,id',
    [userId],
  )
  const stats = await mapStatsFor(
    userId,
    rows.map((m) => m.id),
  )
  const own = await query(
    "SELECT map_id, COUNT(*)::int AS nodes, COUNT(*) FILTER (WHERE status='mastered')::int AS mastered, COUNT(*) FILTER (WHERE status='learning')::int AS learning, COUNT(*) FILTER (WHERE status='review')::int AS review, COUNT(*) FILTER (WHERE status='not_started')::int AS not_started, COUNT(*) FILTER (WHERE kind='goal')::int AS goals, COUNT(*) FILTER (WHERE kind='goal' AND status='mastered')::int AS goals_done, MAX(GREATEST(status_changed_at,updated_at)) AS last_activity FROM learning_nodes WHERE user_id=$1 GROUP BY map_id",
    [userId],
  )
  const ownById = new Map(
    own.rows.map((r) => [
      Number(r.map_id),
      {
        nodes: r.nodes,
        mastered: r.mastered,
        learning: r.learning,
        review: r.review,
        not_started: r.not_started,
        percent: r.nodes ? Math.round((100 * r.mastered) / r.nodes) : 0,
        goals: r.goals,
        goals_done: r.goals_done,
        last_activity: r.last_activity,
      },
    ]),
  )
  return rows.map((map) => ({
    ...map,
    stats: stats.get(Number(map.id)),
    own_stats: ownById.get(Number(map.id)) || mapStats([]),
  }))
}
export async function createMap(userId, body) {
  const title = text(body.title, { field: 'title', max: 120 })
  const description = maybeText(body.description, 'description', 2000)
  const topic = maybeText(body.topic, 'topic', 80)
  const color = hexColor(body.color ?? '#5e5ce6')
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const count = Number(
      (
        await client.query('SELECT COUNT(*)::int AS count FROM learning_maps WHERE user_id=$1', [
          userId,
        ])
      ).rows[0].count,
    )
    if (count >= 200) fail('Map limit reached.', 'LIMIT_REACHED', 400)
    const parent = await validateMapParent(client, userId, null, body.parent_id ?? null)
    return (
      await client.query(
        'INSERT INTO learning_maps(user_id,parent_id,title,description,topic,color) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [userId, parent, title, description, topic, color],
      )
    ).rows[0]
  })
}
export async function getMap(userId, mapId) {
  const map = await ownerMap({ query }, userId, mapId)
  const { rows: allMaps } = await query(
    'SELECT * FROM learning_maps WHERE user_id=$1 ORDER BY position,id',
    [userId],
  )
  const children = allMaps.filter((m) => Number(m.parent_id) === Number(map.id))
  const stats = await mapStatsFor(userId, [map.id, ...children.map((m) => m.id)])
  const breadcrumbs = []
  let cursor = map
  while (cursor) {
    breadcrumbs.unshift({ id: cursor.id, title: cursor.title })
    cursor = allMaps.find((m) => Number(m.id) === Number(cursor.parent_id))
  }
  const [nodes, edges, materials] = await Promise.all([
    query('SELECT * FROM learning_nodes WHERE user_id=$1 AND map_id=$2 ORDER BY position,id', [
      userId,
      map.id,
    ]),
    query('SELECT * FROM learning_edges WHERE user_id=$1 AND map_id=$2 ORDER BY id', [
      userId,
      map.id,
    ]),
    query(
      'SELECT lm.* FROM learning_materials lm JOIN learning_nodes n ON n.id=lm.node_id WHERE lm.user_id=$1 AND n.map_id=$2 ORDER BY lm.position,lm.id',
      [userId, map.id],
    ),
  ])
  return {
    map: { ...map, stats: stats.get(Number(map.id)) },
    breadcrumbs,
    children: children.map((m) => ({ ...m, stats: stats.get(Number(m.id)) })),
    nodes: nodes.rows,
    edges: edges.rows,
    materials: materials.rows,
  }
}
export async function patchMap(userId, mapId, body) {
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const current = await ownerMap(client, userId, mapId, true)
    const fields = [],
      values = [current.id]
    for (const [key, max] of [
      ['title', 120],
      ['description', 2000],
      ['topic', 80],
    ])
      if (body[key] !== undefined) {
        values.push(text(body[key], { field: key, max, min: key === 'title' ? 1 : 0 }))
        fields.push(`${key}=$${values.length}`)
      }
    if (body.color !== undefined) {
      values.push(hexColor(body.color))
      fields.push(`color=$${values.length}`)
    }
    if (body.archived !== undefined) {
      values.push(boolean(body.archived, 'archived'))
      fields.push(
        `archived_at=CASE WHEN $${values.length} THEN COALESCE(archived_at,NOW()) ELSE NULL END`,
      )
    }
    if (body.parent_id !== undefined) {
      values.push(await validateMapParent(client, userId, current.id, body.parent_id))
      fields.push(`parent_id=$${values.length}`)
    }
    if (!fields.length) fail('Nothing to update.')
    fields.push('updated_at=NOW()')
    return (
      await client.query(
        `UPDATE learning_maps SET ${fields.join(',')} WHERE id=$1 RETURNING *`,
        values,
      )
    ).rows[0]
  })
}
export async function createNode(userId, mapId, body) {
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const map = await ownerMap(client, userId, mapId)
    const count = Number(
      (
        await client.query('SELECT COUNT(*)::int AS n FROM learning_nodes WHERE map_id=$1', [
          map.id,
        ])
      ).rows[0].n,
    )
    if (count >= 500) fail('Node limit reached.', 'LIMIT_REACHED')
    const kind = kindValue(body.kind ?? 'topic'),
      title = text(body.title, { field: 'title', max: 160 }),
      description = maybeText(body.description, 'description', 4000)
    const parent = body.parent_id == null ? null : id(body.parent_id, 'parent_id')
    if (parent != null) {
      const p = await ownerNode(client, userId, parent)
      if (Number(p.map_id) !== Number(map.id)) fail('Parent must be in this map.')
    }
    const status = statusValue(body.status ?? 'not_started')
    const x = body.x == null ? null : Number(body.x),
      y = body.y == null ? null : Number(body.y)
    if ((x != null && !Number.isFinite(x)) || (y != null && !Number.isFinite(y)))
      fail('Invalid position.')
    return (
      await client.query(
        'INSERT INTO learning_nodes(user_id,map_id,parent_id,kind,title,description,status,x,y,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE((SELECT MAX(position)+1 FROM learning_nodes WHERE map_id=$2),0)) RETURNING *',
        [userId, map.id, parent, kind, title, description, status, x, y],
      )
    ).rows[0]
  })
}
export async function patchNode(userId, nodeId, body) {
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const node = await ownerNode(client, userId, nodeId, true)
    const fields = [],
      values = [node.id]
    for (const [key, max] of [
      ['title', 160],
      ['description', 4000],
    ])
      if (body[key] !== undefined) {
        values.push(text(body[key], { field: key, max, min: key === 'title' ? 1 : 0 }))
        fields.push(`${key}=$${values.length}`)
      }
    if (body.kind !== undefined) {
      values.push(kindValue(body.kind))
      fields.push(`kind=$${values.length}`)
    }
    if (body.parent_id !== undefined) {
      let p = body.parent_id == null ? null : id(body.parent_id, 'parent_id')
      if (p != null) {
        const parent = await ownerNode(client, userId, p)
        if (Number(parent.map_id) !== Number(node.map_id)) fail('Parent must be in this map.')
        const { rows: tree } = await client.query(
          'SELECT id,parent_id FROM learning_nodes WHERE map_id=$1 AND parent_id IS NOT NULL',
          [node.map_id],
        )
        const links = tree.map((r) => ({ from_id: r.parent_id, to_id: r.id }))
        if (wouldCreateCycle(links, p, node.id)) fail('A topic cannot go inside itself.', 'CYCLE')
      }
      values.push(p)
      fields.push(`parent_id=$${values.length}`)
    }
    for (const key of ['x', 'y'])
      if (body[key] !== undefined) {
        const v = body[key] == null ? null : Number(body[key])
        if (v !== null && !Number.isFinite(v)) fail('Invalid position.')
        values.push(v)
        fields.push(`${key}=$${values.length}`)
      }
    if (body.status !== undefined) {
      const next = statusValue(body.status)
      values.push(next)
      fields.push(`status=$${values.length}`)
      fields.push(
        `mastered_at=CASE WHEN $${values.length}='mastered' THEN CASE WHEN status='mastered' THEN mastered_at ELSE NOW() END ELSE NULL END`,
      )
      fields.push(
        'status_changed_at=CASE WHEN status IS DISTINCT FROM $' +
          values.length +
          ' THEN NOW() ELSE status_changed_at END',
      )
    }
    if (!fields.length) fail('Nothing to update.')
    fields.push('updated_at=NOW()')
    return (
      await client.query(
        `UPDATE learning_nodes SET ${fields.join(',')} WHERE id=$1 RETURNING *`,
        values,
      )
    ).rows[0]
  })
}
export async function addEdge(userId, mapId, body) {
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const map = await ownerMap(client, userId, mapId)
    const from = id(body.from_id, 'from_id'),
      to = id(body.to_id, 'to_id')
    const found = await client.query(
      'SELECT id FROM learning_nodes WHERE user_id=$1 AND map_id=$2 AND id=ANY($3::int[])',
      [userId, map.id, [from, to]],
    )
    if (found.rows.length !== 2) throw new ApiError(404, 'Node not found.', 'NOT_FOUND')
    const edgeCount = Number(
      (
        await client.query('SELECT COUNT(*)::int AS n FROM learning_edges WHERE map_id=$1', [
          map.id,
        ])
      ).rows[0].n,
    )
    if (edgeCount >= 1000) fail('Edge limit reached.', 'LIMIT_REACHED')
    const edges = (
      await client.query('SELECT from_id,to_id FROM learning_edges WHERE map_id=$1', [map.id])
    ).rows
    if (wouldCreateCycle(edges, from, to)) fail('Dependency would create a cycle.', 'CYCLE')
    const { rows } = await client.query(
      'INSERT INTO learning_edges(user_id,map_id,from_id,to_id) VALUES($1,$2,$3,$4) ON CONFLICT(from_id,to_id) DO NOTHING RETURNING *',
      [userId, map.id, from, to],
    )
    if (!rows[0]) fail('Dependency already exists.', 'DUPLICATE', 409)
    return rows[0]
  })
}
export async function savePositions(userId, mapId, positions) {
  if (!Array.isArray(positions) || positions.length > 500) fail('Invalid positions.')
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const map = await ownerMap(client, userId, mapId)
    for (const p of positions) {
      if (!p || typeof p !== 'object' || Array.isArray(p)) fail('Invalid position.')
      const nid = id(p.id)
      const x = Number(p.x),
        y = Number(p.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) fail('Invalid position.')
      const result = await client.query(
        'UPDATE learning_nodes SET x=$1,y=$2,updated_at=NOW() WHERE id=$3 AND user_id=$4 AND map_id=$5',
        [x, y, nid, userId, map.id],
      )
      if (!result.rowCount) throw new ApiError(404, 'Node not found.', 'NOT_FOUND')
    }
    return { ok: true }
  })
}
export async function applySuggestion(userId, mapId, body) {
  if (
    !Array.isArray(body.nodes) ||
    body.nodes.length > 60 ||
    !Array.isArray(body.edges) ||
    body.edges.length > 120
  )
    fail('Invalid suggestion.')
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const map = await ownerMap(client, userId, mapId)
    const count = Number(
      (
        await client.query('SELECT COUNT(*)::int AS n FROM learning_nodes WHERE map_id=$1', [
          map.id,
        ])
      ).rows[0].n,
    )
    if (count + body.nodes.length > 500) fail('Node limit reached.', 'LIMIT_REACHED')
    const refs = new Map(),
      created = []
    for (const n of body.nodes) {
      if (
        !n ||
        typeof n !== 'object' ||
        typeof n.ref !== 'string' ||
        !/^new:[A-Za-z0-9_-]{1,64}$/.test(n.ref) ||
        refs.has(n.ref)
      )
        fail('Invalid ref.')
      kindValue(n.kind)
      text(n.title, { field: 'title', max: 160 })
      maybeText(n.description, 'description', 1000)
      if (n.parent_ref != null && typeof n.parent_ref !== 'string') fail('Invalid parent ref.')
      refs.set(n.ref, n)
    }
    const existing = (
      await client.query('SELECT id FROM learning_nodes WHERE user_id=$1 AND map_id=$2', [
        userId,
        map.id,
      ])
    ).rows.map((r) => r.id)
    for (const n of body.nodes) {
      if (n.parent_ref != null) {
        if (n.parent_ref.startsWith('new:')) {
          if (!refs.has(n.parent_ref)) fail('Invalid parent ref.')
        } else if (n.parent_ref.startsWith('id:')) {
          const parent = id(n.parent_ref.slice(3))
          if (!existing.includes(parent)) fail('Invalid parent ref.')
        } else fail('Invalid parent ref.')
      }
    }
    const pending = [...body.nodes]
    while (pending.length) {
      let inserted = false
      for (let i = 0; i < pending.length; i++) {
        const n = pending[i]
        if (n.parent_ref?.startsWith('new:') && !created.some((x) => x.ref === n.parent_ref))
          continue
        const parentRef = n.parent_ref?.startsWith('new:')
          ? created.find((x) => x.ref === n.parent_ref).id
          : n.parent_ref?.startsWith('id:')
            ? id(n.parent_ref.slice(3))
            : null
        const row = (
          await client.query(
            "INSERT INTO learning_nodes(user_id,map_id,parent_id,kind,title,description,status,position) VALUES($1,$2,$3,$4,$5,$6,'not_started',COALESCE((SELECT MAX(position)+1 FROM learning_nodes WHERE map_id=$2),0)) RETURNING *",
            [
              userId,
              map.id,
              parentRef ?? null,
              kindValue(n.kind),
              text(n.title, { field: 'title', max: 160 }),
              maybeText(n.description, 'description', 1000),
            ],
          )
        ).rows[0]
        created.push({ ref: n.ref, id: row.id, row })
        pending.splice(i, 1)
        inserted = true
        break
      }
      if (!inserted) fail('Suggestion has invalid parent references.')
    }
    let edges = (
      await client.query('SELECT from_id,to_id FROM learning_edges WHERE map_id=$1', [map.id])
    ).rows
    const made = []
    let edgeCount = edges.length
    for (const e of body.edges) {
      if (
        !e ||
        typeof e !== 'object' ||
        typeof e.from_ref !== 'string' ||
        typeof e.to_ref !== 'string'
      )
        fail('Invalid edge.')
      const resolve = (ref) =>
        ref?.startsWith('new:')
          ? created.find((x) => x.ref === ref)?.id
          : ref?.startsWith('id:')
            ? Number(ref.slice(3))
            : null
      const from = resolve(e.from_ref),
        to = resolve(e.to_ref)
      if (!from || !to || from === to) continue
      if (
        (!created.some((x) => x.id === from) && !existing.includes(from)) ||
        (!created.some((x) => x.id === to) && !existing.includes(to))
      )
        continue
      if (
        edges.some((x) => Number(x.from_id) === from && Number(x.to_id) === to) ||
        wouldCreateCycle(edges, from, to) ||
        edgeCount >= 1000
      )
        continue
      const row = (
        await client.query(
          'INSERT INTO learning_edges(user_id,map_id,from_id,to_id) VALUES($1,$2,$3,$4) RETURNING *',
          [userId, map.id, from, to],
        )
      ).rows[0]
      made.push(row)
      edges.push(row)
      edgeCount++
    }
    return { nodes: created.map((x) => x.row), edges: made }
  })
}
export async function learningSummary(userId) {
  const { rows: mapRows } = await query(
    'SELECT id,title FROM learning_maps WHERE user_id=$1 AND archived_at IS NULL ORDER BY position,id',
    [userId],
  )
  const { rows: nodes } = await query(
    'SELECT n.* FROM learning_nodes n JOIN learning_maps m ON m.id=n.map_id WHERE n.user_id=$1 AND m.archived_at IS NULL',
    [userId],
  )
  const stats = mapStats(nodes)
  const maps = new Map(mapRows.map((map) => [Number(map.id), map.title]))
  const latest = await query(
    "SELECT COUNT(*)::int AS active FROM learning_nodes n JOIN learning_maps m ON m.id=n.map_id WHERE n.user_id=$1 AND m.user_id=$1 AND m.archived_at IS NULL AND n.status_changed_at>=NOW()-INTERVAL '7 days'",
    [userId],
  )
  const { rows: allNodes } = await query(
    'SELECT n.* FROM learning_nodes n JOIN learning_maps m ON m.id=n.map_id WHERE n.user_id=$1 AND m.archived_at IS NULL',
    [userId],
  )
  const { rows: edges } = await query(
    'SELECT e.from_id,e.to_id FROM learning_edges e JOIN learning_maps m ON m.id=e.map_id WHERE e.user_id=$1 AND m.archived_at IS NULL',
    [userId],
  )
  const { nextSteps } = await import('./learning-shape.mjs')
  const next = nextSteps(allNodes, edges, 3).map((n) => ({
    map_id: n.map_id,
    map_title: maps.get(n.map_id) || '',
    node_id: n.id,
    node_title: n.title,
    status: n.status,
  }))
  const xp =
    Number(
      (
        await query(
          "SELECT COUNT(*)::int AS n FROM learning_nodes WHERE user_id=$1 AND status='mastered' AND mastered_at IS NOT NULL",
          [userId],
        )
      ).rows[0].n,
    ) * 30
  return {
    maps: maps.size,
    nodes: stats.nodes,
    mastered: stats.mastered,
    percent: stats.percent,
    goals: stats.goals,
    goals_done: stats.goals_done,
    active_7d: latest.rows[0].active,
    xp,
    next,
  }
}
