'use client'
// List view of a map: topics as an indented tree (subtopics under their topic), with the
// status changeable right in the row. Works with the keyboard and on narrow screens.
import { useMemo } from 'react'
import { useApp } from '@/components/AppContext'
import Icon from '@/components/Icon'
import { Select } from '@/components/ui'
import { STATUSES, kindLabel } from './shared'

function treeOrder(nodes) {
  const ids = new Set(nodes.map((n) => n.id))
  const byParent = new Map()
  for (const n of [...nodes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id)) {
    const key = n.parent_id != null && ids.has(n.parent_id) ? n.parent_id : null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(n)
  }
  const out = [],
    seen = new Set()
  const walk = (parent, depth) => {
    for (const n of byParent.get(parent) || []) {
      if (seen.has(n.id)) continue
      seen.add(n.id)
      out.push({ node: n, depth })
      walk(n.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export default function MapTree({
  nodes,
  edges,
  selectedId,
  nextIds,
  lockedIds,
  dimIds,
  onSelect,
  onStatus,
}) {
  const { t } = useApp()
  const rows = useMemo(() => treeOrder(nodes), [nodes])
  const titleOf = useMemo(() => new Map(nodes.map((n) => [n.id, n.title])), [nodes])
  return (
    <ul className="lm-tree" aria-label={t('Темы карты', 'Topics of the map')}>
      {rows.map(({ node: n, depth }) => {
        const prereq = edges.filter((e) => e.to_id === n.id).map((e) => titleOf.get(e.from_id))
        return (
          <li
            key={n.id}
            className={`lm-tree-row ${n.status} ${selectedId === n.id ? 'selected' : ''} ${nextIds.has(n.id) ? 'next' : ''} ${dimIds?.has(n.id) ? 'dim' : ''}`}
            style={{ '--depth': depth }}
          >
            <button className="lm-tree-main" onClick={() => onSelect(n.id)}>
              <span className={`lm-status-dot ${n.status}`} aria-hidden="true" />
              <span className="lm-tree-text">
                <strong>{n.title}</strong>
                <small>
                  {kindLabel(n.kind, t)}
                  {nextIds.has(n.id) && (
                    <span className="cm-next-badge">{t('Дальше', 'Next')}</span>
                  )}
                  {lockedIds.has(n.id) && n.status !== 'mastered' && prereq.length > 0 && (
                    <span className="lm-tree-after">
                      <Icon name="clock" size={12} /> {t('после', 'after')}: {prereq.join(', ')}
                    </span>
                  )}
                </small>
              </span>
            </button>
            <Select
              className="lm-tree-status"
              aria-label={t('Статус темы ', 'Status of ') + n.title}
              value={n.status}
              onChange={(v) => v !== n.status && onStatus(n.id, v)}
              options={STATUSES.map((s) => ({ value: s.value, label: t(s.ru, s.en) }))}
            />
          </li>
        )
      })}
    </ul>
  )
}
