'use client'
// AI assistant (Groq). The answer is only a proposal: the user ticks what to keep, edits titles,
// and nothing touches the map until "Add selected" is pressed.
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { Button, Dialog, Input } from '@/components/ui'
import Icon from '@/components/Icon'
import { learningApi, errorText, kindLabel } from './shared'

const MODES = [
  [
    'structure',
    'Предложить структуру',
    'Suggest a structure',
    'Разделы, темы и подтемы по вашей теме и цели',
    'Sections, topics and subtopics for your subject and goal',
  ],
  [
    'route',
    'Маршрут изучения',
    'Learning route',
    'Порядок прохождения существующих тем',
    'An order to go through the existing topics',
  ],
  [
    'dependencies',
    'Зависимости',
    'Dependencies',
    'Какие темы нужно знать до других',
    'Which topics should come before others',
  ],
  [
    'improve',
    'Улучшить карту',
    'Improve the map',
    'Чего не хватает и что добавить',
    'What is missing and what to add',
  ],
  [
    'breakdown',
    'Разбить тему на шаги',
    'Break a topic into steps',
    'Подтемы для выбранной темы',
    'Subtopics for the selected topic',
  ],
  [
    'questions',
    'Вопросы и цели',
    'Questions and goals',
    'Учебные цели и вопросы для проверки',
    'Learning goals and self-check questions',
  ],
]

const PROVIDER_LABEL = { groq: 'Groq', gemini: 'Google Gemini' }

export default function AssistantDialog({ request, map, nodes, aiStatus, onClose, onApplied }) {
  const { t, notify } = useApp()
  const [mode, setMode] = useState('structure'),
    [form, setForm] = useState({ topic: '', goal: '', level: '' }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState(null),
    [picked, setPicked] = useState({ nodes: new Set(), edges: new Set() }),
    [titles, setTitles] = useState({})

  useEffect(() => {
    if (!request) return
    setMode(request.mode || (nodes.length ? 'improve' : 'structure'))
    setForm({ topic: map?.topic || map?.title || '', goal: '', level: '' })
    setResult(null)
    setError('')
    // a node-specific request runs straight away
    if (request.nodeId) ask(request.mode, request.nodeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const labelOf = (ref) => {
    if (ref?.startsWith('id:')) return byId.get(Number(ref.slice(3)))?.title || ref
    return titles[ref] ?? result?.nodes.find((n) => n.ref === ref)?.title ?? ref
  }

  async function ask(m = mode, nodeId = request?.nodeId) {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const { suggestion } = await learningApi.ask({
        mode: m,
        map_id: map.id,
        ...(nodeId ? { node_id: nodeId } : {}),
        ...(m === 'structure' || m === 'improve'
          ? { topic: form.topic.trim(), goal: form.goal.trim(), level: form.level.trim() }
          : {}),
      })
      setResult(suggestion)
      setTitles(Object.fromEntries(suggestion.nodes.map((n) => [n.ref, n.title])))
      setPicked({
        nodes: new Set(suggestion.nodes.map((n) => n.ref)),
        edges: new Set(suggestion.edges.map((_, i) => i)),
      })
    } catch (err) {
      setError(errorText(err, t, t('Помощник не ответил', 'The assistant did not answer')))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (kind, key) =>
    setPicked((p) => {
      const set = new Set(p[kind])
      set.has(key) ? set.delete(key) : set.add(key)
      return { ...p, [kind]: set }
    })
  // an edge can only be kept when both ends exist or are being added
  const usable = (ref) => ref.startsWith('id:') || picked.nodes.has(ref)
  const chosenEdges = result
    ? result.edges.filter((e, i) => picked.edges.has(i) && usable(e.from_ref) && usable(e.to_ref))
    : []
  const chosenNodes = result ? result.nodes.filter((n) => picked.nodes.has(n.ref)) : []

  async function apply() {
    setBusy(true)
    setError('')
    try {
      const body = {
        nodes: chosenNodes.map((n) => ({
          ref: n.ref,
          kind: n.kind,
          title: (titles[n.ref] || n.title).trim().slice(0, 160) || n.title,
          description: n.description || '',
          ...(n.parent_ref && usable(n.parent_ref) ? { parent_ref: n.parent_ref } : {}),
        })),
        edges: chosenEdges.map((e) => ({ from_ref: e.from_ref, to_ref: e.to_ref })),
      }
      const created = await learningApi.apply(map.id, body)
      notify(
        t('Добавлено: ', 'Added: ') +
          created.nodes.length +
          t(' тем, ', ' topics, ') +
          created.edges.length +
          t(' связей', ' links'),
      )
      onApplied?.(created)
      onClose()
    } catch (err) {
      setError(
        errorText(err, t, t('Не удалось добавить предложение', 'Could not add the proposal')),
      )
    } finally {
      setBusy(false)
    }
  }

  const nodeModes = ['breakdown', 'questions']
  const target = request?.nodeId ? byId.get(request.nodeId) : null
  const depth = (n) => {
    let d = 0,
      cur = n
    while (cur?.parent_ref && d < 6) {
      cur = result.nodes.find((x) => x.ref === cur.parent_ref)
      d++
    }
    return d
  }

  return (
    <Dialog
      open={!!request}
      title={t('AI-помощник', 'AI assistant')}
      onClose={() => !busy && onClose()}
      className="lm-ai-dialog"
    >
      {request && (
        <div className="stack">
          {!result && !target && (
            <>
              <div
                className="lm-ai-modes"
                role="radiogroup"
                aria-label={t('Что сделать', 'What to do')}
              >
                {MODES.filter(([m]) => !nodeModes.includes(m)).map(([m, ru, en, dru, den]) => (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={mode === m}
                    className={`lm-ai-mode ${mode === m ? 'selected' : ''}`}
                    disabled={m !== 'structure' && !nodes.length}
                    onClick={() => setMode(m)}
                  >
                    <strong>{t(ru, en)}</strong>
                    <small>{t(dru, den)}</small>
                  </button>
                ))}
              </div>
              {(mode === 'structure' || mode === 'improve') && (
                <div className="stack">
                  <label className="field">
                    {t('Тема', 'Subject')}
                    <Input
                      maxLength={500}
                      value={form.topic}
                      onChange={(e) => setForm({ ...form, topic: e.target.value })}
                      placeholder={t('Например, линейная алгебра', 'For example, linear algebra')}
                    />
                  </label>
                  <label className="field">
                    {t('Цель', 'Goal')}
                    <Input
                      maxLength={500}
                      value={form.goal}
                      onChange={(e) => setForm({ ...form, goal: e.target.value })}
                      placeholder={t('Сдать экзамен на 90+', 'Pass the exam with 90+')}
                    />
                  </label>
                  <label className="field">
                    {t('Уровень', 'Level')}
                    <Input
                      maxLength={500}
                      value={form.level}
                      onChange={(e) => setForm({ ...form, level: e.target.value })}
                      placeholder={t('Новичок, 2 курс…', 'Beginner, 2nd year…')}
                    />
                  </label>
                </div>
              )}
              <p className="muted small">
                {t(
                  'Помощнику отправляются только название и тема карты, названия и статусы тем и то, что вы ввели выше.',
                  'Only the map title and topic, topic titles and statuses, and what you typed above are sent to the assistant.',
                )}
                {aiStatus?.provider && (
                  <>
                    {' '}
                    {aiStatus.source === 'user'
                      ? t('Работает через ваш ключ ', 'Uses your key: ')
                      : t('Работает через общий ключ ', 'Uses the shared key: ')}
                    {PROVIDER_LABEL[aiStatus.provider] || aiStatus.provider}
                    {aiStatus.model ? ' · ' + aiStatus.model : ''}.
                  </>
                )}
              </p>
            </>
          )}
          {target && !result && !busy && !error && <p className="muted">{target.title}</p>}

          {busy && (
            <div className="loading-state" role="status">
              <span className="spinner" />
              <span className="text-shimmer">
                {result ? t('Добавляю…', 'Adding…') : t('Помощник думает…', 'Thinking…')}
              </span>
            </div>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}

          {result && !busy && (
            <div className="lm-proposal">
              {result.summary && <p className="lm-proposal-summary">{result.summary}</p>}
              {result.nodes.length > 0 && (
                <fieldset>
                  <legend>
                    {t('Новые темы', 'New topics')} ({chosenNodes.length}/{result.nodes.length})
                  </legend>
                  <ul>
                    {result.nodes.map((n) => (
                      <li key={n.ref} style={{ '--depth': depth(n) }}>
                        <input
                          type="checkbox"
                          aria-label={t('Взять', 'Keep') + ' ' + (titles[n.ref] || n.title)}
                          checked={picked.nodes.has(n.ref)}
                          onChange={() => toggle('nodes', n.ref)}
                        />
                        <div>
                          <span className="lm-chip">{kindLabel(n.kind, t)}</span>
                          <input
                            className="lm-proposal-title"
                            aria-label={t('Название', 'Title')}
                            maxLength={160}
                            value={titles[n.ref] ?? n.title}
                            onChange={(e) => setTitles({ ...titles, [n.ref]: e.target.value })}
                          />
                          {n.description && <small>{n.description}</small>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}
              {result.edges.length > 0 && (
                <fieldset>
                  <legend>
                    {t('Зависимости', 'Dependencies')} ({chosenEdges.length}/{result.edges.length})
                  </legend>
                  <ul>
                    {result.edges.map((e, i) => {
                      const ok = usable(e.from_ref) && usable(e.to_ref)
                      return (
                        <li key={i} className={ok ? '' : 'off'}>
                          <input
                            type="checkbox"
                            disabled={!ok}
                            aria-label={labelOf(e.from_ref) + ' → ' + labelOf(e.to_ref)}
                            checked={ok && picked.edges.has(i)}
                            onChange={() => toggle('edges', i)}
                          />
                          <span>
                            {labelOf(e.from_ref)} <Icon name="arrow" size={14} />{' '}
                            {labelOf(e.to_ref)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </fieldset>
              )}
              {!result.nodes.length && !result.edges.length && (
                <p className="muted">
                  {t('Помощнику нечего предложить.', 'The assistant has nothing to add.')}
                </p>
              )}
            </div>
          )}

          <div className="dialog-actions">
            {result && !busy && (
              <Button onClick={() => (target ? ask() : setResult(null))}>
                {t('Ещё вариант', 'Try again')}
              </Button>
            )}
            {!result && !target && (
              <Button
                variant="primary"
                disabled={busy || (mode === 'structure' && !form.topic.trim())}
                onClick={() => ask()}
              >
                <Icon name="graph" size={16} />
                {t('Предложить', 'Suggest')}
              </Button>
            )}
            {target && error && !busy && (
              <Button onClick={() => ask()}>{t('Повторить', 'Retry')}</Button>
            )}
            {result && !busy && (
              <Button
                variant="primary"
                disabled={!chosenNodes.length && !chosenEdges.length}
                onClick={apply}
              >
                {t('Добавить выбранное', 'Add selected')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
