// aura-backend/src/__tests__/api/users.test.ts
// Testes para GET/POST /api/users

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn() }))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed-password') } }))

import { GET, POST } from '../../app/api/users/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const OWNER = { id: 'u2', email: 'owner@saas.com', role: 'OWNER', companyId: null }
const RECEPTIONIST = { id: 'u3', email: 'recep@clinica.com', role: 'RECEPTIONIST', companyId: 'c1' }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/users${qs}`)
}
function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/users', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
  vi.mocked(prisma.user.findMany).mockResolvedValue([])
})

describe('GET /api/users', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('escopa a busca à própria empresa quando o usuário não é OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?companyId=outra-empresa'))

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1' }) })
    )
  })

  it('permite que OWNER filtre por companyId arbitrário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    await GET(makeGetRequest('?companyId=empresa-x'))

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'empresa-x' }) })
    )
  })

  it('exclui PATIENT da listagem por padrão', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest())

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: { not: 'PATIENT' } }) })
    )
  })

  it('filtra por role específico quando informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?role=ESTHETICIAN'))

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: 'ESTHETICIAN' }) })
    )
  })

  it('nunca seleciona o campo password na resposta', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest())

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.not.objectContaining({ password: true }) })
    )
  })
})

describe('POST /api/users', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostRequest({ name: 'Novo', email: 'novo@email.com' }))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário autenticado não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await POST(makePostRequest({ name: 'Novo', email: 'novo@email.com' }))
    expect(res.status).toBe(403)
  })

  it('bloqueia quando o plano não permite escrita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const { NextResponse } = await import('next/server')
    vi.mocked(checkWriteAccess).mockResolvedValue(NextResponse.json({ error: 'Plano expirado' }, { status: 402 }))

    const res = await POST(makePostRequest({ name: 'Novo', email: 'novo@email.com' }))
    expect(res.status).toBe(402)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    const res = await POST(makePostRequest({ name: 'Novo', email: 'novo@email.com' }))
    expect(res.status).toBe(403)
  })

  it('retorna 400 quando faltam nome ou email', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makePostRequest({ name: 'Novo' }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando o email já está cadastrado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as never)

    const res = await POST(makePostRequest({ name: 'Novo', email: 'ja@existe.com' }))
    expect(res.status).toBe(400)
  })

  it('cria o profissional vinculado à empresa do solicitante, com role padrão ESTHETICIAN', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'new-u', email: 'novo@email.com', role: 'ESTHETICIAN' } as never)

    const res = await POST(makePostRequest({ name: 'Novo', email: 'novo@email.com' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: 'c1', role: 'ESTHETICIAN', isActive: true }) })
    )
    expect(body.user.id).toBe('new-u')
  })

  it('mapeia role/contractType/remunerationType em minúsculo para os enums do Prisma', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'new-u' } as never)

    await POST(makePostRequest({
      name: 'Novo', email: 'novo@email.com', role: 'admin', contractType: 'clt', remunerationType: 'fixo',
    }))

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'ADMIN', contractType: 'CLT', remunerationType: 'FIXED' }) })
    )
  })

  it('não persiste a senha em texto plano — gera hash mesmo sem senha informada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'new-u' } as never)

    await POST(makePostRequest({ name: 'Novo', email: 'novo@email.com' }))

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ password: 'hashed-password' }) })
    )
  })

  // SEGURANÇA: antes o POST só fazia parseFloat sem limite nenhum — dava pra
  // criar profissional com comissão negativa ou >100%, e o relatório de
  // comissões usava esse valor sem clamping (comissão 5x a receita).
  it('rejeita commissionRate negativo (400)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const res = await POST(makePostRequest({ name: 'Novo', email: 'n@x.com', commissionRate: -10 }))
    expect(res.status).toBe(400)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('rejeita commissionRate acima de 100 (400)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const res = await POST(makePostRequest({ name: 'Novo', email: 'n@x.com', commissionRate: 150 }))
    expect(res.status).toBe(400)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('rejeita fixedSalary negativo (400)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const res = await POST(makePostRequest({ name: 'Novo', email: 'n@x.com', fixedSalary: -500 }))
    expect(res.status).toBe(400)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('aceita commissionRate 50 e fixedSalary 0 (limites válidos) → 201', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'new-u' } as never)
    const res = await POST(makePostRequest({ name: 'Novo', email: 'n@x.com', commissionRate: 50, fixedSalary: 0 }))
    expect(res.status).toBe(201)
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ commissionRate: 50, fixedSalary: 0 }) })
    )
  })

  // SEGURANÇA: um ADMIN não pode escalar privilégio enviando role: 'OWNER'.
  it('bloqueia ADMIN tentando criar outro OWNER (403, sem criar)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const res = await POST(makePostRequest({ name: 'Novo', email: 'n@x.com', role: 'OWNER' }))
    expect(res.status).toBe(403)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('permite OWNER criar outro OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...OWNER, companyId: 'c1' } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'new-owner' } as never)
    const res = await POST(makePostRequest({ name: 'Novo Dono', email: 'dono@x.com', role: 'OWNER' }))
    expect(res.status).toBe(201)
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'OWNER' }) })
    )
  })
})
