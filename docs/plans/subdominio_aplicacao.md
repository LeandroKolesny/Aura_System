# Portal do Paciente - Documentação Técnica

## Visão Geral

O sistema Aura terá duas "aplicações" distintas no mesmo código:

1. **Sistema Administrativo** - Para as clínicas gerenciarem seus negócios
2. **Portal do Paciente** - Para os pacientes de cada clínica

**Abordagem Híbrida:**
- Localhost usa PATH para identificar a clínica
- Produção usa SUBDOMÍNIO para identificar a clínica

---

## URLs por Ambiente

### Localhost (Desenvolvimento)

| URL | Aplicação |
|-----|-----------|
| `localhost:3000/` | Landing page (Admin) |
| `localhost:3000/login` | Login Admin |
| `localhost:3000/dashboard` | Dashboard Admin |
| `localhost:3000/clinica-aura/` | Portal - Página inicial |
| `localhost:3000/clinica-aura/login` | Portal - Login paciente |
| `localhost:3000/clinica-aura/agendamentos` | Portal - Meus agendamentos |

### Produção

| URL | Aplicação |
|-----|-----------|
| `aurasystem.com/` | Landing page (Admin) |
| `aurasystem.com/login` | Login Admin |
| `www.aurasystem.com/dashboard` | Dashboard Admin |
| `clinica-aura.aurasystem.com/` | Portal - Página inicial |
| `clinica-aura.aurasystem.com/login` | Portal - Login paciente |
| `clinica-aura.aurasystem.com/agendamentos` | Portal - Meus agendamentos |

---

## Lógica de Detecção

```typescript
// utils/subdomain.ts

export function getClinicSlug(): string | null {
  const host = window.location.host;
  const pathname = window.location.pathname;

  // LOCALHOST - detecta pelo PATH
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return extractSlugFromPath(pathname);
  }

  // PRODUÇÃO - detecta pelo SUBDOMÍNIO
  const parts = host.split('.');

  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain !== 'www') {
      return subdomain; // é portal de clínica
    }
  }

  return null; // é sistema admin
}
```

---

## Estrutura do App.tsx

```typescript
function App() {
  const clinicSlug = getClinicSlug();

  if (clinicSlug) {
    // Portal do Paciente
    return <PatientPortalApp clinicSlug={clinicSlug} />;
  }

  // Sistema Admin (código atual)
  return <AdminApp />;
}
```

---

## O Que Já Temos (Reutilizar)

### Componentes reutilizáveis:
- `Schedule.tsx` - Já filtra agendamentos por paciente
- `Procedures.tsx` - Lista procedimentos da clínica
- `PatientHistory.tsx` - Histórico do paciente
- `PublicBooking.tsx` - Página de agendamento público

### O que criar:
- `utils/subdomain.ts` - Detecta clínica
- `apps/PatientPortalApp.tsx` - App do portal
- `components/patient-portal/PatientSidebar.tsx` - Sidebar simplificada
- `pages/patient-portal/PatientLogin.tsx` - Login do paciente
- `pages/patient-portal/PatientDashboard.tsx` - Dashboard do paciente
- `context/ClinicContext.tsx` - Contexto com dados da clínica

---

## Estrutura de Arquivos

```
src/
├── utils/
│   └── subdomain.ts              # Detecção de clínica
│
├── apps/
│   ├── AdminApp.tsx              # Sistema admin (extraído do App.tsx atual)
│   └── PatientPortalApp.tsx      # Portal do paciente
│
├── components/
│   └── patient-portal/
│       └── PatientSidebar.tsx    # Sidebar do portal
│
├── pages/
│   └── patient-portal/
│       ├── PatientLogin.tsx      # Login paciente
│       └── PatientDashboard.tsx  # Dashboard paciente
│
├── context/
│   └── ClinicContext.tsx         # Dados da clínica para o portal
│
└── App.tsx                       # Decisor: Admin ou Portal
```

---

## Rotas do Portal do Paciente

### Localhost (com PATH)

```
/clinica-aura/                → Página inicial (agendamento)
/clinica-aura/login           → Login do paciente
/clinica-aura/cadastro        → Cadastro do paciente
/clinica-aura/minha-conta     → Dashboard
/clinica-aura/agendamentos    → Meus agendamentos
/clinica-aura/procedimentos   → Procedimentos disponíveis
/clinica-aura/historico       → Meu histórico
/clinica-aura/documentos      → Termos e assinaturas
```

### Produção (com SUBDOMÍNIO)

```
/                → Página inicial (agendamento)
/login           → Login do paciente
/cadastro        → Cadastro do paciente
/minha-conta     → Dashboard
/agendamentos    → Meus agendamentos
/procedimentos   → Procedimentos disponíveis
/historico       → Meu histórico
/documentos      → Termos e assinaturas
```

**Nota:** Em produção as rotas são mais limpas porque o slug já está no subdomínio.

---

## Configuração de Produção

### 1. DNS (Cloudflare, Route53, etc.)

Adicionar registro wildcard:

```
Tipo: CNAME
Nome: *
Destino: cname.vercel-dns.com
TTL: Auto
```

### 2. Vercel

1. Settings → Domains
2. Adicionar: `aurasystem.com`
3. Adicionar: `www.aurasystem.com`
4. Adicionar: `*.aurasystem.com` (wildcard para portais)

### 3. Verificação

```
aurasystem.com                    → Sistema Admin ✅
www.aurasystem.com                → Sistema Admin ✅
clinica-aura.aurasystem.com       → Portal "Clínica Aura" ✅
outra-clinica.aurasystem.com      → Portal "Outra Clínica" ✅
```

---

## Configurações por Clínica

### onlineBookingConfig

```typescript
interface OnlineBookingConfig {
  // Existentes
  slotInterval: number;
  minAdvanceTime: number;
  maxBookingPeriod: number;
  cancellationNotice: number;
  cancellationPolicy?: string;

  // Novos campos
  allowPatientCancel: boolean;      // Paciente pode cancelar sozinho?
  allowPatientReschedule: boolean;  // Paciente pode remarcar sozinho?
  requireApproval: boolean;         // Novos agendamentos precisam aprovação?
}
```

---

## APIs

### Existentes (reutilizar)

```
GET  /api/public/company/{slug}     → Dados da clínica
POST /api/appointments/public       → Criar agendamento público
GET  /api/appointments              → Listar agendamentos (já filtra por user)
```

### Novas (criar quando necessário)

```
POST /api/auth/patient/login        → Login específico para pacientes
POST /api/auth/patient/register     → Cadastro de paciente
GET  /api/patient/profile           → Perfil do paciente logado
PUT  /api/patient/profile           → Atualizar perfil
```

---

## Checklist de Implementação

### Fase 1: Infraestrutura
- [x] Criar `utils/subdomain.ts`
- [x] Criar `apps/PatientPortalApp.tsx`
- [x] Modificar `App.tsx` para detectar e separar
- [ ] Testar localhost com `/clinica-aura/`

### Fase 2: Componentes do Portal
- [ ] Criar `PatientSidebar.tsx`
- [ ] Criar `PatientLogin.tsx`
- [ ] Criar `PatientDashboard.tsx`
- [ ] Criar `ClinicContext.tsx`

### Fase 3: Visual
- [ ] Aplicar cores da clínica via CSS variables
- [ ] Exibir logo da clínica no header

### Fase 4: Produção
- [ ] Configurar DNS wildcard
- [ ] Configurar Vercel
- [ ] Testar subdomínios

---

## Resumo

| Aspecto | Sistema Admin | Portal Paciente |
|---------|---------------|-----------------|
| **Localhost** | `localhost:3000/login` | `localhost:3000/clinica/login` |
| **Produção** | `aurasystem.com/login` | `clinica.aurasystem.com/login` |
| **Usuários** | ADMIN, STAFF | PATIENT |
| **Visual** | Padrão Aura | Cores da clínica |
| **Sidebar** | Completa | Simplificada |
| **Código** | Atual | 70% reutilizado |

---

*Documento criado em: 2024-12-29*
*Última atualização: 2024-12-29*
