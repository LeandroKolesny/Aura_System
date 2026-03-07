import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  canAccessCompany,
  canAccessPatientData,
  getPermissions,
  isAdminRole,
  canManageFinancials,
  canManageInventory,
} from '../../lib/rbac'
import type { AuthUser } from '../../lib/auth'

// ---------------------------------------------------------------------------
// Helper para criar usuário de teste
// ---------------------------------------------------------------------------
const makeUser = (role: string, overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  role,
  companyId: 'company-A',
  ...overrides,
})

// ---------------------------------------------------------------------------
// hasPermission
// ---------------------------------------------------------------------------
describe('hasPermission', () => {
  // --- OWNER ---
  describe('OWNER', () => {
    it('permite "create" em patients (manage implica tudo)', () => {
      expect(hasPermission(makeUser('OWNER'), 'patients', 'create')).toBe(true)
    })

    it('permite "delete" em patients (manage implica tudo)', () => {
      expect(hasPermission(makeUser('OWNER'), 'patients', 'delete')).toBe(true)
    })

    it('permite "manage" em patients', () => {
      expect(hasPermission(makeUser('OWNER'), 'patients', 'manage')).toBe(true)
    })

    it('permite "create" em appointments', () => {
      expect(hasPermission(makeUser('OWNER'), 'appointments', 'create')).toBe(true)
    })

    it('permite "delete" em appointments', () => {
      expect(hasPermission(makeUser('OWNER'), 'appointments', 'delete')).toBe(true)
    })

    it('permite "manage" em appointments', () => {
      expect(hasPermission(makeUser('OWNER'), 'appointments', 'manage')).toBe(true)
    })

    it('permite "manage" em settings', () => {
      expect(hasPermission(makeUser('OWNER'), 'settings', 'manage')).toBe(true)
    })

    it('permite "delete" em settings (manage implica delete)', () => {
      expect(hasPermission(makeUser('OWNER'), 'settings', 'delete')).toBe(true)
    })

    it('permite "read" em reports', () => {
      expect(hasPermission(makeUser('OWNER'), 'reports', 'read')).toBe(true)
    })

    it('permite "manage" em reports', () => {
      expect(hasPermission(makeUser('OWNER'), 'reports', 'manage')).toBe(true)
    })

    it('permite "create" em reports (manage implica create)', () => {
      // reports = ["read","manage"] — manage implica qualquer action
      expect(hasPermission(makeUser('OWNER'), 'reports', 'create')).toBe(true)
    })

    it('permite "delete" em reports (manage implica delete)', () => {
      expect(hasPermission(makeUser('OWNER'), 'reports', 'delete')).toBe(true)
    })

    it('permite "manage" em transactions', () => {
      expect(hasPermission(makeUser('OWNER'), 'transactions', 'manage')).toBe(true)
    })

    it('permite "manage" em inventory', () => {
      expect(hasPermission(makeUser('OWNER'), 'inventory', 'manage')).toBe(true)
    })
  })

  // --- ADMIN ---
  describe('ADMIN', () => {
    it('permite "delete" em patients', () => {
      expect(hasPermission(makeUser('ADMIN'), 'patients', 'delete')).toBe(true)
    })

    it('permite "create" em patients', () => {
      expect(hasPermission(makeUser('ADMIN'), 'patients', 'create')).toBe(true)
    })

    it('permite "read" em patients', () => {
      expect(hasPermission(makeUser('ADMIN'), 'patients', 'read')).toBe(true)
    })

    it('permite "update" em patients', () => {
      expect(hasPermission(makeUser('ADMIN'), 'patients', 'update')).toBe(true)
    })

    it('NAO permite "manage" em patients', () => {
      expect(hasPermission(makeUser('ADMIN'), 'patients', 'manage')).toBe(false)
    })

    it('NAO permite "delete" em settings (settings = read/update)', () => {
      expect(hasPermission(makeUser('ADMIN'), 'settings', 'delete')).toBe(false)
    })

    it('NAO permite "create" em settings', () => {
      expect(hasPermission(makeUser('ADMIN'), 'settings', 'create')).toBe(false)
    })

    it('permite "read" em settings', () => {
      expect(hasPermission(makeUser('ADMIN'), 'settings', 'read')).toBe(true)
    })

    it('permite "update" em settings', () => {
      expect(hasPermission(makeUser('ADMIN'), 'settings', 'update')).toBe(true)
    })

    it('permite "read" em reports', () => {
      expect(hasPermission(makeUser('ADMIN'), 'reports', 'read')).toBe(true)
    })

    it('NAO permite "create" em reports', () => {
      expect(hasPermission(makeUser('ADMIN'), 'reports', 'create')).toBe(false)
    })

    it('NAO permite "delete" em reports', () => {
      expect(hasPermission(makeUser('ADMIN'), 'reports', 'delete')).toBe(false)
    })

    it('permite "delete" em appointments', () => {
      expect(hasPermission(makeUser('ADMIN'), 'appointments', 'delete')).toBe(true)
    })

    it('permite "create" em transactions', () => {
      expect(hasPermission(makeUser('ADMIN'), 'transactions', 'create')).toBe(true)
    })

    it('permite "update" em inventory', () => {
      expect(hasPermission(makeUser('ADMIN'), 'inventory', 'update')).toBe(true)
    })
  })

  // --- RECEPTIONIST ---
  describe('RECEPTIONIST', () => {
    it('permite "create" em appointments', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'appointments', 'create')).toBe(true)
    })

    it('permite "read" em appointments', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'appointments', 'read')).toBe(true)
    })

    it('permite "update" em appointments', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'appointments', 'update')).toBe(true)
    })

    it('NAO permite "delete" em appointments', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'appointments', 'delete')).toBe(false)
    })

    it('permite "create" em patients', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'patients', 'create')).toBe(true)
    })

    it('NAO permite "delete" em patients', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'patients', 'delete')).toBe(false)
    })

    it('permite "create" em transactions', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'transactions', 'create')).toBe(true)
    })

    it('permite "read" em transactions', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'transactions', 'read')).toBe(true)
    })

    it('NAO permite "delete" em transactions', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'transactions', 'delete')).toBe(false)
    })

    it('permite "read" em procedures', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'procedures', 'read')).toBe(true)
    })

    it('NAO permite "create" em procedures', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'procedures', 'create')).toBe(false)
    })

    it('permite "read" em inventory', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'inventory', 'read')).toBe(true)
    })

    it('NAO permite "update" em inventory', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'inventory', 'update')).toBe(false)
    })

    it('permite "read" em professionals', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'professionals', 'read')).toBe(true)
    })

    it('permite "read" em settings', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'settings', 'read')).toBe(true)
    })

    it('NAO permite "read" em reports (array vazio)', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'reports', 'read')).toBe(false)
    })

    it('NAO permite "create" em reports', () => {
      expect(hasPermission(makeUser('RECEPTIONIST'), 'reports', 'create')).toBe(false)
    })
  })

  // --- ESTHETICIAN ---
  describe('ESTHETICIAN', () => {
    it('permite "read" em patients', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'patients', 'read')).toBe(true)
    })

    it('NAO permite "create" em patients', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'patients', 'create')).toBe(false)
    })

    it('NAO permite "delete" em patients', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'patients', 'delete')).toBe(false)
    })

    it('permite "read" em appointments', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'appointments', 'read')).toBe(true)
    })

    it('permite "update" em appointments', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'appointments', 'update')).toBe(true)
    })

    it('NAO permite "create" em appointments', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'appointments', 'create')).toBe(false)
    })

    it('NAO permite "delete" em appointments', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'appointments', 'delete')).toBe(false)
    })

    it('permite "read" em procedures', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'procedures', 'read')).toBe(true)
    })

    it('permite "read" em inventory', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'inventory', 'read')).toBe(true)
    })

    it('permite "read" em professionals', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'professionals', 'read')).toBe(true)
    })

    it('NAO permite "read" em transactions (array vazio)', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'transactions', 'read')).toBe(false)
    })

    it('NAO permite "create" em transactions', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'transactions', 'create')).toBe(false)
    })

    it('NAO permite "read" em settings (array vazio)', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'settings', 'read')).toBe(false)
    })

    it('NAO permite "read" em reports (array vazio)', () => {
      expect(hasPermission(makeUser('ESTHETICIAN'), 'reports', 'read')).toBe(false)
    })
  })

  // --- PATIENT ---
  describe('PATIENT', () => {
    it('permite "read" em patients', () => {
      expect(hasPermission(makeUser('PATIENT'), 'patients', 'read')).toBe(true)
    })

    it('NAO permite "create" em patients', () => {
      expect(hasPermission(makeUser('PATIENT'), 'patients', 'create')).toBe(false)
    })

    it('NAO permite "delete" em patients', () => {
      expect(hasPermission(makeUser('PATIENT'), 'patients', 'delete')).toBe(false)
    })

    it('permite "read" em appointments', () => {
      expect(hasPermission(makeUser('PATIENT'), 'appointments', 'read')).toBe(true)
    })

    it('permite "create" em appointments', () => {
      expect(hasPermission(makeUser('PATIENT'), 'appointments', 'create')).toBe(true)
    })

    it('NAO permite "delete" em appointments', () => {
      expect(hasPermission(makeUser('PATIENT'), 'appointments', 'delete')).toBe(false)
    })

    it('NAO permite "update" em appointments', () => {
      expect(hasPermission(makeUser('PATIENT'), 'appointments', 'update')).toBe(false)
    })

    it('permite "read" em procedures', () => {
      expect(hasPermission(makeUser('PATIENT'), 'procedures', 'read')).toBe(true)
    })

    it('permite "read" em transactions', () => {
      expect(hasPermission(makeUser('PATIENT'), 'transactions', 'read')).toBe(true)
    })

    it('NAO permite "create" em transactions', () => {
      expect(hasPermission(makeUser('PATIENT'), 'transactions', 'create')).toBe(false)
    })

    it('NAO permite "read" em inventory (array vazio)', () => {
      expect(hasPermission(makeUser('PATIENT'), 'inventory', 'read')).toBe(false)
    })

    it('NAO permite "create" em inventory', () => {
      expect(hasPermission(makeUser('PATIENT'), 'inventory', 'create')).toBe(false)
    })

    it('permite "read" em professionals', () => {
      expect(hasPermission(makeUser('PATIENT'), 'professionals', 'read')).toBe(true)
    })

    it('NAO permite "read" em settings (array vazio)', () => {
      expect(hasPermission(makeUser('PATIENT'), 'settings', 'read')).toBe(false)
    })

    it('NAO permite "read" em reports (array vazio)', () => {
      expect(hasPermission(makeUser('PATIENT'), 'reports', 'read')).toBe(false)
    })
  })

  // --- Role desconhecido ---
  describe('role desconhecido', () => {
    it('retorna false para "create" em patients (HACKER)', () => {
      expect(hasPermission(makeUser('HACKER'), 'patients', 'create')).toBe(false)
    })

    it('retorna false para "read" em appointments (HACKER)', () => {
      expect(hasPermission(makeUser('HACKER'), 'appointments', 'read')).toBe(false)
    })

    it('retorna false para "manage" em settings (HACKER)', () => {
      expect(hasPermission(makeUser('HACKER'), 'settings', 'manage')).toBe(false)
    })

    it('retorna false para string vazia como role', () => {
      expect(hasPermission(makeUser(''), 'patients', 'read')).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// canAccessCompany
// ---------------------------------------------------------------------------
describe('canAccessCompany', () => {
  it('OWNER acessa empresa diferente da sua → true (acesso universal)', () => {
    const owner = makeUser('OWNER', { companyId: 'company-A' })
    expect(canAccessCompany(owner, 'company-B')).toBe(true)
  })

  it('OWNER acessa mesma empresa → true', () => {
    const owner = makeUser('OWNER', { companyId: 'company-A' })
    expect(canAccessCompany(owner, 'company-A')).toBe(true)
  })

  it('OWNER com companyId null acessa qualquer empresa → true', () => {
    const owner = makeUser('OWNER', { companyId: null })
    expect(canAccessCompany(owner, 'company-X')).toBe(true)
  })

  it('ADMIN acessa mesma empresa → true', () => {
    const admin = makeUser('ADMIN', { companyId: 'company-A' })
    expect(canAccessCompany(admin, 'company-A')).toBe(true)
  })

  it('ADMIN acessa empresa diferente → false (isolamento de tenant)', () => {
    const admin = makeUser('ADMIN', { companyId: 'company-A' })
    expect(canAccessCompany(admin, 'company-B')).toBe(false)
  })

  it('RECEPTIONIST acessa mesma empresa → true', () => {
    const receptionist = makeUser('RECEPTIONIST', { companyId: 'company-A' })
    expect(canAccessCompany(receptionist, 'company-A')).toBe(true)
  })

  it('RECEPTIONIST acessa empresa diferente → false', () => {
    const receptionist = makeUser('RECEPTIONIST', { companyId: 'company-A' })
    expect(canAccessCompany(receptionist, 'company-B')).toBe(false)
  })

  it('ESTHETICIAN acessa empresa diferente → false', () => {
    const esthetician = makeUser('ESTHETICIAN', { companyId: 'company-A' })
    expect(canAccessCompany(esthetician, 'company-B')).toBe(false)
  })

  it('PATIENT acessa empresa diferente → false', () => {
    const patient = makeUser('PATIENT', { companyId: 'company-A' })
    expect(canAccessCompany(patient, 'company-B')).toBe(false)
  })

  it('PATIENT acessa mesma empresa → true', () => {
    const patient = makeUser('PATIENT', { companyId: 'company-A' })
    expect(canAccessCompany(patient, 'company-A')).toBe(true)
  })

  it('usuario com companyId null acessa empresa especifica → false', () => {
    const user = makeUser('ADMIN', { companyId: null })
    expect(canAccessCompany(user, 'company-A')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canAccessPatientData
// ---------------------------------------------------------------------------
describe('canAccessPatientData', () => {
  it('PATIENT acessando proprio email → true', () => {
    const patient = makeUser('PATIENT', { email: 'patient@clinic.com' })
    expect(canAccessPatientData(patient, 'patient@clinic.com')).toBe(true)
  })

  it('PATIENT acessando email diferente → false', () => {
    const patient = makeUser('PATIENT', { email: 'patient@clinic.com' })
    expect(canAccessPatientData(patient, 'other@clinic.com')).toBe(false)
  })

  it('PATIENT com email maiusculo vs minusculo → false (case-sensitive)', () => {
    const patient = makeUser('PATIENT', { email: 'patient@clinic.com' })
    expect(canAccessPatientData(patient, 'PATIENT@CLINIC.COM')).toBe(false)
  })

  it('ADMIN acessa qualquer email → true', () => {
    const admin = makeUser('ADMIN', { email: 'admin@clinic.com' })
    expect(canAccessPatientData(admin, 'anyone@clinic.com')).toBe(true)
  })

  it('RECEPTIONIST acessa qualquer email → true', () => {
    const receptionist = makeUser('RECEPTIONIST', { email: 'recepcao@clinic.com' })
    expect(canAccessPatientData(receptionist, 'patient@clinic.com')).toBe(true)
  })

  it('ESTHETICIAN acessa qualquer email → true', () => {
    const esthetician = makeUser('ESTHETICIAN', { email: 'prof@clinic.com' })
    expect(canAccessPatientData(esthetician, 'patient@clinic.com')).toBe(true)
  })

  it('OWNER acessa qualquer email → true', () => {
    const owner = makeUser('OWNER', { email: 'owner@saas.com' })
    expect(canAccessPatientData(owner, 'patient@clinic.com')).toBe(true)
  })

  it('OWNER acessa string vazia como email → true', () => {
    const owner = makeUser('OWNER')
    expect(canAccessPatientData(owner, '')).toBe(true)
  })

  it('PATIENT com email vazio acessando email vazio → true', () => {
    const patient = makeUser('PATIENT', { email: '' })
    expect(canAccessPatientData(patient, '')).toBe(true)
  })

  it('role desconhecido acessa qualquer email → true (comportamento por omissão — risco documentado)', () => {
    const unknown = makeUser('HACKER', { email: 'hacker@evil.com' })
    expect(canAccessPatientData(unknown, 'patient@clinic.com')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getPermissions
// ---------------------------------------------------------------------------
describe('getPermissions', () => {
  it('OWNER em patients → inclui "manage"', () => {
    const perms = getPermissions(makeUser('OWNER'), 'patients')
    expect(perms).toContain('manage')
  })

  it('OWNER em patients → inclui todas as actions', () => {
    const perms = getPermissions(makeUser('OWNER'), 'patients')
    expect(perms).toContain('create')
    expect(perms).toContain('read')
    expect(perms).toContain('update')
    expect(perms).toContain('delete')
    expect(perms).toContain('manage')
  })

  it('ADMIN em patients → inclui create, read, update, delete mas NAO manage', () => {
    const perms = getPermissions(makeUser('ADMIN'), 'patients')
    expect(perms).toContain('create')
    expect(perms).toContain('read')
    expect(perms).toContain('update')
    expect(perms).toContain('delete')
    expect(perms).not.toContain('manage')
  })

  it('RECEPTIONIST em reports → array vazio', () => {
    const perms = getPermissions(makeUser('RECEPTIONIST'), 'reports')
    expect(perms).toEqual([])
  })

  it('ESTHETICIAN em transactions → array vazio', () => {
    const perms = getPermissions(makeUser('ESTHETICIAN'), 'transactions')
    expect(perms).toEqual([])
  })

  it('ESTHETICIAN em settings → array vazio', () => {
    const perms = getPermissions(makeUser('ESTHETICIAN'), 'settings')
    expect(perms).toEqual([])
  })

  it('PATIENT em inventory → array vazio', () => {
    const perms = getPermissions(makeUser('PATIENT'), 'inventory')
    expect(perms).toEqual([])
  })

  it('PATIENT em settings → array vazio', () => {
    const perms = getPermissions(makeUser('PATIENT'), 'settings')
    expect(perms).toEqual([])
  })

  it('RECEPTIONIST em patients → inclui create, read, update mas NAO delete', () => {
    const perms = getPermissions(makeUser('RECEPTIONIST'), 'patients')
    expect(perms).toContain('create')
    expect(perms).toContain('read')
    expect(perms).toContain('update')
    expect(perms).not.toContain('delete')
  })

  it('role desconhecido → array vazio', () => {
    const perms = getPermissions(makeUser('HACKER'), 'patients')
    expect(perms).toEqual([])
  })

  it('role vazio → array vazio', () => {
    const perms = getPermissions(makeUser(''), 'appointments')
    expect(perms).toEqual([])
  })

  it('retorna cópia — modificar resultado não corrompe permissões globais', () => {
    const perms = getPermissions(makeUser('ADMIN'), 'patients')
    perms.push('manage' as any) // modificar o resultado
    // as permissões originais não devem ter sido afetadas
    expect(hasPermission(makeUser('ADMIN'), 'patients', 'manage')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isAdminRole
// ---------------------------------------------------------------------------
describe('isAdminRole', () => {
  it('OWNER → true', () => {
    expect(isAdminRole(makeUser('OWNER'))).toBe(true)
  })

  it('ADMIN → true', () => {
    expect(isAdminRole(makeUser('ADMIN'))).toBe(true)
  })

  it('RECEPTIONIST → false', () => {
    expect(isAdminRole(makeUser('RECEPTIONIST'))).toBe(false)
  })

  it('ESTHETICIAN → false', () => {
    expect(isAdminRole(makeUser('ESTHETICIAN'))).toBe(false)
  })

  it('PATIENT → false', () => {
    expect(isAdminRole(makeUser('PATIENT'))).toBe(false)
  })

  it('role desconhecido (HACKER) → false', () => {
    expect(isAdminRole(makeUser('HACKER'))).toBe(false)
  })

  it('role vazio → false', () => {
    expect(isAdminRole(makeUser(''))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canManageFinancials
// ---------------------------------------------------------------------------
describe('canManageFinancials', () => {
  it('OWNER (tem "manage" em transactions) → true', () => {
    expect(canManageFinancials(makeUser('OWNER'))).toBe(true)
  })

  it('ADMIN (tem "create" em transactions) → true', () => {
    expect(canManageFinancials(makeUser('ADMIN'))).toBe(true)
  })

  it('RECEPTIONIST (tem "create" em transactions) → true', () => {
    expect(canManageFinancials(makeUser('RECEPTIONIST'))).toBe(true)
  })

  it('ESTHETICIAN (transactions = []) → false', () => {
    expect(canManageFinancials(makeUser('ESTHETICIAN'))).toBe(false)
  })

  it('PATIENT (transactions = ["read"] apenas) → false', () => {
    expect(canManageFinancials(makeUser('PATIENT'))).toBe(false)
  })

  it('role desconhecido → false', () => {
    expect(canManageFinancials(makeUser('HACKER'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canManageInventory
// ---------------------------------------------------------------------------
describe('canManageInventory', () => {
  it('OWNER (tem "manage" em inventory) → true', () => {
    expect(canManageInventory(makeUser('OWNER'))).toBe(true)
  })

  it('ADMIN (tem "update" em inventory) → true', () => {
    expect(canManageInventory(makeUser('ADMIN'))).toBe(true)
  })

  it('RECEPTIONIST (inventory = ["read"] apenas) → false', () => {
    expect(canManageInventory(makeUser('RECEPTIONIST'))).toBe(false)
  })

  it('ESTHETICIAN (inventory = ["read"] apenas) → false', () => {
    expect(canManageInventory(makeUser('ESTHETICIAN'))).toBe(false)
  })

  it('PATIENT (inventory = []) → false', () => {
    expect(canManageInventory(makeUser('PATIENT'))).toBe(false)
  })

  it('role desconhecido → false', () => {
    expect(canManageInventory(makeUser('HACKER'))).toBe(false)
  })
})
