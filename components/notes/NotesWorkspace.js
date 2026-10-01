'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/components/AppContext'
import { api } from '@/lib/client'
import { Button, Dialog } from '@/components/ui'
import { NoteAutosave } from '@/lib/notes/autosave.mjs'
import {
  documentText,
  EMPTY_DOCUMENT,
  normalizeNote,
  noteDay,
  noteGroup,
} from '@/lib/notes/format.mjs'
import NoteEditor from './NoteEditor'
import NoteIcon from './NoteIcon'
import './notes.css'

function errorMessage(error, t) {
  if (error.status === 401)
    return t(
      'Сессия истекла. Войдите снова; черновик сохранён на устройстве.',
      'Your session expired. Sign in again; the draft is kept on this device.',
    )
  if (error.status === 409)
    return t(
      'Заметка изменилась в другом окне. Обновите список и повторите действие.',
      'This note changed in another window. Refresh the list and try again.',
    )
  if (error.status === 404)
    return t(
      'Заметка или папка не найдена. Обновите список.',
      'Note or folder not found. Refresh the list.',
    )
  if (error.code === 'INVALID_TITLE')
    return t(
      'Название не должно превышать 500 символов.',
      'The title must be at most 500 characters.',
    )
  if (error.code === 'INVALID_DOCUMENT' || error.status === 413)
    return t(
      'Заметка слишком большая или содержит неподдерживаемое форматирование.',
      'The note is too large or contains unsupported formatting.',
    )
  if (error.code || error.status)
    return t(
      'Не удалось выполнить действие. Проверьте подключение и повторите.',
      'Could not complete this action. Check your connection and try again.',
    )
  return error.message || t('Не удалось загрузить заметки.', 'Could not load notes.')
}

export default function NotesWorkspace() {
  const { user, settings, language, t, notify } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const folder = params.get('folder') || 'all'
  const noteId = params.get('note')
  const screen = noteId ? 'editor' : params.has('folder') ? 'list' : 'folders'
  const timezone = settings?.timezone || 'UTC'
  const [notes, setNotes] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('updated')
  const [editFolders, setEditFolders] = useState(false)
  const [folderDialog, setFolderDialog] = useState(null)
  const [folderName, setFolderName] = useState('')
  const [deleteFolder, setDeleteFolder] = useState(null)
  const [noteMenu, setNoteMenu] = useState(false)
  const [moveDialog, setMoveDialog] = useState(false)
  const [deleteNote, setDeleteNote] = useState(false)
  const [resetToken, setResetToken] = useState(0)
  const [keyboardHeight, setKeyboardHeight] = useState(null)
  const [, render] = useState(0)
  const controller = useRef(null)
  const localChange = useRef(0)
  const menuRef = useRef(null)
  const mounted = useRef(true)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const resize = () =>
      setKeyboardHeight(
        window.innerWidth <= 800 && window.innerHeight - viewport.height > 140
          ? viewport.height
          : null,
      )
    viewport.addEventListener('resize', resize)
    resize()
    return () => viewport.removeEventListener('resize', resize)
  }, [])

  const load = useCallback(async () => {
    const changeAtStart = localChange.current
    const [rows, groups] = await Promise.all([api('/api/notes'), api('/api/folders?type=note')])
    if (!mounted.current || changeAtStart !== localChange.current) return
    const normalized = rows.map(normalizeNote)
    setNotes(
      normalized.map((note) => {
        const entry = controller.current?.seed(note)
        return entry?.dirty ? { ...note, ...entry.data } : entry?.note || note
      }),
    )
    setFolders(groups)
    setResetToken((value) => value + 1)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    mounted.current = true
    let storage
    try {
      storage = window.localStorage
    } catch {
      storage = null
    }
    const manager = new NoteAutosave({
      userId: user.id,
      clientId: crypto.randomUUID(),
      storage,
      request: (id, body) => api(`/api/notes/${id}`, { method: 'PATCH', body }),
      onChange: (id, entry) => {
        if (!mounted.current) return
        setNotes((previous) =>
          previous.map((note) =>
            String(note.id) === id ? { ...entry.note, ...entry.data } : note,
          ),
        )
        render((value) => value + 1)
      },
    })
    controller.current = manager
    load().catch((failure) => {
      if (mounted.current) {
        setError(failure)
        setLoading(false)
      }
    })
    const refresh = () =>
      load().catch((failure) => {
        if (mounted.current) setError(failure)
      })
    const leave = (event) => {
      if (manager.hasPending()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    const hidden = () => {
      if (document.visibilityState === 'hidden') manager.flushAll()
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('beforeunload', leave)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      mounted.current = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener('beforeunload', leave)
      document.removeEventListener('visibilitychange', hidden)
      manager.dispose()
    }
  }, [user?.id, load])

  useEffect(() => {
    if (!noteMenu) return
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setNoteMenu(false)
    }
    const escape = (event) => {
      if (event.key === 'Escape') setNoteMenu(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [noteMenu])

  const active = notes.find((note) => String(note.id) === noteId)
  const draft = active && controller.current?.snapshot(active.id)
  const folderTitle =
    folder === 'all'
      ? t('Все заметки', 'All Notes')
      : folder === 'unfiled'
        ? t('Заметки', 'Notes')
        : folder === 'trash'
          ? t('Недавно удалённые', 'Recently Deleted')
          : folders.find((item) => String(item.id) === folder)?.name ||
            t('Папка не найдена', 'Folder not found')
  const filtered = useMemo(
    () =>
      notes
        .filter((note) => {
          if ((folder === 'trash') !== Boolean(note.deleted_at)) return false
          if (
            !['all', 'trash'].includes(folder) &&
            (folder === 'unfiled' ? note.folder_id != null : String(note.folder_id) !== folder)
          )
            return false
          return `${note.title} ${documentText(note.document)}`
            .toLocaleLowerCase(language)
            .includes(query.toLocaleLowerCase(language))
        })
        .sort(
          (a, b) =>
            Number(b.pinned && !b.deleted_at) - Number(a.pinned && !a.deleted_at) ||
            (sort === 'title'
              ? a.title.localeCompare(b.title, language)
              : new Date(sort === 'created' ? b.created_at : b.updated_at) -
                new Date(sort === 'created' ? a.created_at : a.updated_at)),
        ),
    [notes, folder, query, sort, language],
  )
  const grouped = useMemo(() => {
    const groups = new Map()
    filtered.forEach((note) => {
      const label = noteGroup(note, { timezone, language, sort })
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label).push(note)
    })
    return [...groups]
  }, [filtered, timezone, language, sort])

  const navigate = (nextFolder, nextNote) => {
    if (active) controller.current?.flush(active.id)
    const search = new URLSearchParams()
    if (nextFolder) search.set('folder', nextFolder)
    if (nextNote) search.set('note', nextNote)
    setNoteMenu(false)
    router.push(`/app/notes${search.size ? `?${search}` : ''}`, { scroll: false })
  }
  const run = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }
  const createNote = () =>
    run(async () => {
      const created = normalizeNote(
        await api('/api/notes', {
          method: 'POST',
          body: {
            title: '',
            document: EMPTY_DOCUMENT,
            folder_id: /^\d+$/.test(folder) ? Number(folder) : null,
          },
        }),
      )
      localChange.current += 1
      controller.current.seed(created)
      setNotes((previous) => [created, ...previous])
      navigate(folder === 'trash' ? 'all' : folder, created.id)
    })
  const ensureSaved = async (id) => {
    if (!(await controller.current.flush(id, true)))
      throw new Error(
        t(
          'Сначала сохраните или разрешите конфликт черновика.',
          'Save or resolve the draft conflict first.',
        ),
      )
    return controller.current.snapshot(id)
  }
  const mutateNote = (patch, after) =>
    run(async () => {
      const saved = await ensureSaved(active.id)
      const note = normalizeNote(
        await api(`/api/notes/${active.id}`, {
          method: 'PATCH',
          body: { ...patch, version: saved.version },
        }),
      )
      controller.current.accept(note)
      setNoteMenu(false)
      after?.(note)
    })
  const saveFolder = (event) => {
    event.preventDefault()
    run(async () => {
      const editing = folderDialog?.id
      await api(editing ? `/api/folders/${editing}` : '/api/folders', {
        method: editing ? 'PATCH' : 'POST',
        body: { name: folderName, entityType: 'note', color: '#d59d00' },
      })
      setFolderDialog(null)
      await load()
    })
  }
  const recoverCopy = () =>
    run(async () => {
      const entry = controller.current.snapshot(active.id)
      const created = normalizeNote(
        await api('/api/notes', {
          method: 'POST',
          body: {
            ...entry.data,
            title: `${entry.data.title || t('Заметка', 'Note')} — ${t('копия', 'copy')}`.slice(
              0,
              500,
            ),
          },
        }),
      )
      if (entry.conflict) await controller.current.resolve(active.id, 'server')
      else await controller.current.discardAfterCopy(active.id)
      controller.current.seed(created)
      setNotes((previous) => [created, ...previous])
      setResetToken((value) => value + 1)
      navigate('all', created.id)
      notify?.(t('Черновик сохранён отдельной заметкой.', 'Draft saved as a separate note.'))
    })
  const resolve = (choice) =>
    run(async () => {
      await controller.current.resolve(active.id, choice)
      setResetToken((value) => value + 1)
    })
  const count = (value) =>
    notes.filter((note) =>
      value === 'trash'
        ? note.deleted_at
        : !note.deleted_at &&
          (value === 'all' ||
            (value === 'unfiled'
              ? note.folder_id == null
              : String(note.folder_id) === String(value))),
    ).length
  const folderRow = (id, title, icon) => (
    <button
      key={id}
      className={`notes-folder-row ${folder === String(id) ? 'selected' : ''}`}
      onClick={() => navigate(String(id))}
    >
      <NoteIcon name={icon} />
      <span>{title}</span>
      <span className="notes-count">{count(id)}</span>
      <NoteIcon name="chevron" size={14} />
    </button>
  )
  const statusText =
    draft?.status === 'saving' || draft?.status === 'pending'
      ? t('Сохраняется…', 'Saving…')
      : draft?.status === 'error'
        ? t('Не удалось сохранить', 'Could not save')
        : draft?.status === 'conflict'
          ? t('Конфликт версий', 'Version conflict')
          : draft?.status === 'recovered'
            ? t('Черновик восстановлен', 'Draft recovered')
            : t('Сохранено', 'Saved')

  return (
    <section
      className={`notes-workspace notes-screen-${screen}${keyboardHeight ? ' notes-keyboard-open' : ''}`}
      style={keyboardHeight ? { '--notes-visual-height': `${keyboardHeight}px` } : undefined}
      aria-label={t('Заметки', 'Notes')}
    >
      {error && (
        <div className="notes-error" role="alert">
          <span>{errorMessage(error, t)}</span>
          <button className="notes-text-button" onClick={() => run(load)}>
            {t('Повторить', 'Retry')}
          </button>
          <button
            className="notes-icon-button"
            aria-label={t('Закрыть ошибку', 'Dismiss error')}
            onClick={() => setError(null)}
          >
            <NoteIcon name="close" size={18} />
          </button>
        </div>
      )}
      <aside className="notes-folders">
        <header className="notes-column-header">
          <span className="notes-wordmark">Chronicle</span>
          <button className="notes-text-button" onClick={() => setEditFolders((value) => !value)}>
            {editFolders ? t('Готово', 'Done') : t('Править', 'Edit')}
          </button>
        </header>
        <h1 className="notes-large-title">{t('Папки', 'Folders')}</h1>
        <div className="notes-folder-content">
          <h2 className="notes-section-label">Chronicle</h2>
          <div className="notes-folder-group">
            {folderRow('all', t('Все заметки', 'All Notes'), 'notes')}
            {folderRow('unfiled', t('Заметки', 'Notes'), 'folder')}
            {folders.map((item) => (
              <div key={item.id} className="notes-folder-edit-row">
                {folderRow(item.id, item.name, 'folder')}
                {editFolders && (
                  <div className="notes-folder-actions">
                    <button
                      className="notes-icon-button"
                      aria-label={`${t('Переименовать', 'Rename')} ${item.name}`}
                      onClick={() => {
                        setFolderName(item.name)
                        setFolderDialog(item)
                      }}
                    >
                      <NoteIcon name="compose" size={18} />
                    </button>
                    <button
                      className="notes-icon-button danger"
                      aria-label={`${t('Удалить папку', 'Delete folder')} ${item.name}`}
                      onClick={() => setDeleteFolder(item)}
                    >
                      <NoteIcon name="trash" size={18} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="notes-folder-group notes-trash-folder">
            {folderRow('trash', t('Недавно удалённые', 'Recently Deleted'), 'trash')}
          </div>
        </div>
        <footer className="notes-column-footer glass">
          <button
            className="notes-text-button notes-new-folder"
            onClick={() => {
              setFolderName('')
              setFolderDialog({})
            }}
          >
            <NoteIcon name="newFolder" />
            {t('Новая папка', 'New Folder')}
          </button>
          <button
            className="notes-icon-button"
            aria-label={t('Новая заметка', 'New note')}
            onClick={createNote}
            disabled={busy}
          >
            <NoteIcon name="compose" />
          </button>
        </footer>
      </aside>
      <section className="notes-list" aria-label={t('Список заметок', 'Note list')}>
        <header className="notes-column-header">
          <button className="notes-back notes-text-button" onClick={() => navigate(null)}>
            <NoteIcon name="back" size={18} />
            {t('Папки', 'Folders')}
          </button>
          <label className="notes-sort">
            <span className="sr-only">{t('Сортировка заметок', 'Sort notes')}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="updated">{t('По изменению', 'Date edited')}</option>
              <option value="created">{t('По созданию', 'Date created')}</option>
              <option value="title">{t('По названию', 'Title')}</option>
            </select>
          </label>
        </header>
        <h2 className="notes-large-title">{folderTitle}</h2>
        <label className="notes-search">
          <NoteIcon name="search" size={18} />
          <input
            type="search"
            aria-label={t('Поиск заметок', 'Search notes')}
            placeholder={t('Поиск', 'Search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="notes-list-scroll">
          {loading ? (
            <div className="notes-empty-small" role="status">
              {t('Загрузка заметок…', 'Loading notes…')}
            </div>
          ) : error && !notes.length ? (
            <div className="notes-empty-small">
              {t(
                'Заметки не загружены. Повторите запрос.',
                'Notes could not be loaded. Try again.',
              )}
            </div>
          ) : grouped.length ? (
            grouped.map(([label, rows]) => (
              <div key={label} className="notes-list-group">
                <h3>
                  {label === t('Закреплённые', 'Pinned') && <NoteIcon name="pin" size={15} />}
                  {label}
                </h3>
                <div>
                  {rows.map((note) => (
                    <button
                      key={note.id}
                      className={`notes-list-item ${String(note.id) === noteId ? 'selected' : ''}`}
                      onClick={() => navigate(folder, note.id)}
                      aria-current={String(note.id) === noteId ? 'true' : undefined}
                    >
                      <strong>{note.title.trim() || t('Новая заметка', 'New Note')}</strong>
                      <span className="notes-list-preview">
                        <time dateTime={note.updated_at}>
                          {new Intl.DateTimeFormat(
                            language === 'ru' ? 'ru-RU' : 'en-US',
                            noteDay(note.updated_at, timezone) === noteDay(new Date(), timezone)
                              ? { hour: '2-digit', minute: '2-digit', timeZone: timezone }
                              : { day: 'numeric', month: 'short', timeZone: timezone },
                          ).format(new Date(note.updated_at))}
                        </time>
                        <span>
                          {documentText(note.document).replace(/\s+/g, ' ').trim() ||
                            t('Нет дополнительного текста', 'No additional text')}
                        </span>
                      </span>
                      {folder === 'all' && (
                        <span className="notes-list-folder">
                          <NoteIcon name="folder" size={12} />
                          {folders.find((item) => item.id === note.folder_id)?.name ||
                            t('Заметки', 'Notes')}
                        </span>
                      )}
                      {controller.current?.snapshot(note.id)?.dirty && (
                        <span
                          className="notes-draft-dot"
                          aria-label={t('Есть несохранённый черновик', 'Unsaved draft')}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="notes-empty-small">
              <NoteIcon name={folder === 'trash' ? 'trash' : 'notes'} size={36} />
              <h3>
                {query
                  ? t('Ничего не найдено', 'No results')
                  : folder === 'trash'
                    ? t('Нет удалённых заметок', 'No deleted notes')
                    : t('Пока нет заметок', 'No notes yet')}
              </h3>
              <p>
                {query
                  ? t('Попробуйте другое слово.', 'Try another search.')
                  : folder === 'trash'
                    ? t('Удалённые заметки появятся здесь.', 'Deleted notes will appear here.')
                    : t(
                        'Первая мысль — хорошее начало.',
                        'A first thought is a good place to start.',
                      )}
              </p>
              {!query && folder !== 'trash' && (
                <button className="notes-text-button" onClick={createNote} disabled={busy}>
                  {t('Создать заметку', 'Create a note')}
                </button>
              )}
            </div>
          )}
        </div>
        <footer className="notes-column-footer glass">
          <span className="notes-total">
            {filtered.length} {t('заметок', 'notes')}
          </span>
          <button
            className="notes-icon-button"
            aria-label={t('Новая заметка', 'New note')}
            onClick={createNote}
            disabled={busy}
          >
            <NoteIcon name="compose" />
          </button>
        </footer>
      </section>
      <section className="notes-editor" aria-label={t('Редактор заметки', 'Note editor')}>
        {active ? (
          <>
            <header className="notes-editor-header glass">
              <button
                className="notes-text-button notes-editor-back"
                onClick={() => navigate(folder)}
              >
                <NoteIcon name="back" size={18} />
                <span>{folderTitle}</span>
              </button>
              <span className={`notes-save-status ${draft?.dirty ? 'unsaved' : ''}`} role="status">
                {statusText}
              </span>
              <div className="notes-menu-anchor" ref={menuRef}>
                <button
                  className="notes-icon-button"
                  aria-label={t('Действия с заметкой', 'Note actions')}
                  aria-expanded={noteMenu}
                  onClick={() => setNoteMenu((value) => !value)}
                >
                  <NoteIcon name="more" />
                </button>
                {noteMenu && (
                  <div className="notes-action-menu glass">
                    {!active.deleted_at ? (
                      <>
                        <button
                          onClick={() => mutateNote({ pinned: !active.pinned })}
                          disabled={busy}
                        >
                          <NoteIcon name="pin" />
                          {active.pinned ? t('Открепить', 'Unpin') : t('Закрепить', 'Pin note')}
                        </button>
                        <button
                          onClick={() => {
                            setMoveDialog(true)
                            setNoteMenu(false)
                          }}
                          disabled={busy}
                        >
                          <NoteIcon name="folder" />
                          {t('Переместить', 'Move note')}
                        </button>
                        <button
                          className="danger"
                          onClick={() => mutateNote({ deleted: true }, () => navigate(folder))}
                          disabled={busy}
                        >
                          <NoteIcon name="trash" />
                          {t('Удалить заметку', 'Delete note')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            mutateNote({ deleted: false }, (note) =>
                              navigate(
                                note.folder_id ? String(note.folder_id) : 'unfiled',
                                note.id,
                              ),
                            )
                          }
                          disabled={busy}
                        >
                          <NoteIcon name="undo" />
                          {t('Восстановить', 'Recover')}
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            setDeleteNote(true)
                            setNoteMenu(false)
                          }}
                        >
                          <NoteIcon name="trash" />
                          {t('Удалить навсегда', 'Delete permanently')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </header>
            {draft?.storageError && (
              <div className="notes-save-warning" role="alert">
                {t(
                  'Хранилище устройства недоступно. Не закрывайте вкладку до сохранения на сервере.',
                  'Device storage is unavailable. Keep this tab open until the server confirms the save.',
                )}
              </div>
            )}
            {draft?.status === 'error' && (
              <div className="notes-save-warning" role="alert">
                <span>
                  {draft.error?.status === 401
                    ? t(
                        'Нужен повторный вход. Черновик сохранён на этом устройстве.',
                        'Sign in again. Your draft is saved on this device.',
                      )
                    : t(
                        'Не удалось сохранить. Черновик сохранён на этом устройстве.',
                        'Could not save. Your draft is kept on this device.',
                      )}
                </span>
                <button
                  className="notes-text-button"
                  onClick={() => controller.current.flush(active.id, true)}
                >
                  {t('Повторить', 'Retry')}
                </button>
                <button className="notes-text-button" onClick={recoverCopy}>
                  {t('Сохранить копию', 'Save a copy')}
                </button>
              </div>
            )}
            {draft?.conflict && (
              <div className="notes-conflict" role="alert">
                <strong>
                  {draft.status === 'recovered'
                    ? t('Найден несохранённый черновик', 'Recovered an unsaved draft')
                    : t('Заметка изменилась в другом окне', 'This note changed in another window')}
                </strong>
                <p>
                  {t(
                    'Ваш текст сохранён ниже. Сравните с версией сервера и выберите, что сохранить.',
                    'Your text is preserved below. Compare it with the server version and choose what to keep.',
                  )}
                </p>
                <details>
                  <summary>{t('Посмотреть версию сервера', 'View server version')}</summary>
                  <strong>{draft.conflict.title || t('Без названия', 'Untitled')}</strong>
                  <pre>{documentText(draft.conflict.document)}</pre>
                </details>
                <div className="notes-conflict-actions">
                  <button className="notes-text-button" disabled={busy} onClick={recoverCopy}>
                    {t('Сохранить мой текст как копию', 'Save my text as a copy')}
                  </button>
                  <button
                    className="notes-text-button"
                    disabled={busy}
                    onClick={() => resolve('server')}
                  >
                    {t('Использовать серверную версию', 'Use server version')}
                  </button>
                  {!draft.conflict.deleted_at && (
                    <button
                      className="notes-text-button"
                      disabled={busy}
                      onClick={() => resolve('local')}
                    >
                      {t('Заменить серверную моим текстом', 'Replace server text with mine')}
                    </button>
                  )}
                </div>
              </div>
            )}
            {active.deleted_at && (
              <div className="notes-deleted-banner">
                <span>{t('Эта заметка в корзине.', 'This note is in Recently Deleted.')}</span>
                <button
                  className="notes-text-button"
                  disabled={busy}
                  onClick={() =>
                    mutateNote({ deleted: false }, (note) =>
                      navigate(note.folder_id ? String(note.folder_id) : 'unfiled', note.id),
                    )
                  }
                >
                  {t('Восстановить', 'Recover')}
                </button>
              </div>
            )}
            <NoteEditor
              key={active.id}
              note={{ ...active, ...(draft?.data || {}) }}
              onChange={(patch) => controller.current.update(active.id, patch)}
              t={t}
              disabled={busy || Boolean(active.deleted_at)}
              resetToken={resetToken}
              language={language}
              timezone={timezone}
            />
          </>
        ) : (
          <div className="notes-editor-empty">
            <NoteIcon name="notes" size={52} />
            <h2>
              {noteId
                ? t('Заметка не найдена', 'Note not found')
                : t('Место для ваших мыслей', 'A place for your thoughts')}
            </h2>
            <p>
              {noteId
                ? t(
                    'Она могла быть удалена. Выберите другую заметку.',
                    'It may have been deleted. Choose another note.',
                  )
                : t('Выберите заметку или начните новую.', 'Select a note or start a new one.')}
            </p>
            <button
              className="notes-text-button"
              onClick={noteId ? () => navigate(folder) : createNote}
              disabled={busy}
            >
              {noteId ? t('К заметкам', 'Back to notes') : t('Новая заметка', 'New note')}
            </button>
          </div>
        )}
      </section>
      <Dialog
        open={Boolean(folderDialog)}
        title={
          folderDialog?.id
            ? t('Переименовать папку', 'Rename Folder')
            : t('Новая папка', 'New Folder')
        }
        onClose={() => setFolderDialog(null)}
      >
        <form onSubmit={saveFolder} className="stack">
          <label className="field">
            {t('Название', 'Name')}
            <input
              className="input"
              autoFocus
              required
              maxLength={80}
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
            />
          </label>
          <div className="row">
            <Button type="button" variant="secondary" onClick={() => setFolderDialog(null)}>
              {t('Отмена', 'Cancel')}
            </Button>
            <Button type="submit" disabled={busy || !folderName.trim()}>
              {t('Сохранить', 'Save')}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={Boolean(deleteFolder)}
        title={t('Удалить папку?', 'Delete folder?')}
        onClose={() => setDeleteFolder(null)}
      >
        <p>
          {t(
            'Все заметки из этой папки сохранятся в разделе «Заметки» без папки.',
            'All notes in this folder will be kept in Notes, without a folder.',
          )}
        </p>
        <div className="row">
          <Button variant="secondary" onClick={() => setDeleteFolder(null)}>
            {t('Отмена', 'Cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const id = deleteFolder.id
                await controller.current.flushAll()
                if (controller.current.hasPending())
                  throw new Error(t('Сначала сохраните все черновики.', 'Save all drafts first.'))
                await api(`/api/folders/${id}`, { method: 'DELETE' })
                setDeleteFolder(null)
                if (folder === String(id)) navigate('unfiled')
                await load()
              })
            }
          >
            {t('Удалить папку', 'Delete Folder')}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={moveDialog}
        title={t('Переместить заметку', 'Move Note')}
        onClose={() => setMoveDialog(false)}
      >
        <div className="notes-move-list">
          {[{ id: null, name: t('Заметки без папки', 'Notes without a folder') }, ...folders].map(
            (item) => (
              <button
                key={item.id ?? 'none'}
                className="notes-folder-row"
                disabled={busy || item.id === active?.folder_id}
                onClick={() =>
                  mutateNote({ folder_id: item.id }, (note) => {
                    setMoveDialog(false)
                    navigate(item.id ? String(item.id) : 'unfiled', note.id)
                  })
                }
              >
                <NoteIcon name="folder" />
                <span>{item.name}</span>
                {item.id === active?.folder_id && <NoteIcon name="check" />}
              </button>
            ),
          )}
        </div>
      </Dialog>
      <Dialog
        open={deleteNote}
        title={t('Удалить навсегда?', 'Delete permanently?')}
        onClose={() => setDeleteNote(false)}
      >
        <p>{t('Эту заметку нельзя будет восстановить.', 'This note cannot be recovered.')}</p>
        <div className="row">
          <Button variant="secondary" onClick={() => setDeleteNote(false)}>
            {t('Отмена', 'Cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const saved = await ensureSaved(active.id)
                await api(`/api/notes/${active.id}`, {
                  method: 'DELETE',
                  body: { version: saved.version, confirm: 'DELETE' },
                })
                controller.current.forget(active.id)
                setNotes((previous) => previous.filter((note) => note.id !== active.id))
                setDeleteNote(false)
                navigate('trash')
              })
            }
          >
            {t('Удалить навсегда', 'Delete Permanently')}
          </Button>
        </div>
      </Dialog>
    </section>
  )
}
