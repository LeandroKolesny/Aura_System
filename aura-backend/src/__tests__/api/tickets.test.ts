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

  it('combina filtro de status com o escopo de companyId para não-OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?status=closed'))
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', status: 'CLOSED' } })
    )
  })

  it('respeita o parâmetro limit e usa 50 como padrão quando omitido', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?limit=5'))
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }))

    vi.mocked(prisma.ticket.findMany).mockClear()
    await GET(makeGetRequest())
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
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


  it('grava sempre o companyId do usuário autenticado, ignorando o companyId enviado no corpo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never) // companyId 'c1'
    vi.mocked(prisma.ticket.create).mockResolvedValue({ id: 't1' } as never)

    await POST(makeRequest('POST', { subject: 'Assunto', message: 'Msg', companyId: 'c999' }))

    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: 'c1' }) })
    )
  })
})
describe('PATCH /api/tickets', () => {
  beforeEach(() => {
    // findUnique é chamado 2x por requisição: 1) checagem de posse do ticket
    // (companyId/status), 2) busca final pra devolver o ticket com mensagens.
    // Ambas usam o mesmo mock por padrão — testes que precisam de valores
    // diferentes entre as duas chamadas usam mockResolvedValueOnce.
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({ id: 'ticket1', companyId: 'c1', status: 'OPEN' } as never)
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
    // 1ª chamada: checagem de posse (companyId bate com ADMIN); 2ª: ticket final
    vi.mocked(prisma.ticket.findUnique)
      .mockResolvedValueOnce({ id: 'ticket1', companyId: 'c1', status: 'OPEN' } as never)
      .mockResolvedValueOnce({ id: 'ticket1', messages: [] } as never)

    const res = await PATCH(makeRequest('PATCH', { ticketId: 'ticket1', message: 'x' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ticket.id).toBe('ticket1')
  })

  it('SECURITY: ADMIN de outra empresa não pode responder o chamado (404, sem tocar no banco)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never) // companyId 'c1'
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({ id: 'ticket1', companyId: 'c2', status: 'OPEN' } as never)

    const res = await PATCH(makeRequest('PATCH', { ticketId: 'ticket1', message: 'invasao' }))

    expect(res.status).toBe(404)
    expect(prisma.ticketMessage.create).not.toHaveBeenCalled()
  })

  it('SECURITY: ADMIN de outra empresa não pode encerrar o chamado (404, sem tocar no banco)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({ id: 'ticket1', companyId: 'c2', status: 'OPEN' } as never)

    const res = await PATCH(makeRequest('PATCH', { ticketId: 'ticket1', status: 'CLOSED' }))

    expect(res.status).toBe(404)
    expect(prisma.ticket.update).not.toHaveBeenCalled()
  })

  it('OWNER (suporte do SaaS) pode responder/encerrar chamado de qualquer empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({ id: 'ticket1', companyId: 'c99', status: 'OPEN' } as never)

    const res = await PATCH(makeRequest('PATCH', { ticketId: 'ticket1', message: 'suporte respondendo' }))

    expect(res.status).toBe(200)
    expect(prisma.ticketMessage.create).toHaveBeenCalled()
  })

  it('não aceita nova mensagem em chamado já CLOSED (400)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({ id: 'ticket1', companyId: 'c1', status: 'CLOSED' } as never)

    const res = await PATCH(makeRequest('PATCH', { ticketId: 'ticket1', message: 'mais uma' }))

    expect(res.status).toBe(400)
    expect(prisma.ticketMessage.create).not.toHaveBeenCalled()
  })

  it('permite mudar o status de um chamado CLOSED (reabrir) mesmo sem mensagem', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({ id: 'ticket1', companyId: 'c1', status: 'CLOSED' } as never)

    const res = await PATCH(makeRequest('PATCH', { ticketId: 'ticket1', status: 'open' }))

    expect(res.status).toBe(200)
    expect(prisma.ticket.update).toHaveBeenCalledWith({ where: { id: 'ticket1' }, data: { status: 'OPEN' } })
  })

  it('retorna 404 quando o ticketId não corresponde a nenhum chamado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(null)

    const res = await PATCH(makeRequest('PATCH', { ticketId: 'inexistente', message: 'x' }))

    expect(res.status).toBe(404)
    expect(prisma.ticketMessage.create).not.toHaveBeenCalled()
  })
})
