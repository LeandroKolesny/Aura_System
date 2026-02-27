# King Area Layout Redesign — Design Document
**Data:** 2026-02-27

## Contexto

A área King (`/king/*`) é o painel master do SaaS, acessível apenas pelo OWNER. Atualmente usa `bg-slate-100` no conteúdo, topbar branca genérica, cards com `rounded-xl` e tabelas brutas nas páginas de listagem. O objetivo é elevar o visual para o mesmo nível da área admin — sem alterar a sidebar (`bg-slate-900` + acentos âmbar).

---

## O Que Muda

### 1. KingLayout — Fundo + Topbar

**Fundo do conteúdo:**
- `bg-slate-100` → `bg-[#FDFBF8]` (cream, igual ao admin)

**Topbar refinada:**
- Fundo: `bg-[#FDFBF8]` (era `bg-white`)
- Borda inferior: `border-amber-100/60` (era `border-slate-200`)
- Subtítulo "Aura System": `text-[10px] uppercase tracking-[0.2em] text-amber-600/70`
- Título: `font-serif text-xl font-bold text-secondary-900` (Cormorant Garamond)
- Badge "Owner": `bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase` (era `bg-amber-100 text-amber-700`)

**Padding do conteúdo:**
- `p-8` → `px-8 py-6`

---

### 2. KingDashboard — Cards KPI + Seções

**StatCard:**
- `rounded-xl` → `rounded-2xl`
- `border-slate-200` → `border-slate-100`
- Valor: `font-serif text-3xl font-bold text-secondary-900`
- Ícone: mantém fundo colorido com `rounded-xl`

**Seção "Distribuição por Plano" e "Receita do Mês":**
- `rounded-xl` → `rounded-2xl`, `border-slate-200` → `border-slate-100`
- Títulos das seções: `font-serif font-bold text-secondary-900`
- Receita do mês: `font-serif text-5xl font-bold text-emerald-700`

**Header da página:**
- Título: `font-serif text-3xl font-bold text-secondary-900`
- Remove ícone Crown inline (fica só no topbar)

---

### 3. Páginas de Listagem — Cards em vez de Tabelas

**Estrutura comum a todas:**
```
[Busca + Filtros]
[Grade: 3 colunas desktop / 2 tablet / 1 mobile]
[Paginação]
```

**Container da grade:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

**Card base:**
```tsx
className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5
           hover:shadow-md hover:border-amber-100 transition-all duration-200"
```

---

#### KingCompanies — Company Card

```
┌─────────────────────────────────────┐
│ [A]  Clínica Aura Estética          │
│      PREMIUM  ·  ACTIVE ✓           │
│ ─────────────────────────────────── │
│  👥 12 pac   📅 48 appts   👤 4     │
│  Expira: 26/02/2027                 │
└─────────────────────────────────────┘
```

- Avatar: inicial da empresa, `bg-amber-100 text-amber-700 font-bold rounded-xl`
- Nome: `font-serif font-bold text-secondary-900`
- Plan badge: cores existentes
- Status badge: `StatusBadge` existente
- 3 métricas em linha: ícone pequeno + número + label

#### KingPatients — Patient Card

```
┌──────────────────────────────────┐
│ [M]  Maria Santos      ATIVO     │
│      Clínica Aura Estética       │
│ ──────────────────────────────── │
│  ✉ maria@email.com               │
│  📞 (11) 98888-1111              │
│  Última visita: 15 jan 2026      │
└──────────────────────────────────┘
```

- Avatar: inicial do paciente, `bg-primary-100 text-primary-700 font-bold rounded-full`
- Nome: `font-semibold text-secondary-900`
- Clínica: `text-xs text-amber-600`
- Email + telefone: `text-xs text-slate-500`

#### KingAppointments — Appointment Card

```
┌───────────────────────────────────┐
│ [M]  Maria Santos    COMPLETED    │
│      Limpeza de Pele              │
│ ─────────────────────────────────│
│  📅 15 jan 2026, 10:00           │
│  🏥 Clínica Aura  ·  R$ 250,00  │
└───────────────────────────────────┘
```

#### KingRevenue — Transaction Card

```
┌─────────────────────────────────┐
│  INCOME  ·  PAID                │
│  Procedimento: Botox            │
│ ─────────────────────────────── │
│  R$ 1.200,00                    │
│  📅 20 jan 2026  ·  PIX         │
│  🏥 Clínica Aura Estética       │
└─────────────────────────────────┘
```

- Valor: `font-serif text-2xl font-bold text-emerald-700` (INCOME) ou `text-red-600` (EXPENSE)

#### KingLeads e KingAlerts
- Mesma estrutura de card, adaptando campos relevantes de cada entidade.

---

### 4. Paginação

Estilo atualizado em todas as páginas:
```tsx
className="px-3 py-1.5 rounded-xl border border-slate-200
           hover:border-amber-300 hover:bg-amber-50 transition-colors text-sm"
```

---

## O Que NÃO Muda

- Sidebar: `bg-slate-900`, acentos âmbar, estrutura de navegação
- Lógica de negócio, APIs, filtros, paginação
- Badges `StatusBadge` e `PlanBadge` (apenas refinamento de border-radius)
- Autenticação e guards de rota

---

## Critérios de Sucesso

- Fundo cream em todo o conteúdo (sidebar excluída)
- Topbar com tipografia serif e borda âmbar
- Cards KPI com valores em Cormorant Garamond
- Todas as 6 páginas de listagem com grade de cards (sem tabelas)
- Hover âmbar consistente em todos os cards
