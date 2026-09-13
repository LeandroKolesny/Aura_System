# Auditoria de Testes — Cliente: Páginas Compartilhadas (Agenda/Procedimentos/Histórico)

> Escopo (frontend): `pages/Schedule.tsx`, `pages/Procedures.tsx`,
> `pages/PatientHistory.tsx` — **apenas o recorte `user.role === PATIENT`**. Essas
> 3 páginas são compartilhadas com o app de staff (`App.tsx`, montadas em
> `/schedule`, `/procedures`, `/history`) e já têm cobertura de testes do papel
> STAFF de uma sessão anterior (ver seção "Cobertura já existente" abaixo) — não
> reescrita nem duplicada aqui.
> Escopo (backend): `GET /api/appointments` (lista — usada por `loadAppointments`
> em `pages/Schedule.tsx`), `GET/PUT/DELETE /api/appointments/[id]` (usada por
> nenhuma tela hoje, mas exposta e alcançável diretamente por qualquer cliente
> HTTP autenticado), `GET /api/procedures` + `/api/procedures/[id]` (usadas por
> `pages/Procedures.tsx`), `GET /api/patients` (usada indiretamente por
> `pages/PatientHistory.tsx` via `loadPatients()`), `GET /api/auth/me` (usada por
> toda restauração de sessão via cookie, incluindo as 3 páginas deste escopo).
> Fora do escopo (agentes anteriores / não tocado): `pages/PublicBooking.tsx`,
> `pages/patient-portal/PatientPlans.tsx`, `components/patient-portal/Plan*.tsx`,
> `aura-backend/src/app/api/subscriptions/patients/*`, `pages/patient-portal/PatientLogin.tsx`,
> `components/patient-portal/PatientSidebar.tsx`, `context/ClinicContext.tsx`.
> 4ª e última das 4 tarefas sobre a "área do cliente": 1ª (login/navegação, commit
> `0da581d`) em `docs/test-audit/cliente-login-navegacao.md`; 2ª (agendamento
> público, commit `d9db7e2`) em `docs/test-audit/cliente-agendamento-publico.md`;
> 3ª (planos/assinaturas, commit `c1851b4`) em `docs/test-audit/cliente-planos-assinaturas.md`.

## Funcionalidades identificadas (recorte PATIENT)

### `pages/Schedule.tsx`
1. `isPatient = user?.role === UserRole.PATIENT`; `currentPatientId` vem de
   `user.patientId` (resolvido pelo backend no login/sessão — **não** de uma busca
   local em `patients`, ao contrário de como `PatientHistory.tsx` fazia antes desta
   tarefa — ver Bug 2 abaixo).
2. Grade do dia (`renderDayView`): para cada agendamento no slot da hora,
   `isOtherPatientAppt = isPatient && currentPatientId && appt.patientId !== currentPatientId`
   — se verdadeiro, renderiza um bloco "Ocupado" sem `onClick`, sem nome nem
   serviço; senão, renderiza o card normal (clicável) com todos os dados que a
   API já devolveu (a API já anonimiza nome/telefone/e-mail/notas/assinatura de
   outros pacientes — ver `GET /api/appointments` abaixo — mas **não** o
   nome do procedimento/preço/horário; essa camada extra no frontend some por
   completo se `currentPatientId` for `null`, e é exatamente isso que o Bug 1
   abaixo causava).
3. Clique num agendamento do próprio paciente (`selectedAppointment`) sempre abre
   `PatientAppointmentViewModal` (somente leitura — sem botão de cancelar/editar),
   nunca `CheckoutModal` nem `ReviewAppointmentModal` (esses dois só aparecem para
   staff).
4. `!isPatient && !isReadOnly` esconde o botão "Novo Agendamento" e o botão de
   sincronizar Google Agenda; `!isPatient` esconde o seletor "Todos os
   Profissionais". Para paciente, o único caminho para abrir
   `NewAppointmentModal` é vindo de `pages/Procedures.tsx` (clique num card de
   procedimento seta `preSelectedProcedureId` via `location.state`, que dispara
   `setIsNewAppointmentModalOpen(true)` num `useEffect`).
5. Dentro de `NewAppointmentModal` (`components/Modals.tsx`), quando
   `isPatientUser`: o campo "Paciente" vira texto fixo com o nome do usuário
   logado (sem seletor), `finalPatientId` é enviado como `''` porque
   **o backend resolve o paciente pelo e-mail do JWT** (`POST /api/appointments`,
   nunca confia em `patientId` do body quando `role === PATIENT` — confirmado
   lendo `aura-backend/src/app/api/appointments/route.ts:341-349`), e o status
   final é sempre `PENDING_APPROVAL` (nunca cria direto como `SCHEDULED`).

### `pages/Procedures.tsx`
6. `isPatient` só afeta: (a) o header ("Procedimentos Disponíveis" / "Clique para
   agendar"); (b) `handleCardClick` navega para a agenda com
   `{procedureId, procedureName}` em vez de abrir o modal de edição;
   (c) `canEdit` (`ADMIN`/`OWNER` apenas) e `showFinancials` (`ADMIN`/`OWNER`
   apenas) já excluem `PATIENT` da mesma forma que excluem `RECEPTIONIST`/
   `ESTHETICIAN` — nenhum botão de criar/editar/importar/excluir, nem
   custo/margem, aparece para nenhum desses três papéis.

### `pages/PatientHistory.tsx`
7. Duas seções — "Próximas Consultas" (`upcoming`) e "Histórico de Consultas"
   (`past`) — ambas filtradas de `appointments` por
   `a.patientId === currentPatientId`. **Bug 2 (abaixo)**: `currentPatientId` era
   resolvido procurando o usuário logado dentro do array `patients` (carregado
   via `loadPatients()`), mas `GET /api/patients` **sempre** retorna 403 para
   `role === PATIENT` (por design, LGPD — paciente não pode listar todos os
   pacientes da clínica). Resultado: para qualquer sessão de paciente,
   `patients` fica sempre vazio e a página mostrava permanentemente "Nenhum
   histórico disponível." / "Você não tem agendamentos futuros.", mesmo com
   agendamentos reais.
8. Modal de detalhe (`AppointmentDetailModal`) mostra fotos antes/depois e
   assinatura do **próprio** agendamento clicado — como a lista já é filtrada
   por `currentPatientId`, não há como abrir o modal de um agendamento de outro
   paciente pela UI.
9. Assinatura digital (`signAppointmentConsent` → `POST /api/appointments/[id]/consent`)
   já valida no backend que `appointment.patient.email === user.email` para
   `role === PATIENT` (confirmado lendo
   `aura-backend/src/app/api/appointments/[id]/consent/route.ts:47-52`) — sem bug
   aqui, apesar de o frontend não impor essa restrição (a lista já garante que
   só aparecem agendamentos próprios).

## Endpoints de backend usados

| Endpoint | Chamado por | Observação |
|---|---|---|
| `GET /api/appointments` | `loadAppointments()` (Schedule, PatientHistory) | Já anonimiza dados de outros pacientes para `PATIENT` — bem testado (ver abaixo) |
| `GET/PUT/DELETE /api/appointments/[id]` | Não chamado por nenhuma tela hoje (`appointmentsApi.get`/`.cancel` sem uso no frontend) | **Bugs 3 e 4** — alcançável diretamente por qualquer cliente HTTP autenticado |
| `POST /api/appointments/[id]/consent` | `signAppointmentConsent` (PatientHistory) | Já restringe PATIENT ao próprio agendamento — OK |
| `GET /api/appointments/[id]/signature-history` | `SignatureHistoryModal` | Já restringe PATIENT ao próprio agendamento — OK |
| `GET /api/procedures` | `loadProcedures()` (Procedures, Schedule) | Sem restrição de role — catálogo é intencionalmente visível a todos (mesmo comportamento para RECEPTIONIST/ESTHETICIAN) |
| `POST/PUT/DELETE /api/procedures[/id]` | `NewProcedureModal`, `removeProcedure` (staff apenas) | Já restrito a `OWNER`/`ADMIN` — PATIENT nunca alcança (frontend nem expõe UI) |
| `GET /api/patients` | `loadPatients()` (Schedule, PatientHistory) | Já bloqueia `PATIENT` com 403 (LGPD) — **causa o Bug 2** quando outro código do frontend depende do array resultante |
| `GET /api/auth/me` | Restauração de sessão via cookie (`AppContext`, roda em toda página) | **Bug 1** — não devolvia `patientId` |

## Cobertura de testes já existente (sessão anterior — papel STAFF, não duplicada aqui)

### Frontend
- `__tests__/pages/Schedule.test.tsx` (antes desta tarefa: 2 testes) — filtro por
  profissional e navegação de data, ambos com `user: { role: ADMIN }`.
- `__tests__/pages/Procedures.test.tsx` (antes: 10 testes) — divisão por zero na
  margem, exclusão (`confirm`/`showAlert`/erro de API), estados de lista/loading,
  permissões para `RECEPTIONIST`/`ESTHETICIAN`. **Já havia 1 teste PATIENT**
  ("PATIENT: não vê custo/margem e o clique no card navega para o agendamento") —
  não duplicado, apenas estendido (PATIENT adicionado ao `it.each` de "sem botões
  de CRUD").
- `pages/PatientHistory.tsx`: **nenhum teste existia** antes desta tarefa (nem de
  staff, nem de paciente).

### Backend
- `appointments-get.test.ts` (10 testes) — já cobre a anonimização de
  `GET /api/appointments` para PATIENT (nome/telefone/e-mail/notas/assinatura
  ocultos para agendamento de outro paciente; dados completos para o próprio) —
  **não duplicado**.
- `appointments-id.test.ts` (antes: 13 testes) — cobria formato de campos
  (privilegiado vs. não-privilegiado) e fluxo de staff em GET/PUT/DELETE, mas
  **nenhum teste de ownership para PATIENT** em GET nem **nenhuma checagem de
  role** em DELETE.
- `appointments-consent.test.ts`, `appointments-signature-history.test.ts` — já
  cobrem `isOwnAppointment` para PATIENT.
- `auth-me.test.ts` (antes: 7 testes) — cobria formato geral da resposta, mas
  **nunca testava `patientId`** nem tinha usuário `PATIENT` nos fixtures.
- `procedures.test.ts` / `procedures-id.test.ts` — cobriam 401/403 para
  `ESTHETICIAN`, mas **nenhum teste explícito com role `PATIENT`**.

## Problemas encontrados durante a revisão

### Bug 1 — CONFIRMADO, CORRIGIDO — `GET /api/auth/me` não devolvia `patientId`

**Evidência:** `POST /api/auth/login` (`aura-backend/src/app/api/auth/login/route.ts:158-176`)
resolve `patientId` (busca `Patient` por `email`+`companyId`) e o inclui na
resposta. `GET /api/auth/me` (`aura-backend/src/app/api/auth/me/route.ts`,
usado por `AppContext.tsx:335-404` para restaurar a sessão via cookie a cada
carregamento de página) nunca fazia essa busca — o `select` do `prisma.user.findUnique`
não tinha `patientId` porque esse campo não existe na tabela `User` (é derivado).
`AppContext.tsx:370` já mapeava `patientId: apiUser.patientId`, mas esse campo
sempre chegava `undefined` vindo de `/me`.

**Impacto real:** `pages/Schedule.tsx` usa `user.patientId` para computar
`currentPatientId` (linha 19-24) e mascarar agendamentos de outros pacientes
como "Ocupado". Com `user.patientId` sempre `undefined` após qualquer reload de
página (F5, link direto, nova aba), a condição
`isOtherPatientAppt = isPatient && currentPatientId && ...` vira sempre falsa —
o paciente volta a ver o nome do procedimento, preço e horário reais de
agendamentos de OUTROS pacientes da mesma empresa na grade do dia (o nome do
paciente em si continua "Ocupado" porque isso já vem anonimizado do backend, mas
o procedimento/preço/hora não). `apps/PatientPortalApp.tsx`'s `PatientDashboard`
(`getNextAppointment(appointments, user?.patientId)`) também ficava sempre
mostrando "Você não tem agendamentos próximos".

**Fix:** `aura-backend/src/app/api/auth/me/route.ts` — mesma resolução do
`login/route.ts` (busca `prisma.patient.findFirst` por `email`+`companyId`
quando `role === "PATIENT"`), incluindo `patientId` na resposta.

**Testes (RED→GREEN):** `aura-backend/src/__tests__/api/auth-me.test.ts` — 3
novos testes (resolve `patientId`, retorna `null` sem registro correspondente,
não busca/inclui para roles não-PATIENT).

### Bug 2 — CONFIRMADO, CORRIGIDO — `pages/PatientHistory.tsx` sempre vazio para PATIENT

**Evidência:** `PatientHistory.tsx` (antes do fix, linhas 27-33) resolvia
`currentPatientId` com `patients.find(p => p.email === user.email)`, onde
`patients` vem de `loadPatients()` → `GET /api/patients`. Essa rota
(`aura-backend/src/app/api/patients/route.ts:37-39`) retorna
`403 { error: 'Acesso negado' }` para **qualquer** requisição com
`role === 'PATIENT'` — comentário no próprio código: "Pacientes não podem
listar todos os pacientes da clínica". `loadPatients()` (`context/AppContext.tsx:439-462`)
não trata esse 403 como erro visível — só loga no console e mantém `patients`
como `[]`.

**Impacto real:** para **toda** sessão de paciente (não só após reload — desde o
login), `patients` é sempre `[]`, então `currentPatientId` é sempre `null`, e
`myAppointments`/`upcoming`/`past` ficam sempre vazios. A página "Meu
Histórico" nunca mostrava nenhum agendamento, passado ou futuro, para nenhum
paciente — apesar de os dados existirem em `appointments`.

**Fix:** `pages/PatientHistory.tsx` — troca a busca em `patients` por
`user.patientId` diretamente, no mesmo padrão já usado (corretamente) em
`pages/Schedule.tsx`. Removida também a chamada `loadPatients()` (sempre
inútil/403 nesta página para uma sessão de paciente) e a variável `patients`
do destructuring de `useApp()`.

**Testes (RED→GREEN):** novo arquivo `__tests__/pages/PatientHistory.test.tsx`
(4 testes) — mostra histórico do próprio paciente mesmo com `patients: []`;
não mostra agendamento de outro paciente da mesma empresa; agendamento futuro
aparece em "Próximas Consultas"; sem `user.patientId` não mostra nada de
ninguém (não “cai” para mostrar tudo).

### Bug 3 — CONFIRMADO, CORRIGIDO — `GET /api/appointments/[id]` sem checagem de ownership para PATIENT

**Evidência:** `aura-backend/src/app/api/appointments/[id]/route.ts` (GET, antes
do fix) só validava `companyId` — não comparava `appointment.patientId` com o
paciente autenticado. Comparando com as rotas-irmãs do mesmo recurso
(`[id]/consent/route.ts:47-52` e `[id]/signature-history/route.ts:37-41`, que
já checam `isOwnAppointment` para `role === 'PATIENT'`), essa era a única rota
de agendamento individual sem essa proteção. `patientSelect` já reduzia os
campos do paciente para roles não-privilegiados (`{id, name, phone}`), mas
mesmo assim um paciente conseguia ver nome e telefone de **outro** paciente,
além de dados do profissional (nome/e-mail/telefone), do procedimento completo
e do array `transactions` (financeiro) de um agendamento que não era dele,
bastando saber (ou adivinhar sequencialmente) o `id`.

**Nota de escopo:** nenhuma tela do frontend chama `appointmentsApi.get(id)`
hoje (`grep` confirmou zero usos) — não é regressão visível na UI atual, mas é
uma rota exposta e alcançável por qualquer cliente HTTP autenticado da mesma
empresa, no mesmo padrão de "RBAC ausente em rota de paciente" que o Agente 3
encontrou em `/api/subscriptions/patients/*`.

**Fix:** adicionada checagem — para `role === 'PATIENT'`, resolve o
`patientId` do usuário (mesma query usada em `GET /api/appointments` e no
`consent`) e retorna 403 se `appointment.patientId` não bater (ou se não
houver registro `Patient` correspondente). Comparação por `patientId` em vez
de e-mail para não precisar ampliar o `select` de campos do paciente que o
teste já existente trava exatamente (evita quebrar
`appointments-id.test.ts` → "restringe dados sensíveis... (ex.: PATIENT)").

**Testes (RED→GREEN):** `appointments-id.test.ts` — 3 novos testes (403 para
agendamento de outro paciente; 200 para o próprio; 403 quando não há `Patient`
correspondente ao e-mail do usuário).

### Bug 4 — CONFIRMADO, CORRIGIDO — `DELETE /api/appointments/[id]` sem NENHUMA checagem de role

**Evidência:** o handler `DELETE` (cancelamento) em
`aura-backend/src/app/api/appointments/[id]/route.ts`, antes do fix, só
verificava autenticação (`getAuthUser`) e `companyId` — nenhuma allowlist de
role, ao contrário do `PUT` no mesmo arquivo (linhas 59-62, restrito a
`OWNER`/`ADMIN`/`RECEPTIONIST`/`ESTHETICIAN`) e do `PATCH .../status`
(mesma allowlist). Qualquer usuário autenticado da mesma empresa — incluindo
`PATIENT` — conseguia cancelar (`status → CANCELED`) **qualquer** agendamento
da clínica, de qualquer paciente, apenas conhecendo o `id`.

**Nota de escopo:** o frontend não expõe hoje nenhum botão de cancelamento
para o paciente (`PatientAppointmentViewModal` é somente leitura;
`appointmentsApi.cancel()` não tem nenhum uso no repositório) — de novo, não é
regressão visível na UI, mas uma rota real exposta sem proteção alguma.

**Fix:** aplicada a mesma allowlist do `PUT` (`OWNER`/`ADMIN`/`RECEPTIONIST`/
`ESTHETICIAN`) logo no início do handler `DELETE`, antes de qualquer busca no
banco — consistente com o restante do arquivo. Não foi adicionado nenhum
caminho novo de "paciente cancela o próprio agendamento": o frontend nunca
expôs essa ação, então adicioná-la agora seria inventar comportamento fora do
pedido da tarefa; a decisão de produto sobre self-cancel fica em aberto.

**Testes (RED→GREEN):** `appointments-id.test.ts` — 1 novo teste (403 para
`PATIENT`, `prisma.appointment.update` não chamado).

### Confirmações sem bug (testes de caracterização)

- `pages/Procedures.tsx` / `POST|PUT|DELETE /api/procedures[/id]`: PATIENT já
  não tem nenhum caminho de escrita — nem no frontend (`canEdit` exclui
  PATIENT, nenhum botão de criar/editar/excluir/importar aparece) nem no
  backend (`["OWNER","ADMIN"]` bloqueia qualquer outro role, incluindo
  PATIENT, com 403). Confirmado com testes de caracterização em
  `Procedures.test.tsx` (PATIENT adicionado ao `it.each` de "sem CRUD") e em
  `procedures.test.ts`/`procedures-id.test.ts` (403 explícito para PATIENT em
  POST/PUT/DELETE).
- `POST /api/appointments/[id]/consent` e
  `GET /api/appointments/[id]/signature-history`: já restringem PATIENT ao
  próprio agendamento (`isOwnAppointment` por e-mail) — nenhuma mudança.
- `POST /api/appointments` (criação): já resolve `patientId` pelo e-mail do
  JWT quando `role === PATIENT` (nunca confia no `patientId` do body) — mesmo
  ponto já confirmado pelo Agente 3 na dedução de sessão; nenhuma regressão
  nova encontrada neste escopo.

## Testes escritos nesta tarefa (resumo por arquivo)

### Backend
- `aura-backend/src/__tests__/api/auth-me.test.ts` — **+3 testes**
  (`patientId` resolvido / `null` / não buscado para não-PATIENT).
- `aura-backend/src/__tests__/api/appointments-id.test.ts` — **+4 testes**
  (GET: 403 outro paciente, 200 próprio, 403 sem `Patient` correspondente;
  DELETE: 403 para PATIENT).
- `aura-backend/src/__tests__/api/procedures.test.ts` — **+1 teste**
  (403 PATIENT em POST, caracterização).
- `aura-backend/src/__tests__/api/procedures-id.test.ts` — **+2 testes**
  (403 PATIENT em PUT e DELETE, caracterização).

### Frontend
- `__tests__/pages/PatientHistory.test.tsx` — **novo arquivo, 4 testes**
  (histórico do próprio paciente via `user.patientId`; isolamento entre
  pacientes da mesma empresa; agendamento futuro aparece; sem `patientId` não
  mostra nada).
- `__tests__/pages/Schedule.test.tsx` — **+6 testes** (novo describe "recorte
  PATIENT": mostra próprio agendamento; mascara agendamento de outro paciente
  como "Ocupado"; clique em "Ocupado" não abre modal; clique no próprio abre
  `PatientAppointmentViewModal` e nunca `CheckoutModal`; botão "Novo
  Agendamento" e seletor de profissional ocultos; caracterização documentando
  a dependência de `user.patientId` para a máscara funcionar).
- `__tests__/pages/Procedures.test.tsx` — **+1 role** no `it.each` já existente
  (PATIENT adicionado à checagem de "sem botões de CRUD nem financeiro").

**Total: 10 testes novos no backend, 11 no frontend (21 no total).**

## Resultado da verificação final

- `cd aura-backend && npx tsc --noEmit` → 0 erros.
- `npx tsc --noEmit` (raiz) → 0 erros.
- `cd aura-backend && npm run test:ci` → **2070/2070 passando** (2060 antes +
  10 novos), nenhum teste existente quebrado.
- `npx vitest run` (raiz) → **597/597 passando** (586 antes + 11 novos),
  nenhum teste existente quebrado (incluindo os testes de Schedule/Procedures
  da auditoria de staff anterior).

## Resumo consolidado das 4 tarefas da "área do cliente"

| # | Escopo | Commit | Bugs confirmados e corrigidos |
|---|---|---|---|
| 1 | Login/navegação do portal | `0da581d` | 3 bugs: isolamento entre clínicas ausente em `PatientPortalLayout`; flash de redirecionamento (`isInitializing` ignorado); card "Próximo Agendamento" com dado hardcoded |
| 2 | Agendamento público (`PublicBooking.tsx`, fuso horário, `subscriptionId`) | `d9db7e2` | 3 bugs corrigidos (fuso horário UTC vs. local; botão que desloga cliente autenticado; `subscriptionId` nunca enviado em modo plano) + 1 corrigido parcialmente (duração vs. fechamento) + 1 confirmado e documentado sem correção (`fetchApi` não repassa `data.message`) |
| 3 | Planos/assinaturas do cliente | `c1851b4` | 7 bugs: RBAC ausente em 4 rotas de `/api/subscriptions/patients/*` (agrupadas em 3 achados); 1 dupla dedução de sessão do plano; 3 falhas de UX silenciosas (erro de API não comunicado) |
| 4 | Páginas compartilhadas (Agenda/Procedimentos/Histórico) | *(este commit)* | 4 bugs: `patientId` ausente em `GET /api/auth/me`; `pages/PatientHistory.tsx` sempre vazio para PATIENT; RBAC ausente (ownership) em `GET /api/appointments/[id]`; RBAC ausente (role) em `DELETE /api/appointments/[id]` |

Somando as 4 tarefas: **17 bugs confirmados** na área do cliente (16
corrigidos, 1 documentado e deixado sem correção por decisão do Agente 2) —
principalmente RBAC/vazamento de dados entre pacientes ou empresas, lógica de
negócio incorreta (fuso horário, dedução de sessão), e erros de API não
comunicados ao usuário — mais diversos testes de caracterização documentando
comportamento já correto nas áreas revisadas.
