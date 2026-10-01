'use client'
import { useState } from 'react'
import { useApp } from '@/components/AppContext'
import { Button, Dialog, Input } from '@/components/ui'
import { todayInZone } from '@/lib/dates'

export const CHALLENGE_COLORS = ['#007aff', '#34a853', '#af52de', '#ff9500', '#e34d59', '#008b8b']
const icons = ['🌱', '🍎', '📚', '🚶', '💧', '🧘', '🌙', '🎯']

export default function ChallengeForm({ initial, onClose, onSave, busy }) {
  const { t, settings } = useApp()
  const [form, setForm] = useState({
    title: '',
    description: '',
    icon: '🌱',
    color: '#34a853',
    start_date: todayInZone(settings?.timezone || 'UTC'),
    duration: 30,
    ...initial,
  })
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }))
  const locked = Boolean(initial?.id && initial?.period_locked)
  return (
    <Dialog
      open
      title={
        initial?.id
          ? t('Изменить челлендж', 'Edit challenge')
          : t('Новый челлендж', 'New challenge')
      }
      onClose={busy ? undefined : onClose}
    >
      <form
        className="stack tracking-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(form)
        }}
      >
        <label className="field">
          {t('Название', 'Name')}
          <Input
            required
            autoFocus
            maxLength={160}
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder={t('30 дней без сладкого', '30 days without sugar')}
          />
        </label>
        <label className="field">
          {t('Правило', 'Your rule')}
          <textarea
            className="input"
            rows={3}
            maxLength={4000}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder={t('Что означает успешный день?', 'What makes a successful day?')}
          />
        </label>
        <div className="tracking-form-grid">
          <label className="field">
            {t('Дата начала', 'Start date')}
            <Input
              type="date"
              required
              min="1900-01-01"
              max="9998-12-31"
              value={form.start_date}
              disabled={locked}
              onChange={(event) => set('start_date', event.target.value)}
            />
          </label>
          <label className="field">
            {t('Дней', 'Days')}
            <Input
              type="number"
              min={1}
              max={366}
              required
              disabled={locked}
              value={form.duration}
              onChange={(event) => set('duration', Number(event.target.value))}
            />
          </label>
        </div>
        {locked && (
          <p className="muted tracking-caption">
            {t(
              'Период начавшейся попытки сохранён. Для нового периода используйте повторный запуск.',
              'The current attempt keeps its original period. Restart to choose a new period.',
            )}
          </p>
        )}
        <fieldset className="tracking-fieldset">
          <legend>{t('Иконка', 'Icon')}</legend>
          <div className="tracking-swatches">
            {icons.map((icon) => (
              <button
                type="button"
                key={icon}
                className={`tracking-icon-choice ${form.icon === icon ? 'selected' : ''}`}
                aria-pressed={form.icon === icon}
                aria-label={icon}
                onClick={() => set('icon', icon)}
              >
                {icon}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="tracking-fieldset">
          <legend>{t('Цвет', 'Color')}</legend>
          <div className="tracking-swatches">
            {CHALLENGE_COLORS.map((color, index) => (
              <button
                type="button"
                key={color}
                className={`tracking-swatch ${form.color === color ? 'selected' : ''}`}
                aria-pressed={form.color === color}
                aria-label={`${t('Цвет', 'Color')} ${index + 1}`}
                style={{ '--item-color': color }}
                onClick={() => set('color', color)}
              />
            ))}
          </div>
        </fieldset>
        <div className="tracking-dialog-actions">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            {t('Отмена', 'Cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={busy || !form.title.trim()}>
            {busy ? t('Сохранение…', 'Saving…') : t('Сохранить', 'Save')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
