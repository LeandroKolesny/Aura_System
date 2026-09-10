# Auditoria de Testes — Relatórios BI

**Arquivo principal:** `pages/Reports.tsx`
**Componente auxiliar (aba Retorno de Pacientes):** `components/RetentionTab.tsx`
**Endpoint backend consumido diretamente pela aba:** `GET /api/retention` (via `retentionApi.getReport` em `services/api.ts:1391-1397`)

## Funcionalidades identificadas

### Filtros globais (afetam quase tudo na aba "Análise Geral")
1. **Período** (`timeRange`): `1w, 1m, 2m, 3m, 6m, 1y, 2y, 3y, 4y, 5y` — dropdown que recalcula `getStartDate(range)`.
2. **Clínica selecionada** (`selectedCompanyId`): visível/editável só para `OWNER`; para `ADMIN`/demais roles é travada em `user.companyId`.
3. **Abas**: "Análise Geral" (`analytics`) e "Retorno de Pacientes" (`retention`, componente lazy `RetentionTab`).

### Aba "Análise Geral"
4. **[OWNER]** Ranking "Top Clínicas por Receita MRR" (`topSpenderClinics`) — top 5 clínicas por preço do plano SaaS atual.
5. **[OWNER]** Ranking "Top Clínicas por Pacientes" (`topPopulousClinics`) — top 5 clínicas por contagem de pacientes.
6. KPI **Faturamento Total** (`totalRevenue`) — soma de transações `type=income` no período, com trend vs. período anterior (`trendData.revenueTrend`).
7. KPI **Atendimentos** (`appointmentStats.completed`/`total`) — com trend vs. período anterior.
8. KPI **Pacientes Ativos** (`totalPatients`) — contagem total de pacientes da clínica (não filtrado por período).
9. KPI **Taxa de Retenção** (`retentionMetrics.rate`) — % de pacientes com >1 atendimento `completed` no período. **Importante: esta é uma métrica de retenção diferente e com fórmula diferente da retenção calculada em `/api/retention`/aba Retorno de Pacientes** (ver seção de problemas).
10. Gráfico **"Evolução do Faturamento"** (`monthlyRevenueData`) — série temporal de receita agrupada por dia (períodos `1w`/`1m`) ou por mês (demais períodos).
11. Insight card **"Proc. Campeão"** — primeiro item de `procedureEfficiency` (maior faturamento).
12. Insight card **"Ticket Médio"** — `Σ totalRevenue / max(1, Σ volume)` de `procedureEfficiency`.
13. Insight card **"Cancelamentos"** — `appointmentStats.cancelRate`, com destaque visual se > 15%.
14. Insight card **"Top Profissional"** — primeiro item de `professionalPerformance` (maior receita).
15. Gráfico **"Mais Vendidos"** (`topProceduresByClinic`) — contagem de atendimentos `completed`/`confirmed` agrupados por serviço, top 5.
16. Donut **"Retenção de Pacientes"** — visual de `retentionMetrics` (recorrentes vs. única visita).
17. Donut **"Status de Agendamentos"** — visual de `appointmentStats` (realizados vs. cancelados).
18. Seção **"Clientes VIP"** (`topSpendersInClinic`) — top 5 pacientes por soma de transações de receita vinculadas a `appointmentId`, com destaque especial para o #1.
19. Tabela **"Performance da Equipe"** (`professionalPerformance`) — por profissional: atendimentos concluídos/cancelados, receita, custo de salário fixo (`fixedSalary * monthsCount`), custo de comissão (`totalRevenue * commissionRate/100`), custo total, % da receita do time e margem (`revenue - totalCost`).
20. Tabela **"Matriz de Eficiência"** (`procedureEfficiency`) — por procedimento: volume, ticket médio real, faturamento e classificação de negócio (`Estrela ⭐ / Popular 🔥 / Premium 💎 / Baixo Rendimento ⚠️ / Regular`) definida por regras de threshold de volume e ticket.
21. Gate de acesso: `checkModuleAccess('reports')` — se falso, toda a aba é coberta por `UpgradeOverlay` (bloqueio por plano).
22. **Não há exportação de dados.** Os ícones `Download`, `Filter`, `RefreshCw`, `ChevronRight`, `TrendingDown`, `PieChart`, `MiniSparkline` são importados em `Reports.tsx` mas nunca usados no JSX — funcionalidade aparentemente planejada e não implementada.

### Aba "Retorno de Pacientes" (`RetentionTab.tsx`)
23. Filtro de período: 30/60/90 dias (botões).
24. Filtro de profissional (dropdown, só aparece se houver profissionais).
25. Botão "Atualizar" — reexecuta a busca.
26. KPIs: Em Atenção / Em Risco / Perdidas / Taxa de Retenção (`summary.retentionRate`) — todos vêm prontos do backend.
27. Tabela de pacientes em atraso: nome, telefone, último procedimento, última visita, retorno esperado, dias de atraso, badge de risco.
28. Botão/link "WhatsApp" por paciente — monta deep link `wa.me` com mensagem pré-formatada (`buildWhatsAppLink`), lógica 100% client-side (normalização de telefone BR, adiciona `55` se ausente).

## Endpoints de backend usados

- **`GET /api/retention`** (`aura-backend/src/app/api/retention/route.ts`) — usado exclusivamente pela aba "Retorno de Pacientes" (`RetentionTab.tsx` → `retentionApi.getReport`). Todo o cálculo (intervalo de manutenção, classificação de risco `attention/at_risk/lost`, taxa de retenção) é feito no servidor.
- **Nenhum outro endpoint é chamado pela aba "Análise Geral".** Todos os itens 4–22 acima são **calculados inteiramente no frontend**, dentro de `useMemo`s em `Reports.tsx`, a partir de dados já carregados no `AppContext` (`companies`, `saasPlans`, `patients`, `appointments`, `transactions`, `procedures`, `professionals`) via `loadPatients/loadAppointments/loadTransactions/loadProcedures/loadProfessionals`.

### Achado relevante: endpoint órfão duplicando lógica de negócio crítica
Existe `GET /api/reports/commissions` (`aura-backend/src/app/api/reports/commissions/route.ts`) — uma rota bem testada (`aura-backend/src/__tests__/api/reports-commissions.test.ts`, 11 cenários) que calcula exatamente a mesma coisa que a tabela **"Performance da Equipe"** do item 19 (receita, comissão, salário fixo, total por tipo de remuneração `COMMISSION/FIXED/MIXED`). **Busquei em todo o frontend (`services/api.ts` e `*.tsx`) e não há nenhuma chamada a essa rota** — ela não é consumida por `Reports.tsx` nem por nenhuma outra página. Ou seja: a lógica de cálculo de comissão/salário que o usuário realmente vê na aba Relatórios está duplicada no frontend (`professionalPerformance`, linhas ~474-524 de `Reports.tsx`), sem nenhum teste, enquanto uma implementação equivalente e bem testada existe no backend e não é usada. Isso é uma duplicação de código que a política do projeto (`CLAUDE.md` — "Não duplicar código") pede para evitar, e representa risco real: se um dia decidirem consumir o endpoint em vez do cálculo local, ou corrigirem um bug só de um lado, os dois podem divergir silenciosamente.

## Cobertura de testes atual

### Backend
- `aura-backend/src/__tests__/api/retention.test.ts` — **cobre bem** o endpoint `/api/retention` usado pela aba: 401/403, período padrão e validação (30/60/90), intervalo padrão de manutenção (60 dias), não incluir paciente cujo retorno ainda não passou, classificação de risco nos 3 níveis, manter só o agendamento mais recente por paciente, cálculo da taxa de retenção (incluindo caso sem pacientes → 100%), filtro por `professionalId`. Cobertura sólida.
- `aura-backend/src/__tests__/api/reports-commissions.test.ts` — cobre bem `/api/reports/commissions` (401/403/402/400, cálculo por `COMMISSION/FIXED/MIXED`, filtro por profissional, totais gerais). **Porém esse endpoint não é usado pela aba Relatórios** (ver achado acima), então essa cobertura não protege o que o usuário efetivamente vê.
- Não há teste de `dashboard/stats` relacionado a esta aba (usado por outra página, fora do escopo de Relatórios BI).
- Confirmado: pasta `aura-backend/src/__tests__/api/` tem 99 arquivos; nenhum outro arquivo relacionado especificamente aos cálculos de "Análise Geral" da aba Relatórios (porque essa parte não tem endpoint próprio).

### Frontend
- Confirmado: `C:\Aura_System\__tests__\` contém apenas `context/AppContext.test.tsx` e `services/api.test.ts`. **Não existe nenhum teste de página ou componente**, e portanto **zero cobertura** para:
  - Todas as funções de cálculo em `Reports.tsx` (`getStartDate`, `getMonthMultiplier`, `topSpenderClinics`, `topPopulousClinics`, `topProceduresByClinic`, `topSpendersInClinic`, `procedureEfficiency`, `monthlyRevenueData`, `retentionMetrics`, `appointmentStats`, `professionalPerformance`, `totalRevenue`, `trendData`/`calcTrend`/`getPreviousPeriodDates`).
  - `RetentionTab.tsx`, incluindo `buildWhatsAppLink` (lógica de formatação de telefone BR e montagem de link do WhatsApp) e `formatDate`.
  - Gate `checkModuleAccess('reports')` — a função em si (`context/AppContext.tsx:255-272`) também não tem teste em `AppContext.test.tsx` (busquei por `checkModuleAccess` no arquivo de teste: nenhuma ocorrência).
- Isso é especialmente crítico porque **todo o cálculo financeiro exibido na aba (faturamento, comissões, salários, ticket médio, margem por profissional) roda inteiramente no frontend, sem nenhuma rede de segurança de teste.**

### E2E
- Specs existentes em `C:\Aura_System\e2e\`: `public-booking.spec.ts`, `forgot-password.spec.ts`, `register.spec.ts`, `login.spec.ts`, `dashboard.spec.ts`, `whatsapp-settings.spec.ts`. Busquei por "report"/"Report"/"Relat" em todo o diretório `e2e/` — **nenhuma ocorrência**. Confirmado: **nenhum spec E2E cobre a aba Relatórios/Retorno de Pacientes.**

## Problemas encontrados durante a revisão

1. **[Suspeita de bug real, alta confiança] Overflow de mês em `getStartDate` para períodos mensais/anuais, quebrando os filtros quando executado nos dias 29, 30 ou 31.**
   `getStartDate` (linhas 157-176) faz `d.setMonth(d.getMonth() - N)` (para `1m/2m/3m/6m`) ou `d.setFullYear(d.getFullYear() - N)` (para `1y..5y`) **sem antes fixar o dia em 1**. Em JavaScript, `Date.setMonth` estoura para o mês seguinte quando o mês de destino tem menos dias que o dia atual — ex.: hoje = 31/03, período "1 Mês": `d.setMonth(2 - 1)` = fevereiro, mas fevereiro só tem 28 dias, então o resultado real é **03/03** (e não 28/02 ou 31/01 como o usuário esperaria). Isso faz o filtro de "1 Mês" (ou "3 Meses", "6 Meses", etc., dependendo do dia do mês) começar mais tarde do que deveria, **excluindo silenciosamente até ~3 dias de transações/atendimentos** do início do período — afetando `totalRevenue`, `appointmentStats`, `retentionMetrics`, `professionalPerformance`, `procedureEfficiency`, `topProceduresByClinic`, `topSpendersInClinic` e `trendData` (via `getPreviousPeriodDates`, que também chama `getStartDate`).
   - Evidência de que o problema é conhecido pelo autor: em `monthlyRevenueData` (linha ~353) há um comentário explícito — *"Alinhar ao dia 1 para garantir iteração mensal limpa sem pular meses (ex: dia 31 -> dia 1)"* — e o código faz `startDate.setDate(1)` **depois** de chamar `getStartDate`, mas só para esse gráfico específico. O `getStartDate` em si, usado por todos os outros cálculos, não recebeu a mesma correção.
   - Como hoje é 2026-09-09, o bug não se manifesta nos testes manuais feitos "hoje", mas vai se manifestar de forma intermitente e dependente da data em produção — exatamente o tipo de bug que passa despercebido sem teste automatizado com data fixa (`vi.setSystemTime`).

2. **[Possível confusão de produto, não necessariamente bug] Duas métricas de "Taxa de Retenção" coexistem com fórmulas diferentes.**
   - KPI "Taxa de Retenção" na aba Análise Geral (`retentionMetrics.rate`, `Reports.tsx`): `pacientes com >1 atendimento completed no período / total de pacientes com atendimento completed no período`.
   - Aba "Retorno de Pacientes" (`summary.retentionRate`, backend `/api/retention`): `(total de pacientes com atendimento no período − pacientes em atraso) / total`, com "atraso" definido por `maintenanceIntervalDays` do procedimento.
   São conceitos de negócio diferentes com o mesmo nome de métrica exibido na mesma tela — vale confirmar com o time de produto se é intencional, pois pode confundir o usuário (dois números de "retenção" diferentes na mesma página).

3. **Aproximação do custo de salário fixo para períodos não múltiplos de mês inteiro.**
   `professionalPerformance` calcula `salaryCost = pro.fixedSalary * monthsCount`, onde `getMonthMultiplier('1w') = 0.25`. Isso é uma aproximação (assume mês = 4 semanas exatas) que pode distorcer levemente margem/custo exibidos para o período "1 Semana" e também não é proporcional a dias corridos reais para os demais períodos (ex.: "2m" sempre usa `2`, independente de o intervalo real ter 59, 60 ou 61 dias). Não chega a ser um bug de cálculo incorreto por si só, mas é uma regra de negócio implícita sem teste que documente o comportamento esperado.

4. **Sem tratamento de erro visível para falha de carregamento na aba Análise Geral.** `Reports.tsx` chama `loadPatients/loadAppointments/loadTransactions/loadProcedures/loadProfessionals` em um `useEffect` sem capturar nem exibir falha ao usuário (diferente de `RetentionTab.tsx`, que trata `res.success` e mostra `error` em tela). Se uma dessas chamadas falhar silenciosamente dentro do `AppContext`, a aba mostraria dados parciais/zerados sem avisar o usuário — potencial violação da regra do projeto "todo erro deve ser comunicado ao usuário" (`CLAUDE.md`), embora o tratamento de erro em si esteja dentro do `AppContext`, fora do escopo direto deste arquivo.

5. **Nenhum problema de arredondamento monetário identificado.** `formatCurrency` (`utils/formatUtils.ts`) usa `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`, que trata arredondamento de forma padrão e é usado consistentemente em toda a aba — não há concatenação manual de string nem `toFixed` para valores monetários dentro de `Reports.tsx`.

6. **Divisões por zero: todas guardadas corretamente.** `retentionMetrics.rate`, `appointmentStats.cancelRate`, `procedureEfficiency[].ticket` e o "Ticket Médio" do insight card usam checagens `total > 0 ? ... : 0` ou `Math.max(1, ...)`. Nenhuma divisão por zero encontrada nos cálculos revisados.

7. **Endpoint órfão `/api/reports/commissions`** — ver seção "Endpoints de backend usados" acima. Não é um bug funcional (o cálculo local produz os mesmos números, presumivelmente), mas é duplicação de lógica de negócio sensível sem uso do endpoint já testado.

## Testes recomendados

### Alta prioridade

1. **[Frontend Vitest]** Extrair `getStartDate` (e idealmente `getMonthMultiplier`, `getPreviousPeriodDates`, `calcTrend`) de `Reports.tsx` para um módulo puro testável (ex.: `utils/reportsCalc.ts` ou similar) e cobrir com `vi.setSystemTime` fixando datas nos dias 29, 30 e 31 de meses com fevereiro/meses curtos no meio do intervalo, para os períodos `1m, 2m, 3m, 6m, 1y`. Cenário exato: `vi.setSystemTime(new Date('2026-03-31'))`, chamar `getStartDate('1m')`, esperar `2026-02-28` (ou a data que o negócio definir como correta) — hoje retorna `2026-03-03`, expondo o bug do item 1.
2. **[Frontend Vitest]** Teste unitário isolado da função de cálculo de `professionalPerformance` (extrair para função pura recebendo `professionals`, `appointments`, `startDate`, `monthsCount`): cenários `remunerationType='comissao'`, `'fixo'`, `'misto'`, `sem commissionRate`/`sem fixedSalary` (undefined), profissional sem nenhum atendimento no período, e verificação de `margin = revenue - totalCost` incluindo margem negativa. Arquivo sugerido: `__tests__/pages/Reports.calc.test.ts` (ou `__tests__/utils/reportsCalc.test.ts` se extraído).
3. **[Frontend Vitest]** Teste unitário de `procedureEfficiency` cobrindo cada limiar de classificação: `volume>5 && ticket>500` → "Estrela ⭐"; `volume>10` (com ticket baixo) → "Popular 🔥"; `ticket>1000` com `volume` baixo → "Premium 💎"; `volume<3` → "Baixo Rendimento ⚠️"; caso intermediário → "Regular". Incluir casos de fronteira exatos (`volume===5`, `volume===10`, `ticket===500`, `ticket===1000`, `volume===3`) para garantir que os operadores `>`/`<` (não `>=`/`<=`) estão sendo testados como definidos no código.
4. **[Frontend Vitest]** Teste unitário de `monthlyRevenueData` verificando que a correção de alinhamento de dia (`startDate.setDate(1)`) realmente produz meses consecutivos sem pular nenhum, incluindo um caso onde "hoje" é dia 31 de um mês e o range cruza fevereiro.
5. **[Frontend Vitest]** Teste unitário de `retentionMetrics` e `appointmentStats`: caso "nenhum atendimento no período" (retorno `{single:0, returning:0, rate:'0'}` / `{completed:0, canceled:0, total:0, cancelRate:'0'}`), caso todos os pacientes com 1 única visita (rate=0), caso todos recorrentes (rate=100), e um caso misto com valor não-inteiro para checar `toFixed(1)`.
6. **[Frontend Vitest]** Teste unitário de `topSpendersInClinic`: transação de receita cujo `appointmentId` não corresponde a nenhum agendamento existente (deve ser ignorada, não quebrar); dois pacientes com o mesmo `patientName` mas potencialmente IDs diferentes (a agregação hoje é por `patientName`, não por `patientId` — validar se é o comportamento esperado, já que dois pacientes com nome igual seriam somados juntos).
7. **[E2E Playwright]** Novo spec `e2e/reports.spec.ts`: login como ADMIN, navegar até "Relatórios", trocar o filtro de período e confirmar que os KPIs (Faturamento, Atendimentos, Pacientes Ativos, Taxa de Retenção) e o gráfico de evolução são recarregados sem erro; alternar para a aba "Retorno de Pacientes" e confirmar que a lista carrega (ou mostra estado vazio) sem erro de console.

### Média prioridade

8. **[Frontend Vitest]** `RetentionTab.tsx` — testar `buildWhatsAppLink` isoladamente: telefone já com `55` no início (não deve duplicar), telefone com máscara `(11) 99999-9999` (deve limpar não-dígitos), mensagem final contendo nome do paciente/procedimento/data formatada `formatDate`.
9. **[Frontend Vitest + RTL]** `RetentionTab.tsx` — renderizar com mock de `retentionApi.getReport` retornando sucesso e erro (`res.success === false`), verificando que a mensagem de erro é exibida (`setError`) e que o botão "Atualizar" fica desabilitado durante `loading`.
10. **[Frontend Vitest + RTL]** `Reports.tsx` — renderizar com `checkModuleAccess` retornando `false` e verificar que `UpgradeOverlay` é exibido; renderizar com `true` e verificar que o conteúdo normal aparece. Cobre o gate de plano que hoje não tem nenhum teste.
11. **[Frontend Vitest]** `topSpenderClinics`/`topPopulousClinics` — caso `saasPlans` vazio (plano não encontrado, `monthlyPrice=0`), caso empate de valores (ordem estável esperada), caso mais de 5 clínicas (slice correto).
12. **[Backend Vitest]** Se a decisão de produto for **manter** `/api/reports/commissions` como fonte de verdade futura (recomendado, para eliminar a duplicação do achado 7), adicionar um teste de regressão comparando a saída desse endpoint com a lógica equivalente do frontend para os mesmos dados de entrada — ou, alternativamente, registrar a decisão de **remover** o endpoint órfão e seu teste se ele não fizer mais parte do roadmap.
13. **[Frontend Vitest]** Teste de `checkModuleAccess` em `context/AppContext.tsx` (arquivo `__tests__/context/AppContext.test.tsx`): `OWNER` sempre `true`; `saasPlans` vazio → `true` (fallback); plano da empresa não encontrado em `saasPlans` → `true` (fallback com warning); plano encontrado sem o módulo `reports` → `false`; plano encontrado com o módulo → `true`.

### Baixa prioridade

14. **[Frontend Vitest + RTL]** Teste de snapshot/estrutura da tabela "Matriz de Eficiência": garantir que a linha vazia ("Nenhum dado para analisar...") aparece quando `procedureEfficiency` é `[]`, e o mesmo para "Performance da Equipe" e "Clientes VIP".
15. **[Frontend Vitest]** `getTimeRangeLabel`/`getMonthMultiplier` — teste simples de tabela (parametrizado) garantindo que todo valor de `timeRange` usado no `<select>` tem label e multiplicador correspondentes (evita rótulo "Período" genérico por esquecimento ao adicionar um novo range).
16. **[E2E Playwright]** Cenário de responsividade/RBAC: usuário `RECEPTIONIST`/`ESTHETICIAN` não deve conseguir acessar a rota de Relatórios (se a navegação já bloqueia isso fora desta página, validar redirecionamento).
17. **[Frontend Vitest]** Teste de que o seletor de clínica (`selectedCompanyId`) fica oculto e travado em `user.companyId` para roles não-OWNER (comportamento hoje implícito no `useEffect` da linha 146-154, sem teste).
