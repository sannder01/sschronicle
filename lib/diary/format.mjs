import { validDate } from '../dates.js'

export const PAPERS = ['ruled', 'grid', 'plain']
export const CARD_COLORS = ['sand', 'sage', 'rose', 'lavender']
export const INKS = ['ink', 'blue', 'rose', 'sage']
export const MOODS = ['happy', 'calm', 'inspired', 'tired']
export const LIMITS = { text: 30000, cards: 16, cardText: 2000, strokes: 120, points: 20000 }
export const emptyDiary = () => ({ text: '', paper: 'ruled', mood: null, cards: [], strokes: [] })
export const validDiaryDate = (day) => validDate(day) && !day.startsWith('0000')

export function validateDiary(value) {
  const invalid = () => { throw new Error('Invalid diary document') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  if (typeof value.text !== 'string' || value.text.length > LIMITS.text) invalid()
  if (!PAPERS.includes(value.paper) || (value.mood !== null && !MOODS.includes(value.mood))) invalid()
  if (!Array.isArray(value.cards) || value.cards.length > LIMITS.cards) invalid()
  if (!Array.isArray(value.strokes) || value.strokes.length > LIMITS.strokes) invalid()
  const ids = new Set()
  const id = (item) => {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || ids.has(item.id)) invalid()
    ids.add(item.id)
    return item.id
  }
  const cards = value.cards.map((card) => {
    const key = id(card)
    if (typeof card.text !== 'string' || card.text.length > LIMITS.cardText || !CARD_COLORS.includes(card.color)) invalid()
    return { id: key, text: card.text, color: card.color }
  })
  let pointCount = 0
  const strokes = value.strokes.map((stroke) => {
    const key = id(stroke)
    if (!INKS.includes(stroke.color) || ![2, 4, 7].includes(stroke.width) || !Array.isArray(stroke.points) || !stroke.points.length || stroke.points.length > 2000) invalid()
    pointCount += stroke.points.length
    if (pointCount > LIMITS.points) invalid()
    const points = stroke.points.map((point) => {
      if (!Array.isArray(point) || point.length !== 2 || point.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)) invalid()
      return point.map((n) => Math.round(n * 100000) / 100000)
    })
    return { id: key, color: stroke.color, width: stroke.width, points }
  })
  return { text: value.text, paper: value.paper, mood: value.mood, cards, strokes }
}

export function strokePath(points) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x * 1000},${y * 560}`).join(' ')
}
