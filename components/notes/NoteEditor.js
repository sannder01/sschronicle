'use client'

import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import NoteIcon from './NoteIcon'

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, blockquote: false, codeBlock: false, horizontalRule: false, strike: false, code: false, link: false, underline: false }),
  TaskList, TaskItem.configure({ nested: true }),
]

export default function NoteEditor({ note, onChange, t, disabled, resetToken, language, timezone }) {
  const update = useRef(onChange)
  const titleInput = useRef(null)
  update.current = onChange
  const [formats, setFormats] = useState(false)
  const editor = useEditor({
    extensions,
    content: note.document,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    editorProps: { attributes: { class: 'notes-prose', role: 'textbox', 'aria-multiline': 'true', 'aria-label': t('Текст заметки', 'Note body'), 'data-placeholder': t('Запишите то, что важно.', 'Write down what matters.') } },
    onUpdate: ({ editor: current }) => update.current({ document: current.getJSON() }),
  })
  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])
  useEffect(() => {
    if (!titleInput.current) return
    titleInput.current.style.height = 'auto'
    titleInput.current.style.height = `${titleInput.current.scrollHeight}px`
  }, [note.title])
  const incoming = useRef(note.document)
  incoming.current = note.document
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(incoming.current)) editor.commands.setContent(incoming.current, { emitUpdate: false })
  }, [editor, resetToken])
  const command = (name, value) => editor?.chain().focus()[name](value).run()
  const formatButton = (label, name, active, children, value) => <button type="button" className={`notes-format-button ${active ? 'active' : ''}`} aria-label={label} aria-pressed={Boolean(active)} disabled={disabled || !editor} onClick={() => command(name, value)}>{children}</button>
  return <>
    <div className="notes-editor-scroll">
      <p className="notes-timestamp">{new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: timezone }).format(new Date(note.updated_at))}</p>
      <label className="sr-only" htmlFor={`note-title-${note.id}`}>{t('Название заметки', 'Note title')}</label>
      <textarea ref={titleInput} id={`note-title-${note.id}`} className="notes-title-input" maxLength={500} rows={1} value={note.title} placeholder={t('Название', 'Title')} disabled={disabled} onChange={event => onChange({ title: event.target.value })} />
      <EditorContent editor={editor} />
    </div>
    <div className="notes-editing-tools glass">
      {formats && <div className="notes-format-panel" role="toolbar" aria-label={t('Форматирование', 'Formatting')}>
        {formatButton(t('Заголовок', 'Heading'), 'toggleHeading', editor?.isActive('heading', { level: 2 }), <strong>{t('Заголовок', 'Heading')}</strong>, { level: 2 })}
        {formatButton(t('Обычный текст', 'Body'), 'setParagraph', editor?.isActive('paragraph'), t('Текст', 'Body'))}
        {formatButton(t('Жирный', 'Bold'), 'toggleBold', editor?.isActive('bold'), <b>B</b>)}
        {formatButton(t('Курсив', 'Italic'), 'toggleItalic', editor?.isActive('italic'), <i>I</i>)}
        {formatButton(t('Маркированный список', 'Bulleted list'), 'toggleBulletList', editor?.isActive('bulletList'), <NoteIcon name="list" />)}
        {formatButton(t('Нумерованный список', 'Numbered list'), 'toggleOrderedList', editor?.isActive('orderedList'), <span>1.</span>)}
      </div>}
      <div className="notes-toolbar" role="toolbar" aria-label={t('Инструменты заметки', 'Note tools')}>
        <button className={`notes-icon-button notes-type ${formats ? 'active' : ''}`} type="button" aria-label={t('Форматирование', 'Formatting')} aria-expanded={formats} onClick={() => setFormats(value => !value)} disabled={disabled}>Aa</button>
        {formatButton(t('Чек-лист', 'Checklist'), 'toggleTaskList', editor?.isActive('taskList'), <NoteIcon name="checklist" />)}
        <span className="notes-tool-divider" />
        <button className="notes-icon-button" type="button" aria-label={t('Отменить ввод', 'Undo')} disabled={disabled || !editor?.can().undo()} onClick={() => command('undo')}><NoteIcon name="undo" /></button>
        <button className="notes-icon-button" type="button" aria-label={t('Повторить ввод', 'Redo')} disabled={disabled || !editor?.can().redo()} onClick={() => command('redo')}><NoteIcon name="redo" /></button>
        <span className="notes-toolbar-spacer" />
        <button className="notes-text-button" type="button" onClick={() => { editor?.commands.blur(); document.activeElement?.blur() }} disabled={disabled}>{t('Готово', 'Done')}</button>
      </div>
    </div>
  </>
}
