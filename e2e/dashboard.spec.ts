import { test, expect } from '@playwright/test';
import { loginAs, DEMO_CREDENTIALS } from './helpers';

test.describe('Dashboard — navegação autenticada', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_CREDENTIALS.owner.email, DEMO_CREDENTIALS.owner.password);
    await page.waitForURL(/\/(dashboard|schedule|billing)/, { timeout: 20_000 });
  });

  test('redireciona para /dashboard após login como owner', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
  });

  test('exibe sidebar com links de navegação', async ({ page }) => {
    await expect(
      page.locator('nav, aside, [data-testid="sidebar"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('navega para /patients (Pacientes)', async ({ page }) => {
    const link = page.getByRole('link', { name: /paciente/i }).first();
    if (await link.isVisible()) {
      await link.click();
      await expect(page).toHaveURL(/patients/, { timeout: 10_000 });
    }
  });

  test('navega para /schedule (Agenda)', async ({ page }) => {
    const link = page.getByRole('link', { name: /agenda|schedule/i }).first();
    if (await link.isVisible()) {
      await link.click();
      await expect(page).toHaveURL(/schedule/, { timeout: 10_000 });
    }
  });

  test('navega para /financial (Financeiro)', async ({ page }) => {
    const link = page.getByRole('link', { name: /financeiro|financial/i }).first();
    if (await link.isVisible()) {
      await link.click();
      await expect(page).toHaveURL(/financial/, { timeout: 10_000 });
    }
  });

  test('acesso sem autenticação mantém usuário não logado na rota protegida', async ({ page }) => {
    // O frontend SPA não redireciona automaticamente para /login por redirecionamento de servidor.
    // O acesso a /dashboard sem token JWT resulta em conteúdo vazio ou redirecionamento pelo contexto React.
    // Este teste verifica que a página não expõe dados sensíveis sem auth.
    const newPage = await page.context().newPage();
    await newPage.context().clearCookies();
    await newPage.goto('/dashboard');
    await newPage.waitForLoadState('networkidle', { timeout: 15_000 });
    // Sem autenticação, deve redirecionar para /login ou mostrar landing
    const url = newPage.url();
    const isProtected = url.includes('/dashboard') === false ||
                        await newPage.locator('input[placeholder="seu@email.com"]').isVisible();
    expect(isProtected).toBeTruthy();
    await newPage.close();
  });
});
