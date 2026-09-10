# Auditoria de Testes — Dashboard

> Escopo: `pages/Dashboard.tsx` (visão `ClinicDashboard`, usada por ADMIN/RECEPTIONIST/ESTHETICIAN). A visão `SaaSDashboard` (role OWNER) também está no mesmo arquivo e é coberta ao final.

## Funcionalidades identificadas

### `ClinicDashboard` (ADMIN e demais roles de clínica)
1. **Carregamento de KPIs/gráficos** via `dashboardApi.getStats(days)` ao montar a página e sempre que a aba é reaberta (`useEffect` sem dependência de cache — força reload a cada montagem).
2. **Cache de 30s em memória** (`DASHBOARD_CACHE_MS`) para evitar refetch ao trocar `revenueRange` dentro da janela — mas o `useEffect` de montagem chama `loadDashboardData()` sem `forceRefresh`, enquanto o de mudança de `revenueRange` chama com `forceRefresh=true`.
3. **Filtro de período do gráfico de receita**: toggle `7D` / `30D` (`revenueRange`), refaz a chamada ao backend com `days=7` ou `days=30`.
4. **Skeleton de carregamento** (`DashboardSkeleton`) enquanto `isLoadingDashboard || !dashboardData`.
5. **Card "Faturamento"**: `formatCurrency(kpis.revenue)` + tendência calculada no frontend (`revenueTrend`, ver item 12).
6. **Card "Ticket Médio"**: `formatCurrency(kpis.ticketMedio)`.
7. **Card "Pacientes Atendidos"**: `kpis.seenPatients` (pacientes únicos com agendamento `COMPLETED` no período).
8. **Card "Taxa de Cancelamento"**: `kpis.cancelRate`%.
9. **Faixa de 5 mini-KPIs de agendamentos**: Total, Confirmadas, Realizadas, Canceladas, Taxa de Falta (mesmo valor de `cancelRate`, com destaque visual vermelho quando `> 20%`).
10. **Gráfico de histórico de receita** (`SimpleRevenueChart`, SVG customizado — não usa Recharts apesar do import): área + linha com curva de Bézier, tooltip on-hover, eixo Y formatado em `R$`/`R$ Xk`.
11. **Gráfico de procedimentos populares** (`SimpleBarChart`, SVG customizado): barras com tooltip on-hover, top 5 procedimentos.
12. **Cálculo de tendência de receita (`revenueTrend`)**: compara soma da 1ª metade vs 2ª metade do array `charts.revenueChart` — feito 100% no frontend, não vem da API.
13. **Banner "Novas Solicitações"** (agendamentos `pending_approval`, do contexto local `appointments`, filtrados no frontend — não vem do endpoint de dashboard):
    - Botão **Aprovar** → `changeAppointmentStatus(id, 'SCHEDULED')` + notificação ao paciente via `addNotification` (só dispara se `res.success`).
    - Botão **Recusar** → `changeAppointmentStatus(id, 'CANCELED')` — **não verifica o resultado**.
14. **Banner "Novos Planos para Aprovação"** (assinaturas `PENDING`, buscadas via `subscriptionsApi.listPending()`, com polling a cada 30s e também no mount, junto de `loadAppointments(true)`):
    - Botão **Ativar** → `subscriptionsApi.activate(id)`, remove da lista local só se `res.success`.
    - Botão **Recusar** → `subscriptionsApi.cancel(id)` — **remove da lista local sem checar o resultado da API**.
15. **Alertas do sistema** (`activeAlerts`): combina alertas de estoque baixo vindos da API (`dashboardData.alerts.lowStock`, prefixo de id `inv_`) com `systemAlerts` do contexto (filtrados por `target === 'all' || target === companyId` e `status === 'active'`), exclui os já descartados (`dismissedAlertIds`) e limita a 5 (exibe só os 3 primeiros na tela).
16. **Descartar alerta** (botão X) → `dismissAlert(id)`: estado **apenas em memória** (`useState`, sem persistência local/servidor) — some ao trocar de página/reload.
17. **Abrir modal de detalhes do alerta** (`AlertDetailsModal`) ao clicar no card do alerta.
18. **Título dinâmico**: exibe `currentCompany?.name` quando `role === ADMIN`, ou "Recepção" para outros papéis da clínica.

### `SaaSDashboard` (role OWNER — fora do escopo principal, mas no mesmo arquivo)
19. Card "Receita (MRR)": soma `companies.reduce` usando o preço do plano de cada empresa (`saasPlans`) — 100% calculado no frontend a partir de dados já carregados no contexto (sem chamada de API dedicada).
20. Cards "Clínicas Ativas", "Agendamentos Global", "Total Pacientes" — contagens diretas de arrays do contexto.
21. Trend fixo hardcoded `"+15%"` no card de MRR (não calculado).

## Endpoints de backend usados

| Método | Rota | Arquivo | Chamado por |
|---|---|---|---|
| GET | `/api/dashboard?days=7\|30` | `aura-backend/src/app/api/dashboard/route.ts` | `dashboardApi.getStats()` — KPIs, gráficos e `alerts.lowStock` |
| GET | `/api/subscriptions/patients?status=PENDING` | `aura-backend/src/app/api/subscriptions/patients/route.ts` | `subscriptionsApi.listPending()` — banner de planos |
| PATCH | `/api/subscriptions/patients/[id]/activate` | `aura-backend/src/app/api/subscriptions/patients/[id]/activate/route.ts` | `subscriptionsApi.activate()` |
| PUT | `/api/subscriptions/patients/[id]/cancel` | `aura-backend/src/app/api/subscriptions/patients/[id]/cancel/route.ts` | `subscriptionsApi.cancel()` |
| PATCH | `/api/appointments/[id]/status` | `aura-backend/src/app/api/appointments/[id]/status/route.ts` | `changeAppointmentStatus()` (aprovar/recusar solicitação) — via `AppContext` |
| (implícito) | recarregamento de `appointments` | `AppContext.loadAppointments()` | usado para popular `pendingApprovals` |

**Observação:** existe também `GET /api/dashboard/stats` (`aura-backend/src/app/api/dashboard/stats/route.ts`), com testes próprios (`dashboard-stats.test.ts`), mas **não é chamado pelo `Dashboard.tsx` nem por nenhum outro ponto do frontend atual** (busquei `dashboardApi.getStats`, `/api/dashboard/stats` em todo o repo — só aparece no próprio teste, em `hooks/useApi.ts` — que chama `dashboardApi.getStats()`, ou seja, ainda cai em `/api/dashboard`, não em `/stats` — e no teste). Parece uma rota legada/duplicada, com estrutura de resposta diferente (`stats.leads`, `stats.financial` etc., sem `kpis`/`charts` que o Dashboard usa).

## Cobertura de testes atual

### Backend
- **`GET /api/dashboard`** (`aura-backend/src/__tests__/api/dashboard.test.ts`) — **13 testes**, cobertura boa: 401 sem auth, 403 sem `companyId`, período padrão (7d) e `days=30`, cálculo de ticket médio, cálculo de `cancelRate` (incluindo caso zero agendamentos), filtro de estoque baixo, mapeamento de nomes de procedimentos via `groupBy`, cache-control `s-maxage=30`, erro 500 inesperado.
- **`GET /api/dashboard/stats`** (`aura-backend/src/__tests__/api/dashboard-stats.test.ts`) — **8 testes** cobrindo a rota não utilizada pelo frontend atual (ver observação acima). Boa cobertura da rota em si, mas testa um endpoint órfão.
- **`GET/POST /api/subscriptions/patients`** (`subscriptions-patients.test.ts`) — cobre 401/403, listagem escopada por `companyId`, filtro por `status`+`patientId` (cobre o caso usado por `listPending`, embora não haja um teste literal com `status=PENDING`), validação de campos obrigatórios no POST, paciente/plano inexistente.
- **`PATCH /api/subscriptions/patients/[id]/activate`** (`subscriptions-patients-activate.test.ts`) — **6 testes**: 401, bloqueio de `checkWriteAccess`, 404 (não encontrada/de outra empresa), 400 quando não está `PENDING`, ativação bem-sucedida, escopo por `companyId`.
- **`PUT /api/subscriptions/patients/[id]/cancel`** (`subscriptions-patients-cancel.test.ts`) — **6 testes**: 401, 404, 409 (já cancelada), cancelamento de `ACTIVE` sem tocar agendamentos, cancelamento de `PENDING` restaurando preço de agendamentos `PENDING_APPROVAL` vinculados, caso de agendamento sem procedimento associado.
- **`PATCH /api/appointments/[id]/status`** (`appointments-status.test.ts`) — **19 testes**, muito completo: transições válidas/inválidas (incluindo `PENDING_APPROVAL → SCHEDULED/CANCELED`), dedução de estoque, criação de despesa, atualização de `lastVisit`, log de atividade, 404/401/403, status inválido, alerta de estoque baixo, lógica de limite de sessões do clube de assinaturas.

**Conclusão backend:** as rotas usadas pelo Dashboard têm cobertura extensa de sucesso/erro/permissão/limites. Não há lacunas críticas de rota — os gaps estão em regras de negócio específicas do cálculo de KPIs (ver seção de problemas) e na ausência de um teste que documente explicitamente `status=PENDING` em `subscriptions-patients.test.ts`.

### Frontend
- **Não existe nenhum teste de página/componente para o Dashboard.** Confirmado: `C:\Aura_System\__tests__\` contém apenas `context\AppContext.test.tsx` e `services\api.test.ts`. Não há `__tests__/pages/Dashboard.test.tsx` nem testes para `StatCard`, `SimpleRevenueChart`, `SimpleBarChart` ou `AlertDetailsModal`.
- `__tests__/services/api.test.ts` cobre `dashboardApi.getStats()` no nível de client HTTP: monta a URL com `days`, usa `days=7` como padrão, repassa erro da API — mas não testa nada da página em si (loading, cache de 30s, cálculo de `revenueTrend`, banners, dismiss de alerta).
- Nenhum teste cobre `subscriptionsApi.activate/cancel/listPending` no arquivo de API tests (não confirmei a ausência de forma exaustiva, mas não apareceram nas buscas por "subscriptions" no arquivo).

### E2E
`e2e/dashboard.spec.ts` existe, mas **testa apenas navegação genérica pós-login como `owner`**, não o conteúdo do dashboard de clínica:
- Login como `owner` e espera redirecionamento para `/dashboard`, `/schedule` ou `/billing`.
- Verifica que existe uma sidebar/nav visível.
- Clica em links "Pacientes", "Agenda", "Financeiro" e verifica a URL resultante (com `if (isVisible())` — os testes não falham se o link não existir, o que os torna não-determinísticos/fracos).
- Um teste checa que acessar `/dashboard` sem cookies não expõe conteúdo autenticado.

**O que NÃO cobre (lacuna relevante):**
- Nenhuma asserção sobre o conteúdo do dashboard: nenhum KPI, nenhum gráfico, nenhum banner de aprovação pendente, nenhum alerta.
- Login usado é `owner` (`DEMO_CREDENTIALS.owner`), que na aplicação renderiza `SaaSDashboard` (role OWNER), **não** o `ClinicDashboard` usado pelo ADMIN — ou seja, o dashboard de ADMIN (foco desta auditoria) **não é exercitado por nenhum teste E2E hoje**.
- Não testa o toggle 7D/30D, aprovar/recusar solicitação de agendamento, ativar/recusar plano pendente, nem descartar um alerta.

## Problemas encontrados durante a revisão

1. **KPI "Confirmadas" tem cálculo enganoso.** Em `aura-backend/src/app/api/dashboard/route.ts` (linha ~195), `appointmentsConfirmed = periodAppointments - canceledAppointments`. Isso inclui **todos** os status não cancelados (`SCHEDULED`, `CONFIRMED`, `COMPLETED`, `PENDING_APPROVAL`), não apenas os efetivamente confirmados — mas o card ao lado já mostra "Realizadas" (`appointmentsCompleted`) separadamente, então "Confirmadas" acaba contando também os completados e os pendentes de aprovação, o que é semanticamente incorreto para o rótulo exibido.
2. **`appointmentsCompleted` (KPI "Realizadas") exige `paid: true`**, enquanto `seenPatients` (card "Pacientes Atendidos") conta pacientes distintos apenas por `status: COMPLETED`, sem exigir pagamento. Duas métricas de "atendimento" com critérios diferentes (uma exige pagamento, outra não) podem confundir e nunca foram comparadas em teste.
3. **`handleRejectApproval` (recusar solicitação de agendamento) não verifica o resultado de `changeAppointmentStatus`.** Não há tratamento de erro nem feedback ao usuário se a chamada falhar — viola a regra do projeto ("todo erro deve ser comunicado ao usuário", `CLAUDE.md`).
4. **`handleCancelPlan` (recusar plano de assinatura pendente) remove o item da lista local (`setPendingPlans`) mesmo sem checar `res.success`.** Se `subscriptionsApi.cancel` falhar (rede, 409, 500), a UI mostra o plano como removido enquanto ele continua `PENDING` no banco — estado dessincronizado e usuário não é avisado do erro.
5. **`dismissAlert` não persiste em lugar nenhum** (`dismissedAlertIds` é `useState` puro em `AppContext.tsx`). Um alerta descartado volta a aparecer após F5 ou re-login. Pode ser intencional, mas não há teste ou documentação que confirme essa decisão.
6. **Rota órfã `GET /api/dashboard/stats`** com 8 testes próprios, mas sem nenhum consumidor no frontend atual (o Dashboard e o hook `hooks/useApi.ts` usam `dashboardApi.getStats()`, que chama `/api/dashboard`, não `/api/dashboard/stats`). Vale confirmar com o time se a rota pode ser removida (reduziria manutenção de testes de código morto).
7. **`useEffect` de montagem chama `loadDashboardData()` sem `forceRefresh=true`**, mas o comentário no código diz "sempre força reload para garantir dados frescos ao trocar de aba" — na prática, se `dashboardData` já estiver em estado (ex.: componente não desmontado, apenas re-renderizado) e o cache de 30s ainda for válido, o fetch é pulado, contradizendo o comentário. Comportamento não teria efeito visível na maioria dos casos reais (troca de rota desmonta o componente), mas é uma inconsistência entre comentário e código que merece um teste de regressão caso o componente passe a ser mantido montado (ex.: com `keep-alive`/tabs internas).
8. **Testes E2E de "Dashboard" não testam o Dashboard de ADMIN.** O spec loga como `owner`, que cai no `SaaSDashboard`, tornando o nome do arquivo (`dashboard.spec.ts`) enganoso quanto à cobertura real do `ClinicDashboard`.
9. Vários testes do `dashboard.spec.ts` usam `if (await link.isVisible())` antes de clicar — se o elemento não existir, o teste passa "silenciosamente" sem testar nada, mascarando regressões de navegação.

## Testes recomendados

### Alta prioridade

1. **[E2E]** `e2e/dashboard.spec.ts` (ou novo `e2e/dashboard-admin.spec.ts`) — login como ADMIN de clínica (não `owner`) e validar que o `ClinicDashboard` renderiza: os 4 `StatCard` (Faturamento, Ticket Médio, Pacientes Atendidos, Taxa de Cancelamento) com valores não vazios, a faixa de 5 mini-KPIs, e os dois gráficos (`svg` de receita e de procedimentos) presentes no DOM.
2. **[E2E]** Novo teste: com um agendamento `PENDING_APPROVAL` pré-existente (via seed/fixture ou criação direta no banco de teste), verificar que o banner "Novas Solicitações" aparece no dashboard do ADMIN, clicar em "Aprovar" e confirmar que o banner desaparece (ou o contador diminui) e que uma notificação foi criada para o paciente.
3. **[E2E]** Mesmo cenário acima, mas clicando em "Recusar": confirmar que o agendamento muda de status e, especificamente, **que uma falha na chamada (ex.: mockar erro de rede/API) exibe algum feedback de erro ao usuário** — hoje não há, então este teste vai falhar até o bug (#3) ser corrigido; documentar isso explicitamente como teste que expõe o problema.
4. **[Frontend Vitest+RTL]** `__tests__/pages/Dashboard.test.tsx` — teste do cálculo de `revenueTrend`: mockar `dashboardApi.getStats` retornando `charts.revenueChart` com valores conhecidos e verificar que o `trend` exibido no card "Faturamento" corresponde à fórmula (`(segunda metade - primeira metade) / primeira metade * 100`), incluindo o caso especial `firstHalf === 0` (deve retornar `100` se `secondHalf > 0`, ou `0` caso contrário) e o caso `revenueChart.length < 2` (deve omitir a tag de trend).
5. **[Frontend Vitest+RTL]** `__tests__/pages/Dashboard.test.tsx` — cenário: `handleRejectApproval` chamado com `changeAppointmentStatus` mockado para retornar `{ success: false, error: 'X' }`; verificar que hoje **nenhum feedback de erro é mostrado** (teste que documenta o bug #3) — ou, após correção, que `useDialog().showAlert` é chamado com a mensagem de erro.
6. **[Frontend Vitest+RTL]** `__tests__/pages/Dashboard.test.tsx` — cenário: `subscriptionsApi.cancel` mockado para rejeitar/retornar erro ao clicar "Recusar" em um plano pendente; verificar que o plano **permanece** na lista de pendentes na UI (comportamento correto esperado) — hoje falharia porque o código remove incondicionalmente (bug #4).
7. **[Backend Vitest]** `aura-backend/src/__tests__/api/dashboard.test.ts` — novo caso: montar agendamentos com mistura de status `COMPLETED`, `PENDING_APPROVAL`, `SCHEDULED`, `CANCELED` e travar/validar explicitamente o valor atual de `appointmentsConfirmed` (`periodAppointments - canceledAppointments`), deixando comentado no teste que esse valor inclui completados/pendentes — para que qualquer mudança futura no cálculo seja consciente (regressão intencional documentada, já que hoje não há nenhum teste que force esse cálculo com uma composição de status mista).
8. **[Backend Vitest]** `aura-backend/src/__tests__/api/dashboard.test.ts` — novo caso: `periodTransactions` com transações `PAID` e `PENDING`/`REFUNDED` misturadas — confirmar que `kpis.revenue` soma **apenas** as `type: INCOME, status: PAID` (a query já filtra isso; hoje não há teste que prove isso com dados mistos no mock, apenas com um único valor agregado).

### Média prioridade

9. **[Frontend Vitest+RTL]** Teste de cache: mockar `dashboardApi.getStats`, montar o componente, avançar timers/re-renderizar dentro de 30s e verificar que uma segunda chamada **não** ocorre (exceto quando `revenueRange` muda, que deve forçar refresh mesmo dentro da janela de cache) — cobre a lógica de `DASHBOARD_CACHE_MS`.
10. **[Frontend Vitest+RTL]** Teste do toggle `7D`/`30D`: clicar em "30D" e verificar que `dashboardApi.getStats` é chamado com `days=30` e que o botão ativo muda de estilo (classe `bg-primary-500`).
11. **[Frontend Vitest+RTL]** Teste de `activeAlerts`: combinar `dashboardData.alerts.lowStock` (2 itens) com `systemAlerts` do contexto (1 ativo direcionado à empresa do usuário + 1 com `target` de outra empresa + 1 com `status !== 'active'`) e verificar que apenas os alertas aplicáveis aparecem, respeitando o limite de 3 exibidos e exclusão dos `dismissedAlertIds`.
12. **[Frontend Vitest+RTL]** Teste de "descartar alerta": clicar no X de um alerta e verificar que ele some da lista imediatamente (comportamento client-side, sem chamada de API) — e, dado o achado #5, considerar adicionar um teste (ou decisão de produto) sobre persistência entre reloads.
13. **[Backend Vitest]** `subscriptions-patients.test.ts` — adicionar um teste explícito com `?status=PENDING` (hoje só existe com `?status=ACTIVE`) para documentar o caso realmente usado por `subscriptionsApi.listPending()` chamado no Dashboard.
14. **[E2E]** Cenário de ativação de plano pendente: a partir de uma assinatura `PENDING` pré-existente, clicar "Ativar" no dashboard, verificar sucesso (banner desaparece) e, num segundo teste, simular falha da API e confirmar que a assinatura **permanece** na lista (o código já faz a checagem de `res.success` aqui — teste de regressão positivo).
15. **[Frontend Vitest+RTL]** Teste do `DashboardSkeleton`: garantir que ele é renderizado enquanto `isLoadingDashboard` é `true` ou `dashboardData` é `null`, e que desaparece após o fetch resolver.
16. **[Backend Vitest]** `dashboard.test.ts` — teste para `days` inválido/não numérico na query string (ex.: `?days=abc` → `parseInt` retorna `NaN`; hoje não há teste garantindo um fallback sensato nesse caso).

### Baixa prioridade

17. **[Frontend Vitest+RTL]** `SaaSDashboard`: teste de cálculo de MRR (`companies.reduce` com `saasPlans`), incluindo caso de empresa com `plan` que não existe mais em `saasPlans` (deve somar `0`, não quebrar).
18. **[Frontend Vitest+RTL]** Testes de snapshot/estrutura para `SimpleRevenueChart` e `SimpleBarChart` com `data` vazio (mensagem "Nenhum dado de receita disponível") e com um único ponto de dado (evitar divisão por zero em `(800 - paddingLeft - paddingRight) / (data.length - 1)` quando `data.length === 1`).
19. **[Backend Vitest]** Decidir e testar (ou remover) `aura-backend/src/app/api/dashboard/stats/route.ts` — como não há consumidor no frontend, os 8 testes existentes protegem código potencialmente morto; se for mantido para uso futuro/externo, documentar isso nos comentários da rota.
20. **[E2E]** Teste de responsividade/acessibilidade básica do dashboard (grid de KPIs em 2 colunas no mobile vs 4 no desktop) — baixo risco funcional, mas cobre uma regra de layout explícita no código (`grid-cols-2 lg:grid-cols-4`).
