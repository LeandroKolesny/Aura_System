import { describe, it, expect } from 'vitest'
import { buildConfirmationMessage, buildReminderMessage } from '../../lib/whatsappMessages'

const BASE = {
  patientName: 'Ana Silva',
  clinicName: 'Clínica Beleza',
  date: '25/03/2026',
  time: '14:00',
  procedure: 'Limpeza de Pele',
  professional: 'Dra. Maria',
}

describe('buildConfirmationMessage', () => {
  it('contém nome do paciente', () => {
    expect(buildConfirmationMessage(BASE)).toContain('Ana Silva')
  })
  it('contém nome da clínica', () => {
    expect(buildConfirmationMessage(BASE)).toContain('Clínica Beleza')
  })
  it('contém data e hora', () => {
    const msg = buildConfirmationMessage(BASE)
    expect(msg).toContain('25/03/2026')
    expect(msg).toContain('14:00')
  })
  it('contém pedido para salvar o número', () => {
    expect(buildConfirmationMessage(BASE)).toMatch(/salve este número/i)
  })
  it('contém procedimento', () => {
    expect(buildConfirmationMessage(BASE)).toContain('Limpeza de Pele')
  })
})

describe('buildReminderMessage', () => {
  it('contém nome do paciente', () => {
    expect(buildReminderMessage(BASE)).toContain('Ana Silva')
  })
  it('contém "amanhã"', () => {
    expect(buildReminderMessage(BASE)).toMatch(/amanhã/i)
  })
  it('contém hora do agendamento', () => {
    expect(buildReminderMessage(BASE)).toContain('14:00')
  })
})
