const statusOrder = { learning: 0, review: 1, not_started: 2, mastered: 3 }

/** Returns nodes in dependency order, with stable position/id tie breaking. */
export function topoOrder(nodes, edges) {
  const byId = new Map(nodes.map((node) => [Number(node.id), node]))
  const indegree = new Map(nodes.map((node) => [Number(node.id), 0]))
  const outgoing = new Map(nodes.map((node) => [Number(node.id), []]))
  for (const edge of edges) {
    const from = Number(edge.from_id),
      to = Number(edge.to_id)
    if (!byId.has(from) || !byId.has(to) || from === to) continue
    outgoing.get(from).push(to)
    indegree.set(to, indegree.get(to) + 1)
  }
  const compare = (a, b) =>
    Number(byId.get(a).position || 0) - Number(byId.get(b).position || 0) || a - b
  const ready = [...indegree]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort(compare)
  const ordered = []
  while (ready.length) {
    const id = ready.shift()
    ordered.push(byId.get(id))
    for (const next of outgoing.get(id)) {
      indegree.set(next, indegree.get(next) - 1)
      if (indegree.get(next) === 0) {
        ready.push(next)
        ready.sort(compare)
      }
    }
  }
  // Keep corrupt cyclic components visible without looping.
  for (const node of [...nodes].sort((a, b) => compare(Number(a.id), Number(b.id))))
    if (!ordered.some((item) => Number(item.id) === Number(node.id))) ordered.push(node)
  return ordered
}

export function wouldCreateCycle(edges, from, to) {
  const key = (v) => (typeof v === 'number' || /^\d+$/.test(String(v)) ? Number(v) : String(v))
  from = key(from)
  to = key(to)
  if (from === to) return true
  const outgoing = new Map()
  for (const edge of edges) {
    const a = key(edge.from_id),
      b = key(edge.to_id)
    if (!outgoing.has(a)) outgoing.set(a, [])
    outgoing.get(a).push(b)
  }
  const stack = [to],
    seen = new Set()
  while (stack.length) {
    const id = stack.pop()
    if (id === from) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...(outgoing.get(id) || []))
  }
  return false
}

export function nextSteps(nodes, edges, limit = 3) {
  const mastered = new Set(nodes.filter((n) => n.status === 'mastered').map((n) => Number(n.id)))
  const available = new Set(nodes.map((n) => Number(n.id)))
  for (const edge of edges)
    if (!mastered.has(Number(edge.from_id))) available.delete(Number(edge.to_id))
  const order = new Map(topoOrder(nodes, edges).map((node, index) => [Number(node.id), index]))
  return nodes
    .filter((n) => n.status !== 'mastered' && available.has(Number(n.id)))
    .sort(
      (a, b) =>
        (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2) ||
        order.get(Number(a.id)) - order.get(Number(b.id)) ||
        Number(a.position || 0) - Number(b.position || 0) ||
        Number(a.id) - Number(b.id),
    )
    .slice(0, Math.max(0, Number(limit) || 0))
}

export function mapStats(nodes) {
  const count = (status) => nodes.filter((n) => n.status === status).length
  const goals = nodes.filter((n) => n.kind === 'goal')
  const timestamps = nodes
    .flatMap((n) => [n.status_changed_at, n.updated_at])
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
  const mastered = count('mastered')
  return {
    nodes: nodes.length,
    mastered,
    learning: count('learning'),
    review: count('review'),
    not_started: count('not_started'),
    percent: nodes.length ? Math.round((100 * mastered) / nodes.length) : 0,
    goals: goals.length,
    goals_done: goals.filter((n) => n.status === 'mastered').length,
    last_activity: timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null,
  }
}

export function nodeTree(nodes) {
  const ids = new Set(nodes.map((node) => Number(node.id)))
  const children = new Map()
  for (const node of nodes) {
    const parent =
      node.parent_id != null && ids.has(Number(node.parent_id)) ? Number(node.parent_id) : null
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent).push(node)
  }
  for (const group of children.values())
    group.sort(
      (a, b) => Number(a.position || 0) - Number(b.position || 0) || Number(a.id) - Number(b.id),
    )
  const out = [],
    seen = new Set()
  const walk = (parent, depth) => {
    for (const node of children.get(parent) || []) {
      const id = Number(node.id)
      if (seen.has(id)) continue
      seen.add(id)
      out.push({ ...node, depth })
      walk(id, depth + 1)
    }
  }
  walk(null, 0)
  for (const node of nodes) if (!seen.has(Number(node.id))) out.push({ ...node, depth: 0 })
  return out
}

/** Validate an untrusted assistant suggestion; throws on malformed refs or content. */
/**
 * Turns untrusted model output into a safe proposal. Broken parts are dropped, not fatal:
 * nodes with a bad title, unknown parent refs (become top level), edges to unknown nodes,
 * self-edges, duplicates and edges that would close a loop. Throws only when the output is
 * not a proposal at all or nothing usable is left.
 */
export function sanitizeSuggestion(raw, existingIds = []) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid suggestion')
  const inNodes = Array.isArray(raw.nodes) ? raw.nodes : []
  const inEdges = Array.isArray(raw.edges) ? raw.edges : []
  const existing = new Set(existingIds.map((id) => Number(String(id).replace(/^id:/, ''))))
  // models sometimes drop the prefix: "a1" means new:a1, "12" or 12 means id:12
  const normal = (ref) => {
    if (typeof ref === 'number') ref = String(ref)
    if (typeof ref !== 'string') return null
    ref = ref.trim()
    if (/^id:\d+$/.test(ref)) return ref
    if (/^\d+$/.test(ref)) return existing.has(Number(ref)) ? 'id:' + ref : 'new:' + ref
    if (/^new:[A-Za-z0-9_-]{1,64}$/.test(ref)) return ref
    if (/^[A-Za-z0-9_-]{1,64}$/.test(ref)) return 'new:' + ref
    return null
  }
  const declared = new Set(),
    nodes = []
  for (const node of inNodes.slice(0, 40)) {
    if (!node || typeof node !== 'object') continue
    const ref = normal(node.ref)
    if (!ref?.startsWith('new:') || declared.has(ref)) continue
    const kind = ['topic', 'subtopic', 'goal'].includes(node.kind) ? node.kind : 'topic'
    const title = typeof node.title === 'string' ? node.title.trim().slice(0, 160) : ''
    if (!title) continue
    const description =
      typeof node.description === 'string' ? node.description.trim().slice(0, 1000) : ''
    declared.add(ref)
    nodes.push({ ref, kind, title, description, parent_ref: normal(node.parent_ref) })
  }
  const known = (ref) =>
    ref != null &&
    (declared.has(ref) || (ref.startsWith('id:') && existing.has(Number(ref.slice(3)))))
  for (const node of nodes)
    if (!known(node.parent_ref) || node.parent_ref === node.ref) node.parent_ref = null
  // break parent loops among new nodes
  const parentOf = new Map(nodes.map((node) => [node.ref, node.parent_ref]))
  for (const node of nodes) {
    const seen = new Set([node.ref])
    let parent = node.parent_ref
    while (parent?.startsWith('new:')) {
      if (seen.has(parent)) {
        node.parent_ref = null
        parentOf.set(node.ref, null)
        break
      }
      seen.add(parent)
      parent = parentOf.get(parent)
    }
  }
  const edges = [],
    edgeKeys = new Set(),
    graph = []
  for (const edge of inEdges.slice(0, 80)) {
    if (!edge || typeof edge !== 'object') continue
    const from = normal(edge.from_ref),
      to = normal(edge.to_ref)
    if (!known(from) || !known(to) || from === to) continue
    const key = from + '>' + to
    if (edgeKeys.has(key) || wouldCreateCycle(graph, from, to)) continue
    edgeKeys.add(key)
    graph.push({ from_id: from, to_id: to })
    edges.push({ from_ref: from, to_ref: to })
  }
  const summary = typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 2000) : ''
  if (!nodes.length && !edges.length && !summary) throw new Error('empty suggestion')
  return { summary, nodes, edges }
}
