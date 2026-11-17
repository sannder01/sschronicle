// Pure helpers for nested task folders, shared by the server and the browser.

/** True when making `parentId` the parent of `id` would put a folder inside itself. */
export function wouldCreateCycle(folders, id, parentId) {
  if (parentId == null) return false
  const parentOf = new Map(
    folders.map((f) => [Number(f.id), f.parent_id == null ? null : Number(f.parent_id)]),
  )
  for (let cursor = Number(parentId), steps = 0; cursor != null; steps++) {
    if (cursor === Number(id) || steps > folders.length) return true
    cursor = parentOf.get(cursor) ?? null
  }
  return false
}

/** Depth of each folder (0 for top level), tolerant of broken or cyclic data. */
export function folderDepths(folders) {
  const parentOf = new Map(
    folders.map((f) => [Number(f.id), f.parent_id == null ? null : Number(f.parent_id)]),
  )
  const depths = new Map()
  for (const f of folders) {
    let depth = 0
    for (
      let cursor = parentOf.get(Number(f.id));
      cursor != null && depth <= folders.length;
      depth++
    )
      cursor = parentOf.get(cursor) ?? null
    depths.set(Number(f.id), depth)
  }
  return depths
}

/** Folders in tree order (each parent followed by its children), with depth. */
export function folderTree(folders) {
  const ids = new Set(folders.map((f) => Number(f.id)))
  const children = new Map()
  for (const f of folders) {
    const parent = f.parent_id != null && ids.has(Number(f.parent_id)) ? Number(f.parent_id) : null
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent).push(f)
  }
  const out = [],
    seen = new Set()
  const walk = (parent, depth) => {
    for (const f of children.get(parent) || []) {
      if (seen.has(Number(f.id))) continue
      seen.add(Number(f.id))
      out.push({ ...f, depth })
      walk(Number(f.id), depth + 1)
    }
  }
  walk(null, 0)
  // anything left over (only possible with corrupt data) still shows at the top level
  for (const f of folders) if (!seen.has(Number(f.id))) out.push({ ...f, depth: 0 })
  return out
}

/** The folder itself plus every folder nested inside it. */
export function descendantIds(folders, id) {
  const out = new Set([Number(id)])
  let grew = true
  while (grew) {
    grew = false
    for (const f of folders)
      if (f.parent_id != null && out.has(Number(f.parent_id)) && !out.has(Number(f.id))) {
        out.add(Number(f.id))
        grew = true
      }
  }
  return out
}

/** Options for a folder picker, indented by depth so the tree stays readable. */
export function folderOptions(tree) {
  return tree.map((f) => ({ value: f.id, label: '\u00a0\u00a0\u00a0'.repeat(f.depth) + f.name }))
}
