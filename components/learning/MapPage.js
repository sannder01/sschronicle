'use client'
// /app/learning/[id]: one learning map. Breadcrumbs up the nesting, sections (nested maps),
// progress of this map, the concept map (or the list view), and the details of a topic.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/components/AppContext'
import { Button, Dialog, ErrorState, Input, LoadingState, Select } from '@/components/ui'
import Icon from '@/components/Icon'
import { nextSteps, mapStats } from '@/lib/learning-shape.mjs'
import ConceptMap from './ConceptMap'
import MapTree from './MapTree'
import NodePanel from './NodePanel'
import MapEditor from './MapEditor'
import AssistantDialog from './AssistantDialog'
import { MapCard } from './LearningHome'
import { KINDS, STATUSES, learningApi, errorText, ProgressBar, statusLabel } from './shared'
import './learning.css'

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

export default function MapPage({ id }) {
  const { t, notify } = useApp(),
    router = useRouter(),
    params = useSearchParams(),
    wide = useWide()
  const [data, setData] = useState(null),
    [allMaps, setAllMaps] = useState([]),
    [error, setError] = useState(null),
    [view, setView] = useState(null),
    [selectedId, setSelectedId] = useState(null),
    [adding, setAdding] = useState(null),
    [editingMap, setEditingMap] = useState(null),
    [aiRequest, setAiRequest] = useState(null),
    [aiStatus, setAiStatus] = useState(null),
    [arrange, setArrange] = useState(0),
    [statusFilter, setStatusFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [mapFull, setMapFull] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [map, maps] = await Promise.all([learningApi.map(id), learningApi.maps()])
      setData(map)
      setAllMaps(maps)
    } catch (err) {
      setError(err)
    }
  }, [id])
  useEffect(() => {
    setData(null)
    setSelectedId(null)
    load()
  }, [load])
  useEffect(() => {
    learningApi
      .assistantStatus()
      .then(setAiStatus)
      .catch(() => setAiStatus({ available: false }))
  }, [])
  // ?node=<id> opens a topic directly (links from "Up next")
  useEffect(() => {
    const n = Number(params.get('node'))
    if (data && n && data.nodes.some((x) => x.id === n)) setSelectedId(n)
  }, [data, params])
  const currentView = view || (wide ? 'map' : 'list')
  const aiAvailable = Boolean(aiStatus?.available)

  const nodes = useMemo(() => data?.nodes || [], [data])
  const edges = useMemo(() => data?.edges || [], [data])
  const stats = useMemo(() => mapStats(nodes), [nodes])
  const next = useMemo(() => nextSteps(nodes, edges, 3), [nodes, edges])
  const nextIds = useMemo(() => new Set(next.map((n) => n.id)), [next])
  const lockedIds = useMemo(() => {
    const mastered = new Set(nodes.filter((n) => n.status === 'mastered').map((n) => n.id))
    return new Set(edges.filter((e) => !mastered.has(e.from_id)).map((e) => e.to_id))
  }, [nodes, edges])
  const dimIds = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (statusFilter === 'all' && !q) return null
    return new Set(
      nodes
        .filter(
          (n) =>
            (statusFilter !== 'all' && n.status !== statusFilter) ||
            (q && !n.title.toLowerCase().includes(q)),
        )
        .map((n) => n.id),
    )
  }, [nodes, statusFilter, search])
  const selected = nodes.find((n) => n.id === selectedId) || null

  // ---------- mutations: update local state from the server's answer ----------
  const patchData = (fn) => setData((d) => (d ? { ...d, ...fn(d) } : d))
  const fail = (err, ru, en) => notify(errorText(err, t, t(ru, en)), 'error')

  async function updateNode(nodeId, patch) {
    try {
      const saved = await learningApi.updateNode(nodeId, patch)
      patchData((d) => ({ nodes: d.nodes.map((n) => (n.id === nodeId ? { ...n, ...saved } : n)) }))
      if (patch.status === 'mastered') notify(t('Освоено! +30 XP', 'Mastered! +30 XP'))
    } catch (err) {
      fail(err, 'Не удалось сохранить тему', 'Could not save the topic')
    }
  }
  async function deleteNode(nodeId) {
    try {
      await learningApi.deleteNode(nodeId)
      const gone = nodes.find((n) => n.id === nodeId)
      patchData((d) => ({
        nodes: d.nodes
          .filter((n) => n.id !== nodeId)
          .map((n) => (n.parent_id === nodeId ? { ...n, parent_id: gone?.parent_id ?? null } : n)),
        edges: d.edges.filter((e) => e.from_id !== nodeId && e.to_id !== nodeId),
        materials: d.materials.filter((m) => m.node_id !== nodeId),
      }))
      setSelectedId(null)
      notify(t('Тема удалена', 'Topic deleted'))
    } catch (err) {
      fail(err, 'Не удалось удалить тему', 'Could not delete the topic')
    }
  }
  async function addEdge(from, to) {
    if (edges.some((e) => e.from_id === from && e.to_id === to)) return
    try {
      const edge = await learningApi.createEdge(id, from, to)
      patchData((d) => ({ edges: [...d.edges, edge] }))
    } catch (err) {
      fail(err, 'Не удалось добавить зависимость', 'Could not add the dependency')
    }
  }
  async function deleteEdge(edge) {
    patchData((d) => ({ edges: d.edges.filter((e) => e.id !== edge.id) }))
    try {
      await learningApi.deleteEdge(edge.id)
    } catch (err) {
      patchData((d) => ({ edges: [...d.edges, edge] }))
      fail(err, 'Не удалось убрать зависимость', 'Could not remove the dependency')
    }
  }
  async function savePositions(list) {
    patchData((d) => ({
      nodes: d.nodes.map((n) => {
        const p = list.find((x) => x.id === n.id)
        return p ? { ...n, x: p.x, y: p.y } : n
      }),
    }))
    try {
      for (let i = 0; i < list.length; i += 500)
        await learningApi.savePositions(id, list.slice(i, i + 500))
    } catch (err) {
      fail(err, 'Не удалось сохранить расположение', 'Could not save the layout')
    }
  }
  async function saveMaterial(nodeId, m) {
    try {
      const body = {
        title: m.title.trim(),
        url: m.kind === 'link' ? m.url.trim() : null,
        body: m.body || '',
      }
      if (m.id) {
        const saved = await learningApi.updateMaterial(m.id, body)
        patchData((d) => ({ materials: d.materials.map((x) => (x.id === m.id ? saved : x)) }))
      } else {
        const saved = await learningApi.createMaterial(nodeId, { kind: m.kind, ...body })
        patchData((d) => ({ materials: [...d.materials, saved] }))
      }
    } catch (err) {
      fail(err, 'Не удалось сохранить материал', 'Could not save the material')
    }
  }
  async function deleteMaterial(m) {
    try {
      await learningApi.deleteMaterial(m.id)
      patchData((d) => ({ materials: d.materials.filter((x) => x.id !== m.id) }))
    } catch (err) {
      fail(err, 'Не удалось удалить материал', 'Could not delete the material')
    }
  }
  async function createNode(draft) {
    const near = draft.after ? nodes.find((n) => n.id === draft.after) : selected
    const position =
      near?.x != null
        ? { x: Number(near.x) + 260, y: Number(near.y) + (draft.after ? 0 : 100) }
        : {}
    try {
      const node = await learningApi.createNode(id, {
        kind: draft.kind,
        title: draft.title.trim(),
        ...(draft.parent_id ? { parent_id: draft.parent_id } : {}),
        ...position,
      })
      patchData((d) => ({ nodes: [...d.nodes, node] }))
      if (draft.after) await addEdge(draft.after, node.id)
      setSelectedId(node.id)
      setAdding(null)
    } catch (err) {
      fail(err, 'Не удалось добавить тему', 'Could not add the topic')
    }
  }

  if (error)
    return error.status === 404 ? (
      <div className="page">
        <div className="error-panel" role="alert">
          <strong>{t('Карта не найдена', 'Map not found')}</strong>
          <Link href="/app/learning">{t('Ко всем картам', 'All maps')}</Link>
        </div>
      </div>
    ) : (
      <ErrorState error={error} onRetry={load} t={t} />
    )
  if (!data) return <LoadingState />

  const { map, breadcrumbs = [], children = [] } = data
  const subtree = map.stats || stats
  const panelProps = selected && {
    node: selected,
    nodes,
    edges,
    materials: data.materials || [],
    isNext: nextIds.has(selected.id),
    locked: lockedIds.has(selected.id) && selected.status !== 'mastered',
    aiAvailable,
    onUpdate: updateNode,
    onDelete: deleteNode,
    onAddEdge: addEdge,
    onDeleteEdge: deleteEdge,
    onSaveMaterial: saveMaterial,
    onDeleteMaterial: deleteMaterial,
    onAsk: (mode, nodeId) => setAiRequest({ mode, nodeId }),
    onSelect: setSelectedId,
  }

  return (
    <div className="page lm-page lm-map-page" style={{ '--map': map.color }}>
      <nav className="lm-crumbs" aria-label={t('Где вы', 'You are here')}>
        <Link href="/app/learning">{t('Обучение', 'Learning')}</Link>
        {breadcrumbs.map((b, i) => (
          <span key={b.id}>
            <Icon name="chevron" size={14} />
            {i === breadcrumbs.length - 1 ? (
              <span aria-current="page">{b.title}</span>
            ) : (
              <Link href={'/app/learning/' + b.id}>{b.title}</Link>
            )}
          </span>
        ))}
      </nav>

      <header className="page-header lm-map-header">
        <div>
          <p className="eyebrow">
            {map.topic || t('Карта обучения', 'Learning map')}
            {map.archived_at ? ' · ' + t('в архиве', 'archived') : ''}
          </p>
          <h1>{map.title}</h1>
          {map.description && <p className="page-subtitle">{map.description}</p>}
        </div>
        <div className="lm-header-actions">
          {breadcrumbs.length > 1 && (
            <Button
              variant="ghost"
              onClick={() => router.push('/app/learning/' + breadcrumbs[breadcrumbs.length - 2].id)}
            >
              <Icon name="back" size={18} />
              {t('Наверх', 'Up')}
            </Button>
          )}
          <Button
            onClick={() => setEditingMap(map)}
            aria-label={t('Настройки карты', 'Map settings')}
          >
            <Icon name="edit" size={18} />
            <span className="lm-hide-phone">{t('Настройки', 'Settings')}</span>
          </Button>
        </div>
      </header>

      <section className="panel lm-map-progress" aria-label={t('Прогресс карты', 'Map progress')}>
        <div className="lm-map-progress-main">
          <div className="lm-map-percent">
            <b>{subtree.percent || 0}%</b>
            <span>{t('освоено', 'mastered')}</span>
          </div>
          <ProgressBar value={subtree.percent} label={t('Прогресс карты', 'Map progress')} />
          <ul className="lm-legend">
            {STATUSES.map((s) => (
              <li key={s.value}>
                <span className={`lm-status-dot ${s.value}`} aria-hidden="true" />
                {t(s.ru, s.en)}: <b>{subtree[s.value] ?? 0}</b>
              </li>
            ))}
            <li>
              {t('Цели', 'Goals')}:{' '}
              <b>
                {subtree.goals_done ?? 0}/{subtree.goals ?? 0}
              </b>
            </li>
          </ul>
        </div>
        <div className="lm-map-next">
          <span className="eyebrow">{t('Следующий шаг', 'Next step')}</span>
          {next[0] ? (
            <button className="lm-next-button" onClick={() => setSelectedId(next[0].id)}>
              <span className={`lm-status-dot ${next[0].status}`} aria-hidden="true" />
              <strong>{next[0].title}</strong>
              <small>{statusLabel(next[0].status, t)}</small>
            </button>
          ) : (
            <p className="muted small">
              {nodes.length
                ? t('Всё доступное освоено 🎉', 'Everything available is mastered 🎉')
                : t('Добавьте первую тему', 'Add the first topic')}
            </p>
          )}
        </div>
      </section>

      {
        <section className="lm-sections" aria-label={t('Разделы', 'Sections')}>
          <div className="lm-sections-head">
            <h2>{t('Разделы', 'Sections')}</h2>
            <Button
              variant="ghost"
              onClick={() => setEditingMap({ parent_id: map.id, color: map.color })}
            >
              <Icon name="plus" size={16} />
              {t('Новый раздел', 'New section')}
            </Button>
          </div>
          {children.length > 0 ? (
            <div className="lm-sections-row">
              {children.map((c) => (
                <MapCard key={c.id} map={c} t={t} />
              ))}
            </div>
          ) : (
            <p className="muted small">
              {t(
                'Разделы — это вложенные карты, например отдельный предмет внутри «AITU».',
                'Sections are nested maps, for example one subject inside "University".',
              )}
            </p>
          )}
        </section>
      }

      <div className="lm-toolbar">
        <div className="segmented lm-seg" role="group" aria-label={t('Вид', 'View')}>
          {[
            ['map', t('Карта', 'Map'), 'graph'],
            ['list', t('Список', 'List'), 'tasks'],
          ].map(([v, label, icon]) => (
            <button
              key={v}
              className={currentView === v ? 'selected' : ''}
              aria-pressed={currentView === v}
              onClick={() => setView(v)}
            >
              <Icon name={icon} size={16} />
              {label}
            </button>
          ))}
        </div>
        <Input
          type="search"
          className="lm-search"
          placeholder={t('Найти тему…', 'Find a topic…')}
          aria-label={t('Найти тему', 'Find a topic')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="lm-filter"
          value={statusFilter}
          aria-label={t('Фильтр по статусу', 'Filter by status')}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: t('Все статусы', 'All statuses') },
            ...STATUSES.map((s) => ({ value: s.value, label: t(s.ru, s.en) })),
          ]}
        />
        <div className="lm-toolbar-actions">
          {currentView === 'map' && nodes.length > 1 && (
            <Button variant="ghost" onClick={() => setArrange((n) => n + 1)}>
              <Icon name="board" size={16} />
              {t('Упорядочить', 'Arrange')}
            </Button>
          )}
          <Button
            onClick={() => setAiRequest({ mode: nodes.length ? 'improve' : 'structure' })}
            disabled={!aiAvailable}
            title={
              aiAvailable
                ? undefined
                : t('AI-помощник пока недоступен', 'The AI assistant is not available yet')
            }
          >
            <Icon name="graph" size={16} />
            {t('Помощник', 'Assistant')}
          </Button>
          <Button
            variant="primary"
            onClick={() => setAdding({ title: '', kind: 'topic', parent_id: null, after: null })}
          >
            <Icon name="plus" size={16} />
            {t('Тема', 'Topic')}
          </Button>
        </div>
      </div>
      {!aiAvailable && (
        <p className="lm-ai-off muted small" role="note">
          {t(
            'AI-помощник пока недоступен. Карты работают как обычно. ',
            'The AI assistant is not available. Maps work as usual. ',
          )}
          <Link href="/app/profile#ai">
            {t('Подключить свой ключ Groq или Gemini', 'Connect your own Groq or Gemini key')}
          </Link>
        </p>
      )}

      <div className={`lm-workspace ${selected && wide && !mapFull ? 'with-panel' : ''}`}>
        <div className="lm-main">
          {!nodes.length ? (
            <div className="lm-empty panel">
              <Icon name="learning" size={32} />
              <h3>{t('Карта пока пустая', 'This map is empty')}</h3>
              <p className="muted">
                {t(
                  'Добавьте темы, подтемы и цели, затем свяжите их в порядке изучения.',
                  'Add topics, subtopics and goals, then link them in the order to learn them.',
                )}
              </p>
              <div className="dialog-actions">
                {aiAvailable && (
                  <Button onClick={() => setAiRequest({ mode: 'structure' })}>
                    <Icon name="graph" size={16} />
                    {t('Предложить структуру', 'Suggest a structure')}
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() =>
                    setAdding({ title: '', kind: 'topic', parent_id: null, after: null })
                  }
                >
                  <Icon name="plus" size={16} />
                  {t('Первая тема', 'First topic')}
                </Button>
              </div>
            </div>
          ) : currentView === 'map' ? (
            <ConceptMap
              nodes={nodes}
              edges={edges}
              selectedId={selectedId}
              nextIds={nextIds}
              dimIds={dimIds}
              onSelect={setSelectedId}
              onSavePositions={savePositions}
              onConnect={addEdge}
              onDeleteEdge={deleteEdge}
              arrangeSignal={arrange}
              onFullscreenChange={setMapFull}
            />
          ) : (
            <MapTree
              nodes={nodes}
              edges={edges}
              selectedId={selectedId}
              nextIds={nextIds}
              lockedIds={lockedIds}
              dimIds={dimIds}
              onSelect={setSelectedId}
              onStatus={(nodeId, status) => updateNode(nodeId, { status })}
            />
          )}
        </div>
        {selected && wide && !mapFull && (
          <aside className="panel lm-side" aria-label={t('Тема', 'Topic')}>
            <NodePanel key={selected.id} {...panelProps} onClose={() => setSelectedId(null)} />
          </aside>
        )}
      </div>

      {(!wide || mapFull) && (
        <Dialog
          open={!!selected}
          title={selected?.title || ''}
          onClose={() => setSelectedId(null)}
          className="lm-node-sheet"
        >
          {selected && <NodePanel key={selected.id} {...panelProps} />}
        </Dialog>
      )}

      <Dialog open={!!adding} title={t('Новая тема', 'New topic')} onClose={() => setAdding(null)}>
        {adding && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              if (adding.title.trim()) createNode(adding)
            }}
          >
            <label className="field">
              {t('Название', 'Title')}
              <Input
                autoFocus
                required
                maxLength={160}
                value={adding.title}
                onChange={(e) => setAdding({ ...adding, title: e.target.value })}
              />
            </label>
            <label className="field">
              {t('Тип', 'Kind')}
              <Select
                value={adding.kind}
                onChange={(kind) => setAdding({ ...adding, kind })}
                options={KINDS.map((k) => ({ value: k.value, label: t(k.ru, k.en) }))}
              />
            </label>
            {nodes.length > 0 && (
              <>
                <label className="field">
                  {t('Внутри темы', 'Inside topic')}
                  <Select
                    value={adding.parent_id ?? ''}
                    onChange={(v) =>
                      setAdding({ ...adding, parent_id: v === '' ? null : Number(v) })
                    }
                    options={[
                      { value: '', label: t('Верхний уровень', 'Top level') },
                      ...nodes.map((n) => ({ value: n.id, label: n.title })),
                    ]}
                  />
                </label>
                <label className="field">
                  {t('Изучать после', 'Learn after')}
                  <Select
                    value={adding.after ?? ''}
                    onChange={(v) => setAdding({ ...adding, after: v === '' ? null : Number(v) })}
                    options={[
                      { value: '', label: t('Без зависимости', 'No prerequisite') },
                      ...nodes.map((n) => ({ value: n.id, label: n.title })),
                    ]}
                  />
                </label>
              </>
            )}
            <div className="dialog-actions">
              <Button onClick={() => setAdding(null)}>{t('Отмена', 'Cancel')}</Button>
              <Button type="submit" variant="primary">
                {t('Добавить', 'Add')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <MapEditor
        value={editingMap}
        maps={allMaps}
        onClose={() => setEditingMap(null)}
        onSaved={(saved) => {
          if (!editingMap?.id) router.push('/app/learning/' + saved.id)
          else load()
        }}
        onDeleted={() =>
          router.push(
            breadcrumbs.length > 1
              ? '/app/learning/' + breadcrumbs[breadcrumbs.length - 2].id
              : '/app/learning',
          )
        }
      />
      <AssistantDialog
        request={aiRequest}
        map={map}
        nodes={nodes}
        aiStatus={aiStatus}
        onClose={() => setAiRequest(null)}
        onApplied={() => load()}
      />
    </div>
  )
}
