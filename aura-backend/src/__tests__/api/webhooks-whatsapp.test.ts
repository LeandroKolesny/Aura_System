// src/__tests__/api/webhooks-whatsapp.test.ts
// Testes para POST /api/webhooks/whatsapp (mensagens recebidas do Evolution API)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    whatsappInstance: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}))
vi.mock('@/lib/whatsappBotEngine', () => ({
  handleIncomingMessage: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '../../app/api/webhooks/whatsapp/route'
import prisma from '@/lib/prisma'
import { handleIncomingMessage } from '@/lib/whatsappBotEngine'

const VALID_SECRET = 'super-secret-whatsapp-webhook'
const COMPANY_ID = 'company-001'

function makeWebhookRequest(secret: string | null, body: Record<string, unknown>) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret !== null) headers['x-webhook-secret'] = secret
  return new NextRequest('http://localhost/api/webhooks/whatsapp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

const MESSAGE_PAYLOAD = {
  event: 'messages.upsert',
  instance: 'aura-c1',
  data: {
    key: { remoteJid: '5511999990000@s.whatsapp.net', fromMe: false, id: 'ABC1' },
    message: { conversation: 'Oi, quero agendar' },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.EVOLUTION_WEBHOOK_SECRET = VALID_SECRET
  vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({ companyId: COMPANY_ID, chatbotEnabled: true } as never)
})

afterEach(() => {
  delete process.env.EVOLUTION_WEBHOOK_SECRET
})

describe('SECURITY: autenticação do webhook WhatsApp', () => {
  it('retorna 401 quando secret ausente', async () => {
    const res = await POST(makeWebhookRequest(null, MESSAGE_PAYLOAD))
    expect(res.status).toBe(401)
    expect(handleIncomingMessage).not.toHaveBeenCalled()
  })

  it('retorna 401 quando secret incorreto', async () => {
    const res = await POST(makeWebhookRequest('errado', MESSAGE_PAYLOAD))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando EVOLUTION_WEBHOOK_SECRET não está configurado', async () => {
    delete process.env.EVOLUTION_WEBHOOK_SECRET
    const res = await POST(makeWebhookRequest(VALID_SECRET, MESSAGE_PAYLOAD))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/webhooks/whatsapp', () => {
  it('processa mensagem válida e repassa pro motor de conversa', async () => {
    const res = await POST(makeWebhookRequest(VALID_SECRET, MESSAGE_PAYLOAD))
    expect(res.status).toBe(200)
    expect(handleIncomingMessage).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      from: '5511999990000',
      text: 'Oi, quero agendar',
      buttonId: null,
    })
  })

  it('ignora evento que não é mensagem de usuário (ex: connection.update)', async () => {
    const res = await POST(makeWebhookRequest(VALID_SECRET, { event: 'connection.update', instance: 'aura-c1', data: {} }))
    expect(res.status).toBe(200)
    expect(handleIncomingMessage).not.toHaveBeenCalled()
  })

  it('ignora mensagem de instância desconhecida (não pertence a nenhuma empresa)', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue(null)
    const res = await POST(makeWebhookRequest(VALID_SECRET, MESSAGE_PAYLOAD))
    expect(res.status).toBe(200)
    expect(handleIncomingMessage).not.toHaveBeenCalled()
  })

  it('ignora mensagem quando a empresa ainda não ativou o chatbot', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({ companyId: COMPANY_ID, chatbotEnabled: false } as never)
    const res = await POST(makeWebhookRequest(VALID_SECRET, MESSAGE_PAYLOAD))
    expect(res.status).toBe(200)
    expect(handleIncomingMessage).not.toHaveBeenCalled()
  })

  it('retorna 400 para JSON inválido', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-secret': VALID_SECRET },
      body: '{invalid',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retorna 200 mesmo se handleIncomingMessage lançar erro (não expõe erro interno pro Evolution API)', async () => {
    vi.mocked(handleIncomingMessage).mockRejectedValueOnce(new Error('boom'))
    const res = await POST(makeWebhookRequest(VALID_SECRET, MESSAGE_PAYLOAD))
    expect(res.status).toBe(200)
  })
})

describe('connection.update — sincroniza status da instância no banco', () => {
  it('evento de desconexão (state=close) marca a instância como DISCONNECTED e retorna 200', async () => {
    vi.mocked(prisma.whatsappInstance.updateMany).mockResolvedValue({ count: 1 } as never)
    const res = await POST(
      makeWebhookRequest(VALID_SECRET, {
        event: 'connection.update',
        instance: 'aura-c1',
        data: { state: 'close' },
      })
    )
    expect(res.status).toBe(200)
    expect(prisma.whatsappInstance.updateMany).toHaveBeenCalledWith({
      where: { instanceName: 'aura-c1' },
      data: { status: 'DISCONNECTED' },
    })
    expect(handleIncomingMessage).not.toHaveBeenCalled()
  })

  it('aceita o estado em data.connection e o instance como objeto { instanceName }', async () => {
    vi.mocked(prisma.whatsappInstance.updateMany).mockResolvedValue({ count: 1 } as never)
    const res = await POST(
      makeWebhookRequest(VALID_SECRET, {
        event: 'connection.update',
        instance: { instanceName: 'aura-c9' },
        data: { connection: 'disconnected' },
      })
    )
    expect(res.status).toBe(200)
    expect(prisma.whatsappInstance.updateMany).toHaveBeenCalledWith({
      where: { instanceName: 'aura-c9' },
      data: { status: 'DISCONNECTED' },
    })
  })

  it('connection.update que NÃO é desconexão (state=connecting) não altera o status, retorna 200', async () => {
    const res = await POST(
      makeWebhookRequest(VALID_SECRET, {
        event: 'connection.update',
        instance: 'aura-c1',
        data: { state: 'connecting' },
      })
    )
    expect(res.status).toBe(200)
    expect(prisma.whatsappInstance.updateMany).not.toHaveBeenCalled()
  })

  it('connection.update sem estado no payload é conservador: não altera nada, retorna 200', async () => {
    const res = await POST(
      makeWebhookRequest(VALID_SECRET, { event: 'connection.update', instance: 'aura-c1', data: {} })
    )
    expect(res.status).toBe(200)
    expect(prisma.whatsappInstance.updateMany).not.toHaveBeenCalled()
  })

  it('instância desconhecida: updateMany não casa nenhuma linha, ainda retorna 200 sem erro', async () => {
    vi.mocked(prisma.whatsappInstance.updateMany).mockResolvedValue({ count: 0 } as never)
    const res = await POST(
      makeWebhookRequest(VALID_SECRET, {
        event: 'connection.update',
        instance: 'aura-desconhecida',
        data: { state: 'close' },
      })
    )
    expect(res.status).toBe(200)
  })

  it('nunca estoura erro: retorna 200 mesmo se o updateMany falhar', async () => {
    vi.mocked(prisma.whatsappInstance.updateMany).mockRejectedValueOnce(new Error('db down'))
    const res = await POST(
      makeWebhookRequest(VALID_SECRET, {
        event: 'connection.update',
        instance: 'aura-c1',
        data: { state: 'close' },
      })
    )
    expect(res.status).toBe(200)
  })
})
