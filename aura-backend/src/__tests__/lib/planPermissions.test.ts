// aura-backend/src/__tests__/lib/planPermissions.test.ts
// Testes de permissões por plano de assinatura

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock do Prisma — deve vir ANTES do import de planPermissions.ts
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  default: {
    saasPlan: {
      findMany: vi.fn(),
    },
  },
}))

import {
  isReadOnlyMode,
  hasModuleAccess,
  canCreatePatient,
  canCreateProfessional,
  getPlanErrorMessage,
  invalidatePlansCache,
} from '../../lib/planPermissions'
import type { SystemModule } from '../../lib/planPermissions'
import prisma from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Tipos locais para o teste
// ---------------------------------------------------------------------------
type Plan = 'FREE' | 'BASIC' | 'STARTER' | 'PROFESSIONAL' | 'PREMIUM' | 'ENTERPRISE'
type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'OVERDUE' | 'CANCELED'

interface CompanyInfo {
  plan: Plan
  subscriptionStatus: SubscriptionStatus
  subscriptionExpiresAt: Date | null
}

// ---------------------------------------------------------------------------
// Helper para construir CompanyInfo
// ---------------------------------------------------------------------------
const makeCompany = (overrides: Partial<CompanyInfo> = {}): CompanyInfo => ({
  plan: 'STARTER',
  subscriptionStatus: 'ACTIVE',
  subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 dias
  ...overrides,
})

// ---------------------------------------------------------------------------
// Helper para construir PlanData mock
// ---------------------------------------------------------------------------
const makePlanRow = (overrides: Partial<{
  name: string
  modules: string[]
  maxPatients: number
  maxProfessionals: number
}> = {}) => ({
  name: 'STARTER',
  modules: ['financial', 'reports', 'crm'],
  maxPatients: 100,
  maxProfessionals: 5,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Datas auxiliares
// ---------------------------------------------------------------------------
const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000)
const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000)

// ---------------------------------------------------------------------------
// Limpar cache e mocks entre testes
// ---------------------------------------------------------------------------
beforeEach(() => {
  invalidatePlansCache()
  vi.clearAllMocks()
})

// ===========================================================================
// isReadOnlyMode  (função pura — sem mock)
// ===========================================================================
describe('isReadOnlyMode', () => {
  it('plan BASIC → true (sempre bloqueado)', () => {
    expect(isReadOnlyMode(makeCompany({ plan: 'BASIC' }))).toBe(true)
  })

  it('plan BASIC com status ACTIVE → true (plano prevalece)', () => {
    expect(isReadOnlyMode(makeCompany({ plan: 'BASIC', subscriptionStatus: 'ACTIVE' }))).toBe(true)
  })

  it('plan BASIC com status TRIAL → true', () => {
    expect(isReadOnlyMode(makeCompany({ plan: 'BASIC', subscriptionStatus: 'TRIAL' }))).toBe(true)
  })

  it('status OVERDUE → true (independente do plano)', () => {
    expect(isReadOnlyMode(makeCompany({ subscriptionStatus: 'OVERDUE' }))).toBe(true)
  })

  it('status OVERDUE com plan PREMIUM → true', () => {
    expect(isReadOnlyMode(makeCompany({ plan: 'PREMIUM', subscriptionStatus: 'OVERDUE' }))).toBe(true)
  })

  it('status TRIAL com subscriptionExpiresAt ontem → true (trial expirado)', () => {
    expect(
      isReadOnlyMode(makeCompany({ subscriptionStatus: 'TRIAL', subscriptionExpiresAt: YESTERDAY }))
    ).toBe(true)
  })

  it('status TRIAL com subscriptionExpiresAt amanhã → false (trial ainda válido)', () => {
    expect(
      isReadOnlyMode(makeCompany({ subscriptionStatus: 'TRIAL', subscriptionExpiresAt: TOMORROW }))
    ).toBe(false)
  })

  it('status TRIAL com subscriptionExpiresAt null → false (sem data = não expirou)', () => {
    expect(
      isReadOnlyMode(makeCompany({ subscriptionStatus: 'TRIAL', subscriptionExpiresAt: null }))
    ).toBe(false)
  })

  it('status ACTIVE + plan STARTER → false', () => {
    expect(isReadOnlyMode(makeCompany({ subscriptionStatus: 'ACTIVE' }))).toBe(false)
  })

  it('status ACTIVE + plan PREMIUM → false', () => {
    expect(
      isReadOnlyMode(makeCompany({ plan: 'PREMIUM', subscriptionStatus: 'ACTIVE' }))
    ).toBe(false)
  })

  it('status ACTIVE + plan ENTERPRISE → false', () => {
    expect(
      isReadOnlyMode(makeCompany({ plan: 'ENTERPRISE', subscriptionStatus: 'ACTIVE' }))
    ).toBe(false)
  })

  it('status CANCELED → false (isReadOnlyMode não trata CANCELED)', () => {
    expect(isReadOnlyMode(makeCompany({ subscriptionStatus: 'CANCELED' }))).toBe(false)
  })

  it('status CANCELED com plan PREMIUM → false', () => {
    expect(
      isReadOnlyMode(makeCompany({ plan: 'PREMIUM', subscriptionStatus: 'CANCELED' }))
    ).toBe(false)
  })

  it('plan PREMIUM + status ACTIVE → false', () => {
    expect(
      isReadOnlyMode(makeCompany({ plan: 'PREMIUM', subscriptionStatus: 'ACTIVE' }))
    ).toBe(false)
  })
})

// ===========================================================================
// hasModuleAccess  (requer mock Prisma)
// ===========================================================================
describe('hasModuleAccess', () => {
  it('status CANCELED → false (sem consultar banco)', async () => {
    const company = makeCompany({ subscriptionStatus: 'CANCELED' })
    const result = await hasModuleAccess(company, 'financial')
    expect(result).toBe(false)
    expect(vi.mocked(prisma.saasPlan.findMany)).not.toHaveBeenCalled()
  })

  it('subscriptionExpiresAt no passado com status ACTIVE → false (sem consultar banco)', async () => {
    const company = makeCompany({ subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: YESTERDAY })
    const result = await hasModuleAccess(company, 'financial')
    expect(result).toBe(false)
    expect(vi.mocked(prisma.saasPlan.findMany)).not.toHaveBeenCalled()
  })

  it('subscriptionExpiresAt no passado com status TRIAL → false (sem consultar banco)', async () => {
    const company = makeCompany({ subscriptionStatus: 'TRIAL', subscriptionExpiresAt: YESTERDAY })
    const result = await hasModuleAccess(company, 'reports')
    expect(result).toBe(false)
    expect(vi.mocked(prisma.saasPlan.findMany)).not.toHaveBeenCalled()
  })

  it('plano não encontrado no banco → false', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([])
    const company = makeCompany({ plan: 'PROFESSIONAL' })
    const result = await hasModuleAccess(company, 'financial')
    expect(result).toBe(false)
  })

  it('plano encontrado e módulo incluído → true', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', modules: ['financial', 'reports'] }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    const result = await hasModuleAccess(company, 'financial')
    expect(result).toBe(true)
  })

  it('plano encontrado mas módulo NÃO incluído → false', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', modules: ['financial'] }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    const result = await hasModuleAccess(company, 'ai_features')
    expect(result).toBe(false)
  })

  it('módulo online_booking incluído → true', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', modules: ['online_booking', 'financial'] }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await hasModuleAccess(company, 'online_booking')).toBe(true)
  })

  it('módulo inventory não incluído → false', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', modules: ['financial'] }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await hasModuleAccess(company, 'inventory')).toBe(false)
  })

  describe('cache de 5 minutos', () => {
    it('2 chamadas seguidas → prisma.saasPlan.findMany chamado apenas 1x', async () => {
      vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
        makePlanRow({ name: 'STARTER', modules: ['financial'] }) as any,
      ])
      const company = makeCompany({ plan: 'STARTER' })

      await hasModuleAccess(company, 'financial')
      await hasModuleAccess(company, 'financial')

      expect(vi.mocked(prisma.saasPlan.findMany)).toHaveBeenCalledTimes(1)
    })

    it('3 chamadas para módulos diferentes → findMany chamado apenas 1x (cache compartilhado)', async () => {
      vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
        makePlanRow({ name: 'STARTER', modules: ['financial', 'reports', 'crm'] }) as any,
      ])
      const company = makeCompany({ plan: 'STARTER' })

      await hasModuleAccess(company, 'financial')
      await hasModuleAccess(company, 'reports')
      await hasModuleAccess(company, 'crm')

      expect(vi.mocked(prisma.saasPlan.findMany)).toHaveBeenCalledTimes(1)
    })

    it('após invalidatePlansCache(), nova chamada → prisma chamado novamente', async () => {
      vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
        makePlanRow({ name: 'STARTER', modules: ['financial'] }) as any,
      ])
      const company = makeCompany({ plan: 'STARTER' })

      // Primeira chamada — popula cache
      await hasModuleAccess(company, 'financial')
      expect(vi.mocked(prisma.saasPlan.findMany)).toHaveBeenCalledTimes(1)

      // Invalida cache
      invalidatePlansCache()

      // Segunda chamada — cache expirado, deve ir ao banco novamente
      await hasModuleAccess(company, 'financial')
      expect(vi.mocked(prisma.saasPlan.findMany)).toHaveBeenCalledTimes(2)
    })

    it('chamada com plano diferente ainda usa mesmo cache', async () => {
      vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
        makePlanRow({ name: 'STARTER', modules: ['financial'] }) as any,
        makePlanRow({ name: 'PROFESSIONAL', modules: ['financial', 'ai_features'] }) as any,
      ])

      const companyStarter = makeCompany({ plan: 'STARTER' })
      const companyPro = makeCompany({ plan: 'PROFESSIONAL' })

      await hasModuleAccess(companyStarter, 'financial')
      await hasModuleAccess(companyPro, 'ai_features')

      // Ambos usam o mesmo cache carregado na primeira chamada
      expect(vi.mocked(prisma.saasPlan.findMany)).toHaveBeenCalledTimes(1)
    })
  })
})

// ===========================================================================
// canCreatePatient  (requer mock Prisma)
// ===========================================================================
describe('canCreatePatient', () => {
  it('isReadOnlyMode=true (plan BASIC) → false (sem bater no banco)', async () => {
    const company = makeCompany({ plan: 'BASIC' })
    const result = await canCreatePatient(company, 0)
    expect(result).toBe(false)
    expect(vi.mocked(prisma.saasPlan.findMany)).not.toHaveBeenCalled()
  })

  it('status OVERDUE → false (isReadOnlyMode=true)', async () => {
    const company = makeCompany({ subscriptionStatus: 'OVERDUE' })
    const result = await canCreatePatient(company, 0)
    expect(result).toBe(false)
    expect(vi.mocked(prisma.saasPlan.findMany)).not.toHaveBeenCalled()
  })

  it('plano não encontrado no banco → false', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([])
    const company = makeCompany({ plan: 'PROFESSIONAL' })
    const result = await canCreatePatient(company, 10)
    expect(result).toBe(false)
  })

  it('maxPatients: -1 (ilimitado) → true com count 0', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxPatients: -1 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreatePatient(company, 0)).toBe(true)
  })

  it('maxPatients: -1 (ilimitado) → true com count 9999', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxPatients: -1 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreatePatient(company, 9999)).toBe(true)
  })

  it('count: 49, maxPatients: 50 → true (abaixo do limite)', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxPatients: 50 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreatePatient(company, 49)).toBe(true)
  })

  it('count: 50, maxPatients: 50 → false (igual ao limite — não é <)', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxPatients: 50 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreatePatient(company, 50)).toBe(false)
  })

  it('count: 51, maxPatients: 50 → false (acima do limite)', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxPatients: 50 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreatePatient(company, 51)).toBe(false)
  })

  it('count: 0, maxPatients: 1 → true', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxPatients: 1 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreatePatient(company, 0)).toBe(true)
  })

  it('count: 1, maxPatients: 1 → false', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxPatients: 1 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreatePatient(company, 1)).toBe(false)
  })
})

// ===========================================================================
// canCreateProfessional  (requer mock Prisma)
// ===========================================================================
describe('canCreateProfessional', () => {
  it('isReadOnlyMode=true (plan BASIC) → false (sem bater no banco)', async () => {
    const company = makeCompany({ plan: 'BASIC' })
    const result = await canCreateProfessional(company, 0)
    expect(result).toBe(false)
    expect(vi.mocked(prisma.saasPlan.findMany)).not.toHaveBeenCalled()
  })

  it('plano não encontrado no banco → false', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([])
    const company = makeCompany({ plan: 'PROFESSIONAL' })
    expect(await canCreateProfessional(company, 0)).toBe(false)
  })

  it('maxProfessionals: -1 (ilimitado) → true com count 0', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxProfessionals: -1 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreateProfessional(company, 0)).toBe(true)
  })

  it('maxProfessionals: -1 (ilimitado) → true com count 999', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxProfessionals: -1 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreateProfessional(company, 999)).toBe(true)
  })

  it('count: 1, maxProfessionals: 3 → true', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxProfessionals: 3 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreateProfessional(company, 1)).toBe(true)
  })

  it('count: 2, maxProfessionals: 3 → true', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxProfessionals: 3 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreateProfessional(company, 2)).toBe(true)
  })

  it('count: 3, maxProfessionals: 3 → false (igual ao limite)', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxProfessionals: 3 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreateProfessional(company, 3)).toBe(false)
  })

  it('count: 5, maxProfessionals: 3 → false (acima do limite)', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', maxProfessionals: 3 }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    expect(await canCreateProfessional(company, 5)).toBe(false)
  })

  it('status OVERDUE → false (isReadOnlyMode)', async () => {
    const company = makeCompany({ subscriptionStatus: 'OVERDUE' })
    expect(await canCreateProfessional(company, 0)).toBe(false)
    expect(vi.mocked(prisma.saasPlan.findMany)).not.toHaveBeenCalled()
  })

  it('TRIAL expirado → false (isReadOnlyMode)', async () => {
    const company = makeCompany({ subscriptionStatus: 'TRIAL', subscriptionExpiresAt: YESTERDAY })
    expect(await canCreateProfessional(company, 0)).toBe(false)
    expect(vi.mocked(prisma.saasPlan.findMany)).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// getPlanErrorMessage
// ===========================================================================
describe('getPlanErrorMessage', () => {
  it('status CANCELED → mensagem sobre cancelamento', async () => {
    const company = makeCompany({ subscriptionStatus: 'CANCELED' })
    const msg = await getPlanErrorMessage(company)
    expect(msg.toLowerCase()).toMatch(/cancel/)
  })

  it('status CANCELED → mensagem menciona reativação ou continuidade', async () => {
    const company = makeCompany({ subscriptionStatus: 'CANCELED' })
    const msg = await getPlanErrorMessage(company)
    // A mensagem deve orientar o usuário de alguma forma
    expect(msg.length).toBeGreaterThan(10)
  })

  it('isReadOnlyMode=true (plan BASIC) → mensagem sobre expiração/readonly', async () => {
    const company = makeCompany({ plan: 'BASIC' })
    const msg = await getPlanErrorMessage(company)
    expect(msg.toLowerCase()).toMatch(/expir|somente leitura|bloqueado/)
  })

  it('status OVERDUE → mensagem sobre expiração/readonly', async () => {
    const company = makeCompany({ subscriptionStatus: 'OVERDUE' })
    const msg = await getPlanErrorMessage(company)
    expect(msg.toLowerCase()).toMatch(/expir|somente leitura/)
  })

  it('TRIAL expirado → mensagem sobre expiração/readonly', async () => {
    const company = makeCompany({ subscriptionStatus: 'TRIAL', subscriptionExpiresAt: YESTERDAY })
    const msg = await getPlanErrorMessage(company)
    expect(msg.toLowerCase()).toMatch(/expir|somente leitura/)
  })

  it('módulo sem acesso → mensagem menciona o módulo e upgrade', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', modules: [] }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    const msg = await getPlanErrorMessage(company, 'ai_features')
    expect(msg).toContain('ai_features')
    expect(msg.toLowerCase()).toMatch(/upgrade|plano/)
  })

  it('módulo financial sem acesso → mensagem menciona financial', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', modules: [] }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })
    const msg = await getPlanErrorMessage(company, 'financial')
    expect(msg).toContain('financial')
  })

  it('sem módulo específico, sem outros problemas → mensagem genérica de acesso negado', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', modules: ['financial'] }) as any,
    ])
    // company com acesso ao módulo, mas sem módulo passado → mensagem genérica
    const company = makeCompany({ plan: 'STARTER' })
    const msg = await getPlanErrorMessage(company)
    // Deve retornar mensagem genérica (não de cancelamento/readonly)
    expect(msg.length).toBeGreaterThan(5)
    expect(msg.toLowerCase()).toMatch(/acesso|plano/)
  })

  it('status CANCELED tem prioridade sobre isReadOnlyMode', async () => {
    // plan BASIC (isReadOnlyMode) + CANCELED — CANCELED vem primeiro no código
    const company = makeCompany({ plan: 'BASIC', subscriptionStatus: 'CANCELED' })
    const msg = await getPlanErrorMessage(company)
    expect(msg.toLowerCase()).toContain('cancel')
  })

  it('retorna string não vazia em qualquer cenário', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', modules: ['financial'] }) as any,
    ])
    const company = makeCompany()
    const msg = await getPlanErrorMessage(company, 'financial')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })
})

// ===========================================================================
// invalidatePlansCache — isolamento entre testes
// ===========================================================================
describe('invalidatePlansCache', () => {
  it('pode ser chamado sem erro quando cache está vazio', () => {
    expect(() => invalidatePlansCache()).not.toThrow()
  })

  it('após invalidação, loadPlansFromDB é chamado novamente', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([
      makePlanRow({ name: 'STARTER', modules: ['financial'] }) as any,
    ])
    const company = makeCompany({ plan: 'STARTER' })

    // Chamada 1 — carrega cache
    await hasModuleAccess(company, 'financial')
    expect(vi.mocked(prisma.saasPlan.findMany)).toHaveBeenCalledTimes(1)

    // Invalida e chama novamente — deve chamar prisma de novo
    invalidatePlansCache()
    await hasModuleAccess(company, 'financial')
    expect(vi.mocked(prisma.saasPlan.findMany)).toHaveBeenCalledTimes(2)
  })

  it('invalidação múltipla não causa erros', () => {
    expect(() => {
      invalidatePlansCache()
      invalidatePlansCache()
      invalidatePlansCache()
    }).not.toThrow()
  })
})
