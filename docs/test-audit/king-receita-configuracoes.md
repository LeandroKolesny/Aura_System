# Auditoria de Testes — Receita e Configurações do Painel King (Owner)

> Escopo: `pages/king/KingRevenue.tsx`, `pages/king/KingSettings.tsx` e as rotas de backend que essas duas telas efetivamente chamam. 4ª e ÚLTIMA das tarefas sequenciais sobre o painel King — segue o trabalho do Agente 1 (login/layout/dashboard, `docs/test-audit/king-login-layout-dashboard.md`), do Agente 2 (Empresas/Pacientes/Agendamentos, `docs/test-audit/king-empresas-pacientes-agendamentos.md`) e do Agente 3 (Leads/Alertas, `docs/test-audit/king-leads-alertas.md`). O `kingGuard.ts` (`requireOwner`) já foi auditado a fundo pelo Agente 1 — não foi reauditado aqui.

## Descoberta central desta tarefa

Diferente das 3 tarefas anteriores, **nenhuma das duas telas deste escopo usa uma rota própria em `/api/king/*` para escrita** (só `KingRevenue.tsx` usa uma rota `/api/king/*`, e só para leitura). Ambas reaproveitam rotas genéricas já existentes fora do namespace King:

- `KingRevenue.tsx`: `GET /api/king/companies` (leitura, com `requireOwner`) + `GET /api/plans` (pública).
- `KingSettings.tsx`: `saasPlans`/`companies` do `AppContext` (que por sua vez usam `GET/POST/PATCH/DELETE /api/plans*` e `GET /api/companies`) + `PUT /api/companies/[id]` (para as duas únicas ações de escrita da tela: estender assinatura e trocar plano de uma empresa) + `GET/POST /api/system/maintenance`.

Essa segunda rota — `PUT /api/companies/[id]` — é a mesma usada por `Settings.tsx` (ADMIN de clínica) e pelo fluxo de conversão/perda de leads do King (`KingLeads.tsx`, fora do escopo de arquivos desta tarefa, mas documentado pelo Agente 3). Uma correção de segurança recente e não relacionada ao painel King (commit `eb40d6a`, tarefa de "Configurações" do ADMIN) tornou `updateCompanySchema` `.strict()` sem incluir `plan`/`subscriptionStatus`/`subscriptionExpiresAt` — bloqueando corretamente um ADMIN de se auto-promover de plano, mas **quebrando por completo as duas ações de escrita do Owner em `KingSettings.tsx`** (e, como efeito colateral positivo da correção aplicada aqui, também as de `KingLeads.tsx`, que dependiam exatamente da mesma rota). Ver bug #2 abaixo.

## Funcionalidades identificadas

### `pages/king/KingRevenue.tsx` (`/king/revenue`) — "Receita e Assinaturas"
Tela 100% de leitura (nenhuma ação de escrita). Ao montar, `loadData()` chama em paralelo `kingApi.companies({ limit: 200 })` e `plansApi.list()` e deriva tudo em memória (`useMemo`/cálculos inline), sem nenhuma outra chamada de rede:

1. **KPIs principais**: MRR Atual (soma do preço do plano de empresas `ACTIVE`, excluindo empresas do próprio OWNER via `hasOwner`), ARR Projetado (`MRR × 12`), MRR Potencial (soma do preço do plano de empresas `TRIAL`), MRR em Risco (soma do preço do **plano anterior** — `lastPlan` — de empresas `OVERDUE`, já que o `plan` atual delas já foi rebaixado para `BASIC`/preço 0 pelo cron `check-subscriptions`).
2. **Status das Assinaturas**: barra de distribuição por `subscriptionStatus` (`ACTIVE`/`TRIAL`/`OVERDUE`/`CANCELED`) sobre 100% das empresas (aqui SEM excluir `hasOwner`).
3. **Próximos Vencimentos (30 dias)**: empresas `ACTIVE`/`TRIAL` com `subscriptionExpiresAt` nos próximos 30 dias, com contato do admin (email/telefone, clicáveis via `mailto`/`tel`).
4. **Empresas Inadimplentes**: lista expandida de todas as `OVERDUE`, mostrando "Era: `<lastPlan>`" → "BASIC (Bloqueado)" e o valor mensal perdido.
5. **Receita por Plano**: agrupamento por `SaasPlan` (exceto `FREE`/`BASIC`), com MRR por plano e lista expansível (`CompanyCard`) das empresas daquele plano.
6. **Resumo Financeiro**: total de empresas, taxa de conversão (`ACTIVE / total`), ticket médio (`MRR / nº ativos`), churn rate (`CANCELED / total`).
7. Botão "Atualizar" recarrega os dois endpoints.

### `pages/king/KingSettings.tsx` (`/king/settings`) — "Configurações do Sistema" (4 abas)
A maior tela do painel King (963 linhas). Estado vem majoritariamente do `AppContext` (`saasPlans`, `companies`), não de chamadas próprias — só o Modo Manutenção usa `systemApi` diretamente.

**Aba "Planos & Precos"** (2 seções):
1. **Gestão de Ativações**: tabela com TODAS as `companies` do `AppContext` (carregadas uma vez no login via `companiesApi.list({limit:100})` — sem paginação/busca própria nesta tela; empresas além das 100 primeiras não aparecem, limitação pré-existente não corrigida por não ter causa raiz de bug, só de escala). Duas ações por empresa: "Adicionar Tempo" (modal com atalhos de 30/90/365 dias, chama `updateCompany` → `PUT /api/companies/[id]`) e trocar o plano (botão abre modal "Alterar Plano" com a lista de `saasPlans` ativos, também via `updateCompany`).
2. **Configuração de Planos**: CRUD completo de `SaasPlan` — criar (`addPlan`), editar (`updatePlan`), excluir com confirmação (`removePlan`, via `useDialog().confirm`), alternar visibilidade ativo/inativo (`togglePlanVisibility`). Todas as 4 ações já tratavam erro corretamente (`showAlert`/mensagem inline) antes desta sessão — nenhum bug de "resultado de API ignorado" aqui.

**Aba "Notificacoes/Email"**: 5 toggles (nova empresa, inadimplência, relatório semanal, trial expirando, baixa atividade) — **estado 100% local (`useState`), nunca persistido no backend** (comentário no próprio código: "local state - pode ser migrado para API"). Não é um bug desta sessão (é uma feature incompleta/placeholder pré-existente, documentada e fora do escopo de correção de bug — ver "Testes recomendados").

**Aba "Sistema"**: 2 sub-blocos locais (Trial/Carência/Max. Usuários — também placeholders `useState`, mesmo caso acima) + **Modo Manutenção**, que é real: carrega `systemApi.getMaintenance()` ao montar e ativa/desativa via `systemApi.setMaintenance()` (`POST /api/system/maintenance`), com erro tratado tanto inline (`maintenanceError`) quanto via `showAlert` de sucesso.

**Aba "Aparencia"**: 100% estática/decorativa (logo, cor da marca, preview) — nenhum estado, nenhuma chamada de API, nenhum botão de ação real. Não é um bug (é claramente uma seção "em construção"), documentado para não ser confundido com um recurso quebrado.

O botão "Salvar Alteracoes" do cabeçalho (visível fora da aba "Planos & Precos") só existe para as abas Notificações/Sistema/Aparência — e seu handler (`handleSave`) é um `setTimeout` fake que nunca chama nenhuma API, condizente com essas abas serem placeholders.

## Endpoints de backend usados

| Método | Rota | Arquivo | Guard | Chamado por |
|---|---|---|---|---|
| GET | `/api/king/companies` | `aura-backend/src/app/api/king/companies/route.ts` → `queryCompanies` (`lib/queries/index.ts`) | `requireOwner` | `KingRevenue.tsx` (`kingApi.companies`) |
| GET | `/api/plans` | `aura-backend/src/app/api/plans/route.ts` | nenhum (rota pública, também usada pela landing page) | `KingRevenue.tsx` e `KingSettings.tsx` (via `AppContext.loadPlans`) |
| POST | `/api/plans` | idem | `role === OWNER` | `KingSettings.tsx` (`addPlan`) |
| PATCH | `/api/plans/[id]` | `aura-backend/src/app/api/plans/[id]/route.ts` | `role === OWNER` | `KingSettings.tsx` (`updatePlan`, `togglePlanVisibility`) |
| DELETE | `/api/plans/[id]` | idem | `role === OWNER` | `KingSettings.tsx` (`removePlan`) |
| GET | `/api/companies` | `aura-backend/src/app/api/companies/route.ts` | qualquer autenticado (OWNER vê todas; demais só a própria) | `AppContext.loadDataFromApi` (carregado uma vez no login; consumido por `KingSettings.tsx` via `companies`) |
| PUT | `/api/companies/[id]` | `aura-backend/src/app/api/companies/[id]/route.ts` | OWNER ou ADMIN da própria empresa | `KingSettings.tsx` (`updateCompany` → "Adicionar Tempo"/"Alterar Plano") |
| GET | `/api/system/maintenance` | `aura-backend/src/app/api/system/maintenance/route.ts` | `role === OWNER` | `KingSettings.tsx` (carregamento inicial da aba Sistema) |
| POST | `/api/system/maintenance` | idem | `role === OWNER` | `KingSettings.tsx` (`handleToggleMaintenance`) |

### `/api/king/access-logs` — confirmado órfão, não integrado nesta sessão
`aura-backend/src/app/api/king/access-logs/route.ts` (`GET`, `requireOwner`, lista `Activity` do tipo `USER_LOGIN`) **não é chamado por nenhum lugar do frontend** — confirmado por `grep -rn "access-logs" services/ pages/king/` (zero ocorrências). Combina tematicamente com uma tela de "Configurações/Segurança", mas **`KingSettings.tsx` não tem nenhuma seção de log de acesso** (as 4 abas existentes são Planos, Notificações, Sistema, Aparência — nenhuma delas é "Segurança"). Já existe cobertura de teste própria da rota (`aura-backend/src/__tests__/api/access-logs.test.ts`, 9 testes, pré-existente). Por instrução explícita da tarefa, isso fica só documentado — integrar um novo painel de "Log de Acessos" à tela seria uma feature nova, não a correção de um bug.

### `queryTransactions` (`lib/queries/index.ts`) — recomendação do Agente 3 não se aplica a este escopo
O relatório do Agente 3 recomendava que esta tarefa desse a `queryTransactions` o mesmo tratamento de `select` explícito dado a `queryPatients`/`queryAppointments`/`queryCompanies` pelo Agente 2. Confirmado por leitura de código: **nenhuma das duas telas deste escopo usa dados de transação/financeiro**, e uma busca (`grep -rn "queryTransactions"`) mostra que a função **não é chamada em lugar nenhum do backend** — é código morto, sem rota alguma que a invoque. Não há, portanto, vazamento de dado real acontecendo (nenhum endpoint expõe o resultado). Fica registrado para uma limpeza futura (remover a função morta, ou dar-lhe `select` explícito no dia em que alguém a conectar a uma rota), mas não é um bug ativo desta tarefa.

## Cobertura de testes atual (antes desta sessão)

### Backend
- `plans.test.ts` (9 testes) e `plans-id.test.ts` (9 testes) já cobriam bem RBAC (401/403), 404 e o caminho feliz — mas nenhum validava o formato do corpo (não havia validação nenhuma no código).
- `companies-id.test.ts` (45 testes, de uma sessão de "Configurações" do ADMIN) já cobria exaustivamente o PUT, incluindo um describe block que **documentava como intencional** o bloqueio de `plan`/`subscriptionStatus` via `.strict()` — sem perceber que isso quebrava o único caminho de escrita do Owner nessas duas telas King.
- `system-maintenance.test.ts` (9 testes) e `access-logs.test.ts` (9 testes) já cobriam bem essas rotas.
- `queries.test.ts` (Agente 2) já cobria a ausência de vazamento LGPD em `queryCompanies`, mas não teria pego a ausência de `lastPlan` no `select` (não é um campo sensível, é um campo *faltante* que quebra uma métrica de produto).

### Frontend
- **Nenhum teste existia** para `KingRevenue.tsx` ou `KingSettings.tsx` (confirmado: nenhum arquivo com esses nomes em `__tests__/pages/` antes desta sessão).

## Problemas encontrados durante a revisão

1. **[CORRIGIDO — `select` do Prisma incompleto, mesma classe de bug do Agente 2] `aura-backend/src/lib/queries/index.ts`, `queryCompanies`: faltava `lastPlan` no `select`.**
   Evidência: `KingRevenue.tsx` calcula "MRR em Risco" (`atRiskMRR`) e a lista de "Empresas Inadimplentes" com `const planToUse = c.lastPlan || c.plan` — mas a API nunca devolvia `lastPlan` (ausente do `select`), então esse campo era sempre `undefined` e o fallback caía sempre em `c.plan`. Como o cron `aura-backend/src/app/api/cron/check-subscriptions/route.ts` já rebaixa `plan` para `BASIC` (preço R$ 0,00) no momento em que marca a empresa como `OVERDUE` (salvando o plano perdido em `lastPlan`), o resultado era: **"MRR em Risco" sempre mostrava R$ 0,00** e a lista de inadimplentes sempre rotulava "Era: BASIC", independente do plano real que a empresa tinha antes de ficar inadimplente — mesmo com empresas `OVERDUE` reais no banco.
   **Correção aplicada**: adicionado `lastPlan: true` ao `select` de `queryCompanies`.
   **Teste novo**: `aura-backend/src/__tests__/lib/queries-companies-revenue.test.ts` (2 testes — arquivo separado de `queries.test.ts`, que pertence ao escopo do Agente 2, para não alterar o arquivo de outra tarefa da série); `__tests__/pages/KingRevenue.test.tsx` (2 testes cobrindo o comportamento correto de ponta a ponta no frontend).

2. **[CORRIGIDO — regressão de segurança de outra sessão quebrou o único caminho de escrita do Owner] `aura-backend/src/app/api/companies/[id]/route.ts`: `updateCompanySchema` é `.strict()` e não inclui `plan`/`subscriptionStatus`/`subscriptionExpiresAt` — bloqueava esses 3 campos para QUALQUER papel, inclusive OWNER.**
   Evidência: `companies-id.test.ts` (de uma sessão anterior, não-King, commit `eb40d6a`) já tinha um describe block inteiro (`".strict() bloqueia campos sensíveis fora do schema"`) **documentando isso como comportamento correto** — e de fato é correto impedir um ADMIN de clínica de se auto-promover de plano via este endpoint genérico. O problema é que **o mesmo bloqueio também impedia o OWNER**, e não existe nenhuma rota `/api/king/companies/[id]` alternativa para essa escrita. `KingSettings.tsx` usa exatamente este endpoint (via `AppContext.updateCompany`) para as suas duas únicas ações de escrita: `handleAddTime` (envia `subscriptionExpiresAt`+`subscriptionStatus`) e `handleChangePlan` (envia `plan`). Resultado: **"Adicionar Tempo" e "Alterar Plano" sempre falhavam com 400 "Dados inválidos"** para o Owner — o erro já era comunicado via `showAlert` (não é um bug de "erro silencioso"), mas a funcionalidade em si nunca funcionava.
   Efeito colateral positivo confirmado: o mesmo bloqueio também afetava (fora do escopo de arquivos desta tarefa) `KingLeads.tsx` (`handleConversion`/`handleConfirmLost`, Agente 3), que chama `companiesApi.update()` com os mesmos campos para ativar/cancelar assinatura ao converter/perder um lead — a correção aplicada aqui os desbloqueia também, sem que nenhum arquivo do Agente 3 tenha sido tocado.
   **Correção aplicada**: schema estendido (`updateCompanySchemaOwner`, com `plan`/`subscriptionStatus`/`subscriptionExpiresAt` validados por `z.enum`/`z.string().datetime()`), aplicado **somente quando `authUser.role === "OWNER"`**; para os demais papéis, o schema original (sem esses campos) continua em vigor e `.strict()` segue rejeitando com 400 — o teste original que documentava o bloqueio para ADMIN continua passando sem alteração de comportamento. A checagem de papel é repetida de novo ao montar `updateData` (defesa em profundidade), não confiando só na seleção do schema.
   **Testes novos**: `companies-id.test.ts` ganhou uma 3ª asserção de bloqueio (`subscriptionExpiresAt` para ADMIN) e um novo describe block "OWNER pode alterar..." (6 testes: sucesso nos 3 campos, enum inválido nos 2 primeiros, campo normal + `plan` juntos).

3. **[CORRIGIDO — mesma causa raiz do bug #2, valor errado enviado] `pages/king/KingSettings.tsx`, `handleAddTime`: enviava `subscriptionStatus: 'active'` (minúsculo).**
   Evidência (linha original ~148): o enum Prisma `SubscriptionStatus` só aceita `ACTIVE`/`TRIAL`/`OVERDUE`/`CANCELED` (maiúsculo) — mesmo depois de corrigido o bug #2, esse valor continuaria sendo rejeitado pelo `z.enum([...])`. O tipo local `SubscriptionStatus` (`types.ts`) é *intencionalmente* minúsculo (convenção do estado em memória do `AppContext`, que sempre faz `.toLowerCase()` ao ler da API) — mas o valor que de fato viaja pela rede numa escrita precisa bater com o enum do Prisma. `KingLeads.tsx` já contornava isso corretamente enviando `'ACTIVE'`/`'CANCELED'` (maiúsculo) via `companiesApi.update()` direto, sem passar pelo `updateCompany` tipado do contexto.
   **Correção aplicada**: `subscriptionStatus: 'ACTIVE' as unknown as SubscriptionStatus` (cast explícito e comentado, mesma estratégia de valor de `KingLeads.tsx`, sem alterar o tipo compartilhado `Company`/`SubscriptionStatus` usado por dezenas de outros arquivos).
   **Teste novo**: `__tests__/pages/KingSettings.test.tsx` — "abre o modal Adicionar Tempo e envia subscriptionStatus em maiúsculo (ACTIVE)".

4. **[CORRIGIDO — campo errado enviado, mesma causa raiz do bug #2] `pages/king/KingSettings.tsx`, `handleChangePlan`/JSX do modal "Alterar Plano": enviava `plan.id` (cuid do `SaasPlan` no banco) em vez de `plan.name` (o enum Prisma que a coluna `Company.plan` de fato armazena).**
   Evidência (linhas originais): `onClick={() => handleChangePlan(plan.id)}` e `handleChangePlan(planId) { ... updateCompany(company.id, { plan: planId }) }` — como `plan.id` é um cuid (ex. `"clx1a2b3c4"`) e `Company.plan` espera um valor do enum `Plan` (`FREE`/`BASIC`/`STARTER`/.../`ENTERPRISE`), a comparação nunca correspondia a nada válido e a troca de plano do Owner sempre falhava na validação do backend. O mesmo bug aparecia nas comparações de exibição: `planChangeModal.company?.plan === plan.id` (para o badge "Atual" e o ícone de seleção) e, na tabela de "Gestão de Ativações", `saasPlans.find(p => p.id === company.plan)` (para mostrar o `displayName` do plano) — ambas nunca batiam, então o badge "Atual" nunca aparecia no plano certo e a tabela sempre caía no fallback (mostrando o enum cru em vez do nome amigável).
   **Correção aplicada**: `handleChangePlan` agora recebe e envia `plan.name`; as 3 comparações passaram a usar `p.name?.toUpperCase() === company.plan?.toUpperCase()` (normalizando caixa, já que o estado local de `company.plan` fica em minúsculo).
   **Testes novos**: `__tests__/pages/KingSettings.test.tsx` — "envia o NOME do plano (não o id)", "marca o plano atual... (case-insensitive)", "lista as empresas com o nome do plano correspondente".

5. **[CORRIGIDO — chamada de API sem checar `success`, mesmo padrão já identificado nas 22 tarefas anteriores] `pages/king/KingRevenue.tsx`, `loadData`: uma falha em `kingApi.companies()`/`plansApi.list()` (HTTP de erro, ou corpo malformado) nunca setava `error`.**
   Evidência (código original): só o `catch` (exceção de rede) setava `setError('Erro de conexão')`; os `if (companiesRes.success && ...)`/`if (plansRes.success && ...)` não tinham `else`, então uma resposta com `success: false` (ex. token expirado, 500 do backend) resultava em `companies`/`saasPlans` vazios, `loading` zerado, e a tela mostrando "Nenhum vencimento", MRR R$ 0,00 etc. — indistinguível de um sistema saudável sem clientes.
   **Correção aplicada**: adicionado `else`/`else if` que chamam `setError(...)` com a mensagem do backend quando disponível.
   **Testes novos**: `__tests__/pages/KingRevenue.test.tsx` — "exibe mensagem de erro quando a API de empresas falha" e "...retorna corpo malformado".

6. **[CORRIGIDO — falta de validação Zod, regra obrigatória do `CLAUDE.md`] `POST /api/plans` e `PATCH /api/plans/[id]` não validavam o corpo — apenas `if (!name || price === undefined)` no POST, e nenhuma checagem no PATCH.**
   Consequência prática: `price` negativo, `price` como string (`"50"`, que o Prisma/Decimal aceitaria silenciosamente por coerção), ou `name` só com espaços em branco chegavam direto no banco.
   **Correção aplicada**: `createPlanSchema`/`updatePlanSchema` (Zod) adicionados às duas rotas, retornando 400 com `details: validation.error.flatten()` no mesmo padrão já usado em `king/leads/route.ts`.
   **Testes novos**: `plans.test.ts` (+4: price negativo, price string, name vazio, price 0 aceito) e `plans-id.test.ts` (+3: price negativo, name vazio, features não-array).

## Problemas verificados e considerados corretos — não é bug

- **`GET /api/plans` sem autenticação**: intencional — a mesma rota alimenta a landing page pública (preços exibidos a visitantes). Confirmado no comentário do próprio código (`// GET /api/plans - Listar todos os planos (publico)`).
- **`DELETE /api/plans/[id]` sem checagem de FK antes de excluir**: verificado no `prisma/schema.prisma` — `Company.plan` é um **enum** (`Plan`), não uma foreign key para `SaasPlan.id`. Não existe relação de banco entre as duas tabelas (o casamento é feito em memória, comparando `SaasPlan.name` com o valor do enum), logo não há erro 500 de constraint possível ao excluir um plano — a regra "checar FK antes de deletar" do `CLAUDE.md` não se aplica aqui por não existir a FK.
- **CRUD de planos (criar/editar/excluir/toggle) em `KingSettings.tsx`**: todas as 4 ações já verificavam `result.success` e chamavam `showAlert`/exibiam mensagem inline em caso de erro, antes desta sessão — nenhum bug de "resultado de API ignorado" (diferente do padrão achado nas 22 tarefas anteriores).
- **Abas "Notificacoes/Email" e parte de "Sistema" (Trial/Carência/Max. Usuários) sendo 100% `useState` local, nunca persistidas**: já documentado no próprio código como incompleto ("pode ser migrado para API"). Não é uma regressão — é uma feature que nunca foi terminada. Não corrigido (implementar persistência real seria uma feature nova, fora do escopo de correção de bug).
- **Aba "Aparencia" sendo inteiramente estática/decorativa**: mesma categoria acima — nenhuma ação real, nenhum bug a corrigir.
- **`kingGuard.ts` (`requireOwner`)**: reutilizado sem alterações — já auditado a fundo pelo Agente 1.
- **Limite de 100/200 empresas** (`companiesApi.list({limit:100})` no `AppContext`, `kingApi.companies({limit:200})` no `KingRevenue`): sem paginação nesta tela, empresas além do limite não apareceriam. Não é uma causa raiz de bug corrigível sem uma feature de paginação/busca — documentado como limitação conhecida.

## Testes criados nesta sessão

### Backend (`aura-backend/src/__tests__/`)
- **`lib/queries-companies-revenue.test.ts`** (novo — 2 testes): `lastPlan` selecionado no Prisma; valor repassado corretamente no retorno mapeado (bug #1).
- **`api/companies-id.test.ts`** (completado — de 45 para 52 testes): 3º campo bloqueado para ADMIN (`subscriptionExpiresAt`); novo describe "OWNER pode alterar plan/subscriptionStatus/subscriptionExpiresAt" (6 testes: sucesso nos 3 campos, enum inválido em 2, campo normal + plan juntos) (bug #2).
- **`api/plans.test.ts`** (completado — de 9 para 13 testes): price negativo, price string, name vazio → 400; price 0 aceito (bug #6).
- **`api/plans-id.test.ts`** (completado — de 9 para 12 testes): price negativo, name vazio, features não-array → 400 (bug #6).

### Frontend (`__tests__/pages/`)
- **`KingRevenue.test.tsx`** (novo — 9 testes): spinner de carregamento; MRR atual exclui empresa do OWNER; **MRR em Risco usa `lastPlan`** (bug #1); **lista de Inadimplentes rotula "Era: `<lastPlan>`"** (bug #1); **erro da API de empresas é exibido** (bug #5, 2 variantes); botão "Atualizar" recarrega; estado vazio de vencimentos; lista de próximos vencimentos.
- **`KingSettings.test.tsx`** (novo — 20 testes, organizados em 4 describe blocks por seção): navegação entre as 4 abas (4 testes); Gestão de Ativações — estado vazio, nome do plano correto mesmo com `id`≠`plan` (bug #4), **"Adicionar Tempo" envia `subscriptionStatus: 'ACTIVE'`** (bug #3) + erro, **"Alterar Plano" envia o nome do plano** (bug #4) + badge "Atual" correto + erro (7 testes); CRUD de planos — criar/erro, excluir/erro, toggle visibilidade/erro (6 testes); Modo Manutenção — carrega status, ativa com sucesso, erro inline (3 testes).

**Total de testes novos nesta sessão: 29 no frontend (9 + 20) + 16 líquidos no backend (2 novos + 7 em companies-id + 4 em plans + 3 em plans-id).**

## Verificação final

- `cd aura-backend && npx tsc --noEmit` → 0 erros.
- `npx tsc --noEmit` (raiz) → 0 erros.
- `cd aura-backend && npm run test:ci` → 137 arquivos, **2132 testes** passando (2116 antes desta sessão + 16 novos líquidos).
- `npx vitest run` (raiz) → 59 arquivos, **714 testes** passando (685 antes desta sessão + 29 novos).

## Testes recomendados (para sessões/agentes futuros, fora do escopo atual)

1. **[Produto]** Decidir o desenho real da aba "Notificacoes/Email" e da metade de "Sistema" (Trial/Carência/Max. Usuários) — hoje são `useState` local que se perde a cada F5, sem nenhuma rota de backend. Precisa de um model (`SystemSettings` já existe para o modo manutenção — poderia ganhar mais colunas) + rota de leitura/escrita real antes de fazer sentido escrever testes de integração para essas duas seções.
2. **[Produto]** A aba "Aparencia" é puramente decorativa — decidir se vira feature real (upload de logo, cor customizável persistida) ou é removida da navegação até lá.
3. **[Backend]** `queryTransactions` (`lib/queries/index.ts`) é código morto (nenhuma rota a chama) — considerar removê-la ou, se for reaproveitada por uma feature futura de "Financeiro do King", aplicar o mesmo tratamento de `select` explícito dado a `queryPatients`/`queryAppointments`/`queryCompanies`.
4. **[Produto/UX]** A tabela "Gestão de Ativações" (`KingSettings.tsx`) não tem busca nem paginação e depende do limite de 100 empresas carregado uma única vez no login (`AppContext.loadDataFromApi`) — com mais de 100 clínicas cadastradas, a tela para de mostrar as mais recentes. Vale trocar para `kingApi.companies()` (paginada, já usada por `KingRevenue.tsx`/`KingCompanies.tsx`) em vez do `companies` genérico do contexto.
