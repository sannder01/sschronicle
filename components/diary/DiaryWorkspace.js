'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/components/AppContext'
import { Button, ErrorState, LoadingState } from '@/components/ui'
import Icon from '@/components/Icon'
import { api } from '@/lib/client'
import { addDays, displayDate, todayInZone } from '@/lib/dates'
import { CARD_COLORS, LIMITS, MOODS, PAPERS, validDiaryDate } from '@/lib/diary/format.mjs'
import { DiaryWriter } from '@/lib/diary/autosave.mjs'
import DiaryDrawing from './DiaryDrawing'
import DiaryPhotos from './DiaryPhotos'
import './diary.css'

const moodSymbols = ['☀', '☁', '✧', '☾']
const moodLabels = (t) => [t('Радостно', 'Happy'), t('Спокойно', 'Calm'), t('Вдохновение', 'Inspired'), t('Усталость', 'Tired')]

function DiaryEntry({ day, userId, language, t, onSaved }) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const writer = useRef(null)
  const textRef = useRef(null)
  const cardsRef = useRef(null)
  useEffect(() => {
    let active = true
    let instance
    setError(null)
    setState(null)
    api(`/api/diary/${day}`).then((entry) => {
      if (!active) return
      let storage
      try { storage = window.sessionStorage } catch { /* In-memory editing still works. */ }
      instance = new DiaryWriter({ entry, userId, storage,
        request: async (body) => {
          const saved = await api(`/api/diary/${day}`, { method: 'PUT', body })
          onSaved({ entry_date: day, version: saved.version, preview: saved.document.text.slice(0, 120), mood: saved.document.mood })
          return saved
        },
        onChange: (snapshot) => {
          if (!active) return
          setState(snapshot)
        },
      })
      writer.current = instance
      setState(instance.snapshot())
    }).catch((err) => { if (active) setError(err) })
    const unload = (event) => {
      if (!writer.current?.dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    const flush = () => writer.current?.flush()
    const online = () => writer.current?.flush(true)
    const hidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('beforeunload', unload)
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      active = false
      window.removeEventListener('beforeunload', unload)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', hidden)
      instance?.dispose()
      writer.current = null
    }
  }, [day, userId, attempt, onSaved])

  useEffect(() => {
    const textarea = textRef.current
    if (textarea) { textarea.style.height = 'auto'; textarea.style.height = `${Math.max(280, textarea.scrollHeight)}px` }
  }, [state?.document.text])

  if (error) return <ErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} t={t} />
  if (!state) return <LoadingState label={t('Открываем страницу…', 'Opening your page…')} />
  const doc = state.document
  const update = (patch) => writer.current.update(patch)
  const updateCard = (id, patch) => update({ cards: doc.cards.map((card) => card.id === id ? { ...card, ...patch } : card) })
  const addCard = () => {
    if (doc.cards.length >= LIMITS.cards) return
    update({ cards: [...doc.cards, { id: crypto.randomUUID(), text: '', color: CARD_COLORS[doc.cards.length % CARD_COLORS.length] }] })
    requestAnimationFrame(() => cardsRef.current?.querySelector('.diary-card:last-child textarea')?.focus())
  }
  const status = state.status === 'saved' ? (state.version ? t('Все изменения сохранены', 'All changes saved') : t('Новая страница', 'A fresh page'))
    : state.status === 'saving' ? t('Сохраняем…', 'Saving…')
    : state.status === 'error' ? t('Не удалось сохранить', 'Could not save')
    : state.conflict ? t('Нужно выбрать версию', 'Choose a version') : t('Есть изменения…', 'Unsaved changes…')
  return (
    <div className="diary-entry">
      <div className="diary-page-tools">
        <div className="diary-paper-options" role="group" aria-label={t('Бумага', 'Paper')}>
          {PAPERS.map((paper, i) => <button key={paper} type="button" aria-pressed={doc.paper === paper} onClick={() => update({ paper })}>{[t('Линии', 'Lines'), t('Клетка', 'Grid'), t('Чистый лист', 'Plain')][i]}</button>)}
        </div>
        <span className={`diary-save-state ${state.status}`} role="status"><span />{status}</span>
      </div>
      {state.status === 'error' && <div className="diary-alert" role="alert"><p>{writer.current?.error?.status === 401 ? t('Сессия истекла. Войдите снова, чтобы сохранить страницу.', 'Your session expired. Sign in again to save this page.') : t('Проверьте подключение. Изменения пока не сохранены в аккаунте.', 'Check your connection. Changes have not been saved to your account yet.')}</p><Button onClick={() => writer.current.flush(true)}>{t('Повторить сохранение', 'Retry saving')}</Button></div>}
      {state.conflict && <div className="diary-alert" role="alert">
        <div><strong>{state.status === 'recovered' ? t('На устройстве есть черновик', 'There is a draft on this device') : t('Страница изменилась в другом окне', 'This page changed in another window')}</strong>
          <p>{t('Сейчас показан ваш текст. Выберите, какую страницу сохранить.', 'Your text is shown below. Choose which page to keep.')}</p>
          {state.conflict.document.text && <blockquote>{state.conflict.document.text.slice(0, 240)}</blockquote>}
        </div>
        <div className="diary-dialog-actions"><Button onClick={() => writer.current.resolve('server')}>{t('Открыть сохранённую', 'Use saved page')}</Button><Button variant="primary" onClick={() => writer.current.resolve('local')}>{t('Сохранить мой вариант', 'Keep my version')}</Button></div>
      </div>}
      {state.dirty && <p className="diary-tool-hint" role="status">{state.storageError ? t('Черновик недоступен. Не закрывайте вкладку до сохранения.', 'Draft storage is unavailable. Keep this tab open until saved.') : t('Несохранённые изменения хранятся в черновике этой вкладки.', 'Unsaved changes are kept in a draft in this tab.')}</p>}
      <article className={`diary-paper diary-paper-${doc.paper}`}>
        <span className="diary-binding" aria-hidden="true"><i /><i /><i /></span>
        <header className="diary-sheet-header"><span className="diary-kicker">{t('ОДИН ДЕНЬ. ВАША ИСТОРИЯ.', 'ONE DAY. YOUR STORY.')}</span>
          <h2>{displayDate(day, language, { day: 'numeric', month: 'long' })}<span className="diary-date-year">{day.slice(0, 4)}</span></h2>
          <p>{displayDate(day, language, { weekday: 'long', day: undefined, month: undefined })}</p>
        </header>
        <div className="diary-moods" role="group" aria-label={t('Настроение дня', 'Today’s mood')}>
          <span>{t('Как вы сегодня?', 'How are you today?')}</span>
          <div>{MOODS.map((mood, i) => <button type="button" key={mood} title={moodLabels(t)[i]} aria-label={moodLabels(t)[i]} aria-pressed={doc.mood === mood} onClick={() => update({ mood: doc.mood === mood ? null : mood })}><b aria-hidden="true">{moodSymbols[i]}</b><span>{moodLabels(t)[i]}</span></button>)}</div>
        </div>
        <section className="diary-writing">
          <label className="diary-kicker" htmlFor="diary-text">01 / {t('МЫСЛИ НА БУМАГЕ', 'THOUGHTS ON PAPER')}</label>
          <textarea ref={textRef} id="diary-text" aria-label={t('Запись в дневнике', 'Diary entry')} placeholder={t('Что хочется запомнить об этом дне?\nНачните с одной мысли…', 'What would you like to remember about this day?\nStart with a single thought…')} value={doc.text} maxLength={LIMITS.text} onChange={(e) => update({ text: e.target.value })} />
          {doc.text.length > LIMITS.text - 1000 && <small className="diary-tool-hint">{doc.text.length} / {LIMITS.text}</small>}
        </section>
        <section className="diary-memories" aria-label={t('Маленькие заметки', 'Little notes')}>
          <div className="diary-section-heading"><div><span className="diary-kicker">02 / {t('ВАЖНЫЕ МЕЛОЧИ', 'LITTLE THINGS')}</span><h3>{t('Мысли на полях', 'Notes in the margins')}</h3></div>
            <Button onClick={addCard} disabled={doc.cards.length >= LIMITS.cards}><Icon name="plus" size={16} />{t('Заметка', 'Note')}</Button>
          </div>
          <div className="diary-cards" ref={cardsRef}>
            {doc.cards.map((card, index) => <div key={card.id} className={`diary-card diary-card-${card.color}`}>
              <div className="diary-card-header"><span>{String(index + 1).padStart(2, '0')}</span><Button variant="ghost" aria-label={t(`Удалить заметку ${index + 1}`, `Delete note ${index + 1}`)} onClick={() => update({ cards: doc.cards.filter((item) => item.id !== card.id) })}><Icon name="close" size={15} /></Button></div>
              <textarea aria-label={t(`Маленькая заметка ${index + 1}`, `Little note ${index + 1}`)} value={card.text} placeholder={t('Мысль, идея или маленькая радость…', 'A thought, an idea, a small joy…')} maxLength={LIMITS.cardText} onChange={(e) => updateCard(card.id, { text: e.target.value })} />
              <div className="diary-card-colors" role="group" aria-label={t(`Цвет заметки ${index + 1}`, `Note ${index + 1} color`)}>{CARD_COLORS.map((color, i) => <button key={color} type="button" className={`diary-card-color diary-card-${color}`} aria-label={[t('Песочный', 'Sand'), t('Шалфей', 'Sage'), t('Розовый', 'Rose'), t('Лаванда', 'Lavender')][i]} aria-pressed={card.color === color} onClick={() => updateCard(card.id, { color })} />)}</div>
            </div>)}
            {!doc.cards.length && <button type="button" className="diary-add-card" onClick={addCard}><Icon name="plus" size={24} /><span>{t('Сохранить маленькую мысль', 'Keep a little thought')}</span></button>}
          </div>
        </section>
        <DiaryDrawing strokes={doc.strokes} onChange={(strokes) => update({ strokes })} t={t} />
        <DiaryPhotos photos={doc.photos || []} t={t} onAdd={(photo) => {
          const current = writer.current
          if (!current) return false
          const photos = current.document.photos || []
          if (photos.length >= LIMITS.photos) return false
          current.update({ photos: [...photos, photo] })
          return true
        }} onRemove={(id) => {
          const current = writer.current
          if (current) current.update({ photos: (current.document.photos || []).filter((photo) => photo.id !== id) })
        }} />
        <footer className="diary-sheet-footer"><span>CHRONICLE / {t('ЛИЧНОЕ', 'PERSONAL')}</span><span>{t('В своём ритме.', 'At your own pace.')}</span></footer>
      </article>
    </div>
  )
}

export default function DiaryWorkspace() {
  const { user, settings, language, t } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const today = todayInZone(settings.timezone || 'UTC')
  const requested = params.get('day')
  const day = validDiaryDate(requested) ? requested : today
  const [entries, setEntries] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const generation = useRef(0)
  const load = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    try { const rows = await api('/api/diary'); if (generation.current === current) {
      setEntries((previous) => {
        const merged = new Map(rows.map((row) => [row.entry_date, row]))
        for (const row of previous) if (!merged.has(row.entry_date) || merged.get(row.entry_date).version <= row.version) merged.set(row.entry_date, row)
        return [...merged.values()].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      })
      setError(null)
    } }
    catch (err) { if (generation.current === current) setError(err) }
    finally { if (generation.current === current) setLoading(false) }
  }, [])
  useEffect(() => { load(); return () => { generation.current++ } }, [load])
  const saved = useCallback((entry) => {
    setEntries((rows) => [entry, ...rows.filter((row) => row.entry_date !== entry.entry_date)].sort((a, b) => b.entry_date.localeCompare(a.entry_date)))
  }, [])
  const select = (value) => { if (validDiaryDate(value)) router.push(`/app/diary?day=${value}`, { scroll: false }) }
  return (
    <div className="diary-workspace">
      <header className="page-header diary-header"><div><div className="eyebrow">{t('ПРОСТРАНСТВО ДЛЯ СЕБЯ', 'A SPACE FOR YOURSELF')}</div><h1>{t('Дневник', 'Diary')}<span className="diary-title-dot">.</span></h1><p className="page-subtitle">{t('Мысли, маленькие радости и всё, что хочется оставить на бумаге.', 'Thoughts, small joys, and everything you want to put on paper.')}</p></div><Button onClick={() => select(today)}><Icon name="plus" size={17} />{t('Сегодняшняя страница', 'Today’s page')}</Button></header>
      <div className="diary-layout">
        <aside className="diary-archive" aria-label={t('Страницы дневника', 'Diary pages')}>
          <div className="diary-archive-title"><Icon name="diary" size={19} /><h2>{t('Мои страницы', 'My pages')}</h2><span>{entries.length}</span></div>
          <label className="diary-date-label" htmlFor="diary-date">{t('Открыть дату', 'Open a date')}</label>
          <input id="diary-date" className="input diary-date-input" type="date" min="0001-01-01" max="9999-12-31" value={day} onChange={(e) => select(e.target.value)} />
          <div className="diary-day-step"><Button variant="ghost" aria-label={t('Предыдущий день', 'Previous day')} disabled={day === '0001-01-01'} onClick={() => select(addDays(day, -1))}><Icon name="back" size={17} /></Button><button type="button" onClick={() => select(today)}>{t('Сегодня', 'Today')}</button><Button variant="ghost" aria-label={t('Следующий день', 'Next day')} disabled={day === '9999-12-31'} onClick={() => select(addDays(day, 1))}><Icon name="chevron" size={17} /></Button></div>
          {error ? <ErrorState error={error} onRetry={load} t={t} /> : loading ? <LoadingState label={t('Загрузка…', 'Loading…')} /> : <div className="diary-page-list">
            {entries.length ? entries.map((entry) => <button type="button" key={entry.entry_date} aria-current={entry.entry_date === day ? 'date' : undefined} className={`diary-page-link ${entry.entry_date === day ? 'active' : ''}`} onClick={() => select(entry.entry_date)}><span className="diary-page-link-top"><strong>{displayDate(entry.entry_date, language, { year: 'numeric' })}</strong><span aria-hidden="true">{moodSymbols[MOODS.indexOf(entry.mood)] || '·'}</span></span><span className="diary-page-preview">{entry.preview || t('Маленькая часть вашей истории', 'A little piece of your story')}</span></button>) : <div className="diary-archive-empty"><span aria-hidden="true">✧</span><p>{t('Здесь будут ваши дни.', 'Your days will live here.')}<br />{t('Первая страница уже ждёт.', 'Your first page is ready.')}</p></div>}
          </div>}
          <p className="diary-archive-note">{t('Не обязательно писать много. Иногда достаточно одной строки.', 'You don’t have to write much. Sometimes one line is enough.')}</p>
        </aside>
        <DiaryEntry key={`${user.id}:${day}`} day={day} userId={user.id} language={language} t={t} onSaved={saved} />
      </div>
    </div>
  )
}
