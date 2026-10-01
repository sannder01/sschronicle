import { test, expect } from '@playwright/test'
import { login, unique, baseURL } from './helpers'
import { todayInZone } from '../../lib/dates'

test.beforeEach(async ({ context }) => login(context))

test('task and folder UI, calendar editing, persistence and browser history', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const title = unique('Подготовить проект'),
    folder = unique('Рабочие планы'),
    today = todayInZone('Asia/Qyzylorda')
  await page.goto('/app/tasks')
  await page.getByRole('button', { name: 'Создать папку', exact: true }).click()
  await page.getByLabel('Название папки', { exact: true }).fill(folder)
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: 'Новая задача', exact: true }).click()
  await page.getByLabel('Название', { exact: true }).fill(title)
  await page.getByLabel('Дата', { exact: true }).fill(today)
  await page.getByLabel('Время', { exact: true }).fill('15:45')
  await page.getByRole('combobox', { name: 'Приоритет', exact: true }).selectOption('high')
  await page.getByRole('combobox', { name: 'Папка', exact: true }).selectOption({ label: folder })
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Календарь', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/calendar/)
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Изменить: ${title}`, exact: true }).click()
  await page.getByLabel('Название', { exact: true }).fill(title + ' готов')
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.reload()
  await expect(page.getByText(title + ' готов', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/app\/tasks$/)
  await expect(page.getByText(title + ' готов', { exact: true })).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(/\/app\/calendar/)
  await page.getByRole('button', { name: `Выполнить: ${title} готов`, exact: true }).click()
  await expect(
    page.getByRole('button', { name: `Отменить выполнение: ${title} готов`, exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Задачи', exact: true }).click()
  await page.getByRole('button', { name: 'Выполненные', exact: true }).click()
  await page.getByRole('button', { name: `Изменить: ${title} готов`, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await page.getByRole('button', { name: 'Да, удалить', exact: true }).click()
  await expect(page.getByText(title + ' готов', { exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: `Изменить папку: ${folder}`, exact: true }).click()
  await page.getByRole('button', { name: 'Удалить папку', exact: true }).click()
  await page.getByRole('button', { name: 'Подтвердить удаление', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(errors).toEqual([])
})

test('notes editor saves formatting, retries network failures, detects concurrent edits and restores trash', async ({
  page,
  context,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const title = unique('Мысли о проекте')
  await page.goto('/app/notes?folder=all')
  await page
    .locator('.notes-list')
    .getByRole('button', { name: 'Новая заметка', exact: true })
    .click()
  await page.getByLabel('Название заметки', { exact: true }).fill(title)
  await page
    .getByRole('textbox', { name: 'Текст заметки', exact: true })
    .fill('Первая мысль\nВторая мысль')
  await expect(page.locator('.notes-save-status')).toHaveText('Сохранено')
  const id = new URL(page.url()).searchParams.get('note')
  await page.getByRole('textbox', { name: 'Текст заметки', exact: true }).click()
  await page.getByRole('button', { name: 'Форматирование', exact: true }).click()
  await page.getByRole('button', { name: 'Жирный', exact: true }).click()
  await page.getByRole('textbox', { name: 'Текст заметки', exact: true }).press('End')
  await page
    .getByRole('textbox', { name: 'Текст заметки', exact: true })
    .pressSequentially(' Важное')
  await expect(page.locator('.notes-save-status')).toHaveText('Сохранено')
  await page.reload()
  await expect(page.getByLabel('Название заметки', { exact: true })).toHaveValue(title)
  await expect(page.getByRole('textbox', { name: 'Текст заметки', exact: true })).toContainText(
    'Важное',
  )
  let block = true
  await page.route(`**/api/notes/${id}`, async (route) => {
    if (block && route.request().method() === 'PATCH') await route.abort('failed')
    else await route.continue()
  })
  await page.getByLabel('Название заметки', { exact: true }).fill(title + ' offline')
  await expect(
    page.getByText('Не удалось сохранить. Черновик сохранён на этом устройстве.', { exact: true }),
  ).toBeVisible()
  block = false
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(page.locator('.notes-save-status')).toHaveText('Сохранено')
  const current = await (await context.request.get(`/api/notes/${id}`)).json()
  const other = await context.request.patch(`/api/notes/${id}`, {
    headers: { Origin: baseURL },
    data: { version: current.version, title: 'Правка во второй вкладке' },
  })
  expect(other.ok()).toBe(true)
  await page.getByLabel('Название заметки', { exact: true }).fill(title + ' local')
  await expect(page.getByText('Заметка изменилась в другом окне', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Использовать серверную версию', exact: true }).click()
  await expect(page.getByLabel('Название заметки', { exact: true })).toHaveValue(
    'Правка во второй вкладке',
  )
  await page.getByRole('button', { name: 'Действия с заметкой', exact: true }).click()
  await page.getByRole('button', { name: 'Удалить заметку', exact: true }).click()
  await expect(page.getByLabel('Название заметки', { exact: true })).not.toBeVisible()
  await page.goto(`/app/notes?folder=trash&note=${id}`)
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click()
  await expect(page.getByText('Эта заметка в корзине.', { exact: true })).not.toBeVisible()
  await expect(page.getByLabel('Название заметки', { exact: true })).toHaveValue(
    'Правка во второй вкладке',
  )
  expect(errors).toEqual([])
})

test('challenge UI template, success mark and daily note', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/app/challenges')
  await page.getByRole('button', { name: '30 дней без сладкого', exact: false }).click()
  const dialog = page.getByRole('dialog')
  const title = unique('Без сладкого')
  await dialog.getByLabel('Название', { exact: true }).fill(title)
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/challenges\/\d+/)
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Отметить сегодня', exact: true }).click()
  await page.getByRole('button', { name: '✓ Выполнено', exact: true }).click()
  await page.getByLabel('Заметка к дню', { exact: true }).fill('Сегодня получилось')
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.locator('.challenge-ring')).toContainText('1 / 30')
  expect(errors).toEqual([])
})

test('habit UI creation, check-in, history and deletion', async ({ page }) => {
  const name = unique('Читать каждый день')
  await page.goto('/app/habits')
  await page.getByRole('button', { name: '+ Новая привычка', exact: true }).click()
  await page.getByLabel('Название', { exact: true }).fill(name)
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click()
  const card = page.locator('.habit-card').filter({ hasText: name })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: `Выполнить: ${name}`, exact: true }).click()
  await expect(card.getByRole('button', { name: `Отменить: ${name}`, exact: true })).toBeVisible()
  await page.reload()
  await expect(card.getByRole('button', { name: `Отменить: ${name}`, exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'История', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Закрыть / Close', exact: true }).click()
  await card.getByRole('button', { name: `Удалить ${name}`, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(card).not.toBeVisible()
})

test('profile UI preferences persist on reload and sign-out protects private pages', async ({
  page,
  context,
}) => {
  await login(context, 'b')
  await page.goto('/app/profile')
  await page.getByLabel('Тема', { exact: false }).selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('combobox', { name: 'Язык', exact: true }).selectOption('en')
  await expect(page.getByRole('heading', { name: 'Make it yours.', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ru')
  await page.getByLabel('Тема', { exact: false }).selectOption('light')
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить', exact: true }).click()
  await expect(page).toHaveURL(/\/auth$/)
  await page.goto('/app/profile')
  await expect(page).toHaveURL(/\/auth$/)
})

test('mobile Notes is sequential, navigation remains reachable and keyboard focus works', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/notes')
  await expect(page.locator('.notes-folders')).toBeVisible()
  await expect(page.locator('.notes-list')).not.toBeVisible()
  await page.getByRole('button', { name: /Все заметки/ }).click()
  await expect(page.locator('.notes-list')).toBeVisible()
  await page
    .locator('.notes-list')
    .getByRole('button', { name: 'Новая заметка', exact: true })
    .click()
  await page.getByLabel('Название заметки', { exact: true }).fill('Мобильная заметка')
  await expect(page.locator('.notes-editor')).toBeVisible()
  await expect(page.locator('.notes-list')).not.toBeVisible()
  await page.getByRole('button', { name: 'Ещё', exact: true }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Календарь', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Календарь', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
})
