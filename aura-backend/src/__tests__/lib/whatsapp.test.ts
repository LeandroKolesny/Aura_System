import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  getInstanceName,
  createInstance,
  getQRCode,
  getInstanceStatus,
  deleteInstance,
  sendTextMessage,
} from '../../lib/whatsapp'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.EVOLUTION_API_URL = 'https://evo.test'
  process.env.EVOLUTION_API_KEY = 'test-key'
})

describe('getInstanceName', () => {
  it('retorna aura-{companyId}', () => {
    expect(getInstanceName('abc123')).toBe('aura-abc123')
  })
})

describe('createInstance', () => {
  it('chama POST /instance/create com instanceName correto', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instance: { instanceName: 'aura-c1', status: 'created' } }),
    })
    const result = await createInstance('c1')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://evo.test/instance/create',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'test-key' }),
      })
    )
    expect(result.instanceName).toBe('aura-c1')
  })
})

describe('getQRCode', () => {
  it('chama GET /instance/connect/{name} e retorna base64', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base64: 'data:image/png;base64,abc' }),
    })
    const qr = await getQRCode('c1')
    expect(qr).toBe('data:image/png;base64,abc')
  })

  it('retorna null se API falhar', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    const qr = await getQRCode('c1')
    expect(qr).toBeNull()
  })
})

describe('getInstanceStatus', () => {
  it('retorna CONNECTED quando state é open', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instance: { state: 'open' } }),
    })
    const status = await getInstanceStatus('c1')
    expect(status).toBe('CONNECTED')
  })

  it('retorna DISCONNECTED quando state é close', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instance: { state: 'close' } }),
    })
    const status = await getInstanceStatus('c1')
    expect(status).toBe('DISCONNECTED')
  })

  it('retorna DISCONNECTED se fetch falhar', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'))
    const status = await getInstanceStatus('c1')
    expect(status).toBe('DISCONNECTED')
  })
})

describe('sendTextMessage', () => {
  it('chama POST /message/sendText com número e mensagem', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ key: { id: 'msg1' } }),
    })
    await sendTextMessage('c1', '11999990000', 'Olá!')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://evo.test/message/sendText/aura-c1',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('não lança erro se API falhar (fire-and-forget seguro)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    await expect(sendTextMessage('c1', '11999990000', 'Olá!')).resolves.not.toThrow()
  })
})
