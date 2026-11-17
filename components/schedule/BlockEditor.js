'use client'
import { useEffect, useState } from 'react'
import { Button, Dialog, Input } from '@/components/ui'
import Icon from '@/components/Icon'
import { ACCENTS } from '@/components/accents'
import { fmt, parseTime, durationLabel, DAY } from './time'

export default function BlockEditor({ value, t, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  useEffect(() => {
    if (value) {
      setDraft(value)
      setError('')
    }
  }, [value])
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const start = parseTime(draft?.start),
    end = draft?.end === '00:00' ? DAY : parseTime(draft?.end)
  function setLength(min) {
    if (start == null) return
    set({ end: fmt(Math.min(start + min, DAY)).replace('24:00', '00:00') })
  }
  function submit(e) {
    e.preventDefault()
    if (!draft.title.trim()) return setError(t('Введите название', 'Enter a title'))
    if (start == null || end == null || end <= start)
      return setError(t('Конец должен быть позже начала', 'The end must be after the start'))
    onSave(draft)
  }
  return (
    <Dialog
      open={Boolean(value)}
      title={
        value?.id == null ? t('Новый блок', 'New block') : t('Блок расписания', 'Schedule block')
      }
      onClose={onClose}
    >
      {draft && (
        <form className="stack block-editor" onSubmit={submit} noValidate>
          <label className="field">
            {t('Название', 'Title')}
            <Input
              autoFocus
              maxLength={120}
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={t('Например, «Пара по матанализу»', 'e.g. “Deep work”')}
              aria-invalid={Boolean(error) && !draft.title.trim()}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              {t('Начало', 'Start')}
              <Input
                type="time"
                step={300}
                value={draft.start}
                onChange={(e) => set({ start: e.target.value })}
              />
            </label>
            <label className="field">
              {t('Конец', 'End')}
              <Input
                type="time"
                step={300}
                value={draft.end}
                onChange={(e) => set({ end: e.target.value })}
              />
            </label>
          </div>
          <div className="length-chips" role="group" aria-label={t('Длительность', 'Length')}>
            {[15, 30, 45, 60, 90, 120].map((min) => (
              <button
                type="button"
                key={min}
                className={`chip ${start != null && end - start === min ? 'selected' : ''}`}
                onClick={() => setLength(min)}
              >
                {durationLabel(min, t)}
              </button>
            ))}
          </div>
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
                    name="block-color"
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
              rows={3}
              maxLength={1000}
              value={draft.note}
              onChange={(e) => set({ note: e.target.value })}
            />
          </label>
          {draft.id != null && (
            <label className="setting-row block-done-row">
              <span>{t('Выполнено', 'Done')}</span>
              <input
                type="checkbox"
                checked={draft.done}
                onChange={(e) => set({ done: e.target.checked })}
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="row dialog-actions">
            {draft.id != null && (
              <Button variant="danger" onClick={() => onDelete(draft.original)}>
                <Icon name="trash" size={16} />
                {t('Удалить', 'Delete')}
              </Button>
            )}
            <span style={{ flex: 1 }} />
            <Button onClick={onClose}>{t('Отмена', 'Cancel')}</Button>
            <Button variant="primary" type="submit">
              {t('Сохранить', 'Save')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
