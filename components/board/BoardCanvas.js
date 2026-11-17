'use client'
// Board canvas: cards pinned to an infinite board and tied with red strings.
// Physics after Apple's "Designing Fluid Interfaces": 1:1 tracking, momentum
// projection, velocity handoff to springs, everything interruptible.
// Data-agnostic: the page passes `items`, an `adapter` for strings and positions, and
// optional `structure`: fixed threads (e.g. folder → task) drawn but never cut by hand.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { Button, ErrorState } from '@/components/ui'
import Icon from '@/components/Icon'
import { spring, project, velocityTracker, motionReduced } from '@/components/motion'
import './board.css'

const CARD_W = 210
const CARD_H = 112
const PIN_Y = 10
const MIN_Z = 0.3
const MAX_Z = 2.4
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const restTilt = (id) => ((((Math.abs(id) * 37) % 7) - 3) * 0.8).toFixed(2) * 1
const pinOf = (p) => ({ x: p.x + CARD_W / 2, y: p.y + PIN_Y })
const NO_STRUCTURE = []

export default function BoardCanvas({
  items: blocks,
  loading,
  error,
  onRetry,
  adapter,
  onToggle,
  onEdit,
  empty,
  structure = NO_STRUCTURE,
  canConnect,
}) {
  const { t, notify } = useApp()
  const [links, setLinks] = useState([]),
    [focus, setFocus] = useState(null), // hovered / selected card (graph highlight)
    [selected, setSelected] = useState(null), // { type: 'card'|'link', id }
    [linkFrom, setLinkFrom] = useState(null), // keyboard linking mode
    [arranging, setArranging] = useState(false)

  const boardRef = useRef(null),
    worldRef = useRef(null),
    farRef = useRef(null),
    nearRef = useRef(null),
    zoomLabel = useRef(null),
    tempPath = useRef(null),
    cam = useRef({ x: 0, y: 0, z: 1 }),
    camAnim = useRef([]),
    pos = useRef(new Map()), // id -> {x, y, r}
    cardEls = useRef(new Map()),
    pinEls = useRef(new Map()),
    cardAnim = useRef(new Map()),
    ropes = useRef(new Map()), // link id -> { mx, my, vx, vy, els }
    raf = useRef(0),
    gesture = useRef(null),
    pointers = useRef(new Map()),
    suppressClick = useRef(false),
    layoutRun = useRef(null),
    placedOnce = useRef(false),
    linksRef = useRef(links)
  // hand-tied strings plus the fixed structure threads: both are drawn and simulated
  const allLinks = useMemo(() => [...links, ...structure], [links, structure])
  linksRef.current = allLinks

  // ---------------- data: strings ----------------
  useEffect(() => {
    let alive = true
    adapter
      .listLinks()
      .then((list) => alive && setLinks(list))
      .catch(() => notify(t('Не удалось загрузить нити', 'Could not load the strings'), 'error'))
    return () => {
      alive = false
    }
  }, [adapter, notify, t])

  // Cards keep their place from the server; never-placed ones are laid out
  // (a grid on first view, the middle of the screen later) and saved once.
  useEffect(() => {
    if (loading) return
    for (const b of blocks)
      if (!pos.current.has(b.id) && b.canvas_x != null)
        pos.current.set(b.id, { x: b.canvas_x, y: b.canvas_y, r: restTilt(b.id) })
    const unplaced = blocks.filter((b) => !pos.current.has(b.id))
    let fresh
    if (!placedOnce.current) {
      const all = [...pos.current.values()]
      const startX = all.length ? Math.max(...all.map((p) => p.x)) + 300 : 0,
        startY = all.length ? Math.min(...all.map((p) => p.y)) : 0
      fresh = unplaced.map((b, i) => ({
        id: b.id,
        x: startX + (i % 4) * 270,
        y: startY + Math.floor(i / 4) * 210 + (i % 2) * 40,
      }))
    } else {
      const { w, h } = boardSize(),
        { x, y, z } = cam.current
      fresh = unplaced.map((b, i) => ({
        id: b.id,
        x: Math.round((w / 2 - x) / z - CARD_W / 2 + i * 30),
        y: Math.round((h / 2 - y) / z - CARD_H / 2 + i * 30),
      }))
    }
    placedOnce.current = true
    for (const f of fresh) pos.current.set(f.id, { x: f.x, y: f.y, r: restTilt(f.id) })
    for (const id of [...pos.current.keys()])
      if (!blocks.some((b) => b.id === id)) pos.current.delete(id)
    if (fresh.length) adapter.savePositions(fresh).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, loading, adapter])

  // ---------------- camera ----------------
  const applyCamera = useCallback(() => {
    const { x, y, z } = cam.current,
      board = boardRef.current
    if (!board || !worldRef.current) return
    worldRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${z})`
    // parallax: far layers drift slower and scale less than the board itself
    const still = motionReduced()
    const layer = (el, depth, size) => {
      if (!el) return
      const f = still ? 1 : depth
      el.style.backgroundPosition = `${x * f}px ${y * f}px`
      el.style.backgroundSize = `${size * (1 + (z - 1) * f)}px ${size * (1 + (z - 1) * f)}px`
    }
    layer(farRef.current, 0.25, 180)
    layer(nearRef.current, 0.6, 90)
    // cork grain and its larger mottling move and scale with the board, like a real surface
    board.style.backgroundPosition = `${x}px ${y}px, ${x}px ${y}px`
    board.style.backgroundSize = `${220 * z}px ${220 * z}px, ${640 * z}px ${640 * z}px`
    if (zoomLabel.current) zoomLabel.current.textContent = Math.round(z * 100) + '%'
  }, [])

  const stopCamera = () => {
    camAnim.current.forEach((a) => a.stop?.())
    camAnim.current = []
    cancelAnimationFrame(glideRaf.current)
  }
  const glideRaf = useRef(0)
  function glide(vx, vy) {
    if (motionReduced()) return
    let last = 0
    const step = (now) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      cam.current.x += vx * dt
      cam.current.y += vy * dt
      const k = Math.pow(0.998, dt * 1000) // UIScrollView normal deceleration
      vx *= k
      vy *= k
      applyCamera()
      if (Math.hypot(vx, vy) > 12) glideRaf.current = requestAnimationFrame(step)
    }
    glideRaf.current = requestAnimationFrame(step)
  }
  function animateCamera(target, { response = 0.5 } = {}) {
    stopCamera()
    const from = { ...cam.current }
    camAnim.current = ['x', 'y', 'z'].map((key) =>
      spring({
        from: from[key],
        to: target[key],
        damping: 1,
        response,
        onUpdate: (v) => {
          cam.current[key] = v
          applyCamera()
        },
      }),
    )
  }
  const boardSize = () => {
    const r = boardRef.current?.getBoundingClientRect()
    return r
      ? { w: r.width, h: r.height, left: r.left, top: r.top }
      : { w: 1, h: 1, left: 0, top: 0 }
  }
  const toWorld = (clientX, clientY) => {
    const { left, top } = boardSize(),
      { x, y, z } = cam.current
    return { x: (clientX - left - x) / z, y: (clientY - top - y) / z }
  }
  function zoomAt(sx, sy, nz, animate = false) {
    nz = clamp(nz, MIN_Z, MAX_Z)
    const { x, y, z } = cam.current
    const target = { x: sx - (sx - x) * (nz / z), y: sy - (sy - y) * (nz / z), z: nz }
    if (animate) animateCamera(target, { response: 0.35 })
    else {
      cam.current = target
      applyCamera()
    }
  }
  const fitTarget = useCallback(() => {
    const { w, h } = boardSize()
    const all = [...pos.current.values()]
    if (!all.length) return { x: w / 2, y: h / 2, z: 1 }
    const minX = Math.min(...all.map((p) => p.x)) - 60,
      maxX = Math.max(...all.map((p) => p.x)) + CARD_W + 60,
      minY = Math.min(...all.map((p) => p.y)) - 70,
      maxY = Math.max(...all.map((p) => p.y)) + CARD_H + 60
    const z = clamp(Math.min(w / (maxX - minX), h / (maxY - minY), 1.1), MIN_Z, MAX_Z)
    return { x: (w - (maxX + minX) * z) / 2, y: (h - (maxY + minY) * z) / 2, z }
  }, [])
  // first view of a day: fit everything, instantly
  const fitted = useRef(false)
  useEffect(() => {
    if (loading || fitted.current) return
    fitted.current = true
    requestAnimationFrame(() => {
      cam.current = fitTarget()
      applyCamera()
    })
  }, [loading, fitTarget, applyCamera])
  useEffect(() => {
    applyCamera()
    const observer = new ResizeObserver(() => applyCamera())
    if (boardRef.current) observer.observe(boardRef.current)
    return () => observer.disconnect()
  }, [applyCamera])

  // ---------------- cards & ropes rendering ----------------
  const placeCard = (id) => {
    const el = cardEls.current.get(id),
      p = pos.current.get(id)
    if (el && p) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.r}deg)`
    // the pin lives above the strings (it holds them down), so it is placed separately
    const pin = pinEls.current.get(id)
    if (pin && p) pin.setAttribute('transform', `translate(${p.x + CARD_W / 2} ${p.y + PIN_Y})`)
  }
  const ropeTarget = (link) => {
    const a = pos.current.get(link.from_id),
      b = pos.current.get(link.to_id)
    if (!a || !b) return null
    const pa = pinOf(a),
      pb = pinOf(b),
      len = Math.hypot(pb.x - pa.x, pb.y - pa.y)
    // gravity: a longer string droops more
    return { pa, pb, mx: (pa.x + pb.x) / 2, my: (pa.y + pb.y) / 2 + Math.min(90, 18 + len * 0.12) }
  }
  const drawRope = (link) => {
    const r = ropes.current.get(link.id),
      tg = ropeTarget(link)
    if (!r || !tg || !r.els.string) return
    const cx = 2 * r.mx - (tg.pa.x + tg.pb.x) / 2,
      cy = 2 * r.my - (tg.pa.y + tg.pb.y) / 2
    const d = `M ${tg.pa.x} ${tg.pa.y} Q ${cx} ${cy} ${tg.pb.x} ${tg.pb.y}`
    r.els.string.setAttribute('d', d)
    r.els.shadow?.setAttribute('d', d)
    r.els.hit?.setAttribute('d', d)
    if (r.els.cut) r.els.cut.style.transform = `translate(${r.mx}px, ${r.my}px)`
  }

  // one physics loop for every string: the midpoint is a mass on a soft spring,
  // so strings lag, sway and settle when a card moves
  const tick = useCallback(() => {
    let moving = false
    const dt = 1 / 60,
      w = (2 * Math.PI) / 0.7,
      k = w * w,
      c = 2 * 0.32 * w
    for (const link of linksRef.current) {
      const r = ropes.current.get(link.id),
        tg = ropeTarget(link)
      if (!r || !tg) continue
      if (r.mx == null) {
        r.mx = tg.mx
        r.my = tg.my
        r.vx = r.vy = 0
      }
      if (motionReduced()) {
        r.mx = tg.mx
        r.my = tg.my
      } else {
        for (let i = 0; i < 2; i++) {
          r.vx += (-k * (r.mx - tg.mx) - c * r.vx) * (dt / 2)
          r.vy += (-k * (r.my - tg.my) - c * r.vy) * (dt / 2)
          r.mx += r.vx * (dt / 2)
          r.my += r.vy * (dt / 2)
        }
      }
      drawRope(link)
      if (Math.abs(r.vx) + Math.abs(r.vy) > 0.6 || Math.hypot(r.mx - tg.mx, r.my - tg.my) > 0.4)
        moving = true
    }
    raf.current = moving || gesture.current || layoutRun.current ? requestAnimationFrame(tick) : 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const kick = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(tick)
  }, [tick])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // after every render: put cards where physics says, refresh strings
  useEffect(() => {
    for (const id of pos.current.keys()) placeCard(id)
    kick()
  })

  // ---------------- gestures ----------------
  function onBoardPointerDown(e) {
    if (e.button > 0) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    stopCamera()
    layoutRun.current?.stop()
    if (pointers.current.size === 2) {
      // pinch: zoom around the midpoint of two fingers
      const [p1, p2] = [...pointers.current.values()]
      gesture.current = {
        kind: 'pinch',
        dist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        z: cam.current.z,
      }
      return
    }
    const card = e.target.closest('.board-card'),
      pin = e.target.closest('.board-pin')
    if (e.target.closest('.card-check, .rope-cut')) return
    const base = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      tx: velocityTracker(),
      ty: velocityTracker(),
    }
    if (pin) {
      const id = Number(pin.dataset.id)
      gesture.current = { ...base, kind: 'link', id, active: true }
      try {
        boardRef.current.setPointerCapture(e.pointerId)
      } catch {}
      e.preventDefault()
    } else if (card) {
      const id = Number(card.dataset.id),
        p = pos.current.get(id)
      cardAnim.current.get(id)?.forEach((a) => a.stop())
      cardAnim.current.set(id, [])
      const w = toWorld(e.clientX, e.clientY)
      gesture.current = { ...base, kind: 'card', id, grabX: w.x - p.x, grabY: w.y - p.y, tilt: p.r }
      if (e.pointerType === 'mouse') e.preventDefault()
    } else {
      gesture.current = { ...base, kind: 'pan', camX: cam.current.x, camY: cam.current.y }
    }
    kick()
  }

  function onBoardPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      const [p1, p2] = [...pointers.current.values()]
      if (!p2) return
      const { left, top } = boardSize()
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      zoomAt((p1.x + p2.x) / 2 - left, (p1.y + p2.y) / 2 - top, g.z * (d / g.dist))
      return
    }
    if (e.pointerId !== g.pointerId) return
    if (!g.active) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 4) return
      g.active = true
      // capture only once it is really a drag, so plain clicks still reach the card
      try {
        boardRef.current.setPointerCapture(e.pointerId)
      } catch {}
      if (g.kind === 'card') {
        cardEls.current.get(g.id)?.setAttribute('data-lifted', 'true')
        setFocus(g.id)
      }
    }
    if (g.kind === 'pan') {
      cam.current.x = g.camX + (e.clientX - g.startX)
      cam.current.y = g.camY + (e.clientY - g.startY)
      g.tx.add(e.clientX)
      g.ty.add(e.clientY)
      applyCamera()
    } else if (g.kind === 'card') {
      const w = toWorld(e.clientX, e.clientY),
        p = pos.current.get(g.id)
      g.tx.add(w.x)
      g.ty.add(w.y)
      p.x = w.x - g.grabX
      p.y = w.y - g.grabY
      // the card leans into the direction it is pulled
      const lean = clamp(g.tx.velocity() / 140, -9, 9)
      g.tilt += (lean - g.tilt) * 0.25
      p.r = g.tilt
      placeCard(g.id)
    } else if (g.kind === 'link') {
      const from = pinOf(pos.current.get(g.id)),
        w = toWorld(e.clientX, e.clientY)
      g.end = w
      const hit = document.elementFromPoint(e.clientX, e.clientY),
        over = hit?.closest('.board-card') || hit?.closest('.board-pin')
      const overId = over ? Number(over.dataset.id) : null
      g.over = overId !== g.id ? overId : null
      for (const [id, el] of cardEls.current) el.toggleAttribute('data-target', id === g.over)
      const len = Math.hypot(w.x - from.x, w.y - from.y),
        mx = (from.x + w.x) / 2,
        my = (from.y + w.y) / 2 + Math.min(70, 10 + len * 0.1)
      tempPath.current?.setAttribute(
        'd',
        `M ${from.x} ${from.y} Q ${2 * mx - (from.x + w.x) / 2} ${2 * my - (from.y + w.y) / 2} ${w.x} ${w.y}`,
      )
      tempPath.current?.setAttribute('data-visible', 'true')
    }
  }

  function onBoardPointerUp(e) {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null
      return
    }
    if (e.pointerId !== g.pointerId) return
    gesture.current = null
    if (g.kind === 'pan') {
      if (g.active) glide(g.tx.velocity(), g.ty.velocity())
      else {
        setSelected(null)
        setFocus(null)
        setLinkFrom(null)
      }
    } else if (g.kind === 'card') {
      if (!g.active) return // a click; handled by the card button
      suppressClick.current = true
      setTimeout(() => (suppressClick.current = false), 0)
      releaseCard(g)
    } else if (g.kind === 'link') {
      for (const el of cardEls.current.values()) el.removeAttribute('data-target')
      if (g.over) connect(g.id, g.over)
      retractTemp(g)
    }
    kick()
  }

  /** Flick a card: project where it would glide to, hand the velocity to X and Y springs. */
  function releaseCard(g) {
    const id = g.id,
      p = pos.current.get(id),
      vx = g.tx.velocity(),
      vy = g.ty.velocity()
    cardEls.current.get(id)?.removeAttribute('data-lifted')
    const fast = Math.hypot(vx, vy) > 500
    const to = { x: p.x + project(vx, 0.995), y: p.y + project(vy, 0.995) }
    const opts = { damping: fast ? 0.8 : 1, response: 0.45 }
    const anims = [
      spring({
        from: p.x,
        to: to.x,
        velocity: vx,
        ...opts,
        onUpdate: (v) => ((p.x = v), placeCard(id)),
      }),
      spring({
        from: p.y,
        to: to.y,
        velocity: vy,
        ...opts,
        onUpdate: (v) => ((p.y = v), placeCard(id)),
      }),
      spring({
        from: p.r,
        to: restTilt(id),
        damping: 0.6,
        response: 0.5,
        onUpdate: (v) => ((p.r = v), placeCard(id)),
      }),
    ]
    cardAnim.current.set(id, anims)
    kick()
    savePosition(id, Math.round(to.x), Math.round(to.y))
  }

  function retractTemp(g) {
    const path = tempPath.current
    if (!path || !g.end) return path?.setAttribute('data-visible', 'false')
    const from = pinOf(pos.current.get(g.id)),
      end = { ...g.end }
    // the loose string springs back into the pin
    spring({
      from: 1,
      to: 0,
      damping: 0.9,
      response: 0.3,
      onUpdate: (k) => {
        const x = from.x + (end.x - from.x) * k,
          y = from.y + (end.y - from.y) * k
        path.setAttribute('d', `M ${from.x} ${from.y} L ${x} ${y}`)
      },
      onComplete: () => path.setAttribute('data-visible', 'false'),
    })
  }

  function onWheel(e) {
    e.preventDefault()
    stopCamera()
    const { left, top } = boardSize()
    if (e.ctrlKey || e.metaKey) {
      // trackpad pinch arrives as ctrl+wheel
      zoomAt(e.clientX - left, e.clientY - top, cam.current.z * Math.exp(-e.deltaY * 0.01))
    } else {
      cam.current.x -= e.deltaX
      cam.current.y -= e.deltaY
      applyCamera()
    }
  }
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // ---------------- persistence ----------------
  const saveTimers = useRef(new Map())
  function savePosition(id, x, y) {
    clearTimeout(saveTimers.current.get(id))
    saveTimers.current.set(
      id,
      setTimeout(() => {
        adapter
          .savePosition(id, x, y)
          .catch(() =>
            notify(
              t('Не удалось сохранить место карточки', 'Could not save the card position'),
              'error',
            ),
          )
      }, 250),
    )
  }

  async function connect(a, b) {
    const refusal = canConnect?.(a, b)
    if (refusal) return notify(refusal)
    const [from_id, to_id] = a < b ? [a, b] : [b, a]
    if (linksRef.current.some((l) => l.from_id === from_id && l.to_id === to_id)) return
    const temp = { id: -Date.now(), from_id, to_id }
    setLinks((list) => [...list, temp])
    navigator.vibrate?.(10)
    try {
      const created = await adapter.createLink(from_id, to_id)
      const r = ropes.current.get(temp.id)
      if (r) ropes.current.set(created.id, { ...r, els: {} })
      setLinks((list) => list.map((l) => (l.id === temp.id ? created : l)))
    } catch {
      setLinks((list) => list.filter((l) => l.id !== temp.id))
      notify(t('Не удалось протянуть нить', 'Could not tie the string'), 'error')
    }
  }
  async function cut(link) {
    if (link.fixed) return
    setLinks((list) => list.filter((l) => l.id !== link.id))
    setSelected(null)
    if (link.id < 0) return
    try {
      await adapter.deleteLink(link.id)
    } catch {
      setLinks((list) => [...list, link])
      notify(t('Не удалось убрать нить', 'Could not remove the string'), 'error')
    }
  }
  // ---------------- auto layout (force graph, like Obsidian) ----------------
  function arrange() {
    if (!blocks.length) return
    layoutRun.current?.stop()
    cardAnim.current.forEach((list) => list.forEach((a) => a.stop()))
    const nodes = blocks.map((b) => {
      const p = pos.current.get(b.id)
      return { id: b.id, x: p.x + CARD_W / 2, y: p.y + CARD_H / 2, vx: 0, vy: 0 }
    })
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length,
      cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length
    let alpha = 1,
      frame = 0,
      stopped = false
    setArranging(true)
    const finish = () => {
      layoutRun.current = null
      setArranging(false)
      const positions = nodes.map((n) => ({
        id: n.id,
        x: Math.round(n.x - CARD_W / 2),
        y: Math.round(n.y - CARD_H / 2),
      }))
      adapter
        .savePositions(positions)
        .catch(() =>
          notify(t('Не удалось сохранить раскладку', 'Could not save the layout'), 'error'),
        )
      animateCamera(fitTarget(), { response: 0.6 })
    }
    const simulate = () => {
      for (let s = 0; s < 3; s++) {
        for (let i = 0; i < nodes.length; i++)
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i],
              b = nodes[j]
            let dx = b.x - a.x,
              dy = b.y - a.y,
              d2 = dx * dx + dy * dy || 1
            const d = Math.sqrt(d2)
            let f = 260000 / d2
            if (d < 250) f += (250 - d) * 0.6 // cards never overlap
            dx /= d
            dy /= d
            a.vx -= dx * f * alpha
            a.vy -= dy * f * alpha
            b.vx += dx * f * alpha
            b.vy += dy * f * alpha
          }
        for (const l of linksRef.current) {
          const a = byId.get(l.from_id),
            b = byId.get(l.to_id)
          if (!a || !b) continue
          const dx = b.x - a.x,
            dy = b.y - a.y,
            d = Math.hypot(dx, dy) || 1,
            f = (d - 300) * 0.05 * alpha
          a.vx += (dx / d) * f
          a.vy += (dy / d) * f
          b.vx -= (dx / d) * f
          b.vy -= (dy / d) * f
        }
        for (const n of nodes) {
          n.vx += (cx - n.x) * 0.006 * alpha
          n.vy += (cy - n.y) * 0.006 * alpha
          n.vx *= 0.82
          n.vy *= 0.82
          n.x += clamp(n.vx, -60, 60)
          n.y += clamp(n.vy, -60, 60)
        }
        alpha *= 0.992
      }
    }
    const paint = () => {
      for (const n of nodes) {
        const p = pos.current.get(n.id)
        p.x = n.x - CARD_W / 2
        p.y = n.y - CARD_H / 2
        placeCard(n.id)
      }
    }
    layoutRun.current = { stop: () => ((stopped = true), finish()) }
    if (motionReduced()) {
      while (alpha > 0.03 && frame++ < 200) simulate()
      paint()
      return finish()
    }
    const step = () => {
      if (stopped) return
      simulate()
      paint()
      if (++frame > 200 || alpha < 0.03) return finish()
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    kick()
  }

  // ---------------- keyboard ----------------
  function onBoardKey(e) {
    if (e.target !== boardRef.current) return
    const { w, h } = boardSize()
    const pan = (dx, dy) =>
      animateCamera(
        { ...cam.current, x: cam.current.x + dx, y: cam.current.y + dy },
        { response: 0.3 },
      )
    if (e.key === 'ArrowLeft') pan(120, 0)
    else if (e.key === 'ArrowRight') pan(-120, 0)
    else if (e.key === 'ArrowUp') pan(0, 120)
    else if (e.key === 'ArrowDown') pan(0, -120)
    else if (e.key === '+' || e.key === '=') zoomAt(w / 2, h / 2, cam.current.z * 1.25, true)
    else if (e.key === '-') zoomAt(w / 2, h / 2, cam.current.z / 1.25, true)
    else if (e.key === '0') animateCamera(fitTarget())
    else return
    e.preventDefault()
  }
  function onCardKey(e, b) {
    const p = pos.current.get(b.id)
    if (e.key === 'Escape') return setLinkFrom(null)
    if (e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'д') {
      e.preventDefault()
      setLinkFrom(b.id)
      notify(t('Выберите карточку, к которой протянуть нить', 'Pick a card to tie the string to'))
      return
    }
    if (!e.key.startsWith('Arrow')) return
    e.preventDefault()
    const stepPx = e.shiftKey ? 80 : 20
    if (e.key === 'ArrowLeft') p.x -= stepPx
    if (e.key === 'ArrowRight') p.x += stepPx
    if (e.key === 'ArrowUp') p.y -= stepPx
    if (e.key === 'ArrowDown') p.y += stepPx
    placeCard(b.id)
    kick()
    savePosition(b.id, Math.round(p.x), Math.round(p.y))
  }
  function onCardClick(b) {
    if (suppressClick.current) return
    if (linkFrom && linkFrom !== b.id) {
      connect(linkFrom, b.id)
      setLinkFrom(null)
      return
    }
    setSelected({ type: 'card', id: b.id })
    setFocus(b.id)
  }

  // ---------------- derived ----------------
  const neighbours = useMemo(() => {
    if (focus == null) return null
    const set = new Set([focus])
    for (const l of allLinks) {
      if (l.from_id === focus) set.add(l.to_id)
      if (l.to_id === focus) set.add(l.from_id)
    }
    return set
  }, [focus, allLinks])
  const titleOf = (id) => blocks.find((b) => b.id === id)?.title || ''
  const selectedLink = selected?.type === 'link' ? links.find((l) => l.id === selected.id) : null

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

  return (
    <>
      {error ? (
        <ErrorState error={error} onRetry={onRetry} t={t} />
      ) : (
        <div
          ref={boardRef}
          className={`board ${linkFrom ? 'is-linking' : ''} ${focus != null ? 'has-focus' : ''}`}
          role="application"
          aria-roledescription={t('доска', 'board')}
          aria-label={t(
            'Доска дня. Стрелки двигают вид, плюс и минус меняют масштаб, ноль показывает всё.',
            'Day board. Arrows pan, plus and minus zoom, zero fits everything.',
          )}
          aria-busy={loading}
          tabIndex={0}
          onKeyDown={onBoardKey}
          onPointerDown={onBoardPointerDown}
          onPointerMove={onBoardPointerMove}
          onPointerUp={onBoardPointerUp}
          onPointerCancel={onBoardPointerUp}
        >
          <div ref={farRef} className="board-layer far" aria-hidden="true" />
          <div ref={nearRef} className="board-layer near" aria-hidden="true" />
          <div ref={worldRef} className="board-world">
            <svg className="board-ropes" aria-hidden="true">
              {allLinks.map((l) => {
                if (!ropes.current.has(l.id)) ropes.current.set(l.id, { els: {} })
                const r = ropes.current.get(l.id)
                const lit = neighbours ? neighbours.has(l.from_id) && neighbours.has(l.to_id) : null
                return (
                  <g
                    key={l.id}
                    data-from={l.from_id}
                    data-to={l.to_id}
                    className={`rope ${l.fixed ? 'fixed' : ''} ${lit === false ? 'dim' : ''} ${lit ? 'lit' : ''} ${selectedLink?.id === l.id ? 'selected' : ''}`}
                  >
                    <path ref={(el) => (r.els.shadow = el)} className="rope-shadow" />
                    <path ref={(el) => (r.els.string = el)} className="rope-string" />
                    <path
                      ref={(el) => (r.els.hit = el)}
                      className="rope-hit"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => !l.fixed && setSelected({ type: 'link', id: l.id })}
                    />
                  </g>
                )
              })}
              <path ref={tempPath} className="rope-temp" data-visible="false" />
              <defs>
                <radialGradient id="pin-head" cx="35%" cy="30%" r="75%">
                  <stop offset="0" stopColor="#ff8b80" />
                  <stop offset="0.4" stopColor="#d0342c" />
                  <stop offset="1" stopColor="#8e1d17" />
                </radialGradient>
              </defs>
              {blocks.map((b) => (
                <g
                  key={b.id}
                  ref={(el) => (el ? pinEls.current.set(b.id, el) : pinEls.current.delete(b.id))}
                  className={`board-pin ${neighbours && !neighbours.has(b.id) ? 'dim' : ''}`}
                  data-id={b.id}
                >
                  <title>{t('Потяните, чтобы протянуть нить', 'Drag to tie a string')}</title>
                  <circle className="pin-hit" r="20" />
                  <circle className="pin-head" r="9" />
                </g>
              ))}
            </svg>
            {selectedLink && (
              <button
                ref={(el) => {
                  const r = ropes.current.get(selectedLink.id)
                  if (r) r.els.cut = el
                }}
                className="rope-cut"
                aria-label={t('Убрать нить', 'Remove string')}
                onClick={() => cut(selectedLink)}
              >
                <Icon name="close" size={14} />
              </button>
            )}
            {blocks.map((b) => {
              const lit = neighbours ? neighbours.has(b.id) : null
              return (
                <div
                  key={b.id}
                  ref={(el) => (el ? cardEls.current.set(b.id, el) : cardEls.current.delete(b.id))}
                  className={`board-card ${b.kind === 'folder' ? 'folder-card' : ''} ${b.done ? 'done' : ''} ${lit === false ? 'dim' : ''} ${selected?.type === 'card' && selected.id === b.id ? 'selected' : ''} ${linkFrom === b.id ? 'link-source' : ''}`}
                  data-id={b.id}
                  data-accent={b.color && b.color !== 'accent' ? b.color : undefined}
                  style={b.tape ? { '--tape': b.tape } : undefined}
                  onPointerEnter={() => !gesture.current && setFocus(b.id)}
                  onPointerLeave={() =>
                    !gesture.current && setFocus(selected?.type === 'card' ? selected.id : null)
                  }
                >
                  <button
                    className="card-body"
                    onClick={() => onCardClick(b)}
                    onDoubleClick={() => onEdit(b)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.shiftKey) return onEdit(b)
                      onCardKey(e, b)
                    }}
                    aria-label={b.meta ? `${b.title}, ${b.meta}` : b.title}
                    aria-describedby="board-card-help"
                  >
                    {b.kind === 'folder' && (
                      <span className="card-folder-icon" aria-hidden="true">
                        <Icon name="folder" size={22} />
                      </span>
                    )}
                    {b.meta && <span className="card-time">{b.meta}</span>}
                    <strong className="card-title">{b.title}</strong>
                    {b.note && <span className="card-note">{b.note}</span>}
                  </button>
                  {b.kind !== 'folder' && (
                    <button
                      className="card-check"
                      aria-pressed={b.done}
                      aria-label={
                        b.done
                          ? t('Отметить как невыполненное', 'Mark as not done')
                          : t('Отметить как выполненное', 'Mark as done')
                      }
                      onClick={() => onToggle(b)}
                    >
                      <Icon name="check" size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {!loading && !blocks.length && <div className="board-empty">{empty}</div>}

          <div className="board-toolbar glass" onPointerDown={(e) => e.stopPropagation()}>
            <button
              className="icon-button"
              aria-label={t('Отдалить', 'Zoom out')}
              onClick={() => {
                const { w, h } = boardSize()
                zoomAt(w / 2, h / 2, cam.current.z / 1.3, true)
              }}
            >
              <Icon name="minus" size={18} />
            </button>
            <button
              className="zoom-label"
              ref={zoomLabel}
              aria-label={t('Показать всё', 'Fit everything')}
              onClick={() => animateCamera(fitTarget())}
            >
              100%
            </button>
            <button
              className="icon-button"
              aria-label={t('Приблизить', 'Zoom in')}
              onClick={() => {
                const { w, h } = boardSize()
                zoomAt(w / 2, h / 2, cam.current.z * 1.3, true)
              }}
            >
              <Icon name="plus" size={18} />
            </button>
            <span className="toolbar-sep" />
            <Button variant="ghost" disabled={!blocks.length || arranging} onClick={arrange}>
              <Icon name="graph" size={18} />
              {arranging ? (
                <span className="text-shimmer">{t('Раскладываю…', 'Arranging…')}</span>
              ) : (
                t('Разложить', 'Arrange')
              )}
            </Button>
          </div>
          <p className="board-hint" aria-hidden="true">
            {linkFrom
              ? t(
                  'Нажмите на карточку, чтобы связать. Esc — отмена',
                  'Click a card to tie. Esc cancels',
                )
              : selectedLink
                ? t(
                    'Нажмите ×  или Delete, чтобы убрать нить',
                    'Press × or Delete to remove the string',
                  )
                : t(
                    'Тяните за булавку, чтобы протянуть нить. Нажмите на нить, чтобы её убрать',
                    'Drag a pin to tie a string. Click a string to remove it',
                  )}
          </p>
        </div>
      )}

      <p id="board-card-help" className="sr-only">
        {t(
          'Двойной клик или Shift+Enter: изменить. L: протянуть нить. Стрелки: сдвинуть.',
          'Double-click or Shift+Enter: edit. L: tie a string. Arrows: move.',
        )}
      </p>
      <ul className="sr-only" aria-label={t('Нити на доске', 'Strings on the board')}>
        {links.map((l) => (
          <li key={l.id}>
            {titleOf(l.from_id)} — {titleOf(l.to_id)}
          </li>
        ))}
      </ul>
    </>
  )
}
