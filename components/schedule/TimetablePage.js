'use client'
// Weekly timetable that repeats every week, like a university class schedule (Mon–Sat).
// Desktop: a week grid (days as columns, time down the side). Phone: day tabs and a list of
// cards with the breaks between them. On top: what is on now and what comes next.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import Icon from '@/components/Icon'
import { api } from '@/lib/client'
import TimetableEditor from './TimetableEditor'
import { DAYS, KINDS, entryLanes, fmt, kindLabel, todayInZone, breakLabel } from './timetable-shape'
import './timetable.css'

const HOUR_PX = 64

function useWide() {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const media = matchMedia('(min-width: 900px)'),
      update = () => setWide(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return wide
}

function EntryText({ entry, t, compact }) {
  return (
    <>
      <span className="tt-entry-time">
        {fmt(entry.start_min)}–{fmt(entry.end_min)}
        {!compact && entry.kind !== 'other' && (
          <span className="tt-kind">{kindLabel(entry.kind, t)}</span>
        )}
      </span>
      <strong className="tt-entry-title">{entry.title}</strong>
      {(entry.room || entry.teacher) && (
        <span className="tt-entry-meta">
          {entry.room && (
            <span>
              <Icon name="pin" size={12} /> {entry.room}
            </span>
          )}
          {entry.teacher && !compact && (
            <span>
              <Icon name="profile" size={12} /> {entry.teacher}
            </span>
          )}
        </span>
      )}
    </>
  )
}

export default function TimetablePage() {
  const { t, settings } = useApp(),
    wide = useWide()
  const [entries, setEntries] = useState(null),
    [error, setError] = useState(null),
    [editing, setEditing] = useState(null),
    [now, setNow] = useState(() => todayInZone(settings?.timezone)),
    [day, setDay] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setEntries(await api('/api/timetable'))
    } catch (err) {
      setError(err)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  // the clock for "now" and "next", in the user's time zone
  useEffect(() => {
    const tick = () => setNow(todayInZone(settings?.timezone))
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [settings?.timezone])
  const selectedDay = day ?? (now.weekday <= 6 ? now.weekday : 1)

  // Sunday shows up only when something is planned on it
  const days = useMemo(
    () => DAYS.filter((d) => d.n <= 6 || entries?.some((e) => e.weekday === 7)),
    [entries],
  )
  const byDay = useMemo(() => {
    const map = new Map(DAYS.map((d) => [d.n, []]))
    for (const e of entries || []) map.get(e.weekday)?.push(e)
    for (const list of map.values()) list.sort((a, b) => a.start_min - b.start_min || a.id - b.id)
    return map
  }, [entries])

  // now / next
  const today = byDay.get(now.weekday) || []
  const current = today.find((e) => e.start_min <= now.minutes && now.minutes < e.end_min)
  const started = today.some((e) => e.start_min <= now.minutes)
  const laterToday = today.find((e) => e.start_min > now.minutes)
  let upcoming = today.find((e) => e.start_min > now.minutes),
    upcomingDay = now.weekday
  if (!upcoming)
    for (let i = 1; i <= 7 && !upcoming; i++) {
      const d = ((now.weekday - 1 + i) % 7) + 1
      upcoming = byDay.get(d)?.[0]
      upcomingDay = d
    }
  const dayName = (n, short) => {
    const d = DAYS.find((x) => x.n === n)
    return short ? t(d.ru, d.en) : t(d.ruFull, d.enFull)
  }

  // week grid range: whole hours around the planned time, at least 8:00–18:00
  const range = useMemo(() => {
    const list = entries || []
    if (!list.length) return { from: 8 * 60, to: 18 * 60 }
    const from = Math.min(...list.map((e) => Math.floor(e.start_min / 60) * 60))
    const to = Math.max(...list.map((e) => Math.ceil(e.end_min / 60) * 60))
    return { from, to: Math.min(1440, Math.max(to, from + 6 * 60)) }
  }, [entries])
  const hours = []
  for (let m = range.from; m < range.to; m += 60) hours.push(m)

  const onSaved = () => load()
  const newEntry = (weekday, start) => {
    const s = start ?? 9 * 60
    setEditing({
      weekdays: [weekday ?? selectedDay],
      start_min: s,
      end_min: Math.min(1440, s + 80),
      title: '',
      kind: 'lecture',
      room: '',
      teacher: '',
      note: '',
      color: 'accent',
    })
  }

  if (error) return <ErrorState error={error} onRetry={load} t={t} />
  if (!entries) return <LoadingState />

  const nowCard = (
    <section className="panel tt-now" aria-live="polite">
      {current ? (
        <div
          className="tt-now-item"
          data-accent={current.color !== 'accent' ? current.color : undefined}
        >
          <span className="eyebrow">{t('Сейчас идёт', 'On now')}</span>
          <strong>{current.title}</strong>
          <span className="muted">
            {[
              current.room && t('ауд. ', 'room ') + current.room,
              t('до ', 'until ') + fmt(current.end_min),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <div
            className="tt-progress"
            role="progressbar"
            aria-label={t('Прошло от пары', 'Class progress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              (100 * (now.minutes - current.start_min)) / (current.end_min - current.start_min),
            )}
          >
            <div
              style={{
                width:
                  (100 * (now.minutes - current.start_min)) /
                    (current.end_min - current.start_min) +
                  '%',
              }}
            />
          </div>
        </div>
      ) : (
        <div className="tt-now-item free">
          <span className="eyebrow">{t('Сейчас', 'Now')}</span>
          <strong>
            {!today.length
              ? t('Свободно', 'Free')
              : !started
                ? t('Пока свободно', 'Free for now')
                : laterToday
                  ? t('Перерыв', 'Break')
                  : t('Пары закончились', 'Classes are over')}
          </strong>
          <span className="muted">
            {!today.length
              ? t('Сегодня занятий нет', 'No classes today')
              : !started
                ? t('Первая пара через ', 'First class in ') +
                  breakLabel(today[0].start_min - now.minutes, t)
                : laterToday
                  ? t('Следующая через ', 'Next in ') +
                    breakLabel(laterToday.start_min - now.minutes, t)
                  : t('На сегодня всё', 'That is all for today')}
          </span>
        </div>
      )}
      <div
        className="tt-now-item next"
        data-accent={upcoming && upcoming.color !== 'accent' ? upcoming.color : undefined}
      >
        <span className="eyebrow">{t('Далее', 'Next')}</span>
        {upcoming ? (
          <>
            <strong>{upcoming.title}</strong>
            <span className="muted">
              {upcomingDay === now.weekday
                ? t('сегодня', 'today')
                : upcomingDay === (now.weekday % 7) + 1
                  ? t('завтра', 'tomorrow')
                  : dayName(upcomingDay)}{' '}
              {t('в', 'at')} {fmt(upcoming.start_min)}
              {upcoming.room ? ' · ' + t('ауд. ', 'room ') + upcoming.room : ''}
              {upcomingDay === now.weekday
                ? ' · ' + t('через ', 'in ') + breakLabel(upcoming.start_min - now.minutes, t)
                : ''}
            </span>
          </>
        ) : (
          <span className="muted">{t('Добавьте первую пару', 'Add your first class')}</span>
        )}
      </div>
    </section>
  )

  return (
    <div className="page tt-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t('Повторяется каждую неделю', 'Repeats every week')}</p>
          <h1>{t('Расписание', 'Schedule')}</h1>
        </div>
        <Button variant="primary" onClick={() => newEntry()}>
          <Icon name="plus" size={18} />
          {t('Добавить пару', 'Add class')}
        </Button>
      </header>

      {nowCard}

      {!entries.length ? (
        <EmptyState
          icon="schedule"
          title={t('Неделя пока пустая', 'The week is empty')}
          description={t(
            'Добавьте пары один раз — расписание будет повторяться каждую неделю. Одну пару можно сразу поставить на несколько дней.',
            'Add your classes once and the timetable repeats every week. One class can go on several days at once.',
          )}
        >
          <Button variant="primary" onClick={() => newEntry(1)}>
            <Icon name="plus" size={18} />
            {t('Добавить первую пару', 'Add the first class')}
          </Button>
        </EmptyState>
      ) : wide ? (
        <div
          className="tt-week"
          style={{ '--cols': days.length }}
          role="grid"
          aria-label={t('Неделя', 'Week')}
        >
          <div className="tt-week-head" role="row">
            <span className="tt-corner" />
            {days.map((d) => (
              <span
                key={d.n}
                role="columnheader"
                className={`tt-day-head ${d.n === now.weekday ? 'today' : ''}`}
              >
                {t(d.ruFull, d.enFull)}
                <small>
                  {byDay.get(d.n).length
                    ? byDay.get(d.n).length + ' ' + t('зан.', 'cl.')
                    : t('свободно', 'free')}
                </small>
              </span>
            ))}
          </div>
          <div className="tt-week-body" style={{ height: hours.length * HOUR_PX }}>
            <div className="tt-hours" aria-hidden="true">
              {hours.map((m) => (
                <span key={m} style={{ top: ((m - range.from) / 60) * HOUR_PX }}>
                  {fmt(m)}
                </span>
              ))}
            </div>
            {days.map((d) => {
              const list = byDay.get(d.n),
                lanes = entryLanes(list)
              return (
                <div
                  key={d.n}
                  role="gridcell"
                  aria-label={t(d.ruFull, d.enFull)}
                  className={`tt-col ${d.n === now.weekday ? 'today' : ''}`}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return
                    const y = e.nativeEvent.offsetY
                    const start = Math.round((range.from + (y / HOUR_PX) * 60) / 10) * 10
                    newEntry(d.n, Math.min(1440 - 50, start))
                  }}
                  style={{ '--hour': HOUR_PX + 'px' }}
                >
                  {list.map((e) => {
                    const lane = lanes.get(e.id)
                    const top = ((e.start_min - range.from) / 60) * HOUR_PX,
                      height = Math.max(26, ((e.end_min - e.start_min) / 60) * HOUR_PX - 3)
                    const live = d.n === now.weekday && e === current
                    return (
                      <button
                        key={e.id}
                        className={`tt-block ${e.kind} ${live ? 'live' : ''} ${height < 56 ? 'short' : ''}`}
                        data-accent={e.color !== 'accent' ? e.color : undefined}
                        style={{
                          top,
                          height,
                          left: `calc(${(100 * lane.index) / lane.count}% + 3px)`,
                          width: `calc(${100 / lane.count}% - 6px)`,
                        }}
                        onClick={() => setEditing(e)}
                        aria-label={`${dayName(d.n)}, ${fmt(e.start_min)}–${fmt(e.end_min)}, ${e.title}${e.room ? ', ' + t('ауд. ', 'room ') + e.room : ''}`}
                      >
                        <EntryText entry={e} t={t} compact={height < 56 || lane.count > 1} />
                      </button>
                    )
                  })}
                  {d.n === now.weekday && now.minutes >= range.from && now.minutes < range.to && (
                    <span
                      className="tt-now-line"
                      style={{ top: ((now.minutes - range.from) / 60) * HOUR_PX }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="tt-tabs" role="tablist" aria-label={t('Дни недели', 'Weekdays')}>
            {days.map((d) => (
              <button
                key={d.n}
                role="tab"
                aria-selected={selectedDay === d.n}
                className={`tt-tab ${selectedDay === d.n ? 'selected' : ''} ${d.n === now.weekday ? 'today' : ''}`}
                onClick={() => setDay(d.n)}
              >
                <span>{t(d.ru, d.en)}</span>
                <small aria-label={t('занятий', 'classes')}>{byDay.get(d.n).length || '–'}</small>
              </button>
            ))}
          </div>
          <section role="tabpanel" aria-label={dayName(selectedDay)} className="tt-day">
            {byDay.get(selectedDay).length ? (
              <ol className="tt-list">
                {byDay.get(selectedDay).map((e, i, list) => {
                  const prev = list[i - 1]
                  const gap = prev ? e.start_min - prev.end_min : 0
                  const live = selectedDay === now.weekday && e === current
                  return (
                    <li key={e.id}>
                      {gap > 0 && (
                        <span className="tt-break">
                          {t('Перерыв ', 'Break ')}
                          {breakLabel(gap, t)}
                        </span>
                      )}
                      {gap < 0 && (
                        <span className="tt-break warn">
                          {t('Пересекается с предыдущей', 'Overlaps the previous one')}
                        </span>
                      )}
                      <button
                        className={`tt-card ${e.kind} ${live ? 'live' : ''}`}
                        data-accent={e.color !== 'accent' ? e.color : undefined}
                        onClick={() => setEditing(e)}
                      >
                        <EntryText entry={e} t={t} />
                      </button>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="tt-free muted">{t('Свободный день', 'A free day')}</p>
            )}
            <Button
              className="tt-add-day"
              onClick={() =>
                newEntry(selectedDay, (byDay.get(selectedDay).at(-1)?.end_min ?? 530) + 10)
              }
            >
              <Icon name="plus" size={16} />
              {t('Пара в этот день', 'Class on this day')}
            </Button>
          </section>
        </>
      )}

      <p className="tt-legend muted">
        {KINDS.map((k) => (
          <span key={k.value} className={`tt-legend-item ${k.value}`}>
            {t(k.ru, k.en)}
          </span>
        ))}
      </p>

      <TimetableEditor
        value={editing}
        entries={entries}
        onClose={() => setEditing(null)}
        onSaved={onSaved}
      />
    </div>
  )
}
