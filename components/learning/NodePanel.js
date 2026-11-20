'use client'
// Details of one topic: status, kind, notes / learning goal, place in the tree, dependencies,
// materials (notes and links) and assistant shortcuts. Used as a side panel or a sheet.
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { Button, Input, Select } from '@/components/ui'
import Icon from '@/components/Icon'
import { KINDS, STATUSES, kindLabel, statusLabel } from './shared'

function MaterialForm({ initial, onSave, onCancel, t }) {
  const [m, setM] = useState({ kind: 'link', title: '', url: '', body: '', ...initial })
  const valid = m.title.trim() && (m.kind !== 'link' || /^https?:\/\/\S+$/i.test(m.url.trim()))
  return (
    <form
      className="lm-material-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave(m)
      }}
    >
      {!initial?.id && (
        <div
          className="segmented lm-seg"
          role="group"
          aria-label={t('Тип материала', 'Material type')}
        >
          {[
            ['link', t('Ссылка', 'Link')],
            ['note', t('Заметка', 'Note')],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={m.kind === v ? 'selected' : ''}
              aria-pressed={m.kind === v}
              onClick={() => setM({ ...m, kind: v })}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <Input
        autoFocus
        required
        maxLength={160}
        aria-label={t('Название материала', 'Material title')}
        placeholder={t('Название', 'Title')}
        value={m.title}
        onChange={(e) => setM({ ...m, title: e.target.value })}
      />
      {m.kind === 'link' && (
        <Input
          type="url"
          required
          maxLength={2000}
          aria-label="URL"
          placeholder="https://"
          value={m.url || ''}
          onChange={(e) => setM({ ...m, url: e.target.value })}
        />
      )}
      <textarea
        className="input lm-textarea"
        rows={m.kind === 'note' ? 4 : 2}
        maxLength={4000}
        aria-label={t('Текст', 'Text')}
        placeholder={
          m.kind === 'note'
            ? t('Конспект, формулы, мысли…', 'Notes, formulas, thoughts…')
            : t('Комментарий (необязательно)', 'Comment (optional)')
        }
        value={m.body || ''}
        onChange={(e) => setM({ ...m, body: e.target.value })}
      />
      <div className="dialog-actions">
        <Button onClick={onCancel}>{t('Отмена', 'Cancel')}</Button>
        <Button type="submit" variant="primary" disabled={!valid}>
          {t('Сохранить', 'Save')}
        </Button>
      </div>
    </form>
  )
}

export default function NodePanel({
  node,
  nodes,
  edges,
  materials,
  isNext,
  locked,
  aiAvailable,
  onUpdate,
  onDelete,
  onAddEdge,
  onDeleteEdge,
  onSaveMaterial,
  onDeleteMaterial,
  onAsk,
  onSelect,
  onClose,
}) {
  const { t } = useApp()
  const [title, setTitle] = useState(node.title),
    [description, setDescription] = useState(node.description || ''),
    [materialForm, setMaterialForm] = useState(null),
    [confirming, setConfirming] = useState(false)
  useEffect(() => {
    setTitle(node.title)
    setDescription(node.description || '')
    setMaterialForm(null)
    setConfirming(false)
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const prerequisites = edges.filter((e) => e.to_id === node.id)
  const unlocks = edges.filter((e) => e.from_id === node.id)
  const children = nodes.filter((n) => n.parent_id === node.id)
  const own = materials.filter((m) => m.node_id === node.id)
  const addable = nodes.filter(
    (n) => n.id !== node.id && !prerequisites.some((e) => e.from_id === n.id),
  )
  // a topic cannot sit under itself or its own subtopics
  const blocked = useMemo(() => {
    const set = new Set([node.id])
    let grew = true
    while (grew) {
      grew = false
      for (const n of nodes)
        if (n.parent_id != null && set.has(n.parent_id) && !set.has(n.id)) {
          set.add(n.id)
          grew = true
        }
    }
    return set
  }, [nodes, node.id])

  const saveText = () => {
    const patch = {}
    if (title.trim() && title.trim() !== node.title) patch.title = title.trim()
    if (description !== (node.description || '')) patch.description = description
    if (Object.keys(patch).length) onUpdate(node.id, patch)
  }
  const nodeLink = (id) => {
    const n = byId.get(id)
    return n ? (
      <button className="lm-node-link" onClick={() => onSelect(id)}>
        <span className={`lm-status-dot ${n.status}`} aria-hidden="true" />
        {n.title}
      </button>
    ) : null
  }

  return (
    <div className="lm-node-panel">
      <header className="lm-node-head">
        <span className="lm-chip">{kindLabel(node.kind, t)}</span>
        {isNext && <span className="lm-chip next">{t('Следующий шаг', 'Next step')}</span>}
        {locked && (
          <span className="lm-chip">{t('Сначала зависимости', 'Prerequisites first')}</span>
        )}
        {onClose && (
          <Button
            variant="ghost"
            className="lm-node-close"
            aria-label={t('Закрыть', 'Close')}
            onClick={onClose}
          >
            <Icon name="close" />
          </Button>
        )}
      </header>
      <label className="sr-only" htmlFor={'node-title-' + node.id}>
        {t('Название темы', 'Topic title')}
      </label>
      <input
        id={'node-title-' + node.id}
        className="lm-node-title"
        maxLength={160}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveText}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />

      <div className="lm-status-picker" role="radiogroup" aria-label={t('Статус', 'Status')}>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            role="radio"
            aria-checked={node.status === s.value}
            className={`lm-status-option ${s.value} ${node.status === s.value ? 'selected' : ''}`}
            onClick={() => node.status !== s.value && onUpdate(node.id, { status: s.value })}
          >
            <span className={`lm-status-dot ${s.value}`} aria-hidden="true" />
            {t(s.ru, s.en)}
          </button>
        ))}
      </div>

      <div className="lm-node-grid">
        <label className="field">
          {t('Тип', 'Kind')}
          <Select
            value={node.kind}
            onChange={(kind) => onUpdate(node.id, { kind })}
            options={KINDS.map((k) => ({ value: k.value, label: t(k.ru, k.en) }))}
          />
        </label>
        <label className="field">
          {t('Внутри темы', 'Inside topic')}
          <Select
            value={node.parent_id ?? ''}
            onChange={(v) => onUpdate(node.id, { parent_id: v === '' ? null : Number(v) })}
            options={[
              { value: '', label: t('Верхний уровень', 'Top level') },
              ...nodes
                .filter((n) => !blocked.has(n.id))
                .map((n) => ({ value: n.id, label: n.title })),
            ]}
          />
        </label>
      </div>

      <label className="field">
        {node.kind === 'goal' ? t('Учебная цель', 'Learning goal') : t('Заметки', 'Notes')}
        <textarea
          className="input lm-textarea"
          rows={4}
          maxLength={4000}
          placeholder={t(
            'Что нужно знать и уметь, ключевые идеи…',
            'What to know and be able to do, key ideas…',
          )}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveText}
        />
      </label>

      <section className="lm-node-section">
        <h3>{t('Сначала изучить', 'Learn first')}</h3>
        {prerequisites.length ? (
          <ul className="lm-node-list">
            {prerequisites.map((e) => (
              <li key={e.id}>
                {nodeLink(e.from_id)}
                <Button
                  variant="ghost"
                  aria-label={t('Убрать зависимость', 'Remove dependency')}
                  onClick={() => onDeleteEdge(e)}
                >
                  <Icon name="close" size={14} />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">
            {t('Нет зависимостей — можно начинать.', 'No prerequisites — ready to start.')}
          </p>
        )}
        {addable.length > 0 && (
          <Select
            value=""
            aria-label={t('Добавить зависимость', 'Add prerequisite')}
            onChange={(v) => v !== '' && onAddEdge(Number(v), node.id)}
            options={[
              { value: '', label: t('+ Добавить зависимость', '+ Add prerequisite') },
              ...addable.map((n) => ({ value: n.id, label: n.title })),
            ]}
          />
        )}
        {unlocks.length > 0 && (
          <>
            <h3>{t('Открывает', 'Unlocks')}</h3>
            <ul className="lm-node-list">
              {unlocks.map((e) => (
                <li key={e.id}>{nodeLink(e.to_id)}</li>
              ))}
            </ul>
          </>
        )}
        {children.length > 0 && (
          <>
            <h3>{t('Подтемы', 'Subtopics')}</h3>
            <ul className="lm-node-list">
              {children.map((c) => (
                <li key={c.id}>
                  {nodeLink(c.id)}
                  <small className="muted">{statusLabel(c.status, t)}</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="lm-node-section">
        <h3>{t('Материалы', 'Materials')}</h3>
        {own.length > 0 && (
          <ul className="lm-materials">
            {own.map((m) =>
              materialForm?.id === m.id ? (
                <li key={m.id}>
                  <MaterialForm
                    initial={m}
                    t={t}
                    onCancel={() => setMaterialForm(null)}
                    onSave={(next) => {
                      onSaveMaterial(node.id, next)
                      setMaterialForm(null)
                    }}
                  />
                </li>
              ) : (
                <li key={m.id} className="lm-material">
                  <Icon name={m.kind === 'link' ? 'arrow' : 'notes'} size={16} />
                  <div>
                    {m.kind === 'link' ? (
                      <a href={m.url} target="_blank" rel="noopener noreferrer nofollow">
                        {m.title}
                      </a>
                    ) : (
                      <strong>{m.title}</strong>
                    )}
                    {m.body && <p>{m.body}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    aria-label={t('Изменить', 'Edit') + ' ' + m.title}
                    onClick={() => setMaterialForm(m)}
                  >
                    <Icon name="edit" size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={t('Удалить', 'Delete') + ' ' + m.title}
                    onClick={() => onDeleteMaterial(m)}
                  >
                    <Icon name="trash" size={14} />
                  </Button>
                </li>
              ),
            )}
          </ul>
        )}
        {materialForm && !materialForm.id ? (
          <MaterialForm
            initial={null}
            t={t}
            onCancel={() => setMaterialForm(null)}
            onSave={(next) => {
              onSaveMaterial(node.id, next)
              setMaterialForm(null)
            }}
          />
        ) : (
          <Button onClick={() => setMaterialForm({})}>
            <Icon name="plus" size={16} />
            {t('Добавить материал', 'Add material')}
          </Button>
        )}
      </section>

      <section className="lm-node-section">
        <h3>{t('Помощник', 'Assistant')}</h3>
        {aiAvailable ? (
          <div className="lm-ai-actions">
            <Button onClick={() => onAsk('breakdown', node.id)}>
              <Icon name="graph" size={16} />
              {t('Разбить на шаги', 'Break into steps')}
            </Button>
            <Button onClick={() => onAsk('questions', node.id)}>
              <Icon name="check" size={16} />
              {t('Вопросы и цели', 'Questions and goals')}
            </Button>
          </div>
        ) : (
          <p className="muted small">
            {t('AI-помощник пока недоступен.', 'The AI assistant is not available yet.')}
          </p>
        )}
      </section>

      <footer className="lm-node-foot">
        {confirming ? (
          <div className="delete-confirm" role="alertdialog">
            <p>
              {t(
                'Тема удалится вместе с её связями и материалами. Подтемы поднимутся на уровень выше.',
                'The topic is deleted with its links and materials. Subtopics move up a level.',
              )}
            </p>
            <div className="dialog-actions">
              <Button onClick={() => setConfirming(false)}>{t('Отмена', 'Cancel')}</Button>
              <Button variant="danger" onClick={() => onDelete(node.id)}>
                {t('Удалить тему', 'Delete topic')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            <Icon name="trash" size={16} />
            {t('Удалить', 'Delete')}
          </Button>
        )}
      </footer>
    </div>
  )
}
