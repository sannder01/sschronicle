# Chronicle v2.0 — Deploy Guide

## Что изменилось в редизайне

### Visual (новое)
- **Кастомный курсор** — точка + кольцо с магнитным эффектом
- **Частицы** — улучшенный canvas с mouse-repulsion
- **Типографика** — Syne (display) + DM Sans (body) + DM Mono (data/mono)
- **Scanlines overlay** — тонкий ретро-эффект поверх всего
- **Premium task cards** — hover depth, приоритетные бейджи, XP-метка
- **Rank panel** — анимированное свечение ранга `pc-rank-glow`
- **XP bar** — liquid fill transition (0.9s cubic-bezier)
- **Staggered animations** — все элементы появляются с задержкой
- **SVG иконки** вместо emoji в системных элементах
- **Level Up Modal** — улучшенная анимация с pulse rings

### Tech
- Добавлены: `@studio-freight/lenis`, `gsap`
- Все стили переведены в CSS-классы (vs inline styles)
- CSS Custom Properties для тем (`--primary`, `--text`, etc.)
- Полная поддержка тёмных тем через CSS variables

---

## Шаг 1 — Замени файлы

Скопируй следующие файлы из этого архива в свой проект:

```
app/layout.js           → замени существующий
app/auth/page.js        → замени существующий
components/PlannerClient.js → замени существующий
package.json            → замени существующий
```

**НЕ трогай** (оставь как есть):
```
app/api/*               — весь бэкенд
app/app/page.js
app/page.js
lib/*
hooks/*
scripts/*
.env.local
vercel.json
```

---

## Шаг 2 — Установи зависимости

```bash
npm install
# или
yarn install
```

Новые пакеты: `@studio-freight/lenis@^1.0.42`, `gsap@^3.12.5`

---

## Шаг 3 — Railway (PostgreSQL)

Railway уже должен быть настроен. Проверь что в `.env.local` есть:

```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://твой-домен.vercel.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Шаг 4 — Vercel Deploy

```bash
# Если первый раз
npx vercel

# Если уже подключён
git add .
git commit -m "feat: Chronicle v2.0 premium redesign"
git push
```

Vercel подхватит push автоматически.

---

## Шаг 5 — Vercel Environment Variables

В Vercel Dashboard → Settings → Environment Variables добавь все из .env.local.

---

## Опционально — Lenis smooth scroll

Если хочешь добавить Lenis (плавный скролл), создай `components/SmoothScroll.js`:

```jsx
'use client'
import { useEffect } from 'react'
import Lenis from '@studio-freight/lenis'

export default function SmoothScroll({ children }) {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
    const raf = time => { lenis.raf(time); requestAnimationFrame(raf) }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])
  return children
}
```

Затем оберни в `app/layout.js`:
```jsx
import SmoothScroll from '@/components/SmoothScroll'
// ...
<body>
  <SmoothScroll>
    <Providers>{children}</Providers>
  </SmoothScroll>
</body>
```

---

## Опционально — GSAP для анимаций

В любом компоненте:

```jsx
'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// Пример: анимировать XP bar при монтировании
useEffect(() => {
  gsap.fromTo('.pc-xp-fill', { width: 0 }, { width: `${xpProgress}%`, duration: 1.2, ease: 'power3.out' })
}, [xpProgress])
```

---

## Темы

Переключение между темами сохраняется в `localStorage('chronicle_theme')`.
Доступные: `void`, `meaCulpa`, `nebula`, `sakura`.

---

## Известные нюансы

1. **Кастомный курсор** — автоматически скрывает системный (`cursor: none`).
   На мобиле не мешает — touch events не триггерят mousemove.

2. **Canvas частицы** — пересоздаются при смене темы (цвет адаптируется к `t.primary`).

3. **Fonts** — загружаются через Google Fonts в `@import`. 
   Для продакшена лучше использовать `next/font`:
   ```js
   import { Syne, DM_Sans, DM_Mono } from 'next/font/google'
   ```
   Но текущая реализация работает корректно.
