// aura-backend/src/__tests__/api/patients-id.test.ts
// Testes para GET/PUT/DELETE /api/patients/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patient: { findFirst: vi.fn(), update: vi.fn() },
    activity: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, PUT, DELETE } from '../../app/api/patients/[id]/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }
const PATIENT_ROLE = { id: 'u3', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/patients/p1', {
    method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}
function makeParams(id = 'p1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/patients/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando o paciente não existe ou é de outra empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna o paciente com histórico de agendamentos, fotos e transações', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', name: 'Paciente Teste' } as never)

    const res = await GET(makeRequest('GET'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.patient.id).toBe('p1')
    expect(prisma.patient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', companyId: 'c1' } })
    )
  })
})

describe('PUT /api/patients/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', { name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o role não é permitido (ex.: PATIENT)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_ROLE as never)
    const res = await PUT(makeRequest('PUT', { name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando o paciente não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', { name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 400 para dados inválidos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', email: 'old@email.com' } as never)
    const res = await PUT(makeRequest('PUT', { email: 'not-an-email' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('retorna 409 quando o novo email já pertence a outro paciente da empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst)
      .mockResolvedValueOnce({ id: 'p1', email: 'old@email.com' } as never)
      .mockResolvedValueOnce({ id: 'p2' } as never)

    const res = await PUT(makeRequest('PUT', { email: 'duplicado@email.com' }), makeParams())
    expect(res.status).toBe(409)
  })

  it('permite manter o mesmo email sem checar duplicidade', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValueOnce({ id: 'p1', email: 'same@email.com' } as never)
    vi.mocked(prisma.patient.update).mockResolvedValue({ id: 'p1', name: 'Paciente Teste' } as never)

    const res = await PUT(makeRequest('PUT', { email: 'same@email.com' }), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.patient.findFirst).toHaveBeenCalledTimes(1)
  })

  it('atualiza o paciente e registra atividade de auditoria', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', email: 'old@email.com' } as never)
    vi.mocked(prisma.patient.update).mockResolvedValue({ id: 'p1', name: 'Nome Atualizado' } as never)

    const res = await PUT(makeRequest('PUT', { name: 'Nome Atualizado' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.patient.name).toBe('Nome Atualizado')
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PATIENT_UPDATED', userId: 'u1' }) })
    )
  })

  it('converte birthDate string para Date ao atualizar', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', email: 'old@email.com' } as never)
    vi.mocked(prisma.patient.update).mockResolvedValue({ id: 'p1' } as never)

    await PUT(makeRequest('PUT', { birthDate: '1990-05-15' }), makeParams())

    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ birthDate: expect.any(Date) }) })
    )
  })
})

describe('DELETE /api/patients/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando o paciente não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(404)
  })

  it('desativa o paciente via soft delete (status INACTIVE), sem apagar o registro', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.patient.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'INACTIVE' } })
  })
})
