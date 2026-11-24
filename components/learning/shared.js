'use client'
// Shared bits of the learning section: statuses, kinds, labels and API calls.
import { api } from '@/lib/client'

export const STATUSES = [
  { value: 'not_started', ru: 'Не начато', en: 'Not started' },
  { value: 'learning', ru: 'Изучаю', en: 'Learning' },
  { value: 'review', ru: 'Повторить', en: 'Review' },
  { value: 'mastered', ru: 'Освоено', en: 'Mastered' },
]
export const KINDS = [
  { value: 'topic', ru: 'Тема', en: 'Topic' },
  { value: 'subtopic', ru: 'Подтема', en: 'Subtopic' },
  { value: 'goal', ru: 'Цель', en: 'Goal' },
]
export const MAP_COLORS = [
  '#5e5ce6',
  '#007aff',
  '#30b0c7',
  '#34c759',
  '#ff9f0a',
  '#ff375f',
  '#af52de',
]
export const statusLabel = (value, t) => {
  const s = STATUSES.find((x) => x.value === value) || STATUSES[0]
  return t(s.ru, s.en)
}
export const kindLabel = (value, t) => {
  const k = KINDS.find((x) => x.value === value) || KINDS[0]
  return t(k.ru, k.en)
}

export const learningApi = {
  maps: () => api('/api/learning/maps'),
  map: (id) => api('/api/learning/maps/' + id),
  createMap: (body) => api('/api/learning/maps', { method: 'POST', body }),
  updateMap: (id, body) => api('/api/learning/maps/' + id, { method: 'PATCH', body }),
  deleteMap: (id) => api('/api/learning/maps/' + id, { method: 'DELETE' }),
  createNode: (mapId, body) =>
    api('/api/learning/maps/' + mapId + '/nodes', { method: 'POST', body }),
  updateNode: (id, body) => api('/api/learning/nodes/' + id, { method: 'PATCH', body }),
  deleteNode: (id) => api('/api/learning/nodes/' + id, { method: 'DELETE' }),
  savePositions: (mapId, positions) =>
    api('/api/learning/maps/' + mapId + '/positions', { method: 'PUT', body: { positions } }),
  createEdge: (mapId, from_id, to_id) =>
    api('/api/learning/maps/' + mapId + '/edges', { method: 'POST', body: { from_id, to_id } }),
  deleteEdge: (id) => api('/api/learning/edges/' + id, { method: 'DELETE' }),
  createMaterial: (nodeId, body) =>
    api('/api/learning/nodes/' + nodeId + '/materials', { method: 'POST', body }),
  updateMaterial: (id, body) => api('/api/learning/materials/' + id, { method: 'PATCH', body }),
  deleteMaterial: (id) => api('/api/learning/materials/' + id, { method: 'DELETE' }),
  apply: (mapId, body) => api('/api/learning/maps/' + mapId + '/apply', { method: 'POST', body }),
  summary: () => api('/api/learning/summary'),
  assistantStatus: () => api('/api/learning/assistant'),
  ask: (body) => api('/api/learning/assistant', { method: 'POST', body }),
}

/** Human message for a failed request, by the contract's error codes. */
export function errorText(error, t, fallback) {
  switch (error?.code) {
    case 'CYCLE':
      return t(
        'Такая связь создаст замкнутый круг зависимостей',
        'That link would make a dependency loop',
      )
    case 'DUPLICATE':
      return t('Такая связь уже есть', 'That link already exists')
    case 'LIMIT_REACHED':
      return t('Достигнут предел для этой карты', 'This map has reached its limit')
    case 'AI_NOT_CONFIGURED':
      return t('AI-помощник пока не настроен', 'The AI assistant is not set up yet')
    case 'AI_TIMEOUT':
      return t(
        'Помощник слишком долго думал. Попробуйте ещё раз или выберите более быструю модель (flash или flash-lite) в профиле → AI-помощник',
        'The assistant took too long. Try again or pick a faster model (flash or flash-lite) in Profile → AI assistant',
      )
    case 'AI_BAD_RESPONSE':
      return t(
        'Помощник прислал ответ, который не удалось разобрать. Попробуйте ещё раз',
        'The assistant sent an answer that could not be read. Try again',
      )
    case 'AI_BUSY': {
      const s = error?.data?.retry_after || 10
      return t(
        `Помощник сейчас занят (лимит бесплатного тарифа). Попробуйте через ${s} с`,
        `The assistant is busy (free tier limit). Try again in ${s} s`,
      )
    }
    case 'AI_KEY_INVALID':
      return t(
        'Ключ AI не принят провайдером. Проверьте или замените его в профиле',
        'The provider rejected the AI key. Check or replace it in your profile',
      )
    case 'AI_MODEL_UNAVAILABLE':
      return t(
        'Выбранная модель недоступна. Выберите другую в профиле → AI-помощник',
        'The selected model is not available. Pick another in Profile → AI assistant',
      )
    case 'AI_PROVIDER_ERROR':
      return t(
        'AI-сервис сейчас недоступен. Попробуйте позже',
        'The AI service is unavailable right now. Try later',
      )
    case 'RATE_LIMITED':
      return t(
        'Слишком много запросов к помощнику. Подождите немного',
        'Too many assistant requests. Wait a bit',
      )
    case 'NETWORK_ERROR':
      return t('Нет соединения', 'No connection')
    default:
      return error?.status === 400 && error?.message ? error.message : fallback
  }
}

/** Percent bar used across the section. */
export function ProgressBar({ value, label, small }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)))
  return (
    <div
      className={`lm-bar ${small ? 'small' : ''}`}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div style={{ width: v + '%' }} />
    </div>
  )
}

/** Circular percent, for summaries. */
export function ProgressRing({ value, size = 88 }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0))),
    r = (size - 10) / 2,
    c = 2 * Math.PI * r
  return (
    <svg
      className="lm-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle className="lm-ring-track" cx={size / 2} cy={size / 2} r={r} />
      <circle
        className="lm-ring-value"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
        {v}%
      </text>
    </svg>
  )
}
