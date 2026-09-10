// aura-backend/src/__tests__/api/dashboard.test.ts
// Testes para GET /api/dashboard (métricas consolidadas)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    transaction: { aggregate: vi.fn() },
    appointment: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    inventoryItem: { findMany: vi.fn() },
    procedure: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/dashboard/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeRequest(qs = '') {
  return new NextRequest(`http://localhost/api/dashboard${qs}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.transaction.aggregate).mockResolvedValue({ _sum: { amount: 0 }, _count: 0 } as never)
  vi.mocked(prisma.appointment.count).mockResolvedValue(0)
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
  vi.mocked(prisma.appointment.groupBy).mockResolvedValue([])
  vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([])
  vi.mocked(prisma.procedure.findMany).mockResolvedValue([])
  vi.mocked(prisma.$queryRaw).mockResolvedValue([])
})

describe('GET /api/dashboard', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('usa 7 dias como período padrão', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.days).toBe(7)
    expect(body.charts.revenueChart).toHaveLength(7)
  })

  it('respeita o parâmetro days=30', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest('?days=30'))
    const body = await res.json()
    expect(body.days).toBe(30)
    expect(body.charts.revenueChart).toHaveLength(30)
  })

  it('calcula o ticket médio a partir da receita e contagem de transações', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({ _sum: { amount: 1000 }, _count: 5 } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.kpis.revenue).toBe(1000)
    expect(body.kpis.ticketMedio).toBe(200)
  })

  it('calcula a taxa de cancelamento como percentual arredondado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.count)
      .mockResolvedValueOnce(10) // periodAppointments
      .mockResolvedValueOnce(0) // completedCount
      .mockResolvedValueOnce(3) // canceledAppointments

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.kpis.cancelRate).toBe(30)
  })

  it('retorna cancelRate zero quando não há agendamentos no período', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.kpis.cancelRate).toBe(0)
  })

  it('filtra itens de estoque baixo para os alertas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
      { id: 'i1', name: 'Baixo', currentStock: 1, minStock: 5, unit: 'un' },
      { id: 'i2', name: 'Alto', currentStock: 50, minStock: 5, unit: 'un' },
    ] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.alerts.lowStock).toHaveLength(1)
    expect(body.alerts.lowStock[0].title).toContain('Baixo')
  })

  it('mapeia o nome dos procedimentos mais usados a partir do groupBy', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.groupBy).mockResolvedValue([
      { procedureId: 'proc1', _count: { procedureId: 8 } },
    ] as never)
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([{ id: 'proc1', name: 'Limpeza de Pele' }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.charts.topProcedures).toEqual([{ name: 'Limpeza de Pele', count: 8 }])
  })

  it('define cache-control com s-maxage de 30 segundos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest())
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=30')
  })

  it('retorna 500 em caso de erro inesperado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.aggregate).mockRejectedValue(new Error('db down'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })

  // Teste de CARACTERIZAÇÃO (não de correção): o KPI "Confirmadas" é calculado como
  // `periodAppointments - canceledAppointments`, ou seja, inclui TUDO que não foi
  // cancelado — COMPLETED, PENDING_APPROVAL e SCHEDULED — e não apenas os
  // efetivamente "confirmados". Mantido de propósito (pode ser esperado por
  // dashboards em produção). Este teste trava o valor atual para que qualquer
  // mudança futura no cálculo seja consciente.
  it('appointmentsConfirmed = total - cancelados (inclui completados e pendentes de aprovação)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    // Composição de status mista no período:
    //   4 COMPLETED + 2 PENDING_APPROVAL + 2 SCHEDULED + 2 CANCELED = 10 no total
    vi.mocked(prisma.appointment.count)
      .mockResolvedValueOnce(10) // periodAppointments (total, todos os status)
      .mockResolvedValueOnce(4)  // completedCount (COMPLETED + paid) -> KPI "Realizadas"
      .mockResolvedValueOnce(2)  // canceledAppointments -> KPI "Canceladas"

    const res = await GET(makeRequest())
    const body = await res.json()

    // 10 - 2 = 8: engloba os 4 COMPLETED + 2 PENDING_APPROVAL + 2 SCHEDULED
    expect(body.kpis.appointmentsConfirmed).toBe(8)
    expect(body.kpis.appointmentsCompleted).toBe(4)
    expect(body.kpis.appointmentsCanceled).toBe(2)
    expect(body.kpis.appointmentsTotal).toBe(10)
  })

  it('kpis.revenue soma apenas transações INCOME + PAID (filtro fica na query, não no mock)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    // O mock devolve só o agregado já filtrado; transações PENDING/REFUNDED nunca
    // chegam ao aggregate porque a cláusula `where` as exclui. Este teste trava
    // esse filtro para não regredir para uma soma "de tudo".
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({ _sum: { amount: 750 }, _count: 3 } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.kpis.revenue).toBe(750)
    expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'INCOME', status: 'PAID', companyId: 'c1' }),
      })
    )
  })

  it('days não numérico (?days=abc) não quebra a rota — fallback sem série de receita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest('?days=abc'))
    const body = await res.json()

    expect(res.status).toBe(200)
    // parseInt('abc') -> NaN; o loop `for (i = days-1; i >= 0; i--)` nem executa
    expect(body.days).toBeNull() // NaN serializa como null no JSON
    expect(body.charts.revenueChart).toEqual([])
    expect(body.kpis).toBeDefined()
  })
})
