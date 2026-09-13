# Auditoria de Testes — Cliente: Agendamento Público / Portal

> Escopo (frontend): `pages/PublicBooking.tsx`, `services/api.ts` (`appointmentsApi.create`,
> `appointmentsApi.createPublic`, `publicBookingApi.bookSubscriptionPlan`).
> Escopo (backend): `aura-backend/src/lib/businessHours.ts`,
> `aura-backend/src/app/api/appointments/route.ts` (POST),
> `aura-backend/src/app/api/public/booking/route.ts` (é a rota real por trás de
> `appointmentsApi.createPublic` — o caminho `appointments/public` citado na
> tarefa não existe; o nome real é `public/booking`),
> `aura-backend/src/app/api/public/subscriptions/book/route.ts`.
> Fora do escopo (próximo agente): `pages/patient-portal/PatientPlans.tsx`,
> `components/patient-portal/Plan*.tsx`.
> 2ª de 4 tarefas sobre a "área do cliente" — a 1ª (login/navegação, commit
> `0da581d`) está documentada em `docs/test-audit/cliente-login-navegacao.md`.

## Funcionalidades identificadas

### `pages/PublicBooking.tsx` (985 linhas antes desta tarefa)
1. Wizard de 4 etapas (Tratamento → Especialista → Horário → Dados) renderizado tanto para visitante anônimo quanto para paciente logado (`isLoggedInPatient = user?.role === PATIENT`), e tanto para procedimento avulso (`bookingMode === 'procedure'`) quanto para procedimento de um plano de assinatura (`bookingMode === 'plan'`).
2. Carrega os dados da clínica via `publicApi.getCompanyBySlug(slug)` (`useEffect` em `[slug]`): `company` (incl. `businessHours`, `onlineBookingConfig`, `layoutConfig`), `procedures`, `professionals`, `appointments` (para checar ocupação), `unavailabilityRules`, `subscriptionPlans`.
3. Se o usuário logado é `PATIENT`, busca também `patientOwnSubscriptions` via `fetch` direto a `/api/subscriptions/patients/my` (não usa `services/api.ts` para essa chamada específica).
4. `coveredProcedureIds` (memo) — esconde da lista de "Procedimentos avulsos" os procedimentos já cobertos por uma assinatura `ACTIVE` do paciente logado (evita cobrar de novo o que já está no plano).
5. `handleSelectPlan(plan)` — se o paciente logado ainda não tem assinatura própria (`ACTIVE`/`PAUSED`) para aquele plano, abre `PlanContractModal` (contratação) antes de deixar agendar; senão, vai direto para a escolha de procedimento(s) do plano (`PlanProcedurePickerModal` se o plano tiver mais de 1 item).
6. `getAvailableSlots()` — gera a grade de horários do dia selecionado a partir de `businessHours` (do dia da semana, via `Intl`/`toLocaleDateString`), `onlineBookingConfig.slotInterval`/`minAdvanceTime`, cruzando com `appointments` (ocupação do profissional e das 3 salas) e `unavailabilityRules`. **Antes desta tarefa, só considerava o horário de INÍCIO do slot** — não impedia oferecer um horário cujo término (início + duração do procedimento) ultrapassasse o fechamento (ver Bug/Gap #3 abaixo).
7. `handleBooking` — despacha para 3 APIs diferentes conforme o caso: paciente logado → `appointmentsApi.create` (autenticada); visitante anônimo contratando plano → `publicBookingApi.bookSubscriptionPlan`; visitante anônimo com procedimento avulso → `appointmentsApi.createPublic`.
8. Tela de sucesso (`bookingSuccess`) — mostra resumo e um único botão. **Antes desta tarefa, esse botão sempre chamava `logout()` e navegava para `/login`**, incondicionalmente — correto só para o visitante que acabou de criar conta ali, mas deslogava um paciente que já estava autenticado (ver Bug B).

### `services/api.ts`
9. `appointmentsApi.create(data)` → `POST /api/appointments` (autenticado, JWT). Usado por `PublicBooking` quando `isLoggedInPatient`.
10. `appointmentsApi.createPublic(data)` → `POST /api/public/booking` (sem autenticação). Usado por `PublicBooking` para visitante anônimo com procedimento avulso.
11. `publicBookingApi.bookSubscriptionPlan(data)` → `POST /api/public/subscriptions/book` (sem autenticação). Usado por `PublicBooking` para visitante anônimo contratando/agendando um plano.
12. `fetchApi()` (helper genérico usado por todas as chamadas acima) só repassa `data.error` da resposta como `result.error` — **nunca repassa `data.message`**. Isso é relevante porque `POST /api/appointments` retorna `{ error: "Horário indisponível", message: <motivo específico> }` para falhas de horário — o motivo específico nunca chegava ao usuário antes desta tarefa (ver Bug A / correção).

### Backend
13. `aura-backend/src/lib/businessHours.ts` — `isWithinBusinessHours(date, businessHours)` decide se um `Date` está dentro do expediente do dia, usando `date.getDay()`/`getHours()`/`getMinutes()` **diretamente sobre o `Date` recebido** (fuso do PROCESSO que executa o código — ver Bug A). `validateAppointmentTime()` combina essa checagem com `checkUnavailability()` (bloqueios pontuais).
14. `POST /api/appointments` — única rota que hoje chama `validateAppointmentTime`/`isWithinBusinessHours`. Resolve o horário efetivo (`resolveEffectiveBusinessHours`: horário individual do profissional tem precedência sobre o da empresa). Para `PATIENT` com `subscriptionId` no corpo, vincula a assinatura e zera o preço (`if (isPatient && subscriptionId)`) — **mas o frontend nunca enviava esse campo** (ver Bug C). Para staff, detecta automaticamente a assinatura ativa do paciente (`else if (!isPatient)`) — essa detecção automática só existe para staff, não para o próprio paciente.
15. `POST /api/public/booking` (agendamento avulso anônimo) e `POST /api/public/subscriptions/book` (plano anônimo) — **nenhuma das duas nunca chamou `validateAppointmentTime`/`isWithinBusinessHours`**: não há, e nunca houve, nenhuma validação de horário de funcionamento nessas rotas (nem de início, nem de término). Achado novo desta auditoria, mais amplo que o pedido do Passo 3 (que pedia especificamente a checagem de término) — ver Problema #4.

## Endpoints de backend usados

| Método | Rota | Arquivo | Chamado por |
|---|---|---|---|
| GET | `/api/public/company/[slug]` | `aura-backend/src/app/api/public/company/[slug]/route.ts` | `publicApi.getCompanyBySlug()` — carga inicial do `PublicBooking`. |
| GET | `/api/subscriptions/patients/my` | (fora do escopo de arquivos a modificar) | `fetch` direto em `PublicBooking.tsx` (paciente logado). |
| POST | `/api/subscriptions/patients/self` | (fora do escopo) | `fetch` direto em `PublicBooking.tsx` (`handleContractAndBook`, contratação de plano por paciente logado). |
| POST | `/api/appointments` | `aura-backend/src/app/api/appointments/route.ts` | `appointmentsApi.create()` — paciente logado (avulso ou plano). |
| POST | `/api/public/booking` | `aura-backend/src/app/api/public/booking/route.ts` | `appointmentsApi.createPublic()` — visitante anônimo, procedimento avulso. |
| POST | `/api/public/subscriptions/book` | `aura-backend/src/app/api/public/subscriptions/book/route.ts` | `publicBookingApi.bookSubscriptionPlan()` — visitante anônimo, plano. |

## Cobertura de testes atual (antes desta tarefa)

### Frontend
- **Nenhum teste existia** para `pages/PublicBooking.tsx` nem para nenhum arquivo de `components/patient-portal/` — confirmado buscando em `__tests__/**` por `PublicBooking`, `PlanProcedurePickerModal`, `PlanContractModal`: zero resultados, e não existia `__tests__/pages/PublicBooking.test.tsx`.
- `__tests__/services/api.test.ts` cobre outras funções de `services/api.ts`, mas não `appointmentsApi.create/createPublic` nem `publicBookingApi.bookSubscriptionPlan` especificamente (são wrappers finos sobre `fetchApi`, comportamento genérico já coberto indiretamente).

### Backend
- `aura-backend/src/__tests__/lib/businessHours.test.ts` cobria `isWithinBusinessHours`/`checkUnavailability`/`validateAppointmentTime` construindo datas com `new Date(2025, 0, 6, h, m)` (construtor multi-argumento = sempre fuso LOCAL da máquina que roda o teste) — nunca simulava a travessia de fuso navegador(local)→servidor(UTC) que acontece de verdade, então nunca teria pego o Bug A (a suíte roda em `America/Sao_Paulo`, mascarando o bug).
- `aura-backend/src/__tests__/api/appointments-post.test.ts` cobria a rota POST de forma ampla (24 testes antes desta tarefa) mas não tinha nenhum teste passando `subscriptionId` para um `PATIENT`, e mockava `validateAppointmentTime` para `{valid:true}` na maioria dos casos (só usa a implementação real no bloco "businessHours do profissional").
- `aura-backend/src/__tests__/api/public-booking.test.ts` e `public-subscriptions-book.test.ts` cobriam as rotas públicas amplamente, mas nenhum teste envolvia horário de funcionamento (porque a funcionalidade nunca existiu nessas rotas).

## Problemas encontrados durante a revisão

### Bug A — CONFIRMADO — fuso horário UTC (servidor) vs. hora local do Brasil na validação de horário de funcionamento
`aura-backend/src/lib/businessHours.ts` → `isWithinBusinessHours` usava `date.getHours()`/`getMinutes()`/`getDay()` diretamente. O `Date` chega como uma string ISO UTC (`isoDate.toISOString()`, gerada no navegador a partir da hora LOCAL do cliente, Brasil/UTC-3). O servidor (Vercel) roda em UTC. Resultado: um agendamento às 17h local (dentro do expediente 08h-18h) chega representando 20h UTC → rejeitado com "Horário indisponível", mesmo estando livre.
**Corrigido**: `isWithinBusinessHours`/`checkDurationFitsBeforeClosing` agora convertem o `Date` para hora de parede de America/Sao_Paulo através de um offset fixo de -3h (`toClinicLocalParts`, `getUTCHours`/`getUTCDay` sobre o `Date` deslocado) — não depende mais do fuso do processo que executa o código. Decisão de não instalar `date-fns-tz`: um offset fixo é suficiente porque (1) todas as clínicas do sistema hoje são brasileiras e (2) o Brasil não observa horário de verão desde 2019 (sem transições a tratar). Documentado no código como limitação explícita (se o produto expandir para múltiplos fusos, isso precisa virar uma tabela por clínica ou uma lib como `date-fns-tz`).
`checkUnavailability` (função separada, usa `toISOString().split('T')[0]` para achar o dia) **não foi alterada** — seu próprio TODO/bug de fuso perto da meia-noite já estava documentado e é explicitamente fora do escopo desta tarefa (exigiria realinhar como `appointmentDate` chega até ela).

### Bug B — CONFIRMADO — botão da tela de sucesso desloga cliente já autenticado
`pages/PublicBooking.tsx`, bloco `bookingSuccess`: único botão chamava `logout(); navigate('/login')` incondicionalmente, mesmo quando `isLoggedInPatient` era `true`.
**Corrigido**: quando `isLoggedInPatient`, o botão agora navega para `${getPortalBasePath()}/minha-conta` sem chamar `logout()`. Para visitante novo, comportamento preservado (`logout()` + `navigate('/login')`).

### Bug C — CONFIRMADO — `subscriptionId` nunca é enviado ao agendar por um paciente logado, mesmo em modo plano
`pages/PublicBooking.tsx`, `handleBooking`, ramo `isLoggedInPatient`: chamava `appointmentsApi.create(...)` sem `subscriptionId`, apesar do comentário dizer "backend detecta plano automaticamente". Esse comentário estava errado: em `aura-backend/src/app/api/appointments/route.ts`, a detecção automática (`patientSubscription.findFirst`) só roda no ramo `else if (!isPatient)` (staff); para o próprio paciente, o backend exige `if (isPatient && subscriptionId)` — sem o ID, o bloco inteiro era pulado e o agendamento saía com `subscriptionId: null`.
**Corrigido**: quando `bookingMode === 'plan' && selectedPlan`, o frontend agora busca a `PatientSubscription` ativa correspondente em `patientOwnSubscriptions` (mesmo padrão já usado em outro trecho do arquivo, `ownSub = patientOwnSubscriptions.find(s => s.planId === plan.id && s.status === 'ACTIVE')`) e envia `subscriptionId: ownSub?.id`. O ramo do backend já existia e está correto — só faltava receber o dado.

### Problema #4 — CONFIRMADO, PARCIALMENTE CORRIGIDO — duração do procedimento não podia ultrapassar o fechamento (Passo 3) + rotas públicas nunca validaram horário de funcionamento (achado novo, mais amplo)
Nada impedia (nem avisava) um agendamento cujo término ultrapassaria o fechamento — nem no frontend (`getAvailableSlots()` não verificava) nem no backend (`isWithinBusinessHours` só olhava o início).
**Corrigido** (escopo do Passo 3): `getAvailableSlots()` agora desabilita (`Indisponível`) qualquer slot cujo `início + duração do procedimento` ultrapasse o horário de fechamento do dia. `isWithinBusinessHours`/`validateAppointmentTime` (backend, usadas em `POST /api/appointments`) agora aceitam um `durationMinutes` opcional e rejeitam com a mensagem "Esse horário não é possível: o procedimento dura {duração} min e a clínica encerra às {horário de fechamento}. Escolha um horário mais cedo." quando o término ultrapassa o fechamento.
**Achado adicional, mais amplo, PARCIALMENTE fora do escopo**: durante a investigação, confirmei que `POST /api/public/booking` e `POST /api/public/subscriptions/book` (as duas rotas usadas por visitante ANÔNIMO) **nunca tiveram nenhuma validação de horário de funcionamento** — nem de início, nem de fim. Adicionar a validação completa (abertura/fechamento/dia da semana) a essas rotas do zero é uma mudança maior e separada do pedido específico do Passo 3 (que falava de "isWithinBusinessHours", já em uso só em `/api/appointments`), com risco de regressão em fluxos que hoje aceitam qualquer horário. Por isso, tratei apenas a rede de segurança mínima pedida (duração não pode ultrapassar o fechamento) nessas duas rotas também, via uma nova função dedicada `checkDurationFitsBeforeClosing` (não reaproveitei `isWithinBusinessHours` ali de propósito, para não introduzir de uma vez a validação de abertura/dia-fechado que nunca existiu nesses endpoints). **Recomendação para trabalho futuro**: decidir com o time se `/api/public/booking` e `/api/public/subscriptions/book` devem ganhar a validação completa de horário de funcionamento (hoje só têm checagem de conflito de agenda, não de expediente).

**[FECHADO em sessão seguinte]** Pendência resolvida: as duas rotas agora reaproveitam `validateAppointmentTime` (a mesma função já usada em `POST /api/appointments`), com precedência do horário individual do profissional sobre o da empresa via `resolveEffectiveBusinessHours`, e buscando `unavailabilityRule.findMany` por `companyId`. `checkDurationFitsBeforeClosing` foi removida das duas rotas (a checagem de duração agora vem embutida em `isWithinBusinessHours`/`validateAppointmentTime` via o parâmetro `durationMinutes`, já existente desde a correção do fuso horário). 12 testes novos (6 por rota) cobrindo dia fechado, antes da abertura, depois do fechamento, indisponibilidade do profissional, precedência do horário individual e o caso feliz. Durante a escrita dos testes foi corrigida também uma fragilidade pré-existente de isolamento de mock em `public-subscriptions-book.test.ts` (fila de `mockResolvedValueOnce` de `prisma.user.findFirst` vazando entre testes por coincidência de paridade) — não é um bug de produção, só do próprio teste.

### Problema #5 — CONFIRMADO, NÃO CORRIGIDO — `fetchApi` nunca repassa `data.message`, só `data.error`
`services/api.ts` → `fetchApi()`: em caso de `!response.ok`, retorna `{ success:false, error: data.error }`. Para `POST /api/appointments` com `code: "INVALID_TIME"`, o backend retornava `error: "Horário indisponível"` (genérico) e `message: <motivo específico>` — o motivo específico nunca chegava à tela. **Corrigido pontualmente** apenas para o novo caso (duração excedendo o fechamento) e para os demais motivos de `INVALID_TIME`: `aura-backend/src/app/api/appointments/route.ts` agora usa `error: timeValidation.message || "Horário indisponível"`, então o `error` passa a carregar o motivo específico em todos os casos de `INVALID_TIME` dessa rota. Não alterei o formato genérico de `fetchApi` (usado por dezenas de outras chamadas) nem outras rotas que também retornam `message` separado de `error` — mudança mais ampla, fora do escopo desta tarefa.

## Testes recomendados (e escritos nesta tarefa)

### Escritos nesta tarefa (TDD: falharam antes da correção, passam depois)

**Backend — `aura-backend/src/__tests__/lib/businessHours.test.ts` (16 testes novos)**
1. `isWithinBusinessHours` com `Date` construído a partir de string ISO UTC explícita (17:00/23:00/00:30/07:59 locais do Brasil) — comprova e corrige o Bug A, sem depender do fuso de quem roda a suíte (a implementação corrigida usa offset fixo, não `process.env.TZ`).
2. `isWithinBusinessHours(date, businessHours, durationMinutes)` — término do procedimento ultrapassando/cabendo/na borda exata do fechamento.
3. `checkDurationFitsBeforeClosing` — função nova usada pelas rotas públicas (businessHours null, dia fechado, ultrapassa, cabe, duração 0).
4. `validateAppointmentTime(..., durationMinutes)` — threading do novo parâmetro.

**Backend — `aura-backend/src/__tests__/api/appointments-post.test.ts` (4 testes novos)**
5. `PATIENT` que envia `subscriptionId` de assinatura ativa → agendamento vinculado, `price: 0` (Bug C, backend).
6. `PATIENT` sem `subscriptionId` → comportamento normal preservado (regressão).
7. Rota passa `durationMinutes` para `validateAppointmentTime` (integração do Problema #4).

**Backend — `aura-backend/src/__tests__/api/public-booking.test.ts` e `public-subscriptions-book.test.ts` (3 testes novos cada)**
8. Procedimento de 90min às 17:30 (fecha 18:00) → 400 com mensagem clara; 30min no mesmo horário → 201; sem `businessHours` configurado → não bloqueia (regressão).

**Frontend — `__tests__/pages/PublicBooking.test.tsx` (arquivo novo, 4 testes)**
9. Bug B: paciente logado, após sucesso, botão leva a `/minha-conta` SEM chamar `logout()`.
10. Bug B: visitante novo, após sucesso, botão desloga e vai para `/login` (regressão do comportamento antigo, que era correto para este caso).
11. Bug C: agendamento de plano como paciente logado envia `subscriptionId` da assinatura ativa correspondente.
12. Passo 3: slot de 90min às 17:30 (clínica fecha 18:00) aparece desabilitado; slot de 08:00 continua disponível.

### Recomendados, não escritos nesta tarefa (fora do escopo)
13. Validação completa de horário de funcionamento (abertura/fechamento/dia-fechado, não só duração) em `POST /api/public/booking` e `POST /api/public/subscriptions/book` — após decisão do time (ver Problema #4).
14. `fetchApi` propagando `data.message` de forma genérica para todas as rotas que o populam separado de `error` (Problema #5) — mudança de contrato mais ampla.
15. Testes de `handleSelectPlan`/`handleContractAndBook`/`PlanProcedurePickerModal`/`PlanContractModal` (fluxo de contratação de plano em si) — meu escopo cobriu o agendamento após a assinatura já existir; o fluxo de contratação/paywall pertence mais naturalmente ao próximo agente (`PatientPlans.tsx`), mas fica registrado aqui como lacuna de cobertura no componente `PublicBooking.tsx`.
16. Testes de `getAvailableSlots()` para conflito de sala (`busyRooms >= 3`) e para `unavailabilityRules` — lógica já existente, não coberta por nenhum teste antes ou depois desta tarefa (não fazia parte dos 3 bugs nem do Passo 3).
