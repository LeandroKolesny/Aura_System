# Installment Payments (Parcelamento) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow clinics to charge credit card payments in installments (1x–12x), creating one Transaction record per installment linked by a shared `installmentGroupId`, and display pending installments in the Financial dashboard.

**Architecture:** Backend creates N PENDING transactions for future installments and 1 PAID transaction for the first installment, all sharing an `installmentGroupId`. Frontend shows an installment selector in CheckoutModal when `credit_card` is selected, and the Financial page gains a KPI card "A Receber (Parcelas)" + a "Parc. N/M" badge on transaction rows. PENDING installment rows show a "Receber" button that marks the installment as PAID via a dedicated PATCH endpoint.

**Tech Stack:** Prisma (schema + migration), Next.js API Route, React + TypeScript (Modals.tsx, AppContext.tsx, Financial.tsx, types.ts, services/api.ts)

---

### Task 1: Prisma Schema — Add Installment Fields to Transaction

**Files:**
- Modify: `aura-backend/prisma/schema.prisma` (lines 356–385, Transaction model)

**Step 1: Write the failing test**

Create `aura-backend/src/__tests__/api/installment-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import prisma from '@/lib/prisma'

describe('Transaction model — installment fields', () => {
  it('Transaction model has installments field', () => {
    // Prisma client shape test: field must exist after migration
    const fields = Object.keys(prisma.transaction.fields)
    expect(fields).toContain('installments')
    expect(fields).toContain('installmentIndex')
    expect(fields).toContain('installmentGroupId')
    expect(fields).toContain('dueDate')
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
cd aura-backend && npx vitest run src/__tests__/api/installment-schema.test.ts
```
Expected: FAIL — `installments` not in fields (or property access error)

**Step 3: Add fields to schema**

In `aura-backend/prisma/schema.prisma`, inside the `Transaction` model after `paymentMethod String?`:

```prisma
  // Parcelamento (cartão de crédito)
  installments      Int?      // Total de parcelas (ex: 3)
  installmentIndex  Int?      // Número desta parcela (1-based, ex: 2)
  installmentGroupId String?  // UUID compartilhado por todas as parcelas do mesmo pagamento
  dueDate           DateTime? // Data de vencimento desta parcela
```

Also add an index after the existing `@@index` lines:

```prisma
  @@index([installmentGroupId])
```

**Step 4: Push schema to database**

```bash
cd aura-backend && npm run db:generate && npm run db:push
```
Expected: "Your database is now in sync with your Prisma schema"

**Step 5: Run test to confirm it passes**

```bash
cd aura-backend && npx vitest run src/__tests__/api/installment-schema.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
cd aura-backend
git add prisma/schema.prisma src/__tests__/api/installment-schema.test.ts
git commit -m "feat(schema): add installment fields to Transaction model"
```

---

### Task 2: Update Frontend `Transaction` Type

**Files:**
- Modify: `types.ts` (line 219, `Transaction` interface)

**Step 1: Add installment fields to the interface**

In `types.ts`, inside `interface Transaction` after `appointmentId?: string;`:

```typescript
  installments?: number;
  installmentIndex?: number;
  installmentGroupId?: string;
  dueDate?: string;
```

**Step 2: Verify TypeScript compilation**

```bash
cd /c/Aura_System && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors related to `Transaction`

**Step 3: Commit**

```bash
git add types.ts
git commit -m "feat(types): add installment fields to Transaction interface"
```

---

### Task 3: Update `services/api.ts` — processPayment Accepts Installments

**Files:**
- Modify: `services/api.ts` (lines 303–313, `processPayment` function)

**Step 1: Update the function signature and body**

Replace the `processPayment` function (lines 303–313) with:

```typescript
  async processPayment(id: string, paymentMethod: string, installments = 1) {
    return fetchApi<{
      success: boolean;
      appointment: any;
      transactions: { income: any; expense: any; installments?: any[] };
      summary: { revenue: number; cost: number; profit: number };
    }>(`/api/appointments/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod, installments }),
    });
  },
```

**Step 2: Verify TypeScript compilation**

```bash
cd /c/Aura_System && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors

**Step 3: Commit**

```bash
git add services/api.ts
git commit -m "feat(api): pass installments count to processPayment endpoint"
```

---

### Task 4: Backend — Create N Installment Transactions in Pay Route

**Files:**
- Modify: `aura-backend/src/app/api/appointments/[id]/pay/route.ts`
- Test: `aura-backend/src/__tests__/api/pay-installments.test.ts`

**Step 1: Write the failing test**

Create `aura-backend/src/__tests__/api/pay-installments.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    transaction: { create: vi.fn() },
    procedureSupply: { findMany: vi.fn() },
    inventoryItem: { update: vi.fn() },
    stockMovement: { create: vi.fn() },
    patient: { update: vi.fn() },
    activity: { create: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { POST } from '../../app/api/appointments/[id]/pay/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const mockUser = { id: 'u1', companyId: 'c1', role: 'ADMIN' }
const mockAppointment = {
  id: 'appt1',
  paid: false,
  price: 300,
  patientId: 'p1',
  professionalId: 'prof1',
  procedureId: 'proc1',
  patient: { id: 'p1', name: 'João' },
  professional: { id: 'prof1', name: 'Dr. Ana' },
  procedure: { id: 'proc1', name: 'Limpeza', cost: 0, supplies: [] },
}

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/appointments/appt1/pay', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', authorization: 'Bearer token' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(mockUser as never)
  vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as never)
  vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, paid: true } as never)
  vi.mocked(prisma.procedureSupply.findMany).mockResolvedValue([])
  vi.mocked(prisma.patient.update).mockResolvedValue({} as never)
  vi.mocked(prisma.activity.create).mockResolvedValue({} as never)
  vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 'tx1' } as never)
})

describe('POST /api/appointments/[id]/pay — installments', () => {
  it('creates 1 PAID transaction when installments=1 (default)', async () => {
    const res = await POST(makeReq({ paymentMethod: 'pix', installments: 1 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    // Only 1 income transaction created (+ no installments array)
    const incomeCalls = vi.mocked(prisma.transaction.create).mock.calls.filter(
      ([data]) => (data as any).data?.type === 'INCOME'
    )
    expect(incomeCalls).toHaveLength(1)
    expect(incomeCalls[0][0].data.status).toBe('PAID')
    expect(incomeCalls[0][0].data.installments).toBe(1)
    expect(incomeCalls[0][0].data.installmentIndex).toBe(1)
  })

  it('creates 3 transactions for installments=3: 1 PAID + 2 PENDING', async () => {
    const res = await POST(makeReq({ paymentMethod: 'credit_card', installments: 3 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.transactions.installments).toHaveLength(3)

    const incomeCalls = vi.mocked(prisma.transaction.create).mock.calls.filter(
      ([data]) => (data as any).data?.type === 'INCOME'
    )
    expect(incomeCalls).toHaveLength(3)
    expect(incomeCalls[0][0].data.status).toBe('PAID')
    expect(incomeCalls[0][0].data.installmentIndex).toBe(1)
    expect(incomeCalls[1][0].data.status).toBe('PENDING')
    expect(incomeCalls[1][0].data.installmentIndex).toBe(2)
    expect(incomeCalls[2][0].data.status).toBe('PENDING')
    expect(incomeCalls[2][0].data.installmentIndex).toBe(3)
  })

  it('each installment amount = total / installments (rounded to 2 decimal places)', async () => {
    // 300 / 3 = 100.00
    await POST(makeReq({ paymentMethod: 'credit_card', installments: 3 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    const incomeCalls = vi.mocked(prisma.transaction.create).mock.calls.filter(
      ([data]) => (data as any).data?.type === 'INCOME'
    )
    incomeCalls.forEach(([data]) => {
      expect(Number((data as any).data.amount)).toBeCloseTo(100, 1)
    })
  })

  it('all installments share the same installmentGroupId', async () => {
    await POST(makeReq({ paymentMethod: 'credit_card', installments: 3 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    const incomeCalls = vi.mocked(prisma.transaction.create).mock.calls.filter(
      ([data]) => (data as any).data?.type === 'INCOME'
    )
    const groupIds = incomeCalls.map(([data]) => (data as any).data.installmentGroupId)
    expect(groupIds[0]).toBeTruthy()
    expect(groupIds[0]).toBe(groupIds[1])
    expect(groupIds[1]).toBe(groupIds[2])
  })

  it('dueDate for installment N = today + N months (approx)', async () => {
    await POST(makeReq({ paymentMethod: 'credit_card', installments: 3 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    const incomeCalls = vi.mocked(prisma.transaction.create).mock.calls.filter(
      ([data]) => (data as any).data?.type === 'INCOME'
    )
    const due1: Date = incomeCalls[0][0].data.dueDate as Date
    const due2: Date = incomeCalls[1][0].data.dueDate as Date
    const due3: Date = incomeCalls[2][0].data.dueDate as Date
    // Each subsequent dueDate is ~30 days later
    expect(due2.getTime()).toBeGreaterThan(due1.getTime())
    expect(due3.getTime()).toBeGreaterThan(due2.getTime())
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
cd aura-backend && npx vitest run src/__tests__/api/pay-installments.test.ts
```
Expected: FAIL — tests reference fields/behavior that don't exist yet

**Step 3: Implement installment logic in the pay route**

In `aura-backend/src/app/api/appointments/[id]/pay/route.ts`:

1. Add `import { randomUUID } from 'crypto';` at top.

2. Change `const body = await request.json();` block to:
```typescript
    const body = await request.json();
    const { paymentMethod, installments: installmentCount = 1 } = body;
    const numInstallments = Math.max(1, Math.min(12, Number(installmentCount) || 1));
```

3. Replace the "1. Criar transação de RECEITA" block (lines 72–86) with:
```typescript
    // 1. Criar transações de RECEITA (uma por parcela)
    const installmentGroupId = numInstallments > 1 ? randomUUID() : null;
    const installmentAmount = Number((Number(appointment.price) / numInstallments).toFixed(2));
    const now = new Date();

    const incomeTransactions = [];
    for (let i = 1; i <= numInstallments; i++) {
      const dueDate = new Date(now);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      const tx = await prisma.transaction.create({
        data: {
          companyId: user.companyId,
          date: now,
          description: numInstallments > 1
            ? `Atendimento (${i}/${numInstallments}): ${appointment.procedure.name} - ${appointment.patient.name}`
            : `Atendimento: ${appointment.procedure.name} - ${appointment.patient.name}`,
          amount: installmentAmount,
          type: 'INCOME',
          category: 'Procedimentos',
          status: i === 1 ? 'PAID' : 'PENDING',
          paymentMethod,
          appointmentId: id,
          patientId: appointment.patientId,
          professionalId: appointment.professionalId,
          installments: numInstallments,
          installmentIndex: i,
          installmentGroupId,
          dueDate,
        },
      });
      incomeTransactions.push(tx);
    }
    const incomeTransaction = incomeTransactions[0]; // para manter compatibilidade com a resposta
```

4. Update the response at the end to include installments:
```typescript
    return NextResponse.json({
      success: true,
      appointment: updated,
      transactions: {
        income: incomeTransaction,
        expense: expenseTransaction,
        installments: incomeTransactions,
      },
      inventory: updatedInventory,
      summary: {
        revenue: Number(appointment.price),
        cost: procedureCost,
        profit: Number(appointment.price) - procedureCost,
        installments: numInstallments,
      }
    });
```

**Step 4: Run tests to confirm they pass**

```bash
cd aura-backend && npx vitest run src/__tests__/api/pay-installments.test.ts
```
Expected: 5/5 PASS

**Step 5: Run full test suite**

```bash
cd aura-backend && npm run test:ci 2>&1 | tail -5
```
Expected: all tests passing

**Step 6: Commit**

```bash
cd aura-backend
git add src/app/api/appointments/\[id\]/pay/route.ts src/__tests__/api/pay-installments.test.ts
git commit -m "feat(pay): create N installment transactions for credit card payments"
```

---

### Task 5: Frontend CheckoutModal — Installment Selector UI

**Files:**
- Modify: `components/Modals.tsx` (lines 976–1006, `CheckoutModal`)

**Step 1: Update CheckoutModal to track installment count**

In `CheckoutModal`, after the existing `useState` hooks (lines 978–980), add:

```typescript
  const [installments, setInstallments] = useState(1);
```

Also update `handleComplete` to pass `installments`:

```typescript
  const handleComplete = async () => {
    setIsProcessing(true);
    try {
      await processPayment(appointment, method, installments);
      onClose();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      setIsProcessing(false);
    }
  };
```

Reset `installments` to 1 when method changes away from credit_card — add after the `setMethod` calls or as an effect. The cleanest way: replace the payment method `onClick`:

```typescript
onClick={() => { setMethod(m); if (m !== 'credit_card') setInstallments(1); }}
```

**Step 2: Add installment selector UI**

In the JSX, after the payment method grid (`</div>` that closes the `grid grid-cols-2 sm:grid-cols-4 gap-3` div), add:

```tsx
{method === 'credit_card' && (
  <div className="mt-4">
    <h4 className="font-bold text-slate-800 text-sm mb-3">Parcelamento</h4>
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
        <button
          key={n}
          onClick={() => setInstallments(n)}
          className={`py-2 rounded-xl border text-center text-xs font-bold transition-all ${
            installments === n
              ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500 ring-opacity-10 text-primary-700'
              : 'border-slate-200 hover:border-slate-300 text-slate-500'
          }`}
        >
          {n === 1 ? '1x' : `${n}x`}
          <div className="text-[10px] font-normal text-slate-400 mt-0.5">
            {formatCurrency(appointment.price / n)}
          </div>
        </button>
      ))}
    </div>
  </div>
)}
```

Note: `formatCurrency` is already imported in `Modals.tsx` from `../utils/format` or similar. Verify the import exists before adding.

**Step 3: Verify `formatCurrency` is available in Modals.tsx**

```bash
grep -n "formatCurrency" /c/Aura_System/components/Modals.tsx | head -5
```

If not imported, add to imports: `import { formatCurrency } from '../utils/format';` (adjust path as needed).

**Step 4: Verify TypeScript compilation**

```bash
cd /c/Aura_System && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors

**Step 5: Commit**

```bash
git add components/Modals.tsx
git commit -m "feat(checkout): add installment selector UI for credit card payments"
```

---

### Task 6: AppContext — processPayment Passes Installments + Handles Array Response

**Files:**
- Modify: `context/AppContext.tsx` (lines 1298–1348, `processPayment` function)

**Step 1: Update processPayment signature and installment transaction handling**

Change the function signature from:
```typescript
  const processPayment = async (appointment: Appointment, method: string) => {
```
to:
```typescript
  const processPayment = async (appointment: Appointment, method: string, installments = 1) => {
```

Change `appointmentsApi.processPayment(appointment.id, method)` to:
```typescript
  const response = await appointmentsApi.processPayment(appointment.id, method, installments);
```

Replace the income transaction handling block (lines 1308–1321) with:

```typescript
          // Handle installment transactions (array) or single transaction
          const installmentTxs = response.data?.transactions?.installments;
          if (installmentTxs && Array.isArray(installmentTxs) && installmentTxs.length > 0) {
            const newTxs = installmentTxs.map((tx: any) => ({
              id: tx.id,
              companyId: tx.companyId,
              date: tx.date,
              description: tx.description,
              amount: Number(tx.amount),
              type: 'income' as const,
              category: tx.category,
              status: tx.status === 'PAID' ? 'paid' : 'pending' as 'paid' | 'pending',
              appointmentId: tx.appointmentId,
              installments: tx.installments,
              installmentIndex: tx.installmentIndex,
              installmentGroupId: tx.installmentGroupId,
              dueDate: tx.dueDate,
            }));
            setTransactions(prev => [...prev, ...newTxs]);
          } else if (response.data?.transactions?.income) {
            const income = response.data.transactions.income;
            setTransactions(prev => [...prev, {
              id: income.id,
              companyId: income.companyId,
              date: income.date,
              description: income.description,
              amount: Number(income.amount),
              type: 'income',
              category: income.category,
              status: 'paid',
              appointmentId: income.appointmentId
            }]);
          }
```

**Step 2: Verify TypeScript compilation**

```bash
cd /c/Aura_System && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors

**Step 3: Commit**

```bash
git add context/AppContext.tsx
git commit -m "feat(context): handle installment transactions array from processPayment"
```

---

### Task 7: Financial Page — Installment KPI Card + Badges

**Files:**
- Modify: `pages/Financial.tsx`

**Step 1: Add `pendingInstallments` computed value**

In `Financial.tsx`, after the existing KPI computations (look for `totalRevenue`, `totalCost`, `balance`), add:

```typescript
  const pendingInstallments = useMemo(() => {
    return visibleTransactions
      .filter(t => t.type === 'income' && t.status === 'pending' && t.installmentGroupId)
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [visibleTransactions]);
```

**Step 2: Add KPI card to the grid**

At line 192, the grid is `grid-cols-3`. Change to `grid-cols-2 md:grid-cols-4` and add the new card:

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-2 lg:gap-4">
  <KPICard title="Receita Total" value={formatCurrency(totalRevenue)} icon={DollarSign} variant="success" size="sm" />
  <KPICard title="Custo Total" value={formatCurrency(totalCost)} icon={TrendingDown} variant="danger" size="sm" />
  <KPICard title="Saldo Atual" value={formatCurrency(balance)} icon={Wallet} variant={balance >= 0 ? 'primary' : 'danger'} size="sm" />
  <KPICard title="A Receber (Parcelas)" value={formatCurrency(pendingInstallments)} icon={CreditCard} variant="warning" size="sm" />
</div>
```

Verify `CreditCard` is already imported in Financial.tsx (it is, used in the payment methods section).

**Step 3: Add installment badge to transaction rows**

In the "Transação de procedimento" row (around line 280), in the `<td>` that shows the description, add a badge after `{displayDesc}`:

```tsx
<span className="font-medium text-slate-800 text-sm">{displayDesc}</span>
{income?.installmentGroupId && income.installments && income.installments > 1 && (
  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700">
    Parc. {income.installmentIndex}/{income.installments}
  </span>
)}
```

Also update the status cell for installment rows to show a pending badge when `status === 'pending'`:

The existing `<StatusBadge status={income?.status || expense?.status || 'paid'} type="financial" />` already handles this since we set `status: 'pending'` for future installments in AppContext.

**Step 4: Verify TypeScript compilation**

```bash
cd /c/Aura_System && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors

**Step 5: Commit**

```bash
git add pages/Financial.tsx
git commit -m "feat(financial): add pending installments KPI card and Parc. N/M badges"
```

---

### Task 8: Backend — PATCH /api/transactions/[id]/pay (Marcar Parcela como Paga)

**Files:**
- Create: `aura-backend/src/app/api/transactions/[id]/pay/route.ts`
- Test: `aura-backend/src/__tests__/api/transaction-pay.test.ts`

**Step 1: Write the failing test**

Create `aura-backend/src/__tests__/api/transaction-pay.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    transaction: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn().mockResolvedValue(null) }))

import { PATCH } from '../../app/api/transactions/[id]/pay/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const mockUser = { id: 'u1', companyId: 'c1', role: 'ADMIN' }

function makeReq() {
  return new NextRequest('http://localhost/api/transactions/tx1/pay', {
    method: 'PATCH',
    headers: { authorization: 'Bearer token' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(mockUser as never)
})

describe('PATCH /api/transactions/[id]/pay', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await PATCH(makeReq(), { params: Promise.resolve({ id: 'tx1' }) })
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando transação não existe', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    const res = await PATCH(makeReq(), { params: Promise.resolve({ id: 'tx1' }) })
    expect(res.status).toBe(404)
  })

  it('retorna 400 quando transação já está paga', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx1', status: 'PAID', companyId: 'c1',
    } as never)
    const res = await PATCH(makeReq(), { params: Promise.resolve({ id: 'tx1' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/já.*paga/i)
  })

  it('marca transação PENDING como PAID e retorna 200', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx1', status: 'PENDING', companyId: 'c1',
    } as never)
    vi.mocked(prisma.transaction.update).mockResolvedValue({
      id: 'tx1', status: 'PAID',
    } as never)
    const res = await PATCH(makeReq(), { params: Promise.resolve({ id: 'tx1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(vi.mocked(prisma.transaction.update).mock.calls[0][0].data.status).toBe('PAID')
  })

  it('não permite marcar transação de outra empresa', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null) // findFirst com companyId filtra
    const res = await PATCH(makeReq(), { params: Promise.resolve({ id: 'tx1' }) })
    expect(res.status).toBe(404)
  })
})
```

**Step 2: Run test to confirmar que falha**

```bash
cd aura-backend && npx vitest run src/__tests__/api/transaction-pay.test.ts
```
Expected: FAIL — módulo não encontrado

**Step 3: Criar a rota**

Criar `aura-backend/src/app/api/transactions/[id]/pay/route.ts`:

```typescript
// Aura System - Marcar parcela de installment como paga
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { checkWriteAccess } from '@/lib/apiGuards';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    const { id } = await params;

    const transaction = await prisma.transaction.findFirst({
      where: { id, companyId: user.companyId! },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 });
    }

    if (transaction.status === 'PAID') {
      return NextResponse.json({ error: 'Transação já está paga' }, { status: 400 });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: { status: 'PAID', date: new Date() },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Erro ao marcar parcela como paga:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
```

**Step 4: Run tests para confirmar que passam**

```bash
cd aura-backend && npx vitest run src/__tests__/api/transaction-pay.test.ts
```
Expected: 5/5 PASS

**Step 5: Commit**

```bash
cd aura-backend
git add src/app/api/transactions/\[id\]/pay/route.ts src/__tests__/api/transaction-pay.test.ts
git commit -m "feat(transactions): add PATCH endpoint to mark installment as paid"
```

---

### Task 9: Frontend — Botão "Receber" nas Parcelas Pendentes

**Files:**
- Modify: `services/api.ts`
- Modify: `context/AppContext.tsx`
- Modify: `pages/Financial.tsx`

**Step 1: Adicionar função na API**

Em `services/api.ts`, dentro do objeto `transactionsApi` (ou `appointmentsApi`), adicionar:

```typescript
  async markInstallmentPaid(transactionId: string) {
    return fetchApi<{ success: boolean; data: any }>(
      `/api/transactions/${transactionId}/pay`,
      { method: 'PATCH' }
    );
  },
```

**Step 2: Adicionar função no AppContext**

Em `context/AppContext.tsx`, adicionar a função `markInstallmentPaid` após `processPayment`:

```typescript
  const markInstallmentPaid = async (transactionId: string) => {
    checkWriteAccess();
    try {
      const response = await transactionsApi.markInstallmentPaid(transactionId);
      if (response.success) {
        setTransactions(prev =>
          prev.map(t => t.id === transactionId ? { ...t, status: 'paid' as const } : t)
        );
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      console.error('Erro ao marcar parcela como paga:', error);
      return { success: false, error: 'Erro de conexão' };
    }
  };
```

Expor no return do contexto: adicionar `markInstallmentPaid` ao objeto retornado e à interface do contexto.

**Step 3: Adicionar botão "Receber" na tabela do Financeiro**

Em `pages/Financial.tsx`:

1. Importar `markInstallmentPaid` do contexto.
2. Adicionar coluna de ação ao `<thead>`:
```tsx
<th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 text-center">Ação</th>
```
(mudar `colSpan={6}` para `colSpan={7}` no empty state)

3. Nas linhas de procedimento (grupo com `income`), adicionar célula de ação:
```tsx
<td className="px-6 py-4 text-center">
  {income?.installmentGroupId && income.status === 'pending' && !isReadOnly ? (
    <button
      onClick={async () => {
        await markInstallmentPaid(income.id);
      }}
      className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
    >
      Receber
    </button>
  ) : (
    <span className="text-slate-300 text-xs">—</span>
  )}
</td>
```

4. Nas linhas standalone (despesas avulsas), adicionar célula vazia:
```tsx
<td className="px-6 py-4 text-center"><span className="text-slate-300 text-xs">—</span></td>
```

**Step 4: Verificar TypeScript**

```bash
cd /c/Aura_System && npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Commit**

```bash
git add services/api.ts context/AppContext.tsx pages/Financial.tsx
git commit -m "feat(financial): add Receber button to mark pending installments as paid"
```

---

### Task 10: Deploy e Verificação Final

**Step 1: Run full backend test suite**

```bash
cd aura-backend && npm run test:ci 2>&1 | tail -10
```
Expected: all tests passing (including the ~5 new ones added)

**Step 2: Deploy backend**

```bash
cd aura-backend && vercel --prod --yes
```

**Step 3: Deploy frontend**

```bash
cd /c/Aura_System && vercel --prod --yes
```

**Step 4: Manual smoke test**
1. Go to `https://aura-system-mu.vercel.app/schedule`
2. Open a scheduled appointment → Checkout
3. Select "Cartão de Crédito" → verify installment grid appears (1x–12x)
4. Select 3x → verify each tile shows `R$ value/3`
5. Click "Finalizar e Receber"
6. Go to `/financial` → verify "A Receber (Parcelas)" KPI shows a value
7. Verify rows with `Parc. 1/3`, `Parc. 2/3`, `Parc. 3/3` badges appear
8. Verify `Parc. 2/3` and `Parc. 3/3` show "Pendente" status badge

**Step 5: Commit deploy evidence (optional)**

```bash
git add .
git commit -m "feat: installment payments complete — parcelamento cartão de crédito"
```
