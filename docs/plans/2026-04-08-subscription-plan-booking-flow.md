# Subscription Plan Booking Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Quando um paciente seleciona uma "Promoção" no modal de agendamento, criar um `PatientSubscription` (PENDING) + `Appointment` (PENDING_APPROVAL, price:0, subscriptionId linkado), e quando o admin cancela o plano, restaurar o preço normal no agendamento.

**Architecture:** Dois calls sequenciais no frontend (createSelf → addAppointment com subscriptionId). Backend: adicionar `subscriptionId` ao schema de validação do appointment e ao handler POST. Cancel endpoint: restaurar preço dos appointments linkados. Sem tocar em Dashboard nem Subscriptions/Pendentes — já funcionam via `listPending()`.

**Tech Stack:** React 19, TypeScript, Next.js 15, Prisma, Zod, Vitest

---

### Task 1: Adicionar `subscriptionId` ao schema de validação do appointment

**Files:**
- Modify: `aura-backend/src/lib/validations/appointment.ts`

**Step 1: Adicionar campo ao schema**

Em `createAppointmentSchema`, adicionar após `roomId`:

```ts
subscriptionId: z.string().cuid().optional().nullable(),
```

**Step 2: Verificar build**

```bash
cd aura-backend && npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: nenhum erro de TypeScript.

**Step 3: Commit**

```bash
git add aura-backend/src/lib/validations/appointment.ts
git commit -m "feat(appointments): add optional subscriptionId to create schema"
```

---

### Task 2: Passar `subscriptionId` no handler POST de appointments

**Files:**
- Modify: `aura-backend/src/app/api/appointments/route.ts` (linha ~233)

**Step 1: Extrair `subscriptionId` do body validado**

Localizar a linha:
```ts
let { patientId, professionalId, procedureId, date, durationMinutes, price, notes, roomId } = validation.data;
```
Substituir por:
```ts
let { patientId, professionalId, procedureId, date, durationMinutes, price, notes, roomId, subscriptionId } = validation.data;
```

**Step 2: Passar `subscriptionId` no `prisma.appointment.create`**

Localizar o bloco `data: {` do create (linha ~357) e adicionar:
```ts
subscriptionId: subscriptionId ?? null,
```

**Step 3: Verificar build**

```bash
cd aura-backend && npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: sem erros.

**Step 4: Commit**

```bash
git add aura-backend/src/app/api/appointments/route.ts
git commit -m "feat(appointments): persist subscriptionId when creating appointment"
```

---

### Task 3: Fix cancel endpoint — restaurar preço do appointment linkado

**Files:**
- Modify: `aura-backend/src/app/api/subscriptions/patients/[id]/cancel/route.ts`

**Step 1: Adicionar lógica de restauração de preço**

Substituir o conteúdo do handler após confirmar que a subscription existe e não está cancelada, adicionando antes do `return`:

```ts
// Restaurar preço normal nos appointments linkados (caso seja PENDING → cancelamento de solicitação)
if (subscription.status === "PENDING") {
  const linkedAppointments = await prisma.appointment.findMany({
    where: {
      subscriptionId: id,
      companyId: user.companyId!,
      status: "PENDING_APPROVAL",
    },
    include: {
      procedure: { select: { price: true } },
    },
  });

  for (const appt of linkedAppointments) {
    if (appt.procedure) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { price: Number(appt.procedure.price) },
      });
    }
  }
}
```

Adicionar isso ANTES do bloco `const updated = await prisma.patientSubscription.update(...)`.

**Step 2: Verificar build**

```bash
cd aura-backend && npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: sem erros.

**Step 3: Deploy backend**

```bash
cd aura-backend && vercel --prod --yes 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add aura-backend/src/app/api/subscriptions/patients/[id]/cancel/route.ts
git commit -m "fix(subscriptions): restore appointment price when canceling a PENDING plan"
```

---

### Task 4: Adicionar `subscriptionsApi.requestSelf` no cliente de API

**Files:**
- Modify: `services/api.ts` (logo após `listForPatient`)

**Step 1: Adicionar método**

Dentro de `subscriptionsApi`, após `listForPatient`:

```ts
async requestSelf(planId: string) {
  return fetchApi<{ id: string; status: string; planId: string }>(
    '/api/subscriptions/patients/self',
    { method: 'POST', body: JSON.stringify({ planId }) }
  );
},
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error" | head -10
```
Expected: sem erros.

**Step 3: Commit**

```bash
git add services/api.ts
git commit -m "feat(api): add subscriptionsApi.requestSelf for patient plan requests"
```

---

### Task 5: Propagar `subscriptionId` pelo `addAppointment` no AppContext

**Files:**
- Modify: `context/AppContext.tsx`

**Step 1: Adicionar `subscriptionId` ao tipo do parâmetro**

Localizar a assinatura de `addAppointment` (linha ~1152):
```ts
const addAppointment = async (appt: { procedureId?: string; service?: string; ... [key: string]: unknown }, ...)
```
O tipo já usa `[key: string]: unknown`, então `subscriptionId` já passa automaticamente se incluído no objeto. Verificar se `apiData` passa todos os campos do `appt`:

```ts
const apiData = {
  ...appt,
  companyId,
};
```
Isso já inclui `subscriptionId` se vier no objeto. **Nenhuma mudança necessária aqui.**

**Step 2: Confirmar com grep**

```bash
grep -n "apiData\|\.\.\.appt" context/AppContext.tsx | head -10
```
Expected: `const apiData = { ...appt, companyId }` — confirma que subscriptionId passa via spread.

---

### Task 6: Modificar `handleSubmit` no `NewAppointmentModal`

**Files:**
- Modify: `components/Modals.tsx`

**Step 1: Localizar o `handleSubmit` de paciente (linha ~297)**

Localizar o bloco:
```ts
if (isPatientUser) {
  // PATIENT role: backend resolve pelo token, não precisamos buscar no array
  finalPatientId = '';
}
```

**Step 2: Adicionar lógica de criação de subscription antes do `addAppointment`**

Substituir o bloco inteiro do `setIsSubmitting(true)` até o `try {`:

```ts
setIsSubmitting(true);
try {
  const isoDate = new Date(date).toISOString();
  const status = simulateClientRequest ? 'pending_approval' : 'confirmed';

  // Se paciente selecionou um plano, criar subscription PENDING primeiro
  let appointmentSubscriptionId: string | undefined = undefined;
  if (isPatientUser && isPlanSelected) {
    const planId = selectProcValue.replace('plan-', '');
    const subRes = await subscriptionsApi.requestSelf(planId);
    if (!subRes.success) {
      // "já possui este plano" retorna o id existente no data
      if (subRes.data?.id) {
        appointmentSubscriptionId = subRes.data.id;
      } else {
        setError(subRes.error || 'Erro ao solicitar plano. Tente novamente.');
        setIsSubmitting(false);
        return;
      }
    } else {
      appointmentSubscriptionId = subRes.data?.id;
    }
  }

  const result = await addAppointment({
    patientId: finalPatientId,
    patientName: patientName,
    professionalId: professional.id,
    professionalName: professional.name,
    procedureId: selectedProcId,
    service: serviceName,
    date: isoDate,
    durationMinutes: Number(duration) || 60,
    price: Number(price) || 0,
    status: status,
    roomId: roomId,
    ...(appointmentSubscriptionId ? { subscriptionId: appointmentSubscriptionId } : {}),
  }, false);

  if (result.success) { onClose(); }
  else if (result.conflict) { setError("Este horário já está ocupado. Por favor, selecione outro horário ou sala."); setIsSubmitting(false); }
  else { setError(result.error || "Erro desconhecido ao agendar."); setIsSubmitting(false); }
} catch (error) { console.error(error); setError("Erro ao processar data. Verifique o campo Data/Hora."); setIsSubmitting(false); }
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error" | head -10
```

**Step 4: Build frontend**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

**Step 5: Commit**

```bash
git add components/Modals.tsx
git commit -m "feat(portal): create PENDING subscription before appointment when patient selects a plan"
```

---

### Task 7: Deploy e verificação manual

**Step 1: Deploy frontend**

```bash
vercel --prod --yes 2>&1 | tail -5
```

**Step 2: Teste como paciente**

1. Acessar `https://aura-system-mu.vercel.app/clinica-aura/agendamentos`
2. Logar como paciente
3. Clicar em "Novo Agendamento"
4. Selecionar uma "Promoção X" no dropdown
5. Preencher profissional e data/hora
6. Confirmar

**Step 3: Verificar como admin**

1. Logar como admin em `https://aura-system-mu.vercel.app/dashboard`
2. Verificar bloco roxo "Novos Planos para Aprovação" com o plano do paciente
3. Verificar bloco amarelo "Novas Solicitações" com o agendamento
4. Ir em `/subscriptions` → aba Pendentes → verificar o mesmo plano

**Step 4: Testar reject do plano**

1. No Dashboard, clicar "Rejeitar" no card do plano
2. Verificar que o agendamento ainda aparece em "Novas Solicitações" (amarelo)
3. Confirmar via Prisma Studio que `appointment.price` voltou ao valor normal do procedimento:
```bash
cd aura-backend && npm run db:studio
```

**Step 5: Testar approve do plano**

1. Com outro paciente, repetir o fluxo
2. No Dashboard, clicar "Ativar" no card do plano
3. Verificar que o agendamento some de "Novas Solicitações" (foi confirmado automaticamente)

---

### Task 8: Commit final

```bash
git add -A
git commit -m "feat(portal): full subscription plan booking flow — PENDING sub + linked appointment"
```
