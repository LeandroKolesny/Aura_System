// aura-backend/src/__tests__/lib/businessHours.test.ts
// Testes de funções puras — zero mocks necessários

import { describe, it, expect } from 'vitest'
import {
  isWithinBusinessHours,
  checkUnavailability,
  validateAppointmentTime,
  isCompleteBusinessHours,
  resolveEffectiveBusinessHours,
} from '../../lib/businessHours'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Semana de referência: 2025-01-06 (segunda) a 2025-01-12 (domingo)
// Verificado: getDay() retorna 1 para 06/01, 0 para 12/01 etc.
const WEEK = {
  monday:    new Date(2025, 0, 6),   // getDay() = 1
  tuesday:   new Date(2025, 0, 7),   // getDay() = 2
  wednesday: new Date(2025, 0, 8),   // getDay() = 3
  thursday:  new Date(2025, 0, 9),   // getDay() = 4
  friday:    new Date(2025, 0, 10),  // getDay() = 5
  saturday:  new Date(2025, 0, 11),  // getDay() = 6
  sunday:    new Date(2025, 0, 12),  // getDay() = 0
}

/** Cria cópia de uma data base com hora/minuto definidos */
const makeDate = (day: Date, hour: number, minute: number): Date => {
  const d = new Date(day)
  d.setHours(hour, minute, 0, 0)
  return d
}

/** BusinessHours padrão: seg-sex 08:00-18:00, sáb/dom fechado */
interface DayHours { isOpen: boolean; start: string; end: string }
interface BusinessHours {
  monday: DayHours; tuesday: DayHours; wednesday: DayHours;
  thursday: DayHours; friday: DayHours; saturday: DayHours; sunday: DayHours;
}

const makeBusinessHours = (overrides: Partial<BusinessHours> = {}): BusinessHours => ({
  monday:    { isOpen: true,  start: '08:00', end: '18:00' },
  tuesday:   { isOpen: true,  start: '08:00', end: '18:00' },
  wednesday: { isOpen: true,  start: '08:00', end: '18:00' },
  thursday:  { isOpen: true,  start: '08:00', end: '18:00' },
  friday:    { isOpen: true,  start: '08:00', end: '18:00' },
  saturday:  { isOpen: false, start: '08:00', end: '12:00' },
  sunday:    { isOpen: false, start: '08:00', end: '12:00' },
  ...overrides,
})

// ---------------------------------------------------------------------------
// isWithinBusinessHours
// ---------------------------------------------------------------------------

describe('isWithinBusinessHours', () => {

  // --- businessHours null ---
  describe('businessHours null', () => {
    it('null → { valid: true } (sem configuração, tudo permitido)', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 10, 0), null)
      expect(result).toEqual({ valid: true })
    })
  })

  // --- Dia fechado ---
  describe('dia fechado (isOpen: false)', () => {
    it('Sábado (isOpen: false) → valid: false', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.saturday, 10, 0), makeBusinessHours())
      expect(result.valid).toBe(false)
    })

    it('Sábado (isOpen: false) → message inclui "Sábado"', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.saturday, 10, 0), makeBusinessHours())
      expect(result.message).toMatch(/Sábado/i)
    })

    it('Domingo (isOpen: false) → valid: false', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.sunday, 10, 0), makeBusinessHours())
      expect(result.valid).toBe(false)
    })

    it('Domingo (isOpen: false) → message inclui "Domingo"', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.sunday, 10, 0), makeBusinessHours())
      expect(result.message).toMatch(/Domingo/i)
    })
  })

  // --- Antes da abertura ---
  describe('antes da abertura', () => {
    it('Segunda 07:59 (clínica abre 08:00) → valid: false', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 7, 59), makeBusinessHours())
      expect(result.valid).toBe(false)
    })

    it('Segunda 07:59 → message inclui "08:00"', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 7, 59), makeBusinessHours())
      expect(result.message).toContain('08:00')
    })

    it('Segunda 00:00 → valid: false', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 0, 0), makeBusinessHours())
      expect(result.valid).toBe(false)
    })
  })

  // --- No horário exato de abertura ---
  describe('horário exato de abertura', () => {
    it('Segunda 08:00 (exatamente na abertura) → valid: true', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 8, 0), makeBusinessHours())
      expect(result).toEqual({ valid: true })
    })
  })

  // --- Dentro do horário ---
  describe('dentro do horário de funcionamento', () => {
    it('Segunda 09:00 → valid: true', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 9, 0), makeBusinessHours())
      expect(result).toEqual({ valid: true })
    })

    it('Segunda 12:00 → valid: true', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 12, 0), makeBusinessHours())
      expect(result).toEqual({ valid: true })
    })

    it('Segunda 17:59 → valid: true', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 17, 59), makeBusinessHours())
      expect(result).toEqual({ valid: true })
    })
  })

  // --- No horário de fechamento (borda >= endMinutes) ---
  describe('horário de fechamento (borda >= endMinutes)', () => {
    it('Segunda 18:00 (exatamente no fechamento) → valid: false', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 18, 0), makeBusinessHours())
      expect(result.valid).toBe(false)
    })

    it('Segunda 18:00 → message inclui "18:00"', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 18, 0), makeBusinessHours())
      expect(result.message).toContain('18:00')
    })

    it('Segunda 18:01 → valid: false', () => {
      const result = isWithinBusinessHours(makeDate(WEEK.monday, 18, 1), makeBusinessHours())
      expect(result.valid).toBe(false)
    })
  })

  // --- start > end (janela invertida / "overnight") ---
  // DOC (achado 15 da auditoria): a função NÃO suporta janela que cruza a
  // meia-noite. Com start > end, nenhum horário passa nas duas checagens ao
  // mesmo tempo → o dia inteiro fica "fechado". Este teste trava esse
  // comportamento para que um suporte futuro a "overnight" quebre com aviso.
  describe('start > end (janela invertida — hoje trata como dia fechado)', () => {
    const bh = makeBusinessHours({
      monday: { isOpen: true, start: '20:00', end: '06:00' },
    })

    it('10:00 (entre "end" e "start") → valid: false', () => {
      expect(isWithinBusinessHours(makeDate(WEEK.monday, 10, 0), bh).valid).toBe(false)
    })

    it('22:00 (depois do "start" 20:00) → valid: false (>= endMinutes 06:00)', () => {
      expect(isWithinBusinessHours(makeDate(WEEK.monday, 22, 0), bh).valid).toBe(false)
    })

    it('02:00 (antes do "end" 06:00) → valid: false (< startMinutes 20:00)', () => {
      expect(isWithinBusinessHours(makeDate(WEEK.monday, 2, 0), bh).valid).toBe(false)
    })
  })

  // --- Horários customizados ---
  describe('horários customizados', () => {
    it('Sábado configurado como aberto 08:00-12:00, agendamento às 11:00 → valid: true', () => {
      const bh = makeBusinessHours({
        saturday: { isOpen: true, start: '08:00', end: '12:00' },
      })
      const result = isWithinBusinessHours(makeDate(WEEK.saturday, 11, 0), bh)
      expect(result).toEqual({ valid: true })
    })

    it('Sábado aberto 08:00-12:00, agendamento às 12:00 → valid: false (borda >= end)', () => {
      const bh = makeBusinessHours({
        saturday: { isOpen: true, start: '08:00', end: '12:00' },
      })
      const result = isWithinBusinessHours(makeDate(WEEK.saturday, 12, 0), bh)
      expect(result.valid).toBe(false)
    })

    it('Sexta com horário diferente (09:00-17:00), agendamento às 08:59 → valid: false', () => {
      const bh = makeBusinessHours({
        friday: { isOpen: true, start: '09:00', end: '17:00' },
      })
      const result = isWithinBusinessHours(makeDate(WEEK.friday, 8, 59), bh)
      expect(result.valid).toBe(false)
    })

    it('Sexta com horário diferente (09:00-17:00), agendamento às 09:00 → valid: true', () => {
      const bh = makeBusinessHours({
        friday: { isOpen: true, start: '09:00', end: '17:00' },
      })
      const result = isWithinBusinessHours(makeDate(WEEK.friday, 9, 0), bh)
      expect(result).toEqual({ valid: true })
    })
  })
})

// ---------------------------------------------------------------------------
// checkUnavailability
// ---------------------------------------------------------------------------

describe('checkUnavailability', () => {

  // Datas em ISO local (mesma data que WEEK.monday no fuso do servidor de testes)
  // O código faz date.toISOString().split('T')[0]; verificado que retorna '2025-01-06'
  const MON_ISO = '2025-01-06'
  const TUE_ISO = '2025-01-07'

  // --- Sem regras ---
  describe('sem regras', () => {
    it('array vazio → { blocked: false }', () => {
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'prof-1', [])
      expect(result).toEqual({ blocked: false })
    })
  })

  // --- Data não na regra ---
  describe('data não na regra', () => {
    it('data diferente da regra → { blocked: false }', () => {
      const rule = {
        id: 'rule-1',
        startTime: '09:00',
        endTime: '18:00',
        dates: [TUE_ISO], // regra para terça, agendamento na segunda
        professionalIds: ['prof-1'],
      }
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'prof-1', [rule])
      expect(result).toEqual({ blocked: false })
    })
  })

  // --- Data na regra + profissional específico ---
  describe('data na regra + profissional específico', () => {
    it('professionalIds: [prof-1], profissional = prof-1, dentro do horário → blocked: true', () => {
      const rule = {
        id: 'rule-1',
        startTime: '09:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: ['prof-1'],
      }
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'prof-1', [rule])
      expect(result.blocked).toBe(true)
    })

    it('professionalIds: [prof-1], profissional = prof-2 → blocked: false (outro profissional)', () => {
      const rule = {
        id: 'rule-1',
        startTime: '09:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: ['prof-1'],
      }
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'prof-2', [rule])
      expect(result).toEqual({ blocked: false })
    })
  })

  // --- Data na regra + todos os profissionais (professionalIds vazio) ---
  describe('todos os profissionais (professionalIds: [])', () => {
    it('professionalIds: [], qualquer profissional → blocked: true', () => {
      const rule = {
        id: 'rule-all',
        startTime: '09:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: [], // todos
      }
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'qualquer-prof', [rule])
      expect(result.blocked).toBe(true)
    })

    it('professionalIds: [], prof diferente → ainda blocked: true', () => {
      const rule = {
        id: 'rule-all',
        startTime: '09:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: [],
      }
      const result = checkUnavailability(makeDate(WEEK.monday, 14, 0), 'outro-prof', [rule])
      expect(result.blocked).toBe(true)
    })
  })

  // --- Fora do horário da regra ---
  describe('fora do horário da regra', () => {
    const ruleBase = {
      id: 'rule-time',
      dates: [MON_ISO],
      professionalIds: ['prof-1'],
      startTime: '10:00',
      endTime: '12:00',
    }

    it('regra 10:00-12:00, agendamento às 09:30 → blocked: false (antes do início)', () => {
      const result = checkUnavailability(makeDate(WEEK.monday, 9, 30), 'prof-1', [ruleBase])
      expect(result).toEqual({ blocked: false })
    })

    it('regra 10:00-12:00, agendamento às 12:00 → blocked: false (borda: >= start && < end)', () => {
      // timeMinutes(12:00) = 720, ruleEnd(12:00) = 720 — condição é < ruleEnd, então false
      const result = checkUnavailability(makeDate(WEEK.monday, 12, 0), 'prof-1', [ruleBase])
      expect(result).toEqual({ blocked: false })
    })

    it('regra 10:00-12:00, agendamento às 10:00 → blocked: true (exatamente no start)', () => {
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'prof-1', [ruleBase])
      expect(result.blocked).toBe(true)
    })

    it('regra 10:00-12:00, agendamento às 11:59 → blocked: true (último minuto válido)', () => {
      const result = checkUnavailability(makeDate(WEEK.monday, 11, 59), 'prof-1', [ruleBase])
      expect(result.blocked).toBe(true)
    })

    it('regra 10:00-12:00, agendamento às 12:01 → blocked: false (após o fim)', () => {
      const result = checkUnavailability(makeDate(WEEK.monday, 12, 1), 'prof-1', [ruleBase])
      expect(result).toEqual({ blocked: false })
    })
  })

  // --- Description customizada ---
  describe('reason / description da regra', () => {
    it('rule.description = "Reunião de equipe" → reason contém "Reunião de equipe"', () => {
      const rule = {
        id: 'rule-desc',
        description: 'Reunião de equipe',
        startTime: '09:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: ['prof-1'],
      }
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'prof-1', [rule])
      expect(result.blocked).toBe(true)
      expect(result.reason).toContain('Reunião de equipe')
    })

    it('rule.description = null → reason é o fallback padrão', () => {
      const rule = {
        id: 'rule-no-desc',
        description: null,
        startTime: '09:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: ['prof-1'],
      }
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'prof-1', [rule])
      expect(result.blocked).toBe(true)
      expect(result.reason).toBeTruthy()
      expect(typeof result.reason).toBe('string')
    })

    it('rule.description ausente (undefined) → reason é o fallback padrão', () => {
      const rule = {
        id: 'rule-no-desc-2',
        startTime: '09:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: ['prof-1'],
      }
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'prof-1', [rule])
      expect(result.blocked).toBe(true)
      expect(result.reason).toBe('Profissional indisponível neste horário')
    })
  })

  // --- Múltiplas regras ---
  describe('múltiplas regras', () => {
    it('primeira regra não bloqueia, segunda bloqueia → blocked: true', () => {
      const rules = [
        {
          id: 'rule-A',
          startTime: '14:00',
          endTime: '16:00',
          dates: [MON_ISO],
          professionalIds: ['prof-1'],
        },
        {
          id: 'rule-B',
          description: 'Treinamento',
          startTime: '09:00',
          endTime: '12:00',
          dates: [MON_ISO],
          professionalIds: ['prof-1'],
        },
      ]
      // Horário 10:00 — fora da regra A (14-16), dentro da regra B (09-12)
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'prof-1', rules)
      expect(result.blocked).toBe(true)
      expect(result.reason).toContain('Treinamento')
    })

    it('nenhuma regra bloqueia → { blocked: false }', () => {
      const rules = [
        {
          id: 'rule-A',
          startTime: '14:00',
          endTime: '16:00',
          dates: [TUE_ISO], // terça, agendamento na segunda
          professionalIds: ['prof-1'],
        },
        {
          id: 'rule-B',
          startTime: '09:00',
          endTime: '10:00',
          dates: [MON_ISO],
          professionalIds: ['prof-2'], // outro profissional
        },
      ]
      const result = checkUnavailability(makeDate(WEEK.monday, 10, 0), 'prof-1', rules)
      expect(result).toEqual({ blocked: false })
    })
  })
})

// ---------------------------------------------------------------------------
// validateAppointmentTime
// ---------------------------------------------------------------------------

describe('validateAppointmentTime', () => {
  const MON_ISO = '2025-01-06'

  // --- businessHours inválido ---
  describe('businessHours inválido', () => {
    it('dia fechado → { valid: false } com message de businessHours', () => {
      const bh = makeBusinessHours() // sábado fechado
      const result = validateAppointmentTime(
        makeDate(WEEK.saturday, 10, 0),
        'prof-1',
        bh,
        []
      )
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/Sábado/i)
    })

    it('antes da abertura → { valid: false } com message de abertura', () => {
      const bh = makeBusinessHours()
      const result = validateAppointmentTime(
        makeDate(WEEK.monday, 7, 0),
        'prof-1',
        bh,
        []
      )
      expect(result.valid).toBe(false)
      expect(result.message).toContain('08:00')
    })

    it('após o fechamento → { valid: false } com message de fechamento', () => {
      const bh = makeBusinessHours()
      const result = validateAppointmentTime(
        makeDate(WEEK.monday, 18, 0),
        'prof-1',
        bh,
        []
      )
      expect(result.valid).toBe(false)
      expect(result.message).toContain('18:00')
    })
  })

  // --- businessHours ok, profissional indisponível ---
  describe('businessHours ok, profissional indisponível', () => {
    it('profissional bloqueado → { valid: false } com message de indisponibilidade', () => {
      const bh = makeBusinessHours()
      const rule = {
        id: 'rule-1',
        description: 'Férias',
        startTime: '08:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: ['prof-1'],
      }
      const result = validateAppointmentTime(
        makeDate(WEEK.monday, 10, 0),
        'prof-1',
        bh,
        [rule]
      )
      expect(result.valid).toBe(false)
      expect(result.message).toContain('Férias')
    })

    it('profissional bloqueado por regra geral (professionalIds: []) → valid: false', () => {
      const bh = makeBusinessHours()
      const rule = {
        id: 'rule-all',
        startTime: '08:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: [],
      }
      const result = validateAppointmentTime(
        makeDate(WEEK.monday, 10, 0),
        'qualquer-prof',
        bh,
        [rule]
      )
      expect(result.valid).toBe(false)
    })
  })

  // --- Ambos ok ---
  describe('businessHours ok, profissional disponível', () => {
    it('horário válido e profissional disponível → { valid: true }', () => {
      const bh = makeBusinessHours()
      const result = validateAppointmentTime(
        makeDate(WEEK.monday, 10, 0),
        'prof-1',
        bh,
        []
      )
      expect(result).toEqual({ valid: true })
    })

    it('horário válido, regra para outro profissional → { valid: true }', () => {
      const bh = makeBusinessHours()
      const rule = {
        id: 'rule-1',
        startTime: '08:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: ['prof-2'], // outra pessoa bloqueada
      }
      const result = validateAppointmentTime(
        makeDate(WEEK.monday, 10, 0),
        'prof-1', // este não está bloqueado
        bh,
        [rule]
      )
      expect(result).toEqual({ valid: true })
    })
  })

  // --- businessHours null, sem regras ---
  describe('businessHours null, sem regras', () => {
    it('null businessHours + regras vazias → { valid: true }', () => {
      const result = validateAppointmentTime(
        makeDate(WEEK.monday, 10, 0),
        'prof-1',
        null,
        []
      )
      expect(result).toEqual({ valid: true })
    })

    it('null businessHours + regra que bloqueia → valid: false', () => {
      const rule = {
        id: 'rule-1',
        startTime: '08:00',
        endTime: '18:00',
        dates: [MON_ISO],
        professionalIds: ['prof-1'],
      }
      const result = validateAppointmentTime(
        makeDate(WEEK.monday, 10, 0),
        'prof-1',
        null,
        [rule]
      )
      expect(result.valid).toBe(false)
    })
  })

  // --- Ordem de prioridade: businessHours verificado antes da indisponibilidade ---
  describe('ordem de verificação', () => {
    it('dia fechado E profissional bloqueado → retorna erro de businessHours (primeiro)', () => {
      const bh = makeBusinessHours() // domingo fechado
      const rule = {
        id: 'rule-1',
        description: 'Bloqueio especial',
        startTime: '00:00',
        endTime: '23:59',
        dates: ['2025-01-12'], // domingo ISO
        professionalIds: ['prof-1'],
      }
      const result = validateAppointmentTime(
        makeDate(WEEK.sunday, 10, 0),
        'prof-1',
        bh,
        [rule]
      )
      expect(result.valid).toBe(false)
      // Deve ser o erro de businessHours (Domingo), não o de indisponibilidade
      expect(result.message).toMatch(/Domingo/i)
    })
  })
})

// ---------------------------------------------------------------------------
// checkUnavailability — risco de fuso horário (achado 4/5 da auditoria)
// ---------------------------------------------------------------------------
// `checkUnavailability` deriva o dia com `date.toISOString().split('T')[0]`
// (UTC). Perto da meia-noite, em fuso negativo (America/Sao_Paulo = UTC-3),
// isso "empurra" a data para o dia seguinte e a regra do dia LOCAL deixa de
// bater. Não reescrevemos a lógica agora (risco alto — ver TODO no código);
// este teste documenta o comportamento sob o TZ em que a suíte roda.

describe('checkUnavailability — comportamento de fuso perto da meia-noite (DOC)', () => {
  it('23:30 horário local: a data comparada vem de toISOString() (UTC), podendo divergir do dia local', () => {
    const localLateNight = new Date(2025, 0, 6, 23, 30) // 06/01/2025 23:30 no fuso local
    const isoDay = localLateNight.toISOString().split('T')[0]

    const ruleForLocalDay = {
      id: 'r-tz',
      startTime: '00:00',
      endTime: '23:59',
      dates: ['2025-01-06'], // dia LOCAL do agendamento
      professionalIds: [] as string[],
    }
    const result = checkUnavailability(localLateNight, 'p1', [ruleForLocalDay])

    if (isoDay === '2025-01-06') {
      // TZ do ambiente = UTC ou fuso positivo: a data bate → bloqueia normalmente
      expect(result.blocked).toBe(true)
    } else {
      // TZ negativo (ex.: America/Sao_Paulo): toISOString vira '2025-01-07' e a
      // regra do dia local NÃO bloqueia — bug de fuso documentado (// TODO no código)
      expect(isoDay).toBe('2025-01-07')
      expect(result.blocked).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// isCompleteBusinessHours
// ---------------------------------------------------------------------------

describe('isCompleteBusinessHours', () => {
  it('objeto com os 7 dias (cada um com isOpen) → true', () => {
    expect(isCompleteBusinessHours(makeBusinessHours())).toBe(true)
  })

  it('null / undefined → false', () => {
    expect(isCompleteBusinessHours(null)).toBe(false)
    expect(isCompleteBusinessHours(undefined)).toBe(false)
  })

  it('objeto vazio {} → false', () => {
    expect(isCompleteBusinessHours({})).toBe(false)
  })

  it('objeto parcial (falta domingo) → false', () => {
    const partial = { ...makeBusinessHours() } as Record<string, unknown>
    delete partial.sunday
    expect(isCompleteBusinessHours(partial)).toBe(false)
  })

  it('dia sem a chave isOpen → false', () => {
    const bad = { ...makeBusinessHours(), monday: { start: '08:00', end: '18:00' } }
    expect(isCompleteBusinessHours(bad)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// resolveEffectiveBusinessHours — precedência profissional > empresa
// ---------------------------------------------------------------------------

describe('resolveEffectiveBusinessHours', () => {
  const company = makeBusinessHours({ saturday: { isOpen: true, start: '08:00', end: '18:00' } })
  const professional = makeBusinessHours({ monday: { isOpen: true, start: '08:00', end: '12:00' } })

  it('profissional com os 7 dias configurados → usa o horário do profissional', () => {
    expect(resolveEffectiveBusinessHours(professional, company)).toBe(professional)
  })

  it('profissional sem horário (null) → cai no horário da empresa', () => {
    expect(resolveEffectiveBusinessHours(null, company)).toBe(company)
  })

  it('profissional com {} → cai no horário da empresa (fallback)', () => {
    expect(resolveEffectiveBusinessHours({}, company)).toBe(company)
  })

  it('profissional com objeto parcial → cai no horário da empresa', () => {
    expect(resolveEffectiveBusinessHours({ monday: professional.monday }, company)).toBe(company)
  })

  it('nenhum dos dois → retorna null (libera qualquer horário depois)', () => {
    expect(resolveEffectiveBusinessHours(null, null)).toBeNull()
  })
})
