// aura-backend/src/__tests__/api/notifications.test.ts
// Testes para GET/PATCH/POST /api/notifications

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    notification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn() }))

import { GET, PATCH, POST } from '../../app/api/notifications/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/notifications${qs}`)
}
function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/notifications', {
    method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
  vi.mocked(prisma.notification.findMany).mockResolvedValue([])
  vi.mocked(prisma.notification.count).mockResolvedValue(0)
})

describe('GET /api/notifications', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('escopa a listagem ao usuário autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest())
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } })
    )
  })

  it('filtra apenas não lidas quando unreadOnly=true', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?unreadOnly=true'))
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', isRead: false } })
    )
  })

  it('retorna a contagem de não lidas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.notification.count).mockResolvedValue(3)
    const res = await GET(makeGetRequest())
    const body = await res.json()
    expect(body.unreadCount).toBe(3)
  })
})

describe('PATCH /api/notifications', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', { markAll: true }))
    expect(res.status).toBe(401)
  })

  it('marca todas as não lidas do usuário quando markAll=true', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await PATCH(makeRequest('PATCH', { markAll: true }))
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isRead: false }, data: { isRead: true },
    })
  })

  it('marca apenas os IDs informados, escopados ao usuário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await PATCH(makeRequest('PATCH', { ids: ['n1', 'n2'] }))
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['n1', 'n2'] }, userId: 'u1' }, data: { isRead: true },
    })
  })

  it('não atualiza nada quando nem markAll nem ids são informados', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await PATCH(makeRequest('PATCH', {}))
    expect(prisma.notification.updateMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/notifications', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { title: 'Aviso', message: 'Mensagem' }))
    expect(res.status).toBe(401)
  })

  it('bloqueia quando o plano não permite escrita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const { NextResponse } = await import('next/server')
    vi.mocked(checkWriteAccess).mockResolvedValue(NextResponse.json({ error: 'bloqueado' }, { status: 402 }))

    const res = await POST(makeRequest('POST', { title: 'Aviso', message: 'Mensagem' }))
    expect(res.status).toBe(402)
  })

  it('retorna 400 quando faltam título ou mensagem', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makeRequest('POST', { title: 'Aviso' }))
    expect(res.status).toBe(400)
  })

  it('cria a notificação para o próprio usuário quando userId não é informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'n1' } as never)

    const res = await POST(makeRequest('POST', { title: 'Aviso', message: 'Mensagem' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.notification.id).toBe('n1')
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', type: 'INFO' }) })
    )
  })

  it('cria a notificação para outro usuário quando userId é informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'n1' } as never)

    await POST(makeRequest('POST', { title: 'Aviso', message: 'Mensagem', userId: 'outro-user' }))

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'outro-user' }) })
    )
  })

  it('normaliza o type para maiúsculas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'n1' } as never)

    await POST(makeRequest('POST', { title: 'Aviso', message: 'Mensagem', type: 'warning' }))

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'WARNING' }) })
    )
  })
})
