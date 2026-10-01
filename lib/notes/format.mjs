// A strict subset of Tiptap JSON. Legacy content is text, never HTML.
export const EMPTY_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] }

export function legacyDocument(value = '') {
  return {
    type: 'doc',
    content: String(value)
      .split(/\r\n|\r|\n/)
      .map((line) => ({
        type: 'paragraph',
        ...(line ? { content: [{ type: 'text', text: line }] } : {}),
      })),
  }
}

export function validateDocument(value) {
  if (!value || value.type !== 'doc' || JSON.stringify(value).length > 350000)
    throw new Error('Invalid note document')
  let count = 0
  const blocks = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList']
  function visit(node, depth = 0) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 20 || ++count > 10000)
      throw new Error('Note is too complex')
    const { type } = node
    if (!['doc', 'text', 'hardBreak', 'listItem', 'taskItem', ...blocks].includes(type))
      throw new Error('Unsupported note formatting')
    const output = { type }
    if (type === 'text') {
      if (typeof node.text !== 'string' || !node.text.length) throw new Error('Invalid text')
      output.text = node.text
      if (node.marks) {
        if (!Array.isArray(node.marks) || node.marks.length > 2)
          throw new Error('Invalid text marks')
        output.marks = node.marks.map((mark) => {
          if (!mark || !['bold', 'italic'].includes(mark.type))
            throw new Error('Unsupported text marks')
          return { type: mark.type }
        })
      }
      return output
    }
    if (type === 'hardBreak') return output
    if (type === 'heading') {
      const level = node.attrs?.level
      if (![1, 2, 3].includes(level)) throw new Error('Invalid heading level')
      output.attrs = { level }
    }
    if (type === 'orderedList') {
      const start = node.attrs?.start ?? 1
      if (!Number.isInteger(start) || start < 1 || start > 100000)
        throw new Error('Invalid list start')
      output.attrs = { start }
    }
    if (type === 'taskItem') {
      if (typeof node.attrs?.checked !== 'boolean') throw new Error('Invalid checklist')
      output.attrs = { checked: node.attrs.checked }
    }
    const children = node.content ?? []
    if (!Array.isArray(children)) throw new Error('Invalid document content')
    let allowed = blocks
    if (['paragraph', 'heading'].includes(type)) allowed = ['text', 'hardBreak']
    if (['bulletList', 'orderedList'].includes(type)) allowed = ['listItem']
    if (type === 'taskList') allowed = ['taskItem']
    if (['listItem', 'taskItem'].includes(type) && children[0]?.type !== 'paragraph')
      throw new Error('Invalid list item')
    if (['doc', 'bulletList', 'orderedList', 'taskList'].includes(type) && !children.length)
      throw new Error('Empty document container')
    if (children.some((child) => !allowed.includes(child?.type)))
      throw new Error('Invalid document structure')
    if (children.length) output.content = children.map((child) => visit(child, depth + 1))
    return output
  }
  return visit(value)
}

export function documentText(document) {
  function text(node) {
    if (node.type === 'text') return node.text
    if (node.type === 'hardBreak') return '\n'
    const separator = ['paragraph', 'heading'].includes(node.type) ? '' : '\n'
    return (node.content ?? []).map(text).join(separator)
  }
  return text(document)
}

export function normalizeNote(note) {
  return {
    ...note,
    document: note.document ?? legacyDocument(note.content),
    version: Number(note.version || 1),
  }
}

export function noteDay(value, timezone = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export function noteGroup(
  note,
  { now = new Date(), timezone = 'UTC', language = 'ru', sort = 'updated' } = {},
) {
  if (note.pinned && !note.deleted_at) return language === 'ru' ? 'Закреплённые' : 'Pinned'
  if (sort === 'title') return note.title.trim().charAt(0).toLocaleUpperCase(language) || '#'
  const value = sort === 'created' ? note.created_at : note.updated_at
  const today = noteDay(now, timezone)
  const yesterday = new Date(`${today}T12:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const day = noteDay(value, timezone)
  if (day === today) return language === 'ru' ? 'Сегодня' : 'Today'
  if (day === yesterday.toISOString().slice(0, 10)) return language === 'ru' ? 'Вчера' : 'Yesterday'
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  }).format(new Date(value))
}
