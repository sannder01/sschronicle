import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { call, client, login } from './helpers'

test('main routes fit phone, tablet and desktop in light and dark themes', async ({
  page,
  context,
  playwright,
}) => {
  await login(context)
  const api = await client(playwright)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const routes = ['tasks', 'habits', 'challenges', 'calendar', 'notes', 'profile', 'progress']
  const output = path.resolve('docs/screenshots')
  await mkdir(output, { recursive: true })

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    for (const theme of ['light', 'dark']) {
      await call(api, '/api/profile', 'PATCH', { settings: { theme } })
      for (const route of routes) {
        await page.goto(`/app/${route}`)
        await expect(page.locator('main')).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        expect(scrollWidth, `${width}px ${theme} /app/${route} overflow`).toBeLessThanOrEqual(
          width + 1,
        )
        if (
          (width === 390 && route === 'challenges') ||
          (width === 768 && route === 'notes') ||
          (width === 1440 && route === 'tasks')
        ) {
          await page.screenshot({
            path: path.join(output, `${route}-${width}-${theme}.png`),
            fullPage: true,
          })
        }
      }
    }
  }
  expect(errors).toEqual([])
  await api.dispose()
})
