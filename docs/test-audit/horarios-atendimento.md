# Auditoria de Testes — Horários de Atendimento

Arquivos revisados:
- `pages/BusinessHoursSettings.tsx`
- `components/BusinessHoursEditor.tsx`
- `components/Modals.tsx` (`ProfessionalModal` — reusa `BusinessHoursEditor` para horário específico do profissional)
- `context/AppContext.tsx` (`updateCompany`, `addUnavailabilityRule`, `removeUnavailabilityRule`, `loadUnavailabilityRules`, `updateProfessional`)
- `services/api.ts` (`unavailabilityApi`, `companiesApi.update`, `usersApi.update`)
- `aura-backend/src/app/api/companies/[id]/route.ts`
- `aura-backend/src/app/api/unavailability/route.ts` e `[id]/route.ts`
- `aura-backend/src/app/api/users/[id]/route.ts`
- `aura-backend/src/app/api/appointments/route.ts`
- `aura-backend/src/lib/businessHours.ts`
- `aura-backend/src/lib/validations/user.ts`
- `aura-backend/src/__tests__/lib/businessHours.test.ts`
- `aura-backend/src/__tests__/api/companies-id.test.ts`
- `aura-backend/src/__tests__/api/unavailability.test.ts` e `unavailability-id.test.ts`

## Funcionalidades identificadas

1. **Horário de funcionamento da empresa (por dia da semana)** — `BusinessHoursSettings.tsx` + `BusinessHoursEditor.tsx`. Para cada dia (`monday`...`sunday`): checkbox `isOpen`, campo `start` (HH:mm) e `end` (HH:mm). Estado local é comparado (`JSON.stringify`) com `currentCompany.businessHours` para dirty-check (`hasUnsavedChanges`), e existe um "save trigger" externo (`triggerSave`/`pendingNavigationPath`) usado provavelmente pelo guard de navegação (sair da página com alterações não salvas). Salvar chama `updateCompany(companyId, { businessHours })`.
2. **Horário específico por profissional (sobrescreve o da empresa)** — `components/Modals.tsx` → `ProfessionalModal`. Reusa o mesmo `BusinessHoursEditor` (`compact`) preenchido com `initialData.businessHours || currentCompany.businessHours || <default seg-sex 08-18, sáb 09-13>`. Salvo via `updateProfessional(id, data)` → `usersApi.update` → `PUT /api/users/:id`.
3. **Indisponibilidades pontuais (bloqueios de agenda)** — seção "Indisponibilidades e Bloqueios" em `BusinessHoursSettings.tsx`:
   - Formulário: descrição opcional, horário de início/fim (`type="time"`), múltiplas datas (`type="date"`, adicionadas a uma lista `unavSelectedDates`), múltiplos profissionais afetados ou "Toda a Equipe" (`unavSelectedProfIds`, valor especial `'all'`).
   - Auto-adiciona a data/profissional digitado mas não confirmado com "+" antes de submeter (`handleAddRule`).
   - Validações client-side: horário obrigatório, pelo menos 1 data, pelo menos 1 profissional/"Toda a Equipe" selecionado. **Não valida `startTime < endTime` no frontend.**
   - Envia via `addUnavailabilityRule` → `POST /api/unavailability`.
   - Listagem das regras existentes com botão de remover (`removeUnavailabilityRule` → `DELETE /api/unavailability/:id`).
4. **Aplicação da regra na validação de agendamentos** — `aura-backend/src/lib/businessHours.ts` expõe `isWithinBusinessHours`, `checkUnavailability` e `validateAppointmentTime`, consumidas em `POST /api/appointments` (`aura-backend/src/app/api/appointments/route.ts`).

## Endpoints de backend usados

| Ação (frontend) | Endpoint | Arquivo |
|---|---|---|
| Salvar horário de funcionamento da empresa | `PUT /api/companies/:id` (campo `businessHours`) | `aura-backend/src/app/api/companies/[id]/route.ts` |
| Salvar horário específico do profissional | `PUT /api/users/:id` (campo `businessHours`) | `aura-backend/src/app/api/users/[id]/route.ts` |
| Listar regras de indisponibilidade | `GET /api/unavailability` | `aura-backend/src/app/api/unavailability/route.ts` |
| Criar regra de indisponibilidade | `POST /api/unavailability` | `aura-backend/src/app/api/unavailability/route.ts` |
| Remover regra de indisponibilidade | `DELETE /api/unavailability/:id` | `aura-backend/src/app/api/unavailability/[id]/route.ts` |
| Validação ao criar agendamento (consumidor indireto) | `POST /api/appointments` | `aura-backend/src/app/api/appointments/route.ts` |

## Cobertura de testes atual

### Backend

- **`aura-backend/src/__tests__/lib/businessHours.test.ts` (45 testes)** — cobre exclusivamente as 3 funções puras de `lib/businessHours.ts`, sem qualquer chamada de rede/Prisma:
  - `isWithinBusinessHours`: `businessHours === null` (permite tudo), dia fechado (sábado/domingo, mensagem contém o nome do dia), horário antes da abertura (inclusive `00:00` e `07:59`), exatamente na abertura (válido), dentro do expediente, exatamente no fechamento e 1 min depois (inválido, borda `>=`), horários customizados por dia (ex.: sexta 09:00–17:00, sábado aberto 08:00–12:00).
  - `checkUnavailability`: sem regras, data fora da regra, regra restrita a um profissional (bloqueia o próprio, não bloqueia outro), regra geral (`professionalIds: []`, bloqueia qualquer um), bordas de horário da regra (exatamente no início bloqueia, exatamente no fim não bloqueia — janela `[start, end)`), `description` customizada / `null` / ausente (fallback de mensagem), múltiplas regras (uma bloqueia, outra não; nenhuma bloqueia).
  - `validateAppointmentTime`: prioridade de checagem (erro de `businessHours` é retornado antes do erro de indisponibilidade quando ambos se aplicam), combinações de horário válido/inválido × profissional disponível/indisponível, `businessHours: null` com e sem regra de bloqueio.
  - **Não cobre**: `start > end` (horário "overnight" ou de fechamento antes da abertura), fuso horário (todas as datas de teste são criadas com `new Date(ano, mês, dia, hora, min)` — construtor local, nunca `toISOString()`/UTC), nem a interação real com `businessHours` **por profissional** (a função só recebe um único `BusinessHours`, e quem a chama em produção — `appointments/route.ts` — só passa o da empresa, nunca o do profissional).

- **`aura-backend/src/__tests__/api/companies-id.test.ts`** — cobre `GET`/`PUT /api/companies/[id]`: 401/403 (OWNER vs ADMIN vs terceiros)/404, schema `strict()` rejeita campo desconhecido, **400 quando um horário do `businessHours` tem formato inválido** (`"8h"` em vez de `"08:00"`, via regex `^\d{2}:\d{2}$`), atualização com `businessHours` válido, mapeamento do alias `socialMedia`. **Não testa** `start >= end` dentro de um dia (ex.: `{ isOpen: true, start: "18:00", end: "08:00" }` passa no schema pois só valida o formato regex, não a ordem), nem parcial/objeto incompleto (schema exige os 7 dias quando `businessHours` é enviado — não há teste confirmando erro se faltar um dia).

- **`aura-backend/src/__tests__/lib/validations/user.ts` (`updateUserSchema`)** — único teste relevante (`businessHours como objeto arbitrário → sucesso`) confirma que o schema de usuário aceita **qualquer** `Record<string, unknown>` para `businessHours` (`z.record(z.string(), z.unknown())`), sem validar formato de hora, dias da semana ou `start < end`. Ou seja: o horário específico do profissional não tem validação de schema nenhuma no backend, diferente do horário da empresa.

- **`aura-backend/src/__tests__/api/unavailability.test.ts`** — cobre `GET`/`POST /api/unavailability`: 401/403 (sem empresa, sem permissão de escrita via `checkWriteAccess`, role não-ADMIN/OWNER), filtro por `professionalId` (inclui regras gerais `professionalIds: []` + regras específicas), 400 para formato de horário inválido, **400 quando `startTime >= endTime`**, 400 para data fora do padrão `YYYY-MM-DD`, criação com log de auditoria (`Activity` tipo `SETTINGS_CHANGED`).

- **`aura-backend/src/__tests__/api/unavailability-id.test.ts`** — cobre `GET`/`DELETE /api/unavailability/[id]`: 401/403 (sem empresa, role, bloqueio de plano), 404 (regra inexistente ou de outra empresa), remoção com log de auditoria.

- **Não existe** nenhum teste (backend) para:
  - `PUT /api/users/:id` especificamente validando o campo `businessHours` (o teste existente de `users-id` — se houver — não foi focado neste campo).
  - Conflito entre uma nova regra de indisponibilidade e agendamentos já existentes no mesmo profissional/data/horário (a rota `POST /api/unavailability` não faz essa checagem, então não há teste porque não há comportamento a testar — ver seção de problemas).
  - `POST /api/appointments` usando o `businessHours` **do profissional** (não existe porque a rota não usa esse campo — ver problemas).

### Frontend

- **Nenhum teste existe** para `components/BusinessHoursEditor.tsx` nem para `pages/BusinessHoursSettings.tsx`. Confirmado: `C:\Aura_System\__tests__\` contém apenas `context/AppContext.test.tsx` e `services/api.test.ts` — nenhum arquivo em `__tests__/pages` ou `__tests__/components` relacionado a horários.
- `ProfessionalModal` (`components/Modals.tsx`), que também usa `BusinessHoursEditor`, também não tem cobertura de teste específica para o bloco de horário.

### E2E

- Nenhum spec em `C:\Aura_System\e2e\` (`dashboard.spec.ts`, `login.spec.ts`, `forgot-password.spec.ts`, `public-booking.spec.ts`, `register.spec.ts`, `whatsapp-settings.spec.ts`) toca a página `/business-hours`, nem o fluxo de bloqueio de agenda. `public-booking.spec.ts` testa o agendamento público mas não valida horário de funcionamento/indisponibilidade como parte do fluxo.

## Problemas encontrados durante a revisão

1. **Horário de fechamento menor que o de abertura não é bloqueado em nenhuma camada.** Nem `BusinessHoursEditor.tsx` (frontend), nem o schema `dayHoursSchema` em `companies/[id]/route.ts` (só valida regex `HH:mm`, não a ordem), nem `updateUserSchema` (aceita `z.record(unknown)` livre) impedem salvar, por exemplo, `{ isOpen: true, start: "18:00", end: "08:00" }`. Contraste: a rota de indisponibilidade (`POST /api/unavailability`) **tem** essa checagem (`startTime >= endTime → 400`), mas o horário de funcionamento (empresa e profissional) não tem o equivalente. Se isso acontecer, `isWithinBusinessHours` (`lib/businessHours.ts`) provavelmente bloqueia **todo** o dia (porque `appointmentMinutes < startMinutes` e `appointmentMinutes >= endMinutes` nunca são simultaneamente falsos quando `end < start`), o que é uma falha silenciosa (a clínica "trava" o dia inteiro sem aviso claro).

2. **Horário específico do profissional não é validado no backend.** `updateUserSchema.businessHours` é `z.record(z.string(), z.unknown())` — aceita qualquer estrutura, inclusive campos ausentes, tipos errados (`start: 123`) ou dias faltando. Isso é uma inconsistência de segurança/qualidade de dados em relação ao schema de empresa, que é `.strict()` e valida formato de hora.

3. **Horário específico do profissional parece não ser aplicado em lugar nenhum da validação de agendamentos.** `POST /api/appointments` (`aura-backend/src/app/api/appointments/route.ts`, linhas ~257-274) busca apenas `company.businessHours` e as regras de `unavailabilityRule`, e passa isso para `validateAppointmentTime`. `user.businessHours` (do profissional) nunca é lido nem usado nessa validação — nem em `whatsappBotEngine.ts`/`whatsappBotSlots.ts`, que também só usam o `businessHours` da empresa. Ou seja, a funcionalidade de UI "sobrescrever o horário de um profissional" (`ProfessionalModal`) parece **não ter efeito real** na disponibilidade de agenda — é um campo que se salva mas (aparentemente) não é lido em nenhuma validação de agendamento. Vale confirmar com o time de produto/dev se isso é intencional (feature incompleta) ou se há outro caminho de leitura que não foi encontrado nesta auditoria.

4. **Nenhuma checagem de conflito entre uma nova regra de indisponibilidade e agendamentos já existentes.** `POST /api/unavailability` cria a regra diretamente, sem consultar `prisma.appointment` para ver se já existe algum agendamento confirmado do(s) profissional(is) afetado(s) na(s) data(s)/horário bloqueado. Isso permite bloquear a agenda "por cima" de um agendamento já marcado, sem aviso ao admin nem cancelamento/realocação do agendamento existente — o cliente pode chegar para um atendimento que a clínica marcou como indisponível.

5. **Risco de fuso horário em `checkUnavailability`.** A função usa `date.toISOString().split("T")[0]` para obter a data (`lib/businessHours.ts` linha 101), o que converte para UTC. Se o servidor roda em UTC (comum em Vercel) e o horário do agendamento é um horário local do Brasil (UTC-3) próximo da meia-noite (ex.: 22h-23h59 de um dia), a conversão para UTC pode "empurrar" a data para o dia seguinte, fazendo a comparação com `rule.dates` (strings `YYYY-MM-DD` escolhidas no `<input type="date">` do frontend, sem componente de hora/fuso) falhar silenciosamente — um bloqueio configurado para "09/09" pode não bloquear um agendamento das 22h do dia 09 (ou pode bloquear indevidamente um agendamento do dia 10 de manhã cedo, dependendo de como `appointmentDate` é construído antes de chegar em `validateAppointmentTime`). Os 45 testes de `businessHours.test.ts` não expõem esse risco porque usam `new Date(ano, mês, dia, hora, min)` (fuso local do ambiente de teste) e nunca testam datas próximas de meia-noite combinadas com fuso diferente de UTC.

6. **Nenhum controle de acesso por rota no frontend para `/business-hours`.** Em `App.tsx`, a rota é registrada sem nenhum guard de role visível (diferente de outras áreas que podem ter checagem explícita). O controle real de quem pode **escrever** é feito no backend (`PUT /api/companies/:id` exige `ADMIN`/`OWNER`; `POST`/`DELETE /api/unavailability` exige `ADMIN`/`OWNER`). Mas qualquer usuário autenticado com `companyId` (inclusive `RECEPTIONIST`/`ESTHETICIAN`) consegue no mínimo **visualizar** a página e as regras de indisponibilidade existentes (GET não tem restrição de role, só de `companyId`), e a UI não parece esconder os formulários/botões de "Salvar"/"Adicionar Regra" para esses papéis — o erro só apareceria depois do clique, via toast de erro 403. Vale confirmar visualmente se a UI esconde essas ações para RECEPTIONIST/ESTHETICIAN.

7. **Nenhum teste garante que o schema `businessHours` de empresa exige os 7 dias.** Como o objeto Zod dos dias não é `.partial()`, enviar `businessHours` sem, por exemplo, `sunday` deveria falhar — mas isso nunca foi exercitado em teste, então uma futura mudança de schema (ex.: tornar os dias opcionais por engano) passaria despercebida.

## Testes recomendados

### Alta prioridade

1. **[Backend/Vitest]** `aura-backend/src/__tests__/api/companies-id.test.ts` — adicionar caso: `PUT /api/companies/:id` com `businessHours.monday = { isOpen: true, start: "18:00", end: "08:00" }` (fechamento antes da abertura). Hoje passa com 200; documentar o comportamento esperado (deveria ser 400) e, uma vez corrigida a rota, testar que retorna 400 com mensagem clara.
2. **[Backend/Vitest]** Novo arquivo (ou extensão de `users-id`/`users.test.ts` existente) — `PUT /api/users/:id` com `businessHours` contendo `start > end`, tipos inválidos (`start: 123`), ou objeto faltando dias — hoje tudo passa (schema `z.record(unknown)`); testar o comportamento atual explicitamente para não regressar por acidente, e sinalizar a necessidade de endurecer o schema (reaproveitar `dayHoursSchema` de `companies/[id]/route.ts`, extraindo para `src/lib/validations/`).
3. **[Backend/Vitest]** `aura-backend/src/__tests__/api/appointments-post.test.ts` (ou novo teste de integração) — criar agendamento para um profissional cujo `businessHours` individual é **mais restrito** que o da empresa (ex.: empresa aberta 08-18, profissional aberto só 08-12) e horário do agendamento é 15h: hoje a validação usa só `company.businessHours`, então o agendamento passa. Documentar esse gap com um teste que expõe o comportamento atual (aceita), servindo de regressão até decidirem se o profissional deve ter prioridade sobre a empresa.
4. **[Backend/Vitest]** `aura-backend/src/__tests__/api/unavailability.test.ts` — criar regra de indisponibilidade para uma data/hora onde já existe um `appointment` ativo do profissional afetado: hoje a rota cria a regra sem checar `prisma.appointment` — testar o comportamento atual (cria sem aviso) e, se o time decidir corrigir, adicionar teste de retorno 409 "Existem agendamentos confirmados neste período" (seguindo o padrão de FK/409 já usado no projeto para exclusões).
5. **[Backend/Vitest]** `aura-backend/src/lib/businessHours.ts` — adicionar em `businessHours.test.ts`: cenário de fuso horário para `checkUnavailability` — simular `date` próximo da meia-noite (ex.: `23:30` de um dia) e verificar se `dateStr` calculado bate com o dia local esperado ou se há divergência quando o `TZ` do processo de teste é forçado para `UTC` (via `process.env.TZ = 'UTC'` no `beforeAll`, comparando com o fuso `America/Sao_Paulo`). Esse teste vai expor concretamente o risco de fuso horário citado no achado 5.
6. **[Frontend/Vitest+RTL]** Novo arquivo `__tests__/components/BusinessHoursEditor.test.tsx` — cenários: renderiza os 7 dias corretamente; toggle de `isOpen` desabilita/habilita os inputs de horário; `onChange` é chamado com o objeto atualizado ao alterar `start`/`end`; valores ausentes usam o fallback `defaultBusinessHours` (`safeValue`); modo `compact` aplica classes/tamanhos reduzidos (smoke test).
7. **[E2E/Playwright]** Novo arquivo `e2e/business-hours.spec.ts` — fluxo principal: login como ADMIN, navegar para `/business-hours`, alterar horário de um dia, salvar, recarregar a página e confirmar persistência (evita regressão do bug histórico de "salvar antes de confirmar com a API" mencionado nos comentários do próprio `updateCompany`).
8. **[E2E/Playwright]** `e2e/business-hours.spec.ts` — fluxo de indisponibilidade: preencher descrição, horário, adicionar 2 datas e selecionar "Toda a Equipe", clicar "Adicionar Regra", verificar que a regra aparece na lista, depois removê-la e verificar que desaparece.

### Média prioridade

9. **[Backend/Vitest]** `companies-id.test.ts` — testar `businessHours` parcial (faltando um dia da semana) → deve retornar 400 pelo schema Zod (não `.partial()`); confirma o comportamento implícito hoje não coberto.
10. **[Backend/Vitest]** `unavailability.test.ts` — testar `professionalIds` contendo um ID de profissional que não pertence à empresa do usuário autenticado (nenhuma validação de ownership do profissional é feita hoje no `createRuleSchema`) — documentar comportamento atual (aceita sem checar) como candidato a endurecimento futuro.
11. **[Backend/Vitest]** `unavailability.test.ts` — testar `dates` com data duplicada na mesma regra (`["2026-03-01", "2026-03-01"]`) e datas no passado (regra retroativa) — hoje nenhuma das duas é rejeitada.
12. **[Frontend/Vitest+RTL]** Novo arquivo `__tests__/pages/BusinessHoursSettings.test.tsx` — mockar `useApp()`: (a) salvar horário chama `updateCompany` com o payload correto e mostra toast de sucesso; (b) falha de `updateCompany` (`{ success: false, error }`) mostra o toast de erro com a mensagem retornada (regra "nunca ignorar retorno de mutação" do CLAUDE.md); (c) `handleAddRule` bloqueia envio sem data/profissional/horário com a mensagem de validação correta; (d) `handleAddRule` auto-adiciona o valor digitado no input de data/profissional quando o usuário esquece de clicar em "+"; (e) falha de `addUnavailabilityRule`/`removeUnavailabilityRule` mostra toast de erro em vez de falhar silenciosamente.
13. **[Frontend/Vitest+RTL]** `ProfessionalModal` (`components/Modals.tsx`) — teste cobrindo o bloco "Horário Específico (Opcional)": valor inicial vem de `initialData.businessHours` quando editar, ou de `currentCompany.businessHours` quando criar (fallback), e `onChange` atualiza `formData.businessHours` corretamente antes do submit.
14. **[E2E/Playwright]** `business-hours.spec.ts` — RECEPTIONIST/ESTHETICIAN acessando `/business-hours` diretamente pela URL: confirmar que a página não permite salvar (verificar toast/erro de permissão ou ausência dos controles de escrita), documentando o comportamento real da UI para esses papéis.
15. **[Backend/Vitest]** `businessHours.test.ts` — adicionar teste explícito de `isWithinBusinessHours` com `dayConfig.start > dayConfig.end` (ex.: `{ isOpen: true, start: "20:00", end: "06:00" }`) documentando que a função hoje trata isso como "fechado o dia inteiro" (nenhum horário passa nas duas checagens `< start` e `>= end` simultaneamente satisfeitas de forma coerente) — evita que uma correção futura (suporte a horário "overnight") quebre sem teste guiando a mudança.

### Baixa prioridade

16. **[Backend/Vitest]** `unavailability-id.test.ts` — adicionar teste de `GET /api/unavailability/:id` para regra de outra empresa (`companyId` diferente) retornando 404 (o `findFirst` já filtra por `companyId`, mas não há teste explícito garantindo isolamento multi-tenant nesse endpoint específico).
17. **[Frontend/Vitest+RTL]** `BusinessHoursEditor` — teste de acessibilidade básica (labels associados aos inputs, checkbox com `aria`/label acessível via testing-library `getByRole`).
18. **[E2E/Playwright]** `business-hours.spec.ts` — testar `formatDateString` na UI (datas exibidas como `DD/MM/YYYY` na lista de regras) para pelo menos uma data com dia/mês de um dígito (ex.: `2026-01-05` → `05/01/2026`).
19. **[Backend/Vitest]** `companies-id.test.ts` — teste de que `RECEPTIONIST`/`ESTHETICIAN` recebem 403 ao tentar `PUT /api/companies/:id` (hoje só há teste para `RECEPTIONIST` implícito via outras rotas; não há caso específico nesse arquivo cobrindo esse papel para o campo `businessHours`).
