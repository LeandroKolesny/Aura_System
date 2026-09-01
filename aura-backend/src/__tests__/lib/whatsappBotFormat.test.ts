import { describe, it, expect } from 'vitest'
import { getGreeting, formatBusinessHours } from '../../lib/whatsappBotFormat'
import type { BusinessHours } from '../../lib/businessHours'

describe('getGreeting', () => {
  it('retorna "Bom dia" de madrugada/manhã (antes das 12h em Brasília)', () => {
    expect(getGreeting(new Date('2026-08-03T11:59:00Z'))).toBe('Bom dia') // 08:59 BRT
  })

  it('retorna "Boa tarde" entre 12h e 18h em Brasília', () => {
    expect(getGreeting(new Date('2026-08-03T15:00:00Z'))).toBe('Boa tarde') // 12:00 BRT
    expect(getGreeting(new Date('2026-08-03T20:59:00Z'))).toBe('Boa tarde') // 17:59 BRT
  })

  it('retorna "Boa noite" a partir das 18h em Brasília', () => {
    expect(getGreeting(new Date('2026-08-03T21:00:00Z'))).toBe('Boa noite') // 18:00 BRT
    expect(getGreeting(new Date('2026-08-03T02:00:00Z'))).toBe('Boa noite') // 23:00 BRT (dia anterior)
  })
})

describe('formatBusinessHours', () => {
  it('agrupa dias consecutivos com o mesmo horário', () => {
    const hours: BusinessHours = {
      monday: { isOpen: true, start: '09:00', end: '18:00' },
      tuesday: { isOpen: true, start: '09:00', end: '18:00' },
      wednesday: { isOpen: true, start: '09:00', end: '18:00' },
      thursday: { isOpen: true, start: '09:00', end: '18:00' },
      friday: { isOpen: true, start: '09:00', end: '18:00' },
      saturday: { isOpen: true, start: '09:00', end: '13:00' },
      sunday: { isOpen: false, start: '00:00', end: '00:00' },
    }
    expect(formatBusinessHours(hours)).toBe('Segunda a sexta: 09:00 às 18:00 | Sábado: 09:00 às 13:00')
  })

  it('retorna mensagem padrão quando não há horário configurado', () => {
    expect(formatBusinessHours(null)).toBe('Consulte nossos horários com a equipe.')
  })

  it('retorna mensagem padrão quando todos os dias estão fechados', () => {
    const closedAllWeek: BusinessHours = {
      monday: { isOpen: false, start: '00:00', end: '00:00' },
      tuesday: { isOpen: false, start: '00:00', end: '00:00' },
      wednesday: { isOpen: false, start: '00:00', end: '00:00' },
      thursday: { isOpen: false, start: '00:00', end: '00:00' },
      friday: { isOpen: false, start: '00:00', end: '00:00' },
      saturday: { isOpen: false, start: '00:00', end: '00:00' },
      sunday: { isOpen: false, start: '00:00', end: '00:00' },
    }
    expect(formatBusinessHours(closedAllWeek)).toBe('Consulte nossos horários com a equipe.')
  })

  it('trata um único dia isolado sem agrupar com vizinhos de horário diferente', () => {
    const hours: BusinessHours = {
      monday: { isOpen: true, start: '08:00', end: '12:00' },
      tuesday: { isOpen: false, start: '00:00', end: '00:00' },
      wednesday: { isOpen: true, start: '14:00', end: '20:00' },
      thursday: { isOpen: false, start: '00:00', end: '00:00' },
      friday: { isOpen: false, start: '00:00', end: '00:00' },
      saturday: { isOpen: false, start: '00:00', end: '00:00' },
      sunday: { isOpen: false, start: '00:00', end: '00:00' },
    }
    expect(formatBusinessHours(hours)).toBe('Segunda: 08:00 às 12:00 | Quarta: 14:00 às 20:00')
  })
})
