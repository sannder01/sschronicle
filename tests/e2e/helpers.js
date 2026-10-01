import { expect } from '@playwright/test'
export const baseURL = 'http://127.0.0.1:3100'
export async function login(context, owner = 'a') {
  await context.addCookies([
    {
      name: 'next-auth.session-token',
      value: `chronicle-test-session-${owner}`,
      url: baseURL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}
export async function client(playwright, owner = 'a') {
  return playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Origin: baseURL,
      Cookie: `next-auth.session-token=chronicle-test-session-${owner}`,
    },
  })
}
export async function call(api, path, method = 'GET', data, status = 200) {
  const response = await api.fetch(path, { method, ...(data === undefined ? {} : { data }) })
  expect(response.status(), `${method} ${path}: ${await response.text()}`).toBe(status)
  return response.json()
}
export const unique = (label) => `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
