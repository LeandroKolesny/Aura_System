// src/__tests__/lib/queries-companies-revenue.test.ts
// Teste focado no campo `lastPlan` de queryCompanies (aura-backend/src/lib/queries/index.ts),
// consumido por pages/king/KingRevenue.tsx para "MRR em Risco" e a lista de
// Empresas Inadimplentes. Arquivo separado de queries.test.ts (escopo do
// Agente 2 — Empresas/Pacientes/Agendamentos) para não alterar o arquivo de
// outra tarefa da série King; cobre apenas o que pertence a esta tarefa
// (Receita e Configurações).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: { findMany: vi.fn(), count: vi.fn() },
  },
}))

import prisma from '@/lib/prisma'
import { queryCompanies } from '@/lib/queries'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.company.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.company.count).mockResolvedValue(0)
})

describe('queryCompanies — lastPlan (KingRevenue: MRR em Risco / Inadimplentes)', () => {
  it('seleciona lastPlan no Prisma', async () => {
    // BUG CORRIGIDO: o select não trazia `lastPlan`. KingRevenue.tsx calcula
    // MRR em risco e a lista de inadimplentes com `company.lastPlan ||
    // company.plan` — sem o campo, o fallback sempre usava `plan` (já
    // rebaixado para BASIC/preço 0 pelo cron de expiração), zerando essas
    // duas seções da tela mesmo com empresas inadimplentes reais.
    await queryCompanies({})

    const call = vi.mocked(prisma.company.findMany).mock.calls[0][0]
    const select = call?.select as Record<string, unknown> | undefined
    expect(select).toMatchObject({ lastPlan: true })
  })

  it('repassa o valor de lastPlan no retorno mapeado', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      {
        id: 'c1',
        name: 'Clínica Overdue',
        slug: 'clinica-overdue',
        plan: 'BASIC',
        lastPlan: 'PROFESSIONAL',
        subscriptionStatus: 'OVERDUE',
        subscriptionExpiresAt: new Date('2026-01-01'),
        createdAt: new Date(),
        isActive: true,
        _count: { patients: 0, appointments: 0, users: 1 },
        users: [{ role: 'ADMIN', email: 'admin@clinica.com', phone: null, name: 'Admin' }],
      },
    ] as never)

    const result = await queryCompanies({})
    expect(result.companies[0].lastPlan).toBe('PROFESSIONAL')
    expect(result.companies[0].plan).toBe('BASIC')
  })
})
