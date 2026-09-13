# Auditoria de Testes — Empresas, Pacientes e Agendamentos (visão SaaS) do Painel King (Owner)

> Escopo: `pages/king/KingCompanies.tsx`, `pages/king/KingPatients.tsx`, `pages/king/KingAppointments.tsx`, `aura-backend/src/app/api/king/companies/route.ts`, `aura-backend/src/app/api/king/patients/route.ts`, `aura-backend/src/app/api/king/appointments/route.ts`, `aura-backend/src/app/api/king/access-logs/route.ts` e o builder compartilhado `aura-backend/src/lib/queries/index.ts`. 2ª de 4 tarefas sequenciais sobre o painel King — segue o trabalho do Agente 1 (login/layout/dashboard, ver `docs/test-audit/king-login-layout-dashboard.md`). `KingLeads`, `KingAlerts`, `KingRevenue`, `KingSettings` e suas rotas ficam para os próximos 2 agentes.

## Funcionalidades identificadas

### `pages/king/KingCompanies.tsx` (`/king/companies`)
1. Busca `kingApi.companies({ page, limit, search, status })` (`GET /api/king/companies`) ao montar, ao trocar de página, ao trocar o filtro de status, e (com debounce de 300ms) ao digitar na busca.
2. Filtros: busca por nome/slug (client-side debounce, mas a busca em si é feita no backend via `search`) e filtro por status da assinatura (`ACTIVE`/`TRIAL`/`OVERDUE`/`CANCELED`).
3. Paginação real (server-side, `page`/`limit`/`total` vindos do backend).
4. Cartão por empresa: nome, slug, badge de plano, badge de status, contagem de pacientes/agendamentos/usuários (`_count`), data de expiração da assinatura.
5. **Nenhuma ação de escrita existe nesta tela** — é 100% somente-leitura (sem suspender, sem editar plano, sem cancelar, sem qualquer botão que chame um `PATCH`/`DELETE`). Portanto não há necessidade de RBAC adicional no frontend além do guard de rota do `KingLayout` (auditado pelo Agente 1) — toda a superfície de escrita de empresas (mudar plano, criar lead, etc.) vive em `KingLeads.tsx`/`KingSettings.tsx`, fora deste escopo.
6. Botão "Atualizar" refaz a busca atual.

### `pages/king/KingPatients.tsx` (`/king/patients`)
1. Busca **duas** listas em paralelo ao montar: `kingApi.companies({ limit: 100 })` e `kingApi.patients({ limit: 500 })` — sem paginação própria na tela (busca uma página grande de cada uma vez).
2. Agrupa os pacientes já carregados por `company.id` num acordeão por clínica (expandir/recolher individual ou "Expandir Tudo"/"Recolher Tudo").
3. Busca client-side (nome/email/telefone) filtra a lista já carregada — não dispara nova requisição.
4. Cartão de paciente mostra apenas nome, empresa, status, email, telefone e última visita — **nenhum dado de anamnese, CPF ou assinatura de consentimento é exibido** (nem deveria: ver bug #1 abaixo, que travava isso também no backend).
5. KPIs: Total de Pacientes, Clínicas, Encontrados (resultado da busca client-side).

### `pages/king/KingAppointments.tsx` (`/king/appointments`)
1. Busca `kingApi.companies({ limit: 100 })` e `kingApi.appointments({ limit: 500, status, ...dateRange })` em paralelo. Filtros server-side: status e período (hoje/semana/mês/todos, calculado no frontend e enviado como `startDate`/`endDate`).
2. Agrupa agendamentos por clínica no mesmo padrão de acordeão do `KingPatients`.
3. Cartão de agendamento mostra paciente, procedimento, data/hora, duração, profissional, clínica, preço e status — sem expor URL/metadados de assinatura de consentimento (ver bug #2).
4. KPIs: Total de Agendamentos, Clínicas, Valor Total (somado sobre os itens carregados), Período selecionado.

### `aura-backend/src/app/api/king/access-logs/route.ts` (`GET /api/king/access-logs`)
- **Endpoint órfão confirmado**: nenhum arquivo do frontend usa esta rota. Buscas por `accessLog`/`access-logs` em todo `services/api.ts` e nos três arquivos deste escopo (e no restante do frontend) não retornam nenhuma chamada — `kingApi` não tem nenhum método `accessLogs`/`accessLog`. O único consumidor hoje é o próprio arquivo de teste.
- Já usa `requireOwner` corretamente (RBAC confirmado por teste pré-existente e pelos novos testes desta sessão).
- Retorna logs de `Activity` do tipo `USER_LOGIN`, paginados (`page`/`limit`, `limit` máx. 100), com guarda contra `NaN`/`page<1`.

## Endpoints de backend usados

| Método | Rota | Arquivo | Guard | Chamado por |
|---|---|---|---|---|
| GET | `/api/king/companies` | `aura-backend/src/app/api/king/companies/route.ts` | `requireOwner` | `KingCompanies.tsx`, `KingPatients.tsx`, `KingAppointments.tsx` (para a lista de clínicas usada no agrupamento) |
| GET | `/api/king/patients` | `aura-backend/src/app/api/king/patients/route.ts` | `requireOwner` | `KingPatients.tsx` |
| GET | `/api/king/appointments` | `aura-backend/src/app/api/king/appointments/route.ts` | `requireOwner` | `KingAppointments.tsx` |
| GET | `/api/king/access-logs` | `aura-backend/src/app/api/king/access-logs/route.ts` | `requireOwner` | **Nenhum** (órfão) |

Os três primeiros endpoints delegam a query real para `queryCompanies`/`queryPatients`/`queryAppointments` em `aura-backend/src/lib/queries/index.ts` — builders compartilhados que aceitam `companyId` opcional (se ausente, retornam de todas as empresas; é assim que o King vê tudo). Confirmado por leitura de código: `queryPatients` e `queryAppointments` **só são usados pelas rotas King** (nenhum outro endpoint do sistema os importa), então restringir os campos selecionados (bugs #1/#2 abaixo) não afeta nenhuma outra tela.

## Cobertura de testes atual (antes desta sessão)

### Backend
- `king-companies.test.ts`, `king-patients.test.ts`, `king-appointments.test.ts` já cobriam: 200 com dados, parâmetros passados corretamente para a query, defaults de paginação, 401 sem auth, 403 para ADMIN, 500 em erro de query — mas faltava: as demais roles não-OWNER (RECEPTIONIST/ESTHETICIAN/PATIENT) e uma checagem de que o 500 não vaza detalhe interno do erro (mesmo gap que o Agente 1 encontrou em `king-dashboard.test.ts`).
- `access-logs.test.ts` (nome real do arquivo — a tarefa esperava "sem teste nenhum", mas ele já existia) cobria RBAC (401/403) e paginação/guardas de `NaN` muito bem (7 testes) — faltava apenas cobertura do caminho de erro 500, que **nem existia no código** (ver bug #3).
- `lib/queries/index.ts` (os query builders) **não tinha nenhum teste direto** — só era exercitado indiretamente pelos testes de rota (que mockam o módulo inteiro `@/lib/queries`), então o vazamento de campos sensíveis (bugs #1/#2) não tinha como ser pego por eles.

### Frontend
- **Nenhum teste existia** para `KingCompanies.tsx`, `KingPatients.tsx` ou `KingAppointments.tsx` (confirmado: nenhum arquivo com esses nomes em `__tests__/pages/` antes desta sessão).

## Problemas encontrados durante a revisão (corrigidos)

1. **[CORRIGIDO — vazamento de dados sensíveis/LGPD] `queryPatients` (`aura-backend/src/lib/queries/index.ts`, função `queryPatients`) buscava pacientes com `prisma.patient.findMany` sem `select`, trazendo TODOS os campos do model `Patient` na resposta JSON — incluindo `cpf`, `anamnesisSummary` (resumo de anamnese/saúde), `consentSignatureUrl` (imagem/base64 da assinatura de consentimento), `consentMetadata`, `marketingOptOut`, etc.**
   Evidência: `prisma/schema.prisma` (`model Patient`, linhas 218+) declara esses campos; a query antiga não tinha `select`, então o Prisma retorna todas as colunas do modelo por padrão, e a rota `GET /api/king/patients` simplesmente serializa o resultado inteiro em `NextResponse.json`. O frontend (`KingPatients.tsx`) só *exibe* nome/email/telefone/status, mas os dados extras trafegavam na resposta da API mesmo assim — visíveis em qualquer inspeção de rede, mesmo sem o frontend renderizá-los.
   **Correção aplicada**: adicionado `select` explícito em `queryPatients` retornando apenas `id, name, email, phone, status, birthDate, lastVisit, createdAt, companyId, company{id,name,slug}` — exatamente o que a tela usa. `cpf`, dados de anamnese e de assinatura de consentimento nunca mais saem desta rota.
2. **[CORRIGIDO — sobre-exposição de dados] `queryAppointments` também usava `findMany` sem `select`, trazendo `signatureUrl`/`signatureMetadata` (assinatura de consentimento do procedimento) na resposta agregada do King.**
   Evidência: `model Appointment` (`prisma/schema.prisma`, linha 343+) tem `signatureUrl`/`signatureMetadata`. A visão global do King não precisa (e não deveria) trafegar a assinatura de consentimento de cada agendamento de cada clínica.
   **Correção aplicada**: `select` explícito mantendo `id, date, durationMinutes, price, status, notes, createdAt` + as relações já com `select` restrito (`patient`, `professional`, `procedure`, `company`) — o mesmo shape que o frontend já consumia, sem os campos de assinatura.
3. **[CORRIGIDO — defesa em profundidade, menor severidade] `queryCompanies` também usava `findMany` sem `select` no nível da empresa, trafegando `asaasCustomerId`/`asaasSubscriptionId` (IDs internos do gateway de pagamento) e configurações internas de negócio (`businessHours`, `onlineBookingConfig`, `layoutConfig`) que a listagem do King não usa.**
   **Correção aplicada**: `select` explícito com os campos realmente exibidos (`id, name, slug, plan, subscriptionStatus, subscriptionExpiresAt, createdAt, isActive` + `_count` e o `users` já restrito que alimenta `adminContact`/`hasOwner`).
   Nota: `adminContact` (nome/email/telefone do ADMIN/OWNER da clínica) **não é um bug** — é intencional, comentado no próprio código ("para o OWNER entrar em contato"), e é o próprio contato comercial da clínica, não dado de paciente.
4. **[CORRIGIDO] `access-logs/route.ts` não tinha nenhum bloco `try/catch` — uma exceção do Prisma (ex.: banco fora do ar) resultaria numa página de erro genérica do Next.js em vez de um JSON `{success:false, error:...}` consistente com o resto da API, além de a resposta de sucesso não seguir o padrão `{success, data, error}` do resto do sistema (retornava só `{data, page, limit, total}`).**
   **Correção aplicada**: envolvido o acesso ao banco em `try/catch` (retorna 500 com `{success:false, error:"Erro inesperado."}`, sem vazar a mensagem interna) e adicionado `success:true` na resposta de sucesso — mantendo `data`/`page`/`limit`/`total` como estavam, então nenhum consumidor existente quebra (não há nenhum, é órfão — mas o teste antigo continua passando).
5. **[CORRIGIDO — erro de API não comunicado ao usuário] `KingCompanies.tsx`: quando a API retornava um erro (401/403/500 do backend, ou `success:false` no corpo com HTTP 200), a tela sempre mostrava o texto genérico fixo "Erro ao carregar empresas", descartando a mensagem real (`response.error`/`apiData.error`) devolvida pela API — ex.: um OWNER cujo token expirou via, incorretamente, "Erro ao carregar empresas" em vez de algo que o oriente a logar de novo.**
   Evidência (código original): `if (response.success && apiData?.success && apiData?.data) {...} else { setError('Erro ao carregar empresas'); }` — o `else` nunca olhava `response.error` nem `apiData.error`. Contraste com o padrão já estabelecido em `KingDashboard.tsx` (auditado pelo Agente 1), que trata as duas camadas de erro separadamente e propaga a mensagem real.
   **Correção aplicada**: replicado o padrão de duas camadas do `KingDashboard.tsx` — erro de transporte usa `response.error`, erro de negócio (HTTP 200 com `success:false`) usa `apiData.error`, com fallback para o texto genérico apenas quando a API não manda mensagem nenhuma.
6. **[CORRIGIDO — erro de API completamente silencioso, mais grave que o #5] `KingPatients.tsx` e `KingAppointments.tsx`: quando `kingApi.companies()` ou `kingApi.patients()`/`kingApi.appointments()` falhavam (403, 500, etc.), a tela não mostrava NENHUM erro — o código só tinha um `if` para o caminho de sucesso, sem `else`. O usuário via silenciosamente "Nenhuma empresa cadastrada." ou uma lista vazia/parcial, sem entender que uma chamada tinha falhado.**
   Evidência (código original, ambos os arquivos): `if (companiesRes.success && companiesData?.success && companiesData?.data) { setCompanies(...) }` — sem `else`. Mesmo padrão para a segunda chamada. Isso viola diretamente a regra do `CLAUDE.md` ("todo erro deve ser comunicado ao usuário — nunca deixar uma ação falhar silenciosamente") e é o mesmo tipo de bug ("resultado de API ignorado") mapeado como o mais comum em sessões anteriores do painel ADMIN/portal do paciente.
   **Correção aplicada**: as duas chamadas paralelas agora são checadas individualmente (transporte + corpo); se qualquer uma falhar, a mensagem real é exibida (concatenando as duas se ambas falharem), mas o carregamento da chamada que teve sucesso continua populando seu respectivo estado (resiliência parcial mantida).
7. **[CORRIGIDO — KPI incorreto/enganoso] `KingPatients.tsx` e `KingAppointments.tsx` calculavam o KPI "Total de Pacientes"/"Total de Agendamentos" com `patients.length`/`appointments.length` — ou seja, o tamanho da página buscada (limitada a 500 registros), e não o `total` real devolvido pela API (`queryPatients`/`queryAppointments` sempre retornam `{..., total}`, mas o campo era descartado).**
   Consequência prática: assim que qualquer clínica do sistema ultrapassar 500 pacientes (ou 500 agendamentos no período/status filtrado) somados, o KPI do topo da tela passa a mostrar um número **menor que o real**, sem nenhum aviso — um problema de confiabilidade de dado agregado, ainda mais sensível no painel do Owner (decisões de negócio sobre a base de clientes).
   **Correção aplicada**: os componentes agora guardam o `total` retornado pela API em estado próprio e o usam no KPI do topo; um aviso amarelo aparece quando `total > <itens carregados>` avisando que a listagem/soma exibida reflete apenas os itens carregados (não foi implementada paginação completa nessas telas — ver "Testes recomendados" para o item de acompanhamento).

## Problemas encontrados durante a revisão (verificados e considerados corretos — não é bug)

- **`KingCompanies.tsx` não ter nenhuma ação de escrita não é uma omissão de RBAC** — é o desenho atual da tela (somente leitura). Não há necessidade de checar autorização de ações que não existem.
- **Isolamento entre clínicas na exibição**: confirmado por leitura de código e travado em teste que `KingPatients.tsx`/`KingAppointments.tsx` agrupam estritamente por `company.id` (`getCompanyPatients`/`getCompanyAppointments` filtram por igualdade exata de ID) — não há como um paciente/agendamento de uma empresa aparecer na seção de outra.
- **`access-logs` usar `requireOwner`**: confirmado correto (mesmo padrão auditado pelo Agente 1 em `kingGuard.ts`), com testes de 401/403/paginação já existentes e agora também de 500.

## Testes criados/completados nesta sessão

### Backend (`aura-backend/src/__tests__/`)
- **`lib/queries.test.ts`** (novo — 6 testes): trava por teste direto (sem mockar `@/lib/queries`, mockando só `@/lib/prisma`) que `queryPatients` não seleciona `cpf`/`anamnesisSummary`/`consentSignatureUrl`/`consentMetadata`/`consentSignedAt`; que `queryAppointments` não seleciona `signatureUrl`/`signatureMetadata`; que `queryCompanies` não seleciona `asaasCustomerId`/`asaasSubscriptionId`/`businessHours`/`onlineBookingConfig`/`layoutConfig`; e que `adminContact`/`hasOwner` continuam funcionando.
- **`api/king-companies.test.ts`** (complementado — de 6 para 10 testes): adicionados os 403 de RECEPTIONIST/ESTHETICIAN/PATIENT (`it.each`) e um teste de que o 500 não vaza detalhe interno do erro.
- **`api/king-patients.test.ts`** (complementado — de 7 para 11 testes): idem.
- **`api/king-appointments.test.ts`** (complementado — de 7 para 11 testes): idem.
- **`api/access-logs.test.ts`** (complementado — de 7 para 9 testes): resposta de sucesso segue `{success:true, data}`; 500 com mensagem genérica (sem vazar erro interno) quando a query lança exceção — cobrindo o `try/catch` que não existia antes.

### Frontend (`__tests__/pages/`)
- **`KingCompanies.test.tsx`** (novo — 11 testes): spinner de carregamento; lista com plano/status/métricas; estado vazio; **erro HTTP exibe a mensagem real do backend** (bug #5); erro de negócio (200 + `success:false`) exibe o erro do corpo; erro de rede exibe "Erro de conexão"; filtro de status recarrega; busca com debounce recarrega; paginação avança a página; botão Atualizar recarrega; confirma que a tela não tem nenhuma ação de escrita (suspender/editar plano/cancelar).
- **`KingPatients.test.tsx`** (novo — 12 testes): spinner; agrupamento por clínica com contagem; expandir uma clínica mostra só os pacientes dela e não mistura com outra (isolamento entre clínicas); busca client-side filtra por nome/email/telefone; **KPI "Total de Pacientes" usa o `total` da API, não o tamanho da página buscada** (bug #7); aviso de truncamento aparece/some corretamente; **erro ao buscar pacientes é comunicado** (bug #6); **erro ao buscar empresas é comunicado** (bug #6); erro de rede; botão Atualizar; estado vazio sem empresas.
- **`KingAppointments.test.tsx`** (novo — 14 testes): mesma cobertura de `KingPatients.test.tsx` adaptada (isolamento entre clínicas, KPI usando `total` real, aviso de truncamento, ambos os erros comunicados, erro de rede, Atualizar, estado vazio) + valor total calculado corretamente sobre os itens carregados, filtro de período "Hoje" envia `startDate`/`endDate`, e filtro de status recarrega.

**Total de testes novos/completados nesta sessão: 37 no frontend (11 + 12 + 14) + 26 líquidos no backend (6 novos em `queries.test.ts` + 4 em `king-companies` + 4 em `king-patients` + 4 em `king-appointments` + 2 em `access-logs`) — suíte backend passou de 2084 para 2104 testes (o total sobe 20, não 26, porque `king-appointments`/`king-patients`/`king-companies` já continham os testes-base contados aqui como "completados", não duplicados).

## Testes recomendados (para sessões/agentes futuros, fora do escopo atual)

1. **[Frontend]** `KingPatients.tsx`/`KingAppointments.tsx` buscam no máximo 500 registros sem paginação real na tela (diferente de `KingCompanies.tsx`, que pagina de verdade). O aviso de truncamento adicionado nesta sessão comunica o problema, mas a correção completa (paginação real ou busca server-side incremental) é uma mudança de UX maior, fora do escopo de correção de bugs desta tarefa — vale planejar para quando o volume de dados justificar.
2. **[Backend]** `KingRevenue.tsx` (próximo agente) provavelmente reusa `queryTransactions` (mesmo arquivo `lib/queries/index.ts`) — ela também usa `findMany` sem `select` (traz todos os campos de `Transaction`). Não foi alterada nesta sessão por estar fora do escopo de arquivos desta tarefa, mas vale o mesmo tratamento de "seleção explícita" quando esse agente tocar nela.
3. **[Frontend]** Nenhum teste de acessibilidade/mobile foi feito para os acordeões de `KingPatients`/`KingAppointments` (equivalente ao item 3 pendente do relatório do Agente 1 para o drawer do `KingLayout`) — não é risco de RBAC/dado, então ficou fora do escopo.
