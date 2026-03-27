// aura-backend/src/__tests__/lib/billingUtils.test.ts
// TDD: testes para resolução de plano no webhook do Asaas
// Escrito ANTES da implementação para guiar o design

import { describe, it, expect } from 'vitest'
import { resolvePlanFromPayment } from '../../lib/billingUtils'

// ---------------------------------------------------------------------------
// resolvePlanFromPayment
// Lógica: prefere externalReference (planId salvo no checkout),
// cai de volta para mapeamento por valor se ausente.
// ---------------------------------------------------------------------------
describe('resolvePlanFromPayment', () => {
  describe('quando externalReference está presente', () => {
    it('retorna STARTER para externalReference "STARTER"', () => {
      expect(resolvePlanFromPayment({ externalReference: 'STARTER', value: 0 })).toBe('STARTER')
    })

    it('retorna PROFESSIONAL para externalReference "PROFESSIONAL"', () => {
      expect(resolvePlanFromPayment({ externalReference: 'PROFESSIONAL', value: 0 })).toBe('PROFESSIONAL')
    })

    it('retorna PREMIUM para externalReference "PREMIUM"', () => {
      expect(resolvePlanFromPayment({ externalReference: 'PREMIUM', value: 0 })).toBe('PREMIUM')
    })

    it('ignora o value quando externalReference é válido', () => {
      // value 999 normalmente cairia no fallback → STARTER, mas
      // externalReference PREMIUM deve prevalecer
      expect(resolvePlanFromPayment({ externalReference: 'PREMIUM', value: 999 })).toBe('PREMIUM')
    })
  })

  describe('quando externalReference está ausente ou inválido', () => {
    it('mapeia valor 97 para STARTER', () => {
      expect(resolvePlanFromPayment({ value: 97 })).toBe('STARTER')
    })

    it('mapeia valor 197 para PROFESSIONAL', () => {
      expect(resolvePlanFromPayment({ value: 197 })).toBe('PROFESSIONAL')
    })

    it('mapeia valor 397 para PREMIUM', () => {
      expect(resolvePlanFromPayment({ value: 397 })).toBe('PREMIUM')
    })

    it('retorna STARTER como fallback para valor desconhecido', () => {
      expect(resolvePlanFromPayment({ value: 999 })).toBe('STARTER')
    })

    it('trata externalReference null como ausente', () => {
      expect(resolvePlanFromPayment({ externalReference: null, value: 197 })).toBe('PROFESSIONAL')
    })

    it('trata externalReference string inválida como ausente', () => {
      expect(resolvePlanFromPayment({ externalReference: 'INVALID_PLAN', value: 97 })).toBe('STARTER')
    })
  })
})
