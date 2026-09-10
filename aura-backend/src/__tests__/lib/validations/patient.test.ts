// aura-backend/src/__tests__/lib/validations/patient.test.ts
// Comprehensive Vitest tests for patient Zod schemas

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createPatientSchema,
  updatePatientSchema,
  signConsentSchema,
  listPatientsQuerySchema,
} from '@/lib/validations/patient'

// ===========================================================================
// createPatientSchema — valid inputs
// ===========================================================================
describe('createPatientSchema', () => {
  describe('valid input', () => {
    it('all required fields only → success with status defaulting to ACTIVE', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana Silva',
        email: 'ana@example.com',
        phone: '1198765432', // 10 chars minimum
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('ACTIVE')
      }
    })

    it('with valid CPF → success', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana Silva',
        email: 'ana@example.com',
        phone: '1198765432',
        cpf: '529.982.247-25',
      })
      expect(result.success).toBe(true)
    })

  })

  // -------------------------------------------------------------------------
  // name validation
  // -------------------------------------------------------------------------
  describe('name validation', () => {
    it('name with exactly 3 chars → success (minimum boundary)', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana',
        email: 'ana@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(true)
    })

    it('name with 2 chars → fails (below minimum)', () => {
      const result = createPatientSchema.safeParse({
        name: 'An',
        email: 'ana@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(false)
    })

    it('name with exactly 100 chars → success (maximum boundary)', () => {
      const name100 = 'A'.repeat(49) + ' ' + 'B'.repeat(50) // 100 chars total
      const result = createPatientSchema.safeParse({
        name: name100,
        email: 'ana@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(true)
    })

    it('name with 101 chars → fails (above maximum)', () => {
      const name101 = 'A'.repeat(50) + ' ' + 'B'.repeat(50) // 101 chars
      const result = createPatientSchema.safeParse({
        name: name101,
        email: 'ana@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(false)
    })

    it('name with numbers → fails (regex: only letters/spaces)', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana2 Silva',
        email: 'ana@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('letras'))).toBe(true)
      }
    })

    it('name with hyphen ("Ana-Paula") → success (nomes compostos)', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana-Paula Ferreira',
        email: 'ana@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(true)
    })

    it('name with apostrophe ("O\'Brien") → success (sobrenomes com apóstrofo)', () => {
      const result = createPatientSchema.safeParse({
        name: "Sean O'Brien",
        email: 'sean@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(true)
    })

    it('name with accent + hyphen ("D\'Ávila-Souza") → success', () => {
      const result = createPatientSchema.safeParse({
        name: "Maria D'Ávila-Souza",
        email: 'maria@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(true)
    })

    it('name with other special chars (@, #, digits) → still fails', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana@Silva#1',
        email: 'ana@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(false)
    })

    it('name with Portuguese accented chars (João) → success', () => {
      const result = createPatientSchema.safeParse({
        name: 'João',
        email: 'joao@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(true)
    })

    it('name with Portuguese accented chars (Amélia) → success', () => {
      const result = createPatientSchema.safeParse({
        name: 'Amélia Santos',
        email: 'amelia@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(true)
    })

    it('name as empty string → fails', () => {
      const result = createPatientSchema.safeParse({
        name: '',
        email: 'ana@example.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // email validation
  // -------------------------------------------------------------------------
  describe('email validation', () => {
    it('valid email → success', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana Silva',
        email: 'ana.silva@clinica.com.br',
        phone: '1198765432',
      })
      expect(result.success).toBe(true)
    })

    it('invalid email "not-email" → fails', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana Silva',
        email: 'not-email',
        phone: '1198765432',
      })
      expect(result.success).toBe(false)
    })

    it('email without @ → fails', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana Silva',
        email: 'anaexample.com',
        phone: '1198765432',
      })
      expect(result.success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // phone validation
  // Note: phoneRegex is defined in patient.ts source but is NOT applied in the
  // schema — only min(10)/max(20) length constraints are enforced. Any string
  // of 10–20 chars passes, regardless of formatting.
  // -------------------------------------------------------------------------
  describe('phone validation', () => {
    it('phone with exactly 10 chars → success (minimum boundary)', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana Silva',
        email: 'ana@example.com',
        phone: '1132345678', // 10 chars
      })
      expect(result.success).toBe(true)
    })

    it('phone with 9 chars → fails (below minimum)', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana Silva',
        email: 'ana@example.com',
        phone: '113234567', // 9 chars
      })
      expect(result.success).toBe(false)
    })

    it('phone with exactly 20 chars → success (maximum boundary)', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana Silva',
        email: 'ana@example.com',
        phone: '12345678901234567890', // 20 chars
      })
      expect(result.success).toBe(true)
    })

    it('phone with 21 chars → fails (above maximum)', () => {
      const result = createPatientSchema.safeParse({
        name: 'Ana Silva',
        email: 'ana@example.com',
        phone: '123456789012345678901', // 21 chars
      })
      expect(result.success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // birthDate validation
  // -------------------------------------------------------------------------
  describe('birthDate validation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-07T12:00:00.000Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    const baseInput = {
      name: 'Ana Silva',
      email: 'ana@example.com',
      phone: '1198765432',
    }

    it('past date (1990-01-01) → success', () => {
      const result = createPatientSchema.safeParse({
        ...baseInput,
        birthDate: '1990-01-01',
      })
      expect(result.success).toBe(true)
    })

    it('future date → fails with "Data de nascimento inválida"', () => {
      const result = createPatientSchema.safeParse({
        ...baseInput,
        birthDate: '2030-01-01',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('Data de nascimento inválida'))).toBe(true)
      }
    })

    it('invalid string "not-a-date" → fails', () => {
      const result = createPatientSchema.safeParse({
        ...baseInput,
        birthDate: 'not-a-date',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('Data de nascimento inválida'))).toBe(true)
      }
    })

    it('birthDate = null → success (optional/nullable)', () => {
      const result = createPatientSchema.safeParse({
        ...baseInput,
        birthDate: null,
      })
      expect(result.success).toBe(true)
    })

    it('birthDate = undefined → success (optional)', () => {
      const result = createPatientSchema.safeParse({
        ...baseInput,
        birthDate: undefined,
      })
      expect(result.success).toBe(true)
    })

    it('with birthDate in the past and CPF → success (full valid input)', () => {
      const result = createPatientSchema.safeParse({
        ...baseInput,
        birthDate: '1990-01-01',
        cpf: '529.982.247-25',
      })
      expect(result.success).toBe(true)
    })

    it('with all fields including anamnesisSummary → success', () => {
      const result = createPatientSchema.safeParse({
        name: 'Maria Oliveira',
        email: 'maria@example.com',
        phone: '11987654321',
        birthDate: '1985-06-15',
        cpf: '529.982.247-25',
        status: 'LEAD',
        anamnesisSummary: 'Paciente com histórico de alergia a determinados cosméticos.',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.anamnesisSummary).toBe(
          'Paciente com histórico de alergia a determinados cosméticos.'
        )
      }
    })
  })

  // -------------------------------------------------------------------------
  // CPF validation (algorithm tests)
  // -------------------------------------------------------------------------
  describe('CPF validation', () => {
    const baseInput = {
      name: 'Ana Silva',
      email: 'ana@example.com',
      phone: '1198765432',
    }

    it('cpf = null → success (optional/nullable)', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: null })
      expect(result.success).toBe(true)
    })

    it('cpf = undefined → success (optional)', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: undefined })
      expect(result.success).toBe(true)
    })

    it('valid CPF "529.982.247-25" → success', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: '529.982.247-25' })
      expect(result.success).toBe(true)
    })

    it('invalid CPF "296.740.235-15" → fails (wrong checksum despite task description claim)', () => {
      // The algorithm rejects this CPF — the first check digit does not satisfy the algorithm.
      // Verified by running isValidCPF('296.740.235-15') === false.
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: '296.740.235-15' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('CPF inválido'))).toBe(true)
      }
    })

    it('valid CPF "111.444.777-35" → success', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: '111.444.777-35' })
      expect(result.success).toBe(true)
    })

    it('all-same-digit CPF "111.111.111-11" → fails with "CPF inválido"', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: '111.111.111-11' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('CPF inválido'))).toBe(true)
      }
    })

    it('all-same-digit CPF "000.000.000-00" → fails with "CPF inválido"', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: '000.000.000-00' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('CPF inválido'))).toBe(true)
      }
    })

    it('wrong checksum CPF "529.982.247-26" → fails with "CPF inválido"', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: '529.982.247-26' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('CPF inválido'))).toBe(true)
      }
    })

    it('CPF "123.456.789-09" → fails (well-known placeholder CPF, blacklisted by cpf-cnpj-validator)', () => {
      // Passa no cálculo de dígito verificador, mas é um CPF-modelo amplamente
      // usado como dado de teste/preenchimento falso — a lib cpf-cnpj-validator
      // rejeita esse e outros CPFs "óbvios" mesmo com checksum válido, o que é
      // mais correto que o algoritmo manual anterior (que só bloqueava dígitos repetidos).
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: '123.456.789-09' })
      expect(result.success).toBe(false)
    })

    it('CPF with wrong format missing check digits "529.982.247" → fails (length != 11 after clean)', () => {
      // After stripping non-digits: "529982247" = 9 digits, not 11 → isValidCPF returns false
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: '529.982.247' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message)
        expect(messages.some((m) => m.includes('CPF inválido'))).toBe(true)
      }
    })

    it('unformatted CPF "52998224725" (no dots/dash) with valid checksum → success', () => {
      // isValidCPF strips non-digits first, so unformatted valid CPF passes
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: '52998224725' })
      expect(result.success).toBe(true)
    })

    it('unformatted CPF "29674023515" (no dots/dash) → fails (invalid checksum for this number)', () => {
      // isValidCPF('29674023515') === false — the algorithm rejects it.
      const result = createPatientSchema.safeParse({ ...baseInput, cpf: '29674023515' })
      expect(result.success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // status validation
  // -------------------------------------------------------------------------
  describe('status validation', () => {
    const baseInput = {
      name: 'Ana Silva',
      email: 'ana@example.com',
      phone: '1198765432',
    }

    it('"ACTIVE" → success', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, status: 'ACTIVE' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('ACTIVE')
      }
    })

    it('"INACTIVE" → success', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, status: 'INACTIVE' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('INACTIVE')
      }
    })

    it('"LEAD" → success', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, status: 'LEAD' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('LEAD')
      }
    })

    it('"ADMIN" → fails (not in enum)', () => {
      const result = createPatientSchema.safeParse({ ...baseInput, status: 'ADMIN' })
      expect(result.success).toBe(false)
    })

    it('status not provided → success, defaults to "ACTIVE"', () => {
      const result = createPatientSchema.safeParse({ ...baseInput })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('ACTIVE')
      }
    })
  })
})

// ===========================================================================
// updatePatientSchema
// ===========================================================================
describe('updatePatientSchema', () => {
  it('empty object → success (all fields optional)', () => {
    const result = updatePatientSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('partial update with name only → success', () => {
    const result = updatePatientSchema.safeParse({ name: 'Carlos Souza' })
    expect(result.success).toBe(true)
  })

  it('partial update with email only → success', () => {
    const result = updatePatientSchema.safeParse({ email: 'carlos@example.com' })
    expect(result.success).toBe(true)
  })

  it('partial update with status only → success', () => {
    const result = updatePatientSchema.safeParse({ status: 'INACTIVE' })
    expect(result.success).toBe(true)
  })

  it('invalid name (numbers) in update → fails', () => {
    const result = updatePatientSchema.safeParse({ name: 'Carlos123' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('letras'))).toBe(true)
    }
  })

  it('name too short (2 chars) in update → fails', () => {
    const result = updatePatientSchema.safeParse({ name: 'AB' })
    expect(result.success).toBe(false)
  })

  it('invalid email in update → fails', () => {
    const result = updatePatientSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('invalid status in update → fails', () => {
    const result = updatePatientSchema.safeParse({ status: 'BANNED' })
    expect(result.success).toBe(false)
  })

  it('invalid CPF in update → fails', () => {
    const result = updatePatientSchema.safeParse({ cpf: '111.111.111-11' })
    expect(result.success).toBe(false)
  })

  it('valid CPF in update → success', () => {
    const result = updatePatientSchema.safeParse({ cpf: '529.982.247-25' })
    expect(result.success).toBe(true)
  })

  it('anamnesisSummary = null in update → success (nullable)', () => {
    const result = updatePatientSchema.safeParse({ anamnesisSummary: null })
    expect(result.success).toBe(true)
  })
})

// ===========================================================================
// signConsentSchema
// ===========================================================================
describe('signConsentSchema', () => {
  it('valid signatureUrl → success', () => {
    const result = signConsentSchema.safeParse({
      signatureUrl: 'https://storage.example.com/signatures/abc123.png',
    })
    expect(result.success).toBe(true)
  })

  it('empty signatureUrl "" → fails with "Assinatura é obrigatória"', () => {
    const result = signConsentSchema.safeParse({ signatureUrl: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('Assinatura é obrigatória'))).toBe(true)
    }
  })

  it('without metadata → success (metadata optional)', () => {
    const result = signConsentSchema.safeParse({
      signatureUrl: 'https://storage.example.com/sig.png',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.metadata).toBeUndefined()
    }
  })

  it('with full metadata → success', () => {
    const result = signConsentSchema.safeParse({
      signatureUrl: 'https://storage.example.com/sig.png',
      metadata: {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        documentVersion: 'v2.1',
      },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.metadata?.ipAddress).toBe('192.168.1.1')
      expect(result.data.metadata?.userAgent).toBe('Mozilla/5.0')
      expect(result.data.metadata?.documentVersion).toBe('v2.1')
    }
  })

  it('with empty metadata object → success (all metadata fields optional)', () => {
    const result = signConsentSchema.safeParse({
      signatureUrl: 'https://storage.example.com/sig.png',
      metadata: {},
    })
    expect(result.success).toBe(true)
  })

  it('with partial metadata (ipAddress only) → success', () => {
    const result = signConsentSchema.safeParse({
      signatureUrl: 'https://storage.example.com/sig.png',
      metadata: { ipAddress: '10.0.0.1' },
    })
    expect(result.success).toBe(true)
  })

  it('missing signatureUrl field → fails', () => {
    const result = signConsentSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ===========================================================================
// listPatientsQuerySchema
// ===========================================================================
describe('listPatientsQuerySchema', () => {
  it('empty object → success with defaults (page=1, limit=20, sortBy="name", sortOrder="asc")', () => {
    const result = listPatientsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
      expect(result.data.sortBy).toBe('name')
      expect(result.data.sortOrder).toBe('asc')
    }
  })

  it('all valid params → success', () => {
    const result = listPatientsQuerySchema.safeParse({
      page: 2,
      limit: 50,
      search: 'ana',
      status: 'ACTIVE',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.limit).toBe(50)
      expect(result.data.search).toBe('ana')
      expect(result.data.status).toBe('ACTIVE')
      expect(result.data.sortBy).toBe('createdAt')
      expect(result.data.sortOrder).toBe('desc')
    }
  })

  it('invalid status value → fails', () => {
    const result = listPatientsQuerySchema.safeParse({ status: 'BANNED' })
    expect(result.success).toBe(false)
  })

  it('status = "all" → success', () => {
    const result = listPatientsQuerySchema.safeParse({ status: 'all' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('all')
    }
  })

  it('status = "INACTIVE" → success', () => {
    const result = listPatientsQuerySchema.safeParse({ status: 'INACTIVE' })
    expect(result.success).toBe(true)
  })

  it('status = "LEAD" → success', () => {
    const result = listPatientsQuerySchema.safeParse({ status: 'LEAD' })
    expect(result.success).toBe(true)
  })

  it('invalid sortBy value → fails', () => {
    const result = listPatientsQuerySchema.safeParse({ sortBy: 'email' })
    expect(result.success).toBe(false)
  })

  it('sortBy = "name" → success', () => {
    const result = listPatientsQuerySchema.safeParse({ sortBy: 'name' })
    expect(result.success).toBe(true)
  })

  it('sortBy = "createdAt" → success', () => {
    const result = listPatientsQuerySchema.safeParse({ sortBy: 'createdAt' })
    expect(result.success).toBe(true)
  })

  it('sortBy = "lastVisit" → success', () => {
    const result = listPatientsQuerySchema.safeParse({ sortBy: 'lastVisit' })
    expect(result.success).toBe(true)
  })

  it('invalid sortOrder value → fails', () => {
    const result = listPatientsQuerySchema.safeParse({ sortOrder: 'random' })
    expect(result.success).toBe(false)
  })

  it('sortOrder = "asc" → success', () => {
    const result = listPatientsQuerySchema.safeParse({ sortOrder: 'asc' })
    expect(result.success).toBe(true)
  })

  it('sortOrder = "desc" → success', () => {
    const result = listPatientsQuerySchema.safeParse({ sortOrder: 'desc' })
    expect(result.success).toBe(true)
  })

  it('page = 0 → fails (min 1)', () => {
    const result = listPatientsQuerySchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })

  it('page = 1 → success (minimum boundary)', () => {
    const result = listPatientsQuerySchema.safeParse({ page: 1 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
    }
  })

  it('limit = 101 → fails (max 100)', () => {
    const result = listPatientsQuerySchema.safeParse({ limit: 101 })
    expect(result.success).toBe(false)
  })

  it('limit = 100 → success (maximum boundary)', () => {
    const result = listPatientsQuerySchema.safeParse({ limit: 100 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(100)
    }
  })

  it('limit = 1 → success (minimum boundary)', () => {
    const result = listPatientsQuerySchema.safeParse({ limit: 1 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(1)
    }
  })

  it('null values → treated as undefined, uses defaults', () => {
    const result = listPatientsQuerySchema.safeParse({
      page: null,
      limit: null,
      search: null,
      status: null,
      sortBy: null,
      sortOrder: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
      expect(result.data.search).toBeUndefined()
      expect(result.data.status).toBeUndefined()
      expect(result.data.sortBy).toBe('name')
      expect(result.data.sortOrder).toBe('asc')
    }
  })

  it('string page/limit coerced to numbers → success', () => {
    const result = listPatientsQuerySchema.safeParse({ page: '3', limit: '25' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(25)
    }
  })
})
