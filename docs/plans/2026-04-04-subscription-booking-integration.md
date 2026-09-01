# Subscription Booking Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate subscription plans into both the patient portal booking flow and the admin appointment modal, with real-time pending plan alerts in the sidebar and dashboard.

**Architecture:** Plans appear as "Promoção [Nome]" entries in procedure lists on both sides. Logged-in patients see their session counts and can book with plan deduction. Admins see banners when a patient has a plan covering the selected procedure. Pending subscriptions surface in sidebar badge, dashboard block, and a new Subscriptions tab.

**Tech Stack:** Next.js 15 App Router (backend), React + Vite (frontend), Prisma + PostgreSQL, React Context, Tailwind CDN

---

## Task 1: Backend — Fix PENDING in patients route type

**Files:**
- Modify: `aura-backend/src/app/api/subscriptions/patients/route.ts`

The status type-cast on line 18 doesn't include PENDING, so `?status=PENDING` queries silently return nothing.

**Step 1: Fix the type cast**

In the `GET` handler, find:
```typescript
...(status ? { status: status as "ACTIVE" | "PAUSED" | "CANCELED" | "OVERDUE" } : {}),
```
Replace with:
```typescript
...(status ? { status: status as "ACTIVE" | "PAUSED" | "CANCELED" | "OVERDUE" | "PENDING" } : {}),
```

**Step 2: Also add `startDate` and `createdAt` to the select for the pending tab UI**

Find the `include` block and confirm `createdAt` is returned. The subscription model already has `createdAt` so it's returned by default.

**Step 3: Verify by running the backend locally**
```bash
cd aura-backend && npm run dev
# In another terminal:
curl "http://localhost:3001/api/subscriptions/patients?status=PENDING" -H "Authorization: Bearer <token>"
```
Expected: returns array (empty is fine, confirms no 500 error).

**Step 4: Commit**
```bash
git add aura-backend/src/app/api/subscriptions/patients/route.ts
git commit -m "fix(subscriptions): include PENDING in patients status filter"
```

---

## Task 2: Backend — PATCH activate endpoint

**Files:**
- Create: `aura-backend/src/app/api/subscriptions/patients/[id]/activate/route.ts`

**Step 1: Create the file**

```typescript
// PATCH /api/subscriptions/patients/[id]/activate
// Admin activates a PENDING subscription (and confirms its linked appointment if any)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    const subscription = await prisma.patientSubscription.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!subscription) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }
    if (subscription.status !== "PENDING") {
      return NextResponse.json({ error: "Assinatura não está pendente" }, { status: 400 });
    }

    // Activate subscription
    const updated = await prisma.patientSubscription.update({
      where: { id },
      data: { status: "ACTIVE", startDate: new Date() },
      include: {
        patient: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    // Confirm the linked pending_approval appointment if it exists
    await prisma.appointment.updateMany({
      where: {
        subscriptionId: id,
        companyId: user.companyId,
        status: "PENDING_APPROVAL",
      },
      data: { status: "SCHEDULED" },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Erro ao ativar assinatura:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

**Step 2: Test locally**
```bash
curl -X PATCH "http://localhost:3001/api/subscriptions/patients/<id>/activate" \
  -H "Authorization: Bearer <admin_token>"
```
Expected: `{ "success": true, "data": { ... } }`

**Step 3: Commit**
```bash
git add aura-backend/src/app/api/subscriptions/patients/[id]/activate/route.ts
git commit -m "feat(subscriptions): add PATCH activate endpoint for admin approval"
```

---

## Task 3: Backend — patientId filter in subscriptions list + session deduction for patient role

**Files:**
- Modify: `aura-backend/src/app/api/subscriptions/patients/route.ts`
- Modify: `aura-backend/src/app/api/appointments/route.ts`

**Step 1: Add patientId filter to GET /api/subscriptions/patients**

In `route.ts`, after `const status = searchParams.get("status") ?? undefined;`, add:
```typescript
const patientId = searchParams.get("patientId") ?? undefined;
```

In the `where` clause:
```typescript
where: {
  companyId: user.companyId,
  ...(status ? { status: status as "ACTIVE" | "PAUSED" | "CANCELED" | "OVERDUE" | "PENDING" } : {}),
  ...(patientId ? { patientId } : {}),
},
```

**Step 2: Fix session deduction for PATIENT role in appointments route**

In `aura-backend/src/app/api/appointments/route.ts`, find:
```typescript
if (!isPatient) {
  // Só staff inicia cobertura de assinatura (paciente usa agendamento normal)
  const activeSubscription = await prisma.patientSubscription.findFirst({
    where: { patientId, companyId: user.companyId!, status: "ACTIVE" },
```

The `isPatient` guard prevents plan deduction when a patient books directly. We need to look up the patient record for patient users and also apply deduction.

Replace the entire `// ── Clube de Assinaturas: verificar cobertura ──` block (lines ~318-362) with:

```typescript
// ── Clube de Assinaturas: verificar cobertura ──
let subscriptionCoverage: {
  covered: boolean;
  subscriptionId: string | null;
  sessionsRemaining: number;
  warning?: string;
} = { covered: false, subscriptionId: null, sessionsRemaining: 0 };

// For patient role, resolve their patientId from their email
let resolvedPatientId = patientId;
if (isPatient) {
  const patientRecord = await prisma.patient.findFirst({
    where: { email: user.email, companyId: user.companyId },
    select: { id: true },
  });
  if (patientRecord) resolvedPatientId = patientRecord.id;
}

const activeSubscription = await prisma.patientSubscription.findFirst({
  where: { patientId: resolvedPatientId, companyId: user.companyId!, status: "ACTIVE" },
  include: { plan: { include: { items: true } } },
});

if (activeSubscription) {
  const planItem = activeSubscription.plan.items.find(
    (item) => item.procedureId === procedureId
  );

  if (planItem) {
    const sessionsUsed =
      (activeSubscription.sessionsUsedThisCycle as Record<string, number>)[procedureId] ?? 0;
    const sessionsRemaining = planItem.sessionsPerCycle - sessionsUsed;

    if (sessionsRemaining > 0) {
      subscriptionCoverage = {
        covered: true,
        subscriptionId: activeSubscription.id,
        sessionsRemaining: sessionsRemaining - 1,
      };
      price = 0;
    } else {
      subscriptionCoverage = {
        covered: false,
        subscriptionId: activeSubscription.id,
        sessionsRemaining: 0,
        warning: `Sessões do plano esgotadas para ${procedure.name} neste ciclo. Agendamento cobrado normalmente.`,
      };
    }
  }
}
// ── fim verificação de assinatura ──
```

Also update the appointment creation to use `resolvedPatientId`:
```typescript
const appointment = await prisma.appointment.create({
  data: {
    companyId: user.companyId,
    patientId: resolvedPatientId,  // was: patientId
    ...
  },
```

And update the subscription deduction block to use `resolvedPatientId`:
```typescript
if (subscriptionCoverage.covered && subscriptionCoverage.subscriptionId) {
```
(This block doesn't reference patientId directly so no change needed.)

**Step 3: Commit**
```bash
git add aura-backend/src/app/api/subscriptions/patients/route.ts
git add aura-backend/src/app/api/appointments/route.ts
git commit -m "feat(subscriptions): patientId filter + plan deduction for patient role in appointments"
```

---

## Task 4: Frontend — services/api.ts updates

**Files:**
- Modify: `services/api.ts` (lines 867-908)

**Step 1: Add PENDING to PatientSubscription type**

Find:
```typescript
status: 'ACTIVE' | 'PAUSED' | 'CANCELED' | 'OVERDUE';
```
Replace with:
```typescript
status: 'ACTIVE' | 'PAUSED' | 'CANCELED' | 'OVERDUE' | 'PENDING';
startDate: string | null;
createdAt: string;
```

**Step 2: Add `activate` and `listPending` methods to subscriptionsApi**

After the existing `cancel` method, add:
```typescript
async activate(subscriptionId: string) {
  return fetchApi<PatientSubscription>(`/api/subscriptions/patients/${subscriptionId}/activate`, { method: 'PATCH' });
},
async listPending() {
  return fetchApi<PatientSubscription[]>('/api/subscriptions/patients?status=PENDING');
},
async listForPatient(patientId: string) {
  return fetchApi<PatientSubscription[]>(`/api/subscriptions/patients?patientId=${patientId}`);
},
```

**Step 3: Commit**
```bash
git add services/api.ts
git commit -m "feat(api): add activate, listPending, listForPatient to subscriptionsApi"
```

---

## Task 5: Frontend — AppContext pending subscriptions count

**Files:**
- Modify: `context/AppContext.tsx`

**Step 1: Add state and type**

Find the `interface AppContextType` block (line ~31) and add:
```typescript
pendingSubscriptionsCount: number;
loadPendingSubscriptions: () => Promise<void>;
```

**Step 2: Add state variable**

Near the other `useState` declarations (line ~186), add:
```typescript
const [pendingSubscriptionsCount, setPendingSubscriptionsCount] = useState(0);
```

**Step 3: Add load function**

After the `loadProcedures` function or near other load functions, add:
```typescript
const loadPendingSubscriptions = useCallback(async () => {
  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER)) return;
  try {
    const res = await subscriptionsApi.listPending();
    if (res.success && res.data) {
      setPendingSubscriptionsCount(res.data.length);
    }
  } catch { /* silent */ }
}, [user]);
```

**Step 4: Add polling + initial load**

Find the main `useEffect` that loads initial data (look for `loadAppointments` or `loadPatients` calls in useEffect). Add a polling setup near the bottom of `AppProvider`:

```typescript
// Pending subscriptions polling
useEffect(() => {
  loadPendingSubscriptions();
  const interval = setInterval(loadPendingSubscriptions, 60_000);
  return () => clearInterval(interval);
}, [loadPendingSubscriptions]);
```

**Step 5: Expose in context value**

Find the `<AppContext.Provider value={{` block (~line 2025) and add:
```typescript
pendingSubscriptionsCount,
loadPendingSubscriptions,
```

**Step 6: Verify it compiles**
```bash
cd aura-backend && npm run build 2>&1 | tail -5
# (check frontend)
npm run build 2>&1 | tail -10
```

**Step 7: Commit**
```bash
git add context/AppContext.tsx
git commit -m "feat(context): add pendingSubscriptionsCount with 60s polling"
```

---

## Task 6: Frontend — Sidebar badge on "Clube de Assinaturas"

**Files:**
- Modify: `components/Sidebar.tsx`

**Step 1: Import pendingSubscriptionsCount from context**

Find `const { user, ... } = useApp();` at the top of the Sidebar component and add `pendingSubscriptionsCount` to the destructure:
```typescript
const { user, currentCompany, logout, pendingSubscriptionsCount } = useApp();
```

**Step 2: Update the nav item render to show badge**

Find the nav item render block (line ~208). The current render is:
```tsx
<item.icon className={...} />
<span className="tracking-wide text-[13px]">{item.label}</span>
```

Replace with:
```tsx
<item.icon className={`w-4 h-4 lg:w-4 lg:h-4 flex-shrink-0 transition-colors ${
  active
    ? (isPatient ? '' : 'text-white')
    : item.path === '/subscriptions' && pendingSubscriptionsCount > 0
      ? 'text-amber-400'
      : (isPatient ? 'text-white/60 group-hover:text-white' : 'text-secondary-500 group-hover:text-secondary-300')
}`} />
<span className={`tracking-wide text-[13px] flex-1 ${
  !active && item.path === '/subscriptions' && pendingSubscriptionsCount > 0
    ? 'text-amber-400'
    : ''
}`}>{item.label}</span>
{item.path === '/subscriptions' && pendingSubscriptionsCount > 0 && (
  <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
    {pendingSubscriptionsCount}
  </span>
)}
```

**Step 3: Verify visually** — open app locally, confirm badge appears when there are pending subscriptions.

**Step 4: Commit**
```bash
git add components/Sidebar.tsx
git commit -m "feat(sidebar): amber badge on Clube de Assinaturas when subscriptions pending"
```

---

## Task 7: Frontend — Dashboard pending plans block

**Files:**
- Modify: `pages/Dashboard.tsx`

**Step 1: Import pendingSubscriptionsCount + subscriptionsApi**

At the top of `Dashboard.tsx`, find the imports. Add `subscriptionsApi, PatientSubscription` to the api import if not already there. Also import `CreditCard` icon from lucide if not present.

**Step 2: Add pending plans state**

In the `ClinicDashboard` component, after the existing `pendingApprovals` useMemo, add:
```typescript
const [pendingPlans, setPendingPlans] = useState<PatientSubscription[]>([]);
const [activatingPlanId, setActivatingPlanId] = useState<string | null>(null);

useEffect(() => {
  subscriptionsApi.listPending().then(res => {
    if (res.success && res.data) setPendingPlans(res.data);
  });
}, []);
```

**Step 3: Add handleActivatePlan function**
```typescript
const handleActivatePlan = async (subscriptionId: string) => {
  setActivatingPlanId(subscriptionId);
  const res = await subscriptionsApi.activate(subscriptionId);
  if (res.success) {
    setPendingPlans(prev => prev.filter(p => p.id !== subscriptionId));
  }
  setActivatingPlanId(null);
};

const handleCancelPlan = async (subscriptionId: string) => {
  const res = await subscriptionsApi.cancel(subscriptionId);
  if (res.success) {
    setPendingPlans(prev => prev.filter(p => p.id !== subscriptionId));
  }
};
```

**Step 4: Add the pending plans block in JSX**

Find the existing `{pendingApprovals.length > 0 && (` block in the JSX. After the closing `)}` of that block, add:

```tsx
{pendingPlans.length > 0 && (
  <div className="bg-purple-50 border border-purple-200 rounded-2xl overflow-hidden animate-fade-in">
    <div className="flex items-center justify-between px-4 py-3 border-b border-purple-100">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
        <span className="text-sm font-semibold text-purple-800">Novos Planos para Aprovação</span>
        <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-full">{pendingPlans.length}</span>
      </div>
      <span className="text-xs text-purple-600 font-medium hidden sm:block">Planos de assinatura</span>
    </div>
    <div className="divide-y divide-purple-100 max-h-72 overflow-y-auto">
      {pendingPlans.map((sub) => (
        <div key={sub.id} className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0">
            {sub.patient.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{sub.patient.name}</p>
            <p className="text-xs text-slate-500 truncate">
              Promoção {sub.plan.name} · Solicitado {new Date(sub.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleCancelPlan(sub.id)}
              className="min-h-[44px] px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-colors"
            >
              Recusar
            </button>
            <button
              onClick={() => handleActivatePlan(sub.id)}
              disabled={activatingPlanId === sub.id}
              className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-white bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {activatingPlanId === sub.id ? 'Ativando...' : 'Ativar'}
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 5: Commit**
```bash
git add pages/Dashboard.tsx
git commit -m "feat(dashboard): add pending subscription plans approval block"
```

---

## Task 8: Frontend — Subscriptions.tsx Pendentes tab

**Files:**
- Modify: `pages/Subscriptions.tsx`

**Step 1: Add PENDING to STATUS_CONFIG**

Find:
```typescript
const STATUS_CONFIG: Record<PatientSubscription['status'], ...> = {
  ACTIVE:   ...
  PAUSED:   ...
  CANCELED: ...
  OVERDUE:  ...
};
```
Add:
```typescript
PENDING:  { label: 'Pendente',   badge: 'bg-purple-50 text-purple-700 border-purple-200' },
```

**Step 2: Add pendingSubscriptions state**

In the main component, near the existing `useState` declarations, add:
```typescript
const [pendingSubscriptions, setPendingSubscriptions] = useState<PatientSubscription[]>([]);
const [activatingId, setActivatingId] = useState<string | null>(null);
```

**Step 3: Fetch pending on mount and after actions**

In the `loadData` function (or wherever subscribers are fetched), also fetch pending:
```typescript
const pendingRes = await subscriptionsApi.listPending();
if (pendingRes.success && pendingRes.data) setPendingSubscriptions(pendingRes.data);
```

**Step 4: Update tab definitions**

Find the tabs array/render (line ~255-265):
```tsx
{(['plans', 'subscribers'] as const).map((tab) => (
```

Change to support 3 tabs. Replace the entire tabs section with:
```tsx
<div className="flex gap-1 bg-slate-100 rounded-xl p-1">
  {(['plans', 'subscribers', 'pending'] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {tab === 'plans' && <><CreditCard className="w-4 h-4" /> Planos</>}
      {tab === 'subscribers' && <><Users className="w-4 h-4" /> Assinantes</>}
      {tab === 'pending' && (
        <>
          <Clock className="w-4 h-4" />
          Pendentes
          {pendingSubscriptions.length > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
              {pendingSubscriptions.length}
            </span>
          )}
        </>
      )}
    </button>
  ))}
</div>
```

Update the `activeTab` type: `useState<'plans' | 'subscribers' | 'pending'>('plans')`

**Step 5: Add KPI card for pendentes**

Find the KPI cards grid. Add a 4th card:
```tsx
<KPICard
  icon={Clock}
  label="Pendentes"
  value={pendingSubscriptions.length}
  color="bg-amber-100 text-amber-700"
/>
```

**Step 6: Add the Pendentes tab content**

After the `{activeTab === 'subscribers' && (` block closing `)}`, add:
```tsx
{activeTab === 'pending' && (
  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
    {pendingSubscriptions.length === 0 ? (
      <div className="p-12 text-center">
        <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Nenhum plano pendente</p>
      </div>
    ) : (
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider">Paciente</th>
            <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider hidden md:table-cell">Plano</th>
            <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider hidden lg:table-cell">Solicitado em</th>
            <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pendingSubscriptions.map(sub => (
            <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-5 py-4">
                <p className="font-semibold text-slate-800">{sub.patient.name}</p>
                <p className="text-xs text-slate-500">{sub.patient.email}</p>
              </td>
              <td className="px-5 py-4 hidden md:table-cell">
                <span className="font-medium text-purple-700">Promoção {sub.plan.name}</span>
              </td>
              <td className="px-5 py-4 text-slate-500 hidden lg:table-cell">
                {new Date(sub.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const res = await subscriptionsApi.cancel(sub.id);
                      if (res.success) setPendingSubscriptions(prev => prev.filter(s => s.id !== sub.id));
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                  >
                    Recusar
                  </button>
                  <button
                    onClick={async () => {
                      setActivatingId(sub.id);
                      const res = await subscriptionsApi.activate(sub.id);
                      if (res.success) setPendingSubscriptions(prev => prev.filter(s => s.id !== sub.id));
                      setActivatingId(null);
                    }}
                    disabled={activatingId === sub.id}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {activatingId === sub.id ? 'Ativando...' : 'Ativar Plano'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
)}
```

**Step 7: Commit**
```bash
git add pages/Subscriptions.tsx
git commit -m "feat(subscriptions): add Pendentes tab with activate/cancel actions"
```

---

## Task 9: Frontend — PlanProcedurePickerModal component

**Files:**
- Create: `components/patient-portal/PlanProcedurePickerModal.tsx`

This modal opens when a patient selects a plan with 2+ procedures. They pick which ones to do in this session.

```tsx
// components/patient-portal/PlanProcedurePickerModal.tsx
import React, { useState } from 'react';
import { X, CheckCircle, Sparkles } from 'lucide-react';

interface PlanItem {
  procedureId: string;
  procedureName: string;
  sessionsPerCycle: number;
  sessionsRemaining: number; // -1 if unknown (plan not yet active)
}

interface Props {
  planName: string;
  items: PlanItem[];
  primaryColor: string;
  cardBg: string;
  cardText: string;
  borderColor: string;
  onConfirm: (selectedProcedureIds: string[]) => void;
  onClose: () => void;
}

export const PlanProcedurePickerModal: React.FC<Props> = ({
  planName, items, primaryColor, cardBg, cardText, borderColor, onConfirm, onClose,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const availableItems = items.filter(i => i.sessionsRemaining !== 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
            <h2 className="text-lg font-bold" style={{ color: cardText }}>Promoção {planName}</h2>
          </div>
          <p className="text-sm opacity-60 mb-5" style={{ color: cardText }}>
            Quais procedimentos deseja fazer nesta sessão?
          </p>

          <div className="space-y-2 mb-6">
            {items.map(item => {
              const isSelected = selected.has(item.procedureId);
              const noSessions = item.sessionsRemaining === 0;
              return (
                <button
                  key={item.procedureId}
                  onClick={() => !noSessions && toggle(item.procedureId)}
                  disabled={noSessions}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                    noSessions ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
                  }`}
                  style={{
                    borderColor: isSelected ? primaryColor : borderColor,
                    backgroundColor: isSelected ? `${primaryColor}15` : 'transparent',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-all"
                    style={{
                      borderColor: isSelected ? primaryColor : borderColor,
                      backgroundColor: isSelected ? primaryColor : 'transparent',
                    }}
                  >
                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <span className="flex-1 font-medium text-sm" style={{ color: cardText }}>
                    {item.procedureName}
                  </span>
                  <span className="text-xs opacity-60" style={{ color: cardText }}>
                    {item.sessionsRemaining === -1
                      ? `${item.sessionsPerCycle}x/mês`
                      : noSessions
                        ? 'Sem sessões'
                        : `${item.sessionsRemaining} restante${item.sessionsRemaining !== 1 ? 's' : ''}`
                    }
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors hover:opacity-70"
              style={{ color: cardText, borderColor }}
            >
              Cancelar
            </button>
            <button
              onClick={() => selected.size > 0 && onConfirm(Array.from(selected))}
              disabled={selected.size === 0}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: primaryColor }}
            >
              Confirmar ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Commit**
```bash
git add components/patient-portal/PlanProcedurePickerModal.tsx
git commit -m "feat(patient-portal): add PlanProcedurePickerModal for multi-procedure plan selection"
```

---

## Task 10: Frontend — PublicBooking.tsx patient plan integration

**Files:**
- Modify: `pages/PublicBooking.tsx`

This is the biggest change. Goal: when logged-in patient is on booking page, fetch their subscriptions, hide covered procedures, show "Promoção X" entries with session counts, and route to the right booking path.

**Step 1: Add patient subscriptions state**

After the existing subscription plan state (~line 70-73), add:
```typescript
// Patient's own subscriptions (when logged in)
interface PatientOwnSubscription {
  id: string;
  status: string;
  planId: string;
  sessionsUsedThisCycle: Record<string, number>;
  plan: {
    id: string;
    name: string;
    items: Array<{ procedureId: string; sessionsPerCycle: number; procedure?: { name: string } }>;
  };
}
const [patientOwnSubscriptions, setPatientOwnSubscriptions] = useState<PatientOwnSubscription[]>([]);
```

**Step 2: Fetch patient's own subscriptions when logged in**

At the end of `loadCompanyData` (after `setLoading(false)`), add:
```typescript
// Fetch patient's own subscriptions if logged in
if (user?.role === UserRole.PATIENT) {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  try {
    const r = await fetch(`${API_BASE_URL}/api/subscriptions/patients/my`, {
      headers: { Authorization: token ? `Bearer ${token}` : '', 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    const j = await r.json() as { success: boolean; data?: PatientOwnSubscription[] };
    if (j.success && j.data) setPatientOwnSubscriptions(j.data);
  } catch { /* silent */ }
}
```

Import `getAuthToken` from services/api at the top of the file (it's likely already available):
```typescript
import { publicApi, appointmentsApi, publicBookingApi, getAuthToken } from '../services/api';
```
Then use `getAuthToken()` instead of the localStorage lookup above.

**Step 3: Build derived data — covered procedures + plan entries**

After the style constants block (~line 210), add:
```typescript
// Map: procedureId → active subscription (for logged-in patient)
const coveredProcedureIds = useMemo(() => {
  const ids = new Set<string>();
  patientOwnSubscriptions
    .filter(s => s.status === 'ACTIVE')
    .forEach(s => s.plan.items.forEach(i => ids.add(i.procedureId)));
  return ids;
}, [patientOwnSubscriptions]);

// Helper: get sessions remaining for a procedure from patient's active subscriptions
const getSessionsRemaining = (procedureId: string): number => {
  for (const sub of patientOwnSubscriptions) {
    if (sub.status !== 'ACTIVE') continue;
    const item = sub.plan.items.find(i => i.procedureId === procedureId);
    if (item) {
      const used = (sub.sessionsUsedThisCycle[procedureId] ?? 0);
      return item.sessionsPerCycle - used;
    }
  }
  return -1; // not covered
};
```

(Use `import { useMemo } from 'react';` — add to React imports.)

**Step 4: Update handleSelectPlan to handle "no plan" case**

Find `handleSelectPlan` (~line 310). Add a state for the contract modal:
```typescript
const [showContractForPlan, setShowContractForPlan] = useState<PlanForBooking | null>(null);
```

Update `handleSelectPlan`:
```typescript
const handleSelectPlan = (plan: PlanForBooking) => {
  const ownSub = patientOwnSubscriptions.find(
    s => s.planId === plan.id && (s.status === 'ACTIVE' || s.status === 'PAUSED')
  );

  if (!ownSub && isLoggedInPatient) {
    // Patient doesn't have this plan yet — show contract modal
    setShowContractForPlan(plan);
    return;
  }

  setSelectedPlan(plan);
  setBookingMode('plan');
  if (plan.items.length > 1) {
    setShowPlanProcedurePicker(true);
  } else {
    const proc = procedures.find(p => p.id === plan.items[0]?.procedureId);
    if (proc) {
      setSelectedProcedure(proc);
      setStep(2);
    }
  }
};
```

**Step 5: Update handleSelectPlanProcedure to support multi-select**

Currently it only accepts one procedure ID. Change signature to accept array:
```typescript
const handleSelectPlanProcedures = (procedureIds: string[]) => {
  // Book the first selected procedure; store rest for additional deduction
  const primaryId = procedureIds[0];
  const proc = procedures.find(p => p.id === primaryId);
  if (proc) {
    setSelectedProcedure(proc);
    setShowPlanProcedurePicker(false);
    setStep(2);
  }
};
```

Add state for additional procedures:
```typescript
const [additionalPlanProcedureIds, setAdditionalPlanProcedureIds] = useState<string[]>([]);
```

Update `handleSelectPlanProcedures`:
```typescript
const handleSelectPlanProcedures = (procedureIds: string[]) => {
  const primaryId = procedureIds[0];
  const proc = procedures.find(p => p.id === primaryId);
  if (proc) {
    setSelectedProcedure(proc);
    setAdditionalPlanProcedureIds(procedureIds.slice(1));
    setShowPlanProcedurePicker(false);
    setStep(2);
  }
};
```

**Step 6: Handle plan contracting flow (when patient doesn't have plan)**

After the `handleSelectPlanProcedures` function, add:
```typescript
const handleContractAndBook = async (plan: PlanForBooking) => {
  const token = getAuthToken();
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const res = await fetch(`${API_BASE_URL}/api/subscriptions/patients/self`, {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ planId: plan.id }),
  });
  const json = await res.json() as { success?: boolean; error?: string };
  if (res.ok || res.status === 409) {
    setShowContractForPlan(null);
    // Now select the plan normally for booking
    setSelectedPlan(plan);
    setBookingMode('plan');
    if (plan.items.length > 1) {
      setShowPlanProcedurePicker(true);
    } else {
      const proc = procedures.find(p => p.id === plan.items[0]?.procedureId);
      if (proc) { setSelectedProcedure(proc); setStep(2); }
    }
  }
};
```

**Step 7: Filter procedure list in step 1 JSX**

Find the procedure cards render in step 1 (~line 557-640). Before the procedure grid, the procedures are iterated. Add a filter:

Find the procedures map:
```tsx
{procedures.map(proc => (
```

Replace with:
```tsx
{procedures.filter(proc =>
  // Hide procedures already covered by an active plan (patient portal)
  !isLoggedInPatient || !coveredProcedureIds.has(proc.id)
).map(proc => (
```

**Step 8: Add sessions remaining badge to plan cards in step 1**

Find the plan card render (Promoções section, ~line 572). In the plan card overlay area where name and price appear, add a sessions badge:

After the plan name `<h3>`, add:
```tsx
{isLoggedInPatient && (
  (() => {
    const ownSub = patientOwnSubscriptions.find(s => s.planId === plan.id && s.status === 'ACTIVE');
    if (!ownSub) return (
      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
        Contratar plano
      </span>
    );
    const totalRemaining = plan.items.reduce((sum, item) => {
      const used = ownSub.sessionsUsedThisCycle[item.procedureId] ?? 0;
      return sum + (item.sessionsPerCycle - used);
    }, 0);
    return (
      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/30 text-white">
        {totalRemaining} sessão{totalRemaining !== 1 ? 'ões' : ''} disponível{totalRemaining !== 1 ? 'is' : ''}
      </span>
    );
  })()
)}
```

**Step 9: Import PlanProcedurePickerModal and wire showPlanProcedurePicker**

At top of file, add import:
```typescript
import { PlanProcedurePickerModal } from '../components/patient-portal/PlanProcedurePickerModal';
import { PlanContractModal } from '../components/patient-portal/PlanContractModal';
```

Find where `showPlanProcedurePicker` is used in the JSX. Currently it renders nothing (it was a placeholder state). Replace or add the modal render before the closing `</div>` of the main return:

```tsx
{showPlanProcedurePicker && selectedPlan && (
  <PlanProcedurePickerModal
    planName={selectedPlan.name}
    items={selectedPlan.items.map(item => ({
      procedureId: item.procedureId,
      procedureName: item.procedure?.name || item.procedureId,
      sessionsPerCycle: item.sessionsPerCycle,
      sessionsRemaining: getSessionsRemaining(item.procedureId),
    }))}
    primaryColor={primaryColor}
    cardBg={cardBgColor}
    cardText={cardTxtColor}
    borderColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
    onConfirm={handleSelectPlanProcedures}
    onClose={() => setShowPlanProcedurePicker(false)}
  />
)}

{showContractForPlan && (
  <PlanContractModal
    plan={showContractForPlan}
    primaryColor={primaryColor}
    cardBg={cardBgColor}
    cardText={cardTxtColor}
    borderColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
    onClose={() => setShowContractForPlan(null)}
    onConfirm={() => handleContractAndBook(showContractForPlan)}
  />
)}
```

**Step 10: Commit**
```bash
git add pages/PublicBooking.tsx components/patient-portal/PlanProcedurePickerModal.tsx
git commit -m "feat(portal): integrate subscription plans into booking flow with session tracking"
```

---

## Task 11: Frontend — NewAppointmentModal subscription detection banners

**Files:**
- Modify: `components/Modals.tsx` (lines 182-329)

**Step 1: Add subscription state to NewAppointmentModal**

After `const [isSubmitting, setIsSubmitting] = useState(false);` (~line 204), add:
```typescript
const [patientSubscription, setPatientSubscription] = useState<{
  id: string;
  planName: string;
  sessionsRemaining: number;
  planId: string;
} | null>(null);
const [usePlan, setUsePlan] = useState<boolean | null>(null); // null = not decided yet
```

**Step 2: Fetch patient's subscription when patientId + procedureId change**

After the existing `useEffect` for Google conflict check (~line 238), add:
```typescript
// Check if selected patient has an active plan covering the selected procedure
useEffect(() => {
  setPatientSubscription(null);
  setUsePlan(null);
  if (!patientId || !selectedProcId || isPatientUser) return;

  subscriptionsApi.listForPatient(patientId).then(res => {
    if (!res.success || !res.data) return;
    const active = res.data.find(s => s.status === 'ACTIVE');
    if (!active) return;
    const planItem = active.plan.items?.find(
      (i: { procedureId: string; sessionsPerCycle: number }) => i.procedureId === selectedProcId
    );
    if (!planItem) return;
    const used = (active.sessionsUsedThisCycle as Record<string, number>)[selectedProcId] ?? 0;
    const remaining = planItem.sessionsPerCycle - used;
    setPatientSubscription({
      id: active.id,
      planName: active.plan.name,
      sessionsRemaining: remaining,
      planId: active.planId,
    });
    // Default: use plan if sessions available
    setUsePlan(remaining > 0);
  });
}, [patientId, selectedProcId, isPatientUser]);
```

Import subscriptionsApi at the top of Modals.tsx if not already imported:
```typescript
import { ..., subscriptionsApi } from '../services/api';
```

**Step 3: Add banners in JSX after the procedure select**

Find the procedure select element (~line 301):
```tsx
<div><label ...>Procedimento</label><select ...>...</select></div>
```

After the closing `</div>` of the procedure field, add:
```tsx
{/* Subscription plan banner */}
{patientSubscription && !isPatientUser && (
  patientSubscription.sessionsRemaining > 0 ? (
    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
      <div className="flex items-start gap-2">
        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-800">
          <strong>Plano disponível:</strong> Paciente tem{' '}
          <strong>{patientSubscription.sessionsRemaining} sessão{patientSubscription.sessionsRemaining !== 1 ? 'ões' : ''}</strong>{' '}
          restante{patientSubscription.sessionsRemaining !== 1 ? 's' : ''} no{' '}
          <strong>Promoção {patientSubscription.planName}</strong>.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setUsePlan(true)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            usePlan === true
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'
          }`}
        >
          Usar plano (R$ 0)
        </button>
        <button
          type="button"
          onClick={() => setUsePlan(false)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            usePlan === false
              ? 'bg-slate-600 text-white border-slate-600'
              : 'text-slate-600 border-slate-300 hover:bg-slate-50'
          }`}
        >
          Cobrar normalmente
        </button>
      </div>
    </div>
  ) : (
    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">
        Sessões do <strong>Promoção {patientSubscription.planName}</strong> esgotadas neste ciclo.
        O agendamento será cobrado normalmente.
      </p>
    </div>
  )
)}
```

**Step 4: Add plans to the procedure dropdown as a group**

The admin should also be able to select a plan directly (as "Promoção X"). This requires fetching available plans. Add a plans state:

```typescript
const [availablePlans, setAvailablePlans] = useState<{ id: string; name: string; items: { procedureId: string; sessionsPerCycle: number }[] }[]>([]);
const [selectedPlanForBooking, setSelectedPlanForBooking] = useState<string>(''); // planId if booking via plan
```

Add useEffect to fetch plans:
```typescript
useEffect(() => {
  subscriptionsApi.listPlans().then(res => {
    if (res.success && res.data) setAvailablePlans(res.data);
  });
}, []);
```

Update the procedure select to include a Promoções group at the top:
```tsx
<select required className="w-full p-2 border rounded-lg" value={selectedProcId} onChange={handleProcedureChange}>
  <option value="">Selecione da lista...</option>
  {availablePlans.length > 0 && (
    <optgroup label="── Promoções ──">
      {availablePlans.map(plan => (
        <option key={`plan-${plan.id}`} value={`plan-${plan.id}`}>
          Promoção {plan.name}
        </option>
      ))}
    </optgroup>
  )}
  <optgroup label="── Procedimentos ──">
    {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
  </optgroup>
</select>
```

Update `handleProcedureChange` to handle `plan-{id}` values:
```typescript
const handleProcedureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  const val = e.target.value;
  if (val.startsWith('plan-')) {
    const planId = val.replace('plan-', '');
    const plan = availablePlans.find(p => p.id === planId);
    if (plan) {
      setSelectedPlanForBooking(planId);
      // Use the first procedure of the plan
      const firstProcId = plan.items[0]?.procedureId;
      if (firstProcId) {
        setSelectedProcId(firstProcId);
        const proc = procedures.find(p => p.id === firstProcId);
        if (proc) { setServiceName(proc.name); setPrice(0); setDuration(proc.durationMinutes); }
      }
    }
    return;
  }
  setSelectedPlanForBooking('');
  const procId = val;
  setSelectedProcId(procId);
  const proc = procedures.find(p => p.id === procId);
  if (proc) { setServiceName(proc.name); setPrice(proc.price); setDuration(proc.durationMinutes); }
  else { setServiceName(''); setPrice(''); setDuration(''); }
};
```

**Step 5: Commit**
```bash
git add components/Modals.tsx
git commit -m "feat(modal): add subscription plan detection banners and Promoções group in NewAppointmentModal"
```

---

## Task 12: Deploy

**Step 1: Build backend locally to catch type errors**
```bash
cd aura-backend && npm run build 2>&1 | tail -20
```
Expected: no type errors, "Build Completed"

**Step 2: Deploy backend**
```bash
cd /c/Aura_System/aura-backend && vercel --prod --yes
```

**Step 3: Deploy frontend**
```bash
cd /c/Aura_System && vercel --prod --yes
```

**Step 4: Smoke test**
- Open `https://aura-system-mu.vercel.app/clinica-aura/agendamentos` as logged-in patient
- Verify "Promoções" section shows plans with session counts
- Verify procedures covered by active plan are hidden from regular list
- Open `/dashboard` as admin — check for "Novos Planos para Aprovação" section
- Check sidebar — verify "Clube de Assinaturas" shows amber badge when pending plans exist
- Open `/assinaturas` — verify "Pendentes" tab exists and shows pending plans

**Step 5: Final commit if any last fixes**
```bash
git add -p
git commit -m "fix: post-deploy adjustments"
```
