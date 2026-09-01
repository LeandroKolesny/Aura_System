import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendTextMessage = vi.fn()
vi.mock('../../lib/whatsapp', () => ({
  getInstanceName: (companyId: string) => `aura-${companyId}`,
  sendTextMessage: (...args: unknown[]) => mockSendTextMessage(...args),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { EvolutionProvider } from '../../lib/whatsappProvider'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.EVOLUTION_API_URL = 'https://evo.test'
  process.env.EVOLUTION_API_KEY = 'test-key'
})

describe('EvolutionProvider.sendText', () => {
  it('delega para sendTextMessage existente', async () => {
    const provider = new EvolutionProvider()
    await provider.sendText('c1', '11999990000', 'Olá!')
    expect(mockSendTextMessage).toHaveBeenCalledWith('c1', '11999990000', 'Olá!')
  })
})

describe('EvolutionProvider.sendButtons', () => {
  it('chama POST /message/sendButtons/{instance} com as opções', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    const provider = new EvolutionProvider()
    await provider.sendButtons('c1', '11999990000', 'Escolha:', [
      { id: 'proc_1', label: 'Limpeza de Pele' },
      { id: 'proc_2', label: 'Drenagem' },
    ])
    expect(mockFetch).toHaveBeenCalledWith(
      'https://evo.test/message/sendButtons/aura-c1',
      expect.objectContaining({ method: 'POST' })
    )
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.buttons).toHaveLength(2)
    expect(body.buttons[0]).toMatchObject({ buttonId: 'proc_1', buttonText: { displayText: 'Limpeza de Pele' } })
  })

  it('não lança erro se a API falhar', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    const provider = new EvolutionProvider()
    await expect(
      provider.sendButtons('c1', '11999990000', 'Escolha:', [{ id: 'a', label: 'A' }])
    ).resolves.not.toThrow()
  })
})

describe('EvolutionProvider.sendList', () => {
  it('chama POST /message/sendList/{instance} com os itens', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    const provider = new EvolutionProvider()
    await provider.sendList('c1', '11999990000', 'Datas disponíveis:', [
      { id: 'date_2026-08-01', label: '01/08' },
      { id: 'date_2026-08-02', label: '02/08' },
    ])
    expect(mockFetch).toHaveBeenCalledWith(
      'https://evo.test/message/sendList/aura-c1',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('EvolutionProvider.parseInboundWebhook', () => {
  const provider = new EvolutionProvider()

  it('normaliza uma mensagem de texto simples', () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'aura-c1',
      data: {
        key: { remoteJid: '5511999990000@s.whatsapp.net', fromMe: false, id: 'ABC1' },
        message: { conversation: 'Oi, quero agendar' },
        pushName: 'Maria',
      },
    }
    const result = provider.parseInboundWebhook(payload)
    expect(result).toEqual({
      instanceName: 'aura-c1',
      from: '5511999990000',
      text: 'Oi, quero agendar',
      buttonId: null,
    })
  })

  it('extrai o id do botão quando o paciente responde a um sendButtons', () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'aura-c1',
      data: {
        key: { remoteJid: '5511999990000@s.whatsapp.net', fromMe: false, id: 'ABC2' },
        message: { buttonsResponseMessage: { selectedButtonId: 'proc_1', selectedDisplayText: 'Limpeza de Pele' } },
      },
    }
    const result = provider.parseInboundWebhook(payload)
    expect(result).toEqual({
      instanceName: 'aura-c1',
      from: '5511999990000',
      text: 'Limpeza de Pele',
      buttonId: 'proc_1',
    })
  })

  it('extrai o id da linha quando o paciente responde a um sendList', () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'aura-c1',
      data: {
        key: { remoteJid: '5511999990000@s.whatsapp.net', fromMe: false, id: 'ABC3' },
        message: { listResponseMessage: { singleSelectReply: { selectedRowId: 'date_2026-08-01' }, title: '01/08' } },
      },
    }
    const result = provider.parseInboundWebhook(payload)
    expect(result).toEqual({
      instanceName: 'aura-c1',
      from: '5511999990000',
      text: '01/08',
      buttonId: 'date_2026-08-01',
    })
  })

  it('retorna null quando a mensagem foi enviada pelo próprio bot (fromMe)', () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'aura-c1',
      data: {
        key: { remoteJid: '5511999990000@s.whatsapp.net', fromMe: true, id: 'ABC4' },
        message: { conversation: 'Olá! Como posso ajudar?' },
      },
    }
    expect(provider.parseInboundWebhook(payload)).toBeNull()
  })

  it('retorna null para eventos que não são mensagens (ex: connection.update)', () => {
    const payload = { event: 'connection.update', instance: 'aura-c1', data: { state: 'open' } }
    expect(provider.parseInboundWebhook(payload)).toBeNull()
  })

  it('retorna null para payload inválido/vazio', () => {
    expect(provider.parseInboundWebhook(null)).toBeNull()
    expect(provider.parseInboundWebhook({})).toBeNull()
  })

  it('aceita o evento independente de maiúsculas/minúsculas (ex: MESSAGES_UPSERT)', () => {
    const payload = {
      event: 'MESSAGES_UPSERT',
      instance: 'aura-c1',
      data: {
        key: { remoteJid: '5511999990000@s.whatsapp.net', fromMe: false, id: 'ABC5' },
        message: { conversation: 'Oi' },
      },
    }
    const result = provider.parseInboundWebhook(payload)
    expect(result).not.toBeNull()
    expect(result?.text).toBe('Oi')
  })
})
