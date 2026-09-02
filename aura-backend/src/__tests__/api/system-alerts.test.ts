// aura-backend/src/__tests__/api/system-alerts.test.ts
// Testes para GET/POST/PATCH /api/system-alerts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { systemAlert: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, POST, PATCH } from '../../app/api/system-alerts/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const OWNER = { id: 'u1', email: 'owner@saas.com', role: 'OWNER', companyId: null }
const ADMIN = { id: 'u2', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/system-alerts${qs}`)
}
function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/system-alerts', {
    method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.systemAlert.findMany).mockResolvedValue([])
})

describe('GET /api/system-alerts', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('busca alertas globais ("all") ou específicos da empresa do usuário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest())
    expect(prisma.systemAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ target: 'all' }, { target: 'c1' }] } })
    )
  })

  it('filtra apenas alertas ativos quando activeOnly=true', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?activeOnly=true'))
    expect(prisma.systemAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE' }) })
    )
  })
})

describe('POST /api/system-alerts', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { title: 'Aviso', message: 'Mensagem' }))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makeRequest('POST', { title: 'Aviso', message: 'Mensagem' }))
    expect(res.status).toBe(403)
  })

  it('retorna 400 quando faltam título ou mensagem', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    const res = await POST(makeRequest('POST', { title: 'Aviso' }))
    expect(res.status).toBe(400)
  })

  it('cria o alerta ativo, com target "all" por padrão', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.systemAlert.create).mockResolvedValue({ id: 'alert1' } as never)

    const res = await POST(makeRequest('POST', { title: 'Aviso', message: 'Mensagem' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.alert.id).toBe('alert1')
    expect(prisma.systemAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ target: 'all', status: 'ACTIVE', type: 'INFO' }) })
    )
  })

  it('normaliza o type para maiúsculas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.systemAlert.create).mockResolvedValue({ id: 'alert1' } as never)

    await POST(makeRequest('POST', { title: 'Aviso', message: 'Mensagem', type: 'warning' }))

    expect(prisma.systemAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'WARNING' }) })
    )
  })
})

describe('PATCH /api/system-alerts', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', { id: 'alert1', status: 'inactive' }))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await PATCH(makeRequest('PATCH', { id: 'alert1', status: 'inactive' }))
    expect(res.status).toBe(403)
  })

  it('retorna 400 quando id está ausente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    const res = await PATCH(makeRequest('PATCH', { status: 'inactive' }))
    expect(res.status).toBe(400)
  })

  it('atualiza o status normalizado para maiúsculas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.systemAlert.update).mockResolvedValue({ id: 'alert1', status: 'INACTIVE' } as never)

    await PATCH(makeRequest('PATCH', { id: 'alert1', status: 'inactive' }))

    expect(prisma.systemAlert.update).toHaveBeenCalledWith({ where: { id: 'alert1' }, data: { status: 'INACTIVE' } })
  })

  it('usa INACTIVE como padrão quando status não é informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.systemAlert.update).mockResolvedValue({ id: 'alert1' } as never)

    await PATCH(makeRequest('PATCH', { id: 'alert1' }))

    expect(prisma.systemAlert.update).toHaveBeenCalledWith({ where: { id: 'alert1' }, data: { status: 'INACTIVE' } })
  })
})
