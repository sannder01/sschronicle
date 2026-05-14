'use client'
// ╔═══════════════════════════════════════════════════════════════════╗
// ║  CHRONICLE — PLANNER CLIENT  v3.0  (MULTI-PAGE REDESIGN)         ║
// ║  5 pages: Tasks · Habits · Ranks · Calendar+Analytics · Profile  ║
// ║  Swipe navigation · Clean monochrome theme · Folder renaming     ║
// ╚═══════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useRef, useCallback } from 'react'
import { signOut, useSession } from 'next-auth/react'
import CalendarView from './CalendarView'
import CharacterPanel from './CharacterPanel'
import HabitTracker from './HabitTracker'
import NotesPage from './NotesPage'
import AchievementsPage from './AchievementsPage'

// ═══════════════════════════════════════════════════════════════════
//  THEME — clean monochrome, task priority colors preserved
// ═══════════════════════════════════════════════════════════════════
const THEME = {
  bg: '#0a0a0a',
  bgGrad: '#0a0a0a',
  card: 'rgba(255,255,255,0.04)',
  cardHover: 'rgba(255,255,255,0.07)',
  cardBorder: 'rgba(255,255,255,0.08)',
  cardBorderHover: 'rgba(255,255,255,0.22)',
  primary: '#ffffff', primaryEnd: '#cccccc', primaryRgb: '255,255,255',
  text: '#ffffff', textMuted: '#888888', textSub: '#aaaaaa',
  accent: '#ffffff', glow: 'rgba(255,255,255,0.08)',
  surface: 'rgba(255,255,255,0.06)', sidebar: 'rgba(8,8,8,0.95)',
  inputBg: 'rgba(255,255,255,0.05)', overlay: 'rgba(0,0,0,0.85)',
  danger: '#ff4466', success: '#44ff88',
  navBg: '#0a0a0a',
}

// ═══════════════════════════════════════════════════════════════════
//  RANK SYSTEM
// ═══════════════════════════════════════════════════════════════════
const RANKS = [
  { rank: 'E',   min: 0,    max: 100,      color: '#888888', glow: '#444', label: 'Novice Hunter' },
  { rank: 'D',   min: 100,  max: 300,      color: '#5CB85C', glow: '#2d7a30', label: 'Iron Will' },
  { rank: 'C',   min: 300,  max: 600,      color: '#5BC0DE', glow: '#1a7fa0', label: 'Steel Mind' },
  { rank: 'B',   min: 600,  max: 1000,     color: '#9F5CE8', glow: '#6c35b0', label: 'Shadow Walker' },
  { rank: 'A',   min: 1000, max: 1500,     color: '#F0A30A', glow: '#b07000', label: 'Raid Commander' },
  { rank: 'S',   min: 1500, max: 2200,     color: '#E63946', glow: '#900020', label: 'Monarch' },
  { rank: 'SS',  min: 2200, max: 3000,     color: '#FFD700', glow: '#CC8800', label: 'Shadow Sovereign' },
  { rank: 'SSS', min: 3000, max: Infinity, color: '#E040FB', glow: '#9900CC', label: 'Sung Jin-Woo' },
]
function getRank(xp) {
  for (let i = RANKS.length - 1; i >= 0; i--) { if (xp >= RANKS[i].min) return RANKS[i] }
  return RANKS[0]
}
function getXP(priority) { return { high: 50, medium: 25, low: 10 }[priority] || 15 }
function xpToNextRank(xp) {
  const rank = getRank(xp)
  if (rank.max === Infinity) return { progress: 100, needed: 0 }
  return { progress: Math.min(((xp - rank.min) / (rank.max - rank.min)) * 100, 100), needed: rank.max - xp }
}

// ═══════════════════════════════════════════════════════════════════
//  UTILS
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
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
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
  { id: 'all',    name: 'Все задачи', emoji: '◈', color: '#888' },
  { id: 'today',  name: 'Сегодня',    emoji: '◎', color: '#F0A30A' },
  { id: 'urgent', name: 'Срочные',    emoji: '◉', color: '#FF4466' },
]

// ═══════════════════════════════════════════════════════════════════
//  PAGE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const PAGES = [
  { id: 0, label: 'Задачи',      icon: '◈' },
  { id: 1, label: 'Привычки',    icon: '🔥' },
  { id: 2, label: 'Персонаж',    icon: '⚔️' },
  { id: 3, label: 'Календарь',   icon: '📅' },
  { id: 4, label: 'Профиль',     icon: '👤' },
  { id: 5, label: 'Заметки',     icon: '📝' },
  { id: 6, label: 'Достижения',  icon: '🏆' },
]

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function PlannerClient() {
  const { data: session } = useSession()
  const t = THEME

  const [tasks, setTasks] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [xp, setXp] = useState(0)
  const [levelUpData, setLevelUpData] = useState(null)
  const [floatingXP, setFloatingXP] = useState([])

  const [activePage, setActivePage] = useState(0)
  const [activeFolder, setActiveFolder] = useState('all')

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', due_date: '', due_time: '', priority: 'medium', folder_id: '' })
  const [formError, setFormError] = useState('')

  const [showFolderForm, setShowFolderForm] = useState(false)
  const [folderForm, setFolderForm] = useState({ name: '', emoji: '◆', color: '#888888' })
  const [editingFolder, setEditingFolder] = useState(null)
  const [editFolderForm, setEditFolderForm] = useState({ name: '', emoji: '', color: '' })

  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', due_date: '', due_time: '', priority: 'medium', folder_id: '' })

  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const particlesRef = useRef([])
  const cursorDotRef = useRef(null)
  const cursorRingRef = useRef(null)
  const cursorRafRef = useRef(null)
  const taskListRef = useRef(null)

  // Swipe state
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  // ── Scroll task list to top when switching folders ───────────────
  useEffect(() => {
    if (taskListRef.current) taskListRef.current.scrollTop = 0
  }, [activeFolder])

  // ── Data Loading — wrapped in useCallback so useEffect dep is stable
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, foldersRes] = await Promise.all([fetch('/api/tasks'), fetch('/api/folders')])
      const tasksData = await tasksRes.json()
      const foldersData = await foldersRes.json()
      const safeTasks = Array.isArray(tasksData) ? tasksData : []
      setTasks(safeTasks)
      setFolders(Array.isArray(foldersData) ? foldersData : [])
      const taskXP = safeTasks.filter(tk => tk.completed).reduce((s, tk) => s + getXP(tk.priority), 0)
      const storedHabitXP = parseInt(localStorage.getItem('chronicle_habit_xp') || '0', 10)
      setXp(taskXP + storedHabitXP)
      localStorage.setItem('chronicle_tasks_cache', JSON.stringify(safeTasks))
      localStorage.setItem('chronicle_folders_cache', JSON.stringify(foldersData))
    } catch {
      const ct = localStorage.getItem('chronicle_tasks_cache')
      const cf = localStorage.getItem('chronicle_folders_cache')
      if (ct) { const c = JSON.parse(ct); setTasks(c); setXp(c.filter(tk => tk.completed).reduce((s, tk) => s + getXP(tk.priority), 0)) }
      if (cf) setFolders(JSON.parse(cf))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Custom cursor (desktop only) ─────────────────────────────────
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const dot = document.createElement('div')
    const ring = document.createElement('div')
    dot.className = 'pc-cursor-dot'; ring.className = 'pc-cursor-ring'
    document.body.appendChild(dot); document.body.appendChild(ring)
    cursorDotRef.current = dot; cursorRingRef.current = ring
    let mx = 0, my = 0, rx = 0, ry = 0
    const onMove = e => { mx = e.clientX; my = e.clientY }
    window.addEventListener('mousemove', onMove)
    const onOver = e => { if (e.target.closest('button, a, [role=button]')) ring.classList.add('pc-cursor-hover') }
    const onOut  = e => { if (e.target.closest('button, a, [role=button]')) ring.classList.remove('pc-cursor-hover') }
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    const loop = () => {
      dot.style.transform = `translate(${mx-4}px,${my-4}px)`
      rx += (mx-rx)*0.1; ry += (my-ry)*0.1
      ring.style.transform = `translate(${rx-18}px,${ry-18}px)`
      cursorRafRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => {
      cancelAnimationFrame(cursorRafRef.current)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      dot.remove(); ring.remove()
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
    particlesRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 0.8 + 0.2, vx: (Math.random()-0.5)*0.1, vy: (Math.random()-0.5)*0.1,
      alpha: Math.random() * 0.3 + 0.05,
    }))
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
        ctx.fillStyle = `rgba(255,255,255,${p.alpha*0.4})`; ctx.fill()
      })
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { window.removeEventListener('resize', resize); if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  // ── Task CRUD ─────────────────────────────────────────────────────
  async function createTask(e) {
    e.preventDefault()
    if (!formData.title.trim()) { setFormError('Введи название задания'); return }
    setFormError('')
    const SYSTEM = ['all','today','urgent']
    const fId = formData.folder_id ? String(formData.folder_id) : (!SYSTEM.includes(activeFolder) ? String(activeFolder) : null)
    try {
      const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formData.title.trim(), due_date: formData.due_date||null, due_time: formData.due_time||null, priority: formData.priority, folder_id: fId }) })
      if (!res.ok) { const err = await res.json().catch(()=>({})); setFormError(err.error||`Ошибка ${res.status}`); return }
      const created = await res.json()
      const updated = [created, ...tasks]
      setTasks(updated); localStorage.setItem('chronicle_tasks_cache', JSON.stringify(updated))
      setFormData({ title:'', due_date:'', due_time:'', priority:'medium', folder_id:'' }); setShowForm(false)
    } catch { setFormError('Ошибка соединения') }
  }

  async function toggleTask(task) {
    const was = task.completed; const prevXp = xp
    const updated = tasks.map(tk => tk.id === task.id ? { ...tk, completed: !was } : tk)
    setTasks(updated); localStorage.setItem('chronicle_tasks_cache', JSON.stringify(updated))
    if (!was) {
      const earned = getXP(task.priority); const newXp = xp + earned
      const oldRank = getRank(xp); const newRank = getRank(newXp)
      setXp(newXp); localStorage.setItem('chronicle_xp', String(newXp))
      const id = Date.now()
      setFloatingXP(prev => [...prev, { id, xp: earned }])
      setTimeout(() => setFloatingXP(prev => prev.filter(x => x.id !== id)), 2000)
      if (oldRank.rank !== newRank.rank) { setLevelUpData(newRank); setTimeout(() => setLevelUpData(null), 4000) }
    } else {
      const newXp = Math.max(0, xp - getXP(task.priority))
      setXp(newXp); localStorage.setItem('chronicle_xp', String(newXp))
    }
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !was }) })
      if (!res.ok) throw new Error('server error')
    } catch { setTasks(tasks); localStorage.setItem('chronicle_tasks_cache', JSON.stringify(tasks)); setXp(prevXp) }
  }

  async function deleteTask(id) {
    const updated = tasks.filter(tk => tk.id !== id)
    setTasks(updated); localStorage.setItem('chronicle_tasks_cache', JSON.stringify(updated)); setDeleteConfirm(null)
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
      setFolders(updated); localStorage.setItem('chronicle_folders_cache', JSON.stringify(updated))
      setFolderForm({ name:'', emoji:'◆', color:'#888888' }); setShowFolderForm(false)
    } catch {}
  }

  async function deleteFolder(id) {
    setFolders(folders.filter(f => f.id !== id))
    if (activeFolder === String(id)) setActiveFolder('all')
    try { await fetch(`/api/folders/${id}`, { method: 'DELETE' }) } catch {}
  }

  async function saveFolder(e) {
    e.preventDefault()
    if (!editFolderForm.name.trim() || !editingFolder) return
    try {
      const res = await fetch(`/api/folders/${editingFolder.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFolderForm),
      })
      if (res.ok) {
        const updated = await res.json()
        setFolders(prev => {
          const next = prev.map(f => f.id === updated.id ? updated : f)
          localStorage.setItem('chronicle_folders_cache', JSON.stringify(next))
          return next
        })
      }
    } catch {}
    setEditingFolder(null)
  }

  function openEditTask(task) {
    setEditingTask(task)
    setEditForm({ title: task.title||'', due_date: task.due_date ? String(task.due_date).slice(0,10) : '', due_time: task.due_time ? String(task.due_time).slice(0,5) : '', priority: task.priority||'medium', folder_id: task.folder_id ? String(task.folder_id) : '' })
  }

  async function saveEditTask(e) {
    e.preventDefault()
    if (!editForm.title.trim()) return
    const updates = { title: editForm.title.trim(), due_date: editForm.due_date||null, due_time: editForm.due_time||null, priority: editForm.priority, folder_id: editForm.folder_id ? Number(editForm.folder_id) : null }
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
      if (res.ok) { const updated = await res.json(); setTasks(prev => prev.map(tk => tk.id === updated.id ? updated : tk)); setEditingTask(null) }
    } catch {}
  }

  // ── Habit XP callback (called by HabitTracker) ────────────────────
  function onHabitComplete(earnedXp) {
    const newXp = xp + earnedXp
    const oldRank = getRank(xp); const newRank = getRank(newXp)
    setXp(newXp)
    localStorage.setItem('chronicle_xp', String(newXp))
    // FIX: renamed variable to avoid shadowing the outer `prev` callback arg
    const prevHabitXP = parseInt(localStorage.getItem('chronicle_habit_xp')||'0', 10)
    localStorage.setItem('chronicle_habit_xp', String(prevHabitXP + earnedXp))
    const id = Date.now()
    setFloatingXP(prev => [...prev, { id, xp: earnedXp }])
    setTimeout(() => setFloatingXP(prev => prev.filter(x => x.id !== id)), 2000)
    if (oldRank.rank !== newRank.rank) { setLevelUpData(newRank); setTimeout(() => setLevelUpData(null), 4000) }
  }

  function handleSignOut() { signOut({ callbackUrl: '/auth' }) }

  // ── Swipe handling ───────────────────────────────────────────────
  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0 && activePage < PAGES.length - 1) setActivePage(p => p + 1)
      if (dx > 0 && activePage > 0) setActivePage(p => p - 1)
    }
    touchStartX.current = null; touchStartY.current = null
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
  const pendingTasks = filteredTasks.filter(tk => !tk.completed)
  const doneTasks = filteredTasks.filter(tk => tk.completed)

  // Analytics data
  const completedByPriority = {
    high: tasks.filter(tk => tk.completed && tk.priority === 'high').length,
    medium: tasks.filter(tk => tk.completed && tk.priority === 'medium').length,
    low: tasks.filter(tk => tk.completed && tk.priority === 'low').length,
  }

  return (
    <>
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="pc-canvas" />
      <div style={{ position:'fixed', inset:0, background:'#0a0a0a', zIndex:0, pointerEvents:'none' }} />

      {/* ── LEVEL UP ── */}
      {levelUpData && (
        <div className="pc-overlay pc-levelup-overlay">
          <div className="pc-levelup-card" style={{ borderColor: `${levelUpData.color}33`, boxShadow: `0 0 100px ${levelUpData.glow}` }}>
            <div className="pc-levelup-label">РАНГ ПОВЫШЕН</div>
            <div className="pc-levelup-rank" style={{ color: levelUpData.color, textShadow: `0 0 40px ${levelUpData.glow}` }}>{levelUpData.rank}</div>
            <div className="pc-levelup-name">{levelUpData.label}</div>
            {[1,2,3].map(i => <div key={i} className="pc-pulse-ring" style={{ borderColor: levelUpData.color, animationDelay: `${i*0.25}s` }} />)}
          </div>
        </div>
      )}

      {/* ── FLOATING XP ── */}
      {floatingXP.map(item => (
        <div key={item.id} className="pc-float-xp" style={{ color: t.text }}>+{item.xp} XP</div>
      ))}

      {/* ── DELETE MODAL ── */}
      {/* FIX: zIndex 900 > FitnessTracker modals at 800; type="button" on all non-submit buttons */}
      {deleteConfirm && (
        <div className="pc-overlay" style={{ zIndex: 900 }} onClick={() => setDeleteConfirm(null)}>
          <div className="pc-modal" onClick={e => e.stopPropagation()} style={{ background: '#111', borderColor: `${t.danger}33` }}>
            <div className="pc-modal-icon"><DeleteIcon color={t.danger} /></div>
            <div className="pc-modal-title" style={{ color: t.text }}>Удалить задание?</div>
            <div className="pc-modal-sub" style={{ color: t.textSub }}>«{deleteConfirm.title}» будет удалено навсегда.</div>
            <div className="pc-modal-actions">
              <button type="button" className="pc-btn-ghost" style={{ color: t.textSub, borderColor: t.cardBorder }} onClick={() => setDeleteConfirm(null)}>Отмена</button>
              <button type="button" className="pc-btn-danger" style={{ background: t.danger }} onClick={() => deleteTask(deleteConfirm.id)}>Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT FOLDER MODAL ── */}
      {editingFolder && (
        <div className="pc-overlay" style={{ zIndex: 900 }} onClick={() => setEditingFolder(null)}>
          <div className="pc-modal" onClick={e => e.stopPropagation()} style={{ background: '#111', borderColor: t.cardBorder }}>
            <div className="pc-modal-title" style={{ color: t.text }}>✏️ Переименовать папку</div>
            <form onSubmit={saveFolder} style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', gap:8 }}>
                <input value={editFolderForm.emoji} onChange={e => setEditFolderForm(f => ({...f, emoji: e.target.value}))}
                  className="pc-input" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, width: 52, textAlign:'center', fontSize: 18 }} />
                <input required value={editFolderForm.name} autoFocus onChange={e => setEditFolderForm(f => ({...f, name: e.target.value}))}
                  className="pc-input" placeholder="Название папки" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, flex: 1 }} />
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {['#888888','#FF4466','#5CB85C','#F0A30A','#5BC0DE','#8B5CF6'].map(c => (
                  <div key={c} onClick={() => setEditFolderForm(f => ({...f, color: c}))}
                    style={{ width:22, height:22, borderRadius:'50%', background: c, cursor:'pointer', border: editFolderForm.color === c ? '2px solid #fff' : '2px solid transparent', transition:'transform 0.15s' }} />
                ))}
              </div>
              <div className="pc-modal-actions">
                <button type="button" className="pc-btn-ghost" style={{ color: t.textSub, borderColor: t.cardBorder }} onClick={() => setEditingFolder(null)}>Отмена</button>
                <button type="submit" className="pc-btn-primary" style={{ background: editFolderForm.color || '#fff', color: '#000' }}>Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT TASK MODAL ── */}
      {editingTask && (
        <div className="pc-overlay" style={{ zIndex: 900 }} onClick={e => e.target === e.currentTarget && setEditingTask(null)}>
          <div className="pc-modal" style={{ background: '#111', borderColor: t.cardBorder }}>
            <div className="pc-modal-title" style={{ color: t.text }}>✏️ Редактировать задание</div>
            <form onSubmit={saveEditTask} style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <input className="pc-input pc-input-title" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }} placeholder="Название задания..." value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} autoFocus />
              <div className="pc-form-row">
                <div className="pc-form-field"><label style={{ color: t.textSub }}>Дата</label><input type="date" className="pc-input" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, colorScheme:'dark' }} value={editForm.due_date} onChange={e => setEditForm({...editForm, due_date: e.target.value})} /></div>
                <div className="pc-form-field"><label style={{ color: t.textSub }}>Время</label><input type="time" className="pc-input" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, colorScheme:'dark' }} value={editForm.due_time} onChange={e => setEditForm({...editForm, due_time: e.target.value})} /></div>
                <div className="pc-form-field"><label style={{ color: t.textSub }}>Приоритет</label>
                  <select className="pc-input pc-select" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }} value={editForm.priority} onChange={e => setEditForm({...editForm, priority: e.target.value})}>
                    <option value="high">Высокий (+50 XP)</option><option value="medium">Средний (+25 XP)</option><option value="low">Низкий (+10 XP)</option>
                  </select></div>
                <div className="pc-form-field"><label style={{ color: t.textSub }}>Папка</label>
                  <select className="pc-input pc-select" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }} value={editForm.folder_id} onChange={e => setEditForm({...editForm, folder_id: e.target.value})}>
                    <option value="">Без папки</option>{folders.map(f => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
                  </select></div>
              </div>
              <div className="pc-modal-actions">
                <button type="button" className="pc-btn-ghost" style={{ color: t.textSub, borderColor: t.cardBorder }} onClick={() => setEditingTask(null)}>Отмена</button>
                <button type="submit" className="pc-btn-primary" style={{ background: '#fff', color: '#000' }}>Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ROOT ── */}
      <div className="pc-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        {/* ── PAGES ── */}
        <div className="pc-pages-outer">
          <div className="pc-pages-inner" style={{ transform: `translateX(-${activePage * (100/7)}%)` }}>

            {/* ══ PAGE 0: TASKS ══════════════════════════════════════════ */}
            <div className="pc-page">
              {/* Top bar */}
              <header className="pc-header">
                <div className="pc-header-left">
                  <div className="pc-header-folder">
                    <span className="pc-header-folder-emoji">{activeFolderData.emoji}</span>
                    <span className="pc-header-folder-name" style={{ color: t.text }}>{activeFolderData.name}</span>
                    {filteredTasks.length > 0 && <span className="pc-header-count" style={{ color: t.text, borderColor: t.cardBorder, background: t.surface }}>{filteredTasks.length}</span>}
                  </div>
                </div>
                <div className="pc-header-right">
                  {totalCount > 0 && (
                    <div className="pc-header-progress" title={`${completedCount}/${totalCount}`}>
                      <div className="pc-header-progress-bar" style={{ background: t.surface }}>
                        <div className="pc-header-progress-fill" style={{ width: `${Math.round((completedCount/totalCount)*100)}%`, background: t.text }} />
                      </div>
                      <span className="pc-header-progress-text" style={{ color: t.textSub }}>{Math.round((completedCount/totalCount)*100)}%</span>
                    </div>
                  )}
                  {/* FIX: type="button" to prevent accidental form submit */}
                  <button type="button" className="pc-add-btn" aria-label="Создать задание" style={{ background: t.text, color: '#000' }} onClick={() => setShowForm(true)}>
                    <span>+</span><span className="pc-add-btn-label">Задание</span>
                  </button>
                </div>
              </header>

              {/* Folder tabs */}
              <div className="pc-folder-tabs">
                {allFolders.map(folder => {
                  const isBuiltin = ['all','today','urgent'].includes(folder.id)
                  const isActive = String(activeFolder) === String(folder.id)
                  return (
                    <div key={folder.id} className="pc-folder-tab-wrap">
                      {/* FIX: type="button" */}
                      <button type="button" className="pc-folder-tab" onClick={() => setActiveFolder(folder.id)}
                        style={{ background: isActive ? t.surface : 'transparent', borderColor: isActive ? (folder.color||'rgba(255,255,255,0.4)') : t.cardBorder, color: isActive ? t.text : t.textSub, fontWeight: isActive ? 600 : 400 }}>
                        <span style={{ color: folder.color||t.textSub }}>{folder.emoji}</span>
                        <span>{folder.name}</span>
                      </button>
                      {!isBuiltin && isActive && (
                        <button type="button" className="pc-folder-tab-edit" style={{ color: t.textSub }} onClick={() => { setEditingFolder(folder); setEditFolderForm({ name: folder.name, emoji: folder.emoji, color: folder.color }) }}>
                          ✎
                        </button>
                      )}
                    </div>
                  )
                })}
                {/* Add folder inline */}
                {showFolderForm ? (
                  <form onSubmit={createFolder} className="pc-folder-inline-form">
                    <input required value={folderForm.name} autoFocus onChange={e => setFolderForm({...folderForm, name: e.target.value})}
                      placeholder="Папка..." className="pc-input" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, height: 36, padding: '0 10px', fontSize: 13, width: 110 }} />
                    <button type="submit" className="pc-btn-primary" style={{ background: '#fff', color: '#000', padding: '0 12px', height: 36, fontSize: 13 }}>✓</button>
                    <button type="button" className="pc-btn-ghost" style={{ color: t.textSub, borderColor: t.cardBorder, padding: '0 10px', height: 36, fontSize: 13 }} onClick={() => setShowFolderForm(false)}>✕</button>
                  </form>
                ) : (
                  <button type="button" className="pc-folder-tab" onClick={() => setShowFolderForm(true)}
                    style={{ background: 'transparent', borderColor: t.cardBorder, borderStyle: 'dashed', color: t.textMuted }}>
                    + Папка
                  </button>
                )}
              </div>

              {/* Create form */}
              {showForm && (
                <div className="pc-form-wrapper">
                  <form onSubmit={createTask} className="pc-form" style={{ background: 'rgba(20,20,20,0.95)', borderColor: t.cardBorderHover }}>
                    <div className="pc-form-header">
                      <span className="pc-form-label" style={{ color: t.textSub }}>Новое задание</span>
                      <button type="button" className="pc-form-close" style={{ color: t.textMuted }} onClick={() => { setShowForm(false); setFormError('') }}>✕</button>
                    </div>
                    <input className="pc-input pc-input-title" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }} placeholder="Название задания..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} autoFocus />
                    {formError && <div className="pc-form-error" style={{ background: `${t.danger}12`, borderColor: `${t.danger}33`, color:'#ff8899' }}>{formError}</div>}
                    <div className="pc-form-row">
                      <div className="pc-form-field"><label style={{ color: t.textSub }}>Дата</label><input type="date" className="pc-input" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, colorScheme:'dark' }} value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} /></div>
                      <div className="pc-form-field"><label style={{ color: t.textSub }}>Время</label><input type="time" className="pc-input" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text, colorScheme:'dark' }} value={formData.due_time} onChange={e => setFormData({...formData, due_time: e.target.value})} /></div>
                      <div className="pc-form-field"><label style={{ color: t.textSub }}>Приоритет</label>
                        <select className="pc-input pc-select" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }} value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                          <option value="high">Высокий (+50 XP)</option><option value="medium">Средний (+25 XP)</option><option value="low">Низкий (+10 XP)</option>
                        </select></div>
                      <div className="pc-form-field"><label style={{ color: t.textSub }}>Папка</label>
                        <select className="pc-input pc-select" style={{ background: t.inputBg, borderColor: t.cardBorder, color: t.text }} value={formData.folder_id} onChange={e => setFormData({...formData, folder_id: e.target.value})}>
                          <option value="">Без папки</option>{folders.map(f => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
                        </select></div>
                    </div>
                    <div className="pc-form-footer">
                      <button type="button" className="pc-btn-ghost" style={{ color: t.textSub, borderColor: t.cardBorder }} onClick={() => { setShowForm(false); setFormError('') }}>Отмена</button>
                      <button type="submit" className="pc-btn-primary" style={{ background: '#fff', color: '#000' }}>Создать задание</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Task list */}
              <div className="pc-task-list" ref={taskListRef}>
                {loading ? <LoadingState t={t} />
                : filteredTasks.length === 0 ? <EmptyState t={t} activeFolder={activeFolder} setShowForm={setShowForm} />
                : <>
                  {pendingTasks.map((task, i) => <TaskCard key={task.id} task={task} t={t} index={i} onToggle={() => toggleTask(task)} onDelete={() => setDeleteConfirm(task)} onEdit={() => openEditTask(task)} folders={folders} completed={false} />)}
                  {doneTasks.length > 0 && <>
                    <div className="pc-section-divider" style={{ color: t.textMuted }}><span /><span>Выполнено · {doneTasks.length}</span><span /></div>
                    {doneTasks.map((task, i) => <TaskCard key={task.id} task={task} t={t} index={i} onToggle={() => toggleTask(task)} onDelete={() => setDeleteConfirm(task)} onEdit={() => openEditTask(task)} folders={folders} completed={true} />)}
                  </>}
                </>}
              </div>
            </div>

            {/* ══ PAGE 1: HABITS ══════════════════════════════════════════ */}
            <div className="pc-page">
              <header className="pc-header">
                <div className="pc-header-left">
                  <span className="pc-header-folder-emoji">🔥</span>
                  <span className="pc-header-folder-name" style={{ color: t.text }}>Привычки</span>
                </div>
                <div className="pc-header-right">
                  <span style={{ fontSize: 12, color: t.textSub, fontFamily:'var(--font-mono)' }}>+10 XP за выполнение</span>
                </div>
              </header>
              <div style={{ flex:1, overflow:'auto' }}>
                <HabitTracker t={t} onHabitComplete={onHabitComplete} />
              </div>
            </div>

            {/* ══ PAGE 2: RANKS / CHARACTER ══════════════════════════════ */}
            <div className="pc-page">
              <header className="pc-header">
                <div className="pc-header-left">
                  <span className="pc-header-folder-emoji">⚔️</span>
                  <span className="pc-header-folder-name" style={{ color: t.text }}>Персонаж</span>
                </div>
                <div className="pc-header-right">
                  <span style={{ fontSize: 12, color: t.textSub, fontFamily:'var(--font-mono)' }}>{xp} XP</span>
                </div>
              </header>
              <div style={{ flex:1, overflow:'auto', padding: '16px 16px 100px' }}>
                <CharacterPanel xp={xp} completedCount={completedCount} theme={t} />

                {/* Rank progress list */}
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 11, color: t.textSub, letterSpacing:'0.12em', fontFamily:'var(--font-mono)', marginBottom: 14, paddingLeft: 2 }}>ТАБЛИЦА РАНГОВ</div>
                  {RANKS.map(r => {
                    const isCurrent = r.rank === rankInfo.rank
                    const isPast = xp >= r.max && r.max !== Infinity
                    return (
                      <div key={r.rank} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderRadius:14, border:`1px solid ${isCurrent ? r.color+'44' : t.cardBorder}`, background: isCurrent ? `${r.color}0a` : 'transparent', marginBottom:6, transition:'all 0.2s' }}>
                        <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color: isPast||isCurrent ? r.color : t.textMuted, minWidth:40, textShadow: isCurrent ? `0 0 20px ${r.glow}` : 'none' }}>{r.rank}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color: isCurrent ? t.text : t.textSub }}>{r.label}</div>
                          <div style={{ fontSize:11, color: t.textMuted, fontFamily:'var(--font-mono)', marginTop:2 }}>{r.min} – {r.max === Infinity ? '∞' : r.max} XP</div>
                        </div>
                        {isCurrent && <div style={{ fontSize:10, color: r.color, fontFamily:'var(--font-mono)', letterSpacing:'0.1em', background:`${r.color}18`, padding:'4px 10px', borderRadius:8, border:`1px solid ${r.color}33` }}>ТЕКУЩИЙ</div>}
                        {isPast && <div style={{ fontSize:14, color: r.color }}>✓</div>}
                      </div>
                    )
                  })}
                </div>

                {/* Stats */}
                <div style={{ marginTop: 20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { label:'Всего задач', value: totalCount },
                    { label:'Выполнено', value: completedCount },
                    { label:'Высокий приор.', value: completedByPriority.high },
                    { label:'XP заработано', value: xp },
                  ].map(s => (
                    <div key={s.label} style={{ background: t.card, border:`1px solid ${t.cardBorder}`, borderRadius:14, padding:'16px 16px', textAlign:'center' }}>
                      <div style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:800, color: t.text }}>{s.value}</div>
                      <div style={{ fontSize:11, color: t.textSub, marginTop:4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ══ PAGE 3: CALENDAR + ANALYTICS ══════════════════════════ */}
            <div className="pc-page">
              <header className="pc-header">
                <div className="pc-header-left">
                  <span className="pc-header-folder-emoji">📅</span>
                  <span className="pc-header-folder-name" style={{ color: t.text }}>Календарь</span>
                </div>
              </header>
              <div style={{ flex:1, overflowY:'auto' }}>
                <CalendarView tasks={tasks} theme={t} onClose={null} inline={true} />

                {/* Analytics section */}
                <div style={{ padding:'0 16px 100px' }}>
                  <div style={{ fontSize:11, color: t.textSub, letterSpacing:'0.12em', fontFamily:'var(--font-mono)', marginBottom:14, paddingLeft:2, marginTop:24 }}>АНАЛИТИКА</div>

                  {/* Progress bar by priority */}
                  <div style={{ background: t.card, border:`1px solid ${t.cardBorder}`, borderRadius:16, padding:'16px' }}>
                    <div style={{ fontSize:14, fontWeight:600, color: t.text, marginBottom:14 }}>Выполнено по приоритету</div>
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => {
                      const total = tasks.filter(tk => tk.priority === key).length
                      const done = tasks.filter(tk => tk.priority === key && tk.completed).length
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0
                      return (
                        <div key={key} style={{ marginBottom:12 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                            <span style={{ fontSize:13, color: t.text }}>{cfg.label}</span>
                            <span style={{ fontSize:12, color: t.textSub, fontFamily:'var(--font-mono)' }}>{done}/{total} ({pct}%)</span>
                          </div>
                          <div style={{ height:6, borderRadius:6, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background: cfg.color, borderRadius:6, transition:'width 0.6s ease' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ background: t.card, border:`1px solid ${t.cardBorder}`, borderRadius:16, padding:'16px', marginTop:10 }}>
                    <div style={{ fontSize:14, fontWeight:600, color: t.text, marginBottom:10 }}>Общая статистика</div>
                    {[
                      { label:'Задач создано', value: totalCount, icon:'📋' },
                      { label:'Задач выполнено', value: completedCount, icon:'✅' },
                      { label:'Папок создано', value: folders.length, icon:'📁' },
                      { label:'Опыт набрано', value: `${xp} XP`, icon:'⚡' },
                      { label:'Текущий ранг', value: `${rankInfo.rank} — ${rankInfo.label}`, icon:'🏅' },
                    ].map(s => (
                      <div key={s.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${t.cardBorder}` }}>
                        <span style={{ fontSize:13, color: t.textSub }}>{s.icon} {s.label}</span>
                        <span style={{ fontSize:13, fontWeight:600, color: t.text }}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </div>

            {/* ══ PAGE 4: PROFILE ══════════════════════════════════════════ */}
            <div className="pc-page">
              <header className="pc-header">
                <div className="pc-header-left">
                  <span className="pc-header-folder-emoji">👤</span>
                  <span className="pc-header-folder-name" style={{ color: t.text }}>Профиль</span>
                </div>
              </header>
              <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 100px',
                scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.15) transparent' }}>

                {/* ── Карточка пользователя ── */}
                <div style={{ background: t.card, border:`1px solid ${t.cardBorder}`, borderRadius:20,
                  padding:'24px 20px', marginBottom:16, textAlign:'center' }}>
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="avatar"
                      style={{ width:72, height:72, borderRadius:'50%',
                        border:`3px solid rgba(255,255,255,0.15)`, objectFit:'cover', marginBottom:12 }} />
                  ) : (
                    <div style={{ width:72, height:72, borderRadius:'50%', background: t.surface,
                      border:`3px solid rgba(255,255,255,0.15)`, display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:28, margin:'0 auto 12px' }}>👤</div>
                  )}
                  <div style={{ fontSize:18, fontWeight:700, color: t.text }}>
                    {session?.user?.name || 'Пользователь'}
                  </div>
                  <div style={{ fontSize:13, color: t.textSub, marginTop:4 }}>
                    {session?.user?.email}
                  </div>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:10,
                    background:'rgba(255,255,255,0.06)', borderRadius:20, padding:'6px 14px' }}>
                    <span style={{ fontSize:14, color: rankInfo.color }}>◆</span>
                    <span style={{ fontSize:12, color: rankInfo.color, fontFamily:'var(--font-mono)',
                      letterSpacing:'0.06em', fontWeight:600 }}>
                      {rankInfo.rank} · {rankInfo.label}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:16, marginTop:16, justifyContent:'center' }}>
                    {[
                      { label: 'XP', value: xp },
                      { label: 'Задач', value: completedCount },
                      { label: 'Папок', value: folders.length },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign:'center' }}>
                        <div style={{ fontSize:18, fontWeight:700, color: t.text }}>{s.value}</div>
                        <div style={{ fontSize:11, color: t.textMuted }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Уведомления ── */}
                <div style={{ fontSize:11, color: t.textSub, letterSpacing:'0.12em',
                  fontFamily:'var(--font-mono)', marginBottom:10, paddingLeft:4 }}>УВЕДОМЛЕНИЯ</div>
                <div style={{ background: t.card, border:`1px solid ${t.cardBorder}`,
                  borderRadius:16, overflow:'hidden', marginBottom:16 }}>
                  {[
                    { icon:'🔔', label:'Push-уведомления', sub:'Дедлайны и напоминания', toggle: true },
                    { icon:'✈️', label:'Telegram бот', sub:'@sannder01_Bot', action: () =>
                        window.open('https://t.me/sannder01_Bot','_blank') },
                  ].map((item, i, arr) => (
                    <div key={item.label} style={{ display:'flex', alignItems:'center', gap:12,
                      padding:'14px 16px',
                      borderBottom: i < arr.length-1 ? `1px solid ${t.cardBorder}` : 'none' }}>
                      <span style={{ fontSize:18, width:28, textAlign:'center' }}>{item.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:500, color: t.text }}>{item.label}</div>
                        <div style={{ fontSize:11, color: t.textSub, marginTop:2 }}>{item.sub}</div>
                      </div>
                      {item.toggle && (
                        <div style={{ width:44, height:26, borderRadius:13,
                          background:'rgba(255,255,255,0.1)', border:`1px solid rgba(255,255,255,0.15)`,
                          display:'flex', alignItems:'center', padding:3, cursor:'pointer' }}>
                          <div style={{ width:18, height:18, borderRadius:'50%',
                            background:'rgba(255,255,255,0.3)', transition:'transform .2s' }} />
                        </div>
                      )}
                      {item.action && (
                        <button onClick={item.action}
                          style={{ background:'rgba(255,255,255,0.07)', border:`1px solid rgba(255,255,255,0.1)`,
                            borderRadius:8, padding:'6px 12px', color: t.text, fontSize:12,
                            cursor:'pointer', fontFamily:'inherit' }}>
                          Открыть
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── Внешний вид ── */}
                <div style={{ fontSize:11, color: t.textSub, letterSpacing:'0.12em',
                  fontFamily:'var(--font-mono)', marginBottom:10, paddingLeft:4 }}>ВНЕШНИЙ ВИД</div>
                <div style={{ background: t.card, border:`1px solid ${t.cardBorder}`,
                  borderRadius:16, overflow:'hidden', marginBottom:16 }}>
                  {[
                    { icon:'🌙', label:'Тёмная тема', sub:'Активна', badge:'Активна', badgeColor: t.success },
                    { icon:'🎨', label:'Акцентный цвет', sub:'Монохромный', badge:'Белый' },
                    { icon:'✦', label:'Анимации', sub:'Частицы и эффекты', toggle: true, defaultOn: true },
                  ].map((item, i, arr) => (
                    <div key={item.label} style={{ display:'flex', alignItems:'center', gap:12,
                      padding:'14px 16px',
                      borderBottom: i < arr.length-1 ? `1px solid ${t.cardBorder}` : 'none' }}>
                      <span style={{ fontSize:18, width:28, textAlign:'center' }}>{item.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:500, color: t.text }}>{item.label}</div>
                        <div style={{ fontSize:11, color: t.textSub, marginTop:2 }}>{item.sub}</div>
                      </div>
                      {item.badge && (
                        <span style={{ fontSize:11, color: item.badgeColor || t.textMuted,
                          background:'rgba(255,255,255,0.06)', borderRadius:6, padding:'3px 8px',
                          fontFamily:'var(--font-mono)' }}>
                          {item.badge}
                        </span>
                      )}
                      {item.toggle && (
                        <div style={{ width:44, height:26, borderRadius:13,
                          background: item.defaultOn ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                          border:`1px solid rgba(255,255,255,0.15)`,
                          display:'flex', alignItems:'center', padding:3,
                          justifyContent: item.defaultOn ? 'flex-end' : 'flex-start', cursor:'pointer' }}>
                          <div style={{ width:18, height:18, borderRadius:'50%',
                            background: item.defaultOn ? '#fff' : 'rgba(255,255,255,0.3)' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── Аккаунт ── */}
                <div style={{ fontSize:11, color: t.textSub, letterSpacing:'0.12em',
                  fontFamily:'var(--font-mono)', marginBottom:10, paddingLeft:4 }}>АККАУНТ</div>
                <div style={{ background: t.card, border:`1px solid ${t.cardBorder}`,
                  borderRadius:16, overflow:'hidden', marginBottom:16 }}>
                  {[
                    { icon:'G', label:'Google', sub:'● Подключён', subColor: t.success },
                    { icon:'🍎', label:'Apple ID', sub:'Требует Apple Developer', badge:'Скоро' },
                  ].map((item, i, arr) => (
                    <div key={item.label} style={{ display:'flex', alignItems:'center', gap:12,
                      padding:'14px 16px',
                      borderBottom: i < arr.length-1 ? `1px solid ${t.cardBorder}` : 'none' }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:'rgba(255,255,255,0.1)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, fontWeight:700, color: t.text }}>
                        {item.icon}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:500, color: t.text }}>{item.label}</div>
                        <div style={{ fontSize:11, color: item.subColor || t.textSub, marginTop:2 }}>
                          {item.sub}
                        </div>
                      </div>
                      {item.badge && (
                        <span style={{ fontSize:11, color: t.textMuted,
                          background: t.surface, padding:'3px 8px', borderRadius:6,
                          fontFamily:'var(--font-mono)' }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── О приложении ── */}
                <div style={{ fontSize:11, color: t.textSub, letterSpacing:'0.12em',
                  fontFamily:'var(--font-mono)', marginBottom:10, paddingLeft:4 }}>О ПРИЛОЖЕНИИ</div>
                <div style={{ background: t.card, border:`1px solid ${t.cardBorder}`,
                  borderRadius:16, overflow:'hidden', marginBottom:16 }}>
                  {[
                    { icon:'📋', label:'Chronicle', sub:'v3.0 · Personal Intelligence System' },
                    { icon:'👤', label:'Автор', sub:'Sander Samarin' },
                    { icon:'⚡', label:'Движок', sub:'Next.js · PostgreSQL · NextAuth' },
                  ].map((item, i, arr) => (
                    <div key={item.label} style={{ display:'flex', alignItems:'center', gap:12,
                      padding:'12px 16px',
                      borderBottom: i < arr.length-1 ? `1px solid ${t.cardBorder}` : 'none' }}>
                      <span style={{ fontSize:16, width:28, textAlign:'center' }}>{item.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500, color: t.text }}>{item.label}</div>
                        <div style={{ fontSize:11, color: t.textSub, marginTop:1 }}>{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Выход ── */}
                <button type="button" onClick={handleSignOut}
                  style={{ width:'100%', background:'transparent',
                    border:`1px solid ${t.danger}44`, borderRadius:14,
                    padding:'14px', color: t.danger, fontWeight:600,
                    fontSize:14, cursor:'pointer' }}>
                  Выйти из аккаунта
                </button>

                <div style={{ textAlign:'center', marginTop:28, paddingBottom:8 }}>
                  <div style={{ fontSize:10, color:`${t.textMuted}66`,
                    fontFamily:'var(--font-mono)', letterSpacing:'0.1em' }}>
                    CHRONICLE · SANDER SAMARIN · {new Date().getFullYear()}
                  </div>
                </div>
              </div>
            </div>

            {/* ── СТРАНИЦА 6: ЗАМЕТКИ ── */}
            <div className="pc-page">
              <NotesPage t={t} />
            </div>

            {/* ── СТРАНИЦА 7: ДОСТИЖЕНИЯ ── */}
            <div className="pc-page">
              <AchievementsPage t={t} />
            </div>

          </div>
        </div>

        {/* ── BOTTOM NAV ── */}
        <nav className="pc-bottom-nav" style={{ background: t.navBg, borderTopColor: t.cardBorder }}>
          {PAGES.map(page => (
            <button type="button" key={page.id} className="pc-nav-btn" onClick={() => setActivePage(page.id)}
              style={{ color: activePage === page.id ? t.text : t.textSub }}>
              <span className="pc-nav-icon" style={{ opacity: activePage === page.id ? 1 : 0.5 }}>{page.icon}</span>
              <span className="pc-nav-label" style={{ fontWeight: activePage === page.id ? 600 : 400 }}>{page.label}</span>
              {activePage === page.id && <span className="pc-nav-dot" style={{ background: t.text }} />}
            </button>
          ))}
        </nav>
      </div>

      {/* Global footer watermark */}
      <div style={{ position:'fixed', bottom:72, right:12, fontSize:9, color:'rgba(255,255,255,0.08)', fontFamily:'var(--font-mono)', letterSpacing:'0.1em', pointerEvents:'none', zIndex:3, userSelect:'none' }}>
        CHRONICLE · SANDER SAMARIN
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  TASK CARD  — Bug 1 fixes: mobile overflow / text wrapping
// ═══════════════════════════════════════════════════════════════════
function TaskCard({ task, t, index, onToggle, onDelete, onEdit, folders, completed }) {
  const days = getDaysLeft(task.due_date)
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
  const folder = folders.find(f => String(f.id) === String(task.folder_id))
  const isUrgent = !completed && days !== null && days <= 1

  return (
    <div className="pc-task task-card"
      style={{ background: t.card, borderColor: isUrgent ? `${t.danger}33` : t.cardBorder, opacity: completed ? 0.7 : 1, boxShadow: isUrgent ? `0 0 24px ${t.danger}10` : 'none', animationDelay: `${index*0.04}s` }}
      onClick={onToggle}>
      {/* FIX Bug1: explicitly flex-shrink:0 on checkbox so it never squishes */}
      <div className="pc-checkbox"
        style={{ borderColor: completed ? t.success : priority.color, background: completed ? t.success : 'transparent', boxShadow: completed ? `0 0 10px ${t.success}44` : 'none', flexShrink: 0 }}>
        {completed && <CheckIcon />}
      </div>
      {/* FIX Bug1: min-width:0 to allow flex child to shrink and text to wrap */}
      <div className="pc-task-content" style={{ minWidth: 0 }}>
        {/* FIX Bug1: word-break + overflow-wrap for long titles without spaces */}
        <div className="pc-task-title" style={{ color: completed ? t.textSub : t.text, textDecoration: completed ? 'line-through' : 'none', textDecorationColor: 'rgba(255,255,255,0.25)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {task.title}
        </div>
        {/* FIX Bug1: meta row wraps; each badge has flex-shrink:0 */}
        <div className="pc-task-meta">
          <span className="pc-priority-badge" style={{ color: priority.color, background: `${priority.color}15`, borderColor: `${priority.color}28` }}>{priority.label}</span>
          {task.due_date && (
            <span className="pc-due-date" style={{ color: completed ? t.textMuted : getDaysColor(days, t) }}>
              {formatDate(task.due_date)}
              {task.due_time && <span style={{ opacity:0.75 }}> · {task.due_time.slice(0,5)}</span>}
              {!completed && getDaysLeftLabel(days) && <span className="pc-days-badge" style={{ color: getDaysColor(days,t), background: `${getDaysColor(days,t)}15`, borderColor: `${getDaysColor(days,t)}28` }}>{getDaysLeftLabel(days)}</span>}
            </span>
          )}
          {folder && <span className="pc-task-folder" style={{ color: folder.color||t.textMuted }}>{folder.emoji} {folder.name}</span>}
          {!completed && <span className="pc-xp-reward" style={{ color: t.textMuted }}>+{getXP(task.priority)} XP</span>}
        </div>
      </div>
      {/* FIX: type="button" + flex-shrink:0 on action buttons */}
      {!completed && <button type="button" className="pc-task-edit" style={{ color: t.textMuted, flexShrink: 0 }} onClick={e => { e.stopPropagation(); onEdit() }}>✎</button>}
      <button type="button" className="pc-task-delete" style={{ color: t.textMuted, flexShrink: 0 }} onClick={e => { e.stopPropagation(); onDelete() }}>✕</button>
    </div>
  )
}

// ─── States ───────────────────────────────────────────────────────
function LoadingState({ t }) {
  return (
    <div className="pc-loading-list">
      {[1,2,3,4].map(i => (
        <div key={i} className="pc-skeleton" style={{ background: `linear-gradient(90deg, ${t.card} 0%, ${t.surface} 50%, ${t.card} 100%)`, animationDelay: `${i*0.1}s` }} />
      ))}
    </div>
  )
}
function EmptyState({ t, activeFolder, setShowForm }) {
  const msgs = {
    urgent: { icon:'◉', title:'Срочных нет',  sub:'Ничего не горит' },
    today:  { icon:'◎', title:'День свободен', sub:'Нет задач с дедлайном сегодня' },
    all:    { icon:'◈', title:'Пока пусто',    sub:'Создай первое задание' },
  }
  const m = msgs[activeFolder] || msgs.all
  return (
    <div className="pc-empty">
      <div className="pc-empty-icon" style={{ color: t.text, opacity:0.2 }}><span style={{ fontSize:48 }}>{m.icon}</span></div>
      <div className="pc-empty-title" style={{ color: t.text }}>{m.title}</div>
      <div className="pc-empty-sub" style={{ color: t.textSub }}>{m.sub}</div>
      {activeFolder === 'all' && (
        <button type="button" className="pc-btn-primary pc-empty-cta" style={{ background: '#fff', color: '#000' }} onClick={() => setShowForm(true)}>
          + Первое задание
        </button>
      )}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────
function CheckIcon() { return <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function DeleteIcon({ color }) { return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 8h16M10 8V6h8v2M11 12v7M17 12v7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><rect x="7" y="8" width="14" height="14" rx="3" stroke={color} strokeWidth="1.5"/></svg> }
