# Auditoria de Testes — Assinatura (Billing)

> Escopo: assinatura da CLÍNICA com o SaaS Aura (cobrança via Asaas), telas `pages/admin/Billing.tsx` e
> `pages/admin/BillingPending.tsx`, rotas `aura-backend/src/app/api/billing/*` e o webhook
> `aura-backend/src/app/api/webhooks/asaas/route.ts`. Não confundir com "Clube de Assinaturas"
> (`subscriptionsApi`, planos de pacientes — `pages/admin/*Subscription*` fora deste escopo).

## Funcionalidades identificadas

**`pages/admin/Billing.tsx`** (rota `/billing`)
1. Carregamento de planos disponíveis + plano/status atual da empresa (`GET /api/billing/plans` no `useEffect` inicial).
2. Exibição do card "Plano atual" com status (`ACTIVE`/`TRIAL`/`OVERDUE`/`CANCELED`) traduzido via `STATUS_LABELS` e data de expiração formatada em pt-BR.
3. Grid de planos (Starter/Pro/Clinic) com preço, features, ícone e cor por plano; card do plano atual fica destacado com badge "Seu Plano" e botão desabilitado ("Plano atual").
4. Highlight/scroll automático para um plano vindo por query string (`?plan=<id>`), usado quando o usuário chega pela LandingPage.
5. **Auto-checkout**: se a URL tem `?plan=<id>&autoCheckout=true`, dispara `handleSubscribe` automaticamente assim que os planos carregam (guarda com `autoCheckoutFired` ref para não duplicar).
6. **Checkout manual**: botão "Assinar" chama `POST /api/billing/checkout` com o `planId`. Em caso de sucesso com `paymentUrl`, abre popup (`window.open`) e navega para `/billing/aguardando`; se o navegador bloquear o popup, mostra link manual (`blockedPaymentUrl`) na própria página; se não houver `paymentUrl` (ex.: cobrança futura), mostra mensagem de sucesso genérica.
7. Tratamento de erro de checkout: extrai mensagem de erro de múltiplos formatos possíveis de payload e exibe banner vermelho; erro de rede também tratado (`catch`).
8. Nenhuma tela de "downgrade" com confirmação/alerta especial — qualquer plano (superior ou inferior ao atual) é tratado da mesma forma pelo botão "Assinar".

**`pages/admin/BillingPending.tsx`** (rota `/billing/aguardando`)
1. Tela de espera exibida após abrir o link de pagamento; faz **polling** em `GET /api/billing/status` a cada 10s.
2. Ao detectar `status === 'ACTIVE'`, navega para `/dashboard` com `replace: true` e `state: { paymentSuccess: true }`.
3. Timeout de 30 minutos (`Date.now() - startTime.current >= TIMEOUT_MS`) sem confirmação → mostra tela de "Não identificamos seu pagamento ainda", com botões "Voltar para Planos" e "Verificar novamente" (reseta `startTime` e volta a pollar).
4. Falhas de rede no polling são silenciadas (`catch {}` vazio) — o polling simplesmente continua tentando no próximo intervalo; não há mensagem alguma ao usuário se todas as tentativas falharem por erro de rede (diferente do caminho de timeout, que é por tempo, não por erro).
5. Nenhum tratamento caso `res.success` seja `false` mas sem exceção (ex.: 401 por sessão expirada durante a espera) — o código só olha `statusData?.status === 'ACTIVE'`; uma resposta de erro estruturada não interrompe o polling nem avisa o usuário.

**Bloqueio de acesso quando vencida** (não está nestas duas páginas, mas é o efeito direto do status que elas mostram):
- Backend: `aura-backend/src/lib/planPermissions.ts` (`isReadOnlyMode`, `hasModuleAccess`, `canCreatePatient`, `canCreateProfessional`) + `aura-backend/src/lib/apiGuards.ts` (`checkWriteAccess`, `checkModuleAccess`, `checkPatientLimit`, `checkProfessionalLimit`) — usados em ~19 rotas de mutação (patients, users, appointments, photos, transactions, subscriptions de clube, etc.) para bloquear escrita com 403 quando `subscriptionStatus === 'OVERDUE'`/`'CANCELED'` ou plano `BASIC`/trial expirado.
- Cron `aura-backend/src/app/api/cron/check-subscriptions/route.ts`: roda diariamente, encontra empresas com `subscriptionExpiresAt < now` e plano ainda não `BASIC`, move para `plan: BASIC`, `subscriptionStatus: OVERDUE`, preservando o plano anterior em `lastPlan`.
- Frontend: `context/AppContext.tsx` calcula `isReadOnly` (usado em `App.tsx` para mostrar banner vermelho "Modo Leitura"/"Plano expirado" com botão "Renovar" que abre `SubscriptionModal`) e `checkWriteAccess()`/`checkModuleAccess()` client-side.

## Endpoints de backend usados

| Endpoint | Arquivo | Usado por |
|---|---|---|
| `GET /api/billing/plans` | `aura-backend/src/app/api/billing/plans/route.ts` | `Billing.tsx` (carregamento inicial) |
| `POST /api/billing/checkout` | `aura-backend/src/app/api/billing/checkout/route.ts` | `Billing.tsx` (`handleSubscribe`) |
| `GET /api/billing/status` | `aura-backend/src/app/api/billing/status/route.ts` | `BillingPending.tsx` (polling) |
| `POST /api/webhooks/asaas` | `aura-backend/src/app/api/webhooks/asaas/route.ts` | Chamado pela Asaas (não pelo frontend) — é quem efetivamente muda `plan`/`subscriptionStatus`/`subscriptionExpiresAt` após confirmação de pagamento |
| `GET /api/cron/check-subscriptions` | `aura-backend/src/app/api/cron/check-subscriptions/route.ts` | Cron Vercel — não é chamado pela UI, mas é quem derruba a empresa para `BASIC`/`OVERDUE` quando o prazo vence sem novo pagamento |

Funções de suporte: `aura-backend/src/lib/asaas.ts` (`findCustomerByEmail`, `createCustomer`, `createSubscription`, `getSubscriptionPayments`, `cancelSubscription` — esta última **nunca é chamada** pelo checkout, ver Problemas) e `aura-backend/src/lib/billingUtils.ts` (`resolvePlanFromPayment`).

## Cobertura de testes atual

### Backend
- **`__tests__/api/billing-plans.test.ts`** — cobre: 401 sem auth; filtro `isActive: true` + ordenação por preço; retorno de `currentPlan`/`currentStatus` da empresa do usuário; `companyId` nulo → `currentPlan: null` sem consultar o banco; empresa não encontrada → `currentPlan: null`. Boa cobertura para o que a rota faz.
- **`__tests__/api/billing-status.test.ts`** — cobre: 401 sem auth; 400 sem `companyId`; retorno correto de `status`/`plan`/`expiresAt`; busca pelo `companyId` do JWT; 404 quando empresa não existe. Completa para o escopo da rota.
- **`__tests__/api/billing-checkout.test.ts`** — cobertura ampla: 403 sem auth e sem ser admin; 400 sem empresa/sem `planId`; 404 plano inexistente/inativo; 404 empresa inexistente; reaproveitamento de `asaasCustomerId` existente; busca por e-mail quando não existe; criação de cliente novo (com e sem CPF de sandbox); mapeamento de nome de plano → enum (`PLAN_NAME_MAP`) incluindo fallback `STARTER`; persistência do `asaasSubscriptionId`; prioridade de link de pagamento (`invoiceUrl` > `pixQrCodeUrl` > `bankSlipUrl` > `null`); erro genérico sem vazar detalhes internos quando a Asaas falha. **Não cobre**: comportamento quando a empresa já tem uma assinatura ativa/outro `asaasSubscriptionId` anterior (troca de plano), nem qualquer validação de limites do novo plano vs. dados existentes (não existe validação a testar, ver Problemas).
- **`__tests__/security/webhook-asaas.test.ts`** — cobre **apenas a camada de segurança/autenticação** do webhook: 401 sem token, 401 com token errado, 401 quando `ASAAS_WEBHOOK_TOKEN` não está configurado, 401 com token vazio, 200 com token correto, não acessa o banco quando token é inválido, 400 para JSON inválido com token válido. **Não há nenhum teste da lógica de negócio do webhook** (mudança real de `plan`/`subscriptionStatus`/`subscriptionExpiresAt` por tipo de evento, resolução da empresa por `asaasCustomerId`, eventos sem `customer`, empresa não encontrada, ou o branch `SUBSCRIPTION_PAYMENT_RECEIVED` que reinicia sessões do Clube de Assinaturas). Esse é o maior gap encontrado.
- **`__tests__/lib/billingUtils.test.ts`** — cobre bem `resolvePlanFromPayment`: prioridade de `externalReference`, fallback por valor (97/197/397), fallback final `STARTER`, `externalReference` nulo ou inválido.
- **`__tests__/api/cron-check-subscriptions.test.ts`** — cobre bem o cron: 401 sem header/token errado/sem `CRON_SECRET`; filtro correto (expiradas, não `BASIC`, não `CANCELED`); `processed: 0` sem empresas; move para `BASIC`/`OVERDUE` preservando `lastPlan`; erro isolado por empresa sem interromper o loop; 500 em erro inesperado na query principal.
- **`__tests__/lib/planPermissions.test.ts`** — **praticamente vazio**: só testa que o tipo `SystemModule` inclui `'whatsapp_notifications'`. As funções realmente usadas para bloquear escrita quando a assinatura está vencida (`isReadOnlyMode`, `hasModuleAccess`, `canCreatePatient`, `canCreateProfessional`, `getPlanErrorMessage`) **não têm nenhum teste unitário direto**, apesar de serem chamadas por `apiGuards.ts` em ~19 rotas de mutação.

### Frontend
- Confirmado: **não existe nenhum teste** para `Billing.tsx` ou `BillingPending.tsx`. Os únicos arquivos em `__tests__/` são `context/AppContext.test.tsx` e `services/api.test.ts`, e nenhum dos dois referencia `billingApi`/`Billing`/`BillingPending` (o `api.test.ts` testa `subscriptionsApi.subscribe`, que é do Clube de Assinaturas de pacientes, feature diferente).
- `services/api.ts` expõe `billingApi.getPlans/checkout/getStatus` sem nenhum teste próprio (o `AppContext.test.tsx` também não exercita o `isReadOnly`/`checkWriteAccess`/`checkModuleAccess` do contexto).

### E2E
- Confirmado: nenhum spec em `e2e/` cobre o fluxo de assinatura/checkout. `dashboard.spec.ts` e `login.spec.ts` apenas usam `/billing` dentro de uma regex de redirecionamento pós-login (`waitForURL(/\/(dashboard|schedule|billing)/)`), sem testar nada da página em si. Não há spec algum para `BillingPending.tsx`, para o botão "Assinar", nem para o banner de modo somente leitura.

## Problemas encontrados durante a revisão

1. **Frontend `isReadOnly` ignora `subscriptionStatus`, só olha a data de expiração** (`context/AppContext.tsx`, linhas ~245-253):
   ```ts
   const isExpired = new Date(currentCompany.subscriptionExpiresAt) < new Date();
   const isBasic = currentCompany.plan === 'basic';
   return isExpired || (isBasic && isExpired);
   ```
   O webhook `PAYMENT_OVERDUE` marca `subscriptionStatus: 'OVERDUE'` **sem alterar `subscriptionExpiresAt`** (esse campo só é setado no `PAYMENT_CONFIRMED`, +1 mês). Ou seja: é possível a empresa estar com `subscriptionStatus === 'OVERDUE'` e `subscriptionExpiresAt` ainda no futuro — nesse caso o backend (`isReadOnlyMode`/`checkWriteAccess`, que checam `subscriptionStatus === 'OVERDUE'` diretamente) já bloqueia escrita com 403, mas o frontend não mostra o banner de aviso nem desabilita nada, porque `isReadOnly` no `AppContext` só olha a data. Resultado prático: o usuário tenta salvar algo, recebe um erro 403 genérico sem contexto de "assinatura vencida, renove", em vez do aviso proativo. É a divergência backend-vs-frontend citada no pedido ("empresa parecendo liberada após vencer").
   A segunda cláusula `(isBasic && isExpired)` também é código morto/redundante, já coberta por `isExpired` sozinho.

2. **Checkout nunca cancela a assinatura Asaas anterior ao trocar de plano** (`aura-backend/src/app/api/billing/checkout/route.ts`): existe `cancelSubscription()` exportado em `aura-backend/src/lib/asaas.ts`, mas o checkout nunca o chama. Ao clicar "Assinar" em outro plano (upgrade OU downgrade) com uma assinatura já ativa, o código só sobrescreve `company.asaasSubscriptionId` no banco com o novo `subscription.id` — a assinatura antiga continua ativa e cobrando do lado da Asaas. Se a assinatura antiga gerar um novo pagamento confirmado depois (ex.: cobrança mensal automática da assinatura antiga que ainda não foi cancelada), o webhook `PAYMENT_CONFIRMED` vai resolver o plano pelo `externalReference`/valor **daquele pagamento antigo** e sobrescrever `company.plan` com o plano antigo, revertendo silenciosamente o upgrade/downgrade mais recente. É a race condition "pagamento confirmado x navegação" citada no pedido, mas na verdade mais grave: é uma race entre duas assinaturas Asaas concorrentes para o mesmo cliente.

3. **Nenhuma validação de downgrade contra dados existentes**: o checkout aceita qualquer `planId` ativo sem checar se a empresa já tem, por exemplo, mais profissionais cadastrados do que `maxProfessionals` do novo plano permite (o mesmo vale para `maxPatients`). Não há bloqueio, aviso ou confirmação — o `POST /api/billing/checkout` e o webhook `PAYMENT_CONFIRMED` aplicam a troca de plano incondicionalmente. Isso pode deixar a empresa "acima do limite" no plano novo sem nenhuma via de correção guiada (os guards `checkProfessionalLimit`/`checkPatientLimit` só impedem *criar* um profissional/paciente novo — não fazem nada com os que já excedem o limite após um downgrade).

4. **`BillingPending.tsx` silencia qualquer erro de rede no polling** (`catch {}` vazio) e também não trata uma resposta HTTP válida porém `success: false` (ex.: sessão expirada em `GET /api/billing/status` durante a espera de até 30 minutos) — nesses casos o polling continua endlessly até o timeout de 30 min sem nunca informar o usuário que algo deu errado (diferente do fluxo de timeout "normal"). Isso conflita com a regra do projeto de nunca deixar uma falha de API silenciosa sem informar o usuário.

5. **Nenhuma tela de confirmação/aviso de downgrade** no `Billing.tsx`: trocar para um plano inferior usa exatamente o mesmo botão/fluxo "Assinar" que um upgrade, sem nenhum aviso sobre possível perda de acesso a módulos ou dados acima do novo limite.

6. **Auto-checkout pode disparar múltiplas assinaturas** se o usuário atualizar a página em `/billing?plan=X&autoCheckout=true` antes do primeiro checkout finalizar — `autoCheckoutFired` é um `useRef`, então um reload do navegador zera essa proteção e o `useEffect` dispara `handleSubscribe` de novo; combinado com o item 2 (checkout não cancela assinatura anterior), múltiplos reloads na URL de auto-checkout podem criar múltiplas assinaturas Asaas para o mesmo plano.

## Testes recomendados

### Alta prioridade
1. **[Backend Vitest]** `aura-backend/src/__tests__/api/webhook-asaas-business.test.ts` (novo arquivo, complementando o de segurança) — cobrir a lógica de negócio do webhook: `PAYMENT_CONFIRMED` atualiza `plan`/`subscriptionStatus: 'ACTIVE'`/`subscriptionExpiresAt` (+1 mês) chamando `resolvePlanFromPayment`; `PAYMENT_OVERDUE` seta `subscriptionStatus: 'OVERDUE'` sem alterar `plan`/`subscriptionExpiresAt`; `SUBSCRIPTION_INACTIVATED` e `PAYMENT_DELETED` setam `subscriptionStatus: 'CANCELED'` e `asaasSubscriptionId: null`; evento sem `payment.customer`/`subscription.customer` retorna 200 sem tocar o banco; `customerId` que não corresponde a nenhuma empresa retorna 200 sem erro; `SUBSCRIPTION_PAYMENT_RECEIVED` com `payment.subscription` correspondendo a uma `PatientSubscription` ativa zera `sessionsUsedThisCycle` e atualiza `nextBillingDate`/`lastCycleReset`; mesmo evento quando não existe `PatientSubscription` correspondente não lança erro.
2. **[Backend Vitest]** `aura-backend/src/__tests__/lib/planPermissions.test.ts` (reescrever/expandir o arquivo hoje quase vazio) — testar `isReadOnlyMode` (BASIC→true, OVERDUE→true, TRIAL expirado→true, ACTIVE→false), `hasModuleAccess` (CANCELED→false sempre, expirado→false, módulo presente/ausente no plano), `canCreatePatient`/`canCreateProfessional` (limite -1 = ilimitado, limite atingido, `isReadOnlyMode` bloqueia mesmo com vagas livres), `getPlanErrorMessage` (mensagem certa por cenário).
3. **[Backend Vitest]** `aura-backend/src/__tests__/api/billing-checkout.test.ts` (adicionar casos ao arquivo existente) — cenário: empresa já possui `asaasSubscriptionId` ativo e faz checkout de outro plano — documentar/expor que `cancelSubscription` não é chamado hoje (teste que falha ou que serve de guarda de regressão assim que a correção for feita); cenário de downgrade com `professionalCount`/`patientCount` atuais acima do `maxProfessionals`/`maxPatients` do plano de destino — hoje não há bloqueio, então este teste documenta o comportamento permissivo atual e deve ser atualizado quando a regra de negócio for definida.
4. **[Frontend Vitest+RTL]** `__tests__/pages/Billing.test.tsx` (novo) — cenários: renderiza lista de planos e destaca o plano atual com botão desabilitado "Plano atual"; clique em "Assinar" chama `api.billing.checkout` e, com `paymentUrl` retornado e popup não bloqueado, navega para `/billing/aguardando`; com popup bloqueado (`window.open` retornando `null`), mostra o link `blockedPaymentUrl` em vez de navegar; erro do checkout (`res.success: false`) exibe a mensagem de erro no banner vermelho; erro de rede (`checkout` rejeita) exibe "Erro de conexão"; falha de `getPlans` (`res.success: false`) exibe "Sessão expirada. Faça login novamente."
5. **[Frontend Vitest+RTL]** `__tests__/pages/BillingPending.test.tsx` (novo) — usando fake timers: polling chama `api.billing.getStatus` a cada 10s; ao receber `status: 'ACTIVE'`, navega para `/dashboard` com `state: { paymentSuccess: true }` e para o polling (verificar que `getStatus` não é mais chamado depois); sem confirmação após avançar 30 minutos de tempo simulado, mostra a tela de timeout; botão "Verificar novamente" reseta o timer e volta a exibir a tela de espera.
6. **[E2E Playwright]** `e2e/billing.spec.ts` (novo) — fluxo completo mockando a rede (`page.route`) para `/api/billing/plans`, `/api/billing/checkout` e `/api/billing/status`: login como ADMIN/OWNER → navegar para `/billing` → ver plano atual e status → clicar "Assinar" em outro plano → interceptar a chamada de checkout e simular `paymentUrl` → verificar redirecionamento para `/billing/aguardando` → mockar `getStatus` retornando `ACTIVE` após 1-2 polls → verificar redirecionamento final para `/dashboard`.

### Média prioridade
7. **[Backend Vitest]** `billing-status.test.ts` (adicionar caso) — quando `subscriptionStatus` é `null`/`undefined` no banco (empresa legada sem valor default aplicado), a resposta não deve quebrar (`status: null` tratado corretamente pelo frontend).
8. **[Frontend Vitest+RTL]** teste de `App.tsx`/layout (ou dentro de `AppContext.test.tsx`) para o cálculo de `isReadOnly`: empresa com `subscriptionStatus: 'overdue'` e `subscriptionExpiresAt` no futuro — hoje `isReadOnly` retorna `false` (bug do item 1); escrever o teste refletindo o comportamento atual como guarda de regressão e marcá-lo para revisão quando o bug for corrigido, já que o objetivo aqui é também documentar a divergência.
9. **[E2E Playwright]** `e2e/billing.spec.ts` — cenário de popup bloqueado: mockar `window.open` retornando `null` e verificar que a página mostra o link "Ir para o pagamento" em vez de navegar automaticamente.
10. **[Backend Vitest]** `aura-backend/src/__tests__/api/billing-checkout.test.ts` — caso de erro quando `getSubscriptionPayments` lança exceção (hoje cai no mesmo catch genérico — confirmar que retorna 500 com mensagem genérica, sem vazar detalhes da Asaas, igual ao caso de `createSubscription`).
11. **[Frontend Vitest+RTL]** `Billing.test.tsx` — auto-checkout: com `?plan=X&autoCheckout=true` na URL, `handleSubscribe` é chamado automaticamente uma única vez mesmo se o componente re-renderizar (proteção do `autoCheckoutFired` ref).

### Baixa prioridade
12. **[Frontend Vitest+RTL]** `BillingPending.test.tsx` — falha de rede (exceção) durante um poll individual não interrompe o intervalo (o próximo poll de 10s ainda ocorre) — documentar o comportamento de "falha silenciosa" atual (item 4 dos problemas).
13. **[Backend Vitest]** `billing-plans.test.ts` — caso com `plan.features`/`modules` vazio ou plano com `price` como `Decimal` do Prisma (verificar serialização correta para `Number(plan.price)` no frontend).
14. **[E2E Playwright]** cenário de acessibilidade/responsividade básica da tela `/billing` (grid de planos em mobile) — baixo risco de regressão funcional, mais cosmético.
15. **[Backend Vitest]** teste de idempotência do webhook: enviar o mesmo evento `PAYMENT_CONFIRMED` duas vezes seguidas e confirmar que o resultado final em `company` é o mesmo (sem efeitos colaterais duplicados), já que hoje não há chave de idempotência por `payment.id`.
