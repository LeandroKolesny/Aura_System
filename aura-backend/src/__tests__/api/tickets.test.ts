// aura-backend/src/__tests__/api/tickets.test.ts
// Testes para GET/POST/PATCH /api/tickets

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    ticket: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    ticketMessage: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn() }))

import { GET, POST, PATCH } from '../../app/api/tickets/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1', name: 'Admin' }
const OWNER = { id: 'u2', email: 'owner@saas.com', role: 'OWNER', companyId: null, name: 'Owner' }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/tickets${qs}`)
}
function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/tickets', {
    method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
  vi.mocked(prisma.ticket.findMany).mockResolvedValue([])
})

describe('GET /api/tickets', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('escopa a listagem à empresa quando o solicitante não é OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest())
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1' } })
    )
  })

  it('OWNER vê tickets de todas as empresas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    await GET(makeGetRequest())
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })

  it('filtra por status normalizado para maiúsculas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?status=open'))
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'OPEN' }) })
    )
  })
})

describe('POST /api/tickets', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { subject: 'Dúvida', message: 'Preciso de ajuda' }))
    expect(res.status).toBe(401)
  })

  it('bloqueia quando o plano não permite escrita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const { NextResponse } = await import('next/server')
    vi.mocked(checkWriteAccess).mockResolvedValue(NextResponse.json({ error: 'bloqueado' }, { status: 402 }))

    const res = await POST(makeRequest('POST', { subject: 'Dúvida', message: 'Preciso de ajuda' }))
    expect(res.status).toBe(402)
  })

  it('retorna 400 quando faltam assunto ou mensagem', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makeRequest('POST', { subject: 'Dúvida' }))
    expect(res.status).toBe(400)
  })

  it('cria o ticket com a primeira mensagem do usuário (isAdmin=false)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.ticket.create).mockResolvedValue({ id: 'ticket1' } as never)

    const res = await POST(makeRequest('POST', { subject: 'Dúvida', message: 'Preciso de ajuda' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.ticket.id).toBe('ticket1')
    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: 'Dúvida', companyId: 'c1',
          messages: { create: expect.objectContaining({ content: 'Preciso de ajuda', senderId: 'u1', isAdmin: false }) },
        }),
      })
    )
  })
})

describe('PATCH /api/tickets', () => {
  beforeEach(() => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({ id: 'ticket1' } as never)
  })

  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', { ticketId: 'ticket1' }))
    expect(res.status).toBe(401)
  })

  it('retorna 400 quando ticketId está ausente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await PATCH(makeRequest('PATCH', { message: 'Resposta' }))
    expect(res.status).toBe(400)
  })

  it('adiciona mensagem de resposta marcada como isAdmin=false para usuário comum', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await PATCH(makeRequest('PATCH', { ticketId: 'ticket1', message: 'Resposta do cliente' }))

    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ content: 'Resposta do cliente', isAdmin: false }) })
    )
  })

  it('marca a mensagem como isAdmin=true quando o remetente é OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    await PATCH(makeRequest('PATCH', { ticketId: 'ticket1', message: 'Resposta do suporte' }))

    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isAdmin: true }) })
    )
  })

  it('atualiza o status do ticket normalizado para maiúsculas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    await PATCH(makeRequest('PATCH', { ticketId: 'ticket1', status: 'closed' }))

    expect(prisma.ticket.update).toHaveBeenCalledWith({ where: { id: 'ticket1' }, data: { status: 'CLOSED' } })
  })

  it('não cria mensagem nem atualiza status quando nenhum dos dois é enviado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await PATCH(makeRequest('PATCH', { ticketId: 'ticket1' }))

    expect(prisma.ticketMessage.create).not.toHaveBeenCalled()
    expect(prisma.ticket.update).not.toHaveBeenCalled()
  })

  it('retorna o ticket atualizado com as mensagens', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({ id: 'ticket1', messages: [] } as never)

    const res = await PATCH(makeRequest('PATCH', { ticketId: 'ticket1', message: 'x' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ticket.id).toBe('ticket1')
  })
})
