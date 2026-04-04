# Meus Planos Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade `/meus-planos` so patients can browse available plans, contract them (PENDING), book their first session (activates plan), and see appointment history per plan.

**Architecture:** Schema gets `PENDING` status + `subscriptionId` on Appointment. New backend endpoints for self-service subscription. Frontend adds PlanCard/PlanContractModal/PlanHistoryDrawer components into PatientPlans.tsx. PublicBooking reads navigation state to pre-select a plan.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, React 19, TypeScript, Tailwind CSS, React Router v6

---

### Task 1: Schema — Add PENDING status + subscriptionId to Appointment

**Files:**
- Modify: `aura-backend/prisma/schema.prisma`

**Step 1: Add PENDING to enum and subscriptionId to Appointment**

In `schema.prisma`, find `enum PatientSubscriptionStatus` and add `PENDING`:
```prisma
enum PatientSubscriptionStatus {
  PENDING
  ACTIVE
  PAUSED
  CANCELED
  OVERDUE
}
```

In `model Appointment`, add after `googleEventId String?`:
```prisma
  subscriptionId  String?
  subscription    PatientSubscription? @relation(fields: [subscriptionId], references: [id])
```

In `model PatientSubscription`, add to relations:
```prisma
  appointments    Appointment[]
```

**Step 2: Push schema to database**

```bash
cd aura-backend && npm run db:generate && npm run db:push
```
Expected: `All migrations applied` (or `Your database is now in sync`)

**Step 3: Commit**
```bash
git add aura-backend/prisma/schema.prisma aura-backend/prisma/generated/
git commit -m "feat(schema): add PENDING subscription status and subscriptionId on Appointment"
```

---

### Task 2: Backend — POST /api/subscriptions/patients/self

Creates a PENDING subscription for the authenticated PATIENT.

**Files:**
- Create: `aura-backend/src/app/api/subscriptions/patients/self/route.ts`

**Step 1: Create the route**

```typescript
// POST /api/subscriptions/patients/self
// Authenticated PATIENT creates a PENDING subscription for themselves
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (user.role !== "PATIENT") return NextResponse.json({ error: "Apenas pacientes podem contratar planos" }, { status: 403 });
    if (!user.companyId) return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });

    const body = await request.json() as { planId: string };
    const { planId } = body;
    if (!planId) return NextResponse.json({ error: "planId é obrigatório" }, { status: 400 });

    // Validate plan belongs to same company
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, companyId: user.companyId, isActive: true },
      include: { items: true },
    });
    if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });

    // Find patient record linked to this portal user (same email + companyId)
    const patient = await prisma.patient.findFirst({
      where: { email: user.email, companyId: user.companyId },
    });
    if (!patient) return NextResponse.json({ error: "Registro de paciente não encontrado" }, { status: 404 });

    // Check for existing non-canceled subscription for this plan
    const existing = await prisma.patientSubscription.findFirst({
      where: {
        patientId: patient.id,
        planId,
        companyId: user.companyId,
        status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Você já possui este plano", data: { subscriptionId: existing.id, status: existing.status } },
        { status: 409 }
      );
    }

    // Initialize sessions counter
    const sessionsUsedThisCycle: Record<string, number> = {};
    plan.items.forEach((item) => { sessionsUsedThisCycle[item.procedureId] = 0; });

    const subscription = await prisma.patientSubscription.create({
      data: {
        patientId: patient.id,
        planId,
        companyId: user.companyId,
        status: "PENDING",
        startDate: new Date(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sessionsUsedThisCycle,
        lastCycleReset: new Date(),
      },
      select: { id: true, status: true, planId: true },
    });

    return NextResponse.json({ success: true, data: subscription }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar assinatura:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

**Step 2: Commit**
```bash
git add aura-backend/src/app/api/subscriptions/patients/self/
git commit -m "feat(api): POST /subscriptions/patients/self — patient self-service PENDING subscription"
```

---

### Task 3: Backend — Update GET /api/subscriptions/patients/my to include PENDING

**Files:**
- Modify: `aura-backend/src/app/api/subscriptions/patients/my/route.ts`

**Step 1: Add PENDING to the status filter**

Change:
```typescript
status: { in: ["ACTIVE", "PAUSED"] },
```
To:
```typescript
status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
```

Also update the result mapping to include `status` correctly (already included).

**Step 2: Commit**
```bash
git add aura-backend/src/app/api/subscriptions/patients/my/route.ts
git commit -m "feat(api): include PENDING subscriptions in patient's /my endpoint"
```

---

### Task 4: Backend — GET /api/subscriptions/patients/[id]/history

Returns appointments linked to a specific subscription.

**Files:**
- Create: `aura-backend/src/app/api/subscriptions/patients/[id]/history/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // Find subscription — patient can only see their own
    const whereClause = user.role === "PATIENT"
      ? { id, companyId: user.companyId! }
      : { id, companyId: user.companyId! };

    const subscription = await prisma.patientSubscription.findFirst({
      where: whereClause,
      include: {
        patient: { select: { id: true, email: true } },
        plan: { select: { name: true } },
      },
    });
    if (!subscription) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    // For PATIENT role, ensure it's their own subscription
    if (user.role === "PATIENT") {
      const patient = await prisma.patient.findFirst({
        where: { email: user.email, companyId: user.companyId! },
      });
      if (!patient || subscription.patientId !== patient.id) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    const appointments = await prisma.appointment.findMany({
      where: { subscriptionId: id },
      include: {
        procedure: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
        photos: { select: { id: true, url: true, type: true, takenAt: true } },
      },
      orderBy: { date: "desc" },
    });

    const result = appointments.map((apt) => ({
      id: apt.id,
      date: apt.date,
      status: apt.status,
      procedureName: apt.procedure.name,
      professionalName: apt.professional.name,
      photos: apt.photos,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

**Step 2: Commit**
```bash
git add aura-backend/src/app/api/subscriptions/patients/[id]/history/
git commit -m "feat(api): GET /subscriptions/patients/[id]/history — appointment history per subscription"
```

---

### Task 5: Backend — Modify /api/public/subscriptions/book to activate PENDING + link subscriptionId

**Files:**
- Modify: `aura-backend/src/app/api/public/subscriptions/book/route.ts`

**Step 1: Replace "Find or create PatientSubscription" block**

Find this block (around line 140):
```typescript
// Find or create PatientSubscription
let subscription = await prisma.patientSubscription.findFirst({
  where: {
    patientId: patient.id,
    planId,
    companyId,
    status: { in: ["ACTIVE", "PAUSED"] },
  },
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
```

Replace with:
```typescript
// Find or create PatientSubscription (activates PENDING if exists)
let subscription = await prisma.patientSubscription.findFirst({
  where: {
    patientId: patient.id,
    planId,
    companyId,
    status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
  },
  orderBy: { createdAt: "desc" },
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
} else if (subscription.status === "PENDING") {
  // Activate PENDING subscription on first booking
  subscription = await prisma.patientSubscription.update({
    where: { id: subscription.id },
    data: { status: "ACTIVE", startDate: new Date() },
  });
}
```

**Step 2: Link appointment to subscription**

Find the `prisma.appointment.create` call and add `subscriptionId`:
```typescript
const appointment = await prisma.appointment.create({
  data: {
    date: new Date(date),
    durationMinutes: procedure.durationMinutes,
    status: "SCHEDULED",
    price: 0,
    patientId: patient.id,
    professionalId: resolvedProfessionalId,
    procedureId,
    companyId,
    subscriptionId: subscription.id,   // <- ADD THIS (move after subscription creation)
    notes: `Agendamento via Plano: ${plan.name}`,
  },
});
```

Note: Move appointment creation to AFTER subscription creation/update.

**Step 3: Commit**
```bash
git add aura-backend/src/app/api/public/subscriptions/book/route.ts
git commit -m "feat(api): activate PENDING subscription on first booking + link subscriptionId"
```

---

### Task 6: Frontend — PlanCard component

**Files:**
- Create: `components/patient-portal/PlanCard.tsx`

**Step 1: Create component**

```tsx
import React from 'react';
import { Sparkles, CheckCircle, Clock } from 'lucide-react';

export interface PlanForCard {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
  items: { procedureId: string; procedureName: string; sessionsPerCycle: number }[];
}

type PlanStatus = 'available' | 'active' | 'pending';

interface PlanCardProps {
  plan: PlanForCard;
  status: PlanStatus;
  primaryColor: string;
  cardBg: string;
  cardText: string;
  borderColor: string;
  isDark: boolean;
  onContract: () => void;
  onViewHistory: () => void;
}

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const PlanCard: React.FC<PlanCardProps> = ({
  plan, status, primaryColor, cardBg, cardText, borderColor, isDark, onContract, onViewHistory,
}) => {
  return (
    <div
      className="relative rounded-2xl overflow-hidden border shadow-sm cursor-pointer group transition-all hover:shadow-lg"
      style={{ backgroundColor: cardBg, borderColor }}
      onClick={status === 'active' ? onViewHistory : undefined}
    >
      {/* Image / header */}
      <div className="relative h-36 overflow-hidden">
        {plan.imageUrl ? (
          <>
            <img src={plan.imageUrl} alt={plan.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
            <Sparkles className="w-10 h-10 opacity-30" style={{ color: primaryColor }} />
          </div>
        )}
        {/* Status badge */}
        <div className="absolute top-3 right-3">
          {status === 'active' && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white">Ativo</span>
          )}
          {status === 'pending' && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white flex items-center gap-1">
              <Clock className="w-3 h-3" /> Aguardando agendamento
            </span>
          )}
        </div>
        {/* Price */}
        <div className="absolute bottom-3 left-3">
          <span className="text-white font-bold text-lg drop-shadow">{formatCurrency(plan.price)}<span className="text-xs font-normal opacity-80">/mês</span></span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="font-bold text-base mb-1" style={{ color: cardText }}>{plan.name}</h3>
        {plan.description && (
          <p className="text-xs opacity-60 mb-3 line-clamp-2" style={{ color: cardText }}>{plan.description}</p>
        )}
        <div className="space-y-1 mb-4">
          {plan.items.map(item => (
            <div key={item.procedureId} className="flex items-center gap-1.5 text-xs" style={{ color: cardText }}>
              <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: primaryColor }} />
              <span>{item.procedureName} — {item.sessionsPerCycle}x/mês</span>
            </div>
          ))}
        </div>

        {status === 'available' && (
          <button
            onClick={(e) => { e.stopPropagation(); onContract(); }}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: primaryColor }}
          >
            Contratar Plano
          </button>
        )}
        {status === 'active' && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewHistory(); }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80 border"
            style={{ color: primaryColor, borderColor: `${primaryColor}40` }}
          >
            Ver Histórico de Sessões
          </button>
        )}
        {status === 'pending' && (
          <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center opacity-60 border" style={{ color: cardText, borderColor }}>
            Agende sua 1ª sessão para ativar
          </div>
        )}
      </div>
    </div>
  );
};
```

**Step 2: Commit**
```bash
git add components/patient-portal/PlanCard.tsx
git commit -m "feat(frontend): PlanCard component for patient portal plans listing"
```

---

### Task 7: Frontend — PlanContractModal component

**Files:**
- Create: `components/patient-portal/PlanContractModal.tsx`

**Step 1: Create component**

```tsx
import React, { useState } from 'react';
import { X, CheckCircle, Sparkles, MessageCircle } from 'lucide-react';
import { PlanForCard } from './PlanCard';

interface PlanContractModalProps {
  plan: PlanForCard;
  primaryColor: string;
  cardBg: string;
  cardText: string;
  borderColor: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const PlanContractModal: React.FC<PlanContractModalProps> = ({
  plan, primaryColor, cardBg, cardText, borderColor, onClose, onConfirm,
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: cardBg, borderColor, border: '1px solid' }}
      >
        {/* Image header */}
        {plan.imageUrl && (
          <div className="relative h-40 overflow-hidden">
            <img src={plan.imageUrl} alt={plan.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white hover:bg-black/50 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold" style={{ color: cardText }}>{plan.name}</h2>
              {plan.description && (
                <p className="text-sm opacity-60 mt-1" style={{ color: cardText }}>{plan.description}</p>
              )}
            </div>
            <div className="text-right shrink-0 ml-4">
              <span className="text-2xl font-bold" style={{ color: primaryColor }}>{formatCurrency(plan.price)}</span>
              <span className="text-xs opacity-60 block" style={{ color: cardText }}>/mês</span>
            </div>
          </div>

          {/* Procedures */}
          <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: `${primaryColor}10`, border: `1px solid ${primaryColor}20` }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3 opacity-60" style={{ color: cardText }}>Incluso no plano</p>
            <div className="space-y-2">
              {plan.items.map(item => (
                <div key={item.procedureId} className="flex items-center gap-2 text-sm" style={{ color: cardText }}>
                  <CheckCircle className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                  <span className="font-medium">{item.procedureName}</span>
                  <span className="ml-auto opacity-60 text-xs">{item.sessionsPerCycle}x por mês</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment notice */}
          <div className="flex items-start gap-2 mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <MessageCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              O pagamento é combinado diretamente com a clínica via WhatsApp ou telefone após o primeiro agendamento.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors hover:opacity-70"
              style={{ color: cardText, borderColor }}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Aguarde...' : 'Confirmar Plano'}
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
git add components/patient-portal/PlanContractModal.tsx
git commit -m "feat(frontend): PlanContractModal for plan contracting flow"
```

---

### Task 8: Frontend — PlanHistoryDrawer component

**Files:**
- Create: `components/patient-portal/PlanHistoryDrawer.tsx`

**Step 1: Create component**

```tsx
import React, { useState, useEffect } from 'react';
import { X, Calendar, User, CheckCircle, Clock, Image } from 'lucide-react';
import { getAuthToken } from '../../services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AppointmentHistory {
  id: string;
  date: string;
  status: string;
  procedureName: string;
  professionalName: string;
  photos: { id: string; url: string; type: string; takenAt: string }[];
}

interface PlanHistoryDrawerProps {
  subscriptionId: string;
  planName: string;
  primaryColor: string;
  cardBg: string;
  cardText: string;
  borderColor: string;
  isDark: boolean;
  onClose: () => void;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Agendado', color: '#3b82f6' },
  COMPLETED: { label: 'Concluído', color: '#10b981' },
  CANCELED: { label: 'Cancelado', color: '#ef4444' },
  NO_SHOW: { label: 'Falta', color: '#f59e0b' },
};

export const PlanHistoryDrawer: React.FC<PlanHistoryDrawerProps> = ({
  subscriptionId, planName, primaryColor, cardBg, cardText, borderColor, isDark, onClose,
}) => {
  const [appointments, setAppointments] = useState<AppointmentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE_URL}/api/subscriptions/patients/${subscriptionId}/history`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        });
        const json = await res.json() as { success: boolean; data?: AppointmentHistory[] };
        if (json.success && json.data) setAppointments(json.data);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [subscriptionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm flex flex-col shadow-2xl animate-slide-in-right"
        style={{ backgroundColor: cardBg, borderLeft: `1px solid ${borderColor}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: cardText }}>{planName}</h2>
            <p className="text-xs opacity-50 mt-0.5" style={{ color: cardText }}>Histórico de sessões</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-70"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', color: cardText }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: primaryColor }} />
            </div>
          )}

          {!loading && appointments.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: cardText }} />
              <p className="text-sm opacity-50" style={{ color: cardText }}>Nenhuma sessão realizada ainda.</p>
              <p className="text-xs opacity-40 mt-1" style={{ color: cardText }}>Agende sua primeira sessão!</p>
            </div>
          )}

          {appointments.map((apt) => {
            const st = statusLabel[apt.status] ?? { label: apt.status, color: '#64748b' };
            const beforePhoto = apt.photos.find(p => p.type === 'BEFORE');
            const afterPhoto = apt.photos.find(p => p.type === 'AFTER');

            return (
              <div key={apt.id} className="rounded-xl border p-4 space-y-3" style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                {/* Date + status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: cardText }}>
                    <Calendar className="w-3.5 h-3.5 opacity-60" />
                    {new Date(apt.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: `${st.color}20`, color: st.color }}>
                    {st.label}
                  </span>
                </div>

                {/* Procedure + professional */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs opacity-70" style={{ color: cardText }}>
                    <CheckCircle className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                    {apt.procedureName}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs opacity-60" style={{ color: cardText }}>
                    <User className="w-3.5 h-3.5" />
                    {apt.professionalName}
                  </div>
                </div>

                {/* Before/After photos */}
                {(beforePhoto || afterPhoto) && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {beforePhoto && (
                      <div>
                        <p className="text-[10px] opacity-50 mb-1 flex items-center gap-1" style={{ color: cardText }}><Image className="w-3 h-3" />Antes</p>
                        <img src={beforePhoto.url} alt="Antes" className="w-full h-24 object-cover rounded-lg border" style={{ borderColor }} />
                      </div>
                    )}
                    {afterPhoto && (
                      <div>
                        <p className="text-[10px] opacity-50 mb-1 flex items-center gap-1" style={{ color: cardText }}><Image className="w-3 h-3" />Depois</p>
                        <img src={afterPhoto.url} alt="Depois" className="w-full h-24 object-cover rounded-lg border" style={{ borderColor }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Add slide-in animation to tailwind config or index.css**

In `index.css`, add:
```css
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.animate-slide-in-right {
  animation: slide-in-right 0.25s ease-out;
}
```

**Step 3: Commit**
```bash
git add components/patient-portal/PlanHistoryDrawer.tsx index.css
git commit -m "feat(frontend): PlanHistoryDrawer component for subscription appointment history"
```

---

### Task 9: Frontend — Rewrite PatientPlans.tsx

**Files:**
- Modify: `pages/patient-portal/PatientPlans.tsx`

**Step 1: Full rewrite of PatientPlans.tsx**

The page now has two sections:
1. "Promoções Disponíveis" — all active clinic plans as PlanCard grid. Badge shows status based on mySubscriptions lookup.
2. "Meus Planos" — existing active/paused/pending subscriptions (filtered from mySubscriptions).

Key logic:
- Fetch clinic's public plans via `GET /api/public/company/[slug]/` (already fetched by ClinicContext?) or via the existing endpoint.
- Actually, use `GET /api/subscriptions/plans?companyId=X` or the public company endpoint.
- For simplicity, fetch plans from `GET /api/subscriptions/plans` using the auth token and companyId from the user's token. Actually, patients don't have companyId easily accessible.
- Better: use `ClinicContext` which already has the company data including `subscriptionPlans` from the public company endpoint.

Check what `useClinic()` exposes — it has `clinic` with layout info. Need to check if it includes subscriptionPlans.

Check `context/ClinicContext.tsx` to see what data the clinic object contains.

**Step 1b: Check ClinicContext for subscriptionPlans**

```bash
grep -n "subscriptionPlan\|plans\|subscriptions" /c/Aura_System/context/ClinicContext.tsx | head -20
```

If clinic context doesn't have plans, fetch them from `GET /api/public/company/[slug]/` directly (same endpoint used by PublicBooking).

**Step 1c: Rewrite PatientPlans.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { useApp } from '../../context/AppContext';
import { getPortalBasePath } from '../../utils/subdomain';
import { getAuthToken } from '../../services/api';
import { PlanCard, PlanForCard } from '../../components/patient-portal/PlanCard';
import { PlanContractModal } from '../../components/patient-portal/PlanContractModal';
import { PlanHistoryDrawer } from '../../components/patient-portal/PlanHistoryDrawer';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ... (keep existing MySubscription interface + new AvailablePlan interface)
// ... (keep color derivation logic)

// Main component:
// 1. Fetch mySubscriptions from /api/subscriptions/patients/my (include PENDING)
// 2. Fetch availablePlans from clinic context or public company endpoint
// 3. For each availablePlan, determine status: active, pending, or available
// 4. Render two sections: Promoções (availablePlans as PlanCard grid) + Meus Planos (progress cards)
// 5. PlanCard onContract → open PlanContractModal
// 6. PlanContractModal onConfirm → POST /api/subscriptions/patients/self → navigate to basePath/ with state
// 7. PlanCard onViewHistory (active) → open PlanHistoryDrawer

const PatientPlans: React.FC = () => {
  const { clinic } = useClinic();
  const { user } = useApp();
  const navigate = useNavigate();
  const basePath = getPortalBasePath();

  // ... color setup (same as current)

  const [subscriptions, setSubscriptions] = useState<MySubscription[]>([]);
  const [availablePlans, setAvailablePlans] = useState<PlanForCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractModal, setContractModal] = useState<PlanForCard | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    // Fetch both in parallel
    const fetchData = async () => {
      const token = getAuthToken();
      const [myRes, publicRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/subscriptions/patients/my`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        }),
        clinic?.slug
          ? fetch(`${API_BASE_URL}/api/public/company/${clinic.slug}`)
          : Promise.resolve(null),
      ]);

      const myJson = await myRes.json();
      if (myJson.success) setSubscriptions(myJson.data);

      if (publicRes) {
        const pubJson = await publicRes.json();
        if (pubJson.subscriptionPlans) setAvailablePlans(pubJson.subscriptionPlans);
      }

      setLoading(false);
    };
    fetchData();
  }, [clinic?.slug]);

  const getPlanStatus = (planId: string): 'active' | 'pending' | 'available' => {
    const sub = subscriptions.find(s => s.plan.id === planId);
    if (!sub) return 'available';
    if (sub.status === 'ACTIVE') return 'active';
    if (sub.status === 'PENDING') return 'pending';
    return 'available';
  };

  const handleContract = async () => {
    if (!contractModal) return;
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/subscriptions/patients/self`, {
      method: 'POST',
      headers: { Authorization: token ? `Bearer ${token}` : '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: contractModal.id }),
    });
    const json = await res.json();
    if (json.success || res.status === 409) {
      // Navigate to booking with plan pre-selected
      navigate(`${basePath}/`, {
        state: {
          pendingPlanId: contractModal.id,
          pendingPlanName: contractModal.name,
        },
      });
    }
  };

  // ... render with two sections + modals
};
```

**Step 2: Commit**
```bash
git add pages/patient-portal/PatientPlans.tsx
git commit -m "feat(frontend): PatientPlans — available plans section, contract flow, history drawer"
```

---

### Task 10: Frontend — PublicBooking.tsx reads pendingPlanId from navigation state

**Files:**
- Modify: `pages/PublicBooking.tsx`

**Step 1: Read location state and auto-select plan**

At the top of `PublicBooking` component, add:
```tsx
import { useLocation } from 'react-router-dom';

// Inside component:
const location = useLocation();
const pendingPlanState = location.state as { pendingPlanId?: string; pendingPlanName?: string } | null;
```

In the `useEffect` that loads data, after `setSubscriptionPlans(plans)`, add:
```tsx
// Auto-select plan from navigation state (from PatientPlans contract flow)
if (pendingPlanState?.pendingPlanId && plans) {
  const plan = plans.find((p: PlanForBooking) => p.id === pendingPlanState.pendingPlanId);
  if (plan) {
    handleSelectPlan(plan);
  }
}
```

**Step 2: Show banner when plan is pre-selected from state**

In the JSX, above the booking form when `bookingMode === 'plan' && pendingPlanState?.pendingPlanId && selectedPlan?.id === pendingPlanState.pendingPlanId`, add:

```tsx
{bookingMode === 'plan' && pendingPlanState?.pendingPlanId && selectedPlan?.id === pendingPlanState.pendingPlanId && (
  <div className="mb-4 p-3 rounded-xl flex items-center gap-2 text-sm font-medium"
    style={{ backgroundColor: `${primaryColor}15`, color: primaryColor, border: `1px solid ${primaryColor}30` }}>
    <CheckCircle className="w-4 h-4 shrink-0" />
    Plano <strong>{pendingPlanState.pendingPlanName}</strong> selecionado — escolha o profissional e a data.
  </div>
)}
```

**Step 3: Commit**
```bash
git add pages/PublicBooking.tsx
git commit -m "feat(frontend): PublicBooking auto-selects plan from navigation state after contracting"
```

---

### Task 11: Deploy

**Step 1: Run TypeScript check**
```bash
cd /c/Aura_System && npx tsc --noEmit 2>&1 | head -30
```

**Step 2: Deploy backend**
```bash
cd /c/Aura_System/aura-backend && vercel --prod --yes 2>&1 | tail -5
```

**Step 3: Deploy frontend**
```bash
cd /c/Aura_System && vercel --prod --yes 2>&1 | tail -5
```
