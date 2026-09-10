// aura-backend/src/__tests__/api/transactions.test.ts
// Testes para GET/POST /api/transactions

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    transaction: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), create: vi.fn() },
    activity: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, POST } from '../../app/api/transactions/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

const VALID_TRANSACTION = { date: '2026-01-15', description: 'Compra de material', amount: 100, type: 'EXPENSE', category: 'Insumos' }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/transactions${qs}`)
}
function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/transactions', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
  vi.mocked(prisma.transaction.count).mockResolvedValue(0)
  vi.mocked(prisma.transaction.groupBy).mockResolvedValue([])
})

describe('GET /api/transactions', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
  })

  it('retorna 400 para parâmetros inválidos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeGetRequest('?limit=999'))
    expect(res.status).toBe(400)
  })

  it('calcula income, expense e balance a partir dos totais agrupados', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.groupBy).mockResolvedValue([
      { type: 'INCOME', _sum: { amount: 1000 } },
      { type: 'EXPENSE', _sum: { amount: 300 } },
    ] as never)

    const res = await GET(makeGetRequest())
    const body = await res.json()

    expect(body.summary).toEqual({ income: 1000, expense: 300, balance: 700 })
  })

  it('summary considera SOMENTE transações PAID (PENDING/OVERDUE ficam de fora)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    // O groupBy da rota já filtra por status PAID; o mock devolve só os totais PAID.
    // PENDING/OVERDUE existiriam na base mas não entram nesse agregado.
    vi.mocked(prisma.transaction.groupBy).mockResolvedValue([
      { type: 'INCOME', _sum: { amount: 500 } },
      { type: 'EXPENSE', _sum: { amount: 200 } },
    ] as never)

    const res = await GET(makeGetRequest())
    const body = await res.json()

    // Contrato: o agregado é calculado com where.status === 'PAID'.
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PAID' }) })
    )
    expect(body.summary).toEqual({ income: 500, expense: 200, balance: 300 })
  })

  it('filtra por intervalo de datas quando informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?startDate=2026-01-01&endDate=2026-01-31'))

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ date: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') } }) })
    )
  })
})

describe('POST /api/transactions', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostRequest(VALID_TRANSACTION))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await POST(makePostRequest(VALID_TRANSACTION))
    expect(res.status).toBe(403)
  })

  it('retorna 400 para dados inválidos (valor negativo)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makePostRequest({ ...VALID_TRANSACTION, amount: -50 }))
    expect(res.status).toBe(400)
  })

  it('cria a transação e registra atividade EXPENSE_CREATED para despesas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 't1' } as never)

    const res = await POST(makePostRequest(VALID_TRANSACTION))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.transaction.id).toBe('t1')
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'EXPENSE_CREATED' }) })
    )
  })

  it('registra atividade PAYMENT_RECEIVED para receitas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 't1' } as never)

    await POST(makePostRequest({ ...VALID_TRANSACTION, type: 'INCOME' }))

    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PAYMENT_RECEIVED' }) })
    )
  })
})
