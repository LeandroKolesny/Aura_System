// src/__tests__/lib/apiGuards.test.ts
// Testes para checkWriteAccess, checkModuleAccess, checkPatientLimit, checkProfessionalLimit

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    company: { findUnique: vi.fn() },
    patient: { count: vi.fn() },
    user: { count: vi.fn() },
  },
}))
vi.mock('../../lib/planPermissions', () => ({
  hasModuleAccess: vi.fn(),
  isReadOnlyMode: vi.fn(),
  canCreatePatient: vi.fn(),
  canCreateProfessional: vi.fn(),
  getPlanErrorMessage: vi.fn().mockResolvedValue('Upgrade necessário'),
}))

import {
  checkWriteAccess,
  checkModuleAccess,
  checkPatientLimit,
  checkProfessionalLimit,
} from '../../lib/apiGuards'
import prisma from '../../lib/prisma'
import {
  hasModuleAccess,
  isReadOnlyMode,
  canCreatePatient,
  canCreateProfessional,
} from '../../lib/planPermissions'

const ACTIVE_COMPANY = {
  plan: 'STARTER',
  subscriptionStatus: 'ACTIVE',
  subscriptionExpiresAt: new Date('2027-01-01'),
}

const USER = { id: 'u1', companyId: 'c1', role: 'ADMIN' }
const USER_NO_COMPANY = { id: 'u1', companyId: null, role: 'ADMIN' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.company.findUnique).mockResolvedValue(ACTIVE_COMPANY as never)
})

// ---------------------------------------------------------------------------
// checkWriteAccess
// ---------------------------------------------------------------------------
describe('checkWriteAccess', () => {
  it('retorna null quando empresa pode escrever', async () => {
    vi.mocked(isReadOnlyMode).mockReturnValue(false)
    const result = await checkWriteAccess(USER)
    expect(result).toBeNull()
  })

  it('retorna 403 quando empresa está em modo somente leitura', async () => {
    vi.mocked(isReadOnlyMode).mockReturnValue(true)
    const res = await checkWriteAccess(USER)
    expect(res).not.toBeNull()
    const body = await res!.json()
    expect(res!.status).toBe(403)
    expect(body.code).toBe('READ_ONLY_MODE')
  })

  it('retorna 403 quando usuário não tem companyId', async () => {
    const res = await checkWriteAccess(USER_NO_COMPANY)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it('retorna 404 quando empresa não existe no banco', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    const res = await checkWriteAccess(USER)
    expect(res!.status).toBe(404)
  })

  it('busca empresa pelo companyId do usuário', async () => {
    vi.mocked(isReadOnlyMode).mockReturnValue(false)
    await checkWriteAccess(USER)
    expect(prisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' } })
    )
  })
})

// ---------------------------------------------------------------------------
// checkModuleAccess
// ---------------------------------------------------------------------------
describe('checkModuleAccess', () => {
  it('retorna null quando módulo está disponível no plano', async () => {
    vi.mocked(hasModuleAccess).mockResolvedValue(true)
    const result = await checkModuleAccess(USER, 'financial' as never)
    expect(result).toBeNull()
  })

  it('retorna 403 com code MODULE_NOT_AVAILABLE quando módulo não disponível', async () => {
    vi.mocked(hasModuleAccess).mockResolvedValue(false)
    const res = await checkModuleAccess(USER, 'ai_features' as never)
    expect(res).not.toBeNull()
    const body = await res!.json()
    expect(res!.status).toBe(403)
    expect(body.code).toBe('MODULE_NOT_AVAILABLE')
  })

  it('retorna 403 quando usuário não tem companyId', async () => {
    const res = await checkModuleAccess(USER_NO_COMPANY, 'financial' as never)
    expect(res!.status).toBe(403)
  })

  it('retorna 404 quando empresa não existe', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    const res = await checkModuleAccess(USER, 'financial' as never)
    expect(res!.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// checkPatientLimit
// ---------------------------------------------------------------------------
describe('checkPatientLimit', () => {
  it('retorna null quando abaixo do limite de pacientes', async () => {
    vi.mocked(prisma.patient.count).mockResolvedValue(5)
    vi.mocked(canCreatePatient).mockResolvedValue(true)
    const result = await checkPatientLimit(USER)
    expect(result).toBeNull()
  })

  it('retorna 403 com code PATIENT_LIMIT_REACHED quando limite atingido', async () => {
    vi.mocked(prisma.patient.count).mockResolvedValue(50)
    vi.mocked(canCreatePatient).mockResolvedValue(false)
    const res = await checkPatientLimit(USER)
    expect(res).not.toBeNull()
    const body = await res!.json()
    expect(res!.status).toBe(403)
    expect(body.code).toBe('PATIENT_LIMIT_REACHED')
    expect(body.currentCount).toBe(50)
  })

  it('retorna 403 quando usuário não tem companyId', async () => {
    const res = await checkPatientLimit(USER_NO_COMPANY)
    expect(res!.status).toBe(403)
  })

  it('passa o total de pacientes para canCreatePatient', async () => {
    vi.mocked(prisma.patient.count).mockResolvedValue(3)
    vi.mocked(canCreatePatient).mockResolvedValue(true)
    await checkPatientLimit(USER)
    expect(canCreatePatient).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'STARTER' }),
      3
    )
  })
})

// ---------------------------------------------------------------------------
// checkProfessionalLimit
// ---------------------------------------------------------------------------
describe('checkProfessionalLimit', () => {
  it('retorna null quando abaixo do limite de profissionais', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(2)
    vi.mocked(canCreateProfessional).mockResolvedValue(true)
    const result = await checkProfessionalLimit(USER)
    expect(result).toBeNull()
  })

  it('retorna 403 com code PROFESSIONAL_LIMIT_REACHED quando limite atingido', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(10)
    vi.mocked(canCreateProfessional).mockResolvedValue(false)
    const res = await checkProfessionalLimit(USER)
    expect(res).not.toBeNull()
    const body = await res!.json()
    expect(res!.status).toBe(403)
    expect(body.code).toBe('PROFESSIONAL_LIMIT_REACHED')
  })

  it('retorna 403 quando usuário não tem companyId', async () => {
    const res = await checkProfessionalLimit(USER_NO_COMPANY)
    expect(res!.status).toBe(403)
  })

  it('busca apenas usuários com role ESTHETICIAN', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(1)
    vi.mocked(canCreateProfessional).mockResolvedValue(true)
    await checkProfessionalLimit(USER)
    expect(prisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'ESTHETICIAN' }),
      })
    )
  })
})
