# Design: Upgrade da Página Meus Planos (Portal do Paciente)

**Data:** 2026-04-04  
**Status:** Aprovado  

## Objetivo

Transformar `/clinica-slug/meus-planos` em uma página completa onde o paciente pode:
1. Ver promoções disponíveis e contratar um plano
2. Acompanhar planos ativos com progresso de sessões
3. Ver histórico de procedimentos realizados dentro de cada plano

## Fluxo Principal

```
/meus-planos
├── Seção: Promoções Disponíveis
│   ├── Card com foto + badge "Ativo" / "Aguardando 1º agendamento" / botão "Contratar"
│   └── Clicar "Contratar" → PlanContractModal
│       ├── Mostra: foto, descrição, procedimentos, preço, nota de pagamento
│       └── Confirmar → POST /api/subscriptions/patients (status=PENDING)
│                    → navigate('/agendamentos', { state: { pendingPlanId } })
│
└── Seção: Meus Planos (ativos/pausados/pendentes)
    └── Clicar no plano → PlanHistoryDrawer
        └── Lista de agendamentos: data, procedimento, profissional, fotos antes/depois
```

## Fluxo de Agendamento com Plano

```
/agendamentos (com state.pendingPlanId)
├── Banner: "Plano X selecionado"
├── Procedimento pré-selecionado (primeiro do plano, ou modal se >1)
├── Paciente escolhe: profissional + data/hora
└── Confirmar agendamento
    └── Backend: se subscription PENDING → atualiza para ACTIVE
```

## Regras de Negócio

- Plano fica `PENDING` ao contratar, vira `ACTIVE` apenas ao completar o 1º agendamento
- Pagamento é feito diretamente com a clínica (WhatsApp/telefone), fora do sistema
- Se paciente já tem o plano `ACTIVE` ou `PENDING`, não mostra botão "Contratar" no card
- Plano `PENDING` aparece tanto nas promoções (badge) quanto em Meus Planos

## Componentes Novos

- `components/patient-portal/PlanCard.tsx` — Card visual com foto e status
- `components/patient-portal/PlanContractModal.tsx` — Modal de detalhes + confirmação
- `components/patient-portal/PlanHistoryDrawer.tsx` — Drawer lateral com histórico

## Modificações Existentes

### Frontend
- `pages/patient-portal/PatientPlans.tsx` — adiciona seção de promoções + abre drawer
- `pages/PublicBooking.tsx` — lê `location.state.pendingPlanId`, mostra banner, pula seleção

### Backend
- `GET /api/subscriptions/patients/my` — inclui status `PENDING` na query
- `POST /api/subscriptions/patients` — novo endpoint, cria subscription com status `PENDING`
- `GET /api/subscriptions/patients/[id]/history` — novo endpoint, retorna appointments do plano
- `POST /api/appointments` (booking público) — ao criar agendamento com `planId`, ativa subscription `PENDING` → `ACTIVE`

## Schema
Nenhuma mudança necessária. `PatientSubscription.status` já suporta `PENDING`.
