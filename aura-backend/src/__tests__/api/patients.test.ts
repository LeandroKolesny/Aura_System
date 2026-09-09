// src/__tests__/api/patients.test.ts
// Testes para GET/POST /api/patients e GET/PUT/DELETE /api/patients/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Patient, Activity } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    patient: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    activity: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))
vi.mock('@/lib/apiGuards', () => ({
  checkWriteAccess: vi.fn().mockResolvedValue(null),
  checkPatientLimit: vi.fn().mockResolvedValue(null),
}))

import { GET as GET_LIST, POST } from '../../app/api/patients/route'
import { GET, PUT, DELETE } from '../../app/api/patients/[id]/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess, checkPatientLimit } from '@/lib/apiGuards'

// ── fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-001'
const PATIENT_ID = 'patient-001'

const MOCK_ADMIN_USER = { id: 'user-001', role: 'ADMIN', companyId: COMPANY_ID }
const MOCK_PATIENT_USER = { id: 'user-002', role: 'PATIENT', companyId: COMPANY_ID }

const MOCK_PATIENT = {
  id: PATIENT_ID,
  name: 'Maria Silva',
  email: 'maria@email.com',
  phone: '11999990000',
  cpf: null,
  status: 'ACTIVE',
  companyId: COMPANY_ID,
  createdAt: new Date('2026-01-01'),
} as unknown as Patient

const VALID_CREATE_BODY = {
  name: 'João Costa',
  email: 'joao@email.com',
  phone: '11988880000',
}

const VALID_UPDATE_BODY = {
  name: 'João Costa Atualizado',
  phone: '11977770000',
}

function makeListRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/patients')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString(), { method: 'GET' })
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/patients', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function makeIdRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/patients/${PATIENT_ID}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : {},
  })
}

const ID_PARAMS = { params: Promise.resolve({ id: PATIENT_ID }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN_USER as never)
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
  vi.mocked(checkPatientLimit).mockResolvedValue(null)
  vi.mocked(prisma.patient.findMany).mockResolvedValue([MOCK_PATIENT])
  vi.mocked(prisma.patient.count).mockResolvedValue(1)
  vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_PATIENT)
  vi.mocked(prisma.patient.create).mockResolvedValue(MOCK_PATIENT)
  vi.mocked(prisma.patient.update).mockResolvedValue(MOCK_PATIENT)
  vi.mocked(prisma.activity.create).mockResolvedValue({} as Activity)
})

// ── GET /api/patients ─────────────────────────────────────────────────────────

describe('GET /api/patients', () => {

  it('lista pacientes com paginação → 200', async () => {
    const res = await GET_LIST(makeListRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.patients).toHaveLength(1)
    expect(body.pagination).toBeDefined()
  })

  it('passa filtro de busca para query', async () => {
    await GET_LIST(makeListRequest({ search: 'maria' }))
    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) })
    )
  })

  it('retorna 403 para role PATIENT (LGPD)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_PATIENT_USER as never)
    const res = await GET_LIST(makeListRequest())
    expect(res.status).toBe(403)
    expect(prisma.patient.findMany).not.toHaveBeenCalled()
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await GET_LIST(makeListRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 sem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_ADMIN_USER, companyId: null } as never)
    const res = await GET_LIST(makeListRequest())
    expect(res.status).toBe(403)
  })

  // REGRESSÃO: um mock de Prisma sempre retorna o objeto que você mandar,
  // não importa o que a rota realmente pediu no `select` — então testes que
  // só checam o status/formato da resposta não pegam campo faltando no
  // select. Aconteceu de verdade: consentSignatureUrl/consentMetadata
  // ficaram de fora do select da listagem, e a assinatura sumia da tela
  // assim que a lista de pacientes recarregava (ficava só "assinado em X",
  // sem a imagem). Este teste trava a lista de campos exigidos no select.
  it('REGRESSÃO: o select da listagem inclui os campos de assinatura do consentimento (consentSignatureUrl/consentMetadata)', async () => {
    await GET_LIST(makeListRequest())
    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          consentSignedAt: true,
          consentSignatureUrl: true,
          consentMetadata: true,
        }),
      })
    )
  })
})

// ── POST /api/patients ────────────────────────────────────────────────────────

describe('POST /api/patients', () => {

  it('cria paciente com sucesso → 201', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null) // sem duplicata
    vi.mocked(prisma.patient.create).mockResolvedValue({ ...MOCK_PATIENT, name: 'João Costa' } as never)
    const res = await POST(makePostRequest(VALID_CREATE_BODY))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.patient).toBeDefined()
  })

  it('chama checkWriteAccess e checkPatientLimit', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    await POST(makePostRequest(VALID_CREATE_BODY))
    expect(checkWriteAccess).toHaveBeenCalledOnce()
    expect(checkPatientLimit).toHaveBeenCalledOnce()
  })

  it('retorna 409 quando email já existe na empresa', async () => {
    // findFirst retorna paciente existente (duplicata de email)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_PATIENT)
    const res = await POST(makePostRequest(VALID_CREATE_BODY))
    expect(res.status).toBe(409)
    expect(prisma.patient.create).not.toHaveBeenCalled()
  })

  it('retorna 403 para role PATIENT', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_PATIENT_USER as never)
    const res = await POST(makePostRequest(VALID_CREATE_BODY))
    expect(res.status).toBe(403)
    expect(prisma.patient.create).not.toHaveBeenCalled()
  })

  it('retorna 400 para dados inválidos', async () => {
    const res = await POST(makePostRequest({ name: 'A' })) // nome muito curto
    expect(res.status).toBe(400)
    expect(prisma.patient.create).not.toHaveBeenCalled()
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await POST(makePostRequest(VALID_CREATE_BODY))
    expect(res.status).toBe(401)
  })

  it('registra log de atividade ao criar paciente', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    await POST(makePostRequest(VALID_CREATE_BODY))
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PATIENT_CREATED' }) })
    )
  })

  it('bloqueia quando checkPatientLimit retorna erro', async () => {
    vi.mocked(checkPatientLimit).mockResolvedValue({ status: 403, json: () => ({}) } as never)
    const res = await POST(makePostRequest(VALID_CREATE_BODY))
    expect(res).toBeDefined()
    expect(prisma.patient.create).not.toHaveBeenCalled()
  })
})

// ── GET /api/patients/[id] ────────────────────────────────────────────────────

describe('GET /api/patients/[id]', () => {

  it('retorna paciente por ID → 200', async () => {
    const res = await GET(makeIdRequest('GET'), ID_PARAMS)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.patient.id).toBe(PATIENT_ID)
  })

  it('retorna 404 quando paciente não encontrado', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await GET(makeIdRequest('GET'), ID_PARAMS)
    expect(res.status).toBe(404)
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await GET(makeIdRequest('GET'), ID_PARAMS)
    expect(res.status).toBe(401)
  })
})

// ── PUT /api/patients/[id] ────────────────────────────────────────────────────

describe('PUT /api/patients/[id]', () => {

  it('atualiza paciente → 200', async () => {
    vi.mocked(prisma.patient.update).mockResolvedValue({ ...MOCK_PATIENT, ...VALID_UPDATE_BODY } as never)
    const res = await PUT(makeIdRequest('PUT', VALID_UPDATE_BODY), ID_PARAMS)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.patient).toBeDefined()
    expect(prisma.patient.update).toHaveBeenCalledOnce()
  })

  it('verifica duplicidade de email ao alterar', async () => {
    vi.mocked(prisma.patient.findFirst)
      .mockResolvedValueOnce(MOCK_PATIENT) // existingPatient
      .mockResolvedValueOnce({ id: 'outro-001' } as never) // duplicateEmail
    const res = await PUT(makeIdRequest('PUT', { ...VALID_UPDATE_BODY, email: 'outro@email.com' }), ID_PARAMS)
    expect(res.status).toBe(409)
    expect(prisma.patient.update).not.toHaveBeenCalled()
  })

  it('retorna 404 quando paciente não existe', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await PUT(makeIdRequest('PUT', VALID_UPDATE_BODY), ID_PARAMS)
    expect(res.status).toBe(404)
  })

  it('retorna 403 para role PATIENT', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_PATIENT_USER as never)
    const res = await PUT(makeIdRequest('PUT', VALID_UPDATE_BODY), ID_PARAMS)
    expect(res.status).toBe(403)
    expect(prisma.patient.update).not.toHaveBeenCalled()
  })

  it('retorna 400 para dados inválidos', async () => {
    const res = await PUT(makeIdRequest('PUT', { name: '' }), ID_PARAMS)
    expect(res.status).toBe(400)
    expect(prisma.patient.update).not.toHaveBeenCalled()
  })

  it('registra log de atividade ao atualizar paciente', async () => {
    await PUT(makeIdRequest('PUT', VALID_UPDATE_BODY), ID_PARAMS)
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PATIENT_UPDATED' }) })
    )
  })
})

// ── DELETE /api/patients/[id] ─────────────────────────────────────────────────

describe('DELETE /api/patients/[id]', () => {

  it('desativa paciente (soft delete) → 200', async () => {
    const res = await DELETE(makeIdRequest('DELETE'), ID_PARAMS)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'INACTIVE' }) })
    )
  })

  it('retorna 404 quando paciente não encontrado', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await DELETE(makeIdRequest('DELETE'), ID_PARAMS)
    expect(res.status).toBe(404)
    expect(prisma.patient.update).not.toHaveBeenCalled()
  })

  it('retorna 403 para role RECEPTIONIST (apenas ADMIN/OWNER podem deletar)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_ADMIN_USER, role: 'RECEPTIONIST' } as never)
    const res = await DELETE(makeIdRequest('DELETE'), ID_PARAMS)
    expect(res.status).toBe(403)
    expect(prisma.patient.update).not.toHaveBeenCalled()
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await DELETE(makeIdRequest('DELETE'), ID_PARAMS)
    expect(res.status).toBe(401)
  })

  it('não faz hard delete — paciente fica com status INACTIVE', async () => {
    await DELETE(makeIdRequest('DELETE'), ID_PARAMS)
    // Deve chamar update, não delete
    expect(prisma.patient.update).toHaveBeenCalledOnce()
    // Prisma não tem patient.delete nos mocks → não foi chamado
  })
})
