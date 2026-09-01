# WhatsApp Confirmations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enviar automaticamente mensagem de confirmação de agendamento e lembrete 24h antes via WhatsApp, exclusivo para planos PREMIUM/ENTERPRISE, usando Evolution API com número dedicado por clínica.

**Architecture:** Cada clínica premium cria uma instância no Evolution API (self-hosted no Railway) com nome `aura-{companyId}`. O disparo de confirmação é fire-and-forget no endpoint de status do agendamento (quando muda para CONFIRMED). Um Vercel Cron Job roda diariamente às 8h para enviar lembretes. A clínica conecta seu número via QR code em `/settings`.

**Tech Stack:** Evolution API REST, Prisma (novo modelo WhatsappInstance), Next.js App Router, Vercel Cron Jobs, Vitest (testes unitários), Playwright (E2E)

---

## Pré-requisitos (feitos pelo dev antes de começar)

1. Subir Evolution API no Railway usando a imagem oficial `atendai/evolution-api:latest`
2. Configurar as env vars no backend Vercel:
   ```
   EVOLUTION_API_URL=https://seu-evolution.up.railway.app
   EVOLUTION_API_KEY=sua-chave-global-aqui
   CRON_SECRET=uma-string-aleatoria-segura
   ```
3. No `vercel.json` da raiz do backend, adicionar o cron (feito na Task 7)

---

## Task 1: Schema — modelo WhatsappInstance

**Files:**
- Modify: `aura-backend/prisma/schema.prisma`
- Run: `cd aura-backend && npm run db:generate && npm run db:push`

**Step 1: Adicionar enum e modelo ao schema**

No final de `schema.prisma`, adicionar:

```prisma
enum WhatsappInstanceStatus {
  DISCONNECTED
  CONNECTING
  CONNECTED
}

model WhatsappInstance {
  id               String                   @id @default(cuid())
  companyId        String                   @unique
  company          Company                  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  instanceName     String                   @unique // "aura-{companyId}"
  status           WhatsappInstanceStatus   @default(DISCONNECTED)
  phoneNumber      String?                  // preenchido após conectar
  termsAccepted    Boolean                  @default(false)
  termsAcceptedAt  DateTime?
  createdAt        DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt

  @@index([companyId])
}
```

No modelo `Company` (linha ~107), adicionar o campo de relação:
```prisma
  whatsappInstance WhatsappInstance?
```

**Step 2: Rodar migrations**

```bash
cd aura-backend
npm run db:generate
npm run db:push
```

Expected: "Your database is now in sync with your Prisma schema."

**Step 3: Commit**

```bash
git add aura-backend/prisma/schema.prisma
git commit -m "feat(schema): add WhatsappInstance model for per-clinic WA connections"
```

---

## Task 2: planPermissions — adicionar módulo `whatsapp_notifications`

**Files:**
- Modify: `aura-backend/src/lib/planPermissions.ts:11-20`
- Test: `aura-backend/src/__tests__/lib/planPermissions.test.ts` (criar)

**Step 1: Escrever teste que falha**

Criar `aura-backend/src/__tests__/lib/planPermissions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { SystemModule } from '../../lib/planPermissions'

describe('SystemModule type', () => {
  it('inclui whatsapp_notifications como módulo válido', () => {
    const mod: SystemModule = 'whatsapp_notifications'
    expect(mod).toBe('whatsapp_notifications')
  })
})
```

**Step 2: Rodar para ver falhar**

```bash
cd aura-backend && npx vitest run src/__tests__/lib/planPermissions.test.ts
```

Expected: FAIL — Type '"whatsapp_notifications"' is not assignable to type 'SystemModule'

**Step 3: Adicionar ao tipo SystemModule**

Em `aura-backend/src/lib/planPermissions.ts`, na union type `SystemModule`, adicionar:
```typescript
  | "whatsapp_notifications"
```

**Step 4: Rodar para ver passar**

```bash
cd aura-backend && npx vitest run src/__tests__/lib/planPermissions.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add aura-backend/src/lib/planPermissions.ts aura-backend/src/__tests__/lib/planPermissions.test.ts
git commit -m "feat(permissions): add whatsapp_notifications module to SystemModule"
```

> **Nota:** Para ativar o módulo para planos PREMIUM/ENTERPRISE, acesse o Prisma Studio (`npm run db:studio` na pasta backend) e adicione `"whatsapp_notifications"` ao array `modules` dos planos PREMIUM e ENTERPRISE na tabela `SaasPlan`.

---

## Task 3: lib/whatsapp.ts — cliente Evolution API

**Files:**
- Create: `aura-backend/src/lib/whatsapp.ts`
- Test: `aura-backend/src/__tests__/lib/whatsapp.test.ts`

**Step 1: Escrever testes que falham**

Criar `aura-backend/src/__tests__/lib/whatsapp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  getInstanceName,
  createInstance,
  getQRCode,
  getInstanceStatus,
  deleteInstance,
  sendTextMessage,
} from '../../lib/whatsapp'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.EVOLUTION_API_URL = 'https://evo.test'
  process.env.EVOLUTION_API_KEY = 'test-key'
})

describe('getInstanceName', () => {
  it('retorna aura-{companyId}', () => {
    expect(getInstanceName('abc123')).toBe('aura-abc123')
  })
})

describe('createInstance', () => {
  it('chama POST /instance/create com instanceName correto', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instance: { instanceName: 'aura-c1', status: 'created' } }),
    })
    const result = await createInstance('c1')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://evo.test/instance/create',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'test-key' }),
      })
    )
    expect(result.instanceName).toBe('aura-c1')
  })
})

describe('getQRCode', () => {
  it('chama GET /instance/connect/{name} e retorna base64', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base64: 'data:image/png;base64,abc' }),
    })
    const qr = await getQRCode('c1')
    expect(qr).toBe('data:image/png;base64,abc')
  })

  it('retorna null se API falhar', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    const qr = await getQRCode('c1')
    expect(qr).toBeNull()
  })
})

describe('getInstanceStatus', () => {
  it('retorna CONNECTED quando state é open', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instance: { state: 'open' } }),
    })
    const status = await getInstanceStatus('c1')
    expect(status).toBe('CONNECTED')
  })

  it('retorna DISCONNECTED quando state é close', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instance: { state: 'close' } }),
    })
    const status = await getInstanceStatus('c1')
    expect(status).toBe('DISCONNECTED')
  })

  it('retorna DISCONNECTED se fetch falhar', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'))
    const status = await getInstanceStatus('c1')
    expect(status).toBe('DISCONNECTED')
  })
})

describe('sendTextMessage', () => {
  it('chama POST /message/sendText com número e mensagem', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ key: { id: 'msg1' } }),
    })
    await sendTextMessage('c1', '11999990000', 'Olá!')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://evo.test/message/sendText/aura-c1',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('não lança erro se API falhar (fire-and-forget seguro)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    await expect(sendTextMessage('c1', '11999990000', 'Olá!')).resolves.not.toThrow()
  })
})
```

**Step 2: Rodar para ver falhar**

```bash
cd aura-backend && npx vitest run src/__tests__/lib/whatsapp.test.ts
```

Expected: FAIL — Cannot find module '../../lib/whatsapp'

**Step 3: Implementar `aura-backend/src/lib/whatsapp.ts`**

```typescript
// aura-backend/src/lib/whatsapp.ts
// Cliente para Evolution API — gerencia instâncias e envio de mensagens WhatsApp

type InstanceStatus = "CONNECTED" | "DISCONNECTED" | "CONNECTING"

function getBaseUrl(): string {
  return (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "")
}

function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: process.env.EVOLUTION_API_KEY || "",
  }
}

/** Nome da instância no Evolution API para uma empresa */
export function getInstanceName(companyId: string): string {
  return `aura-${companyId}`
}

/** Cria (ou recria) uma instância no Evolution API */
export async function createInstance(companyId: string): Promise<{ instanceName: string }> {
  const instanceName = getInstanceName(companyId)
  const res = await fetch(`${getBaseUrl()}/instance/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  })
  const data = await res.json()
  return { instanceName: data.instance?.instanceName ?? instanceName }
}

/** Obtém o QR code em base64 para escanear */
export async function getQRCode(companyId: string): Promise<string | null> {
  try {
    const instanceName = getInstanceName(companyId)
    const res = await fetch(`${getBaseUrl()}/instance/connect/${instanceName}`, {
      headers: getHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.base64 ?? null
  } catch {
    return null
  }
}

/** Consulta o status atual da conexão */
export async function getInstanceStatus(companyId: string): Promise<InstanceStatus> {
  try {
    const instanceName = getInstanceName(companyId)
    const res = await fetch(`${getBaseUrl()}/instance/connectionState/${instanceName}`, {
      headers: getHeaders(),
    })
    if (!res.ok) return "DISCONNECTED"
    const data = await res.json()
    const state: string = data.instance?.state ?? "close"
    if (state === "open") return "CONNECTED"
    if (state === "connecting") return "CONNECTING"
    return "DISCONNECTED"
  } catch {
    return "DISCONNECTED"
  }
}

/** Deleta a instância no Evolution API */
export async function deleteInstance(companyId: string): Promise<void> {
  const instanceName = getInstanceName(companyId)
  await fetch(`${getBaseUrl()}/instance/delete/${instanceName}`, {
    method: "DELETE",
    headers: getHeaders(),
  }).catch(console.error)
}

/** Envia mensagem de texto — fire-and-forget, nunca lança erro */
export async function sendTextMessage(
  companyId: string,
  phone: string,
  text: string
): Promise<void> {
  try {
    const instanceName = getInstanceName(companyId)
    // Normaliza número: remove não-dígitos, garante código país 55
    const normalized = phone.replace(/\D/g, "")
    const number = normalized.startsWith("55") ? normalized : `55${normalized}`

    const res = await fetch(`${getBaseUrl()}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        number,
        text,
        delay: 1500, // delay humanizado de 1.5s
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn("[WhatsApp] Falha ao enviar mensagem:", err)
    }
  } catch (err) {
    console.warn("[WhatsApp] Erro de rede ao enviar mensagem:", err)
  }
}
```

**Step 4: Rodar testes para ver passar**

```bash
cd aura-backend && npx vitest run src/__tests__/lib/whatsapp.test.ts
```

Expected: PASS (7 testes)

**Step 5: Commit**

```bash
git add aura-backend/src/lib/whatsapp.ts aura-backend/src/__tests__/lib/whatsapp.test.ts
git commit -m "feat(whatsapp): add Evolution API client lib with full test coverage"
```

---

## Task 4: lib/whatsappMessages.ts — templates de mensagem fixos

**Files:**
- Create: `aura-backend/src/lib/whatsappMessages.ts`
- Test: `aura-backend/src/__tests__/lib/whatsappMessages.test.ts`

**Step 1: Escrever testes**

Criar `aura-backend/src/__tests__/lib/whatsappMessages.test.ts`:

```typescript
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
```

**Step 2: Rodar para ver falhar**

```bash
cd aura-backend && npx vitest run src/__tests__/lib/whatsappMessages.test.ts
```

**Step 3: Implementar `aura-backend/src/lib/whatsappMessages.ts`**

```typescript
// Templates de mensagem fixos — NÃO editáveis pela clínica
// A mensagem de apresentação e pedido para salvar o número são obrigatórios
// para reduzir risco de ban do WhatsApp.

interface MessageParams {
  patientName: string
  clinicName: string
  date: string        // "25/03/2026"
  time: string        // "14:00"
  procedure: string
  professional: string
}

export function buildConfirmationMessage(p: MessageParams): string {
  return `Olá ${p.patientName}! 👋

Aqui é o sistema de confirmações da *${p.clinicName}*.

✅ Seu agendamento foi *confirmado*:
📅 *${p.date}* às *${p.time}*
💆 Procedimento: *${p.procedure}*
👩‍⚕️ Profissional: *${p.professional}*

Por favor, *salve este número* nos seus contatos para receber seus próximos lembretes! 😊`
}

export function buildReminderMessage(p: MessageParams): string {
  return `Olá ${p.patientName}! 🌟

Lembrete da *${p.clinicName}*:

Você tem um agendamento *amanhã*:
📅 *${p.date}* às *${p.time}*
💆 *${p.procedure}*

Te esperamos! 😊`
}

/** Formata Date para "DD/MM/AAAA" */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
}

/** Formata Date para "HH:MM" */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
}
```

**Step 4: Rodar para ver passar**

```bash
cd aura-backend && npx vitest run src/__tests__/lib/whatsappMessages.test.ts
```

Expected: PASS (8 testes)

**Step 5: Commit**

```bash
git add aura-backend/src/lib/whatsappMessages.ts aura-backend/src/__tests__/lib/whatsappMessages.test.ts
git commit -m "feat(whatsapp): add fixed message templates with full test coverage"
```

---

## Task 5: API /api/whatsapp/instance — gerenciar conexão

**Files:**
- Create: `aura-backend/src/app/api/whatsapp/instance/route.ts`
- Test: `aura-backend/src/__tests__/api/whatsapp-instance.test.ts`

**Step 1: Escrever testes**

Criar `aura-backend/src/__tests__/api/whatsapp-instance.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { WhatsappInstance } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    whatsappInstance: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    company: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/planPermissions', () => ({ hasModuleAccess: vi.fn() }))
vi.mock('@/lib/whatsapp', () => ({
  createInstance: vi.fn().mockResolvedValue({ instanceName: 'aura-c1' }),
  getQRCode: vi.fn().mockResolvedValue('data:image/png;base64,qr'),
  getInstanceStatus: vi.fn().mockResolvedValue('DISCONNECTED'),
  deleteInstance: vi.fn().mockResolvedValue(undefined),
  getInstanceName: vi.fn().mockReturnValue('aura-c1'),
}))

import { GET, POST, DELETE } from '../../app/api/whatsapp/instance/route'
import { getAuthUser } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/planPermissions'
import prisma from '@/lib/prisma'

const MOCK_USER = { id: 'u1', companyId: 'c1', role: 'ADMIN', email: 'a@b.com', name: 'A' }
const MOCK_COMPANY = { plan: 'PREMIUM', subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: null }

function makeReq(method = 'GET') {
  return new NextRequest('http://localhost/api/whatsapp/instance', { method })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
  vi.mocked(prisma.company.findUnique).mockResolvedValue(MOCK_COMPANY as never)
  vi.mocked(hasModuleAccess).mockResolvedValue(true)
})

describe('GET /api/whatsapp/instance', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('retorna 403 se plano não tem módulo whatsapp_notifications', async () => {
    vi.mocked(hasModuleAccess).mockResolvedValue(false)
    const res = await GET(makeReq())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('MODULE_NOT_AVAILABLE')
  })

  it('retorna status DISCONNECTED quando não há instância', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue(null)
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('DISCONNECTED')
    expect(body.termsAccepted).toBe(false)
  })

  it('retorna dados da instância existente', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({
      status: 'CONNECTED',
      phoneNumber: '5511999990000',
      termsAccepted: true,
    } as unknown as WhatsappInstance)
    const res = await GET(makeReq())
    const body = await res.json()
    expect(body.status).toBe('CONNECTED')
    expect(body.termsAccepted).toBe(true)
  })
})

describe('POST /api/whatsapp/instance', () => {
  it('retorna 403 se termos não foram aceitos no body', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: false }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('cria instância e retorna QR code quando termos aceitos', async () => {
    vi.mocked(prisma.whatsappInstance.upsert).mockResolvedValue({} as WhatsappInstance)
    const req = new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: true }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.qrCode).toBe('data:image/png;base64,qr')
  })
})

describe('DELETE /api/whatsapp/instance', () => {
  it('desconecta e deleta instância', async () => {
    vi.mocked(prisma.whatsappInstance.delete).mockResolvedValue({} as WhatsappInstance)
    const res = await DELETE(makeReq('DELETE'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
```

**Step 2: Rodar para ver falhar**

```bash
cd aura-backend && npx vitest run src/__tests__/api/whatsapp-instance.test.ts
```

**Step 3: Implementar a rota**

Criar `aura-backend/src/app/api/whatsapp/instance/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { hasModuleAccess } from "@/lib/planPermissions"
import {
  createInstance,
  getQRCode,
  getInstanceStatus,
  deleteInstance,
} from "@/lib/whatsapp"

async function getCompanyAndCheckModule(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, subscriptionStatus: true, subscriptionExpiresAt: true },
  })
  if (!company) return { company: null, allowed: false }
  const allowed = await hasModuleAccess(company as never, "whatsapp_notifications")
  return { company, allowed }
}

// GET — status atual da instância + QR code se conectando
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: "Sem empresa" }, { status: 403 })

  const { allowed } = await getCompanyAndCheckModule(user.companyId)
  if (!allowed) {
    return NextResponse.json(
      { error: "Módulo não disponível no seu plano", code: "MODULE_NOT_AVAILABLE" },
      { status: 403 }
    )
  }

  const instance = await prisma.whatsappInstance.findUnique({
    where: { companyId: user.companyId },
  })

  if (!instance) {
    return NextResponse.json({ status: "DISCONNECTED", termsAccepted: false })
  }

  // Sincroniza status real com Evolution API
  const liveStatus = await getInstanceStatus(user.companyId)
  if (liveStatus !== instance.status) {
    await prisma.whatsappInstance.update({
      where: { companyId: user.companyId },
      data: { status: liveStatus },
    })
  }

  let qrCode: string | null = null
  if (liveStatus === "CONNECTING" || liveStatus === "DISCONNECTED") {
    qrCode = await getQRCode(user.companyId)
  }

  return NextResponse.json({
    status: liveStatus,
    phoneNumber: instance.phoneNumber,
    termsAccepted: instance.termsAccepted,
    qrCode,
  })
}

// POST — conectar (cria instância + gera QR code)
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: "Sem empresa" }, { status: 403 })

  const { allowed } = await getCompanyAndCheckModule(user.companyId)
  if (!allowed) {
    return NextResponse.json(
      { error: "Módulo não disponível no seu plano", code: "MODULE_NOT_AVAILABLE" },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  if (!body.acceptTerms) {
    return NextResponse.json(
      { error: "Você deve aceitar os termos antes de conectar" },
      { status: 403 }
    )
  }

  // Cria instância no Evolution API
  const { instanceName } = await createInstance(user.companyId)

  // Salva/atualiza no banco
  await prisma.whatsappInstance.upsert({
    where: { companyId: user.companyId },
    create: {
      companyId: user.companyId,
      instanceName,
      status: "CONNECTING",
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    },
    update: {
      status: "CONNECTING",
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    },
  })

  const qrCode = await getQRCode(user.companyId)
  return NextResponse.json({ qrCode, status: "CONNECTING" })
}

// DELETE — desconectar
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: "Sem empresa" }, { status: 403 })

  await deleteInstance(user.companyId).catch(console.error)
  await prisma.whatsappInstance.delete({
    where: { companyId: user.companyId },
  }).catch(() => null) // ignora se não existir

  return NextResponse.json({ success: true })
}
```

**Step 4: Rodar testes para ver passar**

```bash
cd aura-backend && npx vitest run src/__tests__/api/whatsapp-instance.test.ts
```

Expected: PASS (8 testes)

**Step 5: Commit**

```bash
git add aura-backend/src/app/api/whatsapp/instance/route.ts aura-backend/src/__tests__/api/whatsapp-instance.test.ts
git commit -m "feat(whatsapp): add instance management API (connect/disconnect/status)"
```

---

## Task 6: Hook de confirmação no status do agendamento

**Files:**
- Modify: `aura-backend/src/app/api/appointments/[id]/status/route.ts:152-184`
- Test: `aura-backend/src/__tests__/api/appointment-whatsapp.test.ts`

**Step 1: Escrever teste**

Criar `aura-backend/src/__tests__/api/appointment-whatsapp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Appointment, Patient, Procedure, Company, WhatsappInstance } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findFirst: vi.fn(), update: vi.fn() },
    patient: { update: vi.fn() },
    procedure: { findUnique: vi.fn() },
    transaction: { create: vi.fn() },
    activity: { create: vi.fn() },
    inventoryItem: { update: vi.fn() },
    procedureSupply: { findMany: vi.fn().mockResolvedValue([]) },
    appNotification: { create: vi.fn() },
    stockMovement: { create: vi.fn() },
    company: { findUnique: vi.fn() },
    whatsappInstance: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/calendarSync', () => ({
  deleteCalendarEvent: vi.fn(),
  pushAppointmentToCalendar: vi.fn(),
}))
vi.mock('@/lib/whatsapp', () => ({ sendTextMessage: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/whatsappMessages', () => ({
  buildConfirmationMessage: vi.fn().mockReturnValue('msg-confirmacao'),
  formatDate: vi.fn().mockReturnValue('25/03/2026'),
  formatTime: vi.fn().mockReturnValue('14:00'),
}))

import { PATCH } from '../../app/api/appointments/[id]/status/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendTextMessage } from '@/lib/whatsapp'

const MOCK_USER = { id: 'u1', companyId: 'c1', role: 'ADMIN' }
const MOCK_APPOINTMENT = {
  id: 'a1', companyId: 'c1', patientId: 'p1', procedureId: 'proc1',
  status: 'SCHEDULED', stockDeducted: false,
  patient: { id: 'p1', name: 'Ana Silva', phone: '11999990000' },
  professional: { id: 'pr1', name: 'Dra. Maria' },
  procedure: { id: 'proc1', name: 'Limpeza de Pele', cost: 0 },
  date: new Date('2026-03-26T14:00:00'),
}
const MOCK_WA_INSTANCE = {
  status: 'CONNECTED', termsAccepted: true,
}

function makePATCH(body: object) {
  return new NextRequest('http://localhost/api/appointments/a1/status', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
  vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as unknown as Appointment)
  vi.mocked(prisma.appointment.update).mockResolvedValue(MOCK_APPOINTMENT as unknown as Appointment)
  vi.mocked(prisma.activity.create).mockResolvedValue({} as never)
  vi.mocked(prisma.company.findUnique).mockResolvedValue({ name: 'Clínica Beleza' } as unknown as Company)
  vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue(MOCK_WA_INSTANCE as unknown as WhatsappInstance)
})

describe('WhatsApp hook no PATCH status → CONFIRMED', () => {
  it('dispara sendTextMessage quando status muda para CONFIRMED e WA está conectado', async () => {
    const res = await PATCH(
      makePATCH({ status: 'CONFIRMED' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    expect(res.status).toBe(200)
    expect(sendTextMessage).toHaveBeenCalledOnce()
    expect(sendTextMessage).toHaveBeenCalledWith('c1', '11999990000', 'msg-confirmacao')
  })

  it('NÃO dispara WhatsApp quando status muda para COMPLETED', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT, status: 'CONFIRMED',
    } as unknown as Appointment)
    await PATCH(
      makePATCH({ status: 'COMPLETED' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('NÃO dispara WhatsApp se instância não está conectada', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({
      status: 'DISCONNECTED', termsAccepted: true,
    } as unknown as WhatsappInstance)
    await PATCH(
      makePATCH({ status: 'CONFIRMED' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('NÃO dispara WhatsApp se paciente não tem telefone', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT,
      patient: { id: 'p1', name: 'Ana', phone: null },
    } as unknown as Appointment)
    await PATCH(
      makePATCH({ status: 'CONFIRMED' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('continua e retorna 200 mesmo se WhatsApp falhar (fire-and-forget)', async () => {
    vi.mocked(sendTextMessage).mockRejectedValueOnce(new Error('rede'))
    const res = await PATCH(
      makePATCH({ status: 'CONFIRMED' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    expect(res.status).toBe(200)
  })
})
```

**Step 2: Rodar para ver falhar**

```bash
cd aura-backend && npx vitest run src/__tests__/api/appointment-whatsapp.test.ts
```

**Step 3: Adicionar hook no route.ts de status**

Em `aura-backend/src/app/api/appointments/[id]/status/route.ts`, adicionar imports no topo:

```typescript
import { sendTextMessage } from "@/lib/whatsapp"
import { buildConfirmationMessage, formatDate, formatTime } from "@/lib/whatsappMessages"
```

Após a linha `// Sync status change to Google Calendar (fire-and-forget)` (linha ~179), adicionar:

```typescript
    // Disparar WhatsApp de confirmação (fire-and-forget)
    if (status === "CONFIRMED") {
      ;(async () => {
        try {
          const waInstance = await prisma.whatsappInstance.findUnique({
            where: { companyId: user.companyId! },
          })
          if (waInstance?.status !== "CONNECTED") return
          if (!appointment.patient.phone) return

          const company = await prisma.company.findUnique({
            where: { id: user.companyId! },
            select: { name: true },
          })

          const msg = buildConfirmationMessage({
            patientName: appointment.patient.name,
            clinicName: company?.name ?? "a clínica",
            date: formatDate(appointment.date),
            time: formatTime(appointment.date),
            procedure: appointment.procedure.name,
            professional: appointment.professional?.name ?? "",
          })

          await sendTextMessage(user.companyId!, appointment.patient.phone, msg)
        } catch (err) {
          console.error("[WhatsApp] Falha ao enviar confirmação:", err)
        }
      })()
    }
```

**Step 4: Rodar testes para ver passar**

```bash
cd aura-backend && npx vitest run src/__tests__/api/appointment-whatsapp.test.ts
```

Expected: PASS (5 testes)

**Step 5: Commit**

```bash
git add aura-backend/src/app/api/appointments/[id]/status/route.ts aura-backend/src/__tests__/api/appointment-whatsapp.test.ts
git commit -m "feat(whatsapp): fire confirmation message on appointment CONFIRMED"
```

---

## Task 7: Vercel Cron — lembrete 24h antes

**Files:**
- Create: `aura-backend/src/app/api/cron/whatsapp-reminders/route.ts`
- Modify: `aura-backend/vercel.json` (adicionar cron)
- Test: `aura-backend/src/__tests__/api/whatsapp-reminders.test.ts`

**Step 1: Escrever testes**

Criar `aura-backend/src/__tests__/api/whatsapp-reminders.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Appointment } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findMany: vi.fn() },
    whatsappInstance: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/whatsapp', () => ({ sendTextMessage: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/whatsappMessages', () => ({
  buildReminderMessage: vi.fn().mockReturnValue('msg-lembrete'),
  formatDate: vi.fn().mockReturnValue('26/03/2026'),
  formatTime: vi.fn().mockReturnValue('14:00'),
}))

import { GET } from '../../app/api/cron/whatsapp-reminders/route'
import prisma from '@/lib/prisma'
import { sendTextMessage } from '@/lib/whatsapp'

const VALID_TOKEN = 'cron-secret-123'

function makeReq(token?: string) {
  const headers: Record<string, string> = {}
  if (token) headers['authorization'] = `Bearer ${token}`
  return new NextRequest('http://localhost/api/cron/whatsapp-reminders', { headers })
}

const MOCK_APPOINTMENT = {
  id: 'a1', companyId: 'c1', date: new Date(),
  patient: { name: 'Ana', phone: '11999990000' },
  professional: { name: 'Dra. Maria' },
  procedure: { name: 'Limpeza' },
  company: { name: 'Clínica Beleza' },
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = VALID_TOKEN
})

describe('GET /api/cron/whatsapp-reminders', () => {
  it('retorna 401 sem token', async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('retorna 401 com token errado', async () => {
    const res = await GET(makeReq('wrong'))
    expect(res.status).toBe(401)
  })

  it('retorna 200 com token correto', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    const res = await GET(makeReq(VALID_TOKEN))
    expect(res.status).toBe(200)
  })

  it('envia lembrete para agendamentos de amanhã com WA conectado', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue(
      [MOCK_APPOINTMENT] as unknown as Appointment[]
    )
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({
      status: 'CONNECTED',
    } as never)

    const res = await GET(makeReq(VALID_TOKEN))
    const body = await res.json()
    expect(sendTextMessage).toHaveBeenCalledOnce()
    expect(body.sent).toBe(1)
  })

  it('NÃO envia se WA desconectado', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue(
      [MOCK_APPOINTMENT] as unknown as Appointment[]
    )
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({
      status: 'DISCONNECTED',
    } as never)

    await GET(makeReq(VALID_TOKEN))
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('NÃO envia se paciente sem telefone', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      ...MOCK_APPOINTMENT,
      patient: { name: 'Ana', phone: null },
    }] as unknown as Appointment[])
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({
      status: 'CONNECTED',
    } as never)

    await GET(makeReq(VALID_TOKEN))
    expect(sendTextMessage).not.toHaveBeenCalled()
  })
})
```

**Step 2: Rodar para ver falhar**

```bash
cd aura-backend && npx vitest run src/__tests__/api/whatsapp-reminders.test.ts
```

**Step 3: Implementar o cron route**

Criar `aura-backend/src/app/api/cron/whatsapp-reminders/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendTextMessage } from "@/lib/whatsapp"
import { buildReminderMessage, formatDate, formatTime } from "@/lib/whatsappMessages"

// Roda todo dia às 8h (configurado no vercel.json)
// Envia lembrete para agendamentos CONFIRMED de amanhã
export async function GET(request: NextRequest) {
  // Autenticação via CRON_SECRET
  const auth = request.headers.get("authorization")
  const token = auth?.replace("Bearer ", "")
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const startOfTomorrow = new Date(tomorrow)
  startOfTomorrow.setHours(0, 0, 0, 0)
  const endOfTomorrow = new Date(tomorrow)
  endOfTomorrow.setHours(23, 59, 59, 999)

  const appointments = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      date: { gte: startOfTomorrow, lte: endOfTomorrow },
    },
    include: {
      patient: { select: { name: true, phone: true } },
      professional: { select: { name: true } },
      procedure: { select: { name: true } },
      company: { select: { name: true } },
    },
  })

  let sent = 0
  let skipped = 0

  for (const appt of appointments) {
    if (!appt.patient.phone) { skipped++; continue }

    const waInstance = await prisma.whatsappInstance.findUnique({
      where: { companyId: appt.companyId },
    })
    if (waInstance?.status !== "CONNECTED") { skipped++; continue }

    const msg = buildReminderMessage({
      patientName: appt.patient.name,
      clinicName: appt.company.name,
      date: formatDate(appt.date),
      time: formatTime(appt.date),
      procedure: appt.procedure.name,
      professional: appt.professional?.name ?? "",
    })

    await sendTextMessage(appt.companyId, appt.patient.phone, msg)
    sent++

    // Delay entre mensagens para não parecer spam
    await new Promise((r) => setTimeout(r, 2000))
  }

  console.log(`[Cron WhatsApp] Lembretes: ${sent} enviados, ${skipped} ignorados`)
  return NextResponse.json({ sent, skipped })
}
```

**Step 4: Adicionar cron no vercel.json do backend**

Verificar se `aura-backend/vercel.json` existe. Se sim, adicionar:
```json
{
  "crons": [
    {
      "path": "/api/cron/whatsapp-reminders",
      "schedule": "0 11 * * *"
    }
  ]
}
```
> `0 11 * * *` = todo dia às 11h UTC = 8h no horário de Brasília (UTC-3)

**Step 5: Rodar testes para ver passar**

```bash
cd aura-backend && npx vitest run src/__tests__/api/whatsapp-reminders.test.ts
```

Expected: PASS (6 testes)

**Step 6: Commit**

```bash
git add aura-backend/src/app/api/cron/whatsapp-reminders/route.ts aura-backend/src/__tests__/api/whatsapp-reminders.test.ts aura-backend/vercel.json
git commit -m "feat(whatsapp): add daily cron job for 24h appointment reminders"
```

---

## Task 8: Frontend — accordion WhatsApp em /settings

**Files:**
- Create: `components/WhatsAppSettings.tsx`
- Modify: `pages/Settings.tsx` (adicionar accordion)
- Modify: `services/api.ts` (adicionar whatsappApi)
- Test: `e2e/whatsapp-settings.spec.ts`

**Step 1: Adicionar whatsappApi em services/api.ts**

No final de `services/api.ts`, adicionar:

```typescript
export const whatsappApi = {
  getStatus: () => apiFetch<{
    status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'
    phoneNumber?: string
    termsAccepted: boolean
    qrCode?: string
  }>('/api/whatsapp/instance'),

  connect: (acceptTerms: boolean) =>
    apiFetch<{ qrCode: string; status: string }>('/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms }),
    }),

  disconnect: () =>
    apiFetch<{ success: boolean }>('/api/whatsapp/instance', { method: 'DELETE' }),
}
```

**Step 2: Criar `components/WhatsAppSettings.tsx`**

```typescript
import React, { useState, useEffect, useCallback } from 'react'
import { MessageCircle, CheckCircle, XCircle, Loader2, RefreshCw, LogOut, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { whatsappApi } from '../services/api'
import { useApp } from '../context/AppContext'
import { UserRole } from '../types'

type WaStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'

const WhatsAppSettings: React.FC = () => {
  const { user, currentCompany } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<WaStatus>('DISCONNECTED')
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  // Só ADMIN e OWNER podem gerenciar
  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.OWNER

  const loadStatus = useCallback(async () => {
    const res = await whatsappApi.getStatus()
    if (res.success && res.data) {
      setStatus(res.data.status)
      setPhoneNumber(res.data.phoneNumber ?? null)
      setTermsAccepted(res.data.termsAccepted)
      if (res.data.qrCode) setQrCode(res.data.qrCode)
      if (res.data.status === 'CONNECTED') setQrCode(null)
    }
  }, [])

  useEffect(() => {
    if (isOpen) loadStatus()
  }, [isOpen, loadStatus])

  // Polling enquanto está conectando (aguardando scan do QR)
  useEffect(() => {
    if (status !== 'CONNECTING') return
    setPolling(true)
    const interval = setInterval(loadStatus, 5000)
    return () => { clearInterval(interval); setPolling(false) }
  }, [status, loadStatus])

  const handleConnect = async () => {
    if (!termsChecked) return
    setLoading(true)
    const res = await whatsappApi.connect(true)
    if (res.success && res.data) {
      setStatus('CONNECTING')
      setQrCode(res.data.qrCode)
    }
    setLoading(false)
  }

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o WhatsApp? As confirmações automáticas serão pausadas.')) return
    setLoading(true)
    await whatsappApi.disconnect()
    setStatus('DISCONNECTED')
    setQrCode(null)
    setPhoneNumber(null)
    setTermsAccepted(false)
    setTermsChecked(false)
    setLoading(false)
  }

  const statusBadge = {
    CONNECTED:    <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle className="w-4 h-4" /> Conectado</span>,
    CONNECTING:   <span className="flex items-center gap-1.5 text-yellow-600 text-sm font-medium"><Loader2 className="w-4 h-4 animate-spin" /> Aguardando scan...</span>,
    DISCONNECTED: <span className="flex items-center gap-1.5 text-gray-400 text-sm font-medium"><XCircle className="w-4 h-4" /> Desconectado</span>,
  }

  return (
    <div className="border border-secondary-200 rounded-xl overflow-hidden">
      {/* Header accordion */}
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-secondary-900">WhatsApp — Confirmações</p>
            <p className="text-xs text-secondary-500">Envio automático de confirmações e lembretes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge[status]}
          {isOpen ? <ChevronUp className="w-4 h-4 text-secondary-400" /> : <ChevronDown className="w-4 h-4 text-secondary-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-secondary-100 space-y-5">
          {/* Conectado */}
          {status === 'CONNECTED' && (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 rounded-xl flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">WhatsApp conectado!</p>
                  {phoneNumber && <p className="text-xs text-green-600">{phoneNumber}</p>}
                </div>
              </div>
              <div className="text-xs text-secondary-500 space-y-1">
                <p className="font-semibold text-secondary-700">Mensagens automáticas ativas:</p>
                <p>✅ Confirmação imediata ao confirmar agendamento</p>
                <p>✅ Lembrete 24h antes do horário</p>
              </div>
              {canManage && (
                <button onClick={handleDisconnect} disabled={loading}
                  className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50">
                  <LogOut className="w-4 h-4" /> Desconectar WhatsApp
                </button>
              )}
            </div>
          )}

          {/* Conectando — aguardando QR scan */}
          {status === 'CONNECTING' && qrCode && (
            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 rounded-xl text-sm text-yellow-800">
                <p className="font-semibold mb-1">Escaneie o QR Code abaixo</p>
                <p className="text-xs">Abra o WhatsApp → três pontos → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong></p>
              </div>
              <div className="flex justify-center">
                <img src={qrCode} alt="QR Code WhatsApp" className="w-48 h-48 rounded-xl border border-secondary-200" />
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-secondary-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Aguardando conexão...
                <button onClick={loadStatus} className="text-primary-500 hover:underline">
                  <RefreshCw className="w-3 h-3 inline" /> atualizar
                </button>
              </div>
            </div>
          )}

          {/* Desconectado — formulário de conexão */}
          {status === 'DISCONNECTED' && canManage && (
            <div className="space-y-4">
              {/* Disclaimer */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">Use um número dedicado exclusivo para esta função.</p>
                    <p>Não utilize seu número pessoal ou comercial principal.</p>
                    <p>O Aura System <strong>não se responsabiliza</strong> por eventual bloqueio do WhatsApp neste número.</p>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded accent-primary-500"
                  checked={termsChecked}
                  onChange={e => setTermsChecked(e.target.checked)}
                />
                <span className="text-xs text-secondary-600">
                  Entendi e aceito os termos acima. Usarei um chip/número dedicado para esta integração.
                </span>
              </label>

              <button
                onClick={handleConnect}
                disabled={!termsChecked || loading}
                className="w-full py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando QR Code...</> : <><MessageCircle className="w-4 h-4" /> Conectar WhatsApp</>}
              </button>

              {/* Preview das mensagens */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wider">Preview das mensagens automáticas</p>
                <div className="bg-[#dcf8c6] rounded-xl p-3 text-xs text-secondary-800 space-y-1 border border-green-200">
                  <p className="font-semibold text-secondary-500 text-[10px] uppercase mb-1">Confirmação (imediato)</p>
                  <p>Olá [Nome]! 👋</p>
                  <p>Aqui é o sistema de confirmações da <strong>[Clínica]</strong>.</p>
                  <p>✅ Seu agendamento foi <strong>confirmado</strong>:</p>
                  <p>📅 [Data] às [Hora] · 💆 [Procedimento]</p>
                  <p>Por favor, <strong>salve este número</strong> nos seus contatos! 😊</p>
                </div>
                <div className="bg-[#dcf8c6] rounded-xl p-3 text-xs text-secondary-800 space-y-1 border border-green-200">
                  <p className="font-semibold text-secondary-500 text-[10px] uppercase mb-1">Lembrete (24h antes)</p>
                  <p>Olá [Nome]! 🌟 Lembrete da <strong>[Clínica]</strong>:</p>
                  <p>Você tem um agendamento <strong>amanhã</strong>:</p>
                  <p>📅 [Data] às [Hora] · 💆 [Procedimento]</p>
                  <p>Te esperamos! 😊</p>
                </div>
              </div>
            </div>
          )}

          {/* Sem permissão (não é admin/owner) */}
          {!canManage && status === 'DISCONNECTED' && (
            <p className="text-xs text-secondary-400 text-center py-2">
              Apenas administradores podem configurar o WhatsApp.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default WhatsAppSettings
```

**Step 3: Adicionar accordion na Settings.tsx**

Em `pages/Settings.tsx`, adicionar import no topo:
```typescript
import WhatsAppSettings from '../components/WhatsAppSettings'
```

Localizar o bloco do Google Calendar na renderização e adicionar **após** ele:
```tsx
{/* WhatsApp — Confirmações */}
<WhatsAppSettings />
```

**Step 4: Escrever teste E2E**

Criar `e2e/whatsapp-settings.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { loginAs, DEMO_CREDENTIALS } from './helpers'

test.describe('WhatsApp Settings — /settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_CREDENTIALS.owner.email, DEMO_CREDENTIALS.owner.password)
    await page.waitForURL(/dashboard/, { timeout: 20_000 })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('exibe accordion WhatsApp em /settings', async ({ page }) => {
    await expect(
      page.locator('text=/WhatsApp.*Confirmações/i').first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('accordion abre ao clicar', async ({ page }) => {
    await page.locator('text=/WhatsApp.*Confirmações/i').first().click()
    // Deve mostrar o disclaimer ou status
    await expect(
      page.locator('text=/número dedicado|conectado|desconectado/i').first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('botão Conectar fica desabilitado sem aceitar termos', async ({ page }) => {
    await page.locator('text=/WhatsApp.*Confirmações/i').first().click()
    const connectBtn = page.getByRole('button', { name: /conectar whatsapp/i })
    if (await connectBtn.isVisible()) {
      await expect(connectBtn).toBeDisabled()
    }
  })

  test('botão Conectar habilita após aceitar termos', async ({ page }) => {
    await page.locator('text=/WhatsApp.*Confirmações/i').first().click()
    const checkbox = page.locator('input[type="checkbox"]').last()
    const connectBtn = page.getByRole('button', { name: /conectar whatsapp/i })
    if (await connectBtn.isVisible()) {
      await checkbox.check()
      await expect(connectBtn).toBeEnabled()
    }
  })
})
```

**Step 5: Rodar suite completa**

```bash
bash test-all.sh
```

Expected: todos os testes passando

**Step 6: Commit**

```bash
git add components/WhatsAppSettings.tsx pages/Settings.tsx services/api.ts e2e/whatsapp-settings.spec.ts
git commit -m "feat(whatsapp): add WhatsApp settings accordion with QR code flow and disclaimer"
```

---

## Task 9: Verificação final e deploy

**Step 1: Rodar suite completa**

```bash
bash test-all.sh
```

Expected: todos os testes passando (unitários + E2E)

**Step 2: Adicionar env vars no Vercel (backend)**

No painel do Vercel do projeto `aura-backend-api`:
```
EVOLUTION_API_URL=https://seu-evolution.up.railway.app
EVOLUTION_API_KEY=sua-chave-aqui
CRON_SECRET=string-aleatoria-segura
```

**Step 3: Deploy**

```bash
cd aura-backend && npm run deploy
cd .. && npm run deploy:frontend
```

**Step 4: Adicionar módulo whatsapp_notifications aos planos PREMIUM/ENTERPRISE**

Acessar Prisma Studio em produção e adicionar `"whatsapp_notifications"` ao array `modules` dos planos PREMIUM e ENTERPRISE.

---

## Resumo das tasks

| # | Task | Testes |
|---|------|--------|
| 1 | Schema — WhatsappInstance | — |
| 2 | planPermissions — módulo whatsapp_notifications | 1 |
| 3 | lib/whatsapp.ts — cliente Evolution API | 7 |
| 4 | lib/whatsappMessages.ts — templates fixos | 8 |
| 5 | API /whatsapp/instance | 8 |
| 6 | Hook confirmação no status route | 5 |
| 7 | Cron lembrete 24h | 6 |
| 8 | Frontend accordion + E2E | 4 |
| **Total** | | **39 novos testes** |
