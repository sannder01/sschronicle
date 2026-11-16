'use client'
import { useEffect, useRef, useState } from 'react'

const SIZE = 112
const STROKE = 12
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// One arc per habit scheduled today, in the habit's own color. An arc fills when
// the habit is checked; closing the whole ring plays a single short celebration.
export default function DailyRing({ habits, label }) {
  const count = habits.length
  const done = habits.filter((habit) => habit.done_today).length
  const closed = count > 0 && done === count
  const [celebrate, setCelebrate] = useState(false)
  const wasClosed = useRef(closed)
  useEffect(() => {
    if (closed && !wasClosed.current) {
      setCelebrate(true)
      const timer = setTimeout(() => setCelebrate(false), 1200)
      wasClosed.current = closed
      return () => clearTimeout(timer)
    }
    wasClosed.current = closed
  }, [closed])
  const gap = count > 1 ? STROKE * 1.4 : 0
  const segment = count ? CIRCUMFERENCE / count : 0
  // Round caps extend each arc by half the stroke on both ends.
  const length = Math.max(0.01, segment - gap - (count > 1 ? STROKE : 0))
  return (
    <div
      className={`daily-ring ${closed ? 'closed' : ''} ${celebrate ? 'celebrate' : ''}`}
      role="img"
      aria-label={label}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {habits.map((habit, index) => {
          const rotation =
            -90 +
            (360 / count) * index +
            (count > 1 ? (gap / 2 + STROKE / 2) * (360 / CIRCUMFERENCE) : 0)
          const common = {
            cx: SIZE / 2,
            cy: SIZE / 2,
            r: RADIUS,
            fill: 'none',
            strokeWidth: STROKE,
            strokeLinecap: count > 1 ? 'round' : 'butt',
            transform: `rotate(${rotation} ${SIZE / 2} ${SIZE / 2})`,
            style: { '--item-color': habit.color || 'var(--accent)' },
          }
          return (
            <g key={habit.id}>
              <circle
                {...common}
                className="daily-ring-track"
                strokeDasharray={`${length} ${CIRCUMFERENCE}`}
              />
              <circle
                {...common}
                className={`daily-ring-fill ${habit.done_today ? 'on' : ''}`}
                strokeDasharray={`${habit.done_today ? length : 0.01} ${CIRCUMFERENCE}`}
              />
            </g>
          )
        })}
      </svg>
      <div className="daily-ring-count" aria-hidden="true">
        <strong>{done}</strong>
        <span>/ {count}</span>
      </div>
    </div>
  )
}
