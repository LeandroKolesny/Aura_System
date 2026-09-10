// aura-backend/src/__tests__/lib/planPermissions.test.ts
// Regras de negócio de bloqueio por plano/assinatura vencida. Estas funções são
// chamadas pelo apiGuards em ~19 rotas de mutação — antes só havia um teste de
// tipo aqui. Cobre isReadOnlyMode, hasModuleAccess, canCreatePatient/
// canCreateProfessional e getPlanErrorMessage.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: { saasPlan: { findMany: vi.fn() } },
}))

import prisma from '@/lib/prisma'
import {
  isReadOnlyMode,
  hasModuleAccess,
  canCreatePatient,
  canCreateProfessional,
  getPlanErrorMessage,
  invalidatePlansCache,
} from '../../lib/planPermissions'

type Plan = 'FREE' | 'BASIC' | 'STARTER' | 'PROFESSIONAL' | 'PREMIUM' | 'ENTERPRISE'
type SubStatus = 'ACTIVE' | 'TRIAL' | 'OVERDUE' | 'CANCELED'

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000)

const PLANS_DB = [
  { name: 'STARTER', modules: ['online_booking', 'financial'], maxPatients: 100, maxProfessionals: 2 },
  { name: 'PROFESSIONAL', modules: ['online_booking', 'financial', 'crm', 'reports'], maxPatients: -1, maxProfessionals: -1 },
]

function company(over: Partial<{ plan: Plan; subscriptionStatus: SubStatus; subscriptionExpiresAt: Date | null }> = {}) {
  return {
    plan: 'STARTER' as Plan,
    subscriptionStatus: 'ACTIVE' as SubStatus,
    subscriptionExpiresAt: FUTURE,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  invalidatePlansCache()
  vi.mocked(prisma.saasPlan.findMany).mockResolvedValue(PLANS_DB as never)
})

describe('isReadOnlyMode', () => {
  it('plano BASIC → true', () => {
    expect(isReadOnlyMode(company({ plan: 'BASIC' }))).toBe(true)
  })

  it('subscriptionStatus OVERDUE → true (mesmo com data futura)', () => {
    expect(isReadOnlyMode(company({ subscriptionStatus: 'OVERDUE', subscriptionExpiresAt: FUTURE }))).toBe(true)
  })

  it('subscriptionStatus CANCELED → true', () => {
    expect(isReadOnlyMode(company({ subscriptionStatus: 'CANCELED', subscriptionExpiresAt: FUTURE }))).toBe(true)
  })

  it('TRIAL expirado → true', () => {
    expect(isReadOnlyMode(company({ subscriptionStatus: 'TRIAL', subscriptionExpiresAt: PAST }))).toBe(true)
  })

  it('TRIAL ainda válido → false', () => {
    expect(isReadOnlyMode(company({ subscriptionStatus: 'TRIAL', subscriptionExpiresAt: FUTURE }))).toBe(false)
  })

  it('ACTIVE com data futura → false', () => {
    expect(isReadOnlyMode(company())).toBe(false)
  })
})

describe('hasModuleAccess', () => {
  it('assinatura CANCELED → false mesmo que o plano tenha o módulo', async () => {
    expect(await hasModuleAccess(company({ subscriptionStatus: 'CANCELED' }), 'financial')).toBe(false)
  })

  it('assinatura expirada → false', async () => {
    expect(await hasModuleAccess(company({ subscriptionExpiresAt: PAST }), 'financial')).toBe(false)
  })

  it('módulo presente no plano → true', async () => {
    expect(await hasModuleAccess(company({ plan: 'STARTER' }), 'financial')).toBe(true)
  })

  it('módulo ausente no plano → false', async () => {
    expect(await hasModuleAccess(company({ plan: 'STARTER' }), 'crm')).toBe(false)
  })

  it('plano não encontrado no banco → false', async () => {
    expect(await hasModuleAccess(company({ plan: 'ENTERPRISE' }), 'financial')).toBe(false)
  })
})

describe('canCreatePatient', () => {
  it('limite -1 (ilimitado) → true', async () => {
    expect(await canCreatePatient(company({ plan: 'PROFESSIONAL' }), 5000)).toBe(true)
  })

  it('abaixo do limite → true', async () => {
    expect(await canCreatePatient(company({ plan: 'STARTER' }), 99)).toBe(true)
  })

  it('limite atingido → false', async () => {
    expect(await canCreatePatient(company({ plan: 'STARTER' }), 100)).toBe(false)
  })

  it('isReadOnlyMode bloqueia mesmo com vagas livres', async () => {
    expect(await canCreatePatient(company({ plan: 'STARTER', subscriptionStatus: 'OVERDUE' }), 0)).toBe(false)
  })
})

describe('canCreateProfessional', () => {
  it('limite -1 (ilimitado) → true', async () => {
    expect(await canCreateProfessional(company({ plan: 'PROFESSIONAL' }), 999)).toBe(true)
  })

  it('abaixo do limite → true', async () => {
    expect(await canCreateProfessional(company({ plan: 'STARTER' }), 1)).toBe(true)
  })

  it('limite atingido → false', async () => {
    expect(await canCreateProfessional(company({ plan: 'STARTER' }), 2)).toBe(false)
  })

  it('isReadOnlyMode bloqueia mesmo com vagas livres', async () => {
    expect(await canCreateProfessional(company({ plan: 'STARTER', subscriptionStatus: 'CANCELED' }), 0)).toBe(false)
  })
})

describe('getPlanErrorMessage', () => {
  it('CANCELED → mensagem de assinatura cancelada', async () => {
    const msg = await getPlanErrorMessage(company({ subscriptionStatus: 'CANCELED' }))
    expect(msg).toMatch(/cancelada/i)
  })

  it('modo somente leitura (BASIC) → mensagem de plano expirado', async () => {
    const msg = await getPlanErrorMessage(company({ plan: 'BASIC' }))
    expect(msg).toMatch(/somente leitura/i)
  })

  it('módulo sem acesso no plano → mensagem citando upgrade', async () => {
    const msg = await getPlanErrorMessage(company({ plan: 'STARTER' }), 'crm')
    expect(msg).toMatch(/não está disponível/i)
    expect(msg).toMatch(/upgrade/i)
  })

  it('sem módulo e sem bloqueio → mensagem genérica de acesso negado', async () => {
    const msg = await getPlanErrorMessage(company())
    expect(msg).toBe('Acesso negado. Verifique seu plano.')
  })
})
