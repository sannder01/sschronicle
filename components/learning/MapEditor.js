'use client'
// Create or edit a learning map: name, description, topic, colour, where it sits, archive, delete.
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { Button, Dialog, Input, Select } from '@/components/ui'
import { learningApi, errorText, MAP_COLORS } from './shared'

/** Maps as an indented tree, children right after their parent. */
export function mapTree(maps) {
  const byParent = new Map()
  for (const m of maps) {
    const key = m.parent_id ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(m)
  }
  const out = []
  const walk = (parent, depth) => {
    for (const m of byParent.get(parent) || []) {
      out.push({ ...m, depth })
      walk(m.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}
function descendants(maps, id) {
  const set = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const m of maps)
      if (m.parent_id != null && set.has(m.parent_id) && !set.has(m.id)) {
        set.add(m.id)
        grew = true
      }
  }
  return set
}

export default function MapEditor({ value, maps = [], onClose, onSaved, onDeleted }) {
  const { t, notify } = useApp()
  const [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirming, setConfirming] = useState(false)
  useEffect(() => {
    setDraft(
      value
        ? {
            title: '',
            description: '',
            topic: '',
            color: MAP_COLORS[0],
            parent_id: null,
            ...value,
          }
        : null,
    )
    setError('')
    setConfirming(false)
  }, [value])
  const choices = useMemo(() => {
    const blocked = draft?.id ? descendants(maps, draft.id) : new Set()
    return mapTree(maps.filter((m) => !blocked.has(m.id) && !m.archived_at))
  }, [maps, draft?.id])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      title: draft.title,
      description: draft.description,
      topic: draft.topic,
      color: draft.color,
      parent_id: draft.parent_id ?? null,
    }
    try {
      const saved = draft.id
        ? await learningApi.updateMap(draft.id, body)
        : await learningApi.createMap(body)
      notify(t('Карта сохранена', 'Map saved'))
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(errorText(err, t, t('Не удалось сохранить карту', 'Could not save the map')))
    } finally {
      setBusy(false)
    }
  }
  async function archive() {
    setBusy(true)
    try {
      const saved = await learningApi.updateMap(draft.id, { archived: !draft.archived_at })
      notify(
        draft.archived_at
          ? t('Карта возвращена из архива', 'Map restored')
          : t('Карта в архиве', 'Map archived'),
      )
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(errorText(err, t, t('Не удалось изменить карту', 'Could not update the map')))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    setBusy(true)
    try {
      await learningApi.deleteMap(draft.id)
      notify(t('Карта удалена', 'Map deleted'))
      onDeleted?.(draft)
      onClose()
    } catch (err) {
      setError(errorText(err, t, t('Не удалось удалить карту', 'Could not delete the map')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={!!value}
      title={
        draft?.id
          ? t('Настройки карты', 'Map settings')
          : draft?.parent_id
            ? t('Новый раздел', 'New section')
            : t('Новая карта обучения', 'New learning map')
      }
      onClose={() => !busy && onClose()}
    >
      {draft && (
        <form className="stack" onSubmit={submit}>
          <label className="field">
            {t('Название', 'Title')}
            <Input
              autoFocus
              required
              maxLength={120}
              placeholder={t('Например, AITU или Наука', 'For example, University or Science')}
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>
          <label className="field">
            {t('Тема', 'Topic')}
            <Input
              maxLength={80}
              placeholder={t('Математика, физика, языки…', 'Maths, physics, languages…')}
              value={draft.topic}
              onChange={(e) => set({ topic: e.target.value })}
            />
          </label>
          <label className="field">
            {t('Описание', 'Description')}
            <textarea
              className="input lm-textarea"
              maxLength={2000}
              rows={3}
              placeholder={t('Чего хотите достичь', 'What you want to achieve')}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          <fieldset className="field lm-colors">
            <legend>{t('Цвет', 'Colour')}</legend>
            <div>
              {MAP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="lm-swatch"
                  style={{ '--swatch': c }}
                  aria-label={c}
                  aria-pressed={draft.color === c}
                  onClick={() => set({ color: c })}
                />
              ))}
            </div>
          </fieldset>
          <label className="field">
            {t('Внутри карты', 'Inside map')}
            <Select
              value={draft.parent_id ?? ''}
              onChange={(next) => set({ parent_id: next === '' ? null : Number(next) })}
              options={[
                { value: '', label: t('Отдельная карта', 'Standalone map') },
                ...choices.map((m) => ({
                  value: m.id,
                  label: ' '.repeat(m.depth) + m.title,
                })),
              ]}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {draft.id && (
              <Button onClick={archive} disabled={busy}>
                {draft.archived_at ? t('Вернуть из архива', 'Restore') : t('В архив', 'Archive')}
              </Button>
            )}
            {draft.id && (
              <Button variant="danger" onClick={() => setConfirming(true)} disabled={busy}>
                {t('Удалить', 'Delete')}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={busy}>
              {draft.id ? t('Сохранить', 'Save') : t('Создать', 'Create')}
            </Button>
          </div>
          {confirming && (
            <div className="delete-confirm" role="alertdialog">
              <p>
                {t(
                  'Карта удалится вместе со вложенными разделами, темами, связями и материалами. Это нельзя отменить.',
                  'The map is deleted with its sections, topics, links and materials. This cannot be undone.',
                )}
              </p>
              <div className="dialog-actions">
                <Button onClick={() => setConfirming(false)}>{t('Отмена', 'Cancel')}</Button>
                <Button variant="danger" onClick={remove} disabled={busy}>
                  {t('Удалить навсегда', 'Delete forever')}
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </Dialog>
  )
}
