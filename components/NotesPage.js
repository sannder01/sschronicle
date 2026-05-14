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

export default function NotesPage({ t }) {
  const [view, setView] = useState('folders')   // 'folders' | 'notesList' | 'editor'
  const [folders, setFolders] = useState([])
  const [notes, setNotes] = useState([])
  const [activeFolder, setActiveFolder] = useState(null)
  const [activeNote, setActiveNote] = useState(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
        fetch('/api/folders?type=note'),
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

  // ─── Create Folder ──────────────────────────────────
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

  // ─── Create Note ────────────────────────────────────
  const createNote = async () => {
    if (!activeFolder) return
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: activeFolder.id, title: '', content: '' }),
      })
      if (!res.ok) { console.error('Note create failed:', res.status); return }
      const note = await res.json()
      setNotes(prev => [note, ...prev])
      setActiveNote(note)
      setNoteTitle('')
      setNoteContent('')
      setView('editor')
      setTimeout(() => textareaRef.current?.focus(), 120)
    } catch (err) {
      console.error('[NotesPage] createNote:', err)
    }
  }

  // ─── Auto-save (debounced 800ms) ─────────────────────
  const autoSave = useCallback((title, content) => {
    if (!activeNote) return
    clearTimeout(saveTimerRef.current)
    setSaving(true)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/notes/${activeNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content }),
        })
        setNotes(prev =>
          prev.map(n =>
            n.id === activeNote.id
              ? { ...n, title, content, updated_at: new Date().toISOString() }
              : n
          )
        )
      } catch (err) {
        console.error('[NotesPage] autoSave:', err)
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [activeNote])

  const handleTitleChange = (val) => {
    setNoteTitle(val)
    autoSave(val, noteContent)
  }
  const handleContentChange = (val) => {
    setNoteContent(val)
    autoSave(noteTitle, val)
  }

  // ─── Delete Note ────────────────────────────────────
  const deleteNote = async (id) => {
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      setNotes(prev => prev.filter(n => n.id !== id))
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
    if (diffDays === 1) return 'Вчера'
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
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Загрузка...</span>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════
  //  FOLDERS VIEW
  // ════════════════════════════════════════
  if (view === 'folders') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' }}>
              Заметки
            </h1>
            <button
              onClick={() => setShowFolderModal(true)}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: 'none', cursor: 'pointer',
                color: '#fff', fontSize: 20, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >+</button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            {folders.length} папок · {notes.length} заметок
          </p>
        </div>

        {/* Folders list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {folders.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '60%', gap: 12,
            }}>
              <div style={{ fontSize: 48, opacity: 0.25 }}>📁</div>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, textAlign: 'center' }}>
                Нет папок.<br/>Нажми + чтобы создать.
              </p>
            </div>
          ) : (
            folders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                count={folderNoteCount(folder.id)}
                onClick={() => { setActiveFolder(folder); setView('notesList') }}
              />
            ))
          )}
        </div>

        {/* Folder modal */}
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
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <button
            onClick={() => setView('folders')}
            style={navBtnStyle}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{activeFolder?.icon || activeFolder?.emoji || '📁'}</span>
              <span style={{ color: '#fff', fontSize: 17, fontWeight: 600 }}>
                {activeFolder?.name}
              </span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 1 }}>
              {folderNotes.length} заметок
            </p>
          </div>
          <button
            onClick={createNote}
            style={{
              ...navBtnStyle,
              background: activeFolder?.color ? `${activeFolder.color}22` : 'rgba(139,92,246,0.15)',
              color: activeFolder?.color || '#8B5CF6',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>

        {/* Notes */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {folderNotes.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '60%', gap: 12,
            }}>
              <div style={{ fontSize: 40, opacity: 0.2 }}>📝</div>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, textAlign: 'center' }}>
                Нет заметок.<br/>Нажми + чтобы создать.
              </p>
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
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <button onClick={() => setView('notesList')} style={navBtnStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {saving && (
            <span style={{
              color: 'rgba(255,255,255,0.2)', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'rgba(255,255,255,0.25)',
                display: 'inline-block',
                animation: 'pulse 1s ease-in-out infinite',
              }}/>
              <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
              сохраняется
            </span>
          )}
          <button
            onClick={() => deleteNote(activeNote?.id)}
            style={{ ...navBtnStyle, color: '#ff4466' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Title input */}
      <input
        value={noteTitle}
        placeholder="Заголовок"
        onChange={e => handleTitleChange(e.target.value)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          outline: 'none',
          color: '#fff',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.3px',
          padding: '20px 20px 8px',
          fontFamily: 'inherit',
        }}
      />

      {/* Date */}
      <div style={{
        padding: '0 20px 12px',
        color: 'rgba(255,255,255,0.25)',
        fontSize: 12,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {formatDate(activeNote?.updated_at)} · {activeFolder?.name}
      </div>

      {/* Content textarea */}
      <textarea
        ref={textareaRef}
        value={noteContent}
        placeholder="Начни писать..."
        onChange={e => handleContentChange(e.target.value)}
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          outline: 'none',
          resize: 'none',
          color: 'rgba(255,255,255,0.85)',
          fontSize: 15,
          lineHeight: 1.75,
          padding: '16px 20px 20px',
          fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────

function FolderRow({ folder, count, onClick }) {
  const [hovered, setHovered] = useState(false)
  const color = folder.color || '#8B5CF6'
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 20px',
        cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.15s',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
      }}
    >
      {/* Icon blob */}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
        border: `1px solid ${color}33`,
      }}>
        {folder.icon || folder.emoji || '📁'}
      </div>

      {/* Name + count */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: '#fff', fontSize: 15, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{folder.name}</div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 }}>
          {count} заметок
        </div>
      </div>

      {/* Chevron */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  )
}

function NoteRow({ note, formatDate, accentColor, onClick }) {
  const [hovered, setHovered] = useState(false)
  const preview = (note.content || '').replace(/\n/g, ' ').slice(0, 80)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '14px 20px',
        cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.15s',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{
          color: '#fff', fontSize: 15, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {note.title || 'Без названия'}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, flexShrink: 0, marginTop: 1 }}>
          {formatDate(note.updated_at)}
        </div>
      </div>
      {preview && (
        <div style={{
          color: 'rgba(255,255,255,0.35)', fontSize: 13,
          marginTop: 4, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {preview}
        </div>
      )}
    </div>
  )
}

function FolderModal({ name, setName, icon, setIcon, color, setColor, onCreate, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-end',
        zIndex: 9999,
        backdropFilter: 'blur(8px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%',
        background: '#1c1c1e',
        borderRadius: '20px 20px 0 0',
        padding: '8px 0 24px',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.12)',
          margin: '8px auto 20px',
        }} />

        <div style={{ padding: '0 20px' }}>
          <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>
            Новая папка
          </h3>

          {/* Icon preview + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: `${color}22`, border: `1px solid ${color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26,
            }}>{icon}</div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onCreate()}
              placeholder="Название папки"
              autoFocus
              style={{
                flex: 1, padding: '12px 14px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, outline: 'none',
                color: '#fff', fontSize: 15,
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Icon picker */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {ICON_OPTIONS.map(ic => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                style={{
                  width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 20,
                  background: icon === ic ? `${color}33` : 'rgba(255,255,255,0.06)',
                  outline: icon === ic ? `2px solid ${color}` : 'none',
                  transition: 'all 0.15s',
                }}
              >{ic}</button>
            ))}
          </div>

          {/* Color picker */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {COLOR_OPTIONS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: c, border: 'none', cursor: 'pointer',
                  outline: color === c ? `2px solid #fff` : '2px solid transparent',
                  outlineOffset: 2,
                  transition: 'outline 0.1s',
                }}
              />
            ))}
          </div>

          <button
            onClick={onCreate}
            disabled={!name.trim()}
            style={{
              width: '100%', padding: 14,
              borderRadius: 14, border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed',
              background: name.trim() ? color : 'rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 16, fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'background 0.2s, transform 0.1s',
              opacity: name.trim() ? 1 : 0.5,
            }}
            onMouseDown={e => { if (name.trim()) e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared button style ─────────────────────────────
const navBtnStyle = {
  width: 36, height: 36, borderRadius: 10,
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
  transition: 'background 0.15s',
}
