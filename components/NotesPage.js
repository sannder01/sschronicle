'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/* ═══════════════════════════════════════════════════════
   NotesPage — Apple Notes aesthetic, dark site theme
   ═══════════════════════════════════════════════════════ */

const ICON_OPTIONS = ['📁', '📒', '📔', '📓', '🗒️', '⭐', '💡', '🎯', '🔖', '🌙']
const COLOR_OPTIONS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
]

export default function NotesPage({ t, lang = 'ru', i18n = {} }) {
  const [view, setView] = useState('folders')   // 'folders' | 'notesList' | 'editor'
  const [folders, setFolders] = useState([])
  const [notes, setNotes] = useState([])
  const [activeFolder, setActiveFolder] = useState(null)
  const [activeNote, setActiveNote] = useState(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState(null) // Состояние для модалки удаления

  // Folder modal state
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderIcon, setNewFolderIcon] = useState('📁')
  const [newFolderColor, setNewFolderColor] = useState('#8B5CF6')

  const textareaRef = useRef(null)
  const saveTimerRef = useRef(null)

  // ─── Load ───────────────────────────────────────────
  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [fRes, nRes] = await Promise.all([
        fetch('/api/folders?type=note'), // Исправлено: фильтр по типу
        fetch('/api/notes'),
      ])
      const [fData, nData] = await Promise.all([fRes.json(), nRes.json()])
      setFolders(Array.isArray(fData) ? fData : [])
      setNotes(Array.isArray(nData) ? nData : [])
    } catch (err) {
      console.error('[NotesPage] loadData:', err)
      setFolders([])
      setNotes([])
    } finally {
      setLoading(false)
    }
  }
 
  // ─── Folders Logic ──────────────────────────────────
  const createFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          icon: newFolderIcon,
          color: newFolderColor,
          entityType: 'note', // Исправлено: передаем тип
        }),
      })
      if (!res.ok) { console.error('Folder create failed:', res.status); return }
      const created = await res.json()
      setFolders(prev => [...prev, created])
      setNewFolderName('')
      setNewFolderIcon('📁')
      setNewFolderColor('#8B5CF6')
      setShowFolderModal(false)
    } catch (err) {
      console.error('[NotesPage] createFolder:', err)
    }
  }

  const deleteFolder = async (id) => {
    try {
      await fetch(`/api/folders/${id}`, { method: 'DELETE' })
      setFolders(prev => prev.filter(f => f.id !== id))
      setDeletingFolder(null)
    } catch (err) {
      console.error('[NotesPage] deleteFolder:', err)
    }
  }

  // ─── Notes Logic ────────────────────────────────────
  const createNote = async () => {
     if (!activeFolder) return
   
     try {
       console.log('ACTIVE FOLDER:', activeFolder)
   
       const res = await fetch('/api/notes', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           folderId: activeFolder.id,
           title: '',
           content: '',
         }),
       })
   
       if (!res.ok) {
         const err = await res.text()
         console.error('Note create failed:', err)
         return
       }
   
       const note = await res.json()
   
       setNotes(prev => [note, ...prev])
       setActiveNote(note)
       setNoteTitle('')
       setNoteContent('')
       setView('editor')
   
       setTimeout(() => {
         textareaRef.current?.focus()
       }, 120)
   
     } catch (err) {
       console.error('[NotesPage] createNote:', err)
     }
   }

  // ─── Save / Edit / Delete Notes ─────────────────────
  const saveNote = async (id, title, content) => {
    if (!id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      if (res.ok) {
        const updated = await res.json()
        setNotes(prev => prev.map(n => n.id === id ? updated : n))
      }
    } catch (err) {
      console.error('[NotesPage] saveNote:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleTitleChange = (val) => {
    setNoteTitle(val)
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveNote(activeNote?.id, val, noteContent), 800)
  }

  const handleContentChange = (val) => {
    setNoteContent(val)
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveNote(activeNote?.id, noteTitle, val), 800)
  }

  const deleteNote = async (id) => {
    if (!id) return
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      setNotes(prev => prev.filter(n => n.id !== id))
      setActiveNote(null)
      setNoteTitle('')
      setNoteContent('')
      setView('notesList')
    } catch (err) {
      console.error('[NotesPage] deleteNote:', err)
    }
  }

  // ─── Helpers ────────────────────────────────────────
  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now - d) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return i18n.common?.yesterday || 'Вчера'
    if (diffDays < 7) return d.toLocaleDateString('ru-RU', { weekday: 'short' })
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const folderNoteCount = (folderId) => notes.filter(n => n.folder_id === folderId).length

  // ─── Loading ────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.08)',
            borderTopColor: 'rgba(255,255,255,0.5)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>{i18n.common?.loading || 'Загрузка...'}</span>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════
  //  FOLDERS VIEW
  // ════════════════════════════════════════
  if (view === 'folders') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg, position: 'relative' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' }}>{i18n.notes?.title || 'Заметки'}</h1>
            <button
              onClick={() => setShowFolderModal(true)}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: 'none', cursor: 'pointer',
                color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >+</button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            {folders.length} {lang === 'en' ? 'folders' : 'папок'} · {notes.length} {lang === 'en' ? 'notes' : 'заметок'}
          </p>
        </div>

        {/* Folders list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {folders.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12 }}>
              <div style={{ fontSize: 48, opacity: 0.25 }}>📁</div>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, textAlign: 'center' }}>{lang === 'en' ? <>No folders.<br/>Tap + to create.</> : <>Нет папок.<br/>Нажми + чтобы создать.</>}</p>
            </div>
          ) : (
            folders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                count={folderNoteCount(folder.id)}
                onClick={() => { setActiveFolder(folder); setView('notesList') }}
                onDelete={() => setDeletingFolder(folder)} // Передаем функцию удаления
              />
            ))
          )}
        </div>

        {/* Modal: Create Folder */}
        {showFolderModal && (
          <FolderModal
            name={newFolderName}
            setName={setNewFolderName}
            icon={newFolderIcon}
            setIcon={setNewFolderIcon}
            color={newFolderColor}
            setColor={setNewFolderColor}
            onCreate={createFolder}
            onClose={() => setShowFolderModal(false)}
          />
        )}

        {/* Modal: Confirm Delete */}
        {deletingFolder && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 60, padding: '0 24px', backdropFilter: 'blur(4px)'
          }}>
            <div style={{ background: '#1c1c1e', borderRadius: 16, padding: '24px 20px', width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
              <p style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Удалить папку «{deletingFolder.name}»?
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>
                Заметки останутся, но потеряют папку.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeletingFolder(null)}
                  style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
                  {i18n.common?.cancel || 'Отмена'}
                </button>
                <button onClick={() => deleteFolder(deletingFolder.id)}
                  style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#ff3b30', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {i18n.common?.delete || 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════
  //  NOTES LIST VIEW
  // ════════════════════════════════════════
  if (view === 'notesList') {
    const folderNotes = notes.filter(n => n.folder_id === activeFolder?.id)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => setView('folders')} style={navBtnStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{activeFolder?.icon || activeFolder?.emoji || '📁'}</span>
              <span style={{ color: '#fff', fontSize: 17, fontWeight: 600 }}>{activeFolder?.name}</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{folderNotes.length} заметок</p>
          </div>
          <button onClick={createNote} style={{ ...navBtnStyle, background: activeFolder?.color ? `${activeFolder.color}22` : 'rgba(139,92,246,0.15)', color: activeFolder?.color || '#8B5CF6' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {folderNotes.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12 }}>
              <div style={{ fontSize: 40, opacity: 0.2 }}>📝</div>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, textAlign: 'center' }}>Нет заметок.<br/>Нажми + чтобы создать.</p>
            </div>
          ) : (
            folderNotes.map(note => (
              <NoteRow
                key={note.id}
                note={note}
                formatDate={formatDate}
                accentColor={activeFolder?.color}
                onClick={() => {
                  setActiveNote(note)
                  setNoteTitle(note.title || '')
                  setNoteContent(note.content || '')
                  setView('editor')
                }}
              />
            ))
          )}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════
  //  EDITOR VIEW
  // ════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => setView('notesList')} style={navBtnStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {saving && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>сохраняется</span>}
          <button onClick={() => deleteNote(activeNote?.id)} style={{ ...navBtnStyle, color: '#ff4466' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <input value={noteTitle} placeholder={i18n.notes?.noteName || "Заголовок"} onChange={e => handleTitleChange(e.target.value)}
        style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 22, fontWeight: 700, padding: '20px 20px 8px' }}
      />
      <div style={{ padding: '0 20px 12px', color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
        {formatDate(activeNote?.updated_at)} · {activeFolder?.name}
      </div>
      <textarea ref={textareaRef} value={noteContent} placeholder="Начни писать..." onChange={e => handleContentChange(e.target.value)}
        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 1.75, padding: '16px 20px' }}
      />
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────

function FolderRow({ folder, count, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const color = folder.color || '#8B5CF6'
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: `1px solid ${color}33` }}>
        {folder.icon || folder.emoji || '📁'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>{folder.name}</div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{count} заметок</div>
      </div>
      
      {/* Кнопка удаления появляется при наведении */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'rgba(255,60,50,0.15)', color: '#ff3b30',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  )
}

function NoteRow({ note, formatDate, accentColor, onClick }) {
  const [hovered, setHovered] = useState(false)
  const preview = (note.content || '').replace(/\n/g, ' ').slice(0, 80)
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ padding: '14px 20px', cursor: 'pointer', background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {note.title || i18n.common?.noTitle || 'Без названия'}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>{formatDate(note.updated_at)}</div>
      </div>
      {preview && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>}
    </div>
  )
}

function FolderModal({ name, setName, icon, setIcon, color, setColor, onCreate, onClose }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-end', zIndex: 50, backdropFilter: 'blur(8px)'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', background: '#1c1c1e', borderRadius: '20px 20px 0 0', padding: '8px 0 24px' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', margin: '8px auto 20px' }} />
        <div style={{ padding: '0 20px' }}>
          <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>Новая папка</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}22`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{icon}</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Название папки" autoFocus
              style={{ flex: 1, padding: '12px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, outline: 'none', color: '#fff' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {ICON_OPTIONS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: icon === ic ? `${color}33` : 'rgba(255,255,255,0.06)', outline: icon === ic ? `2px solid ${color}` : 'none', fontSize: 20 }}>{ic}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {COLOR_OPTIONS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', outline: color === c ? `2px solid #fff` : 'none', outlineOffset: 2 }} />
            ))}
          </div>
          <button onClick={onCreate} disabled={!name.trim()}
            style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: name.trim() ? color : 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 16, fontWeight: 600, opacity: name.trim() ? 1 : 0.5 }}>
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}

const navBtnStyle = {
  width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center'
}
