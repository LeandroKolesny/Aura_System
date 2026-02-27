# King Area Layout Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Atualizar o visual da área King para cream + serif + cards, mantendo sidebar intacta.

**Architecture:** Todas as mudanças ficam em `pages/king/*.tsx`. Nenhum novo arquivo necessário. KingLayout controla fundo e topbar; cada página de listagem converte sua tabela em grade de cards.

**Tech Stack:** React, TypeScript, Tailwind CSS.

---

### Task 1: KingLayout — Fundo cream + topbar refinada

**Files:**
- Modify: `pages/king/KingLayout.tsx`

**Step 1: Trocar fundo do `<main>`**

Linha atual:
```tsx
<div className="min-h-screen bg-slate-100 flex">
```
Trocar por:
```tsx
<div className="min-h-screen bg-[#FDFBF8] flex">
```

**Step 2: Refinar o `<header>` da topbar**

Trocar o `<header>` completo por:
```tsx
<header className="bg-[#FDFBF8] border-b border-amber-100/60 px-8 py-4 sticky top-0 z-10">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-[10px] text-amber-600/70 uppercase tracking-[0.2em] font-medium">Aura System</p>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-xl font-bold text-slate-900">Painel Administrativo Master</h2>
    </div>
    <div className="flex items-center gap-4">
      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg relative">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
      </button>
      <div className="h-8 w-px bg-amber-100"></div>
      <span className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">
        Owner
      </span>
    </div>
  </div>
</header>
```

**Step 3: Ajustar padding do conteúdo**

```tsx
<div className="p-8">
```
→
```tsx
<div className="px-8 py-6">
```

**Step 4: Commit**
```bash
git add pages/king/KingLayout.tsx
git commit -m "feat(king): cream background + refined topbar with serif title"
```

---

### Task 2: KingDashboard — StatCards + seções

**Files:**
- Modify: `pages/king/KingDashboard.tsx`

**Step 1: Atualizar o componente `StatCard`**

Substituir o `StatCard` por:
```tsx
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}> = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <p style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);
```

**Step 2: Atualizar seção "Distribuição por Plano"**

No container da seção:
- `rounded-xl` → `rounded-2xl`
- `border-slate-200` → `border-slate-100`
- Título `h3`: adicionar `style={{ fontFamily: "'Cormorant Garamond', serif" }}`

**Step 3: Atualizar seção "Receita Operacional do Mês"**

- Container: mesmas mudanças acima
- Valor: `text-4xl font-bold text-emerald-600` → adicionar `style={{ fontFamily: "'Cormorant Garamond', serif" }}` e trocar para `text-5xl text-emerald-700`

**Step 4: Atualizar header da página**

```tsx
<h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
  <Crown className="w-8 h-8 text-amber-500" />
  King Dashboard
</h1>
```
→
```tsx
<h1 style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-3xl font-bold text-slate-900">
  King Dashboard
</h1>
```

**Step 5: Commit**
```bash
git add pages/king/KingDashboard.tsx
git commit -m "feat(king): serif typography + refined cards in dashboard"
```

---

### Task 3: KingCompanies — Tabela → Grade de Cards

**Files:**
- Modify: `pages/king/KingCompanies.tsx`

**Step 1: Substituir o bloco `<table>...</table>` pelo componente `CompanyCard`**

Criar o card inline (logo acima do `return` do componente):
```tsx
const CompanyCard: React.FC<{ company: Company }> = ({ company }) => {
  const expiresAt = company.subscriptionExpiresAt
    ? new Date(company.subscriptionExpiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Sem data';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-amber-100 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 font-bold text-lg flex items-center justify-center shrink-0">
          {company.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: "'Cormorant Garamond', serif" }} className="font-bold text-slate-900 text-lg leading-tight truncate">{company.name}</p>
          <p className="text-xs text-slate-400 truncate">{company.slug}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <PlanBadge plan={company.plan} />
        <StatusBadge status={company.subscriptionStatus} />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { icon: Users, label: 'Pacientes', value: company._count.patients },
          { icon: CalendarCheck, label: 'Agend.', value: company._count.appointments },
          { icon: Building, label: 'Usuários', value: company._count.users },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="text-center p-2 bg-slate-50 rounded-xl">
            <Icon className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-slate-800">{value}</p>
            <p className="text-[10px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Expiração */}
      <p className="text-xs text-slate-400">Expira: <span className="text-slate-600 font-medium">{expiresAt}</span></p>
    </div>
  );
};
```

**Step 2: Substituir o bloco da tabela pela grade**

Onde estava `<div className="overflow-x-auto">...<table>...</table></div>`, colocar:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {companies.map(company => (
    <CompanyCard key={company.id} company={company} />
  ))}
</div>
```

**Step 3: Refinamento da paginação**

Trocar os botões de paginação por:
```tsx
className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
```

**Step 4: Commit**
```bash
git add pages/king/KingCompanies.tsx
git commit -m "feat(king): companies table → card grid"
```

---

### Task 4: KingPatients — Tabela → Grade de Cards

**Files:**
- Modify: `pages/king/KingPatients.tsx`

**Step 1: Criar `PatientCard` inline**

```tsx
const PatientCard: React.FC<{ patient: Patient }> = ({ patient }) => {
  const lastVisit = patient.lastVisit
    ? new Date(patient.lastVisit).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Sem visita';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-amber-100 transition-all duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center shrink-0">
          {patient.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{patient.name}</p>
          <p className="text-xs text-amber-600 truncate">{patient.company.name}</p>
        </div>
        <StatusBadge status={patient.status} />
      </div>

      {/* Contato */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Mail className="w-3 h-3 shrink-0" />
          <span className="truncate">{patient.email || '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Phone className="w-3 h-3 shrink-0" />
          <span>{patient.phone || '—'}</span>
        </div>
      </div>

      {/* Última visita */}
      <p className="text-xs text-slate-400 border-t border-slate-50 pt-2">Última visita: <span className="text-slate-600 font-medium">{lastVisit}</span></p>
    </div>
  );
};
```

**Step 2: Substituir tabela pela grade**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {patients.map(patient => (
    <PatientCard key={patient.id} patient={patient} />
  ))}
</div>
```

**Step 3: Commit**
```bash
git add pages/king/KingPatients.tsx
git commit -m "feat(king): patients table → card grid"
```

---

### Task 5: KingAppointments — Tabela → Grade de Cards

**Files:**
- Modify: `pages/king/KingAppointments.tsx`

Ler o arquivo primeiro para identificar o interface `Appointment` e o bloco da tabela, depois criar `AppointmentCard` com os campos: avatar do paciente, nome, status, procedimento, data/hora, clínica, preço.

**Card:**
```tsx
<div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-amber-100 transition-all duration-200">
  {/* header: avatar + nome + status badge */}
  {/* body: procedimento, data, clínica, preço */}
</div>
```

Grade 3 colunas igual às anteriores. Commit ao finalizar.

---

### Task 6: KingRevenue — Tabela → Grade de Cards

**Files:**
- Modify: `pages/king/KingRevenue.tsx`

Ler o arquivo, identificar interface de transação e tabela. Criar `TransactionCard`:
- Tipo (INCOME verde / EXPENSE vermelho) + status PAID
- Valor em `font-serif text-2xl`
- Descrição, data, método de pagamento, nome da clínica

Grade 3 colunas. Commit ao finalizar.

---

### Task 7: KingLeads + KingAlerts — Refinamento

**Files:**
- Modify: `pages/king/KingLeads.tsx`
- Modify: `pages/king/KingAlerts.tsx`

Para cada arquivo:
1. Ler e identificar se usa tabela ou lista
2. Se tabela → converter para cards seguindo o mesmo padrão
3. Se já usa cards/lista → apenas aplicar `rounded-2xl`, `border-slate-100`, `shadow-sm`

Commit separado para cada arquivo.

---

### Task 8: Deploy

**Step 1: Build local**
```bash
npm run build
```
Expected: sem erros TypeScript.

**Step 2: Deploy**
```bash
vercel --prod --yes
```

**Step 3: Checklist visual em `/king/`**
- [ ] Fundo cream em todo o conteúdo
- [ ] Topbar com título serif e borda âmbar
- [ ] Badge "Owner" dourado sólido
- [ ] Cards KPI com valores em Cormorant Garamond
- [ ] Empresas em grade de cards (3 colunas)
- [ ] Pacientes em grade de cards
- [ ] Agendamentos em grade de cards
- [ ] Receita em grade de cards
- [ ] Hover âmbar em todos os cards
