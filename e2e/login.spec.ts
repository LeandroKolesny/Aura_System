import { test, expect } from '@playwright/test';
import { gotoLogin, loginAs, DEMO_CREDENTIALS } from './helpers';

test.describe('Login — /login', () => {
  test('exibe o formulário de login ao acessar /login', async ({ page }) => {
    await gotoLogin(page);
    await expect(page.locator('input[placeholder="seu@email.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /acessar sistema/i })).toBeVisible();
  });

  test('exibe link "Esqueci minha senha"', async ({ page }) => {
    await gotoLogin(page);
    const link = page.getByRole('link', { name: /esqueci minha senha/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /esqueci-senha/);
  });

  test('exibe erro ao submeter credenciais inválidas', async ({ page }) => {
    await loginAs(page, 'invalido@test.com', 'senhaerrada');
    await expect(
      page.locator('text=/Usuário ou senha incorretos|Erro ao fazer login/i')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('exibe erro ao submeter formulário vazio', async ({ page }) => {
    await gotoLogin(page);
    await page.click('button[type="submit"]');
    // HTML5 native validation ou erro — continua na mesma página
    await expect(page).toHaveURL(/login/);
  });

  test('login bem-sucedido redireciona para o dashboard', async ({ page }) => {
    await loginAs(page, DEMO_CREDENTIALS.owner.email, DEMO_CREDENTIALS.owner.password);
    await page.waitForURL(/\/(dashboard|schedule|billing)/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/login/);
  });

  test('exibe botão "Cadastre-se grátis" que abre formulário de registro', async ({ page }) => {
    await gotoLogin(page);
    const registerBtn = page.getByRole('button', { name: /cadastre-se grátis/i });
    await expect(registerBtn).toBeVisible();
    await registerBtn.click();
    await expect(page.getByPlaceholder('Ex: Dra. Ana Silva')).toBeVisible({ timeout: 5_000 });
  });

  test('link "Voltar ao site" navega para a landing page', async ({ page }) => {
    await gotoLogin(page);
    const backLink = page.getByRole('link', { name: /voltar ao site/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    // Landing page está em / — pode ser "/" ou "" no final
    await expect(page).toHaveURL(/^https?:\/\/[^/]+(\/)?$/);
  });
});
