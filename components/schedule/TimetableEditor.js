'use client'
// Add or edit a class in the weekly timetable. A new class can go on several days at once;
// an existing one can be copied to other days. Overlaps are allowed but pointed out.
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { Button, Dialog, Input } from '@/components/ui'
import Icon from '@/components/Icon'
import { ACCENTS } from '@/components/accents'
import { api } from '@/lib/client'
import { DAYS, KINDS, fmt, parseTime, breakLabel, overlaps } from './timetable-shape'

const LENGTHS = [15, 30, 60, 90, 120]

export default function TimetableEditor({ value, entries = [], onClose, onSaved }) {
  const { t, notify } = useApp()
  const [draft, setDraft] = useState(null),
    [copyTo, setCopyTo] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!value) return setDraft(null)
    setDraft(
      value.id
        ? { ...value, weekdays: [value.weekday] }
        : { ...value, weekdays: value.weekdays || [1] },
    )
    setCopyTo([])
    setError('')
    setConfirming(false)
  }, [value])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const editingId = draft?.id
  const length = draft ? draft.end_min - draft.start_min : 0
  const clash = useMemo(
    () =>
      draft && length > 0
        ? overlaps(entries, draft.weekdays, draft.start_min, draft.end_min, editingId)
        : [],
    [entries, draft, length, editingId],
  )
  const toggleDay = (n) => {
    if (editingId) return set({ weekdays: [n] })
    const has = draft.weekdays.includes(n)
    const next = has ? draft.weekdays.filter((d) => d !== n) : [...draft.weekdays, n]
    if (next.length) set({ weekdays: next.sort() })
  }

  const body = () => ({
    start_min: draft.start_min,
    end_min: draft.end_min,
    title: draft.title.trim(),
    kind: draft.kind,
    room: draft.room.trim(),
    teacher: (draft.teacher || '').trim(),
    note: draft.note,
    color: draft.color,
  })
  async function submit(e) {
    e.preventDefault()
    if (length <= 0)
      return setError(t('Конец должен быть позже начала', 'The end must be after the start'))
    setBusy(true)
    setError('')
    try {
      if (editingId) {
        await api('/api/timetable/' + editingId, {
          method: 'PATCH',
          body: { ...body(), weekday: draft.weekdays[0] },
        })
        if (copyTo.length)
          await api('/api/timetable', { method: 'POST', body: { ...body(), weekdays: copyTo } })
      } else {
        await api('/api/timetable', {
          method: 'POST',
          body: { ...body(), weekdays: draft.weekdays },
        })
      }
      notify(t('Расписание сохранено', 'Schedule saved'))
      onSaved?.()
      onClose()
    } catch (err) {
      setError(
        err?.code === 'LIMIT_REACHED'
          ? t('Слишком много дел в этот день', 'Too many items on that day')
          : t('Не удалось сохранить', 'Could not save'),
      )
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    setBusy(true)
    try {
      await api('/api/timetable/' + editingId, { method: 'DELETE' })
      notify(t('Дело удалено', 'Item removed'))
      onSaved?.()
      onClose()
    } catch {
      setError(t('Не удалось удалить', 'Could not delete'))
    } finally {
      setBusy(false)
    }
  }

  const timeInput = (field, label) => (
    <label className="field">
      {label}
      <Input
        type="time"
        step={300}
        required
        value={fmt(draft[field])}
        onChange={(e) => {
          const v = parseTime(e.target.value)
          if (v == null) return
          if (field === 'start_min') {
            // moving the start keeps the length, like a calendar
            const len = Math.max(5, draft.end_min - draft.start_min)
            set({ start_min: v, end_min: Math.min(1440, v + len) })
          } else set({ end_min: v === 0 ? 1440 : v })
        }}
      />
    </label>
  )

  return (
    <Dialog
      open={!!value}
      title={editingId ? t('Изменить дело', 'Edit item') : t('Новое дело', 'New item')}
      onClose={() => !busy && onClose()}
    >
      {draft && (
        <form className="stack tt-editor" onSubmit={submit}>
          <label className="field">
            {t('Что делаю', 'What')}
            <Input
              autoFocus={!editingId}
              required
              maxLength={120}
              placeholder={t('Например, Зарядка или Учёба', 'For example, Workout or Study')}
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>

          <fieldset className="field tt-fieldset">
            <legend>{t('Категория', 'Category')}</legend>
            <div className="tt-chips" role="radiogroup" aria-label={t('Категория', 'Category')}>
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.kind === k.value}
                  className={`chip ${draft.kind === k.value ? 'selected' : ''}`}
                  onClick={() => set({ kind: k.value })}
                >
                  {t(k.ru, k.en)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field tt-fieldset">
            <legend>
              {editingId ? t('День', 'Day') : t('Дни (можно несколько)', 'Days (pick several)')}
            </legend>
            <div className="tt-chips tt-day-chips">
              {DAYS.map((d) => (
                <button
                  key={d.n}
                  type="button"
                  aria-pressed={draft.weekdays.includes(d.n)}
                  aria-label={t(d.ruFull, d.enFull)}
                  className={`chip ${draft.weekdays.includes(d.n) ? 'selected' : ''}`}
                  onClick={() => toggleDay(d.n)}
                >
                  {t(d.ru, d.en)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="form-grid tt-times">
            {timeInput('start_min', t('Начало', 'Start'))}
            {timeInput('end_min', t('Конец', 'End'))}
          </div>
          <div className="tt-chips" aria-label={t('Длительность', 'Length')}>
            {LENGTHS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={length === m}
                className={`chip ${length === m ? 'selected' : ''}`}
                onClick={() => set({ end_min: Math.min(1440, draft.start_min + m) })}
              >
                {breakLabel(m, t)}
              </button>
            ))}
          </div>
          {clash.length > 0 && (
            <p className="tt-warn" role="status">
              <Icon name="clock" size={14} />
              {t('Пересекается с: ', 'Overlaps: ')}
              {clash
                .slice(0, 3)
                .map(
                  (c) =>
                    `${c.title} (${t(DAYS[c.weekday - 1].ru, DAYS[c.weekday - 1].en)} ${fmt(c.start_min)})`,
                )
                .join(', ')}
            </p>
          )}

          <label className="field">
            {t('Место', 'Place')}
            <Input
              maxLength={60}
              placeholder={t('Дом, универ, спортзал…', 'Home, university, gym…')}
              value={draft.room}
              onChange={(e) => set({ room: e.target.value })}
            />
          </label>

          <fieldset className="field color-field">
            <legend>{t('Цвет', 'Colour')}</legend>
            <div className="accent-swatches">
              {[['accent', 'Как акцент', 'Accent'], ...ACCENTS].map(([key, ru, en]) => (
                <label
                  key={key}
                  className={`accent-swatch ${key === 'accent' ? 'is-auto' : ''}`}
                  data-accent={key === 'accent' ? undefined : key}
                  title={t(ru, en)}
                >
                  <input
                    type="radio"
                    name="timetable-color"
                    value={key}
                    checked={draft.color === key}
                    onChange={() => set({ color: key })}
                    aria-label={t(ru, en)}
                  />
                  <span className="accent-dot" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            {t('Заметка', 'Note')}
            <textarea
              className="input"
              rows={2}
              maxLength={500}
              placeholder={t('Детали, что взять с собой…', 'Details, what to bring…')}
              value={draft.note}
              onChange={(e) => set({ note: e.target.value })}
            />
          </label>

          {editingId && (
            <fieldset className="field tt-fieldset">
              <legend>{t('Скопировать на другие дни', 'Copy to other days')}</legend>
              <div className="tt-chips tt-day-chips">
                {DAYS.filter((d) => d.n !== draft.weekdays[0]).map((d) => (
                  <button
                    key={d.n}
                    type="button"
                    aria-pressed={copyTo.includes(d.n)}
                    aria-label={t('Копия на ', 'Copy to ') + t(d.ruFull, d.enFull)}
                    className={`chip ${copyTo.includes(d.n) ? 'selected' : ''}`}
                    onClick={() =>
                      setCopyTo((list) =>
                        list.includes(d.n) ? list.filter((x) => x !== d.n) : [...list, d.n].sort(),
                      )
                    }
                  >
                    {t(d.ru, d.en)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {editingId && (
              <Button variant="danger" onClick={() => setConfirming(true)} disabled={busy}>
                {t('Удалить', 'Delete')}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={busy || !draft.title.trim()}>
              {editingId ? t('Сохранить', 'Save') : t('Добавить', 'Add')}
            </Button>
          </div>
          {confirming && (
            <div className="delete-confirm" role="alertdialog">
              <p>
                {t(
                  'Дело исчезнет из расписания на каждой неделе. Удалить?',
                  'The item disappears from every week. Delete it?',
                )}
              </p>
              <div className="dialog-actions">
                <Button onClick={() => setConfirming(false)}>{t('Отмена', 'Cancel')}</Button>
                <Button variant="danger" onClick={remove} disabled={busy}>
                  {t('Удалить дело', 'Delete item')}
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </Dialog>
  )
}
