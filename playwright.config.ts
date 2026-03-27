import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração Playwright para testes E2E do Aura System.
 * Aponta para o ambiente de produção no Vercel.
 *
 * Para rodar localmente:
 *   npx playwright test
 *
 * Para rodar com UI:
 *   npx playwright test --ui
 *
 * Para rodar um arquivo específico:
 *   npx playwright test e2e/login.spec.ts
 */

const BASE_URL = process.env.E2E_BASE_URL || 'https://aura-system-mu.vercel.app';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    // Timeout razoável para carregamento da SPA no Vercel
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  timeout: 60_000,
});
