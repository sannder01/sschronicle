'use client'
// ╔═══════════════════════════════════════════════════════════════════╗
// ║  CHRONICLE — PLANNER CLIENT  v2.0  (PREMIUM REDESIGN)            ║
// ║  All original logic preserved. Visual layer completely rebuilt.   ║
// ║  Aesthetic: Dark Ritual Intelligence / High-tech Minimalism       ║
// ╚═══════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useRef, useCallback } from 'react'
import { signOut, useSession } from 'next-auth/react'
import CalendarView from './CalendarView'
import CharacterPanel from './CharacterPanel'
import HabitTracker from './HabitTracker'

// ═══════════════════════════════════════════════════════════════════
//  THEMES (logic preserved, extended with new tokens)
// ═══════════════════════════════════════════════════════════════════
const THEMES = {
  void: {
    name: 'Void', emoji: '🌑',
    bg: '#030407',
    bgGrad: 'radial-gradient(ellipse 70% 60% at 20% 30%, #0b0b18 0%, #030407 65%)',
    card: 'rgba(255,255,255,0.028)',
    cardHover: 'rgba(255,255,255,0.055)',
    cardBorder: 'rgba(255,255,255,0.07)',
    cardBorderHover: 'rgba(245,75,100,0.4)',
    primary: '#F54B64', primaryEnd: '#F78361', primaryRgb: '245,75,100',
    text: '#FFFFFF', textMuted: '#3d3d50', textSub: '#7a7a9a',
    accent: '#F54B64', glow: 'rgba(245,75,100,0.2)',
    surface: 'rgba(255,255,255,0.04)', sidebar: 'rgba(2,2,6,0.85)',
    inputBg: 'rgba(255,255,255,0.05)', overlay: 'rgba(0,0,0,0.8)',
    danger: '#FF4466', success: '#00E887',
  },
  meaCulpa: {
    name: 'Mea Culpa', emoji: '🕯️',
    bg: '#060209',
    bgGrad: 'radial-gradient(ellipse 80% 70% at 50% 25%, #160410 0%, #060209 70%)',
    card: 'rgba(140,10,50,0.06)', cardHover: 'rgba(140,10,50,0.12)',
    cardBorder: 'rgba(160,20,60,0.12)', cardBorderHover: 'rgba(200,30,80,0.5)',
    primary: '#C8143C', primaryEnd: '#8B0000', primaryRgb: '200,20,60',
    text: '#F5E0E8', textMuted: '#4a1e28', textSub: '#8a5060',
    accent: '#C8143C', glow: 'rgba(200,20,60,0.25)',
    surface: 'rgba(140,10,50,0.08)', sidebar: 'rgba(6,2,9,0.9)',
    inputBg: 'rgba(140,10,50,0.07)', overlay: 'rgba(3,0,5,0.9)',
    danger: '#FF2244', success: '#00CC77',
  },
  nebula: {
    name: 'Nebula', emoji: '🌌',
    bg: '#020310',
    bgGrad: 'radial-gradient(ellipse 90% 60% at 70% 20%, #080520 0%, #020310 65%)',
    card: 'rgba(100,80,220,0.05)', cardHover: 'rgba(100,80,220,0.1)',
    cardBorder: 'rgba(120,100,240,0.1)', cardBorderHover: 'rgba(150,120,255,0.45)',
    primary: '#8B5CF6', primaryEnd: '#6366F1', primaryRgb: '139,92,246',
    text: '#EDE9FF', textMuted: '#2a2650', textSub: '#6663a0',
    accent: '#8B5CF6', glow: 'rgba(139,92,246,0.22)',
    surface: 'rgba(100,80,220,0.06)', sidebar: 'rgba(2,3,16,0.9)',
    inputBg: 'rgba(100,80,220,0.06)', overlay: 'rgba(1,1,10,0.9)',
    danger: '#FF4488', success: '#34EEA0',
  },
  sakura: {
    name: 'Sakura', emoji: '🌸',
    bg: '#05030a',
    bgGrad: 'radial-gradient(ellipse 80% 60% at 40% 60%, #130610 0%, #05030a 65%)',
    card: 'rgba(255,100,160,0.04)', cardHover: 'rgba(255,100,160,0.09)',
    cardBorder: 'rgba(255,130,180,0.1)', cardBorderHover: 'rgba(255,150,200,0.45)',
    primary: '#FF6B9D', primaryEnd: '#FF4488', primaryRgb: '255,107,157',
    text: '#FFE8F5', textMuted: '#4a1535', textSub: '#9a6075',
    accent: '#FF6B9D', glow: 'rgba(255,107,157,0.2)',
    surface: 'rgba(255,100,160,0.05)', sidebar: 'rgba(5,3,10,0.9)',
    inputBg: 'rgba(255,100,160,0.05)', overlay: 'rgba(4,1,6,0.9)',
    danger: '#FF3366', success: '#00F0A0',
  },
}

// ═══════════════════════════════════════════════════════════════════
//  RANK SYSTEM (unchanged)
// ═══════════════════════════════════════════════════════════════════
const RANKS = [
  { rank: 'E',   min: 0,    max: 100,       color: '#888888', glow: '#444', label: 'Novice Hunter' },
  { rank: 'D',   min: 100,  max: 300,       color: '#5CB85C', glow: '#2d7a30', label: 'Iron Will' },
  { rank: 'C',   min: 300,  max: 600,       color: '#5BC0DE', glow: '#1a7fa0', label: 'Steel Mind' },
  { rank: 'B',   min: 600,  max: 1000,      color: '#9F5CE8', glow: '#6c35b0', label: 'Shadow Walker' },
  { rank: 'A',   min: 1000, max: 1500,      color: '#F0A30A', glow: '#b07000', label: 'Raid Commander' },
  { rank: 'S',   min: 1500, max: 2200,      color: '#E63946', glow: '#900020', label: 'Monarch' },
  { rank: 'SS',  min: 2200, max: 3000,      color: '#FFD700', glow: '#CC8800', label: 'Shadow Sovereign' },
  { rank: 'SSS', min: 3000, max: Infinity,  color: '#E040FB', glow: '#9900CC', label: 'Sung Jin-Woo' },
]

function getRank(xp) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].min) return RANKS[i]
  }
  return RANKS[0]
}
function getXP(priority) { return { high: 50, medium: 25, low: 10 }[priority] || 15 }
function xpToNextRank(xp) {
  const rank = getRank(xp)
  if (rank.max === Infinity) return { progress: 100, needed: 0 }
  const progress = ((xp - rank.min) / (rank.max - rank.min)) * 100
  return { progress: Math.min(progress, 100), needed: rank.max - xp }
}

// ═══════════════════════════════════════════════════════════════════
//  UTILS (unchanged)
// ═══════════════════════════════════════════════════════════════════
const PRIORITY_CONFIG = {
  high:   { label: 'Высокий', color: '#FF4466', xp: 50 },
  medium: { label: 'Средний', color: '#F0A30A', xp: 25 },
  low:    { label: 'Низкий',  color: '#5CB85C', xp: 10 },
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}
function getDaysLeft(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  return diff
}
function getDaysLeftLabel(days) {
  if (days === null) return ''
  if (days < 0) return `−${Math.abs(days)}д`
  if (days === 0) return 'сегодня'
  if (days === 1) return 'завтра'
  return `+${days}д`
}
function getDaysColor(days, t) {
  if (days === null) return t.textMuted
  if (days < 0) return t.danger
  if (days <= 1) return '#FF6644'
  if (days <= 3) return '#F0A30A'
  return t.success
}

const DEFAULT_FOLDERS = [
  { id: 'all',    name: 'Все задачи', emoji: '◈', color: '#777' },
  { id: 'today',  name: 'Сегодня',    emoji: '◎', color: '#F0A30A' },
  { id: 'urgent', name: 'Срочные',    emoji: '◉', color: '#FF4466' },
]

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return `${r},${g},${b}`
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function PlannerClient() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [themeKey, setThemeKey] = useState('void')
  const t = THEMES[themeKey]

  const [xp, setXp] = useState(0)
  const [levelUpData, setLevelUpData] = useState(null)
  const [floatingXP, setFloatingXP] = useState([])

  const [activeFolder, setActiveFolder] = useState('all')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', due_date: '', due_time: '', priority: 'medium', folder_id: '' })
  const [formError, setFormError] = useState('')

  const [showFolderForm, setShowFolderForm] = useState(false)
  const [folderForm, setFolderForm] = useState({ name: '', emoji: '◆', color: '#8B5CF6' })

  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showTgPanel, setShowTgPanel] = useState(false) // kept for prop compatibility, panel removed
  const [showThemePanel, setShowThemePanel] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [debugInfo, setDebugInfo] = useState(null)
  const [showDebug, setShowDebug] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showHabits, setShowHabits] = useState(false)

  // Edit task state
  const [editingTask, setEditingTask] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', due_date: '', due_time: '', priority: 'medium', folder_id: '' })

  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const particlesRef = useRef([])
  const cursorDotRef = useRef(null)
  const cursorRingRef = useRef(null)
  const cursorRafRef = useRef(null)

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    const savedTheme = localStorage.getItem('chronicle_theme') || 'void'
    if (THEMES[savedTheme]) setThemeKey(savedTheme)
    // NOTE: XP is no longer loaded from localStorage here.
    // loadData() recalculates XP from actual completed tasks in DB,
    // so it's always accurate and won't drift across devices/sessions.
    loadData()
  }, [])

  useEffect(() => { applyTheme(t) }, [themeKey])

  function applyTheme(theme) {
    const root = document.documentElement
    root.style.setProperty('--bg', theme.bg)
    root.style.setProperty('--primary', theme.primary)
    root.style.setProperty('--primary-end', theme.primaryEnd)
    root.style.setProperty('--text', theme.text)
    root.style.setProperty('--text-muted', theme.textMuted)
    root.style.setProperty('--glow', theme.glow)
    root.style.setProperty('--danger', theme.danger)
    root.style.setProperty('--success', theme.success)
    root.style.setProperty('--card', theme.card)
    root.style.setProperty('--card-border', theme.cardBorder)
    root.style.setProperty('--surface', theme.surface)
    root.style.setProperty('--text-sub', theme.textSub)
  }

  // ── Custom cursor ────────────────────────────────────────────────
  useEffect(() => {
    const dot = document.createElement('div')
    const ring = document.createElement('div')
    dot.className = 'pc-cursor-dot'
    ring.className = 'pc-cursor-ring'
    document.body.appendChild(dot)
    document.body.appendChild(ring)
    cursorDotRef.current = dot
    cursorRingRef.current = ring

    let mx = 0, my = 0, rx = 0, ry = 0
    const onMove = e => { mx = e.clientX; my = e.clientY }
    window.addEventListener('mousemove', onMove)

    const loop = () => {
      dot.style.transform = `translate(${mx - 4}px, ${my - 4}px)`
      rx += (mx - rx) * 0.1
      ry += (my - ry) * 0.1
      ring.style.transform = `translate(${rx - 18}px, ${ry - 18}px)`
      cursorRafRef.current = requestAnimationFrame(loop)
    }
    loop()

    const onEnter = () => ring.classList.add('pc-cursor-hover')
    const onLeave = () => ring.classList.remove('pc-cursor-hover')
    document.querySelectorAll('button, a, [role=button], input, select').forEach(el => {
      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)
    })

    return () => {
      cancelAnimationFrame(cursorRafRef.current)
      window.removeEventListener('mousemove', onMove)
      dot.remove()
      ring.remove()
    }
  }, [])

  // ── Particle canvas ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    particlesRef.current = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      alpha: Math.random() * 0.5 + 0.1,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${hexToRgb(t.primary)},${p.alpha * 0.6})`
        ctx.fill()
      })
      animRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [themeKey])

  // ── Data Loading ─────────────────────────────────────────────────
  async function loadData() {
    setLoading(true)
    try {
      const [tasksRes, foldersRes] = await Promise.all([fetch('/api/tasks'), fetch('/api/folders')])
      const tasksData = await tasksRes.json()
      const foldersData = await foldersRes.json()
      const safeTasks = Array.isArray(tasksData) ? tasksData : []
      setTasks(safeTasks)
      setFolders(Array.isArray(foldersData) ? foldersData : [])
      // FIX BUG 5: Always derive XP from actual completed tasks in DB.
      // localStorage XP was getting out of sync on reload / other devices.
      const calculatedXP = safeTasks
        .filter(t => t.completed)
        .reduce((sum, t) => sum + getXP(t.priority), 0)
      setXp(calculatedXP)
      localStorage.setItem('chronicle_xp', String(calculatedXP))
      localStorage.setItem('chronicle_tasks_cache', JSON.stringify(safeTasks))
      localStorage.setItem('chronicle_folders_cache', JSON.stringify(foldersData))
    } catch {
      const ct = localStorage.getItem('chronicle_tasks_cache')
      const cf = localStorage.getItem('chronicle_folders_cache')
      if (ct) {
        const cached = JSON.parse(ct)
        setTasks(cached)
        // Also recalculate XP from cache so it doesn't drift
        const cachedXP = cached.filter(t => t.completed).reduce((sum, t) => sum + getXP(t.priority), 0)
        setXp(cachedXP)
      }
      if (cf) setFolders(JSON.parse(cf))
    }
    setLoading(false)
  }

  // ── Task CRUD (logic unchanged) ──────────────────────────────────
  async function createTask(e) {
    e.preventDefault()
    if (!formData.title.trim()) { setFormError('Введи название задания'); return }
    setFormError('')
    const SYSTEM = ['all', 'today', 'urgent']
    const fId = formData.folder_id
      ? String(formData.folder_id)
      : !SYSTEM.includes(activeFolder) ? String(activeFolder) : null

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formData.title.trim(), due_date: formData.due_date || null, due_time: formData.due_time || null, priority: formData.priority, folder_id: fId }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); setFormError(e.error || `Ошибка ${res.status}`); return }
      const created = await res.json()
      const updated = [created, ...tasks]
      setTasks(updated)
      localStorage.setItem('chronicle_tasks_cache', JSON.stringify(updated))
      setFormData({ title: '', due_date: '', due_time: '', priority: 'medium', folder_id: '' })
      setShowForm(false)
    } catch { setFormError('Ошибка соединения') }
  }

  async function toggleTask(task) {
    const was = task.completed
    // Capture current XP for rollback
    const prevXp = xp
    const updated = tasks.map(tk => tk.id === task.id ? { ...tk, completed: !was } : tk)
    setTasks(updated)
    localStorage.setItem('chronicle_tasks_cache', JSON.stringify(updated))
    if (!was) {
      // Completing: award XP optimistically
      const earned = getXP(task.priority)
      const newXp = xp + earned
      const oldRank = getRank(xp); const newRank = getRank(newXp)
      setXp(newXp); localStorage.setItem('chronicle_xp', String(newXp))
      const id = Date.now()
      setFloatingXP(prev => [...prev, { id, xp: earned }])
      setTimeout(() => setFloatingXP(prev => prev.filter(x => x.id !== id)), 2000)
      if (oldRank.rank !== newRank.rank) { setLevelUpData(newRank); setTimeout(() => setLevelUpData(null), 4000) }
    } else {
      // Un-completing: subtract XP optimistically
      const newXp = Math.max(0, xp - getXP(task.priority))
      setXp(newXp); localStorage.setItem('chronicle_xp', String(newXp))
    }
    try {
      // FIX BUG 1: Check HTTP status, not just network errors.
      // Non-OK responses (4xx/5xx) were silently ignored before — task appeared
      // completed in UI but DB wasn't updated, so it reset on next reload.
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !was })
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
    } catch {
      // Rollback both tasks AND XP — keeps them in sync
      setTasks(tasks)
      localStorage.setItem('chronicle_tasks_cache', JSON.stringify(tasks))
      setXp(prevXp)
      localStorage.setItem('chronicle_xp', String(prevXp))
    }
  }

  async function deleteTask(id) {
    const updated = tasks.filter(tk => tk.id !== id)
    setTasks(updated)
    localStorage.setItem('chronicle_tasks_cache', JSON.stringify(updated))
    setDeleteConfirm(null)
    try { await fetch(`/api/tasks/${id}`, { method: 'DELETE' }) } catch {}
  }

  async function createFolder(e) {
    e.preventDefault()
    if (!folderForm.name.trim()) return
    try {
      const res = await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(folderForm) })
      if (!res.ok) return
      const created = await res.json()
      if (!created?.id) return
      const updated = [...folders, created]
      setFolders(updated)
      localStorage.setItem('chronicle_folders_cache', JSON.stringify(updated))
      setFolderForm({ name: '', emoji: '◆', color: '#8B5CF6' })
      setShowFolderForm(false)
    } catch {}
  }

  async function deleteFolder(id) {
    setFolders(folders.filter(f => f.id !== id))
    if (activeFolder === String(id)) setActiveFolder('all')
    try { await fetch(`/api/folders/${id}`, { method: 'DELETE' }) } catch {}
  }

  function openEditTask(task) {
    setEditingTask(task)
    setEditForm({
      title:     task.title || '',
      due_date:  task.due_date ? String(task.due_date).slice(0, 10) : '',
      due_time:  task.due_time ? String(task.due_time).slice(0, 5) : '',
      priority:  task.priority || 'medium',
      folder_id: task.folder_id ? String(task.folder_id) : '',
    })
  }

  async function saveEditTask(e) {
    e.preventDefault()
    if (!editForm.title.trim()) return
    const updates = {
      title:     editForm.title.trim(),
      due_date:  editForm.due_date || null,
      due_time:  editForm.due_time || null,
      priority:  editForm.priority,
      folder_id: editForm.folder_id ? Number(editForm.folder_id) : null,
    }
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
        setEditingTask(null)
      }
    } catch {}
  }


  function handleSignOut() { signOut({ callbackUrl: '/auth' }) }

  async function runDebug() {
    const results = {}
    results.clientSession = session ? `✅ (id: ${session.user?.id || '❌ НЕТ ID'})` : '❌ нет сессии'
    try { const r = await fetch('/api/tasks'); results.getTasks = `${r.status} ${r.statusText}` } catch(e) { results.getTasks = e.message }
    try { const r = await fetch('/api/folders'); results.getFolders = `${r.status} ${r.statusText}` } catch(e) { results.getFolders = e.message }
    setDebugInfo(results); setShowDebug(true)
  }

  // ── Derived ──────────────────────────────────────────────────────
  const filteredTasks = tasks.filter(task => {
    if (activeFolder === 'urgent') { const d = getDaysLeft(task.due_date); return d !== null && d <= 1 && !task.completed }
    if (activeFolder === 'today') { const d = getDaysLeft(task.due_date); return d === 0 }
    if (activeFolder === 'all') return true
    return String(task.folder_id) === String(activeFolder)
  })

  const completedCount = tasks.filter(tk => tk.completed).length
  const totalCount = tasks.length
  const rankInfo = getRank(xp)
  const { progress: xpProgress, needed: xpNeeded } = xpToNextRank(xp)
  const allFolders = [...DEFAULT_FOLDERS, ...folders]
  const activeFolderData = allFolders.find(f => String(f.id) === String(activeFolder)) || DEFAULT_FOLDERS[0]
  const pendingTasks = filteredTasks.filter(t => !t.completed)
  const doneTasks = filteredTasks.filter(t => t.completed)

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* Particle canvas */}
      <canvas ref={canvasRef} className="pc-canvas" />

      {/* Background gradient */}
      <div style={{ position: 'fixed', inset: 0, background: t.bgGrad, zIndex: 0, pointerEvents: 'none' }} />

      {/* Scan lines */}
      <div className="pc-scanlines" />

      {/* ── LEVEL UP MODAL ── */}
      {levelUpData && (
        <div className="pc-overlay pc-levelup-overlay">
          <div className="pc-levelup-card" style={{ borderColor: `${levelUpData.color}33`, boxShadow: `0 0 100px ${levelUpData.glow}` }}>
            <div className="pc-levelup-label">РАНГ ПОВЫШЕН</div>
            <div className="pc-levelup-rank" style={{ color: levelUpData.color, textShadow: `0 0 40px ${levelUpData.glow}` }}>
              {levelUpData.rank}
            </div>
            <div className="pc-levelup-name">{levelUpData.label}</div>
            {[1,2,3].map(i => (
              <div key={i} className="pc-pulse-ring" style={{ borderColor: levelUpData.color, animationDelay: `${i * 0.25}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── FLOATING XP ── */}
      {floatingXP.map(item => (
        <div key={item.id} className="pc-float-xp" style={{ color: t.primary, textShadow: `0 0 20px ${t.glow}` }}>
          +{item.xp} XP
        </div>
      ))}

      {/* ── DELETE MODAL ── */}
      {deleteConfirm && (
        <div className="pc-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="pc-modal" onClick={e => e.stopPropagation()} style={{ background: t.card, borderColor: `${t.danger}33`, backdropFilter: 'blur(32px)' }}>
            <div className="pc-modal-icon">
              <DeleteIcon color={t.danger} />
            </div>
            <div className="pc-modal-title" style={{ color: t.text }}>Удалить задание?</div>
            <div className="pc-modal-sub" style={{ color: t.textSub }}>
              «{deleteConfirm.title}» будет удалено навсегда.
            </div>
            <div className="pc-modal-actions">
              <button className="pc-btn-ghost" style={{ color: t.textSub, borderColor: t.cardBorder }} onClick={() => setDeleteConfirm(null)}>Отмена</button>
              <button className="pc-btn-danger" style={{ background: `linear-gradient(135deg, ${t.danger}, #AA1133)`, boxShadow: `0 4px 20px ${t.danger}33` }} onClick={() => deleteTask(deleteConfirm.id)}>Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* ── THEME PANEL ── */}
      {showThemePanel && (
        <div className="pc-overlay" onClick={() => setShowThemePanel(false)}>
          <div className="pc-modal pc-modal-wide" onClick={e => e.stopPropagation()} style={{ background: t.card, backdropFilter: 'blur(32px)', borderColor: t.cardBorder }}>
            <div className="pc-modal-title" style={{ color: t.text }}>Выбери тему</div>
            <div className="pc-theme-grid">
              {Object.entries(THEMES).map(([key, theme]) => (
                <button key={key} className={`pc-theme-card ${themeKey === key ? 'pc-theme-active' : ''}`}
                  style={{ background: theme.bg, borderColor: themeKey === key ? theme.primary : theme.cardBorder, boxShadow: themeKey === key ? `0 0 24px ${theme.glow}` : 'none' }}
                  onClick={() => { setThemeKey(key); localStorage.setItem('chronicle_theme', key); setShowThemePanel(false) }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{theme.emoji}</div>
                  <div style={{ color: themeKey === key ? theme.primary : theme.text, fontWeight: 600, fontSize: 14 }}>{theme.name}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'center' }}>
                    {[theme.primary, theme.primaryEnd, theme.success, theme.danger].map((c, i) => (
                      <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TG PANEL REMOVED ──
          Bot now sends notifications automatically when linked via /link command.
          Bot link is shown in the sidebar instead.
      */}

      {/* ── DEBUG PANEL ── */}
      {showDebug && debugInfo && (
        <div className="pc-overlay" onClick={() => setShowDebug(false)}>
          <div className="pc-modal pc-modal-wide" onClick={e => e.stopPropagation()} style={{ background: '#0a0a10', borderColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(32px)' }}>
            <div className="pc-modal-title" style={{ color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 14 }}>DEBUG</div>
            <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#8aff8a', overflowX: 'auto', lineHeight: 1.6 }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
            <button className="pc-btn-ghost" style={{ color: '#666', borderColor: '#333' }} onClick={() => setShowDebug(false)}>Закрыть</button>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="pc-root app-root">

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="sidebar-mobile-overlay pc-mobile-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar desktop */}
        <aside className="sidebar-desktop">
          <Sidebar
            t={t} allFolders={allFolders} activeFolder={activeFolder}
            setActiveFolder={id => { setActiveFolder(id); setSidebarOpen(false) }}
            tasks={tasks} folders={folders}
            showFolderForm={showFolderForm} setShowFolderForm={setShowFolderForm}
            folderForm={folderForm} setFolderForm={setFolderForm}
            createFolder={createFolder} deleteFolder={deleteFolder}
            session={session} onSignOut={handleSignOut}
            rankInfo={rankInfo} xp={xp} xpProgress={xpProgress} xpNeeded={xpNeeded}
            setShowThemePanel={setShowThemePanel}
            isMobile={false}
          />
        </aside>

        {/* Mobile sidebar */}
        {sidebarOpen && (
          <aside className="sidebar-mobile-overlay" style={{ position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 201 }}>
            <Sidebar
              t={t} allFolders={allFolders} activeFolder={activeFolder}
              setActiveFolder={id => { setActiveFolder(id); setSidebarOpen(false) }}
              tasks={tasks} folders={folders}
              showFolderForm={showFolderForm} setShowFolderForm={setShowFolderForm}
              folderForm={folderForm} setFolderForm={setFolderForm}
              createFolder={createFolder} deleteFolder={deleteFolder}
              session={session} onSignOut={handleSignOut}
              rankInfo={rankInfo} xp={xp} xpProgress={xpProgress} xpNeeded={xpNeeded}
              setShowThemePanel={setShowThemePanel}
              isMobile={true}
            />
          </aside>
        )}

        {/* Main content */}
        <main className="pc-main main-content">

          {/* ── TOP BAR ── */}
          <header className="pc-header">
            <div className="pc-header-left">
              <button className="pc-menu-btn mobile-sidebar-btn" style={{ color: t.textSub, borderColor: t.cardBorder }}
                onClick={() => setSidebarOpen(!sidebarOpen)}>
                <MenuIcon />
              </button>
              <div className="pc-header-folder">
                <span className="pc-header-folder-emoji">{activeFolderData.emoji}</span>
                <span className="pc-header-folder-name" style={{ color: t.text }}>{activeFolderData.name}</span>
                {filteredTasks.length > 0 && (
                  <span className="pc-header-count" style={{ color: t.primary, borderColor: `${t.primary}30`, background: `${t.primary}10` }}>
                    {filteredTasks.length}
                  </span>
                )}
              </div>
            </div>

            <div className="pc-header-right">
              {/* Progress bar */}
              {totalCount > 0 && (
                <div className="pc-header-progress" title={`${completedCount}/${totalCount} выполнено`}>
                  <div className="pc-header-progress-bar" style={{ background: t.surface }}>
                    <div className="pc-header-progress-fill" style={{ width: `${Math.round((completedCount / totalCount) * 100)}%`, background: `linear-gradient(90deg, ${t.primary}, ${t.primaryEnd})`, boxShadow: `0 0 8px ${t.glow}` }} />
                  </div>
                  <span className="pc-header-progress-text" style={{ color: t.textSub }}>
                    {Math.round((completedCount / totalCount) * 100)}%
                  </span>
                </div>
              )}

              {/* Calendar button */}
              <button
                className="pc-btn-ghost pc-btn-sm pc-cal-btn"
                style={{ color: t.textSub, borderColor: t.cardBorder, padding: '8px 10px' }}
                onClick={() => setShowCalendar(true)}
                title="Календарь задач"
              >
                <CalendarIcon />
              </button>

              {/* Habits button */}
              <button
                className="pc-btn-ghost pc-btn-sm"
                style={{ color: t.textSub, borderColor: t.cardBorder, padding: '8px 10px' }}
                onClick={() => setShowHabits(true)}
                title="Трекер привычек"
              >
                🔥
              </button>

              <button className="pc-add-btn" style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.primaryEnd})`, boxShadow: `0 4px 20px ${t.glow}` }}
                onClick={() => setShowForm(true)}>
                <span>+</span>
                <span className="pc-add-btn-label">Задание</span>
              </button>
            </div>
          </header>

          {/* ── CREATE TASK FORM ── */}
          {showForm && (
            <div className="pc-form-wrapper">
              <form onSubmit={createTask} className="pc-form" style={{ background: t.card, borderColor: t.cardBorderHover, backdropFilter: 'blur(20px)', boxShadow: `0 0 40px ${t.glow}` }}>
                <div className="pc-form-header">
                  <span className="pc-form-label" style={{ color: t.textSub }}>Новое задание</span>
                  <button type="button" className="pc-form-close" style={{ color: t.textMuted }} onClick={() => { setShowForm(false); setFormError('') }}>✕</button>
                </div>

                <input
                  className="pc-input pc-input-title"
                  style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }}
                  placeholder="Название задания..."
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  autoFocus
                />

                {formError && (
                  <div className="pc-form-error" style={{ background: `${t.danger}12`, borderColor: `${t.danger}33`, color: '#ff8899' }}>
                    {formError}
                  </div>
                )}

                <div className="pc-form-row">
                  <div className="pc-form-field">
                    <label style={{ color: t.textSub }}>Дата</label>
                    <input type="date" className="pc-input"
                      style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, colorScheme: 'dark' }}
                      value={formData.due_date}
                      onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                  <div className="pc-form-field">
                    <label style={{ color: t.textSub }}>Время</label>
                    <input type="time" className="pc-input"
                      style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, colorScheme: 'dark' }}
                      value={formData.due_time}
                      onChange={e => setFormData({ ...formData, due_time: e.target.value })}
                    />
                  </div>
                  <div className="pc-form-field">
                    <label style={{ color: t.textSub }}>Приоритет</label>
                    <select className="pc-input pc-select"
                      style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }}
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                      <option value="high">Высокий (+50 XP)</option>
                      <option value="medium">Средний (+25 XP)</option>
                      <option value="low">Низкий (+10 XP)</option>
                    </select>
                  </div>
                  <div className="pc-form-field">
                    <label style={{ color: t.textSub }}>Папка</label>
                    <select className="pc-input pc-select"
                      style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }}
                      value={formData.folder_id}
                      onChange={e => setFormData({ ...formData, folder_id: e.target.value })}>
                      <option value="">Без папки</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pc-form-footer">
                  <button type="button" className="pc-btn-ghost" style={{ color: t.textSub, borderColor: t.cardBorder }}
                    onClick={() => { setShowForm(false); setFormError('') }}>Отмена</button>
                  <button type="submit" className="pc-btn-primary"
                    style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.primaryEnd})`, boxShadow: `0 4px 20px ${t.glow}` }}>
                    Создать задание
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── TASK LIST ── */}
          <div className="pc-task-list">
            {loading ? (
              <LoadingState t={t} />
            ) : filteredTasks.length === 0 ? (
              <EmptyState t={t} activeFolder={activeFolder} setShowForm={setShowForm} />
            ) : (
              <>
                {/* Active tasks */}
                {pendingTasks.map((task, i) => (
                  <TaskCard key={task.id} task={task} t={t} index={i}
                    onToggle={() => toggleTask(task)}
                    onDelete={() => setDeleteConfirm(task)}
                    onEdit={() => openEditTask(task)}
                    folders={folders} completed={false}
                  />
                ))}

                {/* Completed tasks */}
                {doneTasks.length > 0 && (
                  <>
                    <div className="pc-section-divider" style={{ color: t.textMuted }}>
                      <span />
                      <span>Выполнено · {doneTasks.length}</span>
                      <span />
                    </div>
                    {doneTasks.map((task, i) => (
                      <TaskCard key={task.id} task={task} t={t} index={i}
                        onToggle={() => toggleTask(task)}
                        onDelete={() => setDeleteConfirm(task)}
                        onEdit={() => openEditTask(task)}
                        folders={folders} completed={true}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* ── CALENDAR VIEW ── */}
      {showCalendar && (
        <CalendarView
          tasks={tasks}
          theme={t}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* ── HABIT TRACKER ── */}
      {showHabits && (
        <HabitTracker t={t} onClose={() => setShowHabits(false)} />
      )}

      {/* ── EDIT TASK MODAL ── */}
      {editingTask && (
        <div className="pc-overlay" onClick={e => e.target === e.currentTarget && setEditingTask(null)}>
          <div className="pc-modal" style={{
            background: t.card,
            borderColor: t.cardBorderHover,
            backdropFilter: 'blur(20px)',
            boxShadow: `0 0 60px ${t.glow}`,
          }}>
            <div className="pc-modal-title" style={{ color: t.text }}>
              ✏️ Редактировать задание
            </div>
            <form onSubmit={saveEditTask} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', color: t.textSub, fontSize: 11, marginBottom: 5, letterSpacing: 0.5, textTransform: 'uppercase' }}>Название</label>
                <input
                  className="pc-input pc-input-title"
                  style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, width: '100%', boxSizing: 'border-box' }}
                  placeholder="Название задания..."
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="pc-form-row">
                <div className="pc-form-field">
                  <label style={{ color: t.textSub }}>Дата</label>
                  <input type="date" className="pc-input"
                    style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, colorScheme: 'dark' }}
                    value={editForm.due_date}
                    onChange={e => setEditForm({ ...editForm, due_date: e.target.value })}
                  />
                </div>
                <div className="pc-form-field">
                  <label style={{ color: t.textSub }}>Время</label>
                  <input type="time" className="pc-input"
                    style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, colorScheme: 'dark' }}
                    value={editForm.due_time}
                    onChange={e => setEditForm({ ...editForm, due_time: e.target.value })}
                  />
                </div>
                <div className="pc-form-field">
                  <label style={{ color: t.textSub }}>Приоритет</label>
                  <select className="pc-input pc-select"
                    style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }}
                    value={editForm.priority}
                    onChange={e => setEditForm({ ...editForm, priority: e.target.value })}>
                    <option value="high">Высокий (+50 XP)</option>
                    <option value="medium">Средний (+25 XP)</option>
                    <option value="low">Низкий (+10 XP)</option>
                  </select>
                </div>
                <div className="pc-form-field">
                  <label style={{ color: t.textSub }}>Папка</label>
                  <select className="pc-input pc-select"
                    style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }}
                    value={editForm.folder_id}
                    onChange={e => setEditForm({ ...editForm, folder_id: e.target.value })}>
                    <option value="">Без папки</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="pc-modal-actions">
                <button type="button" className="pc-btn-ghost" style={{ color: t.textSub, borderColor: t.cardBorder }}
                  onClick={() => setEditingTask(null)}>Отмена</button>
                <button type="submit" className="pc-btn-primary"
                  style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.primaryEnd})`, boxShadow: `0 4px 16px ${t.glow}` }}>
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BOTTOM DEBUG ── */}
          <button onClick={runDebug} className="pc-debug-btn" style={{ color: t.textMuted, borderColor: t.cardBorder }}>
            debug
          </button>

        </main>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  SIDEBAR
// ═══════════════════════════════════════════════════════════════════
function Sidebar({
  t, allFolders, activeFolder, setActiveFolder,
  tasks, folders,
  showFolderForm, setShowFolderForm, folderForm, setFolderForm,
  createFolder, deleteFolder,
  session, onSignOut,
  rankInfo, xp, xpProgress, xpNeeded,
  setShowThemePanel,
  isMobile,
}) {
  return (
    <div className="pc-sidebar" style={{ background: t.sidebar, borderRightColor: t.cardBorder, width: isMobile ? 280 : undefined }}>

      {/* Logo */}
      <div className="pc-sidebar-logo" style={{ borderBottomColor: t.cardBorder }}>
        <div className="pc-logo">
          <LogoMark />
          <span className="pc-logo-text" style={{ color: t.text }}>Chronicle</span>
        </div>
        <div className="pc-user-email" style={{ color: t.textMuted }}>{session?.user?.email}</div>
      </div>

      {/* Character / Rank Panel */}
      <div style={{ margin: '12px 10px' }}>
        <CharacterPanel
          xp={xp}
          completedCount={tasks.filter(tk => tk.completed).length}
          theme={t}
        />
      </div>

      {/* Folders */}
      <div className="pc-folders-section">
        <div className="pc-section-title" style={{ color: t.textMuted }}>РАЗДЕЛЫ</div>

        {allFolders.map(folder => {
          const isBuiltin = ['all','today','urgent'].includes(folder.id)
          const count = tasks.filter(task => {
            if (folder.id === 'all') return true
            if (folder.id === 'urgent') { const d = getDaysLeft(task.due_date); return d !== null && d <= 1 && !task.completed }
            if (folder.id === 'today') return getDaysLeft(task.due_date) === 0
            return String(task.folder_id) === String(folder.id)
          }).length
          const isActive = String(activeFolder) === String(folder.id)

          return (
            <div key={folder.id} className={`pc-folder-item folder-item ${isActive ? 'pc-folder-active' : ''}`}
              style={{
                background: isActive ? t.surface : 'transparent',
                borderColor: isActive ? `${folder.color || t.primary}33` : 'transparent',
                boxShadow: isActive ? `0 0 16px ${folder.color ? folder.color + '28' : t.glow}` : 'none',
              }}
              onClick={() => setActiveFolder(folder.id)}>
              <span className="pc-folder-emoji" style={{ color: folder.color || (isActive ? t.primary : t.textSub) }}>
                {folder.emoji}
              </span>
              <span className="pc-folder-name" style={{ color: isActive ? t.text : t.textSub, fontWeight: isActive ? 600 : 400 }}>
                {folder.name}
              </span>
              <span className="pc-folder-count" style={{ color: isActive ? t.primary : t.textMuted }}>
                {count}
              </span>
              {!isBuiltin && (
                <button className="pc-folder-delete" style={{ color: t.textMuted }}
                  onClick={e => { e.stopPropagation(); deleteFolder(folder.id) }}>✕</button>
              )}
            </div>
          )
        })}

        {/* Add folder form */}
        {showFolderForm ? (
          <form onSubmit={createFolder} className="pc-folder-form">
            <div style={{ fontSize: 11, color: t.textSub, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
              Новая папка
            </div>
            <div className="pc-folder-form-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: 10, color: t.textMuted, letterSpacing: 0.3 }}>Иконка</label>
                <input value={folderForm.emoji}
                  onChange={e => setFolderForm({ ...folderForm, emoji: e.target.value })}
                  className="pc-input pc-input-emoji"
                  placeholder="◆"
                  title="Введите эмодзи или символ для папки"
                  style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                <label style={{ fontSize: 10, color: t.textMuted, letterSpacing: 0.3 }}>Название *</label>
                <input value={folderForm.name} autoFocus
                  onChange={e => setFolderForm({ ...folderForm, name: e.target.value })}
                  placeholder="Например: Работа, Учёба..."
                  required
                  className="pc-input"
                  style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, flex: 1 }}
                />
              </div>
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>
              Цвет папки
            </div>
            <div className="pc-color-swatches">
              {['#8B5CF6','#F54B64','#5CB85C','#F0A30A','#5BC0DE','#FF6B9D'].map(c => (
                <div key={c} className="pc-swatch"
                  style={{ background: c, borderColor: folderForm.color === c ? '#fff' : 'transparent' }}
                  title={c}
                  onClick={() => setFolderForm({ ...folderForm, color: c })} />
              ))}
            </div>
            {!folderForm.name.trim() && (
              <div style={{ fontSize: 11, color: '#ff8899', marginBottom: 4 }}>
                Введите название папки
              </div>
            )}
            <div className="pc-folder-form-actions">
              <button type="button" className="pc-btn-ghost pc-btn-sm" style={{ color: t.textSub, borderColor: t.cardBorder }}
                onClick={() => setShowFolderForm(false)}>Отмена</button>
              <button type="submit" className="pc-btn-primary pc-btn-sm"
                style={{ background: `linear-gradient(135deg, ${folderForm.color}, ${folderForm.color}bb)` }}>Создать</button>
            </div>
          </form>
        ) : (
          <button className="pc-add-folder-btn" style={{ color: t.textMuted, borderColor: t.cardBorder }}
            onClick={() => setShowFolderForm(true)}>
            <span>+</span> Новая папка
          </button>
        )}
      </div>

      {/* Bottom actions */}
      <div className="pc-sidebar-bottom" style={{ borderTopColor: t.cardBorder }}>
        <SidebarBtn icon={<PaletteIcon />} label="Тема" onClick={() => setShowThemePanel(true)} t={t} />
        <a
          href="https://t.me/chroniclenotifybot"
          target="_blank"
          rel="noopener noreferrer"
          className="pc-sidebar-btn sidebar-action-btn pc-bot-link"
          style={{ color: t.textSub, textDecoration: 'none' }}
          title="Открыть Telegram бот"
        >
          <span className="pc-sidebar-btn-icon"><TelegramIcon /></span>
          Telegram бот
        </a>
        <SidebarBtn icon={<LogoutIcon />} label="Выйти" onClick={onSignOut} t={t} danger />
      </div>
    </div>
  )
}

function SidebarBtn({ icon, label, onClick, t, danger }) {
  return (
    <button className="pc-sidebar-btn sidebar-action-btn"
      style={{ color: danger ? t.danger : t.textSub }}
      onClick={() => onClick()}>
      <span className="pc-sidebar-btn-icon">{icon}</span>
      {label}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  TASK CARD
// ═══════════════════════════════════════════════════════════════════
function TaskCard({ task, t, index, onToggle, onDelete, onEdit, folders, completed }) {
  const days = getDaysLeft(task.due_date)
  const daysLabel = getDaysLeftLabel(days)
  const daysColor = getDaysColor(days, t)
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
  const folder = folders.find(f => String(f.id) === String(task.folder_id))
  const xpReward = getXP(task.priority)
  const isUrgent = !completed && days !== null && days <= 1

  return (
    <div className="pc-task task-card"
      style={{
        background: t.card,
        borderColor: isUrgent ? `${t.danger}33` : t.cardBorder,
        opacity: completed ? 0.5 : 1,
        boxShadow: isUrgent ? `0 0 24px ${t.danger}12` : 'none',
        animationDelay: `${index * 0.04}s`,
      }}
      onClick={onToggle}>

      {/* Checkbox */}
      <div className="pc-checkbox"
        style={{
          borderColor: completed ? t.success : priority.color,
          background: completed ? t.success : 'transparent',
          boxShadow: completed ? `0 0 12px ${t.success}44` : 'none',
        }}>
        {completed && <CheckIcon />}
      </div>

      {/* Content */}
      <div className="pc-task-content">
        <div className="pc-task-title" style={{
          color: completed ? t.textSub : t.text,
          textDecoration: completed ? 'line-through' : 'none',
          textDecorationColor: `rgba(${hexToRgb(t.text)},0.3)`,
        }}>
          {task.title}
        </div>

        <div className="pc-task-meta">
          <span className="pc-priority-badge"
            style={{ color: priority.color, background: `${priority.color}15`, borderColor: `${priority.color}28` }}>
            {priority.label}
          </span>

          {task.due_date && (
            <span className="pc-due-date" style={{ color: completed ? t.textMuted : daysColor }}>
              {formatDate(task.due_date)}
              {task.due_time && <span style={{ opacity: 0.75 }}> · {task.due_time.slice(0,5)}</span>}
              {!completed && daysLabel && (
                <span className="pc-days-badge"
                  style={{ color: daysColor, background: `${daysColor}15`, borderColor: `${daysColor}28` }}>
                  {daysLabel}
                </span>
              )}
            </span>
          )}

          {folder && (
            <span className="pc-task-folder" style={{ color: folder.color || t.textMuted }}>
              {folder.emoji} {folder.name}
            </span>
          )}

          {!completed && (
            <span className="pc-xp-reward" style={{ color: t.textMuted }}>+{xpReward} XP</span>
          )}
        </div>
      </div>

      {/* Edit */}
      {!completed && (
        <button className="pc-task-edit" style={{ color: t.textMuted }}
          onClick={e => { e.stopPropagation(); onEdit() }}>
          ✎
        </button>
      )}

      {/* Delete */}
      <button className="pc-task-delete" style={{ color: t.textMuted }}
        onClick={e => { e.stopPropagation(); onDelete() }}>
        ✕
      </button>
    </div>
  )
}

// ─── States ──────────────────────────────────────────────────────
function LoadingState({ t }) {
  return (
    <div className="pc-loading-list">
      {[1,2,3,4].map(i => (
        <div key={i} className="pc-skeleton"
          style={{ background: `linear-gradient(90deg, ${t.card} 0%, ${t.surface} 50%, ${t.card} 100%)`, animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )
}

function EmptyState({ t, activeFolder, setShowForm }) {
  const msgs = {
    urgent: { icon: <span style={{ fontSize: 48 }}>◉</span>, title: 'Срочных нет', sub: 'Отличная работа — ничего не горит' },
    today:  { icon: <span style={{ fontSize: 48 }}>◎</span>, title: 'День свободен', sub: 'Сегодня нет задач с дедлайном' },
    all:    { icon: <span style={{ fontSize: 48 }}>◈</span>, title: 'Пока пусто', sub: 'Создай первое задание в системе' },
  }
  const m = msgs[activeFolder] || msgs.all

  return (
    <div className="pc-empty">
      <div className="pc-empty-icon" style={{ color: t.primary, opacity: 0.4 }}>{m.icon}</div>
      <div className="pc-empty-title" style={{ color: t.text }}>{m.title}</div>
      <div className="pc-empty-sub" style={{ color: t.textSub }}>{m.sub}</div>
      {activeFolder === 'all' && (
        <button className="pc-btn-primary pc-empty-cta"
          style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.primaryEnd})`, boxShadow: `0 4px 24px ${t.glow}` }}
          onClick={() => setShowForm(true)}>
          + Первое задание
        </button>
      )}
    </div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────
function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <rect width="26" height="26" rx="7" fill="url(#pc-logo-g)" />
      <path d="M7 10h12M7 13h8M7 16h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="pc-logo-g" x1="0" y1="0" x2="26" y2="26">
          <stop stopColor="#7C6AF7" /><stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  )
}
function CheckIcon() {
  return <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" /></svg>
}
function MenuIcon() {
  return <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><path d="M1 1h16M1 7h10M1 13h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
}
function DeleteIcon({ color }) {
  return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 8h16M10 8V6h8v2M11 12v7M17 12v7" stroke={color} strokeWidth="1.5" strokeLinecap="round" /><rect x="7" y="8" width="14" height="14" rx="3" stroke={color} strokeWidth="1.5" /></svg>
}
function PaletteIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" /><circle cx="5.5" cy="6.5" r="1" fill="currentColor" /><circle cx="10.5" cy="6.5" r="1" fill="currentColor" /><circle cx="8" cy="10" r="1" fill="currentColor" /></svg>
}
function TelegramIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 2L1 7l5 2 2 5 2-4 4-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
}
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 1v3M11 1v3M1 7h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="5.5" cy="10.5" r="0.8" fill="currentColor" />
      <circle cx="8.5" cy="10.5" r="0.8" fill="currentColor" />
      <circle cx="11.5" cy="10.5" r="0.8" fill="currentColor" />
    </svg>
  )
}
function LogoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3h3a1 1 0 011 1v8a1 1 0 01-1 1h-3M7 11l4-3-4-3M1 8h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
}

// ═══════════════════════════════════════════════════════════════════
//  GLOBAL CSS
// ═══════════════════════════════════════════════════════════════════
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --font-sans:  'DM Sans', sans-serif;
  --font-display: 'Syne', sans-serif;
  --font-mono:  'DM Mono', monospace;
  --bg: #030407;
  --primary: #F54B64;
  --primary-end: #F78361;
  --text: #fff;
  --text-muted: #3d3d50;
  --text-sub: #7a7a9a;
  --glow: rgba(245,75,100,0.2);
  --danger: #FF4466;
  --success: #00E887;
  --card: rgba(255,255,255,0.028);
  --card-border: rgba(255,255,255,0.07);
  --surface: rgba(255,255,255,0.04);
}

html, body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  min-height: 100%;
  overflow-x: hidden;
  cursor: none;
}

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

/* ── Custom cursor ── */
.pc-cursor-dot {
  position: fixed; top: 0; left: 0;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--primary);
  pointer-events: none;
  z-index: 9999;
  will-change: transform;
}
.pc-cursor-ring {
  position: fixed; top: 0; left: 0;
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(245,75,100,0.35);
  pointer-events: none;
  z-index: 9998;
  transition: border-color 0.3s;
  will-change: transform;
}
.pc-cursor-ring.pc-cursor-hover {
  border-color: var(--primary);
  transform: scale(1.3) !important;
}

/* ── Canvas & effects ── */
.pc-canvas {
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 0;
}
.pc-scanlines {
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 1;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.018) 2px, rgba(0,0,0,0.018) 4px);
}

/* ── Keyframes ── */
@keyframes pc-fade-up   { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pc-fade-in   { from { opacity: 0; } to { opacity: 1; } }
@keyframes pc-level-up  { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.6); } 15% { opacity: 1; transform: translate(-50%,-50%) scale(1.04); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%,-50%) scale(0.95); } }
@keyframes pc-float-xp  { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-70px) scale(1.2); } }
@keyframes pc-rank-glow { 0%, 100% { text-shadow: 0 0 20px currentColor; } 50% { text-shadow: 0 0 50px currentColor, 0 0 80px currentColor; } }
@keyframes pc-pulse-ring { 0% { transform: translate(-50%,-50%) scale(1); opacity: 0.8; } 100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; } }
@keyframes pc-shimmer   { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes pc-slide-in  { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes pc-spin      { to { transform: rotate(360deg); } }

.task-card { animation: pc-fade-up 0.35s ease both; }
.task-card:hover { transform: translateY(-2px); }
.folder-item { animation: pc-fade-up 0.25s ease both; }
.xp-bar-fill { transition: width 0.9s cubic-bezier(0.22, 1, 0.36, 1); }

/* ── Layout ── */
.pc-root {
  position: relative;
  z-index: 2;
  display: flex;
  min-height: 100vh;
}

/* ── Sidebar ── */
.pc-sidebar {
  width: 256px;
  height: 100vh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid;
  z-index: 10;
  flex-shrink: 0;
  overflow-y: auto;
}
.sidebar-desktop { display: flex; }

.pc-sidebar-logo {
  padding: 22px 20px 18px;
  border-bottom: 1px solid;
  flex-shrink: 0;
}
.pc-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.pc-logo-text {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.pc-user-email {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Rank panel */
.pc-rank-panel {
  margin: 14px 12px;
  border-radius: 16px;
  border: 1px solid;
  padding: 16px;
  flex-shrink: 0;
}
.pc-rank-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 8px;
}
.pc-rank-label-small {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  margin-bottom: 4px;
}
.pc-rank-badge {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
  animation: pc-rank-glow 3s ease-in-out infinite;
}
.pc-xp-number {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
}
.pc-rank-title {
  font-size: 11px;
  margin-bottom: 10px;
}
.pc-xp-track {
  height: 5px;
  border-radius: 5px;
  overflow: hidden;
}
.pc-xp-fill {
  height: 100%;
  border-radius: 5px;
}
.pc-xp-needed {
  font-size: 10px;
  margin-top: 6px;
  text-align: right;
  font-family: var(--font-mono);
}

/* Folders */
.pc-folders-section {
  flex: 1;
  padding: 8px 8px;
  overflow-y: auto;
}
.pc-section-title {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  padding: 6px 12px 4px;
}
.pc-folder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 12px;
  margin-bottom: 2px;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.15s ease;
}
.pc-folder-emoji {
  font-size: 14px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}
.pc-folder-name { flex: 1; font-size: 13px; transition: color 0.15s; }
.pc-folder-count { font-size: 12px; font-weight: 600; font-family: var(--font-mono); }
.pc-folder-delete {
  background: none; border: none; cursor: pointer;
  font-size: 12px; padding: 2px 4px; opacity: 0;
  transition: opacity 0.2s;
}
.pc-folder-item:hover .pc-folder-delete { opacity: 0.6; }

.pc-folder-form { padding: 8px 4px; }
.pc-folder-form-row { display: flex; gap: 8px; margin-bottom: 10px; }
.pc-input-emoji { width: 44px; text-align: center; font-size: 14px; flex-shrink: 0; }
.pc-color-swatches { display: flex; gap: 6px; margin-bottom: 10px; }
.pc-swatch {
  width: 18px; height: 18px; border-radius: 50%;
  cursor: pointer; border: 2px solid transparent;
  transition: transform 0.15s;
}
.pc-swatch:hover { transform: scale(1.2); }
.pc-folder-form-actions { display: flex; gap: 6px; }

.pc-add-folder-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; background: none;
  border: 1px dashed; border-radius: 12px;
  padding: 9px 12px; cursor: pointer; font-size: 13px;
  transition: all 0.2s;
  font-family: var(--font-sans);
  margin-top: 4px;
}
.pc-add-folder-btn:hover { opacity: 0.8; }

/* Sidebar bottom */
.pc-sidebar-bottom {
  padding: 12px 8px 16px;
  border-top: 1px solid;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pc-sidebar-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; background: none; border: none;
  border-radius: 10px; padding: 9px 12px;
  cursor: pointer; font-size: 13px;
  font-family: var(--font-sans);
  text-align: left;
  transition: background 0.15s;
}
.pc-sidebar-btn:hover { background: rgba(255,255,255,0.04); }
.pc-sidebar-btn-icon { display: flex; align-items: center; flex-shrink: 0; }

/* ── Main ── */
.pc-main {
  flex: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}
.main-content { margin-left: 0; }

/* Header */
.pc-header {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px;
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(3,4,7,0.7);
  flex-shrink: 0;
}
.pc-header-left { display: flex; align-items: center; gap: 14px; }
.pc-header-folder { display: flex; align-items: center; gap: 8px; }
.pc-header-folder-emoji {
  font-size: 14px;
  font-family: var(--font-mono);
  width: 20px; text-align: center;
}
.pc-header-folder-name {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.pc-header-count {
  font-size: 11px; font-weight: 600;
  font-family: var(--font-mono);
  padding: 2px 7px; border-radius: 99px;
  border: 1px solid;
}
.pc-header-right { display: flex; align-items: center; gap: 14px; }
.pc-header-progress { display: flex; align-items: center; gap: 8px; }
.pc-header-progress-bar { width: 80px; height: 4px; border-radius: 4px; overflow: hidden; }
.pc-header-progress-fill { height: 100%; border-radius: 4px; transition: width 0.8s ease; }
.pc-header-progress-text { font-family: var(--font-mono); font-size: 11px; }

.pc-menu-btn {
  display: none;
  align-items: center; justify-content: center;
  width: 36px; height: 36px;
  background: none; border: 1px solid;
  border-radius: 10px; cursor: pointer;
}
.pc-add-btn {
  display: flex; align-items: center; gap: 8px;
  border: none; border-radius: 12px;
  padding: 10px 18px;
  color: #fff; cursor: pointer;
  font-family: var(--font-sans);
  font-size: 14px; font-weight: 600;
  transition: all 0.2s;
}
.pc-add-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
.pc-add-btn-label { }

/* ── Form ── */
.pc-form-wrapper { padding: 16px 24px 0; animation: pc-fade-up 0.3s ease; }
.pc-form {
  border-radius: 18px;
  border: 1px solid;
  padding: 22px 22px 24px;
  margin-bottom: 4px;
}
.pc-form-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.pc-form-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; }
.pc-form-close { background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px; opacity: 0.5; transition: opacity 0.2s; }
.pc-form-close:hover { opacity: 1; }
.pc-input-title { width: 100%; font-size: 16px; margin-bottom: 14px; }
.pc-form-error { padding: 10px 14px; border-radius: 10px; border: 1px solid; font-size: 13px; margin-bottom: 14px; }
.pc-form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 18px; }
.pc-form-field label { display: block; font-size: 11px; margin-bottom: 6px; font-family: var(--font-mono); letter-spacing: 0.06em; }
.pc-form-footer { display: flex; gap: 10px; justify-content: flex-end; }

/* Fix select option text on all browsers */
.pc-select option {
  background: #0d0d1a;
  color: #ffffff;
  font-family: var(--font-sans);
  padding: 8px;
}

/* ── Input base ── */
.pc-input {
  border-radius: 10px;
  border: 1px solid;
  padding: 10px 14px;
  font-family: var(--font-sans);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
}
.pc-input:focus { border-color: var(--primary) !important; }

/* ── Buttons ── */
.pc-btn-primary {
  border: none; border-radius: 12px;
  padding: 11px 22px;
  color: #fff; cursor: pointer;
  font-family: var(--font-sans);
  font-size: 14px; font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
}
.pc-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
.pc-btn-ghost {
  background: none; border: 1px solid;
  border-radius: 12px; padding: 11px 22px;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 14px; font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}
.pc-btn-ghost:hover { opacity: 0.8; }
.pc-btn-danger {
  border: none; border-radius: 12px;
  padding: 11px 22px;
  color: #fff; cursor: pointer;
  font-family: var(--font-sans);
  font-size: 14px; font-weight: 600;
  transition: all 0.2s;
}
.pc-btn-danger:hover { filter: brightness(1.1); }
.pc-btn-sm { padding: 8px 14px; font-size: 13px; border-radius: 10px; }

/* ── Task list ── */
.pc-task-list {
  flex: 1;
  padding: 20px 24px 40px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Task card ── */
.pc-task {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  backdrop-filter: blur(8px);
}
.pc-task:hover { transform: translateY(-2px); }

.pc-checkbox {
  width: 22px; height: 22px;
  border-radius: 6px;
  border: 2px solid;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  transition: all 0.25s ease;
}
.pc-task-content { flex: 1; min-width: 0; }
.pc-task-title {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  margin-bottom: 8px;
  transition: color 0.2s;
}
.pc-task-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }

.pc-priority-badge {
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 6px;
  border: 1px solid;
  font-family: var(--font-mono);
}
.pc-due-date { font-size: 12px; display: flex; align-items: center; gap: 5px; }
.pc-days-badge {
  font-size: 10px; font-weight: 700;
  padding: 1px 6px; border-radius: 5px;
  border: 1px solid;
  font-family: var(--font-mono);
}
.pc-task-folder { font-size: 12px; }
.pc-xp-reward {
  font-size: 11px;
  margin-left: auto;
  font-family: var(--font-mono);
  opacity: 0.6;
}

.pc-task-delete {
  background: none; border: none;
  cursor: pointer; font-size: 14px;
  padding: 4px; border-radius: 6px;
  flex-shrink: 0; opacity: 0;
  transition: opacity 0.2s;
  margin-top: -2px;
}
.pc-task:hover .pc-task-delete { opacity: 0.5; }
.pc-task-delete:hover { opacity: 1 !important; }

.pc-task-edit {
  background: none; border: none;
  cursor: pointer; font-size: 15px;
  padding: 4px; border-radius: 6px;
  flex-shrink: 0; opacity: 0;
  transition: opacity 0.2s;
  margin-top: -2px;
}
.pc-task:hover .pc-task-edit { opacity: 0.4; }
.pc-task-edit:hover { opacity: 0.9 !important; }

/* ── Section divider ── */
.pc-section-divider {
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; font-family: var(--font-mono);
  letter-spacing: 0.08em;
  padding: 8px 0;
  opacity: 0.5;
}
.pc-section-divider span:not(:nth-child(2)) { flex: 1; height: 1px; background: currentColor; opacity: 0.3; }

/* ── Loading skeleton ── */
.pc-loading-list { display: flex; flex-direction: column; gap: 8px; }
.pc-skeleton {
  height: 72px; border-radius: 16px;
  background-size: 200% 100%;
  animation: pc-shimmer 1.5s ease infinite;
}

/* ── Empty state ── */
.pc-empty { text-align: center; padding: 80px 24px; animation: pc-fade-up 0.4s ease; }
.pc-empty-icon { margin-bottom: 20px; }
.pc-empty-title { font-family: var(--font-display); font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.pc-empty-sub { font-size: 14px; margin-bottom: 28px; }
.pc-empty-cta { margin: 0 auto; display: inline-flex; }

/* ── Modals ── */
.pc-overlay {
  position: fixed; inset: 0; z-index: 800;
  background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  animation: pc-fade-in 0.2s ease;
}
.pc-levelup-overlay { pointer-events: none; background: rgba(0,0,0,0.5); }

.pc-modal {
  border-radius: 22px;
  border: 1px solid;
  padding: 32px 36px;
  max-width: 400px;
  width: 100%;
  animation: pc-fade-up 0.3s ease;
  position: relative;
}
.pc-modal-wide { max-width: 500px; }
.pc-modal-icon { text-align: center; margin-bottom: 16px; }
.pc-modal-title { font-family: var(--font-display); font-size: 20px; font-weight: 700; margin-bottom: 10px; text-align: center; }
.pc-modal-sub { font-size: 14px; text-align: center; margin-bottom: 24px; line-height: 1.6; }
.pc-modal-actions { display: flex; gap: 10px; justify-content: center; }

/* Level up */
.pc-levelup-card {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(5,5,15,0.92);
  backdrop-filter: blur(24px);
  border-radius: 24px;
  border: 1px solid;
  padding: 56px 72px;
  text-align: center;
  animation: pc-level-up 4s ease forwards;
}
.pc-levelup-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.3em;
  color: rgba(255,255,255,0.4);
  margin-bottom: 16px;
}
.pc-levelup-rank {
  font-family: var(--font-display);
  font-size: 96px;
  font-weight: 800;
  line-height: 1;
  animation: pc-rank-glow 1s ease-in-out infinite;
}
.pc-levelup-name {
  font-family: var(--font-display);
  font-size: 18px;
  color: rgba(255,255,255,0.8);
  margin-top: 14px;
}
.pc-pulse-ring {
  position: absolute;
  top: 50%; left: 50%;
  width: 200px; height: 200px;
  border-radius: 50%;
  border: 1.5px solid;
  animation: pc-pulse-ring 1.2s ease-out infinite;
  pointer-events: none;
}

/* Float XP */
.pc-float-xp {
  position: fixed;
  bottom: 120px; right: 32px;
  z-index: 500;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 22px;
  animation: pc-float-xp 2s ease forwards;
  pointer-events: none;
}

/* Theme grid */
.pc-theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.pc-theme-card {
  border-radius: 16px;
  border: 1px solid;
  padding: 18px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}
.pc-theme-card:hover { transform: translateY(-2px); }
.pc-theme-active { box-shadow: 0 0 0 2px currentColor; }

/* Debug */
.pc-debug-btn {
  align-self: flex-end;
  background: none; border: 1px solid;
  border-radius: 8px; padding: 6px 12px;
  cursor: pointer; font-size: 11px;
  font-family: var(--font-mono);
  margin: 0 24px 24px;
  transition: all 0.2s;
  opacity: 0.3;
}
.pc-debug-btn:hover { opacity: 0.8; }

/* ── Mobile overlay ── */
.pc-mobile-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 200;
  animation: pc-fade-in 0.2s ease;
}

/* ── Responsive — глубокая адаптивность ── */

/* DESKTOP (>= 769px) */
@media (min-width: 769px) {
  .mobile-sidebar-btn { display: none !important; }
  .sidebar-desktop    { display: flex !important; }
  .pc-mobile-only     { display: none !important; }
  .pc-fab             { display: none !important; }
}

/* TABLET (481px – 768px) */
@media (max-width: 768px) {
  .sidebar-desktop     { display: none !important; }
  .pc-menu-btn         { display: flex !important; }
  .pc-header           { padding: 12px 14px; gap: 8px; }
  .pc-header-right     { gap: 8px; }
  .pc-header-progress  { display: none; }
  .pc-add-btn-label    { display: none; }
  .pc-add-btn          { padding: 10px 12px; }
  .pc-cal-btn          { display: none; }
  .pc-task-list        { padding: 14px 14px 80px; gap: 7px; }
  .pc-task             { padding: 12px 14px; gap: 10px; }
  .pc-task-title       { font-size: 14px; }
  .pc-task-meta        { flex-wrap: wrap; gap: 4px; }
  .pc-form-wrapper     { padding: 12px 14px 0; }
  .pc-form             { padding: 16px 16px 18px; }
  .pc-form-row         { grid-template-columns: 1fr 1fr; gap: 8px; }
  .pc-form-footer      { flex-direction: column; gap: 8px; }
  .pc-btn-primary,
  .pc-btn-ghost        { width: 100%; text-align: center; justify-content: center; }
  .pc-modal            { width: calc(100vw - 32px); max-width: 380px; padding: 22px 18px; }
  .pc-modal-wide       { max-width: 98vw; }
  .pc-theme-grid       { grid-template-columns: repeat(2, 1fr) !important; }
  .pc-debug-btn        { margin: 0 14px 16px; }
}

/* MOBILE (max 480px) */
@media (max-width: 480px) {
  .pc-header               { padding: 10px 12px; }
  .pc-header-folder-name   { font-size: 14px; }
  .pc-header-count         { display: none; }
  .pc-task-list            { padding: 10px 10px 88px; gap: 6px; }
  .pc-task                 { padding: 10px 12px; gap: 8px; border-radius: 13px; }
  .pc-task-title           { font-size: 13px; line-height: 1.4; margin-bottom: 6px; }
  .pc-checkbox             { width: 20px; height: 20px; border-radius: 5px; }
  .pc-form-wrapper         { padding: 10px 10px 0; }
  .pc-form                 { padding: 14px 14px 16px; border-radius: 14px; }
  .pc-input-title          { font-size: 14px; }
  .pc-input                { font-size: 14px; padding: 9px 12px; }
  .pc-priority-badge       { font-size: 10px; padding: 2px 6px; }
  .pc-days-badge           { font-size: 10px; padding: 2px 6px; }
  .pc-levelup-card         { padding: 28px 24px; }
  .pc-levelup-rank         { font-size: 64px !important; }
  .pc-levelup-name         { font-size: 14px; }
  .pc-modal                { padding: 20px 16px; border-radius: 18px; }
  .pc-modal-actions        { flex-direction: column; gap: 8px; }
  .pc-modal-actions button { width: 100%; }
  .pc-theme-grid           { grid-template-columns: repeat(2, 1fr) !important; }
  .pc-folder-name          { font-size: 12px; }
  .pc-float-xp             { font-size: 18px !important; bottom: 100px; right: 20px; }
}

/* EXTRA SMALL (max 360px) */
@media (max-width: 360px) {
  .pc-task-title   { font-size: 12px; }
  .pc-header       { padding: 8px 10px; }
  .pc-task         { padding: 8px 10px; }
  .pc-theme-grid   { grid-template-columns: 1fr !important; }
}

/* FAB — floating add button on mobile */
@media (max-width: 768px) {
  .pc-fab {
    position: fixed; bottom: 22px; right: 16px; z-index: 90;
    width: 56px; height: 56px; border-radius: 50%; border: none;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 28px rgba(0,0,0,0.55);
    font-size: 26px; color: #fff;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .pc-fab:active { transform: scale(0.9); }
}

/* Touch-friendly tap targets */
@media (pointer: coarse) {
  .pc-folder-item  { padding: 11px 12px; min-height: 44px; }
  .pc-sidebar-btn  { min-height: 44px; }
  .pc-task         { min-height: 52px; }
  .pc-checkbox     { width: 24px; height: 24px; }
  .pc-btn-primary,
  .pc-btn-ghost,
  .pc-btn-danger   { min-height: 44px; }
  .pc-input        { min-height: 44px; }
  .pc-task-delete  { opacity: 0.4 !important; width: 32px; height: 32px; }
  .pc-task-edit    { opacity: 0.35 !important; width: 32px; height: 32px; }
}

/* Prevent overflow */
*, *::before, *::after { box-sizing: border-box; }
.pc-root { overflow-x: hidden; max-width: 100vw; }

/* Safe-area insets for notch/home-bar phones */
@supports (padding: max(0px)) {
  .pc-header    { padding-top: max(16px, env(safe-area-inset-top)); }
  .pc-task-list { padding-bottom: max(88px, calc(72px + env(safe-area-inset-bottom))); }
  .pc-fab       { bottom: max(22px, calc(16px + env(safe-area-inset-bottom))); }
}

/* Prevent body bounce showing white on dark backgrounds */
html, body { background: #030407; overflow-x: hidden; }

/* Mobile: sidebar width adapts to very narrow screens */
@media (max-width: 360px) {
  .pc-sidebar { width: min(260px, 88vw) !important; }
  .pc-sidebar-btn { padding: 8px 10px; font-size: 12px; }
  .pc-sidebar-logo { padding: 14px 12px 10px; }
}

/* Mobile: task delete always visible (no hover on touch) */
@media (pointer: coarse) {
  .pc-task-delete  { opacity: 0.45 !important; }
  .pc-task-edit    { opacity: 0.4 !important; }
  /* bot link tap target */
  .pc-bot-link { min-height: 44px; display: flex; align-items: center; }
}

/* Mobile header: prevent right-side overflow */
@media (max-width: 480px) {
  .pc-header-right { max-width: calc(100vw - 160px); overflow: hidden; flex-wrap: nowrap; }
}

/* Bot link in sidebar — styled same as SidebarBtn */
.pc-bot-link {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: 10px; border: none;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: opacity 0.15s; width: 100%;
}
.pc-bot-link:hover { opacity: 0.75; }
`;

