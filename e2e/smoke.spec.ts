import { test, expect } from '@playwright/test'

test.describe('Smoke (gebaute App)', () => {
  test('Startseite lädt und Titel enthält ArioVan', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/ArioVan/i)
  })

  test('Root rendert React (Root-Container vorhanden)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#root')).toBeVisible()
  })
})
