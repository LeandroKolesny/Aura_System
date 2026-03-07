// aura-backend/src/__tests__/lib/validations/appointment.test.ts
// Comprehensive Vitest tests for appointment Zod schemas

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createAppointmentSchema,
  publicBookingSchema,
  updateAppointmentSchema,
  updateStatusSchema,
  listAppointmentsQuerySchema,
} from '@/lib/validations/appointment'

// ===========================================================================
// createAppointmentSchema
// ===========================================================================
describe('createAppointmentSchema', () => {
  // -------------------------------------------------------------------------
  // Valid inputs
  // -------------------------------------------------------------------------
  describe('valid input', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('all required fields → success', () => {
      const input = {
        patientId: 'patient-123',
        professionalId: 'professional-456',
        procedureId: 'procedure-789',
        date: new Date('2025-06-15T11:00:00.000Z').toISOString(), // 1 hour from now
        durationMinutes: 60,
        price: 150,
      }
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('notes = null → success', () => {
      const input = {
        patientId: 'patient-123',
        professionalId: 'professional-456',
        procedureId: 'procedure-789',
        date: new Date('2025-06-15T11:00:00.000Z').toISOString(),
        durationMinutes: 60,
        price: 150,
        notes: null,
      }
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('notes = undefined → success (optional)', () => {
      const input = {
        patientId: 'patient-123',
        professionalId: 'professional-456',
        procedureId: 'procedure-789',
        date: new Date('2025-06-15T11:00:00.000Z').toISOString(),
        durationMinutes: 60,
        price: 150,
        notes: undefined,
      }
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('roomId = null → success', () => {
      const input = {
        patientId: 'patient-123',
        professionalId: 'professional-456',
        procedureId: 'procedure-789',
        date: new Date('2025-06-15T11:00:00.000Z').toISOString(),
        durationMinutes: 60,
        price: 150,
        roomId: null,
      }
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('roomId provided as number → success', () => {
      const input = {
        patientId: 'patient-123',
        professionalId: 'professional-456',
        procedureId: 'procedure-789',
        date: new Date('2025-06-15T11:00:00.000Z').toISOString(),
        durationMinutes: 60,
        price: 150,
        roomId: 3,
      }
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Date validation
  // -------------------------------------------------------------------------
  describe('date validation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    const baseInput = {
      patientId: 'patient-123',
      professionalId: 'professional-456',
      procedureId: 'procedure-789',
      durationMinutes: 60,
      price: 150,
    }

    it('date 1 hour in future → success', () => {
      const result = createAppointmentSchema.safeParse({
        ...baseInput,
        date: new Date('2025-06-15T11:00:00.000Z').toISOString(),
      })
      expect(result.success).toBe(true)
    })

    it('date exactly 30 minutes in future → success (>= boundary)', () => {
      const result = createAppointmentSchema.safeParse({
        ...baseInput,
        date: new Date('2025-06-15T10:30:00.000Z').toISOString(),
      })
      expect(result.success).toBe(true)
    })

    it('date 29 minutes in future → fails with "30 minutos de antecedência"', () => {
      const result = createAppointmentSchema.safeParse({
        ...baseInput,
        date: new Date('2025-06-15T10:29:00.000Z').toISOString(),
      })
      expect(result.success).toBe(false)
      const messages = result.error?.issues.map((i) => i.message) ?? []
      expect(messages.some((m) => m.includes('30 minutos de antecedência'))).toBe(true)
    })

    it('date in the past → fails', () => {
      const result = createAppointmentSchema.safeParse({
        ...baseInput,
        date: new Date('2025-06-15T09:00:00.000Z').toISOString(),
      })
      expect(result.success).toBe(false)
    })

    it('invalid date string "not-a-date" → fails with "Data inválida"', () => {
      const result = createAppointmentSchema.safeParse({
        ...baseInput,
        date: 'not-a-date',
      })
      expect(result.success).toBe(false)
      const messages = result.error?.issues.map((i) => i.message) ?? []
      expect(messages.some((m) => m.includes('Data inválida'))).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // durationMinutes validation
  // -------------------------------------------------------------------------
  describe('durationMinutes validation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    const baseInput = {
      patientId: 'patient-123',
      professionalId: 'professional-456',
      procedureId: 'procedure-789',
      date: new Date('2025-06-15T11:00:00.000Z').toISOString(),
      price: 150,
    }

    it('durationMinutes = 15 → success (minimum)', () => {
      const result = createAppointmentSchema.safeParse({ ...baseInput, durationMinutes: 15 })
      expect(result.success).toBe(true)
    })

    it('durationMinutes = 14 → fails with "15 minutos"', () => {
      const result = createAppointmentSchema.safeParse({ ...baseInput, durationMinutes: 14 })
      expect(result.success).toBe(false)
      const messages = result.error?.issues.map((i) => i.message) ?? []
      expect(messages.some((m) => m.includes('15 minutos'))).toBe(true)
    })

    it('durationMinutes = 480 → success (maximum)', () => {
      const result = createAppointmentSchema.safeParse({ ...baseInput, durationMinutes: 480 })
      expect(result.success).toBe(true)
    })

    it('durationMinutes = 481 → fails with "8 horas"', () => {
      const result = createAppointmentSchema.safeParse({ ...baseInput, durationMinutes: 481 })
      expect(result.success).toBe(false)
      const messages = result.error?.issues.map((i) => i.message) ?? []
      expect(messages.some((m) => m.includes('8 horas'))).toBe(true)
    })

    it('durationMinutes = 60 → success', () => {
      const result = createAppointmentSchema.safeParse({ ...baseInput, durationMinutes: 60 })
      expect(result.success).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // price validation
  // -------------------------------------------------------------------------
  describe('price validation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    const baseInput = {
      patientId: 'patient-123',
      professionalId: 'professional-456',
      procedureId: 'procedure-789',
      date: new Date('2025-06-15T11:00:00.000Z').toISOString(),
      durationMinutes: 60,
    }

    it('price = 0 → success', () => {
      const result = createAppointmentSchema.safeParse({ ...baseInput, price: 0 })
      expect(result.success).toBe(true)
    })

    it('price = 100.50 → success', () => {
      const result = createAppointmentSchema.safeParse({ ...baseInput, price: 100.5 })
      expect(result.success).toBe(true)
    })

    it('price = -1 → fails with "negativo"', () => {
      const result = createAppointmentSchema.safeParse({ ...baseInput, price: -1 })
      expect(result.success).toBe(false)
      const messages = result.error?.issues.map((i) => i.message) ?? []
      expect(messages.some((m) => m.includes('negativo'))).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // notes validation
  // -------------------------------------------------------------------------
  describe('notes validation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    const baseInput = {
      patientId: 'patient-123',
      professionalId: 'professional-456',
      procedureId: 'procedure-789',
      date: new Date('2025-06-15T11:00:00.000Z').toISOString(),
      durationMinutes: 60,
      price: 150,
    }

    it('notes with exactly 500 chars → success', () => {
      const result = createAppointmentSchema.safeParse({
        ...baseInput,
        notes: 'a'.repeat(500),
      })
      expect(result.success).toBe(true)
    })

    it('notes with 501 chars → fails with "500 caracteres"', () => {
      const result = createAppointmentSchema.safeParse({
        ...baseInput,
        notes: 'a'.repeat(501),
      })
      expect(result.success).toBe(false)
      const messages = result.error?.issues.map((i) => i.message) ?? []
      expect(messages.some((m) => m.includes('500 caracteres'))).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Missing required fields
  // -------------------------------------------------------------------------
  describe('missing required fields', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    const fullInput = {
      patientId: 'patient-123',
      professionalId: 'professional-456',
      procedureId: 'procedure-789',
      date: new Date('2025-06-15T11:00:00.000Z').toISOString(),
      durationMinutes: 60,
      price: 150,
    }

    it('missing patientId → fails', () => {
      const { patientId: _, ...input } = fullInput
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('missing professionalId → fails', () => {
      const { professionalId: _, ...input } = fullInput
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('missing procedureId → fails', () => {
      const { procedureId: _, ...input } = fullInput
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('missing date → fails', () => {
      const { date: _, ...input } = fullInput
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('missing durationMinutes → fails', () => {
      const { durationMinutes: _, ...input } = fullInput
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('missing price → fails', () => {
      const { price: _, ...input } = fullInput
      const result = createAppointmentSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })
})

// ===========================================================================
// publicBookingSchema
// ===========================================================================
describe('publicBookingSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T10:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const baseInput = {
    procedureId: 'procedure-789',
    professionalId: 'professional-456',
    patientName: 'Ana Silva',
    patientEmail: 'ana@example.com',
    patientPhone: '11987654321',
  }

  describe('date validation', () => {
    it('valid input with date 3 hours from now → success', () => {
      const result = publicBookingSchema.safeParse({
        ...baseInput,
        date: new Date('2025-06-15T13:00:00.000Z').toISOString(),
      })
      expect(result.success).toBe(true)
    })

    it('date exactly 2 hours from now → success (boundary)', () => {
      // now=10:00:00, schema does now.setHours(now.getHours() + 2) = 12:00:00, date >= 12:00:00
      const result = publicBookingSchema.safeParse({
        ...baseInput,
        date: new Date('2025-06-15T12:00:00.000Z').toISOString(),
      })
      expect(result.success).toBe(true)
    })

    it('date 1 hour from now (< 2h advance) → fails', () => {
      const result = publicBookingSchema.safeParse({
        ...baseInput,
        date: new Date('2025-06-15T11:00:00.000Z').toISOString(),
      })
      expect(result.success).toBe(false)
      const messages = result.error?.issues.map((i) => i.message) ?? []
      expect(messages.some((m) => m.includes('Data inválida ou muito próxima'))).toBe(true)
    })
  })

  describe('patient field validation', () => {
    it('invalid email → fails', () => {
      const result = publicBookingSchema.safeParse({
        ...baseInput,
        date: new Date('2025-06-15T13:00:00.000Z').toISOString(),
        patientEmail: 'not-an-email',
      })
      expect(result.success).toBe(false)
    })

    it('patientName with 2 chars (< 3) → fails', () => {
      const result = publicBookingSchema.safeParse({
        ...baseInput,
        date: new Date('2025-06-15T13:00:00.000Z').toISOString(),
        patientName: 'AB',
      })
      expect(result.success).toBe(false)
    })

    it('patientPhone with 9 chars (< 10) → fails', () => {
      const result = publicBookingSchema.safeParse({
        ...baseInput,
        date: new Date('2025-06-15T13:00:00.000Z').toISOString(),
        patientPhone: '123456789',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ===========================================================================
// updateAppointmentSchema
// ===========================================================================
describe('updateAppointmentSchema', () => {
  it('empty object → success (all optional)', () => {
    const result = updateAppointmentSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('valid partial update with date, price and notes → success', () => {
    // Note: updateAppointmentSchema.date is z.string().optional() with no format refine —
    // any string value passes. This is intentional (backend validates on use).
    const result = updateAppointmentSchema.safeParse({
      date: '2025-07-01T10:00:00.000Z',
      price: 200,
      notes: 'Updated notes',
    })
    expect(result.success).toBe(true)
  })

  it('durationMinutes = 14 → fails (min 15)', () => {
    const result = updateAppointmentSchema.safeParse({ durationMinutes: 14 })
    expect(result.success).toBe(false)
  })

  it('durationMinutes = 15 → success (minimum boundary)', () => {
    const result = updateAppointmentSchema.safeParse({ durationMinutes: 15 })
    expect(result.success).toBe(true)
  })

  it('durationMinutes = 480 → success (maximum boundary)', () => {
    const result = updateAppointmentSchema.safeParse({ durationMinutes: 480 })
    expect(result.success).toBe(true)
  })

  it('durationMinutes = 481 → fails (max 480)', () => {
    const result = updateAppointmentSchema.safeParse({ durationMinutes: 481 })
    expect(result.success).toBe(false)
  })

  it('price = -1 → fails (min 0)', () => {
    const result = updateAppointmentSchema.safeParse({ price: -1 })
    expect(result.success).toBe(false)
  })

  it('price = 0 → success', () => {
    const result = updateAppointmentSchema.safeParse({ price: 0 })
    expect(result.success).toBe(true)
  })

  it('notes = null → success (nullable)', () => {
    const result = updateAppointmentSchema.safeParse({ notes: null })
    expect(result.success).toBe(true)
  })

  it('roomId = null → success (nullable)', () => {
    const result = updateAppointmentSchema.safeParse({ roomId: null })
    expect(result.success).toBe(true)
  })

  it('professionalId as string → success', () => {
    const result = updateAppointmentSchema.safeParse({ professionalId: 'prof-999' })
    expect(result.success).toBe(true)
  })

  it('notes with 501 chars → fails', () => {
    const result = updateAppointmentSchema.safeParse({ notes: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })
})

// ===========================================================================
// updateStatusSchema
// ===========================================================================
describe('updateStatusSchema', () => {
  it('"SCHEDULED" → success', () => {
    const result = updateStatusSchema.safeParse({ status: 'SCHEDULED' })
    expect(result.success).toBe(true)
  })

  it('"CONFIRMED" → success', () => {
    const result = updateStatusSchema.safeParse({ status: 'CONFIRMED' })
    expect(result.success).toBe(true)
  })

  it('"COMPLETED" → success', () => {
    const result = updateStatusSchema.safeParse({ status: 'COMPLETED' })
    expect(result.success).toBe(true)
  })

  it('"CANCELED" → success', () => {
    const result = updateStatusSchema.safeParse({ status: 'CANCELED' })
    expect(result.success).toBe(true)
  })

  it('"PENDING_APPROVAL" → success', () => {
    const result = updateStatusSchema.safeParse({ status: 'PENDING_APPROVAL' })
    expect(result.success).toBe(true)
  })

  it('invalid status "DONE" → fails', () => {
    const result = updateStatusSchema.safeParse({ status: 'DONE' })
    expect(result.success).toBe(false)
  })

  it('invalid status "pending" (lowercase) → fails', () => {
    const result = updateStatusSchema.safeParse({ status: 'pending' })
    expect(result.success).toBe(false)
  })

  it('cancelReason optional — not provided → success', () => {
    const result = updateStatusSchema.safeParse({ status: 'CANCELED' })
    expect(result.success).toBe(true)
  })

  it('cancelReason provided with valid text → success', () => {
    const result = updateStatusSchema.safeParse({
      status: 'CANCELED',
      cancelReason: 'Patient requested cancellation',
    })
    expect(result.success).toBe(true)
  })

  it('cancelReason with exactly 200 chars → success (boundary)', () => {
    const result = updateStatusSchema.safeParse({
      status: 'CANCELED',
      cancelReason: 'a'.repeat(200),
    })
    expect(result.success).toBe(true)
  })

  it('cancelReason with 201 chars → fails (max 200)', () => {
    const result = updateStatusSchema.safeParse({
      status: 'CANCELED',
      cancelReason: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
  })
})

// ===========================================================================
// listAppointmentsQuerySchema
// ===========================================================================
describe('listAppointmentsQuerySchema', () => {
  it('empty object → success with defaults page=1, limit=50', () => {
    const result = listAppointmentsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(50)
    }
  })

  it('page=2, limit=10 → success', () => {
    const result = listAppointmentsQuerySchema.safeParse({ page: 2, limit: 10 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.limit).toBe(10)
    }
  })

  it('page=0 → fails (min 1)', () => {
    const result = listAppointmentsQuerySchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })

  it('limit=101 → fails (max 100)', () => {
    const result = listAppointmentsQuerySchema.safeParse({ limit: 101 })
    expect(result.success).toBe(false)
  })

  it('limit=100 → success (boundary)', () => {
    const result = listAppointmentsQuerySchema.safeParse({ limit: 100 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(100)
    }
  })

  it('null values for optional string fields → treated as undefined (nullToUndefined)', () => {
    const result = listAppointmentsQuerySchema.safeParse({
      startDate: null,
      endDate: null,
      professionalId: null,
      patientId: null,
      status: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.startDate).toBeUndefined()
      expect(result.data.endDate).toBeUndefined()
      expect(result.data.professionalId).toBeUndefined()
      expect(result.data.patientId).toBeUndefined()
      expect(result.data.status).toBeUndefined()
    }
  })

  it('empty string for page/limit → treated as undefined (nullToUndefined), uses defaults', () => {
    const result = listAppointmentsQuerySchema.safeParse({ page: '', limit: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(50)
    }
  })

  it('status="all" → success', () => {
    const result = listAppointmentsQuerySchema.safeParse({ status: 'all' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('all')
    }
  })

  it('status="SCHEDULED" → success', () => {
    const result = listAppointmentsQuerySchema.safeParse({ status: 'SCHEDULED' })
    expect(result.success).toBe(true)
  })

  it('status="CONFIRMED" → success', () => {
    const result = listAppointmentsQuerySchema.safeParse({ status: 'CONFIRMED' })
    expect(result.success).toBe(true)
  })

  it('status="COMPLETED" → success', () => {
    const result = listAppointmentsQuerySchema.safeParse({ status: 'COMPLETED' })
    expect(result.success).toBe(true)
  })

  it('status="CANCELED" → success', () => {
    const result = listAppointmentsQuerySchema.safeParse({ status: 'CANCELED' })
    expect(result.success).toBe(true)
  })

  it('status="PENDING_APPROVAL" → success', () => {
    const result = listAppointmentsQuerySchema.safeParse({ status: 'PENDING_APPROVAL' })
    expect(result.success).toBe(true)
  })

  it('status="INVALID" → fails', () => {
    const result = listAppointmentsQuerySchema.safeParse({ status: 'INVALID' })
    expect(result.success).toBe(false)
  })

  it('string page and limit coerced to numbers → success', () => {
    const result = listAppointmentsQuerySchema.safeParse({ page: '3', limit: '25' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(25)
    }
  })

  it('all filters provided → success', () => {
    const result = listAppointmentsQuerySchema.safeParse({
      page: 1,
      limit: 20,
      startDate: '2025-06-01',
      endDate: '2025-06-30',
      professionalId: 'prof-123',
      patientId: 'pat-456',
      status: 'CONFIRMED',
    })
    expect(result.success).toBe(true)
  })
})
