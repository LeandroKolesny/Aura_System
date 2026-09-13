# Auditoria de Testes — Cliente: Planos e Assinaturas (Clube de Assinaturas)

> Escopo (frontend): `pages/patient-portal/PatientPlans.tsx`,
> `components/patient-portal/PlanCard.tsx`,
> `components/patient-portal/PlanContractModal.tsx`,
> `components/patient-portal/PlanHistoryDrawer.tsx`,
> `components/patient-portal/PlanProcedurePickerModal.tsx`.
> Escopo (backend): `aura-backend/src/app/api/subscriptions/patients/*` — `route.ts`
> (GET lista assinantes / POST inscreve paciente), `self/route.ts` (POST — paciente
> contrata a própria assinatura), `my/route.ts` (GET — paciente consulta as próprias
> assinaturas), `[id]/activate/route.ts` (PATCH), `[id]/cancel/route.ts` (PUT),
> `[id]/history/route.ts` (GET).
> Fora do escopo (agentes anteriores): `pages/PublicBooking.tsx`,
> `aura-backend/src/lib/businessHours.ts`, `apps/PatientPortalApp.tsx`,
> `pages/patient-portal/PatientLogin.tsx`, `components/patient-portal/PatientSidebar.tsx`,
> `context/ClinicContext.tsx`, `utils/subdomain.ts`.
> 3ª de 4 tarefas sobre a "área do cliente" — a 1ª (login/navegação, commit `0da581d`)
> está em `docs/test-audit/cliente-login-navegacao.md`; a 2ª (agendamento público,
> commit `d9db7e2`) está em `docs/test-audit/cliente-agendamento-publico.md`.

## Funcionalidades identificadas

### `pages/patient-portal/PatientPlans.tsx`
1. Duas seções: "Promoções Disponíveis" (catálogo de planos da clínica, via
   `GET /api/public/company/{slug}`) e "Meus Planos" (assinaturas do próprio
   paciente, via `GET /api/subscriptions/patients/my`).
2. `getPlanStatus(planId)` deriva o status do card (`available` / `active` / `pending`)
   comparando com `subscriptions` — `ACTIVE`/`PAUSED` → `active`, `PENDING` → `pending`
   (valor real do enum Prisma `PatientSubscriptionStatus`, confirmado em
   `prisma/schema.prisma`; **não** é `PENDING_APPROVAL` — esse valor é do enum
   `AppointmentStatus`, de agendamentos, não de assinaturas — checado e confirmado
   correto, sem bug aqui apesar de os dois nomes parecidos convidarem à confusão).
3. Assinaturas `PENDING` (aguardando o primeiro agendamento) e `ACTIVE`/`PAUSED`
   (com sessões restantes por procedimento, barra de progresso e histórico) são
   renderizadas em blocos separados dentro de "Meus Planos".
4. Botão "Contratar Plano" (via `PlanCard`) abre `PlanContractModal`; ao confirmar,
   `handleContract` chama `POST /api/subscriptions/patients/self` e, em caso de
   sucesso, navega para `PublicBooking` (`${basePath}/`) com
   `state: { pendingPlanId, pendingPlanName }` — mesmo mecanismo usado pelo bloco
   "Agendar agora" das assinaturas `PENDING`.
5. Botão "Ver histórico" (em `PlanCard` ou no card de assinatura ativa) abre
   `PlanHistoryDrawer` com o `subscriptionId` correspondente.

### `components/patient-portal/PlanCard.tsx`
6. Componente de apresentação puro (props `PlanForCard`, `PlanStatus`) — imagem/preço/
   procedimentos inclusos, e botão de ação que varia com `status`: "Contratar Plano"
   (`available`), "Ver Histórico de Sessões" (`active`), aviso estático sem botão
   (`pending`).

### `components/patient-portal/PlanContractModal.tsx`
7. Modal de confirmação de contratação — mostra plano/preço/procedimentos e um aviso
   de que o pagamento é combinado com a clínica via WhatsApp/telefone. `onConfirm` é
   assíncrono; o modal mostra "Aguarde..." e desabilita os botões durante o `await`.

### `components/patient-portal/PlanHistoryDrawer.tsx`
8. Drawer lateral que busca `GET /api/subscriptions/patients/{id}/history` e renderiza
   cada agendamento vinculado à assinatura (data, status com rótulo/cor via
   `STATUS_MAP`, procedimento, profissional, fotos de antes/depois quando existirem).

### `components/patient-portal/PlanProcedurePickerModal.tsx`
9. Usado por `pages/PublicBooking.tsx` (fora do escopo de arquivo, mas o componente em
   si está no meu escopo de teste) para escolher qual(is) procedimento(s) do plano
   agendar na sessão. `sessionsRemaining === -1` sinaliza "plano ainda não ativo"
   (mostra `Nx/mês` em vez de contagem, item fica habilitado); `sessionsRemaining === 0`
   desabilita o item ("Sem sessões").

### Backend
10. `GET/POST /api/subscriptions/patients` — rota **administrativa**: lista assinantes
    de toda a empresa (nome/telefone/e-mail/uso do plano) e inscreve um `patientId`
    arbitrário num plano (assinatura nasce `ACTIVE`, default do schema). Usada só por
    páginas de staff (`pages/Subscriptions.tsx`, `pages/Dashboard.tsx`,
    `components/Modals.tsx` quando `!isPatientUser`).
11. `POST /api/subscriptions/patients/self` — o **próprio paciente autenticado** (role
    `PATIENT`) contrata um plano para si; sempre cria com `status: "PENDING"`; se já
    existir uma assinatura `PENDING`/`ACTIVE`/`PAUSED` para o mesmo plano, retorna a
    existente com 200 (nunca 409, apesar do comentário histórico no frontend dizer
    "409 = already exists" — nunca foi verdade nesta rota).
12. `GET /api/subscriptions/patients/my` — lista as assinaturas do próprio paciente
    autenticado (`PENDING`/`ACTIVE`/`PAUSED`) com `sessionsUsed`/`sessionsRemaining`
    calculados a partir de `sessionsUsedThisCycle` (JSON por procedimento).
13. `PATCH /api/subscriptions/patients/[id]/activate` — ativa uma assinatura `PENDING`
    (rota de staff, conforme comentário original do arquivo).
14. `PUT /api/subscriptions/patients/[id]/cancel` — cancela uma assinatura; se estava
    `PENDING`, restaura o preço original dos agendamentos `PENDING_APPROVAL` vinculados.
15. `GET /api/subscriptions/patients/[id]/history` — lista os agendamentos vinculados a
    uma assinatura (`where: { subscriptionId: id }`, sem filtro de `status`); paciente só
    pode ver a própria (já tinha essa checagem antes desta auditoria).
16. `sessionsUsedThisCycle` (JSON por procedimento na `PatientSubscription`) é
    incrementado em dois lugares: `POST /api/appointments` (na criação, para staff) e
    `PATCH /api/appointments/[id]/status` (na aprovação `PENDING_APPROVAL → SCHEDULED`,
    para o fluxo de paciente). Ver Bug 2 abaixo.

## Endpoints de backend usados

| Método | Rota | Chamado por |
|---|---|---|
| GET | `/api/subscriptions/patients/my` | `PatientPlans.tsx` (`fetch` direto) |
| GET | `/api/public/company/{slug}` | `PatientPlans.tsx` (catálogo de planos) |
| POST | `/api/subscriptions/patients/self` | `PatientPlans.tsx` (`handleContract`) |
| GET | `/api/subscriptions/patients/{id}/history` | `PlanHistoryDrawer.tsx` |
| GET/POST | `/api/subscriptions/patients` | `services/api.ts` (`subscriptionsApi.listSubscribers/subscribe/listPending/listForPatient`) — só páginas de staff |
| PATCH | `/api/subscriptions/patients/{id}/activate` | `services/api.ts` (`subscriptionsApi.activate`) — `pages/Dashboard.tsx`, `pages/Subscriptions.tsx` |
| PUT | `/api/subscriptions/patients/{id}/cancel` | `services/api.ts` (`subscriptionsApi.cancel`) — `pages/Dashboard.tsx`, `pages/Subscriptions.tsx` |

## Cobertura de testes atual (antes desta tarefa)

### Frontend
**Nenhum teste existia** para nenhum dos 5 arquivos do meu escopo — confirmado
buscando em `__tests__/**` por `PatientPlans`, `PlanCard`, `PlanContractModal`,
`PlanHistoryDrawer`, `PlanProcedurePickerModal`: zero resultados (só existia
`__tests__/components/SubscriptionPlanModal.test.tsx`, que testa o modal de
**criação de plano pela clínica**, um componente diferente, fora do meu escopo).

### Backend
Todas as 6 rotas já tinham arquivo de teste (`subscriptions-patients*.test.ts`), mas:
- **Nenhum teste usava um usuário `PATIENT`** em `GET/POST /api/subscriptions/patients`,
  `activate` ou `cancel` — todos os testes existentes usavam `ADMIN`. Isso escondia os
  Bugs 1a/1b/1c abaixo (RBAC).
- `appointments-post.test.ts` tinha um teste para `PATIENT` com `subscriptionId`
  ("Bug C" do agente anterior) mas mockava `patientSubscription.findUnique` como `null`,
  o que por acaso desviava do bloco de decremento e escondia o Bug 2 abaixo.

## Problemas encontrados durante a revisão

### Bug 1a — CONFIRMADO, CORRIGIDO — sem checagem de role em `GET/POST /api/subscriptions/patients`
Rota administrativa (lista assinantes com nome/telefone/e-mail/plano; inscreve
qualquer `patientId` já como `ACTIVE`). `checkWriteAccess` só valida se o *plano da
empresa* permite escrita (modo somente leitura) — nunca valida *quem* está chamando.
Um `PATIENT` autenticado conseguia:
- `GET`: listar os dados de assinatura (incl. telefone/e-mail) de **qualquer outro
  paciente da mesma empresa** — vazamento de PII entre pacientes.
- `POST`: inscrever **qualquer `patientId`** (o próprio ou outro paciente da empresa)
  num plano já `ACTIVE`, pulando inteiramente a aprovação da clínica (o fluxo correto
  para o próprio paciente é `POST /api/subscriptions/patients/self`, que sempre nasce
  `PENDING`).
**Corrigido**: `allowedRoles = ["OWNER", "ADMIN", "RECEPTIONIST"]` em ambos os métodos,
403 caso contrário. Testes novos em `subscriptions-patients.test.ts` (RED confirmado:
antes da correção, `PATIENT` recebia 200/201 normalmente).

### Bug 1b — CONFIRMADO, CORRIGIDO — sem checagem de role em `PATCH .../activate`
Mesma causa raiz: `checkWriteAccess` não valida role, e o `findFirst` só restringe por
`companyId`, nunca pelo dono da assinatura. Um `PATIENT` autenticado conseguia ativar
(`PENDING → ACTIVE`) **a assinatura de qualquer paciente da própria empresa**,
inclusive a de outro paciente, pulando a aprovação manual da clínica.
**Corrigido**: mesmo `allowedRoles` (`OWNER`/`ADMIN`/`RECEPTIONIST`), 403 caso
contrário — mesmo padrão já usado em `PATCH /api/appointments/[id]/status`
(`allowedRoles.includes(user.role)`), reaproveitado aqui por consistência.

### Bug 1c — CONFIRMADO, CORRIGIDO — sem checagem de role em `PUT .../cancel`
Idêntico ao 1b: um `PATIENT` autenticado conseguia **cancelar a assinatura de
qualquer outro paciente da mesma empresa** (sabotagem entre pacientes) — a rota
nunca verificava `subscription.patientId` contra o paciente autenticado nem exigia
papel de equipe. **Corrigido** com o mesmo `allowedRoles`.

*Nota de escopo*: excluí `ESTHETICIAN` da lista de papéis permitidos nas três rotas
acima (1a/1b/1c) porque a matriz `PERMISSIONS` em `src/lib/rbac.ts` já dá a esse papel
`transactions: []` (nenhuma permissão de billing) — decisão de manter consistência
com o RBAC existente, não um dado observado em produção. `RECEPTIONIST` foi incluído
porque tem `transactions: ["create","read"]`. Nenhuma tela de staff hoje restringe por
role quem acessa `pages/Subscriptions.tsx`/`pages/Dashboard.tsx`, então, na prática, a
única mudança de comportamento observável é bloquear `PATIENT` (o vetor de ataque
real) e, teoricamente, `ESTHETICIAN` (sem evidência de uso legítimo dessas ações).

### Bug 2 — CONFIRMADO, CORRIGIDO — dupla dedução de sessão do plano (Passo 2 da auditoria)
Ao investigar o fluxo pedido no Passo 2 (confirmar que um agendamento com
`subscriptionId` — corrigido pelo agente anterior em `PublicBooking.tsx` — reflete
corretamente na contagem de "sessões restantes"), encontrei um bug real na escrita de
`sessionsUsedThisCycle`, fora do meu diretório de escopo mas na cadeia causal direta do
que o Passo 2 pede para verificar (`aura-backend/src/app/api/appointments/route.ts`,
função `POST`):
- O ramo `isPatient && subscriptionId` define `subscriptionCoverage.covered = true`
  para poder zerar o preço do agendamento — mas o bloco de decremento logo abaixo
  (`if (subscriptionCoverage.covered && subscriptionCoverage.subscriptionId)`), escrito
  originalmente só para o ramo de staff, rodava para **qualquer** `covered`, decrementando
  `sessionsUsedThisCycle` **já na criação** (status `PENDING_APPROVAL`) — apesar do
  comentário do próprio arquivo dizer explicitamente "NÃO deduzir agora" porque a
  dedução real deveria acontecer só na aprovação.
- `PATCH /api/appointments/[id]/status` **já decrementa de novo** ao aprovar
  (`PENDING_APPROVAL → SCHEDULED`, bloco "Clube de Assinaturas: deduzir sessão ao
  aprovar agendamento pendente") — esse bloco está correto e não foi alterado.
- **Resultado real (não mockado)**: 1 sessão de plano agendada por um paciente e depois
  aprovada pela clínica consumia **2 sessões** da cota do ciclo, não 1. E se a clínica
  rejeitasse o agendamento (`PENDING_APPROVAL → CANCELED`), a sessão já decrementada na
  criação **nunca era restaurada** — o paciente perdia uma sessão por um agendamento que
  nunca aconteceu.
- Esse branch **nunca era exercido em produção antes da correção do Bug C do agente
  anterior** (`PublicBooking.tsx`): como o frontend nunca enviava `subscriptionId`, a
  condição `isPatient && subscriptionId` nunca era verdadeira. A correção do agente
  anterior tornou este bug alcançável pela primeira vez.
- O teste pré-existente para esse branch (`appointments-post.test.ts`, "Bug C da
  auditoria") mockava `patientSubscription.findUnique` como `null`, o que por acaso
  fazia o `if (sub)` interno falhar e escondia o problema.
**Corrigido**: `if (!isPatient && subscriptionCoverage.covered && subscriptionCoverage.subscriptionId)`
— restaura o comportamento documentado (dedução só para staff na criação; para
paciente, só na aprovação). Teste novo (RED confirmado antes da correção:
`prisma.patientSubscription.update` era chamado 1x na criação, quando deveria ser 0).

### Confirmação (Passo 2) — histórico e sessões restantes, sem outros bugs
- `GET /api/subscriptions/patients/{id}/history`: `where: { subscriptionId: id }` sem
  filtro de `status` — inclui `PENDING_APPROVAL` e `CANCELED` normalmente. Teste de
  caracterização novo confirma que um agendamento `PENDING_APPROVAL` (estado inicial de
  todo agendamento de paciente) aparece no histórico, e `PlanHistoryDrawer.tsx`
  renderiza o rótulo "Pendente" (via `STATUS_MAP`) corretamente — sem filtragem
  indevida em nenhuma das duas camadas.
- `GET /api/subscriptions/patients/my`: o cálculo `sessionsRemaining = sessionsPerCycle
  - sessionsUsedThisCycle[procedureId]` já era coberto e correto (função pura sobre o
  valor armazenado) — a causa de qualquer contagem errada estava na escrita (Bug 2),
  não na leitura. Com o Bug 2 corrigido, 1 sessão de plano agendada e aprovada agora
  resulta em exatamente 1 sessão a menos, refletida em `PatientPlans.tsx`/`PlanCard.tsx`.

### Bug 3 — CONFIRMADO, CORRIGIDO — falha ao contratar plano nunca era comunicada ao usuário
`PatientPlans.tsx`, `handleContract`: só tratava sucesso (`res.ok || res.status === 409`
— este último nunca ocorre de verdade, a rota retorna 200 para "já existe", nunca 409;
mantido só como defesa). Em qualquer outro caso (400/403/404/500), a função não fazia
nada — nem fechava o modal, nem avisava o paciente. Além disso, o arquivo inteiro não
usava `useDialog()` em lugar nenhum, violando a regra obrigatória do projeto (nunca
`alert()`/`window.confirm()`, sempre `useDialog()`).
**Corrigido**: `try/catch` ao redor da chamada; em falha (HTTP ou de rede), chama
`showAlert(json.error ?? ..., { variant: 'danger' })` e nunca navega. Como
`apps/PatientPortalApp.tsx` (fora do escopo, arquivo do 1º agente) ainda não envolve o
portal com `<DialogProvider>` — só `AdminApp` em `App.tsx` tem esse provider hoje —
`PatientPlans.tsx` cria seu próprio `DialogProvider` local (documentado no código);
sem isso, `useDialog()` lançaria e quebraria a página inteira. Recomendação para
trabalho futuro: mover o `DialogProvider` para a raiz do `PatientPortalApp` e remover
este wrapper local.

### Bug 4 — CONFIRMADO, CORRIGIDO — falha ao carregar assinaturas próprias virava silenciosamente "sem planos"
`PatientPlans.tsx`, `fetchData`: a busca de `/api/subscriptions/patients/my` tinha
`.catch(() => {})` e nunca checava `json.success` — qualquer falha (rede, 401, 500)
deixava `subscriptions = []`, indistinguível de um paciente que realmente não tem
nenhum plano. **Corrigido**: novo estado `loadError`; falha (HTTP sem sucesso ou
exceção de rede) mostra um banner de erro com botão "Tentar novamente" e suprime a
mensagem enganosa "Você não possui planos ativos".

### Bug 5 — CONFIRMADO, CORRIGIDO — falha ao carregar histórico do plano virava silenciosamente "nenhuma sessão"
`PlanHistoryDrawer.tsx`, `fetchHistory`: `try { ... } finally { ... }` **sem `catch`** —
uma falha de rede (ou resposta com `success: false`) virava uma rejeição de Promise não
tratada (`unhandled rejection`, confirmado em teste RED) e o drawer renderizava o
estado vazio "Nenhuma sessão realizada ainda.", escondendo o erro real.
**Corrigido**: `catch` dedicado + estado `error` distinto do estado vazio legítimo,
com mensagem "Não foi possível carregar o histórico agora." Também corrigi um `finally`
sem `catch` equivalente em `PlanContractModal.tsx` (`handleConfirm`): se `onConfirm`
rejeitasse, a rejeição escapava sem tratamento; agora tem um `catch` vazio documentado
(o tratamento/exibição do erro é responsabilidade do `onConfirm` do chamador, que após
o Bug 3 nunca mais rejeita de verdade — o `catch` é só uma rede de segurança).

## Testes recomendados (e escritos nesta tarefa)

### Backend
- `subscriptions-patients.test.ts` (+2): `PATIENT` recebe 403 em `GET` e `POST`.
- `subscriptions-patients-activate.test.ts` (+3): `PATIENT` e `ESTHETICIAN` recebem 403;
  `RECEPTIONIST` consegue ativar (papel de equipe com permissão de billing).
- `subscriptions-patients-cancel.test.ts` (+3): idem para `cancel`.
- `subscriptions-patients-history.test.ts` (+1): caracterização — `PENDING_APPROVAL` e
  `CANCELED` aparecem no histórico, sem filtro de status.
- `appointments-post.test.ts` (+1): `PATIENT` com `subscriptionId` NÃO decrementa
  `sessionsUsedThisCycle` na criação (regressão do Bug 2 — RED confirmado antes da
  correção: 1 chamada indevida a `patientSubscription.update`).

### Frontend (todos os arquivos, sem teste algum antes desta tarefa)
- `PlanCard.test.tsx` (7 testes): renderização por `status` (available/active/pending),
  callbacks `onContract`/`onViewHistory`, imagem vs. placeholder, descrição opcional.
- `PlanContractModal.test.tsx` (6 testes): conteúdo, aviso de pagamento, Cancelar,
  loading durante `onConfirm`, reabilitação mesmo se `onConfirm` rejeitar, backdrop.
- `PlanProcedurePickerModal.test.tsx` (7 testes): `sessionsRemaining` -1/0/>0, toggle de
  seleção, item desabilitado sem sessões, botão Confirmar habilita/desabilita e envia
  os ids certos.
- `PlanHistoryDrawer.test.tsx` (7 testes): fetch com token/URL corretos, estado vazio,
  `PENDING_APPROVAL` renderizado com rótulo "Pendente" (Passo 2), status desconhecido
  (fallback), fotos antes/depois, `success:false` e falha de rede mostram erro (Bug 5).
- `PatientPlans.test.tsx` (10 testes): loading → conteúdo, estado vazio, assinatura
  `PENDING` (badge + navegação "Agendar agora"), assinatura `ACTIVE` (sessões
  restantes vindas do backend), contratação com sucesso (navega) e com falha HTTP/rede
  (mostra diálogo, não navega — Bug 3), falha ao carregar `/my` por resposta sem
  sucesso e por erro de rede (Bug 4), abrir histórico com o `subscriptionId` correto.

Total: **37 testes novos no frontend**, **10 testes novos no backend** (2058→2060 após
a correção do Bug 2, que também tocou `appointments-post.test.ts`, arquivo já existente
do agente anterior — 1 dos 10 é lá).

### Recomendados, não escritos nesta tarefa (fora do escopo)
- Mover `<DialogProvider>` para a raiz de `apps/PatientPortalApp.tsx` e remover o
  wrapper local criado em `PatientPlans.tsx` (ver Bug 3).
- Padronizar o formato de resposta de `POST /api/subscriptions/patients/self` para
  `{ success, data, error }` (hoje retorna o objeto cru na raiz) — não alterado nesta
  tarefa porque `pages/PublicBooking.tsx` (arquivo do agente anterior) consome essa
  mesma rota e também depende do formato atual (`res.ok`, não `json.success`); mudar o
  contrato arriscaria quebrar aquele fluxo sem coordenação.
- Se o produto quiser permitir que o próprio paciente cancele sua assinatura pelo
  portal (hoje não existe esse botão em `PatientPlans.tsx`), será preciso uma rota
  nova (ou uma exceção explícita e testada em `cancel`) que verifique
  `subscription.patientId` contra o paciente autenticado — a correção desta tarefa
  deliberadamente restringiu `cancel`/`activate` à equipe, sem essa exceção.
