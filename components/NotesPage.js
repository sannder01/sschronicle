'use client'
import { useState, useEffect, useRef } from 'react'

export default function NotesPage({ t }) {
  const [view, setView] = useState('folders')      // 'folders' | 'notesList' | 'editor'
  const [folders, setFolders] = useState([])
  const [notes, setNotes] = useState([])
  const [activeFolder, setActiveFolder] = useState(null)
  const [activeNote, setActiveNote] = useState(null)
  const [noteContent, setNoteContent] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [loading, setLoading] = useState(true)
  const textareaRef = useRef(null)

  useEffect(() => {
    const savedFolders = localStorage.getItem('notes_folders')
    const savedNotes = localStorage.getItem('notes_data')
    if (savedFolders) setFolders(JSON.parse(savedFolders))
    else setFolders([
      { id: 'general', name: 'Заметки', icon: '📝', count: 0 },
      { id: 'ideas', name: 'Идеи', icon: '💡', count: 0 },
    ])
    if (savedNotes) setNotes(JSON.parse(savedNotes))
    setLoading(false)
  }, [])

  const save = (newFolders, newNotes) => {
    localStorage.setItem('notes_folders', JSON.stringify(newFolders ?? folders))
    localStorage.setItem('notes_data', JSON.stringify(newNotes ?? notes))
  }

  const createNote = () => {
    const note = {
      id: Date.now().toString(),
      folderId: activeFolder.id,
      title: '',
      content: '',
      updatedAt: new Date().toISOString(),
    }
    const newNotes = [note, ...notes]
    setNotes(newNotes)
    save(null, newNotes)
    setActiveNote(note)
    setNoteTitle('')
    setNoteContent('')
    setView('editor')
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const updateNote = (title, content) => {
    const updatedNotes = notes.map(n =>
      n.id === activeNote.id
        ? { ...n, title, content, updatedAt: new Date().toISOString() }
        : n
    )
    setNotes(updatedNotes)
    save(null, updatedNotes)
    setActiveNote(prev => ({ ...prev, title, content }))
  }

  const deleteNote = (noteId) => {
    const newNotes = notes.filter(n => n.id !== noteId)
    setNotes(newNotes)
    save(null, newNotes)
    setView('notesList')
  }

  const createFolder = () => {
    if (!newFolderName.trim()) return
    const folder = { id: Date.now().toString(), name: newFolderName.trim(), icon: '📁', count: 0 }
    const newFolders = [...folders, folder]
    setFolders(newFolders)
    save(newFolders, null)
    setNewFolderName('')
    setShowFolderModal(false)
  }

  const folderNotes = activeFolder ? notes.filter(n => n.folderId === activeFolder.id) : []

  const formatNoteDate = (iso) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'Только что'
    if (diff < 3600000) return `${Math.floor(diff/60000)} мин`
    if (diff < 86400000) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const s = {
    wrapper: { display:'flex', flexDirection:'column', height:'100%', background: t.bg },
    header: {
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'16px 20px 8px', borderBottom:`1px solid ${t.cardBorder}`, flexShrink:0
    },
    backBtn: {
      background:'none', border:'none', color:'rgba(255,255,255,0.5)',
      fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:4,
      padding:'6px 0', fontFamily:'inherit'
    },
    title: { fontSize:17, fontWeight:700, color:t.text },
    addBtn: {
      background:'none', border:'none', color:t.text,
      fontSize:22, cursor:'pointer', padding:'4px 8px', lineHeight:1
    },
    listScroll: {
      flex:1, overflowY:'auto', padding:'8px 0',
      scrollbarWidth:'thin', scrollbarColor:`rgba(255,255,255,0.15) transparent`
    },
    folderRow: {
      display:'flex', alignItems:'center', gap:14,
      padding:'14px 20px', cursor:'pointer', transition:'background .15s',
      borderBottom:`1px solid rgba(255,255,255,0.04)`
    },
    folderIcon: {
      width:40, height:40, borderRadius:10, background:'rgba(255,204,0,0.15)',
      display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0
    },
    folderInfo: { flex:1, minWidth:0 },
    folderName: { fontSize:15, fontWeight:500, color:t.text },
    folderCount: { fontSize:12, color:t.textMuted, marginTop:2 },
    folderChevron: { color:'rgba(255,255,255,0.2)', fontSize:14 },
    noteRow: {
      padding:'14px 20px', cursor:'pointer',
      borderBottom:`1px solid rgba(255,255,255,0.05)`, transition:'background .15s'
    },
    noteRowTitle: { fontSize:15, fontWeight:600, color:t.text, marginBottom:3,
      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
    noteRowMeta: { display:'flex', gap:8, alignItems:'center' },
    noteRowDate: { fontSize:12, color:t.textMuted },
    noteRowPreview: { fontSize:12, color:'rgba(255,255,255,0.35)',
      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 },
    editorHeader: {
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'16px 20px 12px', borderBottom:`1px solid ${t.cardBorder}`, flexShrink:0
    },
    editorActions: { display:'flex', gap:8, alignItems:'center' },
    deleteBtn: {
      background:'none', border:'none', color:'rgba(255,68,102,0.7)',
      fontSize:16, cursor:'pointer', padding:'6px 8px'
    },
    titleInput: {
      width:'100%', background:'none', border:'none', outline:'none',
      color:t.text, fontSize:20, fontWeight:700, padding:'16px 20px 8px',
      fontFamily:'inherit', flexShrink:0, boxSizing:'border-box'
    },
    textarea: {
      flex:1, width:'100%', background:'none', border:'none', outline:'none',
      color:'rgba(255,255,255,0.85)', fontSize:15, lineHeight:1.7,
      padding:'8px 20px 120px', fontFamily:'inherit', resize:'none',
      overflowY:'auto', scrollbarWidth:'thin',
      scrollbarColor:`rgba(255,255,255,0.15) transparent`,
      boxSizing:'border-box'
    },
    emptyState: {
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      flex:1, gap:12, color:t.textMuted
    },
    emptyIcon: { fontSize:48, opacity:0.3 },
    emptyText: { fontSize:14 },
    modal: {
      position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
      display:'flex', alignItems:'flex-end', justifyContent:'center',
      zIndex:9999, padding:'0 0 40px'
    },
    modalBox: {
      background:'#1c1c1e', borderRadius:16, padding:24,
      width:'calc(100% - 40px)', maxWidth:380
    },
    modalTitle: { fontSize:17, fontWeight:700, color:t.text, marginBottom:16 },
    modalInput: {
      width:'100%', background:'rgba(255,255,255,0.07)', border:`1px solid rgba(255,255,255,0.1)`,
      borderRadius:10, padding:'12px 14px', color:t.text, fontSize:15,
      fontFamily:'inherit', outline:'none', boxSizing:'border-box', marginBottom:16
    },
    modalBtns: { display:'flex', gap:10 },
    modalBtn: (primary) => ({
      flex:1, padding:'12px', borderRadius:10, border:'none', cursor:'pointer',
      fontSize:15, fontWeight:600, fontFamily:'inherit',
      background: primary ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.08)',
      color: primary ? '#000' : t.text
    })
  }

  // ── RENDER: ПАПКИ ──
  if (view === 'folders') return (
    <div style={s.wrapper}>
      <div style={s.header}>
        <span style={s.title}>Заметки</span>
        <button style={s.addBtn} onClick={() => setShowFolderModal(true)}>⊕</button>
      </div>

      <div style={s.listScroll}>
        <div style={{ padding:'16px 20px 8px' }}>
          <span style={{ fontSize:11, fontWeight:700, color:t.textMuted, textTransform:'uppercase', letterSpacing:1 }}>Папки</span>
        </div>

        {folders.map(folder => {
          const count = notes.filter(n => n.folderId === folder.id).length
          return (
            <div key={folder.id} style={s.folderRow}
              onClick={() => { setActiveFolder(folder); setView('notesList') }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={s.folderIcon}>{folder.icon}</div>
              <div style={s.folderInfo}>
                <div style={s.folderName}>{folder.name}</div>
                <div style={s.folderCount}>{count} {count === 1 ? 'заметка' : count < 5 ? 'заметки' : 'заметок'}</div>
              </div>
              <span style={s.folderChevron}>›</span>
            </div>
          )
        })}

        {folders.length === 0 && (
          <div style={{ ...s.emptyState, minHeight:200 }}>
            <span style={s.emptyIcon}>📁</span>
            <span style={s.emptyText}>Создай первую папку</span>
          </div>
        )}
      </div>

      {showFolderModal && (
        <div style={s.modal} onClick={() => setShowFolderModal(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Новая папка</div>
            <input style={s.modalInput} placeholder="Название папки"
              value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()} autoFocus />
            <div style={s.modalBtns}>
              <button style={s.modalBtn(false)} onClick={() => setShowFolderModal(false)}>Отмена</button>
              <button style={s.modalBtn(true)} onClick={createFolder}>Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── RENDER: СПИСОК ЗАМЕТОК ──
  if (view === 'notesList') return (
    <div style={s.wrapper}>
      <div style={s.editorHeader}>
        <button style={s.backBtn} onClick={() => setView('folders')}>‹ Папки</button>
        <span style={{ fontSize:15, fontWeight:700, color:t.text }}>{activeFolder?.name}</span>
        <button style={s.addBtn} onClick={createNote}>⊕</button>
      </div>

      {folderNotes.length === 0 ? (
        <div style={s.emptyState}>
          <span style={s.emptyIcon}>📝</span>
          <span style={s.emptyText}>Нет заметок</span>
          <button onClick={createNote} style={{
            marginTop:8, background:'rgba(255,255,255,0.07)', border:`1px solid rgba(255,255,255,0.1)`,
            borderRadius:10, padding:'10px 20px', color:t.text, fontSize:14, cursor:'pointer',
            fontFamily:'inherit'
          }}>Создать заметку</button>
        </div>
      ) : (
        <div style={s.listScroll}>
          {folderNotes.map(note => (
            <div key={note.id} style={s.noteRow}
              onClick={() => {
                setActiveNote(note)
                setNoteTitle(note.title)
                setNoteContent(note.content)
                setView('editor')
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={s.noteRowTitle}>{note.title || 'Без названия'}</div>
              <div style={s.noteRowMeta}>
                <span style={s.noteRowDate}>{formatNoteDate(note.updatedAt)}</span>
                <span style={s.noteRowPreview}>{note.content?.slice(0, 60) || 'Нет текста'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── RENDER: РЕДАКТОР ──
  return (
    <div style={s.wrapper}>
      <div style={s.editorHeader}>
        <button style={s.backBtn} onClick={() => {
          updateNote(noteTitle, noteContent)
          setView('notesList')
        }}>‹ Назад</button>
        <div style={s.editorActions}>
          <button style={s.deleteBtn} onClick={() => deleteNote(activeNote.id)}>🗑</button>
        </div>
      </div>

      <input style={s.titleInput} placeholder="Заголовок"
        value={noteTitle}
        onChange={e => { setNoteTitle(e.target.value); updateNote(e.target.value, noteContent) }} />

      <textarea ref={textareaRef} style={s.textarea}
        placeholder="Начни писать..."
        value={noteContent}
        onChange={e => { setNoteContent(e.target.value); updateNote(noteTitle, e.target.value) }} />
    </div>
  )
}
