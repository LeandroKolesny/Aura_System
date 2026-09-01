# Clube de Assinaturas — Design
> Decisões validadas em 22/03/2026

## Decisões

- **Modelo:** Plano fixo de sessões por mês (X sessões de procedimentos específicos)
- **Cobrança:** Integrado com Asaas (boleto/Pix automático mensal)
- **Planos:** Cada clínica cria os seus livremente
- **Sessões esgotadas:** Avisa mas permite agendar (cobra preço cheio)

## Fluxo

```
Clínica cria plano → Paciente é inscrita → Asaas cobra mensalmente →
Sistema libera sessões → Recepcionista agenda → Sistema desconta sessão →
Próximo mês → Asaas cobra → sessões renovam automaticamente
```

## Schema Prisma (novos modelos)

```prisma
model SubscriptionPlan {
  id          String   @id @default(cuid())
  name        String
  price       Decimal  @db.Decimal(10, 2)
  description String?
  isActive    Boolean  @default(true)
  items       SubscriptionPlanItem[]
  subscribers PatientSubscription[]
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("subscription_plans")
}

model SubscriptionPlanItem {
  id               String           @id @default(cuid())
  sessionsPerCycle Int
  plan             SubscriptionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  planId           String
  procedure        Procedure        @relation(fields: [procedureId], references: [id])
  procedureId      String
  @@map("subscription_plan_items")
}

model PatientSubscription {
  id                  String   @id @default(cuid())
  status              SubscriptionStatus @default(ACTIVE)
  startDate           DateTime @default(now())
  nextBillingDate     DateTime
  sessionsUsedThisCycle Json   // { "procedureId": sessionsUsadas }
  lastCycleReset      DateTime @default(now())
  asaasSubscriptionId String?
  asaasCustomerId     String?
  patientId           String
  patient             Patient  @relation(fields: [patientId], references: [id])
  planId              String
  plan                SubscriptionPlan @relation(fields: [planId], references: [id])
  companyId           String
  company             Company  @relation(fields: [companyId], references: [id])
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@map("patient_subscriptions")
}

enum SubscriptionStatus {
  ACTIVE
  PAUSED
  CANCELED
  OVERDUE
}
```

## Rotas Backend

```
GET    /api/subscriptions/plans            → lista planos da clínica
POST   /api/subscriptions/plans            → cria novo plano
PUT    /api/subscriptions/plans/:id        → edita plano
DELETE /api/subscriptions/plans/:id        → desativa plano
GET    /api/subscriptions/patients         → lista assinantes
POST   /api/subscriptions/patients         → inscreve paciente
PUT    /api/subscriptions/patients/:id/cancel → cancela assinatura
POST   /api/webhooks/asaas                 → já existe, adicionar:
                                             SUBSCRIPTION_PAYMENT_RECEIVED → reset sessões
```

## Lógica de Sessão no Agendamento

```typescript
// Ao criar agendamento:
1. Busca assinatura ACTIVE da paciente
2. Verifica se procedimento está no plano
3. Verifica sessionsUsedThisCycle[procedureId] < sessionsPerCycle
4a. Dentro do limite → agendamento coberto, valor = R$ 0, desconta sessão
4b. Excedeu → avisa recepcionista, agenda com preço cheio
```

## Telas Frontend

- `/subscriptions` — lista de planos + KPIs (planos ativos, assinantes, receita/mês)
- `/subscriptions/new` — formulário criar plano (nome, preço, + adicionar procedimentos)
- Ficha do paciente — nova aba "Assinatura" com progresso de sessões do ciclo
- Tela de agendamento — badge "Coberto pelo plano" quando aplicável

## Arquivos a criar/editar

**Backend:**
- `aura-backend/prisma/schema.prisma` — 3 modelos novos + enum
- `aura-backend/src/app/api/subscriptions/plans/route.ts`
- `aura-backend/src/app/api/subscriptions/plans/[id]/route.ts`
- `aura-backend/src/app/api/subscriptions/patients/route.ts`
- `aura-backend/src/app/api/subscriptions/patients/[id]/cancel/route.ts`
- `aura-backend/src/app/api/webhooks/asaas/route.ts` — adicionar evento de pagamento

**Frontend:**
- `pages/Subscriptions.tsx` — página principal
- `components/SubscriptionPlanModal.tsx` — modal criar/editar plano
- `pages/PatientDetail.tsx` — adicionar aba Assinatura
- `pages/Schedule.tsx` — indicador de sessão coberta pelo plano
- `services/api.ts` — funções de subscriptions
