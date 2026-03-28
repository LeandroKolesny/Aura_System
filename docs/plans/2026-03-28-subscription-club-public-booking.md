# Subscription Club — Public Booking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow clients to browse subscription plans ("Promoções") on the clinic's public site, book the first session, and manage remaining sessions via the patient portal.

**Architecture:** Add `imageUrl` to `SubscriptionPlan` schema; expose active plans in the public company API; extend `PublicBooking.tsx` with a "Promoções" section and a new procedure-selection step; create a public booking endpoint for plan-based appointments; add a "Meus Planos" section to the patient portal.

**Tech Stack:** Next.js 15 App Router (backend), React 19 + Vite (frontend), Prisma + PostgreSQL, TypeScript, Tailwind CSS, Zod validation.

**Repo layout:**
- Frontend root: `/c/Aura_System/`
- Backend root: `/c/Aura_System/aura-backend/`
- Run backend tests: `cd /c/Aura_System/aura-backend && npm run test:ci`
- Deploy frontend: `cd /c/Aura_System && vercel --prod --yes`
- Deploy backend: `cd /c/Aura_System/aura-backend && vercel --prod --yes`

---

## Task 1: Add `imageUrl` to SubscriptionPlan schema

**Files:**
- Modify: `aura-backend/prisma/schema.prisma` (line ~762, inside `model SubscriptionPlan`)

**Step 1: Add the field**

In `schema.prisma`, inside `model SubscriptionPlan`, add after `description String?`:

```prisma
imageUrl    String?
```

Result block:
```prisma
model SubscriptionPlan {
  id          String   @id @default(cuid())
  name        String
  price       Decimal  @db.Decimal(10, 2)
  description String?
  imageUrl    String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  company     Company               @relation(fields: [companyId], references: [id])
  companyId   String
  items       SubscriptionPlanItem[]
  subscribers PatientSubscription[]
  @@index([companyId])
  @@index([companyId, isActive])
  @@map("subscription_plans")
}
```

**Step 2: Push schema and regenerate client**

```bash
cd /c/Aura_System/aura-backend
npm run db:push
npm run db:generate
```

Expected: no errors, "Your database is now in sync with your Prisma schema."

**Step 3: Commit**

```bash
cd /c/Aura_System/aura-backend
git add prisma/schema.prisma
git commit -m "feat(schema): add imageUrl to SubscriptionPlan"
```

---

## Task 2: Update backend CRUD routes to handle imageUrl

**Files:**
- Modify: `aura-backend/src/app/api/subscriptions/plans/route.ts`
- Modify: `aura-backend/src/app/api/subscriptions/plans/[id]/route.ts`

### Task 2a: POST route (create plan)

In `route.ts`, update the body type and `prisma.subscriptionPlan.create`:

```typescript
const body = await request.json() as {
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  items: { procedureId: string; sessionsPerCycle: number }[];
};
const { name, price, description, imageUrl, items } = body;

// In prisma.create data:
const plan = await prisma.subscriptionPlan.create({
  data: {
    name,
    price,
    description: description ?? null,
    imageUrl: imageUrl ?? null,          // ADD THIS
    companyId: user.companyId!,
    items: {
      create: items.map((item) => ({
        procedureId: item.procedureId,
        sessionsPerCycle: item.sessionsPerCycle,
      })),
    },
  },
  include: {
    items: {
      include: { procedure: { select: { id: true, name: true, price: true } } },
    },
  },
});
```

### Task 2b: PUT route (update plan)

In `[id]/route.ts`, update body type and update data:

```typescript
const body = await request.json() as {
  name?: string;
  price?: number;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  items?: { procedureId: string; sessionsPerCycle: number }[];
};
const { name, price, description, imageUrl, isActive, items } = body;

// In prisma.update data, add after isActive spread:
...(imageUrl !== undefined ? { imageUrl } : {}),
```

**Step: Run tests**

```bash
cd /c/Aura_System/aura-backend && npm run test:ci
```

Expected: all tests pass.

**Step: Commit**

```bash
git add src/app/api/subscriptions/plans/route.ts src/app/api/subscriptions/plans/\[id\]/route.ts
git commit -m "feat(api): add imageUrl support to subscription plan CRUD"
```

---

## Task 3: Add subscription plans to public company API

**Files:**
- Modify: `aura-backend/src/app/api/public/company/[slug]/route.ts`

**Step 1: Query active plans with items after the procedures query**

After the `const procedures = await prisma.procedure.findMany(...)` block, add:

```typescript
// Buscar planos de assinatura ativos (para seção Promoções)
const subscriptionPlans = await prisma.subscriptionPlan.findMany({
  where: { companyId: company.id, isActive: true },
  select: {
    id: true,
    name: true,
    price: true,
    description: true,
    imageUrl: true,
    items: {
      include: {
        procedure: {
          select: { id: true, name: true, price: true, durationMinutes: true },
        },
      },
    },
  },
  orderBy: { createdAt: 'asc' },
});
```

**Step 2: Add to return JSON**

In the `return NextResponse.json({...})` call, add:

```typescript
subscriptionPlans: subscriptionPlans.map(p => ({
  ...p,
  price: Number(p.price),
  items: p.items.map(i => ({
    ...i,
    procedure: { ...i.procedure, price: Number(i.procedure.price) },
  })),
})),
```

**Step: Commit**

```bash
git add src/app/api/public/company/\[slug\]/route.ts
git commit -m "feat(api): include subscription plans in public company endpoint"
```

---

## Task 4: Update frontend types and api.ts

**Files:**
- Modify: `services/api.ts`

**Step 1: Add imageUrl to SubscriptionPlan interface**

```typescript
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;    // ADD THIS
  isActive: boolean;
  companyId: string;
  createdAt: string;
  items: SubscriptionPlanItem[];
  _count?: { subscribers: number };
}
```

**Step 2: Update createPlan and updatePlan signatures to accept imageUrl**

```typescript
async createPlan(data: {
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;           // ADD THIS
  items: { procedureId: string; sessionsPerCycle: number }[];
})

async updatePlan(id: string, data: {
  name?: string;
  price?: number;
  description?: string;
  imageUrl?: string;           // ADD THIS
  isActive?: boolean;
  items?: { procedureId: string; sessionsPerCycle: number }[];
})
```

**Step 3: Add publicBookSubscriptionPlan API method**

After the existing `subscriptionsApi` object, or inside it, add a new exported function (or add to existing `api` object at the bottom):

```typescript
export const publicBookingApi = {
  // existing methods...

  async bookSubscriptionPlan(data: {
    companyId: string;
    planId: string;
    procedureId: string;
    professionalId: string | null;
    date: string;
    patientInfo: { name: string; email: string; phone: string; password?: string };
  }) {
    return fetchApi<{ appointmentId: string; patientToken: string }>('/api/public/subscriptions/book', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
```

**Step: TypeScript check**

```bash
cd /c/Aura_System && npx tsc --noEmit
```

Expected: no errors.

**Step: Commit**

```bash
git add services/api.ts
git commit -m "feat(types): add imageUrl to SubscriptionPlan, add publicBookSubscriptionPlan"
```

---

## Task 5: Add image upload to SubscriptionPlanModal

**Files:**
- Modify: `components/SubscriptionPlanModal.tsx`

**Step 1: Add imageUrl state**

After the existing `const [error, setError] = useState<string | null>(null);` line, add:

```typescript
const [imageUrl, setImageUrl] = useState(plan?.imageUrl ?? '');
```

**Step 2: Add Upload icon import**

Add to the import line:
```typescript
import { X, Plus, Trash2, Loader2, Upload, Trash2 as TrashIcon } from 'lucide-react';
```
(or just add `Upload` to existing lucide-react import)

**Step 3: Add image upload UI**

After the description textarea block and before the items section, add:

```tsx
{/* Imagem do Plano */}
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">
    Imagem do Plano (opcional)
  </label>
  {!imageUrl ? (
    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-primary-400 transition-all">
      <Upload className="w-6 h-6 text-slate-400 mb-1" />
      <p className="text-sm text-slate-500"><span className="font-semibold text-primary-600">Clique para enviar</span></p>
      <p className="text-xs text-slate-400">PNG, JPG ou WEBP (max. 2MB)</p>
      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande. Máximo 2MB.'); return; }
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 800;
            let width = img.width, height = img.height;
            if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
            else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
            setImageUrl(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }} />
    </label>
  ) : (
    <div className="relative rounded-lg overflow-hidden h-32 bg-slate-100 group">
      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button type="button" onClick={() => setImageUrl('')} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium flex items-center gap-1">
          <Trash2 className="w-4 h-4" /> Remover
        </button>
      </div>
    </div>
  )}
</div>
```

**Step 4: Pass imageUrl in handleSave**

Find the `handleSave` / `handleSubmit` function where it calls `subscriptionsApi.createPlan` or `updatePlan`, and add `imageUrl` to the payload:

```typescript
// In create:
await subscriptionsApi.createPlan({ name, price: numPrice, description, imageUrl: imageUrl || undefined, items });

// In update:
await subscriptionsApi.updatePlan(plan.id, { name, price: numPrice, description, imageUrl: imageUrl || undefined, items });
```

**Step: TypeScript check**

```bash
npx tsc --noEmit
```

**Step: Commit**

```bash
git add components/SubscriptionPlanModal.tsx
git commit -m "feat(admin): add image upload to subscription plan modal"
```

---

## Task 6: Backend — public subscription booking endpoint

**Files:**
- Create: `aura-backend/src/app/api/public/subscriptions/book/route.ts`

**Step 1: Create the route**

```typescript
// aura-backend/src/app/api/public/subscriptions/book/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIP } from "@/lib/rateLimiter";
import { signToken } from "@/lib/auth";

const schema = z.object({
  companyId: z.string().cuid(),
  planId: z.string().cuid(),
  procedureId: z.string().cuid(),
  professionalId: z.string().cuid().nullable(),
  date: z.string().datetime(),
  patientInfo: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().min(8).max(20),
    password: z.string().min(8).max(100).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit(clientIP, "public_booking");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Muitas solicitações." }, { status: 429 });
    }

    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }

    const { companyId, planId, procedureId, professionalId, date, patientInfo } = validation.data;
    const { name, email, phone, password } = patientInfo;

    // Validate company
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

    // Validate plan belongs to company and is active
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, companyId, isActive: true },
      include: { items: true },
    });
    if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });

    // Validate procedureId is part of this plan
    const planItem = plan.items.find(i => i.procedureId === procedureId);
    if (!planItem) return NextResponse.json({ error: "Procedimento não pertence a este plano" }, { status: 400 });

    // Validate procedure
    const procedure = await prisma.procedure.findFirst({ where: { id: procedureId, companyId } });
    if (!procedure) return NextResponse.json({ error: "Procedimento não encontrado" }, { status: 404 });

    // Validate professional if provided
    if (professionalId) {
      const professional = await prisma.user.findFirst({ where: { id: professionalId, companyId } });
      if (!professional) return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
    }

    // Find or create patient
    let patient = await prisma.user.findFirst({ where: { email, companyId } });
    if (!patient) {
      const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash(Math.random().toString(36), 10);
      patient = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash: hashedPassword,
          role: "PATIENT",
          companyId,
          isActive: true,
          isEmailVerified: false,
        },
      });
    }

    // Create appointment (price = 0 because covered by subscription)
    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(date),
        durationMinutes: procedure.durationMinutes,
        status: "SCHEDULED",
        price: 0,
        patientId: patient.id,
        professionalId: professionalId ?? patient.id, // fallback
        procedureId,
        companyId,
        notes: `Agendamento via Plano: ${plan.name}`,
      },
    });

    // Find or create PatientSubscription for this plan
    let subscription = await prisma.patientSubscription.findFirst({
      where: { patientId: patient.id, planId, companyId, status: { in: ["ACTIVE", "PAUSED"] } },
    });

    if (!subscription) {
      const sessionsUsedThisCycle: Record<string, number> = {};
      for (const item of plan.items) {
        sessionsUsedThisCycle[item.procedureId] = 0;
      }
      subscription = await prisma.patientSubscription.create({
        data: {
          patientId: patient.id,
          planId,
          companyId,
          status: "ACTIVE",
          startDate: new Date(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          sessionsUsedThisCycle,
          lastCycleReset: new Date(),
        },
      });
    }

    // Generate token for patient
    const token = signToken({ userId: patient.id, companyId, role: patient.role });

    return NextResponse.json({
      success: true,
      appointmentId: appointment.id,
      patientToken: token,
    }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar agendamento de plano:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

**Step 2: Check that `signToken` is exported from `@/lib/auth`**

```bash
grep -n "export.*signToken\|export function signToken" /c/Aura_System/aura-backend/src/lib/auth.ts
```

If not exported, check the function name and adjust the import.

**Step 3: Run tests**

```bash
cd /c/Aura_System/aura-backend && npm run test:ci
```

Expected: all pass.

**Step 4: Commit**

```bash
git add src/app/api/public/subscriptions/book/route.ts
git commit -m "feat(api): public endpoint to book via subscription plan"
```

---

## Task 7: PublicBooking — "Promoções" section + plan booking flow

**Files:**
- Modify: `pages/PublicBooking.tsx`

This is the largest task. The flow adds:
- New state variables for plans and selected plan
- "Promoções" section rendered before procedures in Step 1
- New Step 1.5: procedure selection (when plan has 2+ items)
- On final submit: call `publicBookingApi.bookSubscriptionPlan` instead of existing booking when a plan is selected

**Step 1: Add state variables**

After `const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);`, add:

```typescript
const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
const [bookingMode, setBookingMode] = useState<'procedure' | 'plan'>('procedure');
```

Import `SubscriptionPlan` from `../services/api` (add to existing import line).

**Step 2: Load subscription plans from public API response**

In the `useEffect` where `setProcedures(procs)` is called (around line 82), also handle plans:

```typescript
const { company, procedures: procs, professionals: profs, appointments: appts, unavailabilityRules: rules, subscriptionPlans: plans } = response.data;
// ...
setSubscriptionPlans(plans ?? []);
```

Extend the destructuring of the API response type to include `subscriptionPlans`.

**Step 3: Add step labels and count**

The current step labels are `['Tratamento', 'Especialista', 'Horário', 'Seus dados']` with 4 steps.

Change the step structure to support a conditional step 1.5 (procedure selection within plan). Use a computed `stepLabel` and `totalSteps`:

```typescript
const isMultiProcPlan = selectedPlan && selectedPlan.items.length > 1;
const stepLabels = bookingMode === 'plan' && isMultiProcPlan
  ? ['Promoção', 'Procedimento', 'Especialista', 'Horário', 'Seus dados']
  : bookingMode === 'plan'
  ? ['Promoção', 'Especialista', 'Horário', 'Seus dados']
  : ['Tratamento', 'Especialista', 'Horário', 'Seus dados'];
const totalSteps = stepLabels.length;
```

**Step 4: Add "Promoções" section inside Step 1 rendering**

In the `{step === 1 && ...}` block, BEFORE the procedures list, add:

```tsx
{subscriptionPlans.length > 0 && (
  <div className="mb-10">
    <h2 className="text-xl font-bold mb-4" style={headingStyle}>Promoções</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {subscriptionPlans.map(plan => (
        <div
          key={plan.id}
          onClick={() => {
            setSelectedPlan(plan);
            setBookingMode('plan');
            if (plan.items.length === 1) {
              // Auto-select the only procedure
              setSelectedProcedure({
                id: plan.items[0].procedure.id,
                name: plan.items[0].procedure.name,
                price: 0, // covered by plan
                durationMinutes: plan.items[0].procedure.durationMinutes,
              } as Procedure);
              setStep(2);
            } else {
              // Show procedure selection step
              setStep(1); // stays on 1 but shows procedure picker below
              // We use a sub-state: selectedPlan is set, step is still 1
              // The UI checks selectedPlan && step === 1 to show procedure picker
            }
          }}
          className="group relative overflow-hidden rounded-2xl h-48 border shadow-xl cursor-pointer bg-black/40 transition-all duration-500 hover:shadow-primary-500/20"
        >
          {plan.imageUrl && (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10 group-hover:from-black/70 transition-all" />
              <img src={plan.imageUrl} alt={plan.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s]" />
            </>
          )}
          <div className={`absolute inset-0 z-20 p-5 flex flex-col justify-end ${plan.imageUrl ? '' : 'bg-gradient-to-br from-primary-600 to-primary-800'}`}>
            <span className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">Clube de Assinaturas</span>
            <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
            {plan.description && <p className="text-xs text-white/70 line-clamp-2 mb-2">{plan.description}</p>}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{formatCurrency(plan.price)}/mês</span>
              <span className="text-xs bg-white/20 backdrop-blur-sm text-white px-2 py-1 rounded-full">
                {plan.items.reduce((s, i) => s + i.sessionsPerCycle, 0)} sessões
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
    {subscriptionPlans.length > 0 && (
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs uppercase tracking-widest opacity-50">ou escolha um procedimento avulso</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
    )}
  </div>
)}
```

**Step 5: Add procedure selection screen when plan has multiple items**

After the procedures list, OUTSIDE the step 1 block but before step 2, add a new block. Change the logic: use a derived "effective step" that inserts a step when `selectedPlan && selectedPlan.items.length > 1 && !selectedProcedure`:

The cleanest approach is to track this with a separate state flag `showPlanProcedurePicker`. When the user clicks a multi-proc plan:

```typescript
const [showPlanProcedurePicker, setShowPlanProcedurePicker] = useState(false);
```

When clicking multi-proc plan: `setShowPlanProcedurePicker(true)` instead of `setStep(2)`.

Render it as:

```tsx
{showPlanProcedurePicker && selectedPlan && (
  <div className="...">
    <h2 ...>Você escolheu: <strong>{selectedPlan.name}</strong></h2>
    <p ...>Qual procedimento deseja agendar na sua 1ª consulta?</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
      {selectedPlan.items.map(item => (
        <div
          key={item.procedure.id}
          onClick={() => {
            setSelectedProcedure({
              id: item.procedure.id,
              name: item.procedure.name,
              price: 0,
              durationMinutes: item.procedure.durationMinutes,
            } as Procedure);
            setShowPlanProcedurePicker(false);
            setStep(2);
          }}
          className="p-5 rounded-2xl border shadow-lg cursor-pointer hover:border-primary-400 transition-all glass-card"
          style={cardStyle}
        >
          <h3 className="font-bold text-lg" style={{ color: cardTxtColor }}>{item.procedure.name}</h3>
          <p className="text-sm opacity-60 mt-1">{item.sessionsPerCycle} sessão(ões) por mês</p>
        </div>
      ))}
    </div>
    <button onClick={() => { setShowPlanProcedurePicker(false); setSelectedPlan(null); setBookingMode('procedure'); }} className="mt-6 text-sm opacity-60 hover:opacity-100">
      ← Voltar
    </button>
  </div>
)}
```

Replace the main content render with: show `showPlanProcedurePicker` screen OR the normal step-based flow.

**Step 6: Update the booking submit handler**

Find `handleBooking` / the submit function (around line 287). Add a branch:

```typescript
if (bookingMode === 'plan' && selectedPlan) {
  const result = await publicBookingApi.bookSubscriptionPlan({
    companyId: companyId!,
    planId: selectedPlan.id,
    procedureId: selectedProcedure!.id,
    professionalId: selectedProfessional?.id ?? null,
    date: selectedTimeSlot!,
    patientInfo: { name: patientData.name, email: patientData.email, phone: patientData.phone, password: patientData.password },
  });
  if (result.success && result.data?.patientToken) {
    // Store token so patient can access portal
    localStorage.setItem('patientToken', result.data.patientToken);
    setStep(5); // confirmation step
  }
} else {
  // existing booking logic
}
```

**Step 7: TypeScript check**

```bash
cd /c/Aura_System && npx tsc --noEmit
```

**Step 8: Commit**

```bash
git add pages/PublicBooking.tsx
git commit -m "feat(public): add Promoções section and subscription plan booking flow"
```

---

## Task 8: Patient Portal — "Meus Planos" section

**Files:**
- Create: `pages/patient-portal/PatientPlans.tsx`
- Modify: `apps/PatientPortalApp.tsx`
- Modify: `components/patient-portal/PatientSidebar.tsx`

**Step 1: Add API call for patient subscriptions**

In `services/api.ts`, check that `subscriptionsApi.listPatientSubscriptions()` exists. If not, add:

```typescript
async listMySubscriptions() {
  return fetchApi<PatientSubscription[]>('/api/subscriptions/patients/my');
},
```

On backend create `aura-backend/src/app/api/subscriptions/patients/my/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const subscriptions = await prisma.patientSubscription.findMany({
    where: { patientId: user.userId, companyId: user.companyId! },
    include: {
      plan: {
        include: {
          items: {
            include: { procedure: { select: { id: true, name: true, durationMinutes: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json({ success: true, data: subscriptions });
}
```

**Step 2: Create PatientPlans.tsx page**

```tsx
// pages/patient-portal/PatientPlans.tsx
import React, { useEffect, useState } from 'react';
import { subscriptionsApi, PatientSubscription } from '../../services/api';
import { Calendar, CheckCircle } from 'lucide-react';

const PatientPlans: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<PatientSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscriptionsApi.listPatientSubscriptions?.()
      .then(res => { if (res.success && res.data) setSubscriptions(res.data as PatientSubscription[]); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (subscriptions.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
      <p>Você não possui planos ativos.</p>
    </div>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Meus Planos</h1>
      {subscriptions.map(sub => {
        const used = sub.sessionsUsedThisCycle ?? {};
        return (
          <div key={sub.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{sub.plan.name}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sub.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {sub.status === 'ACTIVE' ? 'Ativo' : sub.status}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {sub.plan.items.map(item => {
                const sessionsUsed = used[item.procedureId] ?? 0;
                const total = item.sessionsPerCycle;
                const remaining = Math.max(0, total - sessionsUsed);
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-medium text-slate-800">{item.procedure.name}</p>
                      <p className="text-xs text-slate-500">{remaining} de {total} sessões restantes este mês</p>
                    </div>
                    {remaining > 0 ? (
                      <a href={window.location.pathname.replace('/plans', '')} className="text-xs font-bold px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                        Agendar
                      </a>
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PatientPlans;
```

**Step 3: Add route in PatientPortalApp.tsx**

Import `PatientPlans` and add a route:

```tsx
import PatientPlans from '../pages/patient-portal/PatientPlans';
// In the <Routes> block:
<Route path="plans" element={<PatientPlans />} />
```

**Step 4: Add "Meus Planos" link to PatientSidebar**

```bash
grep -n "Schedule\|History\|link\|href" /c/Aura_System/components/patient-portal/PatientSidebar.tsx | head -10
```

Add a nav item pointing to `plans`.

**Step 5: TypeScript check**

```bash
cd /c/Aura_System && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add pages/patient-portal/PatientPlans.tsx apps/PatientPortalApp.tsx components/patient-portal/PatientSidebar.tsx
git commit -m "feat(portal): add Meus Planos section to patient portal"
```

---

## Task 9: Deploy

**Step 1: Deploy backend**

```bash
cd /c/Aura_System/aura-backend && vercel --prod --yes 2>&1 | grep -E "Aliased|Error"
```

**Step 2: Deploy frontend**

```bash
cd /c/Aura_System && vercel --prod --yes 2>&1 | grep -E "Aliased|Error"
```

**Step 3: Smoke test**

1. Open `https://aura-system-mu.vercel.app/clinica-aura`
2. Verify "Promoções" section appears (requires at least one active plan with the admin)
3. Click a plan → verify procedure picker appears (if multi-proc) or goes straight to professional selection
4. Complete a booking → verify appointment created in admin panel
5. Open patient portal → verify "Meus Planos" shows the subscription

---

## Summary of files changed

| File | Change |
|------|--------|
| `aura-backend/prisma/schema.prisma` | Add `imageUrl` to SubscriptionPlan |
| `aura-backend/src/app/api/subscriptions/plans/route.ts` | Accept/return imageUrl |
| `aura-backend/src/app/api/subscriptions/plans/[id]/route.ts` | Accept imageUrl in update |
| `aura-backend/src/app/api/public/company/[slug]/route.ts` | Include subscriptionPlans |
| `aura-backend/src/app/api/public/subscriptions/book/route.ts` | **NEW** public booking endpoint |
| `aura-backend/src/app/api/subscriptions/patients/my/route.ts` | **NEW** patient's own subscriptions |
| `services/api.ts` | imageUrl on type, publicBookSubscriptionPlan method |
| `components/SubscriptionPlanModal.tsx` | Image upload UI |
| `pages/PublicBooking.tsx` | Promoções section + plan booking flow |
| `pages/patient-portal/PatientPlans.tsx` | **NEW** Meus Planos page |
| `apps/PatientPortalApp.tsx` | Add plans route |
| `components/patient-portal/PatientSidebar.tsx` | Add Meus Planos nav item |
