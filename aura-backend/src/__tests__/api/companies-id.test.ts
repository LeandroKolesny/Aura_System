// aura-backend/src/__tests__/api/companies-id.test.ts
// Testes para GET/PUT /api/companies/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { cnpj as cnpjValidator, cpf as cpfValidator } from 'cpf-cnpj-validator'

vi.mock('@/lib/prisma', () => ({
  default: { company: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, PUT } from '../../app/api/companies/[id]/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const OWNER = { id: 'u2', email: 'owner@saas.com', role: 'OWNER', companyId: null }
const RECEPTIONIST = { id: 'u3', email: 'recep@clinica.com', role: 'RECEPTIONIST', companyId: 'c1' }

const DAY = { isOpen: true, start: '08:00', end: '18:00' }
const VALID_BUSINESS_HOURS = {
  monday: DAY, tuesday: DAY, wednesday: DAY, thursday: DAY, friday: DAY,
  saturday: DAY, sunday: { isOpen: false, start: '00:00', end: '00:00' },
}

function makeGetRequest() {
  return new NextRequest('http://localhost/api/companies/c1')
}
function makePutRequest(body: unknown) {
  return new NextRequest('http://localhost/api/companies/c1', {
    method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}
function makeParams(id = 'c1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/companies/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando não-OWNER tenta ver empresa de terceiros', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeGetRequest(), makeParams('outra-empresa'))
    expect(res.status).toBe(403)
  })

  it('OWNER pode ver qualquer empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1', paymentMethods: [] } as never)
    const res = await GET(makeGetRequest(), makeParams('c1'))
    expect(res.status).toBe(200)
  })

  it('retorna 404 quando a empresa não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), makeParams('c1'))
    expect(res.status).toBe(404)
  })

  it('normaliza paymentMethods na resposta', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1', paymentMethods: ['Dinheiro', 'dinheiro'] } as never)

    const res = await GET(makeGetRequest(), makeParams('c1'))
    const body = await res.json()

    expect(body.company.paymentMethods).toEqual(['money'])
  })
})

describe('PUT /api/companies/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(makePutRequest({ name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    const res = await PUT(makePutRequest({ name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 403 quando ADMIN tenta editar empresa de terceiros', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await PUT(makePutRequest({ name: 'Novo Nome' }), makeParams('outra-empresa'))
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando a empresa não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    const res = await PUT(makePutRequest({ name: 'Novo Nome' }), makeParams('c1'))
    expect(res.status).toBe(404)
  })

  it('retorna 400 para dados inválidos (schema strict rejeita campos desconhecidos)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never)
    const res = await PUT(makePutRequest({ campoInexistente: 'x' }), makeParams('c1'))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando businessHours tem formato de horário inválido', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never)
    const res = await PUT(makePutRequest({ businessHours: { ...VALID_BUSINESS_HOURS, monday: { isOpen: true, start: '8h', end: '18:00' } } }), makeParams('c1'))
    expect(res.status).toBe(400)
  })

  it('atualiza a empresa com os campos validados', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({ id: 'c1', name: 'Novo Nome', paymentMethods: [] } as never)

    const res = await PUT(makePutRequest({ name: 'Novo Nome', businessHours: VALID_BUSINESS_HOURS }), makeParams('c1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' }, data: expect.objectContaining({ name: 'Novo Nome' }) })
    )
  })

  it('mapeia o alias socialMedia para website/facebook/instagram', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({ id: 'c1' } as never)

    await PUT(makePutRequest({ socialMedia: { website: 'https://site.com', instagram: 'https://instagram.com/x' } }), makeParams('c1'))

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ website: 'https://site.com', instagram: 'https://instagram.com/x' }) })
    )
  })

  it('mapeia o alias targetAudience para targetFemale/targetMale/targetKids', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({ id: 'c1' } as never)

    await PUT(makePutRequest({ targetAudience: { female: true, kids: false } }), makeParams('c1'))

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ targetFemale: true, targetKids: false }) })
    )
  })

  it('deduplica paymentMethods ao atualizar', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({ id: 'c1' } as never)

    await PUT(makePutRequest({ paymentMethods: ['pix', 'pix', 'money'] }), makeParams('c1'))

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentMethods: ['pix', 'money'] }) })
    )
  })

  it('OWNER pode editar qualquer empresa mesmo sem companyId próprio', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'outra-empresa' } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({ id: 'outra-empresa' } as never)

    const res = await PUT(makePutRequest({ name: 'Nome Alterado' }), makeParams('outra-empresa'))
    expect(res.status).toBe(200)
  })
})

describe('PUT /api/companies/[id] — validação de CNPJ/CPF', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({ id: 'c1', paymentMethods: [] } as never)
  })

  it('rejeita (400) CNPJ com dígito verificador inválido', async () => {
    const res = await PUT(makePutRequest({ cnpj: '11.111.111/1111-11' }), makeParams('c1'))
    expect(res.status).toBe(400)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('rejeita (400) CPF com dígito verificador inválido', async () => {
    const res = await PUT(makePutRequest({ cnpj: '123.456.789-00' }), makeParams('c1'))
    expect(res.status).toBe(400)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('aceita e persiste um CNPJ válido', async () => {
    const validCnpj = cnpjValidator.format(cnpjValidator.generate())
    const res = await PUT(makePutRequest({ cnpj: validCnpj }), makeParams('c1'))
    expect(res.status).toBe(200)
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cnpj: validCnpj }) })
    )
  })

  it('aceita e persiste um CPF válido (campo aceita pessoa física também)', async () => {
    const validCpf = cpfValidator.format(cpfValidator.generate())
    const res = await PUT(makePutRequest({ cnpj: validCpf }), makeParams('c1'))
    expect(res.status).toBe(200)
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cnpj: validCpf }) })
    )
  })

  it('aceita cnpj: null (documento é opcional)', async () => {
    const res = await PUT(makePutRequest({ cnpj: null }), makeParams('c1'))
    expect(res.status).toBe(200)
  })

  it('aceita cnpj: "" (string vazia)', async () => {
    const res = await PUT(makePutRequest({ cnpj: '' }), makeParams('c1'))
    expect(res.status).toBe(200)
  })
})

describe('PUT /api/companies/[id] — campo logo aceita data URL de imagem', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({ id: 'c1', paymentMethods: [] } as never)
  })

  it('aceita um data URL base64 de imagem (formato real produzido por handleLogoUpload)', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const res = await PUT(makePutRequest({ logo: dataUrl }), makeParams('c1'))
    expect(res.status).toBe(200)
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ logo: dataUrl }) })
    )
  })

  it('aceita uma URL http(s) hospedada', async () => {
    const res = await PUT(makePutRequest({ logo: 'https://cdn.exemplo.com/logo.png' }), makeParams('c1'))
    expect(res.status).toBe(200)
  })

  it('rejeita (400) uma string que não é URL nem data URL de imagem', async () => {
    const res = await PUT(makePutRequest({ logo: 'não-é-url' }), makeParams('c1'))
    expect(res.status).toBe(400)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })
})

describe('PUT /api/companies/[id] — lastMarketingSentAt (campanha de retenção SaaS)', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({ id: 'c1', paymentMethods: [] } as never)
  })

  it('aceita e persiste lastMarketingSentAt (antes falhava com 400 pelo schema .strict())', async () => {
    const iso = '2026-09-10T12:00:00.000Z'
    const res = await PUT(makePutRequest({ lastMarketingSentAt: iso }), makeParams('c1'))

    expect(res.status).toBe(200)
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastMarketingSentAt: new Date(iso) }) })
    )
  })

  it('aceita lastMarketingSentAt: null', async () => {
    const res = await PUT(makePutRequest({ lastMarketingSentAt: null }), makeParams('c1'))
    expect(res.status).toBe(200)
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastMarketingSentAt: null }) })
    )
  })

  it('rejeita (400) lastMarketingSentAt que não é datetime ISO', async () => {
    const res = await PUT(makePutRequest({ lastMarketingSentAt: '10/09/2026' }), makeParams('c1'))
    expect(res.status).toBe(400)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })
})

describe('PUT /api/companies/[id] — .strict() bloqueia campos sensíveis fora do schema', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({ id: 'c1', paymentMethods: [] } as never)
  })

  it('tentar alterar plan via PUT → 400 (campo não está no updateCompanySchema)', async () => {
    const res = await PUT(makePutRequest({ plan: 'PREMIUM' }), makeParams('c1'))
    expect(res.status).toBe(400)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('tentar alterar subscriptionStatus via PUT → 400', async () => {
    const res = await PUT(makePutRequest({ subscriptionStatus: 'ACTIVE' }), makeParams('c1'))
    expect(res.status).toBe(400)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })
})
