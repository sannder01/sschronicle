// app/api/ai/food/route.js
// Server-side proxy for Anthropic AI food calorie lookup
// Keeps API key secure, handles CORS

import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { query, lang = 'ru' } = await req.json()
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const prompt = lang === 'en'
      ? `You are a nutrition expert. For the food item "${query.trim()}", return ONLY a JSON object (no markdown, no explanation) with these fields: name (string), calories (number, kcal per 100g or per serving if specified), protein (number, grams), fat (number, grams), carbs (number, grams). Example: {"name":"Boiled egg","calories":78,"protein":6.3,"fat":5.0,"carbs":0.6}`
      : `Ты эксперт по питанию. Для блюда или продукта "${query.trim()}" верни ТОЛЬКО JSON объект (без markdown, без пояснений) с полями: name (строка, название на русском), calories (число, ккал на 100г или на порцию если указано), protein (число, граммы), fat (число, граммы), carbs (число, граммы). Пример: {"name":"Варёное яйцо","calories":78,"protein":6.3,"fat":5.0,"carbs":0.6}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // fast + cheap for simple lookups
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 })
    }

    const data = await res.json()
    const text = data.content?.map(b => b.text || '').join('') || ''
    const clean = text.replace(/```json|```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 502 })
    }

    // Validate fields
    const result = {
      name:     String(parsed.name     || query),
      calories: Number(parsed.calories || 0),
      protein:  Number(parsed.protein  || 0),
      fat:      Number(parsed.fat      || 0),
      carbs:    Number(parsed.carbs    || 0),
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('AI food route error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
