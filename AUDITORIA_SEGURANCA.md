# 🔒 AUDITORIA DE SEGURANÇA - REGRAS DE NEGÓCIO
## Aura System - Frontend vs Backend

> **PRINCÍPIO:** NUNCA confiar no frontend. Toda validação e regra de negócio DEVE estar no backend.

**Última atualização:** 2025-12-28

---

## ✅ REGRAS IMPLEMENTADAS NO BACKEND

### 1. AUTENTICAÇÃO & AUTORIZAÇÃO
- [x] Login com JWT (`/api/auth/login`)
- [x] Verificação de token em todas as rotas (`getAuthUser`)
- [x] Controle de acesso por ROLE (OWNER, ADMIN, ESTHETICIAN, RECEPTIONIST)
- [x] Isolamento por companyId (multi-tenant)
- [x] **RATE LIMITING** - Proteção contra força bruta (5 tentativas/15min) ✨ NOVO
- [x] **LOG DE AUDITORIA** - Login bem-sucedido e falhas registradas ✨ NOVO

### 2. PACIENTES (`/api/patients`)
- [x] Validação de CPF (algoritmo completo)
- [x] Validação de e-mail
- [x] Validação de telefone
- [x] Validação de data de nascimento
- [x] Isolamento por companyId
- [x] Permissões: apenas roles permitidos podem criar/editar

### 3. AGENDAMENTOS (`/api/appointments`)
- [x] **CONFLITO DE HORÁRIO** - Verificação completa no servidor
- [x] Validação de data mínima (30 min antecedência)
- [x] Paciente só vê seus próprios agendamentos
- [x] Verificação de existência de paciente/procedimento
- [x] Transições de status válidas (SCHEDULED → CONFIRMED → COMPLETED)
- [x] Baixa de estoque ao completar (`/api/appointments/[id]/status`)

### 4. PROCEDIMENTOS (`/api/procedures`)
- [x] Validação de preço/custo
- [x] Validação de duração (15min - 8h)
- [x] Criação de supplies (insumos)
- [x] Isolamento por companyId

### 5. ESTOQUE (`/api/inventory`)
- [x] Validação de estoque mínimo
- [x] Alerta de estoque baixo
- [x] Movimentação de estoque registrada

### 6. TRANSAÇÕES (`/api/transactions`)
- [x] Apenas ADMIN/OWNER podem ver financeiro
- [x] Validação de valores
- [x] Isolamento por companyId

### 7. PAGAMENTO (`/api/appointments/[id]/pay`)
- [x] Cria transação de RECEITA
- [x] Cria transação de DESPESA (insumos)
- [x] Baixa estoque
- [x] Atualiza última visita do paciente

### 8. PERMISSÕES POR PLANO ✨ NOVO
- [x] **Middleware de verificação** (`/lib/apiGuards.ts`)
- [x] `checkModuleAccess()` - Verifica acesso ao módulo
- [x] `checkWriteAccess()` - Bloqueia escrita em plano expirado
- [x] `checkPatientLimit()` - Verifica limite de pacientes
- [x] `checkProfessionalLimit()` - Verifica limite de profissionais

### 9. HORÁRIO DE FUNCIONAMENTO ✨ NOVO
- [x] **Validação no servidor** (`/lib/businessHours.ts`)
- [x] `isWithinBusinessHours()` - Verifica horário da empresa
- [x] `checkUnavailability()` - Verifica indisponibilidade do profissional
- [x] `validateAppointmentTime()` - Validação completa antes de criar agendamento

### 10. REGRAS DE INDISPONIBILIDADE ✨ NOVO
- [x] **API completa** (`/api/unavailability`)
- [x] GET - Listar regras
- [x] POST - Criar regra (férias, feriados, bloqueios)
- [x] DELETE - Remover regra

### 11. COMISSÕES DE PROFISSIONAIS ✨ NOVO
- [x] **API de relatório** (`/api/reports/commissions`)
- [x] Cálculo de comissão por período
- [x] Suporte a tipos: FIXED, COMMISSION, MIXED

---

## ⚠️ REGRAS PENDENTES / MELHORIAS FUTURAS

### 1. FOTOS ANTES/DEPOIS
**Frontend:** `PhotoRecord` com upload
**Backend:** ⚠️ Tabela existe, API não implementada

### 2. TICKETS DE SUPORTE
**Frontend:** Sistema de tickets completo
**Backend:** ⚠️ Tabela existe, API não implementada

### 3. ALERTAS DO SISTEMA
**Frontend:** `SystemAlert` para comunicações
**Backend:** ⚠️ Tabela existe, API não implementada

### 4. ASSINATURA DIGITAL (Consentimento)
**Frontend:** `signConsent`, `signAppointmentConsent`
**Backend:** ⚠️ Schema existe, API incompleta

---

## 📂 ARQUIVOS CRIADOS NESTA IMPLEMENTAÇÃO

```
aura-backend/src/lib/
├── rateLimiter.ts      # Rate limiting para login
├── planPermissions.ts  # Regras de permissão por plano
├── apiGuards.ts        # Guards para APIs
├── businessHours.ts    # Validação de horário de funcionamento
└── auditLog.ts         # Sistema de auditoria

aura-backend/src/app/api/
├── unavailability/
│   ├── route.ts        # CRUD de regras de indisponibilidade
│   └── [id]/route.ts   # Delete por ID
└── reports/
    └── commissions/route.ts  # Relatório de comissões
```

---

## 🔧 MELHORIAS FUTURAS

1. **Migrar Rate Limiter para Redis** (para ambiente distribuído)
2. **Implementar CORS restritivo** no `next.config.js`
3. **Adicionar JWT real** com refresh token
4. **API de Fotos** com upload para S3/Supabase Storage
5. **API de Tickets** para suporte ao cliente
6. **Webhook de pagamento** para integração com Stripe

