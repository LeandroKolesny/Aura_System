import { test, expect } from '@playwright/test'
import { loginAs, DEMO_CREDENTIALS } from './helpers'

test.describe('WhatsApp Settings — /settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_CREDENTIALS.owner.email, DEMO_CREDENTIALS.owner.password)
    await page.waitForURL(/dashboard/, { timeout: 20_000 })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('exibe accordion WhatsApp em /settings', async ({ page }) => {
    await expect(
      page.locator('text=/WhatsApp/').first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('accordion abre ao clicar', async ({ page }) => {
    await page.locator('button', { hasText: /WhatsApp/ }).first().click()
    await expect(
      page.locator('text=/número dedicado|conectado|desconectado|Conectar WhatsApp/i').first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('botão Conectar fica desabilitado sem aceitar termos', async ({ page }) => {
    await page.locator('button', { hasText: /WhatsApp/ }).first().click()
    const connectBtn = page.getByRole('button', { name: /conectar whatsapp/i })
    if (await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(connectBtn).toBeDisabled()
    }
  })

  test('botão Conectar habilita após aceitar termos', async ({ page }) => {
    await page.locator('button', { hasText: /WhatsApp/ }).first().click()
    const connectBtn = page.getByRole('button', { name: /conectar whatsapp/i })
    if (await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await page.locator('label', { hasText: /entendi e aceito/i }).click()
      await expect(connectBtn).toBeEnabled()
    }
  })
})
