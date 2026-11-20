'use client'
// /app/learning: overall progress across all maps, what to do next, and the list of maps.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/AppContext'
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import Icon from '@/components/Icon'
import MapEditor from './MapEditor'
import { learningApi, ProgressBar, ProgressRing, statusLabel } from './shared'
import './learning.css'

export function MapCard({ map, t, sections }) {
  const s = map.stats || {}
  return (
    <Link href={'/app/learning/' + map.id} className="panel lm-card" style={{ '--map': map.color }}>
      <span className="lm-card-top">
        <span className="lm-card-dot" aria-hidden="true" />
        {map.topic && <span className="lm-chip">{map.topic}</span>}
        {map.archived_at && <span className="lm-chip">{t('Архив', 'Archived')}</span>}
      </span>
      <strong className="lm-card-title">{map.title}</strong>
      {map.description && <span className="lm-card-desc">{map.description}</span>}
      <span className="lm-card-progress">
        <ProgressBar value={s.percent} label={t('Освоено', 'Mastered') + ' ' + map.title} small />
        <span className="lm-card-numbers">
          <b>{s.percent || 0}%</b>
          <span>
            {s.mastered || 0}/{s.nodes || 0} {t('освоено', 'mastered')}
            {sections ? ' · ' + sections + ' ' + t('разд.', 'sect.') : ''}
          </span>
        </span>
      </span>
    </Link>
  )
}

export default function LearningHome() {
  const { t } = useApp(),
    router = useRouter()
  const [maps, setMaps] = useState(null),
    [summary, setSummary] = useState(null),
    [error, setError] = useState(null),
    [editing, setEditing] = useState(null),
    [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [list, sum] = await Promise.all([learningApi.maps(), learningApi.summary()])
      setMaps(list)
      setSummary(sum)
    } catch (err) {
      setError(err)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const roots = useMemo(() => (maps || []).filter((m) => m.parent_id == null), [maps])
  const active = roots.filter((m) => !m.archived_at),
    archived = roots.filter((m) => m.archived_at)
  const childCount = (id) => (maps || []).filter((m) => m.parent_id === id).length

  if (error) return <ErrorState error={error} onRetry={load} t={t} />
  if (!maps || !summary) return <LoadingState />

  return (
    <div className="page lm-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t('Карты знаний', 'Concept maps')}</p>
          <h1>{t('Обучение', 'Learning')}</h1>
          <p className="page-subtitle">
            {t(
              'Темы, связи между ними и ваш путь — шаг за шагом.',
              'Topics, how they connect, and your path through them, step by step.',
            )}
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({})}>
          <Icon name="plus" size={18} />
          {t('Новая карта', 'New map')}
        </Button>
      </header>

      {maps.length > 0 && (
        <section className="panel lm-summary" aria-label={t('Общий прогресс', 'Overall progress')}>
          <ProgressRing value={summary.percent} />
          <div className="lm-summary-stats">
            <h2>{t('Общий прогресс', 'Overall progress')}</h2>
            <dl>
              <div>
                <dt>{t('Освоено тем', 'Topics mastered')}</dt>
                <dd>
                  {summary.mastered}/{summary.nodes}
                </dd>
              </div>
              <div>
                <dt>{t('Цели', 'Goals')}</dt>
                <dd>
                  {summary.goals_done}/{summary.goals}
                </dd>
              </div>
              <div>
                <dt>{t('Активность за 7 дней', 'Active in 7 days')}</dt>
                <dd>{summary.active_7d}</dd>
              </div>
              <div>
                <dt>{t('XP за обучение', 'Learning XP')}</dt>
                <dd>{summary.xp}</dd>
              </div>
            </dl>
          </div>
          <div className="lm-next">
            <h3>{t('Что дальше', 'Up next')}</h3>
            {summary.next?.length ? (
              <ol>
                {summary.next.map((n) => (
                  <li key={n.node_id}>
                    <Link href={`/app/learning/${n.map_id}?node=${n.node_id}`}>
                      <span className={`lm-status-dot ${n.status}`} aria-hidden="true" />
                      <span>
                        <strong>{n.node_title}</strong>
                        <small>
                          {n.map_title} · {statusLabel(n.status, t)}
                        </small>
                      </span>
                      <Icon name="chevron" size={16} />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                {summary.nodes
                  ? t(
                      'Всё доступное освоено. Отличная работа!',
                      'Everything available is mastered. Great work!',
                    )
                  : t(
                      'Добавьте темы в карту — здесь появится следующий шаг.',
                      'Add topics to a map and your next step shows up here.',
                    )}
              </p>
            )}
          </div>
        </section>
      )}

      {active.length ? (
        <section aria-label={t('Карты', 'Maps')} className="lm-grid">
          {active.map((m) => (
            <MapCard key={m.id} map={m} t={t} sections={childCount(m.id)} />
          ))}
        </section>
      ) : (
        <EmptyState
          icon="learning"
          title={t('Пока нет карт обучения', 'No learning maps yet')}
          description={t(
            'Создайте карту, например «AITU» с разделами по предметам или «Наука». Внутри — темы, подтемы, цели и связи между ними.',
            'Create a map, for example "University" with a section per subject. Inside go topics, subtopics, goals and the links between them.',
          )}
        >
          <Button variant="primary" onClick={() => setEditing({})}>
            <Icon name="plus" size={18} />
            {t('Создать первую карту', 'Create your first map')}
          </Button>
        </EmptyState>
      )}

      {archived.length > 0 && (
        <section className="lm-archive">
          <Button
            variant="ghost"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            {t('Архив', 'Archive')} ({archived.length})
          </Button>
          {showArchived && (
            <div className="lm-grid">
              {archived.map((m) => (
                <MapCard key={m.id} map={m} t={t} sections={childCount(m.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      <MapEditor
        value={editing}
        maps={maps}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          if (!editing?.id) router.push('/app/learning/' + saved.id)
          else load()
        }}
      />
    </div>
  )
}
