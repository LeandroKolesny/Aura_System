import { test, expect } from '@playwright/test';

/**
 * Testes da página de agendamento público (/booking/:slug)
 *
 * Usa slug "demo" como fallback — se a clínica não existir, valida a mensagem de erro.
 * Para testar o fluxo completo, defina E2E_BOOKING_SLUG=<slug-real> no ambiente.
 */
const BOOKING_SLUG = process.env.E2E_BOOKING_SLUG || 'demo';

test.describe('Agendamento público — /booking/:slug', () => {
  test('exibe spinner ou conteúdo ao acessar URL de agendamento', async ({ page }) => {
    await page.goto(`/booking/${BOOKING_SLUG}`);
    // Aguarda o carregamento (spinner ou conteúdo ou mensagem de erro)
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    // Deve renderizar algo — não uma tela em branco
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(10);
  });

  test('exibe mensagem de erro para slug inexistente', async ({ page }) => {
    await page.goto('/booking/slug-que-nao-existe-xyz-99999');
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    // Deve mostrar mensagem de clínica não encontrada
    const content = page.locator('text=/não encontrad|inválid|link inválido/i');
    await expect(content).toBeVisible({ timeout: 10_000 });
  });

  test('wizard mostra passo 1 (seleção de procedimento) para slug válido', async ({ page }) => {
    await page.goto(`/booking/${BOOKING_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // Se carregou com sucesso (clínica existe), deve mostrar procedimentos ou passo 1
    const hasError = await page.locator('text=/não encontrad|inválid/i').isVisible();
    if (!hasError) {
      // Deve conter algum elemento de seleção de procedimento
      await expect(
        page.locator('text=/procedimento|serviço|escolha/i').first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});
