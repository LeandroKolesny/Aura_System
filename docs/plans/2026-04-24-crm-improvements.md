# CRM Improvements Design — 2026-04-24

## Objetivo

Melhorar o CRM do painel King com: criação automática de leads no cadastro de clínicas, botão WhatsApp com texto pré-pronto, rastreamento de data de movimentação, modais para estágios Demo/Perdido/Ganho, e notificações de novos leads reutilizando padrões existentes do AppContext.

## Decisões de Design

- **Modelo de dados**: campos diretos no Lead (sem tabela de histórico separada)
- **Notificações**: reutilizar padrão `pendingSubscriptionsCount` do AppContext
- **WhatsApp**: link `wa.me` com texto pré-preenchido, sem integração de API

---

## Seção 1 — Auto-criação de Lead no Cadastro

Quando uma nova clínica se registra (`POST /api/auth/register`), criar automaticamente um Lead no sistema King com `status: 'new'`.

**Campos mapeados do registro:**
- `clinicName` ← nome da empresa
- `contactName` ← nome do admin
- `phone` ← telefone fornecido
- `email` ← email do admin
- `status` ← `'new'`
- `companyId` ← id da empresa recém-criada

**Implementação:** ao final do handler de registro, após criar Company + User, inserir Lead via `prisma.lead.create()`. Falha no lead não deve bloquear o registro (try/catch isolado).

---

## Seção 2 — Notificações de Novos Leads

Reutiliza exatamente o padrão de `pendingSubscriptionsCount`.

### Modelo
Adicionar campo `seenByOwner: Boolean @default(false)` ao modelo `Lead` no Prisma.

### AppContext
- `leads: Lead[]` — já existe e já é carregado via `kingApi.leads()` para OWNER
- Adicionar `newLeadsCount: number` — valor computado: `leads.filter(l => !l.seenByOwner).length`
- Expor no contexto ao lado de `pendingSubscriptionsCount`

### KingLayout — Badge no menu CRM
Mesmo JSX que o Sidebar usa para assinaturas pendentes:
```tsx
{newLeadsCount > 0 && (
  <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
    {newLeadsCount}
  </span>
)}
```

### KingDashboard — Widget
Card "Novos Leads" mostrando contagem + lista dos 3 mais recentes não vistos, usando o array `leads` já disponível no contexto.

### Marcar como visto
Ao entrar em `/king/leads`, chamar `PATCH /api/king/leads/mark-seen` → seta `seenByOwner: true` em todos os leads do owner → `newLeadsCount` zera.

---

## Seção 3 — Cards e UI

### Botão WhatsApp
Ícone verde no rodapé de cada card. Monta URL:
```
https://wa.me/55{phone}?text={encodeURIComponent(text)}
```

Texto pré-preenchido:
```
Olá, {contactName}! 👋
Aqui é da equipe Aura System. Vi que {clinicName} se cadastrou na nossa plataforma.
Gostaria de entender melhor as suas necessidades e mostrar como podemos ajudar a gestão da sua clínica. Tem um minutinho para conversar?
```

### Data de movimentação
Linha em cinza abaixo do nome no card: `Movido há 2 dias` (calculado de `movedAt`). Na coluna "Novo", exibe `Criado há X dias` (de `createdAt`).

### Novos campos no `interface Lead` (types.ts)
```ts
seenByOwner?: boolean;
movedAt?: string;
demoAt?: string;
demoNotes?: string;
lostReason?: string;
lostComment?: string;
wonPlan?: string;
```

---

## Seção 4 — Modais por Estágio

Ao mover lead para Demo, Perdido ou Ganho, abre modal antes de confirmar. Mover entre Novo → Contactado → Negociação atualiza diretamente sem modal.

### Modal: Demo Agendada
- Campo: Data e hora da reunião (`datetime-local`)
- Campo: Observações (textarea)
- Botão: "Confirmar Demo"
- Salva: `demoAt`, `demoNotes`, `status: 'demo'`, `movedAt: now`

### Modal: Perdido
Motivos pré-definidos (radio):
1. Preço muito alto
2. Escolheu concorrente
3. Sem interesse no momento
4. Não respondeu mais
5. Outro

Campo de comentário opcional (textarea).
Botão: "Registrar Perda"
Salva: `lostReason`, `lostComment`, `status: 'lost'`, `movedAt: now`

### Modal: Ganho (Won)
Seleção visual do plano contratado — cards com nome e preço (mesmo estilo dos planos existentes no sistema).
Botão: "Confirmar Venda"
Salva: `wonPlan`, `status: 'won'`, `movedAt: now`

---

## Mudanças por Arquivo

### Backend (`aura-backend/`)
| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Adicionar `seenByOwner`, `movedAt`, `demoAt`, `demoNotes`, `lostReason`, `lostComment`, `wonPlan` ao modelo `Lead` |
| `src/app/api/auth/register/route.ts` | Criar Lead automaticamente após registro |
| `src/app/api/king/leads/route.ts` | Incluir novos campos na resposta |
| `src/app/api/king/leads/mark-seen/route.ts` | Novo endpoint PATCH |
| `src/app/api/king/leads/[id]/route.ts` | Aceitar e salvar novos campos no PATCH |

### Frontend (`/`)
| Arquivo | Mudança |
|---------|---------|
| `types.ts` | Novos campos em `interface Lead` |
| `context/AppContext.tsx` | Expor `newLeadsCount` computado |
| `pages/king/KingLayout.tsx` | Badge no item CRM usando `newLeadsCount` |
| `pages/king/KingDashboard.tsx` | Widget de novos leads |
| `pages/king/KingLeads.tsx` | Botão WhatsApp, data de movimentação, modais Demo/Perdido/Won |

---

## Ordem de Implementação

1. Schema Prisma + migration
2. Endpoint `mark-seen`
3. Auto-criação de lead no registro
4. `types.ts` + AppContext (`newLeadsCount`)
5. Badge no KingLayout + widget no KingDashboard
6. KingLeads: botão WhatsApp + campo `movedAt` nos cards
7. KingLeads: modais Demo, Perdido, Won
