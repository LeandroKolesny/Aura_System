import { test, expect } from '@playwright/test';

test.describe('Esqueci minha senha — /esqueci-senha', () => {
  test('exibe formulário com campo de e-mail', async ({ page }) => {
    await page.goto('/esqueci-senha');
    await expect(page.getByRole('heading', { name: 'Esqueceu sua senha?' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /enviar link de recuperação/i })).toBeVisible();
  });

  test('exibe mensagem de sucesso ao submeter email válido', async ({ page }) => {
    await page.goto('/esqueci-senha');
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
    await page.fill('input[type="email"]', 'qualquer@email.com');
    await page.getByRole('button', { name: /enviar link/i }).click();
    // API retorna sucesso mesmo para emails não cadastrados (evita enumeração)
    await expect(
      page.getByRole('heading', { name: /email enviado/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('link "Voltar para o login" navega de volta ao login', async ({ page }) => {
    await page.goto('/esqueci-senha');
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
    await page.getByRole('link', { name: /voltar para o login/i }).click();
    await expect(page).toHaveURL(/login/);
  });
});
