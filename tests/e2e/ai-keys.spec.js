import { test, expect } from '@playwright/test'
import { login, client, call } from './helpers'

test.beforeEach(async ({ context }) => login(context))

test('profile AI panel: providers, key field, no key leaks, safe API errors', async ({
  page,
  playwright,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const api = await client(playwright)

  const state = await call(api, '/api/profile/ai')
  expect(state.configured).toBe(false)
  expect(state.providers.map((p) => p.id)).toEqual(['groq', 'gemini'])
  expect(JSON.stringify(state)).not.toContain('ciphertext')

  // changing the model needs a saved key; listing models of a saved key needs one too
  const put = await api.fetch('/api/profile/ai', {
    method: 'PUT',
    data: { provider: 'gemini', model: 'gemini-3.5-flash' },
  })
  expect(put.status()).toBe(400)
  expect((await api.fetch('/api/profile/ai/models')).status()).toBe(404)
  // keys with spaces or too short are refused before any provider call
  for (const api_key of ['short', 'has space in the key 123'])
    expect(
      (
        await api.fetch('/api/profile/ai/models', {
          method: 'POST',
          data: { provider: 'groq', api_key },
        })
      ).status(),
    ).toBe(400)
  await call(api, '/api/profile/ai', 'DELETE')

  await page.goto('/app/profile')
  const panel = page.locator('section#ai')
  await expect(panel.getByRole('heading', { name: 'AI-помощник' })).toBeVisible()
  await panel.getByRole('radio', { name: 'Google Gemini' }).click()
  await expect(panel.getByRole('link', { name: 'aistudio.google.com/apikey' })).toBeVisible()
  const keyField = panel.getByLabel(/API-ключ/)
  await expect(keyField).toHaveAttribute('type', 'password')
  await expect(panel.getByRole('button', { name: 'Проверить ключ' })).toBeDisabled()
  await keyField.fill('AIza-test-key-0000')
  await expect(panel.getByRole('button', { name: 'Проверить ключ' })).toBeEnabled()
  expect(errors).toEqual([])
})

test('graph and concept map open full screen and lock the page scroll', async ({
  page,
  playwright,
}) => {
  const api = await client(playwright)
  await call(api, '/api/tasks', 'POST', { title: 'Полноэкранная задача ' + Date.now() }, 201)
  const map = await call(api, '/api/learning/maps', 'POST', { title: 'Карта ' + Date.now() }, 201)
  await call(api, `/api/learning/maps/${map.id}/nodes`, 'POST', { title: 'Тема' }, 201)

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/app/board')
    await page.getByRole('button', { name: 'Во весь экран' }).click()
    const graph = page.locator('.graph.is-full')
    await expect(graph).toBeVisible()
    const box = await graph.boundingBox()
    expect(Math.round(box.width)).toBe(viewport.width)
    expect(Math.round(box.height)).toBe(viewport.height)
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden')
    await page.getByRole('button', { name: 'Выйти из полноэкранного режима' }).click()
    await expect(graph).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')

    await page.goto('/app/learning/' + map.id)
    if (viewport.width < 900) await page.getByRole('button', { name: 'Карта', exact: true }).click()
    await page.getByRole('button', { name: 'Во весь экран' }).click()
    await expect(page.locator('.cm-board.is-full')).toBeVisible()
    // a topic opened in full screen shows its details above the map
    await page.locator('.cm-card-body').first().click()
    await expect(page.getByRole('radio', { name: 'Освоено' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.locator('.cm-board.is-full')).toHaveCount(0)
  }
  await call(api, '/api/learning/maps/' + map.id, 'DELETE')
})
