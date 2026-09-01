import { describe, it, expect } from 'vitest'
import { computeAvailableDates, computeAvailableTimes } from '../../lib/whatsappBotSlots'
import type { BusinessHours } from '../../lib/businessHours'

const HOURS: BusinessHours = {
  monday: { isOpen: true, start: '09:00', end: '12:00' },
  tuesday: { isOpen: true, start: '09:00', end: '12:00' },
  wednesday: { isOpen: false, start: '00:00', end: '00:00' },
  thursday: { isOpen: true, start: '09:00', end: '12:00' },
  friday: { isOpen: true, start: '09:00', end: '12:00' },
  saturday: { isOpen: false, start: '00:00', end: '00:00' },
  sunday: { isOpen: false, start: '00:00', end: '00:00' },
}

describe('computeAvailableDates', () => {
  it('retorna apenas dias em que a clínica abre, dentro da janela pedida', () => {
    // 2026-08-03 é uma segunda-feira
    const from = new Date('2026-08-03T08:00:00')
    const dates = computeAvailableDates(HOURS, from, 5)
    // seg, ter abertos; qua fechado; qui, sex abertos (5 dias a partir de segunda)
    expect(dates).toEqual(['2026-08-03', '2026-08-04', '2026-08-06', '2026-08-07'])
  })

  it('retorna array vazio se businessHours for null', () => {
    const from = new Date('2026-08-03T08:00:00')
    expect(computeAvailableDates(null, from, 5)).toEqual([])
  })
})

describe('computeAvailableTimes', () => {
  it('gera horários de 30 em 30 min dentro do expediente, respeitando a duração', () => {
    const times = computeAvailableTimes({
      businessHours: HOURS,
      dateStr: '2026-08-03', // segunda, 09:00-12:00
      durationMinutes: 60,
      existingAppointments: [],
      professionalCount: 1,
      now: new Date('2026-08-01T00:00:00'),
    })
    // Último horário possível: 11:00 (11:00+60min = 12:00, cabe exatamente)
    expect(times).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00'])
  })

  it('retorna vazio para dia fechado', () => {
    const times = computeAvailableTimes({
      businessHours: HOURS,
      dateStr: '2026-08-05', // quarta, fechado
      durationMinutes: 60,
      existingAppointments: [],
      professionalCount: 1,
      now: new Date('2026-08-01T00:00:00'),
    })
    expect(times).toEqual([])
  })

  it('remove horário quando todos os profissionais já estão ocupados naquele intervalo', () => {
    const times = computeAvailableTimes({
      businessHours: HOURS,
      dateStr: '2026-08-03',
      durationMinutes: 60,
      existingAppointments: [{ date: new Date('2026-08-03T09:00:00'), durationMinutes: 60 }],
      professionalCount: 1,
      now: new Date('2026-08-01T00:00:00'),
    })
    expect(times).not.toContain('09:00')
    expect(times).toContain('10:00')
  })

  it('mantém horário ocupado se ainda houver profissional livre (capacidade > agendamentos)', () => {
    const times = computeAvailableTimes({
      businessHours: HOURS,
      dateStr: '2026-08-03',
      durationMinutes: 60,
      existingAppointments: [{ date: new Date('2026-08-03T09:00:00'), durationMinutes: 60 }],
      professionalCount: 2,
      now: new Date('2026-08-01T00:00:00'),
    })
    expect(times).toContain('09:00')
  })

  it('não oferece horários que já passaram quando a data é hoje', () => {
    const times = computeAvailableTimes({
      businessHours: HOURS,
      dateStr: '2026-08-03',
      durationMinutes: 60,
      existingAppointments: [],
      professionalCount: 1,
      now: new Date('2026-08-03T10:15:00'),
    })
    expect(times).not.toContain('09:00')
    expect(times).not.toContain('10:00')
    expect(times).toContain('10:30')
  })
})
