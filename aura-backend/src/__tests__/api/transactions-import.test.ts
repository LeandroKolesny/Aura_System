// aura-backend/src/__tests__/api/transactions-import.test.ts
// Testes para POST /api/transactions/import

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { transaction: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn().mockResolvedValue(null) }))

import { POST } from '../../app/api/transactions/import/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const MOCK_USER = { id: 'u1', role: 'ADMIN', companyId: 'c1' }

function makeCSV(content: string) {
  const file = new File([new Blob([content], { type: 'text/csv' })], 'transactions.csv', { type: 'text/csv' })
  const formData = new FormData()
  formData.append('file', file)
  return new NextRequest('http://localhost/api/transactions/import', { method: 'POST', body: formData })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
  vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 't1' } as never)
  vi.mocked(prisma.transaction.update).mockResolvedValue({ id: 't1' } as never)
  // Sem duplicata por padrão → sempre cria.
  vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
})

describe('POST /api/transactions/import', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await POST(makeCSV('descricao,valor,tipo\nCompra,100,despesa'))
    expect(res.status).toBe(401)
  })

  it('retorna 403 para role RECEPTIONIST (apenas ADMIN e OWNER)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role: 'RECEPTIONIST' } as never)
    const res = await POST(makeCSV('descricao,valor,tipo\nCompra,100,despesa'))
    expect(res.status).toBe(403)
  })

  it('importa lançamentos com sucesso', async () => {
    const csv = 'descricao,valor,tipo\nVenda de produto,150,receita\nCompra de material,50,despesa'
    const res = await POST(makeCSV(csv))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.imported).toBe(2)
    expect(body.errors).toHaveLength(0)
  })

  it('normaliza tipo "receita"/"despesa" para INCOME/EXPENSE', async () => {
    await POST(makeCSV('descricao,valor,tipo\nVenda,150,receita'))
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'INCOME' }) })
    )
  })

  it('registra erro quando o tipo é inválido', async () => {
    const res = await POST(makeCSV('descricao,valor,tipo\nVenda,150,invalido'))
    const body = await res.json()
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Tipo')
  })

  it('registra erro quando o valor é inválido', async () => {
    const res = await POST(makeCSV('descricao,valor,tipo\nVenda,abc,receita'))
    const body = await res.json()
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Valor')
  })

  it('registra erro quando a descrição está ausente', async () => {
    const res = await POST(makeCSV('descricao,valor,tipo\n,150,receita'))
    const body = await res.json()
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Descrição')
  })

  it('interpreta data no formato brasileiro DD/MM/AAAA', async () => {
    await POST(makeCSV('descricao,valor,tipo,data\nVenda,150,receita,15/03/2026'))
    const call = vi.mocked(prisma.transaction.create).mock.calls[0][0] as unknown as { data: { date: Date } }
    expect(call.data.date.toISOString()).toBe('2026-03-15T12:00:00.000Z')
  })

  it('registra erro quando a data é inválida', async () => {
    const res = await POST(makeCSV('descricao,valor,tipo,data\nVenda,150,receita,32/13/2026'))
    const body = await res.json()
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Data')
  })

  it('normaliza status "pago"/"pendente" para PAID/PENDING, com PENDING como padrão', async () => {
    await POST(makeCSV('descricao,valor,tipo,status\nVenda,150,receita,pago'))
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) })
    )

    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 't2' } as never)
    await POST(makeCSV('descricao,valor,tipo\nVenda,150,receita'))
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) })
    )
  })

  it('usa categoria padrão baseada no tipo quando não informada', async () => {
    await POST(makeCSV('descricao,valor,tipo\nVenda,150,receita'))
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: 'Receita' }) })
    )
  })

  it('retorna 400 quando coluna obrigatória "tipo" está ausente', async () => {
    const res = await POST(makeCSV('descricao,valor\nVenda,150'))
    expect(res.status).toBe(400)
    expect(prisma.transaction.create).not.toHaveBeenCalled()
  })

  it('retorna 400 para CSV vazio', async () => {
    const res = await POST(makeCSV('descricao,valor,tipo'))
    expect(res.status).toBe(400)
  })

  it('mistura válidos e inválidos: importa válidos e registra erros nos inválidos', async () => {
    const csv = 'descricao,valor,tipo\nVenda,150,receita\n,200,despesa\nCompra,50,despesa'
    const res = await POST(makeCSV(csv))
    const body = await res.json()

    expect(body.imported).toBe(2)
    expect(body.errors).toHaveLength(1)
  })

  it('reimportar a mesma planilha não duplica: o lançamento existente conta como "updated"', async () => {
    const csv = 'descricao,valor,tipo,data\nAluguel do espaço,2000,despesa,01/03/2026'

    // 1ª importação: não há duplicata → cria
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null)
    const res1 = await POST(makeCSV(csv))
    const b1 = await res1.json()
    expect(b1.imported).toBe(1)
    expect(b1.updated).toBe(0)
    expect(prisma.transaction.create).toHaveBeenCalledTimes(1)

    // 2ª importação: a chave natural (companyId+descrição+tipo+valor+data) já existe → update
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce({ id: 'tx-existente' } as never)
    const res2 = await POST(makeCSV(csv))
    const b2 = await res2.json()
    expect(b2.imported).toBe(0)
    expect(b2.updated).toBe(1)
    expect(prisma.transaction.create).toHaveBeenCalledTimes(1) // não criou de novo
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tx-existente' } })
    )
  })
})
