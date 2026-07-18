import { expect, test } from '@playwright/test'

test('changes visible actions when the policy subject changes', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'One typed policy. Two enforcement layers.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit NS-148 denied' })).toBeDisabled()

  await page.getByLabel('Acting as').selectOption('user-cora')
  await expect(page.getByRole('button', { name: 'Edit NS-148' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Edit NS-139 denied' })).toBeDisabled()

  await page.getByRole('button', { name: 'Edit NS-148' }).click()
  await expect(page.getByRole('status')).toContainText('protected API')
})

test('rejects a direct cross-tenant API bypass', async ({ request }) => {
  const response = await request.post('http://127.0.0.1:8787/api/issues/issue-4/close', {
    headers: { 'x-demo-user': 'user-malik' },
  })

  expect(response.status()).toBe(403)
  await expect(response.json()).resolves.toMatchObject({ code: 'policy_denied' })
})
