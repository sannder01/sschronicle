import { normalizeNote, validateDocument } from './format.mjs'

const copy = value => JSON.parse(JSON.stringify(value))
const editable = note => ({ title: note.title || '', document: copy(note.document) })

/** Each note has one serial writer. Requests carry the last acknowledged version.
 * Drafts are written synchronously before requests and separated by account + tab.
 * This instance can finish saves after a component unmount; dispose never aborts
 * a request whose outcome may already have been committed on the server. */
export class NoteAutosave {
  constructor({ userId, clientId, request, storage, delay = 650, onChange = () => {} }) {
    this.prefix = `chronicle:note-draft:v1:${encodeURIComponent(userId)}:`
    this.clientId = clientId
    this.request = request
    this.storage = storage
    this.delay = delay
    this.onChange = onChange
    this.entries = new Map()
  }

  key(id) { return `${this.prefix}${id}:${this.clientId}` }
  emit(entry) { this.onChange(entry.id, this.snapshot(entry.id)) }
  snapshot(id) {
    const entry = this.entries.get(String(id))
    return entry ? { ...entry, data: copy(entry.data), timer: undefined, running: undefined } : null
  }
  persist(entry) {
    try {
      this.storage?.setItem(this.key(entry.id), JSON.stringify({ data: entry.data, version: entry.version, at: Date.now() }))
      entry.storageError = false
    } catch { entry.storageError = true }
  }
  clearDraft(entry) {
    try {
      this.storage?.removeItem(this.key(entry.id))
      // Another tab may have continued typing after this recovery was shown.
      // Only remove the exact recovered snapshot the user has resolved.
      if (entry.recoveredKey && this.storage?.getItem(entry.recoveredKey) === entry.recoveredRaw) this.storage?.removeItem(entry.recoveredKey)
      entry.recoveredKey = null
      entry.recoveredRaw = null
    } catch { entry.storageError = true }
  }
  recover(id) {
    let newest = null
    try {
      for (let index = 0; index < (this.storage?.length || 0); index++) {
        const key = this.storage.key(index)
        if (!key?.startsWith(`${this.prefix}${id}:`)) continue
        try {
          const raw = this.storage.getItem(key)
          const draft = JSON.parse(raw)
          validateDocument(draft.data.document)
          if (typeof draft.data.title !== 'string' || draft.data.title.length > 500 || !Number.isInteger(draft.version)) continue
          if (!newest || draft.at > newest.at) newest = { ...draft, key, raw }
        } catch { /* A damaged local draft is retained, never rendered as HTML. */ }
      }
    } catch { return null }
    return newest
  }
  seed(raw) {
    const note = normalizeNote(raw)
    const id = String(note.id)
    const existing = this.entries.get(id)
    if (existing) {
      if (!existing.dirty && !existing.running && note.version > existing.version) {
        existing.note = note
        existing.version = note.version
        existing.data = editable(note)
        this.emit(existing)
      }
      return this.snapshot(id)
    }
    const draft = this.recover(id)
    const entry = { id, note, data: editable(note), version: note.version, revision: 0, dirty: false,
      status: 'saved', error: null, conflict: null, timer: null, running: null, storageError: false }
    this.entries.set(id, entry)
    if (draft) {
      entry.data = draft.data
      entry.dirty = true
      entry.recoveredKey = draft.key
      entry.recoveredRaw = draft.raw
      entry.status = 'recovered'
      // Explicit review after recovery: a saved network response may have been
      // lost, or another tab may still own this draft. Never blindly replay it.
      entry.conflict = note
      this.persist(entry)
    }
    return this.snapshot(id)
  }
  update(id, patch) {
    const entry = this.entries.get(String(id))
    if (!entry || entry.note.deleted_at || entry.removing) return
    entry.data = { ...entry.data, ...copy(patch) }
    entry.revision++
    entry.dirty = true
    if (!entry.conflict) entry.status = 'pending'
    this.persist(entry)
    clearTimeout(entry.timer)
    if (!entry.conflict) entry.timer = setTimeout(() => this.flush(id), this.delay)
    this.emit(entry)
  }
  async flush(id, retry = false) {
    const entry = this.entries.get(String(id))
    if (!entry) return true
    clearTimeout(entry.timer)
    if (entry.running) { await entry.running; return !entry.dirty }
    if (entry.conflict || (entry.status === 'error' && !retry)) return false
    if (!entry.dirty) return true
    entry.running = (async () => {
      while (entry.dirty && !entry.conflict) {
        const revision = entry.revision
        const data = copy(entry.data)
        entry.status = 'saving'
        entry.error = null
        this.emit(entry)
        try {
          const note = normalizeNote(await this.request(entry.id, { ...data, version: entry.version }))
          entry.note = note
          entry.version = note.version
          if (revision === entry.revision) {
            entry.dirty = false
            entry.status = 'saved'
            this.clearDraft(entry)
          } else this.persist(entry)
          this.emit(entry)
        } catch (error) {
          entry.error = error
          entry.conflict = error.status === 409 ? error.data?.current : null
          entry.status = entry.conflict ? 'conflict' : 'error'
          this.persist(entry)
          this.emit(entry)
          break
        }
      }
    })()
    await entry.running
    entry.running = null
    return !entry.dirty
  }
  async flushAll() { return Promise.all([...this.entries.keys()].map(id => this.flush(id))) }
  hasPending() { return [...this.entries.values()].some(entry => entry.dirty || entry.running) }
  async resolve(id, choice) {
    const entry = this.entries.get(String(id))
    if (!entry?.conflict) return
    if (entry.running) await entry.running
    const server = normalizeNote(entry.conflict)
    entry.version = server.version
    entry.note = server
    entry.conflict = null
    entry.error = null
    if (choice === 'server') {
      entry.data = editable(server)
      entry.dirty = false
      entry.status = 'saved'
      this.clearDraft(entry)
    } else {
      entry.status = 'pending'
      this.persist(entry)
    }
    this.emit(entry)
    if (choice !== 'server' && !server.deleted_at) await this.flush(id, true)
  }
  accept(note) {
    const entry = this.entries.get(String(note.id))
    if (!entry || entry.dirty || entry.running) throw new Error('Unsaved changes must be resolved first')
    entry.note = normalizeNote(note)
    entry.version = note.version
    entry.data = editable(entry.note)
    entry.status = 'saved'
    this.emit(entry)
  }
  async discardAfterCopy(id) {
    const entry = this.entries.get(String(id))
    if (!entry) return
    if (entry.running) await entry.running
    clearTimeout(entry.timer)
    entry.data = editable(entry.note)
    entry.conflict = null
    entry.dirty = false
    entry.status = 'saved'
    this.clearDraft(entry)
    this.emit(entry)
  }
  forget(id) {
    const entry = this.entries.get(String(id))
    if (!entry) return
    clearTimeout(entry.timer)
    if (entry.running || entry.dirty) throw new Error('Unsaved changes must be resolved first')
    this.clearDraft(entry)
    this.entries.delete(String(id))
  }
  dispose() {
    for (const entry of this.entries.values()) clearTimeout(entry.timer)
    this.onChange = () => {}
    return this.flushAll()
  }
}
