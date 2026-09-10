// src/__tests__/api/patients-import.test.ts
// Testes para POST /api/patients/import

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patient: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn().mockResolvedValue(null) }))

import { POST } from '../../app/api/patients/import/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const MOCK_USER = { id: 'u1', role: 'ADMIN', companyId: 'c1' }

function makeCSV(content: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const file = new File([blob], 'pacientes.csv', { type: 'text/csv' })
  const formData = new FormData()
  formData.append('file', file)
  return new NextRequest('http://localhost/api/patients/import', {
    method: 'POST',
    body: formData,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
  vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'p1' } as never)
  vi.mocked(prisma.patient.update).mockResolvedValue({ id: 'p1' } as never)
})

describe('POST /api/patients/import', () => {

  it('importa pacientes com sucesso e retorna resumo', async () => {
    const csv = `nome,email,telefone\nMaria Silva,maria@ex.com,11999990000\nJoão Souza,joao@ex.com,11988880000`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.imported).toBe(2)
    expect(body.updated).toBe(0)
    expect(body.errors).toHaveLength(0)
    expect(prisma.patient.create).toHaveBeenCalledTimes(2)
  })

  it('atualiza paciente existente em vez de duplicar quando email já existe', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p-existente' } as never)
    const csv = `nome,email,telefone\nMaria Atualizada,maria@ex.com,11999990000`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(0)
    expect(body.updated).toBe(1)
    expect(prisma.patient.create).not.toHaveBeenCalled()
    expect(prisma.patient.update).toHaveBeenCalledOnce()
  })

  it('registra erro por linha quando nome está ausente', async () => {
    const csv = `nome,email,telefone\n,sem-nome@ex.com,11999990000\nMaria Silva,maria@ex.com,11999990000`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(1)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].row).toBe(2)
    expect(body.errors[0].reason).toContain('Nome')
  })

  it('registra erro quando data de nascimento tem formato inválido', async () => {
    const csv = `nome,email,datanascimento\nMaria,maria@ex.com,32/13/2000`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Data de nascimento')
  })

  it('aceita data no formato DD/MM/YYYY', async () => {
    const csv = `nome,email,datanascimento\nMaria,maria@ex.com,15/06/1990`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(1)
    expect(body.errors).toHaveLength(0)
  })

  it('cria paciente sem email com e-mail placeholder', async () => {
    const csv = `nome,telefone\nAna sem email,11977770000`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(1)
    const createCall = vi.mocked(prisma.patient.create).mock.calls[0][0]
    expect((createCall.data as { email: string }).email).toContain('@sem-email.local')
  })

  it('retorna 400 quando CSV não tem coluna obrigatória "nome"', async () => {
    const csv = `email,telefone\nmaria@ex.com,11999990000`
    const res = await POST(makeCSV(csv))
    expect(res.status).toBe(400)
    expect(prisma.patient.create).not.toHaveBeenCalled()
  })

  it('retorna 400 quando CSV está vazio (só cabeçalho)', async () => {
    const csv = `nome,email,telefone`
    const res = await POST(makeCSV(csv))
    expect(res.status).toBe(400)
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await POST(makeCSV(`nome\nMaria`))
    expect(res.status).toBe(401)
  })

  it('retorna 403 para role PATIENT', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role: 'PATIENT' } as never)
    const res = await POST(makeCSV(`nome\nMaria`))
    expect(res.status).toBe(403)
    expect(prisma.patient.create).not.toHaveBeenCalled()
  })

  // Regra de negócio: importação em massa é mais restrita que o cadastro
  // individual. POST /api/patients aceita ESTHETICIAN, mas a importação via CSV
  // (ALLOWED_ROLES = OWNER/ADMIN/RECEPTIONIST) NÃO — ESTHETICIAN recebe 403.
  it('retorna 403 para role ESTHETICIAN (importação em massa é restrita a OWNER/ADMIN/RECEPTIONIST)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role: 'ESTHETICIAN' } as never)
    const res = await POST(makeCSV(`nome\nMaria`))
    expect(res.status).toBe(403)
    expect(prisma.patient.create).not.toHaveBeenCalled()
  })

  it('permite importação para role RECEPTIONIST', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role: 'RECEPTIONIST' } as never)
    const csv = `nome,email,telefone\nMaria Silva,maria@ex.com,11999990000`
    const res = await POST(makeCSV(csv))
    expect(res.status).toBe(200)
    expect(prisma.patient.create).toHaveBeenCalledTimes(1)
  })

  it('mistura de linhas válidas e inválidas: importa válidas e registra erros nas inválidas', async () => {
    const csv = `nome,email,telefone\nMaria,maria@ex.com,11999990000\n,sem-nome@ex.com,11888880000\nJoão,joao@ex.com,11777770000`
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(2)
    expect(body.errors).toHaveLength(1)
  })
})
