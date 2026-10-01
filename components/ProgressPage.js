'use client'
import { useEffect } from 'react'
import { useApp } from './AppContext'
import { LoadingState, ErrorState } from './ui'
const ranks = [
  ['E', 0, 100, 'Первый шаг', 'Novice Hunter'],
  ['D', 100, 300, 'Сила воли', 'Iron Will'],
  ['C', 300, 600, 'Стальная решимость', 'Steel Mind'],
  ['B', 600, 1000, 'Теневой странник', 'Shadow Walker'],
  ['A', 1000, 1500, 'Командир', 'Raid Commander'],
  ['S', 1500, 2200, 'Монарх', 'Monarch'],
  ['SS', 2200, 3000, 'Повелитель теней', 'Shadow Sovereign'],
  ['SSS', 3000, Infinity, 'Абсолют', 'Absolute'],
]
function Character({ level }) {
  return (
    <svg viewBox="0 0 100 140" width="108" height="140" aria-hidden="true">
      <ellipse cx="50" cy="128" rx="30" ry="6" fill="#8293b0" opacity=".15" />
      <path d="M31 66 23 111h54L69 66Z" fill="#7b8fad" />
      <rect x="35" y="99" width="12" height="26" rx="4" fill="#4b607e" />
      <rect x="53" y="99" width="12" height="26" rx="4" fill="#4b607e" />
      <rect x="34" y="63" width="32" height="43" rx="9" fill="#b4c4db" />
      <path d="M34 67 22 88m44-21 12 21" stroke="#728aaa" strokeWidth="10" strokeLinecap="round" />
      <circle cx="50" cy="43" r="19" fill="#d2dcec" />
      <path d="M31 41q2-25 22-20 20 2 17 25L57 32 45 40Z" fill="#4b607e" />
      <path d="M44 45h2m8 0h2" stroke="#4b607e" strokeWidth="3" strokeLinecap="round" />
      {level >= 2 && <path d="M37 71h26v23H37Z" fill="#7189aa" />}
      {level >= 4 && <path d="m50 73 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z" fill="#e3c37b" />}
      {level >= 6 && <path d="m33 22 2-12 10 6 7-10 7 10 9-6-1 15" fill="#dcc388" />}
    </svg>
  )
}
export default function ProgressPage() {
  const { profile, profileError, refreshProfile, t } = useApp()
  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])
  if (!profile)
    return profileError ? (
      <ErrorState error={profileError} onRetry={refreshProfile} t={t} />
    ) : (
      <LoadingState />
    )
  const xp = profile.stats.xp,
    index = ranks.findLastIndex((rank) => xp >= rank[1]),
    rank = ranks[index],
    percentage =
      rank[2] === Infinity ? 100 : Math.min(100, (100 * (xp - rank[1])) / (rank[2] - rank[1]))
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t('Каждый шаг имеет значение', 'Every step counts')}</p>
          <h1>{t('Мой прогресс', 'My progress')}</h1>
          <p className="page-subtitle">
            {t(
              'Персонаж растёт вместе с вашими действиями.',
              'Your character grows with every action you take.',
            )}
          </p>
        </div>
      </header>
      <section className="panel progress-hero">
        <div className="rank-orb">
          <Character level={index} />
        </div>
        <div>
          <p className="eyebrow">
            {t('РАНГ', 'RANK')} {rank[0]}
          </p>
          <h2>{t(rank[3], rank[4])}</h2>
          <p className="muted">{xp.toLocaleString()} XP</p>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={Math.round(percentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('Прогресс ранга', 'Rank progress')}
          >
            <div style={{ width: percentage + '%' }} />
          </div>
          <small className="muted">
            {rank[2] === Infinity
              ? t('Высший ранг достигнут', 'Highest rank reached')
              : `${rank[2] - xp} XP ${t('до следующего ранга', 'to the next rank')}`}
          </small>
        </div>
      </section>
      <div className="rank-list">
        {ranks.map((r, i) => (
          <div key={r[0]} className={`panel rank-item ${i === index ? 'current' : ''}`}>
            <strong>{r[0]}</strong>
            <h3>{t(r[3], r[4])}</h3>
            <p>
              {r[1]} XP{i === index ? ' · ' + t('Ваш ранг', 'Your rank') : ''}
            </p>
          </div>
        ))}
      </div>
      <section className="panel progress-explanation">
        <h3>{t('Как растёт прогресс', 'How progress works')}</h3>
        <p>
          {t(
            'Выполненная задача: 10 / 25 / 50 XP в зависимости от приоритета. Отметка привычки: 15 XP. Успешный день челленджа: 20 XP.',
            'A completed task earns 10 / 25 / 50 XP based on priority. A habit check-in earns 15 XP. A successful challenge day earns 20 XP.',
          )}
        </p>
        <p>
          {t(
            'Баллы отражают сохранённые результаты. Отмена отметки или удаление записи уменьшает XP. Повторные нажатия не дают дополнительных баллов.',
            'Points reflect your saved results. Undoing or deleting a record reduces XP. Repeated clicks never award extra points.',
          )}
        </p>
      </section>
    </div>
  )
}
