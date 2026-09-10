# Auditoria de Testes — Agenda

Escopo revisado: `pages/Schedule.tsx`, `components/Modals.tsx` (`NewAppointmentModal`,
`ReviewAppointmentModal`, `PatientAppointmentViewModal`, `CheckoutModal`), funções
correspondentes em `context/AppContext.tsx`, `utils/availabilityUtils.ts`,
`services/api.ts` e as rotas de backend que esses componentes chamam.

## Funcionalidades identificadas

1. **Visualização diária da agenda** (`renderDayView` em `Schedule.tsx`) — grade de horas
   (06h–22h), com slots ocupados/livres, bloqueados, fora do horário de funcionamento e
   no passado.
2. **Filtro por profissional** ("Todos os Profissionais" ou um específico) e por dia
   (navegação anterior/próximo/hoje/date-picker).
3. **Criação de agendamento** (`NewAppointmentModal`) — para staff (status `SCHEDULED`
   direto, ou `PENDING_APPROVAL` se "Simular solicitação do cliente" marcado) e para
   paciente logado (sempre `PENDING_APPROVAL`).
4. **Seleção de procedimento avulso ou de plano de assinatura** ("Promoção X") dentro do
   modal de criação, com verificação de sessões restantes do plano
   (`subscriptionsApi.listForPatient` / `listPlans` / `requestSelf`).
5. **Verificação de conflito com Google Calendar ao criar** — `useEffect` que dispara
   `appointmentsApi.checkGoogleConflicts` sempre que profissional+data+duração mudam, e
   bloqueia o botão de submit (`disabled={... || !!googleConflict}`) se houver conflito.
6. **Aprovação/recusa de solicitação pendente** (`ReviewAppointmentModal`) — transição
   `PENDING_APPROVAL → SCHEDULED` ou `PENDING_APPROVAL → CANCELED`, com notificação ao
   paciente na aprovação.
7. **Checkout / pagamento** (`CheckoutModal`) — escolha de forma de pagamento, parcelamento
   (1x–12x cartão), tela de sucesso com resumo, e cancelamento do agendamento a partir do
   checkout (quando `status` é `scheduled` ou `confirmed`).
8. **Cancelamento de agendamento** — disponível tanto no `CheckoutModal` quanto no
   `ReviewAppointmentModal`, ambos via `changeAppointmentStatus(id, 'CANCELED')`.
9. **Mudança de status genérica** (`changeAppointmentStatus` em `AppContext.tsx` →
   `PATCH /api/appointments/[id]/status`), usada por 6, 7 e 8.
10. **Visualização somente-leitura do paciente** (`PatientAppointmentViewModal`) para o
    próprio agendamento.
11. **Bloqueio de disponibilidade** (`unavailabilityRules`) — regras manuais (férias,
    feriados, bloqueios de horário) e bloqueios importados do Google Calendar
    (`description` prefixado com `"google:"`), renderizados com estilos visuais
    diferentes (`isGoogleBlock`).
12. **Verificação de horário de funcionamento** (`isWithinBusinessHours`, em
    `utils/availabilityUtils.ts`) — lógica pura no frontend, por profissional ou, na
    ausência, da empresa.
13. **Sincronização manual com Google Calendar** (`handleSyncGoogleCalendar` →
    `calendarApi.sync()`), que recarrega agendamentos e regras de indisponibilidade.
14. **Notificações no topo da Agenda** — exibidas somente para pacientes, filtrando por
    `recipientId` e `type === 'success'`.
15. **Dedução de estoque ao concluir procedimento** (`stockDeducted`) — lógica de negócio
    crítica no backend, acionada tanto por `PATCH /status` (`COMPLETED`) quanto por
    `POST /pay`.
16. **Dedução de sessões de plano de assinatura** — na criação (se `usePlan`) e na
    aprovação de um `PENDING_APPROVAL` vinculado a uma assinatura (`SCHEDULED` a partir
    de `PENDING_APPROVAL`).

**Fora do escopo direto da Agenda, mas no mesmo recurso:** assinatura de consentimento
(`signAppointmentConsent` → `POST /api/appointments/[id]/consent`) e histórico de
assinaturas — usados em `pages/PatientDetail.tsx` e `pages/PatientHistory.tsx`, não em
`Schedule.tsx`/`Modals.tsx`. Não é chamado a partir de nenhum componente da Agenda.

## Endpoints de backend usados

| Endpoint | Chamado por | Arquivo da rota |
|---|---|---|
| `GET /api/appointments` | `loadAppointments` (AppContext) | `aura-backend/src/app/api/appointments/route.ts` |
| `POST /api/appointments` | `addAppointment` (`NewAppointmentModal`) | idem |
| `PATCH /api/appointments/[id]/status` | `changeAppointmentStatus` (aprovar/cancelar/confirmar) | `.../appointments/[id]/status/route.ts` |
| `POST /api/appointments/[id]/pay` | `processPayment` (`CheckoutModal`) | `.../appointments/[id]/pay/route.ts` |
| `GET /api/appointments/check-google-conflicts` | `NewAppointmentModal` (auto-check) | `.../appointments/check-google-conflicts/route.ts` |
| `GET /api/unavailability` | `loadUnavailabilityRules` | `.../unavailability/route.ts` |
| `POST /api/auth/google/calendar/sync` | `calendarApi.sync()` (botão "Sincronizar Google") | fora do escopo desta auditoria (auth/google) |
| `GET /api/subscriptions/plans`, `GET /api/subscriptions?patientId=`, `POST /api/subscriptions/.../self-request` | seleção de plano no `NewAppointmentModal` | fora do escopo desta auditoria (módulo Assinaturas) |
| `POST /api/appointments/[id]/consent` | **não usado pela Agenda** (usado por PatientDetail/PatientHistory) | `.../appointments/[id]/consent/route.ts` |

## Cobertura de testes atual

### Backend

Todos os arquivos abaixo existem em `aura-backend/src/__tests__/api/` (contagem de
`it(`/`test(` por arquivo):

| Arquivo | Nº testes | Cobre |
|---|---|---|
| `appointments-post.test.ts` | 15 | Criação por staff/paciente, conflito de horário (inclusive contra `PENDING_APPROVAL`), condição de corrida serializável (P2034), fora do horário de funcionamento, paciente/procedimento não encontrado, auth/empresa, validação, cobertura por assinatura (zera preço, decrementa sessão, avisa quando esgotado), log de atividade |
| `appointments-get.test.ts` | 10 | Listagem, paginação, filtros, anonimização de dados de outros pacientes para role `PATIENT` |
| `appointments-id.test.ts` | 14 | GET/PUT/DELETE por id |
| `appointments-status.test.ts` | 17 | Transições válidas/inválidas, dedução de estoque idempotente (`stockDeducted` false→true e true→não repete), alerta de estoque baixo, dedução de sessão de plano na aprovação (inclusive limite atingido e plano ainda `PENDING`), guards de role/empresa/auth |
| `appointments-pay.test.ts` | 17 | Pagamento com sucesso, transações de receita/despesa, parcelamento (N parcelas, 1ª paga/demais pendentes, cap em 12x), dedução de estoque, `lastVisit`, log de atividade, `summary` (revenue/cost/profit), guard "já pago" (400), guards de role (`ESTHETICIAN` bloqueado)/empresa/auth |
| `appointments-check-google-conflicts.test.ts` | 11 | Conflito detectado/ausente, refresh de token, calendário não conectado, filtragem de eventos próprios (`AURA_SOURCE_TAG`) e cancelados |
| `appointments-consent.test.ts` | 12 | Fora do fluxo da Agenda (ver acima) |
| `appointments-signature-history.test.ts` | 6 | Idem |
| `appointment-whatsapp.test.ts` | 5 | Disparo de WhatsApp de confirmação ao mudar para `CONFIRMED` |
| `king-appointments.test.ts` | 7 | Visão cross-company do King Admin |
| `unavailability.test.ts` | 12 | Criação/listagem de regras de bloqueio |
| `unavailability-id.test.ts` | 9 | Remoção de regra por id |
| `lib/validations/appointment.test.ts` | — | Schemas Zod de criação/status/query |

**Conclusão:** a cobertura de backend para o núcleo de agendamentos (criação, status,
pagamento, conflitos Google, indisponibilidade) é extensa e já cobre bem os cenários de
sucesso, erro de validação, guards de permissão e casos de limite (sessões esgotadas,
condição de corrida). A única lacuna relevante encontrada está descrita em
"Problemas encontrados" abaixo (pagamento não valida o status atual do agendamento nem
o `stockDeducted` já verdadeiro).

### Frontend

Confirmado: hoje só existem `__tests__/context/AppContext.test.tsx` e
`__tests__/services/api.test.ts`. **Não existe nenhum teste de página ou componente**
para a Agenda.

- `AppContext.test.tsx` cobre, na camada de contexto (não de UI):
  - `changeAppointmentStatus` (aprovar/confirmar/cancelar) — `describe` dedicado.
  - `processPayment` — inclusive um teste de regressão explícito
    (`'REGRESSÃO: processPayment propaga erro da API (ex: agendamento já pago) em vez
    de fingir sucesso'`) que confirma que a função do contexto retorna
    `{ success: false, error }` corretamente quando a API falha.
  - `addAppointment` — autenticado, público (booking) e um teste de regressão
    equivalente para conflito de horário (`'REGRESSÃO: addAppointment propaga conflito
    de horário em vez de fingir sucesso'`).
- **Nenhum teste cobre os componentes que consomem essas funções**
  (`Schedule.tsx`, `NewAppointmentModal`, `ReviewAppointmentModal`, `CheckoutModal`,
  `PatientAppointmentViewModal`). Isso é relevante porque — como descrito em
  "Problemas encontrados" — existe pelo menos um componente (`CheckoutModal`) que
  **ignora** o retorno de uma dessas funções já testadas e corrigidas no nível de
  contexto, reintroduzindo na camada de UI exatamente o tipo de bug que o teste de
  regressão do `AppContext` foi escrito para evitar.
- **`utils/availabilityUtils.ts` (`isWithinBusinessHours`, `getUnavailabilityRule`) não
  tem nenhum teste.** São funções puras, fáceis de testar, que implementam lógica de
  negócio sensível (que horários aparecem como bloqueados/disponíveis na tela, e por
  consequência quais slots são clicáveis para criar um agendamento) e envolvem
  comparação de datas/fuso horário (`getTimezoneOffset`, `toISOString().split('T')[0]`)
  — área classicamente propensa a bugs de fuso horário.
- **Não existe detecção de conflito agendamento-vs-agendamento no frontend.** A única
  "lógica de conflito" do lado do cliente é `isWithinBusinessHours` +
  `getUnavailabilityRule` (horário de funcionamento e bloqueios manuais/Google). O
  clique em um slot de hora (`isClickable` em `Schedule.tsx`) **não** considera
  `hourAppointments` — ou seja, a UI permite abrir o modal de novo agendamento mesmo
  num horário já ocupado por outro agendamento; toda a prevenção real de
  double-booking profissional-a-profissional acontece no backend (409 no `POST
  /appointments`, com re-checagem transacional serializável). Isso está correto
  arquiteturalmente (fonte da verdade no servidor), mas significa que o único jeito de
  testar esse fluxo de ponta a ponta é via E2E ou teste de componente simulando a
  resposta 409 — hoje nenhum dos dois existe.

### E2E

Specs existentes em `e2e/`: `dashboard.spec.ts`, `login.spec.ts`,
`forgot-password.spec.ts`, `public-booking.spec.ts`, `register.spec.ts`,
`whatsapp-settings.spec.ts`.

- `dashboard.spec.ts` tem um teste `'navega para /schedule (Agenda)'` que **apenas
  verifica a navegação/URL**, sem interagir com nenhum agendamento.
- `public-booking.spec.ts` cobre o wizard de **agendamento público** (`/booking/:slug`),
  um fluxo diferente (paciente não autenticado, sem os modais de `Schedule.tsx`).
- **Confirmado: nenhum spec E2E cobre o fluxo real de agendamento da Agenda interna**
  (criar, aprovar, fazer checkout/pagamento, cancelar, ou visualizar conflito de
  horário/Google na tela).

## Problemas encontrados durante a revisão

1. **[Crítico] `CheckoutModal.handleComplete` ignora o resultado de `processPayment` e
   sempre mostra "Pagamento Registrado!"** — `components/Modals.tsx`, função
   `handleComplete` (dentro de `CheckoutModal`, por volta da linha 1365):
   ```ts
   const handleComplete = async () => {
     setIsProcessing(true);
     try {
       await processPayment(appointment, method, installments);
       setPaymentDone({ method, installments, amountPerInstallment: appointment.price / installments });
     } catch (error) {
       console.error('Erro ao processar pagamento:', error);
       setIsProcessing(false);
     }
   };
   ```
   `processPayment` **não lança exceção** quando a API retorna `{ success: false, error
   }` (ex.: "Agendamento já foi pago", erro 500, falha de permissão) — ela apenas
   retorna esse objeto (confirmado pelo teste de regressão em
   `AppContext.test.tsx`, linha ~1005). Como `handleComplete` não verifica
   `result.success`, a tela de sucesso ("Pagamento Registrado!", com valor e forma de
   pagamento) é exibida **mesmo quando o pagamento falhou no backend**, e
   `isProcessing` nunca volta a `false` no caminho de sucesso simulado (o botão fica
   como estava, mas a tela já avançou). Isso viola diretamente a regra "OBRIGATÓRIO" do
   próprio `CLAUDE.md` do projeto ("após qualquer chamada de API que pode falhar...
   nunca ignorar o retorno de funções assíncronas de mutação") e é o tipo exato de bug
   que os testes de regressão do `AppContext` foram escritos para prevenir — só que na
   camada de UI, não coberta por nenhum teste.

2. **[Alto] `POST /api/appointments/[id]/pay` não valida o `status` atual do
   agendamento nem o `stockDeducted` antes de deduzir estoque novamente** —
   `aura-backend/src/app/api/appointments/[id]/pay/route.ts`. A rota só bloqueia
   pagamento quando `appointment.paid === true` (400 "Agendamento já foi pago"); ela
   não verifica se `appointment.status === 'CANCELED'` nem se `appointment.stockDeducted
   === true`. Dois cenários problemáticos concretos:
   - **Pagar um agendamento cancelado**: a UI (`CheckoutModal`) esconde o botão
     "Finalizar e Receber" quando `status === 'canceled'`, mas nada no backend impede
     chamar `POST /pay` diretamente (ou via uma race de UI) num agendamento `CANCELED`
     não pago — ele seria marcado `COMPLETED` e teria estoque deduzido, contradizendo a
     máquina de estados de `PATCH /status` (`CANCELED` é estado final, sem transições
     permitidas).
   - **Dedução de estoque em duplicidade**: se um agendamento for concluído via `PATCH
     /status` (`CONFIRMED → COMPLETED`, que já deduz estoque e marca
     `stockDeducted=true`) mas **sem pagamento** (`paid` continua `false`), uma chamada
     subsequente a `POST /pay` para registrar o pagamento vai deduzir o estoque **de
     novo**, pois a rota de pagamento nunca checa `stockDeducted` (diferente da rota de
     status, que explicitamente faz `if (status === "COMPLETED" && !appointment.stockDeducted)`).
   - Confirmado que nenhum teste em `appointments-pay.test.ts` cobre esses dois
     cenários (nenhuma fixture usa `status: 'CANCELED'` ou `stockDeducted: true` como
     estado de entrada).

3. **[Médio] Nenhuma proteção de UI/servidor contra criar agendamento em slot já
   ocupado por outro agendamento do mesmo profissional a partir do clique na grade** —
   não é um bug (o backend rejeita com 409 e o modal exibe a mensagem de erro), mas o
   comportamento nunca foi verificado ponta a ponta (não há teste de componente nem
   E2E simulando esse 409 e checando a mensagem "Este horário já está ocupado...").

4. **[Observação, não bug confirmado] `checkScheduleConflict` (backend) verifica apenas
   `professionalId`, não `roomId`.** Dois profissionais diferentes podem ser agendados
   na mesma sala/horário sem que o backend acuse conflito — pode ser intencional (sala
   não é um recurso exclusivo no modelo atual), mas vale confirmar com o time de
   produto/negócio se isso é esperado, já que a UI oferece seleção de sala
   ("Consultório 1/2", "Sala VIP") como se fosse um recurso a ser reservado.

## Testes recomendados

### Alta prioridade

1. **[Backend/Vitest]** `aura-backend/src/__tests__/api/appointments-pay.test.ts` —
   adicionar: (a) tentativa de pagar agendamento com `status: 'CANCELED'` deve ser
   rejeitada (400/409, não deve marcar `COMPLETED` nem deduzir estoque); (b) pagar um
   agendamento com `stockDeducted: true` (já concluído via `/status` sem pagamento)
   **não** deve deduzir estoque uma segunda vez.
2. **[Frontend/Vitest+RTL]** Novo arquivo `__tests__/components/CheckoutModal.test.tsx`
   — renderizar `CheckoutModal`, mockar `processPayment` retornando
   `{ success: false, error: 'Agendamento já foi pago' }`, clicar em "Finalizar e
   Receber" e **assertar que a tela "Pagamento Registrado!" NÃO aparece** e que o erro é
   comunicado ao usuário (via `useDialog`/`showAlert`, ajustando o componente conforme
   necessário) — este teste deve falhar no código atual e só passar após corrigir o bug
   nº 1 acima.
3. **[Frontend/Vitest]** Novo arquivo `__tests__/utils/availabilityUtils.test.ts` —
   cobrir `isWithinBusinessHours` (dia fechado, horário antes/depois do expediente,
   `endTotal === 0` à meia-noite, ausência de `hours` retorna `true`) e
   `getUnavailabilityRule` (regra que afeta "all" profissionais, regra específica de um
   profissional, regra fora da data, comparação de fuso horário via
   `getTimezoneOffset`/`toISOString` — testar em pelo menos dois fusos horários
   diferentes ou mockando `Date` para garantir que a data local não "vaza" para o dia
   seguinte/anterior em UTC).
4. **[E2E/Playwright]** Novo arquivo `e2e/schedule.spec.ts` — fluxo completo de
   agendamento: login como ADMIN/RECEPTIONIST → abrir Agenda → clicar em slot livre →
   preencher `NewAppointmentModal` → confirmar criação → agendamento aparece na grade →
   abrir `CheckoutModal` → finalizar pagamento → agendamento passa a `completed`.

### Média prioridade

5. **[Backend/Vitest]** `appointments-status.test.ts` — adicionar teste de transição
   `SCHEDULED → COMPLETED` (hoje só testado como inválida a partir de `SCHEDULED`;
   confirmar que só `CONFIRMED → COMPLETED` é aceito, documentando a regra
   explicitamente).
6. **[Frontend/Vitest+RTL]** `__tests__/components/NewAppointmentModal.test.tsx` —
   cobrir: exibição do banner de conflito Google Calendar (`googleConflict`) e bloqueio
   do botão de submit enquanto ele existir; fluxo de seleção de "Promoção X" (plano) via
   `handleProcedureChange` zerando o preço; erro de conflito de horário retornado pelo
   backend (`result.conflict`) exibindo a mensagem correta.
7. **[Frontend/Vitest+RTL]** `__tests__/components/ReviewAppointmentModal.test.tsx` —
   aprovar solicitação pendente dispara `changeAppointmentStatus(id, 'SCHEDULED')` e
   `addNotification`; recusar dispara `changeAppointmentStatus(id, 'CANCELED')`; exibir
   erro via `showAlert` quando a API falha (já não é regressão, mas não está testado no
   componente).
8. **[E2E/Playwright]** `e2e/schedule.spec.ts` — cenário de solicitação de paciente:
   login como PATIENT → solicitar agendamento (fica `pending_approval`) → logout →
   login como ADMIN → abrir `ReviewAppointmentModal` → aprovar → verificar que o status
   mudou na grade.
9. **[Backend/Vitest]** `unavailability.test.ts` / `unavailability-id.test.ts` —
   confirmar que já existe teste de sobreposição entre uma regra de indisponibilidade e
   um agendamento existente na criação de agendamento (`POST /appointments`); se não
   existir, adicionar teste cruzado em `appointments-post.test.ts` para o caso
   "horário coincide com regra de indisponibilidade do profissional específico" vs.
   "regra que afeta todos os profissionais" (`professionalIds: []`).

### Baixa prioridade

10. **[Frontend/Vitest+RTL]** `__tests__/pages/Schedule.test.tsx` — teste de filtro por
    profissional (`selectedProfessionalId`) e de navegação de data (`changeDate`,
    botão "Hoje"), garantindo que `filteredAppointments` reflete corretamente o dia e
    profissional selecionados.
11. **[Frontend/Vitest+RTL]** Teste do botão "Sincronizar Google"
    (`handleSyncGoogleCalendar`) — estado de loading, mensagem de sucesso com contagem
    de eventos importados, mensagem de erro genérica em falha, e que `loadAppointments`
    /`loadUnavailabilityRules(true)` são chamados após sucesso.
12. **[Backend/Vitest]** Confirmar (ou adicionar, se ausente) teste explícito para o
    ponto de observação nº 4 acima (`checkScheduleConflict` não considerar `roomId`) —
    ao menos como teste de caracterização, documentando o comportamento atual até que o
    time decida se é intencional.
13. **[E2E/Playwright]** Cenário de bloqueio de disponibilidade: criar uma regra de
    indisponibilidade para um profissional específico e verificar visualmente que o
    slot aparece marcado como "Indisponível" (vermelho) na Agenda, enquanto outro
    profissional no mesmo horário continua livre.
