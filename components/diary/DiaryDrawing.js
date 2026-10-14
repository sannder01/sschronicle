'use client'

import { useRef, useState } from 'react'
import { Button, Dialog } from '@/components/ui'
import { INKS, LIMITS, strokePath } from '@/lib/diary/format.mjs'

export default function DiaryDrawing({ strokes, onChange, t }) {
  const [color, setColor] = useState('ink')
  const [width, setWidth] = useState(4)
  const [drawing, setDrawing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [clear, setClear] = useState(false)
  const current = useRef(null)
  const pointer = useRef(null)
  const count = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0)
  const full = count >= LIMITS.points || strokes.length >= LIMITS.strokes
  const point = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    ].map((n) => Math.round(n * 100000) / 100000)
  }
  const finish = (event) => {
    if (!current.current || event.pointerId !== pointer.current) return
    const stroke = current.current
    current.current = null
    pointer.current = null
    setDraft(null)
    onChange([...strokes, stroke])
  }
  const names = [t('Чернила', 'Ink'), t('Синий', 'Blue'), t('Розовый', 'Rose'), t('Зелёный', 'Sage')]
  return (
    <section className="diary-sketch" aria-label={t('Рисунок', 'Drawing')}>
      <div className="diary-section-heading">
        <div><span className="diary-kicker">03 / {t('БЕЗ СЛОВ', 'WITHOUT WORDS')}</span><h3>{t('Место для рисунка', 'A little room to draw')}</h3></div>
        <Button variant={drawing ? 'primary' : 'secondary'} onClick={() => setDrawing(!drawing)} aria-pressed={drawing}>
          {drawing ? t('Готово', 'Done') : t('Рисовать', 'Draw')}
        </Button>
      </div>
      <div className="diary-draw-tools">
        <div className="diary-swatches" role="group" aria-label={t('Цвет пера', 'Pen color')}>
          {INKS.map((ink, i) => <button key={ink} type="button" className={`diary-swatch diary-ink-${ink}`} aria-label={names[i]} title={names[i]} aria-pressed={color === ink} onClick={() => setColor(ink)} />)}
        </div>
        <label className="diary-pen-size">{t('Перо', 'Pen')}<select aria-label={t('Толщина пера', 'Pen width')} value={width} onChange={(e) => setWidth(Number(e.target.value))}>
          <option value={2}>{t('Тонкое', 'Fine')}</option><option value={4}>{t('Среднее', 'Medium')}</option><option value={7}>{t('Толстое', 'Bold')}</option>
        </select></label>
        <div className="diary-draw-actions">
          <Button variant="ghost" disabled={!strokes.length || !!draft} onClick={() => onChange(strokes.slice(0, -1))}>{t('Отменить штрих', 'Undo stroke')}</Button>
          <Button variant="ghost" disabled={!strokes.length || !!draft} onClick={() => setClear(true)}>{t('Очистить', 'Clear')}</Button>
        </div>
      </div>
      <div className={`diary-drawing ${drawing ? 'is-drawing' : ''}`}>
        {!strokes.length && !draft && <span className="diary-drawing-hint">{drawing ? t('Нарисуйте что угодно. Здесь можно просто быть собой.', 'Draw anything. There is no right way.') : t('Пара линий иногда говорит больше слов', 'Sometimes a few lines say it all')}</span>}
        <svg viewBox="0 0 1000 560" preserveAspectRatio="none" role="img" aria-label={t('Рисунок на странице дневника', 'Drawing on the diary page')}
          style={{ touchAction: drawing ? 'none' : 'pan-y' }}
          onPointerDown={(e) => {
            if (!drawing || full || current.current || (e.pointerType === 'mouse' && e.button !== 0)) return
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            pointer.current = e.pointerId
            current.current = { id: crypto.randomUUID(), color, width, points: [point(e)] }
            setDraft(current.current)
          }}
          onPointerMove={(e) => {
            const stroke = current.current
            if (!stroke || pointer.current !== e.pointerId || stroke.points.length >= 2000 || count + stroke.points.length >= LIMITS.points) return
            const next = point(e), previous = stroke.points[stroke.points.length - 1]
            if (Math.hypot(next[0] - previous[0], next[1] - previous[1]) < 0.001) return
            stroke.points.push(next)
            setDraft({ ...stroke, points: [...stroke.points] })
          }}
          onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
          {[...strokes, ...(draft ? [draft] : [])].map((stroke) => stroke.points.length === 1
            ? <circle key={stroke.id} cx={stroke.points[0][0] * 1000} cy={stroke.points[0][1] * 560} r={stroke.width / 2} fill={`var(--diary-${stroke.color})`} />
            : <path key={stroke.id} d={strokePath(stroke.points)} fill="none" stroke={`var(--diary-${stroke.color})`} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>
      </div>
      <p className="diary-tool-hint" role="status">{full ? t('Лист заполнен. Отмените несколько штрихов, чтобы продолжить.', 'The drawing is full. Undo some strokes to continue.') : drawing ? t('Рисуйте мышью, пальцем или стилусом. Нажмите «Готово», чтобы прокручивать лист.', 'Use a mouse, finger or stylus. Tap Done to scroll the page.') : t('Нажмите «Рисовать», чтобы оставить свой след.', 'Tap Draw to leave your mark.')}</p>
      <Dialog open={clear} title={t('Очистить рисунок?', 'Clear the drawing?')} onClose={() => setClear(false)}>
        <p>{t('Все штрихи на этой странице будут удалены.', 'All strokes on this page will be removed.')}</p>
        <div className="diary-dialog-actions"><Button onClick={() => setClear(false)}>{t('Отмена', 'Cancel')}</Button><Button variant="danger" onClick={() => { onChange([]); setClear(false) }}>{t('Очистить рисунок', 'Clear drawing')}</Button></div>
      </Dialog>
    </section>
  )
}
