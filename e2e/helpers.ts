import { Page } from '@playwright/test';

/** Credenciais demo disponíveis no sistema */
export const DEMO_CREDENTIALS = {
  owner: { email: 'king@aura.system', password: 'admin' },
  admin: { email: 'admin@aura.com', password: 'admin123' },
};

/** Navega para /login e aguarda o formulário de login aparecer */
export async function gotoLogin(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('input[placeholder="seu@email.com"]', { timeout: 20_000 });
}

/** Faz login com as credenciais fornecidas e aguarda redirecionamento */
export async function loginAs(page: Page, email: string, password: string) {
  await gotoLogin(page);
  await page.fill('input[placeholder="seu@email.com"]', email);
  await page.fill('input[placeholder="••••••••"]', password);
  await page.click('button[type="submit"]');
}
