# Relatório de Retorno de Pacientes — Design
> Decisões validadas em 22/03/2026

## Decisões

- **Localização:** Aba "Retorno de Pacientes" dentro de `/reports` (lazy load ao clicar)
- **Classificação de risco:** Dinâmica por procedimento (`maintenanceIntervalDays`)
- **Fallback sem intervalo:** 60 dias como base padrão
- **Ação:** Botão que abre WhatsApp com mensagem pré-preenchida

## Níveis de Risco

```
daysOverdue <= 10  → 🟡 Atenção
daysOverdue <= 30  → 🟠 Em Risco
daysOverdue >  30  → 🔴 Perdida
```

`daysOverdue = hoje - (última visita + maintenanceIntervalDays)`

## UI

**KPI cards:** Atenção | Em Risco | Perdidas | Taxa de Retenção

**Filtros:** Período (30/60/90 dias) | Profissional

**Tabela:** Nome | Último Procedimento | Última Visita | Retorno Esperado | Dias em Atraso | Risco | WhatsApp

## Mensagem WhatsApp

```
Oi {nome}! 😊

Aqui é da {clinica}.
Notamos que faz um tempinho desde sua última visita
de {procedimento} em {data}.

Que tal agendarmos sua próxima sessão? 🗓️
```

## Backend

**Rota:** `GET /api/retention?period=90&professionalId=xxx`

**Lógica:**
1. Busca último agendamento COMPLETED por paciente
2. Join com procedure → pega `maintenanceIntervalDays` (fallback: 60 dias)
3. Calcula `expectedReturn = lastVisit + interval`
4. Filtra `hoje > expectedReturn`
5. Calcula `daysOverdue` e classifica risco

**Response:**
```json
{
  "summary": { "attention": 8, "at_risk": 12, "lost": 5, "retentionRate": 73 },
  "patients": [{
    "id": "...", "name": "...", "phone": "...",
    "lastProcedure": "Limpeza de Pele",
    "lastVisit": "2026-02-10",
    "expectedReturn": "2026-03-12",
    "daysOverdue": 10,
    "risk": "attention",
    "intervalUsed": 30,
    "isDefaultInterval": false
  }]
}
```

## Schema (sem migration necessária)
Todos os campos já existem: `Appointment.date`, `Appointment.status`, `Patient.phone`, `Procedure.maintenanceIntervalDays`, `Procedure.maintenanceRequired`

## Arquivos a criar/editar
- `aura-backend/src/app/api/retention/route.ts` — rota nova
- `pages/Reports.tsx` — adicionar tabs + lazy load
- `components/RetentionTab.tsx` — componente novo
- `services/api.ts` — adicionar `getRetentionReport()`
