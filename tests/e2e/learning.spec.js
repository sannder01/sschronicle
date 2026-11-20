import { test, expect } from '@playwright/test'
import { login, client, call, unique } from './helpers'

test.beforeEach(async ({ context }) => login(context))

test('learning: maps, sections, topics, next step, status, materials, XP', async ({
  page,
  playwright,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const api = await client(playwright)
  const xpBefore = (await call(api, '/api/profile')).stats.xp

  // create a map from the UI
  const title = unique('AITU')
  await page.goto('/app/learning')
  await expect(page.getByRole('heading', { name: 'Обучение', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Новая карта' }).first().click()
  await page.getByRole('textbox', { name: 'Название' }).fill(title)
  await page.getByRole('textbox', { name: 'Тема' }).fill('Университет')
  await page.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const root = (await call(api, '/api/learning/maps')).find((m) => m.title === title)
  expect(root.topic).toBe('Университет')

  // a section inside it, with topics and a dependency
  const section = await call(
    api,
    '/api/learning/maps',
    'POST',
    { title: 'Матанализ', parent_id: root.id },
    201,
  )
  const node = (body) => call(api, `/api/learning/maps/${section.id}/nodes`, 'POST', body, 201)
  const limits = await node({ title: 'Пределы' })
  const derivatives = await node({ title: 'Производные' })
  await node({ title: 'Пределы последовательностей', kind: 'subtopic', parent_id: limits.id })
  await call(
    api,
    `/api/learning/maps/${section.id}/edges`,
    'POST',
    { from_id: limits.id, to_id: derivatives.id },
    201,
  )
  // a dependency loop is refused
  const loop = await api.fetch(`/api/learning/maps/${section.id}/edges`, {
    method: 'POST',
    data: { from_id: derivatives.id, to_id: limits.id },
  })
  expect(loop.status()).toBe(400)
  expect((await loop.json()).code).toBe('CYCLE')

  // breadcrumbs and the next step
  await page.goto('/app/learning/' + section.id)
  const crumbs = page.getByRole('navigation', { name: 'Где вы' })
  await expect(crumbs.getByRole('link', { name: title })).toBeVisible()
  await expect(crumbs.getByText('Матанализ')).toBeVisible()
  const next = page.locator('.lm-next-button')
  await expect(next).toContainText('Пределы')
  // the assistant is off in the test server, and the page says so
  await expect(page.getByRole('note')).toContainText('AI-помощник пока недоступен')

  // open the topic and master it
  await next.click()
  await page.getByRole('radio', { name: 'Освоено' }).click()
  await expect
    .poll(async () => {
      const map = await call(api, '/api/learning/maps/' + section.id)
      return map.nodes.find((n) => n.id === limits.id).status
    })
    .toBe('mastered')
  await expect(next).toContainText('Производные')
  await expect.poll(async () => (await call(api, '/api/profile')).stats.xp).toBe(xpBefore + 30)

  // add a link to the topic
  await page.locator('.lm-next-button').click()
  await page.getByRole('button', { name: 'Добавить материал' }).click()
  await page.getByRole('textbox', { name: 'Название материала' }).fill('Конспект')
  await page.getByRole('textbox', { name: 'URL' }).fill('https://example.com/notes')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Конспект' })).toHaveAttribute(
    'href',
    'https://example.com/notes',
  )

  // list view shows the tree
  await page.getByRole('button', { name: 'Список' }).click()
  await expect(page.locator('.lm-tree-row')).toHaveCount(3)
  await expect(page.locator('.lm-tree-row.next', { hasText: 'Производные' })).toHaveCount(1)

  // overall progress counts the section inside the root map
  await page.goto('/app/learning')
  await expect(page.locator('.lm-card', { hasText: title })).toContainText('1/3')

  // another account cannot see or change this map
  const other = await client(playwright, 'b')
  expect((await other.fetch('/api/learning/maps/' + section.id)).status()).toBe(404)
  expect(
    (
      await other.fetch('/api/learning/nodes/' + limits.id, {
        method: 'PATCH',
        data: { status: 'learning' },
      })
    ).status(),
  ).toBe(404)

  // undoing mastery takes the XP back
  await call(api, '/api/learning/nodes/' + limits.id, 'PATCH', { status: 'review' })
  await expect.poll(async () => (await call(api, '/api/profile')).stats.xp).toBe(xpBefore)

  // delete the root map with confirmation; the section goes with it
  await page.goto('/app/learning/' + root.id)
  await page.getByRole('button', { name: 'Настройки карты' }).click()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()
  await page.getByRole('button', { name: 'Удалить навсегда' }).click()
  await expect(page).toHaveURL(/\/app\/learning$/)
  expect((await api.fetch('/api/learning/maps/' + section.id)).status()).toBe(404)
  expect(errors).toEqual([])
})

test('learning: assistant reports when it is not configured', async ({ playwright }) => {
  const api = await client(playwright)
  expect((await call(api, '/api/learning/assistant')).available).toBe(false)
  const map = await call(api, '/api/learning/maps', 'POST', { title: unique('Наука') }, 201)
  const response = await api.fetch('/api/learning/assistant', {
    method: 'POST',
    data: { mode: 'structure', map_id: map.id, topic: 'Физика' },
  })
  expect(response.status()).toBe(503)
  expect((await response.json()).code).toBe('AI_NOT_CONFIGURED')
  await call(api, '/api/learning/maps/' + map.id, 'DELETE')
})
