import { describe, it, expect } from 'vitest'
import type { SystemModule } from '../../lib/planPermissions'

describe('SystemModule type', () => {
  it('inclui whatsapp_notifications como módulo válido', () => {
    const mod: SystemModule = 'whatsapp_notifications'
    expect(mod).toBe('whatsapp_notifications')
  })
})
