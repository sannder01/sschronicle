'use client'

import { useState, useEffect, useRef } from 'react'

export default function NotesPage({ t }) {
  const [view, setView] = useState('folders')
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

  // =========================
  // LOAD DATA FROM DATABASE
  // =========================

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const foldersRes = await fetch('/api/folders')
      const foldersData = await foldersRes.json()

      const notesRes = await fetch('/api/notes')
      const notesData = await notesRes.json()

      setFolders(foldersData)
      setNotes(notesData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // CREATE NOTE
  // =========================

  const createNote = async () => {
    const note = {
      id: Date.now().toString(),
      folderId: activeFolder.id,
      title: '',
      content: '',
      updatedAt: new Date().toISOString(),
    }

    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(note),
      })

      setNotes([note, ...notes])

      setActiveNote(note)
      setNoteTitle('')
      setNoteContent('')
      setView('editor')

      setTimeout(() => textareaRef.current?.focus(), 100)
    } catch (err) {
      console.error(err)
    }
  }

  // =========================
  // UPDATE NOTE
  // =========================

  const updateNote = async (title, content) => {
    if (!activeNote) return

    const updatedNotes = notes.map((n) =>
      n.id === activeNote.id
        ? {
            ...n,
            title,
            content,
            updatedAt: new Date().toISOString(),
          }
        : n
    )

    setNotes(updatedNotes)

    setActiveNote((prev) => ({
      ...prev,
      title,
      content,
    }))

    try {
      await fetch(`/api/notes/${activeNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
        }),
      })
    } catch (err) {
      console.error(err)
    }
  }

  // =========================
  // DELETE NOTE
  // =========================

  const deleteNote = async (noteId) => {
    try {
      await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      })

      const newNotes = notes.filter((n) => n.id !== noteId)

      setNotes(newNotes)

      setView('notesList')
    } catch (err) {
      console.error(err)
    }
  }

  // =========================
  // CREATE FOLDER
  // =========================
  const createFolder = async () => {
    if (!newFolderName.trim()) return
  
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          emoji: '📁',
          color: '#8B5CF6',
        }),
      })
  
      const createdFolder = await res.json()
  
      setFolders([...folders, createdFolder])
  
      setNewFolderName('')
      setShowFolderModal(false)
    } catch (err) {
      console.error(err)
    }
  }
 

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        Загрузка...
      </div>
    )
  }

  // =========================
  // UI STYLES
  // =========================

  const s = {
    wrapper: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: t.bg,
    },

    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
    },

    title: {
      color: t.text,
      fontSize: 18,
      fontWeight: 700,
    },

    addBtn: {
      background: 'none',
      border: 'none',
      color: t.text,
      fontSize: 24,
      cursor: 'pointer',
    },

    listScroll: {
      flex: 1,
      overflowY: 'auto',
    },

    folderRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '16px 20px',
      cursor: 'pointer',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    },

    folderIcon: {
      fontSize: 22,
    },

    folderName: {
      color: t.text,
      fontSize: 15,
    },

    noteRow: {
      padding: '16px 20px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      cursor: 'pointer',
    },

    noteTitle: {
      color: t.text,
      fontWeight: 600,
    },

    noteDate: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 12,
      marginTop: 4,
    },

    input: {
      width: '100%',
      background: 'none',
      border: 'none',
      outline: 'none',
      color: t.text,
      fontSize: 20,
      padding: 20,
    },

    textarea: {
      flex: 1,
      background: 'none',
      border: 'none',
      outline: 'none',
      resize: 'none',
      color: t.text,
      padding: 20,
      fontSize: 15,
    },
  }

  // =========================
  // FOLDERS
  // =========================

  if (view === 'folders') {
    return (
      <div style={s.wrapper}>
        <div style={s.header}>
          <div style={s.title}>Заметки</div>

          <button
            style={s.addBtn}
            onClick={() => setShowFolderModal(true)}
          >
            +
          </button>
        </div>

        <div style={s.listScroll}>
          {folders.map((folder) => (
            <div
              key={folder.id}
              style={s.folderRow}
              onClick={() => {
                setActiveFolder(folder)
                setView('notesList')
              }}
            >
              <div style={s.folderIcon}>{folder.icon}</div>

              <div style={s.folderName}>{folder.name}</div>
            </div>
          ))}
        </div>

        {showFolderModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                background: '#1c1c1e',
                padding: 20,
                borderRadius: 16,
                width: 300,
              }}
            >
              <input
                value={newFolderName}
                onChange={(e) =>
                  setNewFolderName(e.target.value)
                }
                placeholder="Название папки"
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  outline: 'none',
                }}
              />

              <button
                onClick={createFolder}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Создать
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // =========================
  // NOTES LIST
  // =========================

  if (view === 'notesList') {
    return (
      <div style={s.wrapper}>
        <div style={s.header}>
          <button
            onClick={() => setView('folders')}
            style={s.addBtn}
          >
            ←
          </button>

          <div style={s.title}>
            {activeFolder?.name}
          </div>

          <button
            onClick={createNote}
            style={s.addBtn}
          >
            +
          </button>
        </div>

        <div style={s.listScroll}>
          {folderNotes.map((note) => (
            <div
              key={note.id}
              style={s.noteRow}
              onClick={() => {
                setActiveNote(note)
                setNoteTitle(note.title)
                setNoteContent(note.content)
                setView('editor')
              }}
            >
              <div style={s.noteTitle}>
                {note.title || 'Без названия'}
              </div>

              <div style={s.noteDate}>
                {formatNoteDate(note.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // =========================
  // EDITOR
  // =========================

  return (
    <div style={s.wrapper}>
      <div style={s.header}>
        <button
          onClick={() => setView('notesList')}
          style={s.addBtn}
        >
          ←
        </button>

        <button
          onClick={() => deleteNote(activeNote.id)}
          style={s.addBtn}
        >
          🗑
        </button>
      </div>

      <input
        style={s.input}
        value={noteTitle}
        placeholder="Заголовок"
        onChange={(e) => {
          setNoteTitle(e.target.value)
          updateNote(e.target.value, noteContent)
        }}
      />

      <textarea
        ref={textareaRef}
        style={s.textarea}
        value={noteContent}
        placeholder="Начни писать..."
        onChange={(e) => {
          setNoteContent(e.target.value)
          updateNote(noteTitle, e.target.value)
        }}
      />
    </div>
  )
}
