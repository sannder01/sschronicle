'use client'
// Interactive concept map: topic cards on a dotted plane, dependency arrows between them,
// thin dashed lines from a topic to its subtopics. Pan by dragging the plane, zoom with the
// wheel or pinch, drag cards to arrange (positions are saved), drag the round handle on a
// card onto another card to say "this must be learned first". The next step glows.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/components/AppContext'
import Icon from '@/components/Icon'
import { kindLabel, statusLabel } from './shared'

export const CARD_W = 200
export const CARD_H = 66
const GAP_X = 260
const GAP_Y = 120
const MIN_K = 0.25
const MAX_K = 2
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const snap = (v) => Math.round(v / 10) * 10

/**
 * Layered layout: a node sits one column right of its prerequisites and its parent topic.
 * Returns Map(id -> {x, y}) for every node.
 */
export function layeredLayout(nodes, edges) {
  const ids = new Set(nodes.map((n) => n.id))
  const before = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges)
    if (ids.has(e.from_id) && ids.has(e.to_id)) before.get(e.to_id).push(e.from_id)
  for (const n of nodes)
    if (n.parent_id != null && ids.has(n.parent_id)) before.get(n.id).push(n.parent_id)
  const level = new Map(),
    visiting = new Set()
  const depth = (id) => {
    if (level.has(id)) return level.get(id)
    if (visiting.has(id)) return 0 // defensive: data should be acyclic
    visiting.add(id)
    const d = before.get(id).reduce((m, p) => Math.max(m, depth(p) + 1), 0)
    visiting.delete(id)
    level.set(id, d)
    return d
  }
  const columns = new Map()
  const ordered = [...nodes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id)
  for (const n of ordered) {
    const d = depth(n.id)
    if (!columns.has(d)) columns.set(d, [])
    columns.get(d).push(n.id)
  }
  const out = new Map()
  for (const [d, list] of columns)
    list.forEach((id, i) =>
      out.set(id, { x: d * GAP_X, y: i * GAP_Y - ((list.length - 1) * GAP_Y) / 2 }),
    )
  return out
}

export default function ConceptMap({
  nodes,
  edges,
  selectedId,
  nextIds,
  dimIds,
  onSelect,
  onSavePositions,
  onConnect,
  onDeleteEdge,
  arrangeSignal,
}) {
  const { t } = useApp()
  const boardRef = useRef(null),
    worldRef = useRef(null),
    tempRef = useRef(null),
    zoomLabel = useRef(null),
    cam = useRef({ x: 0, y: 0, k: 1 }),
    pos = useRef(new Map()),
    cardEls = useRef(new Map()),
    edgeEls = useRef(new Map()),
    gesture = useRef(null),
    pointers = useRef(new Map()),
    suppressClick = useRef(false),
    fitted = useRef(false)
  const [selectedEdge, setSelectedEdge] = useState(null),
    [far, setFar] = useState(false)

  // hierarchy lines (topic → subtopic) are drawn but are not dependencies
  const treeLinks = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id))
    return nodes
      .filter((n) => n.parent_id != null && ids.has(n.parent_id))
      .map((n) => ({ id: 'tree:' + n.id, from_id: n.parent_id, to_id: n.id, tree: true }))
  }, [nodes])
  const allLinks = useMemo(() => [...treeLinks, ...edges], [treeLinks, edges])
  const linksRef = useRef(allLinks)
  linksRef.current = allLinks

  // ---------- positions: saved ones win, the rest come from the layered layout ----------
  useEffect(() => {
    const missing = nodes.filter((n) => n.x == null || n.y == null)
    const auto = missing.length ? layeredLayout(nodes, edges) : null
    const fresh = []
    for (const n of nodes) {
      if (pos.current.has(n.id)) continue // the local position is the latest one
      if (n.x != null && n.y != null) pos.current.set(n.id, { x: Number(n.x), y: Number(n.y) })
      else {
        const p = auto.get(n.id)
        pos.current.set(n.id, p)
        fresh.push({ id: n.id, x: Math.round(p.x), y: Math.round(p.y) })
      }
    }
    for (const id of [...pos.current.keys()])
      if (!nodes.some((n) => n.id === id)) pos.current.delete(id)
    if (fresh.length) onSavePositions?.(fresh)
    paint()
    if (!fitted.current && nodes.length) {
      fitted.current = true
      requestAnimationFrame(() => {
        cam.current = fitTarget()
        applyCamera()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  // "Arrange" button in the toolbar: redo the layout for everything and save it
  useEffect(() => {
    if (!arrangeSignal) return
    const layout = layeredLayout(nodes, edges)
    const list = []
    for (const [id, p] of layout) {
      pos.current.set(id, { ...p })
      list.push({ id, x: Math.round(p.x), y: Math.round(p.y) })
    }
    paint()
    onSavePositions?.(list)
    animateCamera(fitTarget())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangeSignal])

  // ---------- painting ----------
  const sizeOf = (id) => {
    const el = cardEls.current.get(id)
    return { w: el?.offsetWidth || CARD_W, h: el?.offsetHeight || CARD_H }
  }
  const edgePath = (link) => {
    const a = pos.current.get(link.from_id),
      b = pos.current.get(link.to_id)
    if (!a || !b) return null
    const sa = sizeOf(link.from_id),
      sb = sizeOf(link.to_id)
    const ca = { x: a.x + sa.w / 2, y: a.y + sa.h / 2 },
      cb = { x: b.x + sb.w / 2, y: b.y + sb.h / 2 }
    // leave from the side that faces the other card
    // cards in different columns join side to side; cards stacked in one column join top to bottom
    const horizontal = Math.abs(cb.x - ca.x) > (sa.w + sb.w) / 2
    let p1, p2, c1, c2
    if (horizontal) {
      const dir = cb.x > ca.x ? 1 : -1
      p1 = { x: ca.x + (dir * sa.w) / 2, y: ca.y }
      p2 = { x: cb.x - (dir * sb.w) / 2, y: cb.y }
      const k = Math.max(30, Math.abs(p2.x - p1.x) * 0.45)
      c1 = { x: p1.x + dir * k, y: p1.y }
      c2 = { x: p2.x - dir * k, y: p2.y }
    } else {
      const dir = cb.y > ca.y ? 1 : -1
      p1 = { x: ca.x, y: ca.y + (dir * sa.h) / 2 }
      p2 = { x: cb.x, y: cb.y - (dir * sb.h) / 2 }
      const k = Math.max(24, Math.abs(p2.y - p1.y) * 0.45)
      c1 = { x: p1.x, y: p1.y + dir * k }
      c2 = { x: p2.x, y: p2.y - dir * k }
    }
    return {
      d: `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`,
      mid: {
        x: 0.125 * p1.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p2.x,
        y: 0.125 * p1.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p2.y,
      },
    }
  }
  const paintEdge = (link) => {
    const els = edgeEls.current.get(String(link.id)),
      shape = els && edgePath(link)
    if (!shape) return
    els.line?.setAttribute('d', shape.d)
    els.hit?.setAttribute('d', shape.d)
    if (els.cut) els.cut.style.transform = `translate(${shape.mid.x}px, ${shape.mid.y}px)`
  }
  const placeCard = (id) => {
    const el = cardEls.current.get(id),
      p = pos.current.get(id)
    if (el && p) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
  }
  const paint = () => {
    for (const id of pos.current.keys()) placeCard(id)
    for (const l of linksRef.current) paintEdge(l)
  }
  useEffect(() => paint())

  // ---------- camera ----------
  const applyCamera = useCallback(() => {
    const { x, y, k } = cam.current,
      board = boardRef.current
    if (!board || !worldRef.current) return
    worldRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`
    let step = 24 * k
    while (step < 14) step *= 2
    board.style.backgroundPosition = `${x}px ${y}px`
    board.style.backgroundSize = `${step}px ${step}px`
    if (zoomLabel.current) zoomLabel.current.textContent = Math.round(k * 100) + '%'
    setFar(k < 0.55)
  }, [])
  const size = () => {
    const r = boardRef.current?.getBoundingClientRect()
    return r
      ? { w: r.width, h: r.height, left: r.left, top: r.top }
      : { w: 1, h: 1, left: 0, top: 0 }
  }
  const toWorld = (cx, cy) => {
    const { left, top } = size(),
      { x, y, k } = cam.current
    return { x: (cx - left - x) / k, y: (cy - top - y) / k }
  }
  const camAnim = useRef(0)
  function animateCamera(target) {
    cancelAnimationFrame(camAnim.current)
    const from = { ...cam.current },
      start = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - start) / 380),
        e = 1 - Math.pow(1 - p, 3)
      cam.current = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        k: from.k + (target.k - from.k) * e,
      }
      applyCamera()
      if (p < 1) camAnim.current = requestAnimationFrame(step)
    }
    camAnim.current = requestAnimationFrame(step)
  }
  function zoomAt(sx, sy, nk, animate) {
    nk = clamp(nk, MIN_K, MAX_K)
    const { x, y, k } = cam.current
    const target = { x: sx - (sx - x) * (nk / k), y: sy - (sy - y) * (nk / k), k: nk }
    if (animate) animateCamera(target)
    else {
      cam.current = target
      applyCamera()
    }
  }
  function fitTarget() {
    const { w, h } = size(),
      all = [...pos.current.entries()]
    if (!all.length) return { x: w / 2, y: h / 2, k: 1 }
    const minX = Math.min(...all.map(([, p]) => p.x)) - 40,
      maxX = Math.max(...all.map(([id, p]) => p.x + sizeOf(id).w)) + 40,
      minY = Math.min(...all.map(([, p]) => p.y)) - 40,
      maxY = Math.max(...all.map(([id, p]) => p.y + sizeOf(id).h)) + 40
    const k = clamp(Math.min(w / (maxX - minX), h / (maxY - minY), 1), MIN_K, MAX_K)
    return { x: (w - (maxX + minX) * k) / 2, y: (h - (maxY + minY) * k) / 2, k }
  }
  useEffect(() => {
    applyCamera()
    const observer = new ResizeObserver(() => applyCamera())
    if (boardRef.current) observer.observe(boardRef.current)
    return () => observer.disconnect()
  }, [applyCamera])

  // bring the selected card into view (e.g. picked in the list or from "Up next")
  useEffect(() => {
    if (selectedId == null) return
    const p = pos.current.get(selectedId)
    if (!p) return
    const { w, h } = size(),
      { x, y, k } = cam.current,
      s = sizeOf(selectedId)
    const sx = p.x * k + x,
      sy = p.y * k + y
    if (sx < 20 || sy < 20 || sx + s.w * k > w - 20 || sy + s.h * k > h - 20)
      animateCamera({ k, x: w / 2 - (p.x + s.w / 2) * k, y: h / 2 - (p.y + s.h / 2) * k })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ---------- gestures ----------
  function onPointerDown(e) {
    if (e.button > 0) return
    cancelAnimationFrame(camAnim.current)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()]
      gesture.current = {
        kind: 'pinch',
        dist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        k: cam.current.k,
      }
      return
    }
    if (e.target.closest('.cm-cut, .cm-toolbar')) return
    const handle = e.target.closest('.cm-handle'),
      card = e.target.closest('.cm-card')
    const base = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false }
    if (handle) {
      gesture.current = { ...base, kind: 'link', id: Number(handle.dataset.id), moved: true }
      e.preventDefault()
    } else if (card) {
      const id = Number(card.dataset.id),
        p = pos.current.get(id),
        w = toWorld(e.clientX, e.clientY)
      gesture.current = { ...base, kind: 'card', id, grabX: w.x - p.x, grabY: w.y - p.y }
      if (e.pointerType === 'mouse') e.preventDefault()
    } else if (!e.target.closest('.cm-edge-hit')) {
      gesture.current = { ...base, kind: 'pan', camX: cam.current.x, camY: cam.current.y }
    }
  }
  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      const [p1, p2] = [...pointers.current.values()]
      if (!p2) return
      const { left, top } = size()
      zoomAt(
        (p1.x + p2.x) / 2 - left,
        (p1.y + p2.y) / 2 - top,
        g.k * (Math.hypot(p1.x - p2.x, p1.y - p2.y) / g.dist),
      )
      return
    }
    if (e.pointerId !== g.pointerId) return
    if (!g.moved) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 4) return
      g.moved = true
    }
    if (!g.captured) {
      g.captured = true
      try {
        boardRef.current.setPointerCapture(e.pointerId)
      } catch {}
      if (g.kind === 'card') cardEls.current.get(g.id)?.setAttribute('data-lifted', '')
    }
    if (g.kind === 'pan') {
      cam.current.x = g.camX + (e.clientX - g.startX)
      cam.current.y = g.camY + (e.clientY - g.startY)
      applyCamera()
    } else if (g.kind === 'card') {
      const w = toWorld(e.clientX, e.clientY),
        p = pos.current.get(g.id)
      p.x = w.x - g.grabX
      p.y = w.y - g.grabY
      placeCard(g.id)
      for (const l of linksRef.current) if (l.from_id === g.id || l.to_id === g.id) paintEdge(l)
    } else if (g.kind === 'link') {
      const from = pos.current.get(g.id),
        s = sizeOf(g.id),
        w = toWorld(e.clientX, e.clientY)
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cm-card')
      const overId = over ? Number(over.dataset.id) : null
      g.over = overId !== g.id ? overId : null
      for (const [id, el] of cardEls.current) el.toggleAttribute('data-target', id === g.over)
      const x1 = from.x + s.w,
        y1 = from.y + s.h / 2
      tempRef.current?.setAttribute(
        'd',
        `M ${x1} ${y1} C ${x1 + 60} ${y1} ${w.x - 60} ${w.y} ${w.x} ${w.y}`,
      )
      tempRef.current?.setAttribute('data-visible', 'true')
    }
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      if (!pointers.current.size) gesture.current = null
      return
    }
    if (e.pointerId !== g.pointerId) return
    gesture.current = null
    if (g.kind === 'pan' && !g.moved) {
      setSelectedEdge(null)
    } else if (g.kind === 'card' && g.moved) {
      suppressClick.current = true
      setTimeout(() => (suppressClick.current = false), 0)
      cardEls.current.get(g.id)?.removeAttribute('data-lifted')
      const p = pos.current.get(g.id)
      p.x = snap(p.x)
      p.y = snap(p.y)
      paint()
      onSavePositions?.([{ id: g.id, x: p.x, y: p.y }])
    } else if (g.kind === 'link') {
      tempRef.current?.setAttribute('data-visible', 'false')
      for (const el of cardEls.current.values()) el.removeAttribute('data-target')
      if (g.over != null) onConnect?.(g.id, g.over)
    }
  }
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      cancelAnimationFrame(camAnim.current)
      const { left, top } = size()
      // the wheel zooms around the pointer; trackpad pinch arrives as ctrl+wheel
      if (e.deltaY) {
        const speed = e.ctrlKey || e.metaKey ? 0.01 : 0.0015
        zoomAt(e.clientX - left, e.clientY - top, cam.current.k * Math.exp(-e.deltaY * speed))
      }
      if (e.deltaX) {
        cam.current.x -= e.deltaX
        applyCamera()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onKeyDown(e) {
    if (e.target !== boardRef.current) return
    const { w, h } = size(),
      c = cam.current
    const pan = (dx, dy) => animateCamera({ ...c, x: c.x + dx, y: c.y + dy })
    if (e.key === 'ArrowLeft') pan(120, 0)
    else if (e.key === 'ArrowRight') pan(-120, 0)
    else if (e.key === 'ArrowUp') pan(0, 120)
    else if (e.key === 'ArrowDown') pan(0, -120)
    else if (e.key === '+' || e.key === '=') zoomAt(w / 2, h / 2, c.k * 1.25, true)
    else if (e.key === '-') zoomAt(w / 2, h / 2, c.k / 1.25, true)
    else if (e.key === '0') animateCamera(fitTarget())
    else return
    e.preventDefault()
  }
  useEffect(() => {
    const onKey = (e) => {
      if (!selectedEdge || !['Delete', 'Backspace'].includes(e.key)) return
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      e.preventDefault()
      onDeleteEdge?.(selectedEdge)
      setSelectedEdge(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const zoomBy = (f) => {
    const { w, h } = size()
    zoomAt(w / 2, h / 2, cam.current.k * f, true)
  }
  const edgeRef = (link, part) => (el) => {
    const key = String(link.id)
    const rec = edgeEls.current.get(key) || {}
    rec[part] = el
    edgeEls.current.set(key, rec)
  }

  return (
    <div
      ref={boardRef}
      className={`cm-board ${far ? 'is-far' : ''}`}
      role="application"
      aria-roledescription={t('карта знаний', 'concept map')}
      aria-label={t(
        'Карта знаний. Стрелки двигают вид, плюс и минус меняют масштаб, ноль показывает всё.',
        'Concept map. Arrows pan, plus and minus zoom, zero fits everything.',
      )}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={worldRef} className="cm-world">
        <svg className="cm-edges" aria-hidden="true">
          <defs>
            <marker
              id="cm-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path className="cm-arrow" d="M 0 1 L 10 5 L 0 9 z" />
            </marker>
            <marker
              id="cm-arrow-on"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path className="cm-arrow on" d="M 0 1 L 10 5 L 0 9 z" />
            </marker>
          </defs>
          {allLinks.map((l) => {
            const on = selectedId != null && (l.from_id === selectedId || l.to_id === selectedId)
            return (
              <g
                key={l.id}
                className={`cm-edge ${l.tree ? 'tree' : ''} ${on ? 'on' : ''} ${selectedEdge?.id === l.id ? 'selected' : ''}`}
                data-from={l.from_id}
                data-to={l.to_id}
              >
                <path
                  ref={edgeRef(l, 'line')}
                  className="cm-edge-line"
                  markerEnd={
                    l.tree
                      ? undefined
                      : on || selectedEdge?.id === l.id
                        ? 'url(#cm-arrow-on)'
                        : 'url(#cm-arrow)'
                  }
                />
                {!l.tree && (
                  <path
                    ref={edgeRef(l, 'hit')}
                    className="cm-edge-hit"
                    onClick={() => setSelectedEdge(l)}
                  />
                )}
              </g>
            )
          })}
          <path ref={tempRef} className="cm-temp" data-visible="false" />
        </svg>
        {selectedEdge && (
          <button
            ref={edgeRef(selectedEdge, 'cut')}
            className="cm-cut"
            aria-label={t('Убрать зависимость', 'Remove dependency')}
            onClick={() => {
              onDeleteEdge?.(selectedEdge)
              setSelectedEdge(null)
            }}
          >
            <Icon name="close" size={14} />
          </button>
        )}
        {nodes.map((n) => {
          const next = nextIds?.has(n.id)
          return (
            <div
              key={n.id}
              ref={(el) => (el ? cardEls.current.set(n.id, el) : cardEls.current.delete(n.id))}
              className={`cm-card ${n.kind} ${n.status} ${selectedId === n.id ? 'selected' : ''} ${next ? 'next' : ''} ${dimIds?.has(n.id) ? 'dim' : ''}`}
              data-id={n.id}
            >
              <button
                className="cm-card-body"
                aria-label={`${n.title}, ${kindLabel(n.kind, t)}, ${statusLabel(n.status, t)}${next ? ', ' + t('следующий шаг', 'next step') : ''}`}
                onClick={() => !suppressClick.current && onSelect?.(n.id)}
              >
                <span className="cm-card-meta">
                  <span className={`lm-status-dot ${n.status}`} aria-hidden="true" />
                  {kindLabel(n.kind, t)}
                  {next && <span className="cm-next-badge">{t('Дальше', 'Next')}</span>}
                </span>
                <strong className="cm-card-title">{n.title}</strong>
              </button>
              <span
                className="cm-handle"
                data-id={n.id}
                title={t(
                  'Потяните к теме, которая идёт после этой',
                  'Drag to the topic that comes after this one',
                )}
              />
            </div>
          )
        })}
      </div>

      <div className="cm-toolbar glass">
        <button
          className="icon-button"
          aria-label={t('Отдалить', 'Zoom out')}
          onClick={() => zoomBy(1 / 1.25)}
        >
          <Icon name="minus" size={18} />
        </button>
        <button
          ref={zoomLabel}
          className="cm-zoom-label"
          aria-label={t('Показать всё', 'Fit everything')}
          onClick={() => animateCamera(fitTarget())}
        >
          100%
        </button>
        <button
          className="icon-button"
          aria-label={t('Приблизить', 'Zoom in')}
          onClick={() => zoomBy(1.25)}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
      <p className="cm-hint" aria-hidden="true">
        {selectedEdge
          ? t(
              'Нажмите × или Delete, чтобы убрать зависимость',
              'Press × or Delete to remove the dependency',
            )
          : t(
              'Тяните кружок справа от темы к следующей теме — так появится зависимость',
              'Drag the dot on the right of a topic to the next topic to add a dependency',
            )}
      </p>
    </div>
  )
}
