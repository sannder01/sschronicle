'use client'
// Daily routine that repeats every week (Mon–Sat, Sunday when used): wake up, workout, study…
// Desktop: a week grid (days as columns, time down the side). Phone: day tabs and a list of
// cards with the free time between them. On top: what is on now, what comes next, and how much
// of today is done. Today's items can be ticked off; ticks are kept per date.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import Icon from '@/components/Icon'
import { api } from '@/lib/client'
import { todayInZone as dateInZone } from '@/lib/dates'
import TimetableEditor from './TimetableEditor'
import { DAYS, entryLanes, fmt, kindLabel, todayInZone, breakLabel } from './timetable-shape'
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
      {entry.room && !compact && (
        <span className="tt-entry-meta">
          <span>
            <Icon name="pin" size={12} /> {entry.room}
          </span>
        </span>
      )}
    </>
  )
}

function DoneButton({ entry, done, onToggle, t }) {
  return (
    <button
      className="tt-check"
      aria-pressed={done}
      aria-label={
        done
          ? t('Снять отметку: ', 'Unmark: ') + entry.title
          : t('Отметить сделанным: ', 'Mark done: ') + entry.title
      }
      onClick={(e) => {
        e.stopPropagation()
        onToggle(entry)
      }}
    >
      <Icon name="check" size={13} />
    </button>
  )
}

export default function TimetablePage() {
  const { t, settings, notify } = useApp(),
    wide = useWide()
  const zone = settings?.timezone || 'UTC'
  const [entries, setEntries] = useState(null),
    [error, setError] = useState(null),
    [editing, setEditing] = useState(null),
    [now, setNow] = useState(() => todayInZone(zone)),
    [date, setDate] = useState(() => dateInZone(zone)),
    [done, setDone] = useState(() => new Set()),
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
  // the clock for "now" and "next", in the user's time zone; a new date reloads the ticks
  useEffect(() => {
    const tick = () => {
      setNow(todayInZone(zone))
      setDate(dateInZone(zone))
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [zone])
  useEffect(() => {
    let alive = true
    api('/api/timetable/done?day=' + date)
      .then((r) => alive && setDone(new Set(r.entry_ids)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [date])
  const selectedDay = day ?? (now.weekday <= 6 ? now.weekday : 1)

  async function toggleDone(entry) {
    const next = !done.has(entry.id)
    const flip = (on) =>
      setDone((set) => {
        const copy = new Set(set)
        on ? copy.add(entry.id) : copy.delete(entry.id)
        return copy
      })
    flip(next)
    try {
      await api(`/api/timetable/${entry.id}/done`, {
        method: 'PUT',
        body: { day: date, done: next },
      })
    } catch {
      flip(!next)
      notify(t('Не удалось сохранить отметку', 'Could not save the mark'), 'error')
    }
  }

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

  // now / next / today's progress
  const today = byDay.get(now.weekday) || []
  const current = today.find((e) => e.start_min <= now.minutes && now.minutes < e.end_min)
  const started = today.some((e) => e.start_min <= now.minutes)
  const laterToday = today.find((e) => e.start_min > now.minutes)
  const doneToday = today.filter((e) => done.has(e.id)).length
  let upcoming = laterToday,
    upcomingDay = now.weekday
  if (!upcoming)
    for (let i = 1; i <= 7 && !upcoming; i++) {
      const d = ((now.weekday - 1 + i) % 7) + 1
      upcoming = byDay.get(d)?.[0]
      upcomingDay = d
    }
  const dayName = (n) => {
    const d = DAYS.find((x) => x.n === n)
    return t(d.ruFull, d.enFull)
  }

  // week grid range: the hours actually used (at least six), 8:00–18:00 for an empty week
  const range = useMemo(() => {
    const list = entries || []
    if (!list.length) return { from: 8 * 60, to: 18 * 60 }
    const from = Math.min(...list.map((e) => Math.floor(e.start_min / 60) * 60))
    const to = Math.max(...list.map((e) => Math.ceil(e.end_min / 60) * 60))
    return { from, to: Math.min(1440, Math.max(to, from + 6 * 60)) }
  }, [entries])
  const hours = []
  for (let m = range.from; m < range.to; m += 60) hours.push(m)

  const newEntry = (weekday, start) => {
    const s = start ?? 9 * 60
    setEditing({
      weekdays: [weekday ?? selectedDay],
      start_min: s,
      end_min: Math.min(1440, s + 60),
      title: '',
      kind: 'other',
      room: '',
      teacher: '',
      note: '',
      color: 'accent',
    })
  }

  if (error) return <ErrorState error={error} onRetry={load} t={t} />
  if (!entries) return <LoadingState />

  const percent = (part, whole) => Math.round((100 * part) / Math.max(1, whole))
  const nowCard = (
    <section className="panel tt-now" aria-live="polite">
      {current ? (
        <div
          className="tt-now-item"
          data-accent={current.color !== 'accent' ? current.color : undefined}
        >
          <span className="eyebrow">{t('Сейчас', 'Now')}</span>
          <strong>{current.title}</strong>
          <span className="muted">
            {[current.room, t('до ', 'until ') + fmt(current.end_min)].filter(Boolean).join(' · ')}
          </span>
          <div
            className="tt-progress"
            role="progressbar"
            aria-label={t('Прошло времени', 'Time passed')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent(
              now.minutes - current.start_min,
              current.end_min - current.start_min,
            )}
          >
            <div
              style={{
                width:
                  percent(now.minutes - current.start_min, current.end_min - current.start_min) +
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
              ? t('Свободный день', 'A free day')
              : !started
                ? t('Пока свободно', 'Free for now')
                : laterToday
                  ? t('Свободное время', 'Free time')
                  : t('На сегодня всё', 'That is all for today')}
          </strong>
          <span className="muted">
            {!today.length
              ? t('На сегодня ничего не запланировано', 'Nothing planned for today')
              : !started
                ? t('Первое дело через ', 'First item in ') +
                  breakLabel(today[0].start_min - now.minutes, t)
                : laterToday
                  ? t('Следующее через ', 'Next in ') +
                    breakLabel(laterToday.start_min - now.minutes, t)
                  : t('Можно отдыхать', 'Time to rest')}
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
              {upcomingDay === now.weekday
                ? ' · ' + t('через ', 'in ') + breakLabel(upcoming.start_min - now.minutes, t)
                : ''}
            </span>
          </>
        ) : (
          <span className="muted">{t('Добавьте первое дело', 'Add your first item')}</span>
        )}
      </div>
      {today.length > 0 && (
        <div className="tt-today-done">
          <span>
            {t('Сегодня сделано', 'Done today')}{' '}
            <b>
              {doneToday} {t('из', 'of')} {today.length}
            </b>
          </span>
          <div
            className="tt-progress"
            role="progressbar"
            aria-label={t('Сделано сегодня', 'Done today')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent(doneToday, today.length)}
          >
            <div style={{ width: percent(doneToday, today.length) + '%' }} />
          </div>
        </div>
      )}
    </section>
  )

  return (
    <div className="page tt-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {t(
              'Распорядок, который повторяется каждую неделю',
              'A routine that repeats every week',
            )}
          </p>
          <h1>{t('Расписание дня', 'Daily schedule')}</h1>
        </div>
        <Button variant="primary" onClick={() => newEntry()}>
          <Icon name="plus" size={18} />
          {t('Добавить дело', 'Add item')}
        </Button>
      </header>

      {nowCard}

      {!entries.length ? (
        <EmptyState
          icon="schedule"
          title={t('Распорядок пока пустой', 'Your routine is empty')}
          description={t(
            'Заполните свой день один раз — подъём, зарядка, учёба, работа, спорт, отдых — и расписание будет повторяться каждую неделю. Одно дело можно сразу поставить на несколько дней.',
            'Fill in your day once (wake up, workout, study, work, sport, rest) and it repeats every week. One item can go on several days at once.',
          )}
        >
          <Button variant="primary" onClick={() => newEntry(selectedDay, 7 * 60)}>
            <Icon name="plus" size={18} />
            {t('Добавить первое дело', 'Add the first item')}
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
                  {d.n === now.weekday && byDay.get(d.n).length
                    ? t('сегодня · ', 'today · ') + doneToday + '/' + byDay.get(d.n).length
                    : byDay.get(d.n).length
                      ? byDay.get(d.n).length + ' ' + t('дел', 'items')
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
                lanes = entryLanes(list),
                isToday = d.n === now.weekday
              return (
                <div
                  key={d.n}
                  role="gridcell"
                  aria-label={t(d.ruFull, d.enFull)}
                  className={`tt-col ${isToday ? 'today' : ''}`}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return
                    const y = e.nativeEvent.offsetY
                    const start = Math.round((range.from + (y / HOUR_PX) * 60) / 10) * 10
                    newEntry(d.n, Math.min(1440 - 60, start))
                  }}
                  style={{ '--hour': HOUR_PX + 'px' }}
                >
                  {list.map((e) => {
                    const lane = lanes.get(e.id)
                    const top = ((e.start_min - range.from) / 60) * HOUR_PX,
                      height = Math.max(26, ((e.end_min - e.start_min) / 60) * HOUR_PX - 3)
                    const live = isToday && e === current,
                      ticked = isToday && done.has(e.id)
                    return (
                      <div
                        key={e.id}
                        className={`tt-block ${e.kind} ${live ? 'live' : ''} ${ticked ? 'done' : ''} ${height < 56 ? 'short' : ''}`}
                        data-accent={e.color !== 'accent' ? e.color : undefined}
                        style={{
                          top,
                          height,
                          left: `calc(${(100 * lane.index) / lane.count}% + 3px)`,
                          width: `calc(${100 / lane.count}% - 6px)`,
                        }}
                      >
                        <button
                          className="tt-block-body"
                          onClick={() => setEditing(e)}
                          aria-label={`${dayName(d.n)}, ${fmt(e.start_min)}–${fmt(e.end_min)}, ${e.title}${e.room ? ', ' + e.room : ''}${ticked ? ', ' + t('сделано', 'done') : ''}`}
                        >
                          <EntryText entry={e} t={t} compact={height < 56 || lane.count > 1} />
                        </button>
                        {isToday && (
                          <DoneButton entry={e} done={ticked} onToggle={toggleDone} t={t} />
                        )}
                      </div>
                    )
                  })}
                  {isToday && now.minutes >= range.from && now.minutes < range.to && (
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
                <small aria-label={t('дел', 'items')}>{byDay.get(d.n).length || '–'}</small>
              </button>
            ))}
          </div>
          <section role="tabpanel" aria-label={dayName(selectedDay)} className="tt-day">
            {byDay.get(selectedDay).length ? (
              <ol className="tt-list">
                {byDay.get(selectedDay).map((e, i, list) => {
                  const prev = list[i - 1]
                  const gap = prev ? e.start_min - prev.end_min : 0
                  const isToday = selectedDay === now.weekday
                  const live = isToday && e === current,
                    ticked = isToday && done.has(e.id)
                  return (
                    <li key={e.id}>
                      {gap > 0 && (
                        <span className="tt-break">
                          {t('Свободно ', 'Free ')}
                          {breakLabel(gap, t)}
                        </span>
                      )}
                      {gap < 0 && (
                        <span className="tt-break warn">
                          {t('Пересекается с предыдущим', 'Overlaps the previous one')}
                        </span>
                      )}
                      <div
                        className={`tt-card ${e.kind} ${live ? 'live' : ''} ${ticked ? 'done' : ''}`}
                        data-accent={e.color !== 'accent' ? e.color : undefined}
                      >
                        <button className="tt-card-body" onClick={() => setEditing(e)}>
                          <EntryText entry={e} t={t} />
                        </button>
                        {isToday && (
                          <DoneButton entry={e} done={ticked} onToggle={toggleDone} t={t} />
                        )}
                      </div>
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
                newEntry(selectedDay, (byDay.get(selectedDay).at(-1)?.end_min ?? 410) + 10)
              }
            >
              <Icon name="plus" size={16} />
              {t('Дело в этот день', 'Item on this day')}
            </Button>
          </section>
        </>
      )}

      <TimetableEditor
        value={editing}
        entries={entries}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </div>
  )
}
