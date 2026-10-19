import { validateDiary } from './format.mjs'

const copy = (value) => JSON.parse(JSON.stringify(value))
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** One serial writer per day. sessionStorage isolates drafts by account and browser tab. */
export class DiaryWriter {
  constructor({ entry, userId, storage, request, onChange = () => {}, delay = 650 }) {
    this.entry = entry
    this.document = validateDiary(entry.document)
    this.version = entry.version
    this.key = `chronicle:diary-draft:v1:${encodeURIComponent(userId)}:${entry.entry_date}`
    this.storage = storage
    this.request = request
    this.onChange = onChange
    this.delay = delay
    this.revision = 0
    this.dirty = false
    this.status = 'saved'
    this.conflict = null
    try {
      const raw = this.storage?.getItem(this.key)
      if (raw) {
        const draft = JSON.parse(raw)
        const document = validateDiary(draft.document)
        if (equal(document, this.document)) this.storage.removeItem(this.key)
        else {
          this.document = document
          this.dirty = true
          this.status = 'recovered'
          this.conflict = entry
        }
      }
    } catch { /* A damaged draft must never replace a server document. */ }
  }
  snapshot() {
    return { document: copy(this.document), version: this.version, dirty: this.dirty,
      status: this.status, conflict: this.conflict, storageError: this.storageError }
  }
  emit() { this.onChange(this.snapshot()) }
  persist() {
    try {
      this.storage?.setItem(this.key, JSON.stringify({ document: this.document, version: this.version }))
      this.storageError = !this.storage
    } catch { this.storageError = true }
  }
  clear() {
    try { this.storage?.removeItem(this.key) } catch { /* Saved on server. */ }
  }
  update(patch) {
    this.document = { ...this.document, ...copy(patch) }
    this.revision++
    this.dirty = true
    if (!this.conflict) this.status = 'pending'
    this.persist()
    clearTimeout(this.timer)
    if (!this.conflict && this.status !== 'error') this.timer = setTimeout(() => this.flush(), this.delay)
    this.emit()
  }
  async flush(retry = false) {
    clearTimeout(this.timer)
    if (this.running) { await this.running; return !this.dirty }
    if (this.conflict || (this.status === 'error' && !retry)) return false
    if (!this.dirty) return true
    this.running = (async () => {
      while (this.dirty && !this.conflict) {
        const revision = this.revision
        const document = copy(this.document)
        this.status = 'saving'
        this.emit()
        try {
          const saved = await this.request({ document, version: this.version })
          this.entry = saved
          this.version = saved.version
          if (revision === this.revision) {
            this.dirty = false
            this.status = 'saved'
            this.clear()
          } else this.persist()
          this.emit()
        } catch (error) {
          this.error = error
          this.conflict = error.status === 409 ? error.data?.current : null
          this.status = this.conflict ? 'conflict' : 'error'
          this.persist()
          this.emit()
          break
        }
      }
    })()
    await this.running
    this.running = null
    return !this.dirty
  }
  async resolve(choice) {
    if (!this.conflict) return
    if (this.running) await this.running
    this.entry = this.conflict
    this.version = this.conflict.version
    this.conflict = null
    if (choice === 'server') {
      this.document = validateDiary(this.entry.document)
      this.dirty = false
      this.status = 'saved'
      this.clear()
    } else {
      this.status = 'pending'
      this.persist()
    }
    this.emit()
    if (choice !== 'server') await this.flush(true)
  }
  dispose() {
    clearTimeout(this.timer)
    this.onChange = () => {}
    return this.flush()
  }
}
