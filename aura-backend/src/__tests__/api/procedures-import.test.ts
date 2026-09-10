// src/__tests__/api/procedures-import.test.ts
// Testes para POST /api/procedures/import

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    procedure: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn().mockResolvedValue(null) }))

import { POST } from '../../app/api/procedures/import/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const MOCK_USER = { id: 'u1', role: 'ADMIN', companyId: 'c1' }

function makeCSV(content: string) {
  const file = new File([new Blob([content], { type: 'text/csv' })], 'procedures.csv', { type: 'text/csv' })
  const formData = new FormData()
  formData.append('file', file)
  return new NextRequest('http://localhost/api/procedures/import', {
    method: 'POST',
    body: formData,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
  vi.mocked(prisma.procedure.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.procedure.create).mockResolvedValue({ id: 'proc1' } as never)
  vi.mocked(prisma.procedure.update).mockResolvedValue({ id: 'proc1' } as never)
})

describe('POST /api/procedures/import', () => {

  it('importa procedimentos com sucesso e retorna resumo', async () => {
    const csv = `nome,preco,duracaominutos,custo\nLimpeza de Pele,150,60,20\nMassagem,200,90,30`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.imported).toBe(2)
    expect(body.updated).toBe(0)
    expect(body.errors).toHaveLength(0)
    expect(prisma.procedure.create).toHaveBeenCalledTimes(2)
  })

  it('atualiza procedimento existente com mesmo nome', async () => {
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'proc-existente' } as never)
    const csv = `nome,preco,duracaominutos\nLimpeza de Pele,180,60`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(0)
    expect(body.updated).toBe(1)
    expect(prisma.procedure.create).not.toHaveBeenCalled()
    expect(prisma.procedure.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ price: 180 }) })
    )
  })

  it('registra erro quando nome está ausente', async () => {
    const csv = `nome,preco,duracaominutos\n,150,60`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Nome')
  })

  it('registra erro quando preço é inválido', async () => {
    const csv = `nome,preco,duracaominutos\nLimpeza,abc,60`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Preço')
  })

  it('aceita preço no formato brasileiro com vírgula', async () => {
    const csv = `nome,preco,duracaominutos\nLimpeza,150,00,60`
    // Nota: csv com vírgula no preço que é interpretado como coluna separada
    const csvCorreto = `nome,preco,duracaominutos\nLimpeza,"150,00",60`
    const res = await POST(makeCSV(csvCorreto))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(1)
    const call = vi.mocked(prisma.procedure.create).mock.calls[0][0]
    expect((call.data as { price: number }).price).toBe(150)
  })

  it('preço "0" via import é aceito (procedimento cortesia por outra via de entrada)', async () => {
    const csv = `nome,preco,duracaominutos\nAvaliação Cortesia,0,30`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(1)
    expect(body.errors).toHaveLength(0)
    const call = vi.mocked(prisma.procedure.create).mock.calls[0][0]
    expect((call.data as { price: number }).price).toBe(0)
  })

  it('registra erro quando duração é inválida', async () => {
    const csv = `nome,preco,duracaominutos\nLimpeza,150,abc`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Duração')
  })

  it('usa duração padrão de 60 min quando coluna duracaominutos está ausente', async () => {
    const csv = `nome,preco\nLimpeza,150`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(1)
    const call = vi.mocked(prisma.procedure.create).mock.calls[0][0]
    expect((call.data as { durationMinutes: number }).durationMinutes).toBe(60)
  })

  it('retorna 400 quando coluna obrigatória "nome" está ausente', async () => {
    const csv = `preco,duracaominutos\n150,60`
    const res = await POST(makeCSV(csv))
    expect(res.status).toBe(400)
    expect(prisma.procedure.create).not.toHaveBeenCalled()
  })

  it('retorna 400 quando coluna obrigatória "preco" está ausente', async () => {
    const csv = `nome,duracaominutos\nLimpeza,60`
    const res = await POST(makeCSV(csv))
    expect(res.status).toBe(400)
  })

  it('retorna 400 para CSV vazio', async () => {
    const res = await POST(makeCSV(`nome,preco,duracaominutos`))
    expect(res.status).toBe(400)
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await POST(makeCSV(`nome,preco\nLimpeza,150`))
    expect(res.status).toBe(401)
  })

  it('retorna 403 para role RECEPTIONIST (apenas ADMIN e OWNER)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role: 'RECEPTIONIST' } as never)
    const res = await POST(makeCSV(`nome,preco\nLimpeza,150`))
    expect(res.status).toBe(403)
    expect(prisma.procedure.create).not.toHaveBeenCalled()
  })

  it('mistura válidas e inválidas: importa válidas e registra erros nas inválidas', async () => {
    const csv = `nome,preco,duracaominutos\nLimpeza,150,60\n,200,45\nMassagem,180,90`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(2)
    expect(body.errors).toHaveLength(1)
  })
})
