import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WhatsAppProvider } from '../../lib/whatsappProvider'

vi.mock('@/lib/prisma', () => ({
  default: {
    whatsAppConversation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    procedure: { findFirst: vi.fn(), findMany: vi.fn() },
    company: { findUnique: vi.fn() },
    appointment: { findMany: vi.fn(), create: vi.fn() },
    user: { findMany: vi.fn() },
    patient: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import prisma from '@/lib/prisma'
import { handleIncomingMessage } from '../../lib/whatsappBotEngine'

const COMPANY_ID = 'company-001'
const PHONE = '5511999990000'
const NOW = new Date('2026-08-03T08:00:00') // segunda-feira

const HOURS = {
  monday: { isOpen: true, start: '09:00', end: '12:00' },
  tuesday: { isOpen: true, start: '09:00', end: '12:00' },
  wednesday: { isOpen: false, start: '00:00', end: '00:00' },
  thursday: { isOpen: true, start: '09:00', end: '12:00' },
  friday: { isOpen: true, start: '09:00', end: '12:00' },
  saturday: { isOpen: false, start: '00:00', end: '00:00' },
  sunday: { isOpen: false, start: '00:00', end: '00:00' },
}

function makeProvider(): WhatsAppProvider {
  return {
    sendText: vi.fn().mockResolvedValue(undefined),
    sendButtons: vi.fn().mockResolvedValue(undefined),
    sendList: vi.fn().mockResolvedValue(undefined),
    parseInboundWebhook: vi.fn(),
  }
}

function conversation(overrides: Partial<{ state: string; context: Record<string, unknown> }> = {}) {
  return {
    id: 'conv-1',
    companyId: COMPANY_ID,
    patientPhone: PHONE,
    state: overrides.state ?? 'START',
    context: overrides.context ?? {},
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.company.findUnique).mockResolvedValue({ name: 'Clínica Teste', businessHours: HOURS } as never)
  vi.mocked(prisma.whatsAppConversation.update).mockResolvedValue({} as never)
  vi.mocked(prisma.whatsAppConversation.create).mockResolvedValue(
    { id: 'conv-new', companyId: COMPANY_ID, patientPhone: PHONE, state: 'START', context: {} } as never
  )
  vi.mocked(prisma.$transaction).mockImplementation((cb: unknown) => (cb as (tx: unknown) => Promise<unknown>)(prisma))
})

describe('handleIncomingMessage - nova conversa', () => {
  it('cria a conversa e envia a mensagem de boas-vindas com o menu inicial', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(null)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'Oi', buttonId: null }, { provider, now: NOW })

    expect(prisma.whatsAppConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: COMPANY_ID, patientPhone: PHONE }) })
    )
    expect(provider.sendButtons).toHaveBeenCalledWith(
      COMPANY_ID, PHONE,
      expect.stringContaining('Clínica Teste'),
      [{ id: 'menu_book', label: 'Agendar Agora' }, { id: 'menu_info', label: 'Ver Procedimentos' }]
    )
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'MENU_INICIAL', context: {} }) })
    )
  })
})

describe('handleIncomingMessage - MENU_INICIAL', () => {
  it('"Agendar Agora" vai direto pra lista de procedimentos', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'MENU_INICIAL' }) as never
    )
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([
      { id: 'p1', name: 'Limpeza de Pele', isActive: true, price: 150, durationMinutes: 60 },
    ] as never)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'Agendar Agora', buttonId: 'menu_book' }, { provider, now: NOW })

    expect(provider.sendList).toHaveBeenCalledWith(
      COMPANY_ID, PHONE, expect.any(String), [{ id: 'proc_p1', label: 'Limpeza de Pele' }]
    )
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'ESCOLHENDO_PROCEDIMENTO' }) })
    )
  })

  it('"Ver Procedimentos" lista nome/preço/duração e depois mostra a lista de escolha', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'MENU_INICIAL' }) as never
    )
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([
      { id: 'p1', name: 'Limpeza de Pele', isActive: true, price: 150, durationMinutes: 60 },
    ] as never)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'Ver Procedimentos', buttonId: 'menu_info' }, { provider, now: NOW })

    expect(provider.sendText).toHaveBeenCalledWith(
      COMPANY_ID, PHONE, expect.stringContaining('Limpeza de Pele')
    )
    expect(provider.sendList).toHaveBeenCalledWith(
      COMPANY_ID, PHONE, expect.any(String), [{ id: 'proc_p1', label: 'Limpeza de Pele' }]
    )
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'ESCOLHENDO_PROCEDIMENTO' }) })
    )
  })

  it('escolha inválida na 1a tentativa reenvia o menu e mantém o estado', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'MENU_INICIAL', context: { invalidAttempts: 0 } }) as never
    )
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'blablabla', buttonId: null }, { provider, now: NOW })

    expect(provider.sendButtons).toHaveBeenCalled()
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: 'MENU_INICIAL', context: expect.objectContaining({ invalidAttempts: 1 }) }),
      })
    )
  })

  it('escolha inválida na 2a tentativa transfere para atendimento humano', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'MENU_INICIAL', context: { invalidAttempts: 1 } }) as never
    )
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'blablabla', buttonId: null }, { provider, now: NOW })

    expect(provider.sendText).toHaveBeenCalledWith(COMPANY_ID, PHONE, expect.stringMatching(/atendente|humano/i))
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'HUMANO' }) })
    )
  })
})

describe('handleIncomingMessage - ESCOLHENDO_PROCEDIMENTO', () => {
  it('escolha válida avança para ESCOLHENDO_DATA com lista de datas', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'ESCOLHENDO_PROCEDIMENTO' }) as never
    )
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'p1', name: 'Limpeza de Pele', isActive: true } as never)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'Limpeza de Pele', buttonId: 'proc_p1' }, { provider, now: NOW })

    expect(provider.sendList).toHaveBeenCalled()
    const [, , , items] = vi.mocked(provider.sendList).mock.calls[0]
    expect(items[0].id).toMatch(/^date_2026-08-03$/)
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: 'ESCOLHENDO_DATA', context: expect.objectContaining({ procedureId: 'p1', invalidAttempts: 0 }) }),
      })
    )
  })

  it('escolha inválida na 1a tentativa reenvia a lista e mantém o estado', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'ESCOLHENDO_PROCEDIMENTO', context: { invalidAttempts: 0 } }) as never
    )
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue(null) // não achou o procedimento
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([{ id: 'p1', name: 'Limpeza de Pele', isActive: true }] as never)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'xpto', buttonId: 'proc_invalido' }, { provider, now: NOW })

    expect(provider.sendList).toHaveBeenCalled()
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: 'ESCOLHENDO_PROCEDIMENTO', context: expect.objectContaining({ invalidAttempts: 1 }) }),
      })
    )
  })

  it('escolha inválida na 2a tentativa transfere para atendimento humano', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'ESCOLHENDO_PROCEDIMENTO', context: { invalidAttempts: 1 } }) as never
    )
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue(null)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'xpto', buttonId: 'proc_invalido' }, { provider, now: NOW })

    expect(provider.sendText).toHaveBeenCalledWith(COMPANY_ID, PHONE, expect.stringMatching(/atendente|humano/i))
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'HUMANO' }) })
    )
  })
})

describe('handleIncomingMessage - ESCOLHENDO_DATA', () => {
  it('escolha válida avança para ESCOLHENDO_HORA com lista de horários', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'ESCOLHENDO_DATA', context: { procedureId: 'p1' } }) as never
    )
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'p1', name: 'Limpeza de Pele', durationMinutes: 60 } as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'prof-1' }] as never)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: '03/08', buttonId: 'date_2026-08-03' }, { provider, now: NOW })

    expect(provider.sendList).toHaveBeenCalledWith(COMPANY_ID, PHONE, expect.any(String), expect.arrayContaining([
      expect.objectContaining({ id: 'time_09:00' }),
    ]))
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'ESCOLHENDO_HORA', context: expect.objectContaining({ date: '2026-08-03' }) }) })
    )
  })
})

describe('handleIncomingMessage - ESCOLHENDO_HORA', () => {
  it('escolha válida avança para CONFIRMANDO com botões de confirmação', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'ESCOLHENDO_HORA', context: { procedureId: 'p1', date: '2026-08-03' } }) as never
    )
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'p1', name: 'Limpeza de Pele', durationMinutes: 60, price: 150 } as never)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: '09:00', buttonId: 'time_09:00' }, { provider, now: NOW })

    expect(provider.sendButtons).toHaveBeenCalledWith(COMPANY_ID, PHONE, expect.any(String), [
      { id: 'confirm', label: 'Confirmar' },
      { id: 'cancel', label: 'Cancelar' },
    ])
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'CONFIRMANDO', context: expect.objectContaining({ time: '09:00' }) }) })
    )
  })
})

describe('handleIncomingMessage - CONFIRMANDO', () => {
  const CTX = { procedureId: 'p1', date: '2026-08-03', time: '09:00' }

  it('cancel: volta para START e avisa o paciente', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'CONFIRMANDO', context: CTX }) as never
    )
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'Cancelar', buttonId: 'cancel' }, { provider, now: NOW })

    expect(prisma.appointment.create).not.toHaveBeenCalled()
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'START', context: {} }) })
    )
  })

  it('confirm: cria paciente (se não existir), agendamento com profissional livre, e conclui', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'CONFIRMANDO', context: CTX }) as never
    )
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'p1', name: 'Limpeza de Pele', durationMinutes: 60, price: 150 } as never)
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'prof-1' }] as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.patient.create).mockResolvedValue({ id: 'pat-1', phone: PHONE } as never)
    vi.mocked(prisma.appointment.create).mockResolvedValue({ id: 'appt-1' } as never)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'Confirmar', buttonId: 'confirm' }, { provider, now: NOW })

    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: PHONE, companyId: COMPANY_ID }) })
    )
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: COMPANY_ID, patientId: 'pat-1', professionalId: 'prof-1', procedureId: 'p1',
          status: 'PENDING_APPROVAL',
        }),
      })
    )
    expect(provider.sendText).toHaveBeenCalledWith(COMPANY_ID, PHONE, expect.stringMatching(/confirmad|solicitad/i))
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'CONCLUIDO' }) })
    )
  })

  it('confirm sem profissional livre: avisa e volta para ESCOLHENDO_HORA sem criar agendamento', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'CONFIRMANDO', context: CTX }) as never
    )
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'p1', name: 'Limpeza de Pele', durationMinutes: 60, price: 150 } as never)
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'prof-1' }] as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { professionalId: 'prof-1', date: new Date('2026-08-03T09:00:00'), durationMinutes: 60 },
    ] as never)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'Confirmar', buttonId: 'confirm' }, { provider, now: NOW })

    expect(prisma.appointment.create).not.toHaveBeenCalled()
    expect(provider.sendText).toHaveBeenCalledWith(COMPANY_ID, PHONE, expect.stringMatching(/não está mais disponível|indisponível/i))
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'ESCOLHENDO_HORA' }) })
    )
  })

  it('condição de corrida: dois clientes confirmando o mesmo horário ao mesmo tempo — a transação serializável rejeita um deles', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'CONFIRMANDO', context: CTX }) as never
    )
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'p1', name: 'Limpeza de Pele', durationMinutes: 60, price: 150 } as never)
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'prof-1' }] as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'pat-1', phone: PHONE } as never)
    // Postgres detectou conflito de serialização (outra conversa confirmou o mesmo slot primeiro)
    const serializationError = Object.assign(new Error('could not serialize access'), { code: 'P2034' })
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(serializationError)
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'Confirmar', buttonId: 'confirm' }, { provider, now: NOW })

    expect(prisma.appointment.create).not.toHaveBeenCalled()
    expect(provider.sendText).toHaveBeenCalledWith(COMPANY_ID, PHONE, expect.stringMatching(/não está mais disponível|indisponível/i))
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'ESCOLHENDO_HORA' }) })
    )
  })
})

describe('handleIncomingMessage - HUMANO', () => {
  it('não responde automaticamente quando em atendimento humano', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'HUMANO' }) as never
    )
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'oi ainda estou aqui', buttonId: null }, { provider, now: NOW })

    expect(provider.sendText).not.toHaveBeenCalled()
    expect(provider.sendList).not.toHaveBeenCalled()
    expect(provider.sendButtons).not.toHaveBeenCalled()
    expect(prisma.whatsAppConversation.update).not.toHaveBeenCalled()
  })
})

describe('handleIncomingMessage - CONCLUIDO', () => {
  it('nova mensagem após conclusão recomeça o fluxo do zero com o menu inicial', async () => {
    vi.mocked(prisma.whatsAppConversation.findUnique).mockResolvedValue(
      conversation({ state: 'CONCLUIDO', context: { procedureId: 'p1', date: '2026-08-03', time: '09:00' } }) as never
    )
    const provider = makeProvider()

    await handleIncomingMessage({ companyId: COMPANY_ID, from: PHONE, text: 'Quero marcar de novo', buttonId: null }, { provider, now: NOW })

    expect(provider.sendButtons).toHaveBeenCalledWith(
      COMPANY_ID, PHONE, expect.stringContaining('Clínica Teste'),
      [{ id: 'menu_book', label: 'Agendar Agora' }, { id: 'menu_info', label: 'Ver Procedimentos' }]
    )
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'MENU_INICIAL', context: {} }) })
    )
  })
})
