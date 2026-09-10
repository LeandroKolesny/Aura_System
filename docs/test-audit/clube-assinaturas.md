# Auditoria de Testes — Clube de Assinaturas

Escopo: aba "Clube de Assinaturas" (`pages/Subscriptions.tsx`, role ADMIN/OWNER) e todo o backend que ela consome direta ou indiretamente (planos, assinantes, ativação/cancelamento, dedução de sessões em agendamentos, reset de ciclo via webhook Asaas).

## Funcionalidades identificadas

Mapeadas a partir de `pages/Subscriptions.tsx`, `components/SubscriptionPlanModal.tsx` e `services/api.ts` (bloco `subscriptionsApi`, linhas ~1310-1351):

1. **Listagem de planos** (aba "Planos") — KPIs de planos ativos, assinantes ativos, MRR (soma do preço dos assinantes `ACTIVE`) e pendentes.
2. **Criar plano de assinatura** — nome, preço mensal, descrição, imagem (upload local, redimensionada para 800px e convertida em `data:` URL — não sobe para storage), e lista de procedimentos incluídos com `sessionsPerCycle` por procedimento. Validações client-side: nome obrigatório, preço > 0, ao menos 1 item, `sessionsPerCycle >= 1`, procedimento não duplicado entre itens.
3. **Editar plano** — mesmo modal, reenvia todos os `items` (o backend recria a lista inteira via `deleteMany` + `create`).
4. **Desativar plano** (soft delete, `isActive:false`) — não afeta assinantes existentes, apenas impede novas inscrições/exibição por padrão.
5. **Inscrever paciente em plano** (`EnrollModal`) — seleciona paciente, plano ativo e próxima data de cobrança; cria `PatientSubscription` com `sessionsUsedThisCycle` zerado por procedimento.
6. **Listar assinantes** (aba "Assinantes") — tabela com paciente, plano, status (`ACTIVE/PAUSED/CANCELED/OVERDUE/PENDING`), próxima cobrança, barra de progresso de sessões usadas/limite do ciclo (`sessionsUsedThisCycle` somado vs. soma de `sessionsPerCycle` de todos os itens do plano).
7. **Cancelar assinatura** (a partir da aba Assinantes, só para status `ACTIVE`) — confirmação via `useDialog().confirm`, chama `PUT .../cancel`.
8. **Aba "Pendentes"** — assinaturas com status `PENDING` (criadas via solicitação do próprio paciente, `POST /api/subscriptions/patients/self`, ou via booking público). Duas ações:
   - **Ativar Plano** → `PATCH .../activate`, muda para `ACTIVE` e define `startDate`.
   - **Recusar** → reaproveita o mesmo endpoint `cancel` (`PUT .../cancel`) usado para cancelamento normal.
9. **Ciclo de renovação / `sessionsUsedThisCycle`** — não é gerenciado por nenhuma ação visível nesta página; é incrementado em `POST /api/appointments` (staff) e em `PATCH /api/appointments/[id]/status` (aprovação de agendamento de paciente), e só é **zerado** pelo webhook do Asaas (`SUBSCRIPTION_PAYMENT_RECEIVED`). Ver "Problemas encontrados" — isso é uma lacuna funcional relevante para uma tela que não tem nenhum botão de "resetar ciclo manualmente".
10. **Histórico de uso de sessões** — endpoint `GET /api/subscriptions/patients/[id]/history` existe, mas **não é chamado por `Subscriptions.tsx`** (não há `subscriptionsApi.history()`/`getHistory()` no client). É consumido apenas por `components/patient-portal/PlanHistoryDrawer.tsx` (portal do paciente), fora do escopo desta aba admin.

## Endpoints de backend usados

Chamados diretamente pela aba admin (via `services/api.ts` → `subscriptionsApi`):

| Ação na UI | Método client | Rota | Arquivo |
|---|---|---|---|
| Listar planos (com/sem inativos) | `listPlans(includeInactive)` | `GET /api/subscriptions/plans` | `aura-backend/src/app/api/subscriptions/plans/route.ts` |
| Criar plano | `createPlan()` | `POST /api/subscriptions/plans` | idem |
| Editar plano | `updatePlan()` | `PUT /api/subscriptions/plans/[id]` | `.../plans/[id]/route.ts` |
| Desativar plano | `deactivatePlan()` | `DELETE /api/subscriptions/plans/[id]` | idem |
| Listar assinantes / filtrar por status/paciente | `listSubscribers()`, `listPending()`, `listForPatient()` | `GET /api/subscriptions/patients[?status=][&patientId=]` | `.../patients/route.ts` |
| Inscrever paciente | `subscribe()` | `POST /api/subscriptions/patients` | idem |
| Cancelar/recusar assinatura | `cancel()` | `PUT /api/subscriptions/patients/[id]/cancel` | `.../patients/[id]/cancel/route.ts` |
| Ativar assinatura pendente | `activate()` | `PATCH /api/subscriptions/patients/[id]/activate` | `.../patients/[id]/activate/route.ts` |

Não usados por esta tela, mas parte do domínio "Clube de Assinaturas" (usados no portal do paciente / booking público) — incluídos para contexto porque afetam o mesmo modelo `PatientSubscription` que a tela admin exibe:

- `GET /api/subscriptions/patients/[id]/history` (`subscriptionsApi.history` não existe no client — só usado via chamada direta em `PlanHistoryDrawer.tsx`, verificar se usa `fetch` direto ou outro client).
- `POST /api/subscriptions/patients/self` (`self/route.ts`) — solicitação de plano pelo próprio paciente, origem principal das assinaturas `PENDING` que aparecem na aba "Pendentes".
- `GET /api/subscriptions/patients/my` (`my/route.ts`) — visão do paciente sobre sua própria assinatura (sessões usadas/restantes).
- `POST /api/public/subscriptions/book` — fluxo de agendamento público que cria `Patient` + `PatientSubscription` + `Appointment` de uma vez.
- `POST /api/webhooks/asaas` (`handleSubscriptionClubPayment`) — reseta `sessionsUsedThisCycle` e avança `nextBillingDate` em 1 mês quando o Asaas confirma o pagamento (`SUBSCRIPTION_PAYMENT_RECEIVED`), casado por `asaasSubscriptionId`.
- `GET /api/cron/check-subscriptions` — **atenção**: apesar do nome, este cron trata da assinatura SaaS da **empresa** (plano BASIC/PRO expirado), não tem nenhuma relação com o Clube de Assinaturas de pacientes. Não confundir os dois domínios "subscription".
- Dedução de sessão nos agendamentos: `POST /api/appointments` (staff, decrementa na criação) e `PATCH /api/appointments/[id]/status` (paciente, decrementa na aprovação `PENDING_APPROVAL → SCHEDULED`).

## Cobertura de testes atual

### Backend

Cobertura é de fato extensa. Arquivos e o que cada um cobre, em detalhe:

- **`subscriptions-patients.test.ts`** (GET/POST `/api/subscriptions/patients`): 401/403 sem auth/empresa, listagem escopada por `companyId`, filtro por `status`+`patientId`, bloqueio por `checkWriteAccess`, 400 campos obrigatórios, 404 paciente/plano inexistente ou plano inativo, 409 assinatura ativa duplicada (via transação atômica), criação com `sessionsUsedThisCycle` zerado por item do plano.
- **`subscriptions-patients-activate.test.ts`**: 401, bloqueio de escrita, 404 assinatura de outra empresa, 400 quando não está `PENDING`, ativação com sucesso (`status=ACTIVE`, `startDate` setado, retorno com `patient`/`plan`), escopo por empresa do usuário.
- **`subscriptions-patients-cancel.test.ts`**: 401, 404, 409 já cancelada, cancelamento de `ACTIVE` sem tocar agendamentos, cancelamento de `PENDING` restaurando preço original dos agendamentos `PENDING_APPROVAL` vinculados, resiliência quando agendamento vinculado não tem procedimento.
- **`subscriptions-patients-history.test.ts`**: 401/403, 404, isolamento por role (`PATIENT` só vê a própria assinatura, 403 se não tiver `Patient` correspondente), admin acessa qualquer assinatura da empresa, mapeamento correto dos campos (nome do procedimento/profissional, `photos: []` sempre vazio), ordenação por data decrescente.
- **`subscriptions-patients-my.test.ts`**: 401, listas vazias (sem empresa / sem `Patient`), filtro só `PENDING/ACTIVE/PAUSED`, cálculo de sessões usadas/restantes por procedimento, **regressão explícita**: nunca retorna `sessionsRemaining` negativo mesmo se `sessionsUsed` exceder o limite do ciclo, trata `sessionsUsedThisCycle` nulo como zero.
- **`subscriptions-patients-self.test.ts`**: 401, 403 não-`PATIENT`, 403 paciente sem empresa, 400 sem `planId`, 404 plano inexistente/inativo/outra empresa, 404 sem registro `Patient`, idempotência (retorna assinatura existente `PENDING/ACTIVE/PAUSED` em vez de duplicar), criação de nova `PENDING` com sessões zeradas.
- **`subscriptions-plans.test.ts`** e **`subscriptions-plans-id.test.ts`** (parcialmente sobrepostos): GET com filtro `isActive`/`includeInactive`, 401/403; POST criação com itens via nested create, 400 sem `name`/`items` vazio, chamada de `checkWriteAccess`; PUT edição parcial de campos, recriação de `items`, `isActive=false` via PUT, 404 plano inexistente; DELETE soft delete (`isActive:false`, não apaga registro), 404, chamada de `checkWriteAccess`.
- **`cron-check-subscriptions.test.ts`**: cobre o cron de expiração do plano **da empresa** (SaaS), não tem relação com o Clube de Assinaturas de pacientes — não confundir na hora de "achar" que o reset de ciclo é testado aqui.
- **`public-subscriptions-book.test.ts`**: fluxo completo do booking público (cria `Patient` não `User`, evita duplicar `Patient`/`User`, reaproveita assinatura ativa existente, valida senha/e-mail/nome com mensagens em PT, rate limit, 404 empresa/plano, 400 procedimento fora do plano, preço 0 em assinatura existente vs. preço do plano na primeira assinatura), e o caso central: **400 `SESSION_LIMIT_REACHED`** quando a assinatura `ACTIVE` já atingiu o limite, e que o limite **não** é aplicado quando a assinatura ainda está `PENDING`.
- **`appointments-post.test.ts`** (fora da pasta subscriptions, mas cobre a dedução): zera preço quando coberto por assinatura ativa, decrementa sessão ao criar agendamento (staff), avisa mas cobra preço cheio quando sessões esgotadas.
- **`appointments-status.test.ts`**: deduz sessão na aprovação `PENDING_APPROVAL → SCHEDULED` dentro do limite, retorna 400 quando limite atingido, não deduz quando a assinatura está `PENDING`.

Não encontrado nenhum teste para:
- `handleSubscriptionClubPayment` (reset de `sessionsUsedThisCycle` + `lastCycleReset` + `nextBillingDate` no webhook Asaas) — o único teste do webhook (`__tests__/security/webhook-asaas.test.ts`) cobre apenas autenticação/token, não o comportamento de negócio do evento `SUBSCRIPTION_PAYMENT_RECEIVED`.
- O caminho em `appointments/[id]/status/route.ts` onde a assinatura vinculada ao agendamento **não** está `ACTIVE` no momento da aprovação (foi cancelada/pausada entre a solicitação e a aprovação) ou onde o procedimento não está entre os itens do plano — ver "Problemas encontrados".

### Frontend

Não existe nenhum teste específico de `pages/Subscriptions.tsx` nem de `components/SubscriptionPlanModal.tsx`. Confirmado: `C:\Aura_System\__tests__\` contém apenas `context/AppContext.test.tsx` e `services/api.test.ts`.

`__tests__/services/api.test.ts` cobre o cliente HTTP `subscriptionsApi` (URL, método e corpo da requisição, e repasse de erro em vez de "fingir sucesso"), mas apenas para: `listPlans`, `listPending`, `listSubscribers`, `subscribe`, `cancel`, `activate`, `deactivatePlan`. Não há teste de client para `createPlan`, `updatePlan`, `listForPatient` nem `requestSelf`.

Nenhum teste de componente/página (RTL) existe para: renderização das abas, cálculo de KPIs (planos ativos, assinantes ativos, MRR, pendentes), fluxo de criar/editar/desativar plano via modal, fluxo de inscrição (`EnrollModal`), fluxo de cancelar/ativar/recusar assinatura, cálculo da barra de progresso de sessões usadas, ou tratamento de erro (`showAlert` quando `res.success === false`).

### E2E

Nenhum spec Playwright cobre o Clube de Assinaturas do lado admin. Confirmado por leitura de todos os 6 specs existentes (`dashboard.spec.ts`, `login.spec.ts`, `forgot-password.spec.ts`, `public-booking.spec.ts`, `register.spec.ts`, `whatsapp-settings.spec.ts`). Em particular, `public-booking.spec.ts` não contém nenhuma menção a "subscription", "assinatura" ou "clube" — cobre apenas o fluxo de agendamento público em si, sem tocar no plano de assinatura.

## Problemas encontrados durante a revisão

1. **Reset de ciclo depende exclusivamente do webhook do Asaas.** `sessionsUsedThisCycle`/`lastCycleReset`/`nextBillingDate` só são zerados em `handleSubscriptionClubPayment` (`aura-backend/src/app/api/webhooks/asaas/route.ts`), disparado por `SUBSCRIPTION_PAYMENT_RECEIVED` casado por `asaasSubscriptionId`. Uma assinatura inscrita manualmente pela aba "Inscrever Paciente" (`EnrollModal`, que não coleta `asaasSubscriptionId`) fica com esse campo `null` para sempre — não existe nenhum cron/job que zere o ciclo por data (`nextBillingDate`) para assinaturas sem integração Asaas. Na prática, uma clínica que cobra manualmente (fora do Asaas) nunca terá o contador de sessões renovado após o primeiro ciclo: a partir do mês 2 o paciente aparecerá com sessões "esgotadas" permanentemente, mesmo pagando em dia. Não corrigido — apenas registrado, conforme solicitado.
2. **Aprovação de agendamento vinculado a uma assinatura não mais `ACTIVE` não recalcula o preço.** Em `appointments/route.ts`, quando um paciente solicita um agendamento com `subscriptionId`, o preço é gravado como `0` imediatamente (comentário no código: "real count calculado na aprovação"). Em `appointments/[id]/status/route.ts` (aprovação `PENDING_APPROVAL → SCHEDULED`), a dedução de sessão só ocorre `if (sub)` — a busca filtra `status: "ACTIVE"`. Se a assinatura foi cancelada/pausada entre a solicitação e a aprovação, ou se o procedimento não está entre os itens do plano (`planItem` não encontrado), o bloco inteiro é pulado silenciosamente: nenhuma sessão é deduzida **e o preço permanece R$ 0**, sem qualquer aviso ou correção. Resultado: atendimento gratuito indevido. Não há teste cobrindo esse caminho (os três testes existentes em `appointments-status.test.ts` só cobrem assinatura `ACTIVE` dentro/no limite e assinatura `PENDING`).
3. **Possível condição de corrida na dedução de sessão durante a aprovação.** Em `appointments/[id]/status/route.ts`, a checagem `used >= planItem.sessionsPerCycle` e o `update` subsequente não estão dentro de uma `$transaction` (diferente do `POST /api/subscriptions/patients`, que usa transação atômica exatamente para evitar duplicidade). Duas aprovações concorrentes do último agendamento disponível no ciclo poderiam ambas passar pela checagem antes de qualquer `update` ser aplicado, ultrapassando o limite de sessões do plano. Não reproduzido, apenas um risco teórico a validar/testar.
4. **Inconsistência de formato de resposta da API entre GET e mutações.** As rotas `GET /api/subscriptions/plans` e `GET /api/subscriptions/patients` retornam o array cru (`NextResponse.json(plans)` / `NextResponse.json(subscriptions)`), enquanto POST/PUT/PATCH/DELETE retornam `{ success, data }` — conforme a convenção documentada em `CLAUDE.md` ("All API responses follow `{ success: boolean, data?: T, error?: string }`"). Como `fetchApi` em `services/api.ts` já embrulha qualquer corpo de resposta em `{ success: response.ok, data: <corpo> }`, isso não quebra os GETs (o array vira `res.data` corretamente), mas faz com que `res.data` de `createPlan`, `updatePlan`, `subscribe`, `cancel` e `activate` seja na verdade `{ success: true, data: <entidade> }` (dupla camada), não a entidade em si. Hoje isso não causa bug visível porque `Subscriptions.tsx`/`SubscriptionPlanModal.tsx` só checam `res.success` e sempre recarregam a lista via `loadData()` depois — mas qualquer código futuro que tente ler `res.data.id` ou `res.data.status` diretamente dessas chamadas vai quebrar silenciosamente.
5. **Endpoint de histórico não é usado pela aba admin.** `GET /api/subscriptions/patients/[id]/history` existe e tem testes de backend, mas não há nenhum botão/ação em `Subscriptions.tsx` que chame `subscriptionsApi` para exibir o histórico de sessões de um assinante — o admin não consegue ver o histórico de uso de sessões de um paciente pela aba Assinantes hoje (só o próprio paciente vê, via `PlanHistoryDrawer`). Isso é uma lacuna de produto/UX, não um bug de teste, mas vale registrar porque o enunciado da tarefa presumia essa funcionalidade na tela admin.

## Testes recomendados

### Alta prioridade

1. **[Backend]** Reset de ciclo via webhook Asaas não tem cobertura funcional nenhuma — `aura-backend/src/__tests__/api/webhooks-asaas-subscription-payment.test.ts` (novo arquivo): `SUBSCRIPTION_PAYMENT_RECEIVED` com `payment.subscription` casando uma `PatientSubscription ACTIVE` zera `sessionsUsedThisCycle` para todos os itens do plano atual, atualiza `lastCycleReset` e avança `nextBillingDate` em 1 mês; não faz nada quando não encontra assinatura `ACTIVE` com aquele `asaasSubscriptionId`; recalcula `resetSessions` com base nos itens **atuais** do plano mesmo se o plano foi editado (item removido/adicionado) desde a última assinatura.
2. **[Backend]** Aprovação de agendamento com assinatura não mais ativa — em `appointments-status.test.ts`: caso `PENDING_APPROVAL → SCHEDULED` onde `appointment.subscriptionId` aponta para uma assinatura com status `CANCELED`/`PAUSED`/`OVERDUE` no momento da aprovação — hoje o preço permanece `0` sem dedução; documentar o comportamento atual com um teste de regressão (mesmo que a decisão de produto seja "não cobrar", isso precisa estar testado e explícito, não implícito).
3. **[Backend]** Aprovação de agendamento cujo procedimento não está entre os itens do plano vinculado (`planItem` não encontrado em `appointments/[id]/status/route.ts`) — mesmo problema do item 2 (preço fica 0 silenciosamente); adicionar teste de regressão.
4. **[Backend]** Condição de corrida na dedução de sessão na aprovação — teste simulando duas chamadas concorrentes a `PATCH /api/appointments/[id]/status` para dois agendamentos diferentes vinculados à mesma assinatura/procedimento quando resta exatamente 1 sessão, mockando o Prisma para que ambos leiam `sessionsUsedThisCycle` antes de qualquer `update` — confirmar se o sistema atual permite ultrapassar o limite (se sim, é bug real a corrigir depois; se a suíte não conseguir simular por causa do mock ser sequencial, pelo menos documentar a lacuna e considerar mover a checagem para dentro de `$transaction`/`updateMany` condicional).
5. **[E2E Playwright]** `e2e/subscriptions-admin.spec.ts` (novo): fluxo completo do admin — login como ADMIN, criar plano com 1+ procedimento, inscrever paciente existente no plano, ver o assinante aparecer na aba "Assinantes" com barra de sessões 0/N, cancelar a assinatura e confirmar que o status muda para "Cancelada" e o botão de cancelar some. Hoje esse fluxo tem zero cobertura E2E.
6. **[Frontend Vitest+RTL]** `__tests__/pages/Subscriptions.test.tsx` (novo): mock de `subscriptionsApi`, cobrir: cálculo de KPIs (`activePlans.length`, `activeSubscribers.length`, MRR somando só `ACTIVE`, `pendingSubscriptions.length`); cálculo da barra de progresso de sessões (`sessionsUsed >= sessionsCap` pinta vermelho, `Math.min(100, ...)` não estoura 100% quando `sessionsUsed > sessionsCap`); chamada de `showAlert` com a mensagem de erro do backend quando `cancel()`/`activate()`/`deactivatePlan()` retornam `res.success === false` (regra obrigatória do CLAUDE.md de nunca ignorar erro de mutação).

### Média prioridade

7. **[Backend]** `subscriptions-plans.test.ts`/`subscriptions-plans-id.test.ts`: teste explícito de que `PUT` com `items` recria a lista (itens antigos removidos deixam de aparecer no plano — hoje só se testa que os novos itens aparecem, não que os antigos somem).
8. **[Backend]** `subscriptions-patients-cancel.test.ts`: teste de cancelamento de assinatura `ACTIVE` no meio do ciclo com sessões parcialmente usadas — confirmar que `sessionsUsedThisCycle` não é alterado/zerado no cancelamento (comportamento atual aparenta ser "não mexe", mas não há teste que trave isso como regressão) e que agendamentos `SCHEDULED`/`CONFIRMED` futuros vinculados à assinatura cancelada não são automaticamente cancelados nem têm o preço recalculado.
9. **[Frontend Vitest+RTL]** `SubscriptionPlanModal.test.tsx` (novo): validações client-side (nome vazio, preço <= 0, item sem procedimento, `sessionsPerCycle < 1`, procedimento duplicado entre itens), fluxo de edição pré-preenchendo campos a partir de `plan`, upload de imagem >2MB disparando `showAlert` de aviso em vez de crashar.
10. **[Frontend Vitest+RTL]** `EnrollModal` (dentro de `Subscriptions.test.tsx` ou arquivo próprio): validação de campos obrigatórios (paciente/plano/data), exibição de `res.error` quando `subscribe()` falha (ex.: 409 "paciente já possui assinatura ativa").
11. **[Backend]** `services/api.ts`: cobrir `createPlan`, `updatePlan`, `listForPatient` e `requestSelf` em `__tests__/services/api.test.ts` com o mesmo padrão já usado para os outros métodos (URL, verbo, corpo, repasse de erro).
12. **[Backend]** Adicionar teste para o formato de resposta inconsistente (item 4 dos problemas encontrados) como teste de contrato: `createPlan`/`updatePlan`/`subscribe`/`cancel`/`activate` retornam `{ success: true, data: {...} }` no corpo HTTP (não o array/objeto cru) — hoje isso não é validado explicitamente em nenhum teste de backend, só implicitamente pelo shape do mock.

### Baixa prioridade

13. **[E2E Playwright]** Fluxo da aba "Pendentes": paciente solicita plano via portal (ou seed direto no banco de teste) → aparece em "Pendentes" no admin → admin clica "Ativar Plano" → assinatura migra para "Assinantes" com status "Ativa". Alternativamente, fluxo "Recusar" removendo a pendência.
14. **[Frontend Vitest+RTL]** Estado vazio de cada aba (nenhum plano, nenhum assinante, nenhum pendente) renderizando a mensagem/placeholder correta.
15. **[Backend]** `subscriptions-plans-id.test.ts`: teste de que `DELETE` (soft delete) não afeta contagem de `_count.subscribers` de assinantes já `ACTIVE` vinculados ao plano desativado (a UI mostra "assinantes não serão afetados" na confirmação — vale um teste de regressão garantindo que o dado exibido continua correto).
16. **[Frontend Vitest+RTL]** Acessibilidade/estado de loading dos botões (`disabled` durante `cancellingId`/`activatingId`/`saving`) para evitar duplo clique disparando duas requisições.
