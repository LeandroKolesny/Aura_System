// aura-backend/src/__tests__/lib/auditLog.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: { activity: { create: vi.fn() } },
}))

import prisma from '@/lib/prisma'
import {
  logActivity,
  getRequestInfo,
  logLogin,
  logLoginFailure,
  logFinancialAction,
  logSettingsChange,
} from '@/lib/auditLog'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.activity.create).mockResolvedValue({} as never)
})

describe('logActivity', () => {
  it('grava a atividade com os campos informados', async () => {
    await logActivity({ type: 'USER_LOGIN', title: 'Login', userId: 'u1' })

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'USER_LOGIN', title: 'Login', userId: 'u1', metadata: {}, retainUntil: null }),
    })
  })

  it('usa o metadata informado em vez do default vazio', async () => {
    await logActivity({ type: 'STOCK_ADJUSTED', title: 'Ajuste', userId: 'u1', metadata: { itemId: 'i1' } })

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata: { itemId: 'i1' } }),
    })
  })

  it('REGRESSÃO: nunca lança exceção mesmo se o Prisma falhar (log não deve quebrar a ação principal)', async () => {
    vi.mocked(prisma.activity.create).mockRejectedValue(new Error('DB down'))

    await expect(logActivity({ type: 'USER_LOGIN', title: 'Login', userId: 'u1' })).resolves.toBeUndefined()
  })
})

describe('getRequestInfo', () => {
  it('extrai IP do header x-forwarded-for (primeiro da lista)', () => {
    const req = new Request('http://localhost', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })
    const info = getRequestInfo(req)
    expect(info.ipAddress).toBe('1.2.3.4')
  })

  it('usa x-real-ip quando x-forwarded-for está ausente', () => {
    const req = new Request('http://localhost', { headers: { 'x-real-ip': '9.9.9.9' } })
    expect(getRequestInfo(req).ipAddress).toBe('9.9.9.9')
  })

  it('retorna "unknown" quando nenhum header de IP está presente', () => {
    const req = new Request('http://localhost')
    expect(getRequestInfo(req).ipAddress).toBe('unknown')
  })

  it('extrai o user-agent do header, ou "unknown" se ausente', () => {
    const withUa = new Request('http://localhost', { headers: { 'user-agent': 'Mozilla/5.0' } })
    expect(getRequestInfo(withUa).userAgent).toBe('Mozilla/5.0')
    const withoutUa = new Request('http://localhost')
    expect(getRequestInfo(withoutUa).userAgent).toBe('unknown')
  })
})

describe('logLogin', () => {
  it('registra USER_LOGIN com retenção de 6 meses (Marco Civil da Internet)', async () => {
    const req = new Request('http://localhost', { headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'Chrome' } })
    const before = new Date()

    await logLogin('u1', 'ana@x.com', req)

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'USER_LOGIN',
        title: 'Login realizado: ana@x.com',
        userId: 'u1',
        ipAddress: '1.2.3.4',
        userAgent: 'Chrome',
        metadata: { email: 'ana@x.com' },
      }),
    })
    const call = vi.mocked(prisma.activity.create).mock.calls[0][0]
    const retainUntil = call.data.retainUntil as Date
    const diffMonths = (retainUntil.getFullYear() - before.getFullYear()) * 12 + (retainUntil.getMonth() - before.getMonth())
    expect(diffMonths).toBe(6)
  })
})

describe('logLoginFailure', () => {
  it('NÃO grava no banco (apenas loga localmente) — falha de login sem userId', async () => {
    const req = new Request('http://localhost')
    await logLoginFailure('ana@x.com', 'senha incorreta', req)
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it('não lança exceção', async () => {
    const req = new Request('http://localhost')
    await expect(logLoginFailure('ana@x.com', 'senha incorreta', req)).resolves.toBeUndefined()
  })
})

describe('logFinancialAction', () => {
  it('formata o título de pagamento recebido com o valor em R$', async () => {
    await logFinancialAction('u1', 'PAYMENT_RECEIVED', 150.5, 'Consulta Botox')

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'PAYMENT_RECEIVED',
        title: 'Pagamento: R$ 150.50',
        description: 'Consulta Botox',
        metadata: { amount: 150.5 },
      }),
    })
  })

  it('formata o título de despesa criada', async () => {
    await logFinancialAction('u1', 'EXPENSE_CREATED', 80, 'Compra de insumos')

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'EXPENSE_CREATED', title: 'Despesa: R$ 80.00' }),
    })
  })

  it('mescla metadata extra com o amount', async () => {
    await logFinancialAction('u1', 'PAYMENT_RECEIVED', 100, 'x', { appointmentId: 'appt-1' })

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata: { amount: 100, appointmentId: 'appt-1' } }),
    })
  })
})

describe('logSettingsChange', () => {
  it('registra SETTINGS_CHANGED com valores antigo e novo', async () => {
    await logSettingsChange('u1', 'businessHours', { monday: 'closed' }, { monday: 'open' })

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'SETTINGS_CHANGED',
        title: 'Configuração alterada: businessHours',
        metadata: { setting: 'businessHours', oldValue: { monday: 'closed' }, newValue: { monday: 'open' } },
      }),
    })
  })
})
