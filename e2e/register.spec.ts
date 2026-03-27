import { test, expect, Page } from '@playwright/test';

async function gotoRegister(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('input[placeholder="seu@email.com"]', { timeout: 20_000 });
  // O botão que abre o cadastro diz "Cadastre-se grátis"
  await page.getByRole('button', { name: /cadastre-se grátis/i }).click();
  await page.waitForSelector('input[placeholder="Ex: Dra. Ana Silva"]', { timeout: 10_000 });
}

test.describe('Registro de nova conta — /login (aba cadastro)', () => {
  test('exibe formulário de cadastro ao clicar em "Cadastre-se grátis"', async ({ page }) => {
    await gotoRegister(page);
    await expect(page.getByPlaceholder('Ex: Dra. Ana Silva')).toBeVisible();
    await expect(page.getByPlaceholder('Nome da sua clínica')).toBeVisible();
    await expect(page.getByPlaceholder('Digite seu melhor e-mail')).toBeVisible();
    await expect(page.getByPlaceholder('Escolha uma senha segura')).toBeVisible();
    await expect(page.getByPlaceholder('Repita a senha')).toBeVisible();
  });

  test('exibe erro se senhas não coincidem', async ({ page }) => {
    await gotoRegister(page);
    await page.getByPlaceholder('Ex: Dra. Ana Silva').fill('Maria Teste');
    await page.getByPlaceholder('Nome da sua clínica').fill('Clínica Teste');
    await page.getByPlaceholder('Digite seu melhor e-mail').fill('maria@teste.com');
    await page.getByPlaceholder('(99) 99999-9999').fill('(11) 99999-1234');
    await page.getByPlaceholder('Escolha uma senha segura').fill('Senha1234');
    await page.getByPlaceholder('Repita a senha').fill('SenhaDiferente');
    // Aceitar termos clicando no checkbox visível (sr-only workaround: clicar no label)
    await page.locator('label').filter({ hasText: /termos de uso/i }).click();
    await page.getByRole('button', { name: /criar conta/i }).click();
    await expect(
      page.locator('text=/senhas não coincidem/i')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('botão "Criar conta" fica desabilitado sem aceitar termos', async ({ page }) => {
    await gotoRegister(page);
    // Sem aceitar os termos, o botão deve estar desabilitado
    const submitBtn = page.getByRole('button', { name: /criar conta/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('botão habilita após aceitar os termos', async ({ page }) => {
    await gotoRegister(page);
    const submitBtn = page.getByRole('button', { name: /criar conta/i });
    await expect(submitBtn).toBeDisabled();
    // Aceitar termos
    await page.locator('label').filter({ hasText: /termos de uso/i }).click();
    await expect(submitBtn).toBeEnabled();
  });

  test('botão "Já tem uma conta" volta para o login', async ({ page }) => {
    await gotoRegister(page);
    await page.getByRole('button', { name: /já tem uma conta/i }).click();
    await expect(page.locator('input[placeholder="seu@email.com"]')).toBeVisible({ timeout: 5_000 });
  });
});
