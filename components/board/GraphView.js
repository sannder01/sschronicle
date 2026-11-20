'use client'
// Graph view in the manner of Obsidian's graph: every folder and task is a dot, joined by
// lines, laid out live by a force simulation (d3-force, the engine Quartz and Obsidian-like
// graphs use). Hover lights a node and its neighbours; drag a node and the rest follow;
// labels fade in as you zoom. Shift-drag from one node to another draws a new link.
// Data-agnostic: the page passes `items`, fixed `structure` edges (folder → contents)
// and an `adapter` for hand-drawn links.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { forceSimulation, forceManyBody, forceLink, forceX, forceY, forceCollide } from 'd3-force'
import { useApp } from '@/components/AppContext'
import { ErrorState } from '@/components/ui'
import Icon from '@/components/Icon'
import './graph.css'

const MIN_K = 0.15
const MAX_K = 4
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const NO_STRUCTURE = []
const SETTINGS_KEY = 'chronicle.graph.settings'
const DEFAULTS = {
  search: '',
  showDone: false,
  orphans: true,
  arrows: false,
  textFade: 0.7,
  nodeSize: 1,
  linkWidth: 1,
  center: 0.05,
  repel: 260,
  linkForce: 0.6,
  linkDistance: 90,
}

function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
      setSettings((s) => ({ ...s, ...saved, search: '' }))
    } catch {}
  }, [])
  const update = useCallback((patch) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        const { search, ...keep } = next // eslint-disable-line no-unused-vars
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(keep))
      } catch {}
      return next
    })
  }, [])
  return [settings, update]
}

export default function GraphView({
  items,
  loading,
  error,
  onRetry,
  adapter,
  onOpen,
  empty,
  structure = NO_STRUCTURE,
  canConnect,
}) {
  const { t, notify } = useApp()
  const [settings, update] = useSettings()
  const [links, setLinks] = useState([]),
    [hover, setHover] = useState(null),
    [selectedLink, setSelectedLink] = useState(null),
    [panelOpen, setPanelOpen] = useState(false)

  const svgRef = useRef(null),
    worldRef = useRef(null),
    tempRef = useRef(null),
    zoomLabel = useRef(null),
    cam = useRef({ x: 0, y: 0, k: 1 }),
    nodeMap = useRef(new Map()), // id -> simulation node (keeps x/y between renders)
    nodeEls = useRef(new Map()),
    edgeEls = useRef(new Map()),
    sim = useRef(null),
    gesture = useRef(null),
    fitted = useRef(false),
    textFade = useRef(settings.textFade)
  textFade.current = settings.textFade

  // ---------------- data ----------------
  useEffect(() => {
    let alive = true
    adapter
      .listLinks()
      .then((list) => alive && setLinks(list))
      .catch(() => notify(t('Не удалось загрузить связи', 'Could not load the links'), 'error'))
    return () => {
      alive = false
    }
  }, [adapter, notify, t])

  const query = settings.search.trim().toLowerCase()
  const graph = useMemo(() => {
    let shown = items.filter((i) => settings.showDone || !i.done)
    if (query) shown = shown.filter((i) => i.title.toLowerCase().includes(query))
    const ids = new Set(shown.map((i) => i.id))
    const edges = [...links, ...structure].filter((l) => ids.has(l.from_id) && ids.has(l.to_id))
    const degree = new Map()
    for (const e of edges) {
      degree.set(e.from_id, (degree.get(e.from_id) || 0) + 1)
      degree.set(e.to_id, (degree.get(e.to_id) || 0) + 1)
    }
    if (!settings.orphans) shown = shown.filter((i) => degree.get(i.id))
    const neighbours = new Map(shown.map((i) => [i.id, new Set()]))
    for (const e of edges) {
      neighbours.get(e.from_id)?.add(e.to_id)
      neighbours.get(e.to_id)?.add(e.from_id)
    }
    return {
      nodes: shown,
      edges: edges.filter((e) => neighbours.has(e.from_id) && neighbours.has(e.to_id)),
      degree,
      neighbours,
    }
  }, [items, links, structure, settings.showDone, settings.orphans, query])

  const radius = useCallback(
    (item) =>
      settings.nodeSize *
      ((item.kind === 'folder' ? 6 : 4) + Math.sqrt(graph.degree.get(item.id) || 0) * 2.2),
    [settings.nodeSize, graph.degree],
  )

  // ---------------- camera ----------------
  const applyCamera = useCallback(() => {
    const { x, y, k } = cam.current
    worldRef.current?.setAttribute('transform', `translate(${x} ${y}) scale(${k})`)
    // labels fade in past the threshold, like Obsidian's "Text fade threshold":
    // folder names first, the names of what is inside them only when zoomed in closer
    const fade = (from) => clamp((k - from) / 0.35 + 0.5, 0, 1)
    svgRef.current?.style.setProperty('--label-folder', fade(textFade.current - 0.25))
    svgRef.current?.style.setProperty('--label-task', fade(textFade.current + 0.6))
    if (zoomLabel.current) zoomLabel.current.textContent = Math.round(k * 100) + '%'
  }, [])
  useEffect(applyCamera, [settings.textFade, applyCamera])

  const size = () => {
    const r = svgRef.current?.getBoundingClientRect()
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
      const p = Math.min(1, (now - start) / 420),
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
  const fitTarget = () => {
    const { w, h } = size(),
      nodes = [...nodeMap.current.values()].filter((n) => nodeEls.current.has(n.id))
    if (!nodes.length) return { x: w / 2, y: h / 2, k: 1 }
    const xs = nodes.map((n) => n.x),
      ys = nodes.map((n) => n.y)
    const minX = Math.min(...xs) - 60,
      maxX = Math.max(...xs) + 60,
      minY = Math.min(...ys) - 60,
      maxY = Math.max(...ys) + 60
    const k = clamp(Math.min(w / (maxX - minX), h / (maxY - minY), 1.1), MIN_K, MAX_K)
    return { x: (w - (maxX + minX) * k) / 2, y: (h - (maxY + minY) * k) / 2, k }
  }

  // ---------------- painting (outside React, every simulation tick) ----------------
  const paint = useCallback(() => {
    for (const [id, el] of nodeEls.current) {
      const n = nodeMap.current.get(id)
      if (n) el.setAttribute('transform', `translate(${n.x} ${n.y})`)
    }
    for (const [, { el, hit, from, to }] of edgeEls.current) {
      const a = nodeMap.current.get(from),
        b = nodeMap.current.get(to)
      if (!a || !b) continue
      for (const line of [el, hit]) {
        if (!line) continue
        line.setAttribute('x1', a.x)
        line.setAttribute('y1', a.y)
        line.setAttribute('x2', b.x)
        line.setAttribute('y2', b.y)
      }
    }
  }, [])

  // ---------------- simulation ----------------
  useEffect(() => {
    if (loading) return
    const map = nodeMap.current
    // keep known nodes where they are; new ones appear beside a neighbour or near the middle
    const nodes = graph.nodes.map((item) => {
      let n = map.get(item.id)
      if (!n) {
        const near = [...graph.neighbours.get(item.id)].map((id) => map.get(id)).find(Boolean)
        const angle = Math.random() * Math.PI * 2
        n = {
          id: item.id,
          x: (near?.x || 0) + Math.cos(angle) * 40,
          y: (near?.y || 0) + Math.sin(angle) * 40,
        }
        map.set(item.id, n)
      }
      n.r = radius(item)
      return n
    })
    for (const id of [...map.keys()]) if (!graph.neighbours.has(id)) map.delete(id)
    const simLinks = graph.edges.map((e) => ({ source: e.from_id, target: e.to_id }))

    const s = sim.current || forceSimulation().on('tick', paint)
    sim.current = s
    s.nodes(nodes)
      .force('charge', forceManyBody().strength(-settings.repel).distanceMax(900))
      .force(
        'link',
        forceLink(simLinks)
          .id((d) => d.id)
          .distance(settings.linkDistance)
          .strength(settings.linkForce),
      )
      .force('x', forceX(0).strength(settings.center))
      .force('y', forceY(0).strength(settings.center))
      .force(
        'collide',
        forceCollide((d) => d.r + 4),
      )

    if (!fitted.current && nodes.length) {
      // settle quietly first so the first view is already laid out, then frame it
      s.alpha(1).stop()
      for (let i = 0; i < 160; i++) s.tick()
      paint()
      fitted.current = true
      requestAnimationFrame(() => {
        cam.current = fitTarget()
        applyCamera()
      })
      s.alpha(0.05).restart()
    } else {
      s.alpha(Math.max(s.alpha(), 0.4)).restart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    graph,
    loading,
    settings.repel,
    settings.linkDistance,
    settings.linkForce,
    settings.center,
    radius,
    paint,
  ])

  useEffect(() => () => sim.current?.stop(), [])
  // after every render: elements may be new, put them where the simulation says
  useEffect(() => paint())
  useEffect(() => {
    applyCamera()
    const observer = new ResizeObserver(() => applyCamera())
    if (svgRef.current) observer.observe(svgRef.current)
    return () => observer.disconnect()
  }, [applyCamera])

  // ---------------- gestures ----------------
  const pointers = useRef(new Map())
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
    const nodeEl = e.target.closest('[data-node]')
    const base = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false }
    if (nodeEl) {
      const id = Number(nodeEl.dataset.node)
      gesture.current = { ...base, kind: e.shiftKey ? 'link' : 'node', id }
      e.preventDefault()
    } else if (!e.target.closest('[data-edge]')) {
      gesture.current = { ...base, kind: 'pan', camX: cam.current.x, camY: cam.current.y }
    }
    // capture drags only; a click on an edge must still reach the edge
    if (gesture.current?.pointerId === e.pointerId)
      try {
        svgRef.current.setPointerCapture(e.pointerId)
      } catch {}
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
    if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 4) return
    g.moved = true
    if (g.kind === 'pan') {
      cam.current.x = g.camX + (e.clientX - g.startX)
      cam.current.y = g.camY + (e.clientY - g.startY)
      applyCamera()
    } else if (g.kind === 'node') {
      const n = nodeMap.current.get(g.id),
        w = toWorld(e.clientX, e.clientY)
      if (!n) return
      n.fx = w.x
      n.fy = w.y
      if (!g.heated) {
        g.heated = true
        setHover(g.id)
        sim.current?.alphaTarget(0.3).restart()
      }
    } else if (g.kind === 'link') {
      const n = nodeMap.current.get(g.id),
        w = toWorld(e.clientX, e.clientY)
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-node]')
      const overId = over ? Number(over.dataset.node) : null
      g.over = overId !== g.id ? overId : null
      const end = g.over != null ? nodeMap.current.get(g.over) : w
      const line = tempRef.current
      if (line && n) {
        line.setAttribute('x1', n.x)
        line.setAttribute('y1', n.y)
        line.setAttribute('x2', end.x)
        line.setAttribute('y2', end.y)
        line.setAttribute('data-visible', 'true')
      }
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
      setSelectedLink(null)
      setHover(null)
    } else if (g.kind === 'node') {
      const n = nodeMap.current.get(g.id)
      if (g.moved && n) {
        n.fx = n.fy = null
        sim.current?.alphaTarget(0)
        setHover(null)
      } else if (!g.moved) {
        const item = items.find((i) => i.id === g.id)
        if (item) onOpen(item)
      }
    } else if (g.kind === 'link') {
      tempRef.current?.setAttribute('data-visible', 'false')
      if (g.over != null) connect(g.id, g.over)
    }
  }
  function onWheel(e) {
    e.preventDefault()
    cancelAnimationFrame(camAnim.current)
    const { left, top } = size()
    // Obsidian zooms on the wheel; trackpad pinch arrives as ctrl+wheel and zooms faster
    const speed = e.ctrlKey || e.metaKey ? 0.01 : 0.0015
    zoomAt(e.clientX - left, e.clientY - top, cam.current.k * Math.exp(-e.deltaY * speed))
  }
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // ---------------- links ----------------
  async function connect(a, b) {
    const refusal = canConnect?.(a, b)
    if (refusal) return notify(refusal)
    const [from_id, to_id] = a < b ? [a, b] : [b, a]
    if ([...links, ...structure].some((l) => l.from_id === from_id && l.to_id === to_id)) return
    const temp = { id: 'temp-' + Date.now(), from_id, to_id }
    setLinks((list) => [...list, temp])
    try {
      const created = await adapter.createLink(from_id, to_id)
      setLinks((list) => list.map((l) => (l.id === temp.id ? created : l)))
    } catch {
      setLinks((list) => list.filter((l) => l.id !== temp.id))
      notify(t('Не удалось создать связь', 'Could not create the link'), 'error')
    }
  }
  async function cut(link) {
    if (!link || link.fixed) return
    setLinks((list) => list.filter((l) => l.id !== link.id))
    setSelectedLink(null)
    if (String(link.id).startsWith('temp-')) return
    try {
      await adapter.deleteLink(link.id)
    } catch {
      setLinks((list) => [...list, link])
      notify(t('Не удалось убрать связь', 'Could not remove the link'), 'error')
    }
  }
  useEffect(() => {
    const onKey = (e) => {
      if (!selectedLink || !['Delete', 'Backspace'].includes(e.key)) return
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      e.preventDefault()
      cut(selectedLink)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------------- keyboard on the canvas ----------------
  function onKeyDown(e) {
    if (e.target !== svgRef.current) return
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

  // ---------------- render ----------------
  const lit = hover != null ? graph.neighbours.get(hover) : null
  const titleOf = (id) => items.find((i) => i.id === id)?.title || ''
  const zoomBy = (f) => {
    const { w, h } = size()
    zoomAt(w / 2, h / 2, cam.current.k * f, true)
  }

  if (error) return <ErrorState error={error} onRetry={onRetry} t={t} />
  return (
    <div className="graph">
      <svg
        ref={svgRef}
        className={`graph-canvas ${hover != null ? 'has-hover' : ''}`}
        role="application"
        aria-roledescription={t('граф', 'graph')}
        aria-label={t(
          'Граф папок и задач. Стрелки двигают вид, плюс и минус меняют масштаб, ноль показывает всё.',
          'Graph of folders and tasks. Arrows pan, plus and minus zoom, zero fits everything.',
        )}
        aria-busy={loading}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <marker
            id="graph-arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path className="graph-arrow" d="M 0 1 L 10 5 L 0 9 z" />
          </marker>
        </defs>
        <g ref={worldRef}>
          <g className="graph-edges">
            {graph.edges.map((e) => {
              const key = String(e.id)
              const on = lit ? hover === e.from_id || hover === e.to_id : false
              const ref = (el, part) => {
                const rec = edgeEls.current.get(key) || { from: e.from_id, to: e.to_id }
                rec[part] = el
                rec.from = e.from_id
                rec.to = e.to_id
                if (el) edgeEls.current.set(key, rec)
                else if (part === 'el') edgeEls.current.delete(key)
              }
              return (
                <g
                  key={key}
                  className={`graph-edge ${e.fixed ? 'fixed' : ''} ${on ? 'lit' : ''} ${selectedLink?.id === e.id ? 'selected' : ''}`}
                  data-edge={key}
                  data-from={e.from_id}
                  data-to={e.to_id}
                >
                  <line
                    ref={(el) => ref(el, 'el')}
                    className="graph-line"
                    style={{ strokeWidth: settings.linkWidth * (on ? 1.6 : 1) }}
                    markerEnd={settings.arrows ? 'url(#graph-arrow)' : undefined}
                  />
                  {!e.fixed && (
                    <line
                      ref={(el) => ref(el, 'hit')}
                      className="graph-hit"
                      onClick={() => setSelectedLink(e)}
                    />
                  )}
                </g>
              )
            })}
            <line ref={tempRef} className="graph-temp" data-visible="false" />
          </g>
          <g className="graph-nodes">
            {graph.nodes.map((item) => {
              const r = radius(item)
              const state =
                hover === item.id ? 'focus' : lit ? (lit.has(item.id) ? 'near' : 'far') : ''
              const match = query && item.title.toLowerCase().includes(query)
              return (
                <g
                  key={item.id}
                  ref={(el) =>
                    el ? nodeEls.current.set(item.id, el) : nodeEls.current.delete(item.id)
                  }
                  className={`graph-node ${item.kind} ${state} ${item.done ? 'done' : ''} ${match ? 'match' : ''}`}
                  data-node={item.id}
                  style={item.color ? { '--node-color': item.color } : undefined}
                  tabIndex={0}
                  role="button"
                  aria-label={item.meta ? `${item.title}, ${item.meta}` : item.title}
                  onPointerEnter={() => !gesture.current && setHover(item.id)}
                  onPointerLeave={() => !gesture.current && setHover(null)}
                  onFocus={() => setHover(item.id)}
                  onBlur={() => setHover(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpen(item)
                    }
                  }}
                >
                  <circle className="graph-hit-node" r={Math.max(r + 6, 12)} />
                  <circle className="graph-dot" r={r} />
                  <text className="graph-label" y={r + 13}>
                    {item.title.length > 34 ? item.title.slice(0, 32) + '…' : item.title}
                  </text>
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      {!loading && !items.length && <div className="graph-empty">{empty}</div>}

      {selectedLink && (
        <div className="graph-linkbar glass" onPointerDown={(e) => e.stopPropagation()}>
          <span>
            {titleOf(selectedLink.from_id)} — {titleOf(selectedLink.to_id)}
          </span>
          <button className="graph-linkbar-remove" onClick={() => cut(selectedLink)}>
            {t('Убрать связь', 'Remove link')}
          </button>
        </div>
      )}

      <div className="graph-zoom glass" onPointerDown={(e) => e.stopPropagation()}>
        <button
          className="icon-button"
          aria-label={t('Отдалить', 'Zoom out')}
          onClick={() => zoomBy(1 / 1.3)}
        >
          <Icon name="minus" size={18} />
        </button>
        <button
          ref={zoomLabel}
          className="graph-zoom-label"
          aria-label={t('Показать всё', 'Fit everything')}
          onClick={() => animateCamera(fitTarget())}
        >
          100%
        </button>
        <button
          className="icon-button"
          aria-label={t('Приблизить', 'Zoom in')}
          onClick={() => zoomBy(1.3)}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>

      <GraphSettings
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        settings={settings}
        update={update}
        onReheat={() => sim.current?.alpha(1).restart()}
        t={t}
      />

      <p className="graph-hint" aria-hidden="true">
        {t(
          'Наведите на точку, чтобы увидеть связи. Клик открывает, Shift+перетаскивание создаёт связь',
          'Hover a dot to see its links. Click opens it, Shift+drag creates a link',
        )}
      </p>
      <ul className="sr-only" aria-label={t('Связи', 'Links')}>
        {links.map((l) => (
          <li key={l.id}>
            {titleOf(l.from_id)} — {titleOf(l.to_id)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Obsidian-style settings drawer: Filters, Display, Forces. */
function GraphSettings({ open, onToggle, settings, update, onReheat, t }) {
  const slider = (key, label, min, max, step) => (
    <label className="graph-slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[key]}
        onChange={(e) => update({ [key]: Number(e.target.value) })}
      />
    </label>
  )
  const toggle = (key, label) => (
    <label className="graph-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={settings[key]}
        onChange={(e) => update({ [key]: e.target.checked })}
      />
    </label>
  )
  return (
    <div
      className={`graph-settings glass ${open ? 'open' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        className="icon-button graph-settings-toggle"
        aria-expanded={open}
        aria-label={t('Настройки графа', 'Graph settings')}
        onClick={onToggle}
      >
        <Icon name={open ? 'close' : 'more'} size={18} />
      </button>
      {open && (
        <div className="graph-settings-body">
          <details open>
            <summary>{t('Фильтры', 'Filters')}</summary>
            <input
              className="graph-search"
              type="search"
              placeholder={t('Поиск…', 'Search…')}
              value={settings.search}
              onChange={(e) => update({ search: e.target.value })}
            />
            {toggle('showDone', t('Выполненные задачи', 'Done tasks'))}
            {toggle('orphans', t('Без связей', 'Orphans'))}
          </details>
          <details open>
            <summary>{t('Отображение', 'Display')}</summary>
            {toggle('arrows', t('Стрелки', 'Arrows'))}
            {slider('textFade', t('Порог появления текста', 'Text fade threshold'), 0.2, 2, 0.05)}
            {slider('nodeSize', t('Размер узлов', 'Node size'), 0.5, 2.5, 0.1)}
            {slider('linkWidth', t('Толщина связей', 'Link thickness'), 0.5, 4, 0.1)}
            <button className="graph-reheat" onClick={onReheat}>
              {t('Встряхнуть', 'Animate')}
            </button>
          </details>
          <details open>
            <summary>{t('Силы', 'Forces')}</summary>
            {slider('center', t('Притяжение к центру', 'Center force'), 0, 0.3, 0.01)}
            {slider('repel', t('Отталкивание', 'Repel force'), 20, 900, 10)}
            {slider('linkForce', t('Сила связей', 'Link force'), 0, 1, 0.05)}
            {slider('linkDistance', t('Длина связей', 'Link distance'), 30, 300, 5)}
          </details>
        </div>
      )}
    </div>
  )
}
