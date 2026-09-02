// aura-backend/src/__tests__/api/auth-google-setup-company.test.ts
// Testes para POST /api/auth/google/setup-company

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: { findUnique: vi.fn(), create: vi.fn() },
    user: { update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn(), isAdmin: vi.fn() }))

import { POST } from '../../app/api/auth/google/setup-company/route'
import { getAuthUser, isAdmin } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN_NO_COMPANY = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: null }

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/google/setup-company', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isAdmin).mockReturnValue(true)
  vi.mocked(prisma.user.update).mockResolvedValue({} as never)
})

describe('POST /api/auth/google/setup-company', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ companyName: 'Clínica Teste' }))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não é admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN_NO_COMPANY as never)
    vi.mocked(isAdmin).mockReturnValue(false)
    const res = await POST(makeRequest({ companyName: 'Clínica Teste' }))
    expect(res.status).toBe(403)
  })

  it('retorna 409 quando o usuário já tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN_NO_COMPANY, companyId: 'c1' } as never)
    const res = await POST(makeRequest({ companyName: 'Clínica Teste' }))
    expect(res.status).toBe(409)
  })

  it('retorna 400 para JSON inválido', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN_NO_COMPANY as never)
    const req = new NextRequest('http://localhost/api/auth/google/setup-company', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando o nome da empresa está ausente ou muito curto', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN_NO_COMPANY as never)
    const res = await POST(makeRequest({ companyName: 'A' }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando o estado não é uma sigla válida', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN_NO_COMPANY as never)
    const res = await POST(makeRequest({ companyName: 'Clínica Teste', state: 'XX' }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando o telefone tem formato inválido', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN_NO_COMPANY as never)
    const res = await POST(makeRequest({ companyName: 'Clínica Teste', phone: 'abc' }))
    expect(res.status).toBe(400)
  })

  it('cria a empresa com slug simples quando não há conflito', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN_NO_COMPANY as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({ id: 'company-new', slug: 'clinica-teste' } as never)

    const res = await POST(makeRequest({ companyName: 'Clínica Teste' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(prisma.company.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'clinica-teste', plan: 'FREE', subscriptionStatus: 'TRIAL' }) })
    )
    expect(body.company.id).toBe('company-new')
  })

  it('vincula a empresa criada ao usuário autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN_NO_COMPANY as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({ id: 'company-new', slug: 'clinica-teste' } as never)

    await POST(makeRequest({ companyName: 'Clínica Teste' }))

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ companyId: 'company-new' }) })
    )
  })

  it('resolve conflito de slug adicionando o sufixo do estado quando disponível', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN_NO_COMPANY as never)
    vi.mocked(prisma.company.findUnique)
      .mockResolvedValueOnce({ id: 'existing' } as never) // slug base já existe
      .mockResolvedValueOnce(null) // slug-SP livre
    vi.mocked(prisma.company.create).mockResolvedValue({ id: 'company-new', slug: 'clinica-teste-SP' } as never)

    await POST(makeRequest({ companyName: 'Clínica Teste', state: 'sp' }))

    expect(prisma.company.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'clinica-teste-SP' }) })
    )
  })

  it('resolve conflito de slug com sufixo numérico quando não há estado ou o slug com estado também conflita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN_NO_COMPANY as never)
    vi.mocked(prisma.company.findUnique)
      .mockResolvedValueOnce({ id: 'existing' } as never) // slug base existe
      .mockResolvedValueOnce(null) // clinica-teste-2 livre
    vi.mocked(prisma.company.create).mockResolvedValue({ id: 'company-new', slug: 'clinica-teste-2' } as never)

    await POST(makeRequest({ companyName: 'Clínica Teste' }))

    expect(prisma.company.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'clinica-teste-2' }) })
    )
  })

  it('define horário de funcionamento padrão (seg-sex 08-18h, sáb 09-13h, dom fechado)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN_NO_COMPANY as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.company.create).mockResolvedValue({ id: 'company-new', slug: 'clinica-teste' } as never)

    await POST(makeRequest({ companyName: 'Clínica Teste' }))

    const createCall = vi.mocked(prisma.company.create).mock.calls[0][0] as unknown as { data: { businessHours: { sunday: { isOpen: boolean } } } }
    expect(createCall.data.businessHours.sunday.isOpen).toBe(false)
  })
})
