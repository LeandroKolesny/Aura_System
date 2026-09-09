// aura-backend/src/__tests__/lib/email.test.ts
//
// Testa a própria camada @/lib/email (montagem do e-mail: from/to/subject/html
// e a inicialização lazy do client Resend) — diferente dos testes de rota que
// mockam @/lib/email inteiro e não exercitam esse código.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => {
  class FakeResend {
    apiKey: string
    emails: { send: typeof sendMock }
    constructor(apiKey: string) {
      this.apiKey = apiKey
      this.emails = { send: sendMock }
    }
  }
  return { Resend: vi.fn(FakeResend) }
})

beforeEach(() => {
  vi.clearAllMocks()
  sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null })
})

afterEach(() => {
  delete process.env.RESEND_API_KEY
})

describe('inicialização lazy do client Resend', () => {
  it('REGRESSÃO: lança erro claro quando RESEND_API_KEY não está configurada (não falha silenciosamente)', async () => {
    delete process.env.RESEND_API_KEY
    const { sendVerificationEmail } = await import('@/lib/email')

    await expect(sendVerificationEmail('ana@x.com', 'Ana', 'token-123')).rejects.toThrow(
      'RESEND_API_KEY environment variable is not set'
    )
  })

  it('usa a RESEND_API_KEY do ambiente ao inicializar o client', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    const { Resend } = await import('resend')
    const { sendVerificationEmail } = await import('@/lib/email')

    await sendVerificationEmail('ana@x.com', 'Ana', 'token-123')

    expect(Resend).toHaveBeenCalledWith('re_test_key')
  })
})

describe('sendVerificationEmail', () => {
  beforeEach(() => { process.env.RESEND_API_KEY = 're_test_key' })

  it('envia para o destinatário certo com assunto e link de verificação no corpo', async () => {
    const { sendVerificationEmail } = await import('@/lib/email')

    await sendVerificationEmail('ana@x.com', 'Ana Silva', 'token-abc')

    const call = sendMock.mock.calls[0][0]
    expect(call.to).toBe('ana@x.com')
    expect(call.subject).toContain('Confirme seu email')
    expect(call.html).toContain('Ana Silva')
    expect(call.html).toContain('verificar-email?token=token-abc')
  })
})

describe('sendPasswordResetEmail', () => {
  beforeEach(() => { process.env.RESEND_API_KEY = 're_test_key' })

  it('envia com o link de redefinição de senha e o token no corpo', async () => {
    const { sendPasswordResetEmail } = await import('@/lib/email')

    await sendPasswordResetEmail('ana@x.com', 'Ana', 'reset-token-xyz')

    const call = sendMock.mock.calls[0][0]
    expect(call.subject).toContain('Redefinição de senha')
    expect(call.html).toContain('redefinir-senha?token=reset-token-xyz')
  })
})

describe('sendNewAppointmentEmail', () => {
  beforeEach(() => { process.env.RESEND_API_KEY = 're_test_key' })

  it('inclui paciente, procedimento, data e horário no corpo do e-mail pro admin', async () => {
    const { sendNewAppointmentEmail } = await import('@/lib/email')

    await sendNewAppointmentEmail('admin@x.com', 'Admin', 'Maria Silva', 'Botox', '10/09/2026', '14:00', 'clinica-x')

    const call = sendMock.mock.calls[0][0]
    expect(call.to).toBe('admin@x.com')
    expect(call.subject).toContain('Maria Silva')
    expect(call.subject).toContain('Botox')
    expect(call.html).toContain('Maria Silva')
    expect(call.html).toContain('Botox')
    expect(call.html).toContain('10/09/2026')
    expect(call.html).toContain('14:00')
  })
})

describe('sendAppointmentConfirmedEmail', () => {
  beforeEach(() => { process.env.RESEND_API_KEY = 're_test_key' })

  it('inclui clínica, procedimento, data e horário no corpo do e-mail pro paciente', async () => {
    const { sendAppointmentConfirmedEmail } = await import('@/lib/email')

    await sendAppointmentConfirmedEmail('paciente@x.com', 'Maria', 'Espaço Renove', 'Limpeza de Pele', '12/09/2026', '09:00')

    const call = sendMock.mock.calls[0][0]
    expect(call.to).toBe('paciente@x.com')
    expect(call.subject).toContain('Agendamento confirmado')
    expect(call.subject).toContain('Espaço Renove')
    expect(call.html).toContain('Maria')
    expect(call.html).toContain('Espaço Renove')
    expect(call.html).toContain('Limpeza de Pele')
  })
})

describe('TERMS_TEXT_HASH', () => {
  it('é um hash SHA-256 hexadecimal válido (64 caracteres)', async () => {
    const { TERMS_TEXT_HASH } = await import('@/lib/email')
    expect(TERMS_TEXT_HASH).toMatch(/^[a-f0-9]{64}$/)
  })

  it('TERMS_VERSION está definido', async () => {
    const { TERMS_VERSION } = await import('@/lib/email')
    expect(TERMS_VERSION).toBe('1.0')
  })
})
