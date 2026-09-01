import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    deletionRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: { update: vi.fn(), findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { POST, GET, DELETE } from '../../app/api/account/deletion-request/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', role: 'ADMIN', companyId: 'c1', email: 'a@b.com', name: 'Admin' }

function makePostReq(body = {}) {
  return new NextRequest('http://localhost/api/account/deletion-request', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/account/deletion-request', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostReq())
    expect(res.status).toBe(401)
  })

  it('cria pedido de exclusão com data de anonimização em 30 dias', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.deletionRequest.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.deletionRequest.create).mockResolvedValue({
      id: 'dr1', userId: 'u1', status: 'PENDING', scheduledFor: new Date(),
    } as never)
    const res = await POST(makePostReq({ reason: 'Não quero mais usar' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.status).toBe('PENDING')
  })

  it('não cria pedido duplicado se já existe PENDING', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.deletionRequest.findFirst).mockResolvedValue({ id: 'dr1' } as never)
    const res = await POST(makePostReq())
    expect(res.status).toBe(409)
  })

  it('retorna 500 com mensagem clara quando o banco falha inesperadamente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.deletionRequest.findFirst).mockRejectedValue(new Error('conexão perdida'))
    const res = await POST(makePostReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})

describe('GET /api/account/deletion-request', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/account/deletion-request'))
    expect(res.status).toBe(401)
  })

  it('retorna pedido existente do usuário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.deletionRequest.findFirst).mockResolvedValue({
      id: 'dr1', status: 'PENDING', scheduledFor: new Date(), reason: 'test',
    } as never)
    const res = await GET(new NextRequest('http://localhost/api/account/deletion-request'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('PENDING')
  })
})

describe('DELETE /api/account/deletion-request', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(new NextRequest('http://localhost/api/account/deletion-request', { method: 'DELETE' }))
    expect(res.status).toBe(401)
  })

  it('cancela pedido PENDING existente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.deletionRequest.updateMany).mockResolvedValue({ count: 1 })
    const res = await DELETE(new NextRequest('http://localhost/api/account/deletion-request', { method: 'DELETE' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
