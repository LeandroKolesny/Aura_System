// aura-backend/src/__tests__/lib/calendarSync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    appointment: { findUnique: vi.fn(), update: vi.fn() },
    googleCalendarWatch: { upsert: vi.fn() },
  },
}))
vi.mock('@/lib/google', () => ({
  refreshAccessToken: vi.fn(),
}))
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace(/^enc:/, '')),
}))

import { pushAppointmentToCalendar, deleteCalendarEvent, registerCalendarWatch } from '@/lib/calendarSync'
import prisma from '@/lib/prisma'
import { refreshAccessToken } from '@/lib/google'

const PROFESSIONAL_ID = 'prof-1'
const APPOINTMENT_ID = 'appt-1'

const CONNECTED_PROFESSIONAL = {
  id: PROFESSIONAL_ID,
  googleCalendarConnected: true,
  googleCalendarId: 'calendar-abc',
}

const VALID_USER_TOKEN_ROW = {
  googleAccessToken: 'enc:valid-access-token',
  googleRefreshToken: 'enc:refresh-token-1',
  googleTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // expira em 1h — não expirado
  googleCalendarConnected: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('pushAppointmentToCalendar', () => {
  it('não faz nada quando o agendamento não existe', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null)
    await pushAppointmentToCalendar(APPOINTMENT_ID)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('não faz nada quando o profissional não tem Google Calendar conectado', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      professional: { ...CONNECTED_PROFESSIONAL, googleCalendarConnected: false },
    } as never)
    await pushAppointmentToCalendar(APPOINTMENT_ID)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('não faz nada quando não consegue obter um token válido', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({ professional: CONNECTED_PROFESSIONAL } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ googleCalendarConnected: false } as never)

    await pushAppointmentToCalendar(APPOINTMENT_ID)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('cria um novo evento (POST) quando o agendamento ainda não tem googleEventId, e salva o ID retornado', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: APPOINTMENT_ID, date: new Date('2026-09-10T14:00:00.000Z'), durationMinutes: 60, notes: null,
      googleEventId: null,
      patient: { name: 'Maria Silva' }, procedure: { name: 'Botox' }, professional: CONNECTED_PROFESSIONAL,
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(VALID_USER_TOKEN_ROW as never)
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'gcal-event-1' }) } as never)

    await pushAppointmentToCalendar(APPOINTMENT_ID)

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/calendars/calendar-abc/events')
    expect(options?.method).toBe('POST')
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer valid-access-token')
    const body = JSON.parse(options?.body as string)
    expect(body.summary).toBe('Maria Silva — Botox')

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: APPOINTMENT_ID },
      data: { googleEventId: 'gcal-event-1' },
    })
  })

  it('atualiza o evento existente (PUT) quando o agendamento já tem googleEventId, sem tentar salvar de novo', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: APPOINTMENT_ID, date: new Date('2026-09-10T14:00:00.000Z'), durationMinutes: 30, notes: 'Retorno',
      googleEventId: 'gcal-event-existente',
      patient: { name: 'João' }, procedure: { name: 'Limpeza' }, professional: CONNECTED_PROFESSIONAL,
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(VALID_USER_TOKEN_ROW as never)
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as never)

    await pushAppointmentToCalendar(APPOINTMENT_ID)

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/events/gcal-event-existente')
    expect(options?.method).toBe('PUT')
    expect(prisma.appointment.update).not.toHaveBeenCalled()
  })

  it('REGRESSÃO: não salva googleEventId quando a criação do evento falha (res não ok)', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: APPOINTMENT_ID, date: new Date(), durationMinutes: 60, notes: null, googleEventId: null,
      patient: { name: 'Maria' }, procedure: { name: 'Botox' }, professional: CONNECTED_PROFESSIONAL,
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(VALID_USER_TOKEN_ROW as never)
    vi.mocked(fetch).mockResolvedValue({ ok: false } as never)

    await pushAppointmentToCalendar(APPOINTMENT_ID)

    expect(prisma.appointment.update).not.toHaveBeenCalled()
  })

  it('usa "primary" como calendarId quando o profissional não tem um calendarId customizado', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: APPOINTMENT_ID, date: new Date(), durationMinutes: 60, notes: null, googleEventId: null,
      patient: { name: 'Maria' }, procedure: { name: 'Botox' },
      professional: { ...CONNECTED_PROFESSIONAL, googleCalendarId: null },
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(VALID_USER_TOKEN_ROW as never)
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'e1' }) } as never)

    await pushAppointmentToCalendar(APPOINTMENT_ID)

    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/calendars/primary/events')
  })

  it('token expirado + refresh token válido: renova o token e persiste no banco antes de usar', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: APPOINTMENT_ID, date: new Date(), durationMinutes: 60, notes: null, googleEventId: null,
      patient: { name: 'Maria' }, procedure: { name: 'Botox' }, professional: CONNECTED_PROFESSIONAL,
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...VALID_USER_TOKEN_ROW,
      googleTokenExpiresAt: new Date(Date.now() - 60 * 1000), // já expirado
    } as never)
    vi.mocked(refreshAccessToken).mockResolvedValue({ access_token: 'novo-access-token', expires_in: 3600 })
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'e1' }) } as never)

    await pushAppointmentToCalendar(APPOINTMENT_ID)

    expect(refreshAccessToken).toHaveBeenCalledWith('refresh-token-1')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: PROFESSIONAL_ID },
      data: expect.objectContaining({ googleAccessToken: 'enc:novo-access-token' }),
    })
    const [, options] = vi.mocked(fetch).mock.calls[0]
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer novo-access-token')
  })

  it('token expirado + refresh falha: não usa nenhum token (não tenta chamar a API do Google)', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: APPOINTMENT_ID, date: new Date(), durationMinutes: 60, notes: null, googleEventId: null,
      patient: { name: 'Maria' }, procedure: { name: 'Botox' }, professional: CONNECTED_PROFESSIONAL,
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...VALID_USER_TOKEN_ROW,
      googleTokenExpiresAt: new Date(Date.now() - 60 * 1000),
    } as never)
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('invalid_grant'))

    await pushAppointmentToCalendar(APPOINTMENT_ID)

    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('deleteCalendarEvent', () => {
  it('não faz nada quando o agendamento não tem googleEventId', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({ googleEventId: null, professional: CONNECTED_PROFESSIONAL } as never)
    await deleteCalendarEvent(APPOINTMENT_ID)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('não faz nada quando o profissional não tem calendar conectado', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      googleEventId: 'e1', professional: { ...CONNECTED_PROFESSIONAL, googleCalendarConnected: false },
    } as never)
    await deleteCalendarEvent(APPOINTMENT_ID)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('deleta o evento no Google e limpa googleEventId no banco', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({ googleEventId: 'e1', professional: CONNECTED_PROFESSIONAL } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(VALID_USER_TOKEN_ROW as never)
    vi.mocked(fetch).mockResolvedValue({ ok: true } as never)

    await deleteCalendarEvent(APPOINTMENT_ID)

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/events/e1')
    expect(options?.method).toBe('DELETE')
    expect(prisma.appointment.update).toHaveBeenCalledWith({ where: { id: APPOINTMENT_ID }, data: { googleEventId: null } })
  })
})

describe('registerCalendarWatch', () => {
  it('não faz nada quando não há token válido', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ googleCalendarConnected: false } as never)
    await registerCalendarWatch(PROFESSIONAL_ID)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('registra o watch e faz upsert com os dados retornados pelo Google', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(VALID_USER_TOKEN_ROW as never) // dentro de getValidToken
      .mockResolvedValueOnce({ googleCalendarId: 'calendar-abc' } as never) // segunda chamada, pra pegar o calendarId
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resourceId: 'resource-1', expiration: String(Date.now() + 604800000) }),
    } as never)

    await registerCalendarWatch(PROFESSIONAL_ID)

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/calendars/calendar-abc/events/watch')
    expect(options?.method).toBe('POST')
    expect(prisma.googleCalendarWatch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: PROFESSIONAL_ID },
        update: expect.objectContaining({ resourceId: 'resource-1' }),
        create: expect.objectContaining({ resourceId: 'resource-1', userId: PROFESSIONAL_ID }),
      })
    )
  })

  it('REGRESSÃO: não faz upsert quando o registro do watch falha (res não ok)', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(VALID_USER_TOKEN_ROW as never)
      .mockResolvedValueOnce({ googleCalendarId: 'calendar-abc' } as never)
    vi.mocked(fetch).mockResolvedValue({ ok: false } as never)

    await registerCalendarWatch(PROFESSIONAL_ID)

    expect(prisma.googleCalendarWatch.upsert).not.toHaveBeenCalled()
  })
})
