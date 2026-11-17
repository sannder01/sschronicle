import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.beforeEach(async ({ context }) => login(context))
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

const SHOTS = process.env.SCHEDULE_SHOTS

test('phone: bottom nav has Notes, "More" is a sheet that swipes away, toasts by sonner', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/app/tasks')
  const bottom = page.getByRole('navigation', { name: 'Нижняя навигация' })
  await expect(bottom.getByRole('link', { name: 'Заметки' })).toBeVisible()

  // "More" opens as a vaul bottom sheet
  await bottom.getByRole('button', { name: 'Ещё' }).click()
  const sheet = page.getByRole('dialog', { name: 'Ваше пространство' })
  await expect(sheet).toBeVisible()
  await expect(page.locator('.sheet')).toBeVisible()
  await page.waitForTimeout(600) // vaul ignores drags while the sheet is still opening
  if (SHOTS) await page.screenshot({ path: SHOTS + '/sheet-390.png' })
  // drag the handle down: it follows the finger and dismisses
  const handle = await page.locator('.sheet-handle').boundingBox()
  await page.mouse.move(handle.x + 20, handle.y + 2)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) await page.mouse.move(handle.x + 20, handle.y + 2 + i * 40)
  await page.mouse.up()
  await expect(sheet).toBeHidden()

  // and it navigates
  await bottom.getByRole('button', { name: 'Ещё' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Доска' }).click()
  await expect(page).toHaveURL(/\/app\/board/)
  await expect(page.getByRole('dialog')).toBeHidden()

  // a toast from sonner after saving the profile name
  await page.goto('/app/profile')
  await page.getByLabel('Имя', { exact: true }).fill('Александр М.')
  await page.getByRole('button', { name: 'Сохранить имя' }).click()
  await expect(page.locator('[data-sonner-toast]').getByText('Изменения сохранены')).toBeVisible()
  if (SHOTS) await page.screenshot({ path: SHOTS + '/toast-390.png' })
  await page.getByLabel('Имя', { exact: true }).fill('Александр')
  await page.getByRole('button', { name: 'Сохранить имя' }).click()
  expect(errors).toEqual([])
})
