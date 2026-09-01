# Asaas Payment Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que o ADMIN de uma clínica escolha um plano e pague diretamente pelo sistema, usando Asaas (PIX + boleto), com renovação automática via webhook.

**Architecture:** DB recebe `asaasCustomerId` e `asaasSubscriptionId` na Company. Backend expõe `/api/billing/checkout` (cria cliente+assinatura no Asaas) e `/api/webhooks/asaas` (atualiza plano/status ao confirmar pagamento). Frontend tem página `/billing` para ADMIN escolher e assinar plano.

**Tech Stack:** Next.js 15 (API Routes), Prisma, Asaas REST API v3, React 19, TypeScript, Tailwind.

---

### Contexto do Projeto

- Backend em `C:\Aura_System\aura-backend\` (Next.js, porta 3001)
- Frontend em `C:\Aura_System\` (React/Vite, porta 3000)
- Prisma schema: `aura-backend/prisma/schema.prisma`
- Auth: `aura-backend/src/lib/auth.ts` — `getAuthUser(request)` retorna `AuthUser | null`
- API client: `services/api.ts` — `fetchApi<T>(path, options?)` faz request autenticado
- Planos no DB: SaasPlan (id, name, price) — "Starter" R$97, "Pro" R$197, "Clinic" R$397
- Company.plan enum: FREE, BASIC, STARTER, PROFESSIONAL, PREMIUM, ENTERPRISE
- Company.subscriptionStatus: ACTIVE, TRIAL, OVERDUE, CANCELED
- `ASAAS_API_KEY` já está configurado no Vercel (backend)
- Asaas sandbox: `https://sandbox.asaas.com/api/v3` | prod: `https://api.asaas.com/api/v3`
- Asaas auth: header `access_token: {API_KEY}`

**Mapeamento plan names → enum:**
- SaasPlan.name "Starter" → Company.plan = "STARTER"
- SaasPlan.name "Pro" → Company.plan = "PROFESSIONAL"
- SaasPlan.name "Clinic" → Company.plan = "PREMIUM"

---

### Task 1: DB — Adicionar campos Asaas ao Company

**Files:**
- Modify: `aura-backend/prisma/schema.prisma`

**Step 1: Adicionar campos na model Company (após linha `subscriptionExpiresAt`)**

```prisma
// Integração Asaas
asaasCustomerId         String?
asaasSubscriptionId     String?
```

O bloco `// Configuração de plano/assinatura` deve ficar:
```prisma
// Configuração de plano/assinatura
plan                    Plan     @default(FREE)
subscriptionStatus      SubscriptionStatus @default(TRIAL)
subscriptionExpiresAt   DateTime?
lastPlan                Plan?
customPrice             Decimal? @db.Decimal(10, 2)
asaasCustomerId         String?
asaasSubscriptionId     String?
```

**Step 2: Rodar migration**

```bash
cd aura-backend
npx prisma migrate dev --name add_asaas_fields
```

Expected: migration aplicada com sucesso, tabela `companies` tem 2 novas colunas.

**Step 3: Regenerar client Prisma**

```bash
npx prisma generate
```

**Step 4: Commit**

```bash
git add aura-backend/prisma/schema.prisma aura-backend/prisma/migrations/
git commit -m "feat(billing): add asaasCustomerId and asaasSubscriptionId to Company"
```

---

### Task 2: Backend — Asaas client lib

**Files:**
- Create: `aura-backend/src/lib/asaas.ts`

**Step 1: Criar o arquivo**

```typescript
// aura-backend/src/lib/asaas.ts
// Cliente para a API REST do Asaas (PIX + boleto + recorrência)

const ASAAS_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

async function asaasRequest<T>(
  method: string,
  path: string,
  body?: object
): Promise<T> {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY not configured');
  }

  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asaas API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  status: string;
  value: number;
  nextDueDate: string;
}

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCodeUrl: string | null;
  billingType: string;
}

export interface AsaasCustomerListResponse {
  data: AsaasCustomer[];
  totalCount: number;
}

export interface AsaasPaymentListResponse {
  data: AsaasPayment[];
}

/** Busca cliente Asaas pelo email. Retorna null se não encontrar. */
export async function findCustomerByEmail(email: string): Promise<AsaasCustomer | null> {
  const result = await asaasRequest<AsaasCustomerListResponse>(
    'GET',
    `/customers?email=${encodeURIComponent(email)}&limit=1`
  );
  return result.data[0] ?? null;
}

/** Cria cliente no Asaas */
export async function createCustomer(data: {
  name: string;
  email: string;
  cpfCnpj?: string;
}): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>('POST', '/customers', data);
}

/** Cria assinatura mensal no Asaas */
export async function createSubscription(data: {
  customer: string;
  billingType: 'BOLETO' | 'PIX';
  value: number;
  nextDueDate: string; // 'YYYY-MM-DD'
  description: string;
}): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>('POST', '/subscriptions', {
    ...data,
    cycle: 'MONTHLY',
  });
}

/** Busca o primeiro pagamento da assinatura (para obter link de pagamento) */
export async function getSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
  const result = await asaasRequest<AsaasPaymentListResponse>(
    'GET',
    `/subscriptions/${subscriptionId}/payments?limit=1`
  );
  return result.data;
}

/** Cancela assinatura no Asaas */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await asaasRequest<unknown>('DELETE', `/subscriptions/${subscriptionId}`);
}
```

**Step 2: Verificar que TypeScript compila**

```bash
cd aura-backend
npx tsc --noEmit
```

Expected: sem erros.

**Step 3: Commit**

```bash
git add aura-backend/src/lib/asaas.ts
git commit -m "feat(billing): add Asaas API client lib"
```

---

### Task 3: Backend — GET /api/billing/plans (listar planos para ADMIN)

**Files:**
- Create: `aura-backend/src/app/api/billing/plans/route.ts`

**Step 1: Criar endpoint**

```typescript
// aura-backend/src/app/api/billing/plans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const plans = await prisma.saasPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
    select: {
      id: true,
      name: true,
      displayName: true,
      price: true,
      features: true,
      maxProfessionals: true,
      maxPatients: true,
    },
  });

  // Buscar plano e status atual da empresa
  let currentPlan = null;
  let currentStatus = null;
  let subscriptionExpiresAt = null;

  if (user.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        plan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });
    currentPlan = company?.plan ?? null;
    currentStatus = company?.subscriptionStatus ?? null;
    subscriptionExpiresAt = company?.subscriptionExpiresAt ?? null;
  }

  return NextResponse.json({
    success: true,
    data: {
      plans,
      currentPlan,
      currentStatus,
      subscriptionExpiresAt,
    },
  });
}
```

**Step 2: Verificar TypeScript**

```bash
cd aura-backend && npx tsc --noEmit
```

Expected: sem erros.

**Step 3: Commit**

```bash
git add aura-backend/src/app/api/billing/plans/route.ts
git commit -m "feat(billing): GET /api/billing/plans endpoint"
```

---

### Task 4: Backend — POST /api/billing/checkout

**Files:**
- Create: `aura-backend/src/app/api/billing/checkout/route.ts`

**Step 1: Criar endpoint**

```typescript
// aura-backend/src/app/api/billing/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  findCustomerByEmail,
  createCustomer,
  createSubscription,
  getSubscriptionPayments,
} from '@/lib/asaas';

// Mapa SaasPlan.name → Company.plan enum
const PLAN_NAME_MAP: Record<string, string> = {
  Starter: 'STARTER',
  Pro: 'PROFESSIONAL',
  Clinic: 'PREMIUM',
};

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  if (!user.companyId) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });
  }

  const body = await request.json() as { planId: string };
  const { planId } = body;

  if (!planId) {
    return NextResponse.json({ error: 'planId obrigatório' }, { status: 400 });
  }

  // Buscar plano SaaS
  const saasPlan = await prisma.saasPlan.findUnique({
    where: { id: planId },
  });

  if (!saasPlan || !saasPlan.isActive) {
    return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
  }

  // Buscar empresa
  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
  });

  if (!company) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
  }

  // Buscar ou criar cliente no Asaas
  let asaasCustomerId = company.asaasCustomerId;

  if (!asaasCustomerId) {
    let customer = await findCustomerByEmail(user.email);

    if (!customer) {
      customer = await createCustomer({
        name: company.name,
        email: user.email,
        cpfCnpj: company.cnpj ?? undefined,
      });
    }

    asaasCustomerId = customer.id;

    // Salvar customerId na empresa
    await prisma.company.update({
      where: { id: user.companyId },
      data: { asaasCustomerId },
    });
  }

  // Data de vencimento = hoje + 1 dia
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 1);
  const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

  // Criar assinatura
  const subscription = await createSubscription({
    customer: asaasCustomerId,
    billingType: 'PIX',
    value: Number(saasPlan.price),
    nextDueDate: nextDueDateStr,
    description: `Aura System — Plano ${saasPlan.displayName ?? saasPlan.name}`,
  });

  // Salvar subscriptionId na empresa
  await prisma.company.update({
    where: { id: user.companyId },
    data: { asaasSubscriptionId: subscription.id },
  });

  // Buscar link do primeiro pagamento
  const payments = await getSubscriptionPayments(subscription.id);
  const firstPayment = payments[0];

  const paymentUrl = firstPayment?.invoiceUrl
    ?? firstPayment?.pixQrCodeUrl
    ?? firstPayment?.bankSlipUrl
    ?? null;

  return NextResponse.json({
    success: true,
    data: {
      subscriptionId: subscription.id,
      paymentUrl,
      planName: PLAN_NAME_MAP[saasPlan.name] ?? saasPlan.name,
    },
  });
}
```

**Step 2: Verificar TypeScript**

```bash
cd aura-backend && npx tsc --noEmit
```

Expected: sem erros.

**Step 3: Commit**

```bash
git add aura-backend/src/app/api/billing/checkout/route.ts
git commit -m "feat(billing): POST /api/billing/checkout endpoint"
```

---

### Task 5: Backend — POST /api/webhooks/asaas

**Files:**
- Create: `aura-backend/src/app/api/webhooks/asaas/route.ts`

**Step 1: Criar endpoint**

```typescript
// aura-backend/src/app/api/webhooks/asaas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Mapa: subscription value range → plan enum (fallback)
// Na prática, usamos o valor para descobrir o plano
const VALUE_TO_PLAN: Record<number, string> = {
  97: 'STARTER',
  197: 'PROFESSIONAL',
  397: 'PREMIUM',
};

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    customer: string;
    subscription?: string;
    status: string;
    value: number;
    dueDate: string;
  };
  subscription?: {
    id: string;
    customer: string;
    status: string;
  };
}

export async function POST(request: NextRequest) {
  let payload: AsaasWebhookPayload;

  try {
    payload = await request.json() as AsaasWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event, payment, subscription } = payload;

  // Encontrar empresa pelo asaasCustomerId
  const customerId = payment?.customer ?? subscription?.customer;
  if (!customerId) {
    return NextResponse.json({ ok: true }); // ignorar eventos sem customer
  }

  const company = await prisma.company.findFirst({
    where: { asaasCustomerId: customerId },
  });

  if (!company) {
    // Pode ser evento de teste do Asaas — retornar 200 mesmo assim
    return NextResponse.json({ ok: true });
  }

  if (event === 'PAYMENT_CONFIRMED' && payment) {
    // Descobrir qual plano pelo valor do pagamento
    const plan = VALUE_TO_PLAN[payment.value] ?? 'STARTER';

    // Calcular nova data de expiração (+1 mês)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await prisma.company.update({
      where: { id: company.id },
      data: {
        plan: plan as any,
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: expiresAt,
      },
    });

    console.log(`[Asaas Webhook] Pagamento confirmado — empresa ${company.id} → plano ${plan}`);
  }

  if (event === 'PAYMENT_OVERDUE' && payment) {
    await prisma.company.update({
      where: { id: company.id },
      data: { subscriptionStatus: 'OVERDUE' },
    });

    console.log(`[Asaas Webhook] Pagamento vencido — empresa ${company.id}`);
  }

  if (event === 'SUBSCRIPTION_INACTIVATED' || event === 'PAYMENT_DELETED') {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        subscriptionStatus: 'CANCELED',
        asaasSubscriptionId: null,
      },
    });

    console.log(`[Asaas Webhook] Assinatura cancelada — empresa ${company.id}`);
  }

  return NextResponse.json({ ok: true });
}
```

**Step 2: Verificar TypeScript**

```bash
cd aura-backend && npx tsc --noEmit
```

Expected: sem erros.

**Step 3: Commit**

```bash
git add aura-backend/src/app/api/webhooks/asaas/route.ts
git commit -m "feat(billing): POST /api/webhooks/asaas webhook handler"
```

---

### Task 6: Backend — Excluir webhook do CSRF middleware

**Files:**
- Modify: `aura-backend/src/middleware.ts`

O middleware atual aplica CSRF protection em todos os POST requests. O webhook do Asaas é um POST externo (sem Origin do frontend), então precisa estar na lista de exclusões.

**Step 1: Ler o arquivo e localizar a lista de exclusões do CSRF**

```bash
grep -n "csrf\|CSRF\|webhook\|skipCsrf\|pathname" aura-backend/src/middleware.ts | head -20
```

**Step 2: Adicionar `/api/webhooks/asaas` à exclusão**

Localizar o bloco onde rotas são excluídas do CSRF (deve ter algo como `/api/auth/` já excluído) e adicionar:

```typescript
pathname.startsWith('/api/webhooks/')
```

Se o padrão atual for uma lista de strings, adicionar `'/api/webhooks/'` a ela.

**Step 3: Verificar TypeScript**

```bash
cd aura-backend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add aura-backend/src/middleware.ts
git commit -m "feat(billing): exclude /api/webhooks from CSRF middleware"
```

---

### Task 7: Frontend — billingApi no services/api.ts

**Files:**
- Modify: `services/api.ts`

**Step 1: Adicionar interface e billingApi (antes da linha `export const api = {`)**

```typescript
// Billing
export interface BillingPlan {
  id: string;
  name: string;
  displayName: string | null;
  price: number;
  features: string[];
  maxProfessionals: number;
  maxPatients: number;
}

export interface BillingPlansResponse {
  plans: BillingPlan[];
  currentPlan: string | null;
  currentStatus: string | null;
  subscriptionExpiresAt: string | null;
}

export const billingApi = {
  getPlans: () =>
    fetchApi<{ success: boolean; data: BillingPlansResponse }>('/api/billing/plans'),

  checkout: (planId: string) =>
    fetchApi<{ success: boolean; data: { subscriptionId: string; paymentUrl: string | null; planName: string } }>(
      '/api/billing/checkout',
      { method: 'POST', body: JSON.stringify({ planId }) }
    ),
};
```

**Step 2: Adicionar `billing: billingApi` no objeto `api` exportado**

Localizar o `export const api = {` e adicionar:

```typescript
billing: billingApi,
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros.

**Step 4: Commit**

```bash
git add services/api.ts
git commit -m "feat(billing): add billingApi to api client"
```

---

### Task 8: Frontend — Página Billing.tsx

**Files:**
- Create: `pages/admin/Billing.tsx`

> Nota: criar a pasta `pages/admin/` se não existir.

**Step 1: Criar o componente**

```tsx
// pages/admin/Billing.tsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, Zap, Star, Building2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { api, BillingPlan, BillingPlansResponse } from '../../services/api';

const PLAN_ICONS: Record<string, React.ElementType> = {
  Starter: Zap,
  Pro: Star,
  Clinic: Building2,
};

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string; button: string }> = {
  Starter: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    button: 'bg-blue-600 hover:bg-blue-700',
  },
  Pro: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    button: 'bg-purple-600 hover:bg-purple-700',
  },
  Clinic: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    button: 'bg-amber-600 hover:bg-amber-700',
  },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Ativo', color: 'text-emerald-600' },
  TRIAL: { label: 'Trial', color: 'text-blue-600' },
  OVERDUE: { label: 'Vencido', color: 'text-red-600' },
  CANCELED: { label: 'Cancelado', color: 'text-slate-500' },
};

const Billing: React.FC = () => {
  const [data, setData] = useState<BillingPlansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    api.billing.getPlans().then((res) => {
      if (res.success && res.data) {
        setData(res.data as any);
      }
      setLoading(false);
    }).catch(() => {
      setError('Erro ao carregar planos.');
      setLoading(false);
    });
  }, []);

  const handleSubscribe = async (plan: BillingPlan) => {
    setCheckingOut(plan.id);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.billing.checkout(plan.id);

      if (res.success && res.data) {
        const { paymentUrl } = res.data as any;

        if (paymentUrl) {
          window.open(paymentUrl, '_blank');
          setSuccessMsg('Link de pagamento aberto. Após confirmar o pagamento, seu plano será ativado automaticamente.');
        } else {
          setSuccessMsg('Assinatura criada! Você receberá o link de pagamento por email.');
        }
      } else {
        setError('Erro ao iniciar assinatura. Tente novamente.');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setCheckingOut(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const currentStatus = data?.currentStatus ? STATUS_LABELS[data.currentStatus] : null;
  const expiresAt = data?.subscriptionExpiresAt
    ? new Date(data.subscriptionExpiresAt).toLocaleDateString('pt-BR')
    : null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Planos e Assinatura</h1>
        <p className="text-slate-500 mt-1">Escolha o plano ideal para sua clínica</p>
      </div>

      {/* Status atual */}
      {data?.currentPlan && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Plano atual</p>
            <p className="font-semibold text-slate-900 capitalize">
              {data.currentPlan.toLowerCase()}
              {currentStatus && (
                <span className={`ml-2 text-xs font-medium ${currentStatus.color}`}>
                  • {currentStatus.label}
                </span>
              )}
            </p>
            {expiresAt && (
              <p className="text-xs text-slate-400">Válido até {expiresAt}</p>
            )}
          </div>
        </div>
      )}

      {/* Mensagens */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="text-emerald-700 text-sm">{successMsg}</span>
        </div>
      )}

      {/* Cards de planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {data?.plans.map((plan) => {
          const Icon = PLAN_ICONS[plan.name] ?? Zap;
          const colors = PLAN_COLORS[plan.name] ?? PLAN_COLORS.Starter;
          const isCurrentPlan = data.currentPlan?.toUpperCase() === plan.name.toUpperCase();
          const isLoading = checkingOut === plan.id;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border-2 p-6 flex flex-col ${
                isCurrentPlan ? `${colors.border} shadow-md` : 'border-slate-100 shadow-sm'
              }`}
            >
              {/* Header do plano */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${colors.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{plan.displayName ?? plan.name}</h3>
                  {isCurrentPlan && (
                    <span className="text-xs text-emerald-600 font-medium">Plano atual</span>
                  )}
                </div>
              </div>

              {/* Preço */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-slate-900">
                  R$ {Number(plan.price).toFixed(0)}
                </span>
                <span className="text-slate-500 text-sm">/mês</span>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Botão */}
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={isLoading || isCurrentPlan}
                className={`w-full py-2.5 px-4 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors.button}`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrentPlan ? (
                  'Plano atual'
                ) : (
                  <>
                    Assinar <ExternalLink className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Nota sobre pagamento */}
      <p className="text-xs text-slate-400 text-center">
        Pagamento via PIX. Após a confirmação, seu plano é ativado automaticamente.
        <br />
        Dúvidas? Fale com o suporte.
      </p>
    </div>
  );
};

export default Billing;
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros.

**Step 3: Commit**

```bash
git add pages/admin/Billing.tsx
git commit -m "feat(billing): add Billing page for ADMIN plan selection"
```

---

### Task 9: Frontend — Adicionar rota /billing no App.tsx

**Files:**
- Modify: `App.tsx`

**Step 1: Adicionar import**

Localizar o bloco de imports de páginas e adicionar:
```typescript
import Billing from './pages/admin/Billing';
```

**Step 2: Adicionar rota dentro do `<Route element={<PrivateLayout />}>`**

Localizar a rota `/settings` e adicionar logo abaixo:
```tsx
<Route path="/billing" element={<Billing />} />
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(billing): add /billing route"
```

---

### Task 10: Frontend — Link "Planos" no sidebar

**Files:**
- Modify: `components/Layout.tsx` (ou onde estiver o sidebar do admin — verificar com `grep -rn "sidebar\|Sidebar\|nav.*admin" components/ --include="*.tsx" -l`)

**Step 1: Encontrar o arquivo do sidebar**

```bash
grep -rn "schedule\|financial\|settings" components/ --include="*.tsx" -l
```

**Step 2: Adicionar item de navegação**

Localizar o array/lista de nav items (geralmente tem path, icon, label) e adicionar:
```tsx
{ path: '/billing', icon: CreditCard, label: 'Planos' }
```

Importar o ícone `CreditCard` do `lucide-react` se necessário.

**Step 3: Commit**

```bash
git add components/Layout.tsx  # (usar o arquivo real encontrado)
git commit -m "feat(billing): add billing link to sidebar"
```

---

### Task 11: Deploy + Configuração do Webhook no Asaas

**Step 1: Build local para verificar erros**

```bash
# Frontend
npm run build

# Backend
cd aura-backend && npm run build
```

Expected: sem erros TypeScript.

**Step 2: Deploy backend**

```bash
cd aura-backend
vercel --prod --yes
```

**Step 3: Deploy frontend**

```bash
cd /c/Aura_System
vercel --prod --yes
```

**Step 4: Configurar webhook no Asaas**

1. Acessar https://sandbox.asaas.com (ou produção)
2. Menu: **Configurações** → **Integrações** → **Webhooks**
3. Adicionar URL: `https://aura-backend-api.vercel.app/api/webhooks/asaas`
4. Marcar eventos:
   - `PAYMENT_CONFIRMED`
   - `PAYMENT_OVERDUE`
   - `SUBSCRIPTION_INACTIVATED`
5. Salvar

**Step 5: Testar fluxo completo**

1. Fazer login como ADMIN
2. Navegar para `/billing`
3. Clicar "Assinar" em um plano
4. Verificar que link de pagamento abre em nova aba
5. No Asaas sandbox, confirmar o pagamento manualmente (ou usar a função de teste)
6. Verificar que `subscriptionStatus` mudou para ACTIVE no DB

**Step 6: Commit final**

```bash
git add -A
git commit -m "feat(billing): Asaas payment integration complete"
```
