# Auditoria de Testes — Financeiro

Escopo: aba "Financeiro" para ADMIN (`ClinicFinancial`) e OWNER (`SaaSFinancial`) em
`C:\Aura_System\pages\Financial.tsx`, modal de importação `C:\Aura_System\components\ImportCSVModal.tsx`,
modal de lançamento manual `NewExpenseModal` em `C:\Aura_System\components\Modals.tsx`, client HTTP
`C:\Aura_System\services\api.ts` (`transactionsApi`) e `C:\Aura_System\services\installmentsApi.ts`,
estado global `C:\Aura_System\context\AppContext.tsx`, e rotas de backend em
`C:\Aura_System\aura-backend\src\app\api\transactions\*` e `...\appointments\[id]\pay\route.ts`.

## Funcionalidades identificadas

**`ClinicFinancial` (role ADMIN, também visível em modo leitura para ESTHETICIAN/PATIENT via `visibleTransactions`):**

1. Listagem de lançamentos do mês selecionado, navegável (mês anterior/próximo), agrupando por `appointmentId`
   (receita + despesa do mesmo atendimento na mesma linha) — `groupedTransactions` (Financial.tsx:180-212).
2. Parcelas futuras (`installmentIndex > 1`) exibidas como linhas "standalone" separadas, posicionadas pelo mês
   de `dueDate` em vez de `date` (Financial.tsx:156-164, 183-189).
3. KPIs do mês: Receita Total, Custo Total (com trend vs. mês anterior), Saldo Acumulado (all-time, não só do
   mês) e "A Receber (Parcelas)" — soma de todas as parcelas `pending` com `installmentGroupId`, de qualquer mês
   (Financial.tsx:218-222, 229-242, 267-270).
4. Cálculo de custo por procedimento quando a transação de despesa não existe: `findProcedureCost` faz
   *matching* de palavras-chave (≥4 chars) do nome do procedimento dentro da descrição da transação
   (Financial.tsx:131-146) — heurística textual, não uma referência direta ao `procedureId`.
5. Criar despesa/receita manual avulsa (`NewExpenseModal`, sem `appointmentId`) — chama `addTransaction` →
   `POST /api/transactions`.
6. Editar lançamento manual avulso (só permitido quando `!t.appointmentId`) — `updateTransaction` →
   `PUT /api/transactions/:id`.
7. Excluir lançamento manual avulso (só permitido quando `!t.appointmentId`), com `confirm()` do `useDialog`
   antes — `deleteTransaction` → `DELETE /api/transactions/:id`.
8. Marcar parcela pendente como paga ("Receber") — `markInstallmentPaid` → `PATCH /api/transactions/:id/pay`.
9. Importação em massa de lançamentos via CSV/XLSX (`ImportCSVModal` + `transactionsApi.importCSV`) →
   `POST /api/transactions/import`, com template de download (`.xlsx` via `xlsx` lib) e relatório de
   importados/atualizados/erros.
10. Configuração de formas de pagamento aceitas pela clínica (`currentCompany.paymentMethods`) —
    não é uma funcionalidade "financeira" de transações em si, mas vive na mesma página.
11. Modo somente-leitura (`isReadOnly`) desabilita: importar, lançar despesa, editar, excluir, receber parcela,
    salvar formas de pagamento.
12. Restrição de visibilidade por role: usuários não-ADMIN só veem transações de tipo `income` ligadas aos
    próprios agendamentos (`visibleTransactions`, Financial.tsx:150-154) — provavelmente para portal do paciente.

**`SaaSFinancial` (role OWNER):**

13. Lista mensalidades das empresas-clientes (dados sintéticos: status `pending/overdue/paid` é derivado do
    último dígito do `company.id`, não de dado real de cobrança) + despesas do OWNER
    (Financial.tsx:65-70, 72).
14. Saldo = soma de mensalidades `paid` − soma de despesas do owner (Financial.tsx:74).
15. Lançar despesa do OWNER via o mesmo `NewExpenseModal`.
16. Ver detalhe de uma transação (`TransactionDetailModal`), incluindo botão "Recibo" que **não tem
    `onClick`** — é decorativo/não implementado (Financial.tsx:54).

O parcelamento (installments) é criado **apenas** ao pagar um agendamento
(`POST /api/appointments/:id/pay`), não pelo `NewExpenseModal` nem pelo `transactions/checkout`. A tela
Financeiro só consome/exibe parcelas já criadas e permite marcá-las como pagas.

## Endpoints de backend usados

| Endpoint | Arquivo | Uso no Financeiro |
|---|---|---|
| `GET /api/transactions` | `aura-backend/src/app/api/transactions/route.ts` | `loadTransactions()` — carrega até `limit: 100` transações (sem filtro de data) para toda a lógica client-side de agrupamento/KPIs |
| `POST /api/transactions` | idem | Criar despesa/receita manual (`NewExpenseModal`) |
| `PUT /api/transactions/:id` | `aura-backend/src/app/api/transactions/[id]/route.ts` | Editar lançamento manual |
| `DELETE /api/transactions/:id` | idem | Excluir lançamento manual |
| `PATCH /api/transactions/:id/pay` | `aura-backend/src/app/api/transactions/[id]/pay/route.ts` | "Receber" parcela pendente |
| `POST /api/transactions/import` | `aura-backend/src/app/api/transactions/import/route.ts` | Importação CSV/XLSX |
| `POST /api/appointments/:id/pay` | `aura-backend/src/app/api/appointments/[id]/pay/route.ts` | Cria as N parcelas (receita) + despesa de insumos ao finalizar pagamento de um atendimento (não é chamado a partir de Financial.tsx diretamente, mas popula os dados que a tela exibe) |
| `POST /api/transactions/checkout` | `aura-backend/src/app/api/transactions/checkout/route.ts` | Existe e tem cobertura de teste, mas **não é chamado** por nenhum componente do Financeiro nem do fluxo de agendamento auditado (fluxo real usa `appointments/:id/pay`). Não confirmado se é código morto ou usado em outro fluxo (ex.: portal do paciente) — vale confirmar antes de decidir se merece mais testes. |
| `POST/GET /api/transactions/backfill-expenses`, `GET/DELETE /api/transactions/diagnose` | idem | Ferramentas de correção de despesas de insumos ausentes/incorretas — não expostas na UI do Financeiro (não há botão em Financial.tsx que as chame); parecem scripts/rotas administrativas de manutenção |

## Cobertura de testes atual

### Backend

Cobertura extensa e bem estruturada em `aura-backend/src/__tests__/api/` e `.../lib/validations/`:

- **`transactions.test.ts`** — GET: 401/403/400 de validação, cálculo de `income/expense/balance` a partir de
  `groupBy` (só `PAID`), filtro por intervalo de datas. POST: 401/403/400 (valor negativo), criação de
  despesa com `Activity` tipo `EXPENSE_CREATED`, criação de receita com `PAYMENT_RECEIVED`.
- **`transactions-id.test.ts`** — PUT: 401/403/404/409 (vinculada a agendamento)/400 (dados inválidos),
  sucesso normalizando data para meio-dia UTC. DELETE: 401/403/404/409 (vinculada a agendamento), sucesso.
- **`transaction-pay.test.ts`** — PATCH `.../pay`: 401, 404, 400 (já paga), sucesso marcando `PAID` com nova
  `date`, isolamento multi-tenant (não deixa marcar transação de outra empresa).
- **`pay-installments.test.ts`** — cobre criação de 1 parcela (padrão) e de 3 parcelas (1 PAID + 2 PENDING),
  valor de cada parcela ≈ total/N (`toBeCloseTo(100, 1)`), `installmentGroupId` compartilhado, `dueDate`
  crescente entre parcelas. **Usa sempre `price = 300` com `installments = 3` (divisão exata, 100.00 cada)** —
  nunca testa um valor que não divide igualmente (ver seção de problemas).
- **`installment-schema.test.ts`** — apenas confirma que o schema Prisma do model `Transaction` tem os campos
  de parcelamento (`installments`, `installmentIndex`, `installmentGroupId`, `dueDate`); teste estrutural, não
  de comportamento.
- **`transactions-checkout.test.ts`** — 401/403 (role sem permissão)/400 (dados inválidos)/404 (agendamento
  inexistente)/400 (já pago)/400 (status inválido)/400 (valor final ≤ 0), sucesso completo, desconto aplicado,
  não duplica atualização de status quando já `COMPLETED`, cálculo de comissão do profissional (com e sem
  `commissionRate`). Esta rota não trata parcelamento (não tem parâmetro `installments`).
- **`transactions-backfill-expenses.test.ts`** — POST: 401/403, ignora procedimento sem insumos, cria despesa
  ausente, corrige despesa com valor incorreto, não altera quando já correta (sem `forceRecreate`), força
  recriação com `forceRecreate=true`. GET: 401, relatório de agendamentos com despesa ausente.
- **`transactions-diagnose.test.ts`** — GET: 401/403 (sem empresa), monta diagnóstico com custo de insumos e
  transações vinculadas, marca `needsFix=true` quando despesa não bate com custo calculado. DELETE: 401/403,
  apaga e recria despesas de insumos, pula agendamentos sem custo.
- **`transactions-import.test.ts`** — 401/403 (role RECEPTIONIST), importação com sucesso, normalização de
  tipo/status em PT-BR e EN, erro em tipo/valor/data inválidos, erro quando descrição ausente, parsing de data
  BR (`DD/MM/AAAA`), categoria padrão por tipo, 400 quando coluna obrigatória ausente, 400 para arquivo vazio,
  mistura de linhas válidas/inválidas no mesmo arquivo. **Não há teste cobrindo "atualização" de lançamento
  existente durante import** — coerente com o achado de que a rota nunca incrementa `result.updated` (ver
  Problemas).
- **`lib/validations/transaction.test.ts`** — `createTransactionSchema`, `processPaymentSchema`,
  `updateTransactionSchema`, `listTransactionsQuerySchema`: casos de sucesso, valores limites (amount zero/
  negativo, description curta demais, category vazia), status `REFUNDED` permitido só em update, `type=all`,
  `status=OVERDUE` só em filtro de listagem, `limit` acima de 100.

**Não encontrado:** nenhum teste dedicado à rota `appointments/[id]/pay` fora de `pay-installments.test.ts`
(ex.: cálculo de `procedureCost` combinando insumos dinâmicos vs. custo salvo, baixa de estoque, atualização de
`lastVisit`, ausência de round-trip de valor quando `numInstallments` não divide o preço igualmente).

### Frontend

**Confirmado: não existe nenhum teste de página ou componente.** Em `C:\Aura_System\__tests__\` só há
`context/AppContext.test.tsx`, `services/api.test.ts` e `setup.ts` — nenhum arquivo `Financial`, `Modals`,
`ImportCSVModal` ou equivalente.

Foi verificado especificamente se `AppContext.test.tsx` cobre `addTransaction` / `updateTransaction` /
`deleteTransaction` / `markInstallmentPaid` / `loadTransactions` — nenhuma menção a essas funções foi
encontrada no arquivo de teste (busca por essas strings não retornou ocorrências), ou seja, mesmo a lógica de
estado/tratamento de erro dessas funções no `AppContext` está sem cobertura.

**Achado importante de lógica sensível sem teste:** todo o cálculo de resumo financeiro exibido ao usuário é
feito no **frontend**, em `Financial.tsx`, a partir da lista bruta de transações — não a partir do `summary`
que a própria API já retorna em `GET /api/transactions` (que usa `groupBy` e filtra só `PAID`):
- `totalRevenue` / `totalCost` (linhas 229-230): somam **todas** as transações do mês, independente de status
  (`paid`, `pending`, `overdue` entram juntas) — diferente do `summary.income/expense` do backend, que soma só
  `PAID`.
- `allTimeBalance` (linha 215): soma todas as transações visíveis (todos os meses, todos os status).
- `pendingInstallments` (linhas 218-222): soma parcelas `pending` com `installmentGroupId`, de qualquer mês.
- `calcTrend` (linhas 237-242): cálculo percentual vs. mês anterior, com casos especiais quando `prev === 0`.
- `findProcedureCost` (linhas 131-146): heurística de correspondência texto→procedimento usada para exibir
  "Custo" e "Lucro" quando não existe transação de despesa vinculada.
- `groupedTransactions` (linhas 180-212): lógica de agrupamento por `appointmentId` + tratamento especial de
  parcelas futuras como linhas `standalone`.

Nenhum desses cálculos tem teste unitário (Vitest+RTL) hoje — todos rodam apenas implicitamente quando um
humano abre a tela.

### E2E

**Confirmado: nenhum spec Playwright cobre o módulo financeiro.** Os specs existentes em `C:\Aura_System\e2e\`
são: `dashboard.spec.ts`, `forgot-password.spec.ts`, `login.spec.ts`, `public-booking.spec.ts`,
`register.spec.ts`, `whatsapp-settings.spec.ts` — nenhum menciona `Financial`, transações, despesas ou
parcelamento.

## Problemas encontrados durante a revisão

1. **Rounding: soma das parcelas pode não bater com o valor total (bug real, não só risco teórico).**
   Em `aura-backend/src/app/api/appointments/[id]/pay/route.ts:80`:
   ```ts
   const installmentAmount = Number((Number(appointment.price) / numInstallments).toFixed(2));
   ```
   cada parcela é arredondada independentemente para 2 casas decimais e todas as parcelas recebem o **mesmo**
   valor. Quando `price` não é múltiplo exato de `numInstallments` (ex.: `price = 100`, `installments = 3` →
   `33.33` cada, soma = `99.99`, faltando `R$ 0,01`; ou `price = 100`, `installments = 7` → perda maior), o
   somatório das parcelas fica menor (ou maior) que o valor pago pelo paciente. Não há ajuste de resíduo na
   última parcela. O teste existente (`pay-installments.test.ts`) só usa `price = 300` / `installments = 3`
   (divisão exata), então esse comportamento nunca foi exercitado.

2. **Transação vinculada a agendamento cancelado não é estornada/ajustada.**
   `DELETE /api/appointments/[id]/route.ts` (cancelamento) apenas muda `status` do agendamento para
   `CANCELED` e cria uma `Activity` — não verifica `appointment.paid`, não toca em nenhuma `Transaction`
   vinculada. Se um agendamento já pago (com receita `PAID` e, em caso de parcelamento, parcelas futuras
   `PENDING`) for cancelado, as transações permanecem como estão: a receita paga não é estornada e as parcelas
   pendentes seguem cobráveis para um atendimento que não existe mais. Isso aparece no Financeiro como receita
   normal, sem qualquer sinalização de que o agendamento de origem foi cancelado.

3. **Inconsistência entre o `summary` calculado no backend e os KPIs calculados no frontend.**
   `GET /api/transactions` retorna `summary.income/expense/balance` somando **apenas** transações com
   `status = PAID` (via `groupBy`). O `Financial.tsx` (ClinicFinancial) ignora esse `summary` e recalcula
   `totalRevenue`/`totalCost`/`allTimeBalance` no cliente somando **todas** as transações independente de
   status. Isso significa que "Receita Total" e "Saldo Acumulado" na tela incluem valores `pending`/`overdue`
   como se já tivessem entrado no caixa — divergente do que a própria API calcula como saldo real. Pode ser
   intencional (mostrar "receita esperada" vs. "recebido"), mas não há indicação visual disso e é uma fonte
   comum de confusão para o usuário da clínica.

4. **`loadTransactions()` busca no máximo 100 transações, sem filtro de data, para alimentar toda a tela.**
   `transactionsApi.list({ limit: 100 })` (AppContext.tsx:518) não usa paginação nem filtro por mês/ano — a
   navegação de mês em `Financial.tsx` filtra client-side sobre esse conjunto fixo de até 100 registros. Uma
   clínica com mais de 100 lançamentos históricos (bem provável após alguns meses de uso) terá meses antigos
   ou parcelas futuras fora da janela dos 100 mais recentes simplesmente não aparecendo na tela, sem nenhum
   aviso de "há mais dados". Isso é mais um problema de escalabilidade/exibição do que de cálculo, mas afeta
   diretamente a confiabilidade dos KPIs financeiros.

5. **Importação CSV: campo "Atualizados" nunca é preenchido — a importação nunca atualiza, só cria.**
   O `ImportCSVModal` exibe um card "Atualizados" e o tipo `ImportResult` tem o campo `updated`, mas
   `POST /api/transactions/import/route.ts` só chama `prisma.transaction.create` (linha 139) e nunca
   incrementa `result.updated` (fica sempre `0`) nem verifica duplicidade por descrição/data/valor. Reimportar
   a mesma planilha duas vezes cria lançamentos duplicados em vez de atualizar os existentes — comportamento
   que contradiz a UI, que dá a entender que existe deduplicação/atualização.

6. **Botão "Recibo" no `TransactionDetailModal` não tem `onClick`** (Financial.tsx:54) — é puramente
   decorativo hoje. Não é um bug de cálculo, mas é uma funcionalidade aparentemente incompleta visível ao
   usuário do Financeiro.

7. **`findProcedureCost` é uma heurística textual frágil.** Ela casa palavras-chave (≥4 caracteres) do nome do
   procedimento com a descrição da transação (Financial.tsx:131-146) em vez de usar o `procedureId` real do
   agendamento. Nomes de procedimento parecidos ou descrições genéricas podem gerar "Custo"/"Lucro" incorretos
   na tabela — mas isso só afeta exibição (o valor já vem coberto por `expense` na maioria dos casos reais),
   não a persistência.

## Testes recomendados

### Alta prioridade

1. **[Backend Vitest]** `POST /api/appointments/[id]/pay` — soma das parcelas deve ser igual ao valor total
   quando o preço não divide igualmente pelo número de parcelas (ex.: `price = 100`, `installments = 3`;
   `price = 100`, `installments = 7`). Assertar `sum(installments.amount) === price` (ou documentar/ajustar a
   tolerância aceitável) — arquivo: `aura-backend/src/__tests__/api/pay-installments.test.ts` (novo `it`).
   Hoje o teste equivalente usa apenas valores que dividem exatamente, mascarando o bug real do item 1 dos
   Problemas.
2. **[Backend Vitest]** `DELETE /api/appointments/[id]` (cancelamento) — quando o agendamento tem
   `paid = true` e/ou parcelas `PENDING` vinculadas, verificar o comportamento atual (hoje: nenhum ajuste) e
   travar esse comportamento com um teste explícito, para que qualquer correção futura (estorno automático,
   marcação de transação como cancelada, bloqueio do cancelamento) seja deliberada e não acidental — arquivo
   novo: `aura-backend/src/__tests__/api/appointments-cancel-with-payment.test.ts`.
3. **[Frontend Vitest+RTL]** Testar a lógica de cálculo de `totalRevenue`, `totalCost`, `allTimeBalance` e
   `pendingInstallments` de `ClinicFinancial` com um conjunto de transações mock cobrindo: mistura de
   status (`paid`/`pending`/`overdue`), parcelas futuras (`installmentIndex > 1` usando `dueDate` fora do mês
   de `date`), e transações sem `installmentGroupId`. Extrair essa lógica para uma função pura testável (ex.
   `utils/financialCalculations.ts`) é recomendável antes de testar, já que hoje está inline no componente —
   arquivo alvo: novo `utils/financialCalculations.ts` + `__tests__/utils/financialCalculations.test.ts` (ou
   `__tests__/pages/Financial.test.tsx` testando via render se a extração não for feita).
4. **[Frontend Vitest+RTL]** `groupedTransactions`: parcela com `installmentIndex > 1` deve aparecer como linha
   `standalone` separada, posicionada pelo mês de `dueDate` (não de `date`), com custo/lucro exibidos como "—"
   (não deve somar custo duplicado da parcela 1) — arquivo: `__tests__/pages/Financial.test.tsx`.
5. **[Backend Vitest]** `GET /api/transactions` vs. frontend: teste de regressão documentando explicitamente
   que `summary.income/expense` só considera `status=PAID`, para deixar claro (e testado) o contrato que o
   frontend hoje ignora — evita que uma futura mudança no backend quebre silenciosamente uma suposição
   implícita. Arquivo: `aura-backend/src/__tests__/api/transactions.test.ts` (reforçar/expandir o teste já
   existente "calcula income, expense e balance..." com um caso que misture `PAID`/`PENDING`/`OVERDUE`).
6. **[E2E Playwright]** Fluxo completo: ADMIN loga → abre Financeiro → lança uma despesa manual → confirma que
   aparece na tabela do mês corrente com o valor formatado corretamente → edita a despesa → exclui a despesa
   (com confirmação via dialog) → confirma remoção da lista. Arquivo novo: `e2e/financial.spec.ts`.

### Média prioridade

7. **[Backend Vitest]** `POST /api/transactions/import` — reimportar a mesma planilha duas vezes deve
   (dependendo da decisão de produto) ou atualizar o lançamento existente, ou pelo menos não duplicar
   silenciosamente; hoje não há teste que force esse cenário. Arquivo:
   `aura-backend/src/__tests__/api/transactions-import.test.ts`.
2. **[Frontend Vitest+RTL]** `NewExpenseModal` — validação client-side: bloquear submit com descrição vazia ou
   valor ≤ 0 (mensagem "Preencha a descrição e o valor." / "O valor deve ser positivo."); submit com sucesso
   chama `addTransaction`/`updateTransaction` com o payload esperado (incluindo normalização de categoria
   default por tipo). Arquivo: `__tests__/components/Modals.NewExpenseModal.test.tsx`.
3. **[Frontend Vitest+RTL]** `ImportCSVModal` — fluxo de upload: rejeita extensão inválida, mostra loading
   durante `onImport`, exibe contadores `imported`/`updated`/`errors` corretamente a partir da resposta
   (incluindo o caso `res.data` vs. `res` direto, que o componente já trata de forma defensiva na linha 76),
   chama `onSuccess` só quando `imported + updated > 0`. Arquivo:
   `__tests__/components/ImportCSVModal.test.tsx`.
4. **[Backend Vitest]** `PATCH /api/transactions/[id]/pay` — marcar como paga uma transação que **não** é uma
   parcela (não tem `installmentGroupId`) hoje é permitido pela rota (não há checagem); confirmar se isso é
   intencional e, se não for, escrever teste que trave o comportamento esperado (ex.: 400 se não for parcela).
   Arquivo: `aura-backend/src/__tests__/api/transaction-pay.test.ts`.
5. **[Frontend Vitest+RTL]** `ClinicFinancial` — visibilidade condicional por role: usuário `PATIENT`/
   `ESTHETICIAN` só deve ver transações `income` ligadas aos próprios agendamentos (`visibleTransactions`);
   usuário `ADMIN` vê tudo. Testar ambos os casos com mocks de `useApp()`.
6. **[E2E Playwright]** Fluxo de parcelamento ponta a ponta: pagar um atendimento em 3x → abrir Financeiro →
   verificar que a 1ª parcela aparece `PAID` no mês corrente e as parcelas 2 e 3 aparecem como pendentes nos
   meses seguintes → clicar "Receber" na parcela do próximo mês → confirmar mudança de status para pago.
   Arquivo: `e2e/financial-installments.spec.ts`.

### Baixa prioridade

1. **[Backend Vitest]** `POST /api/appointments/[id]/pay` — teste dedicado ao cálculo de `procedureCost`
   (`Math.max(calculatedCost, procedure.cost)`), incluindo o caso em que os insumos dinâmicos custam mais que
   o `cost` salvo no procedimento e vice-versa. Hoje só existe cobertura indireta via
   `transactions-backfill-expenses.test.ts` para outro fluxo (correção retroativa), não para o pagamento em si.
2. **[Frontend Vitest+RTL]** `SaaSFinancial` (OWNER) — teste do cálculo de `balance` (mensalidades `paid` −
   despesas do owner) e da ordenação de `allRecords` por data decrescente. Prioridade baixa porque os dados de
   status de mensalidade são sintéticos (derivados do último dígito do `company.id`), não refletem cobrança
   real ainda.
3. **[Frontend Vitest+RTL]** `calcTrend` — casos de borda: `prev === 0 && current === 0` (sem trend), `prev
   === 0 && current > 0` (100%), e cálculo de porcentagem arredondada para valores negativos de `prev`.
4. **[E2E Playwright]** Modo somente-leitura (`isReadOnly`) — confirmar que todos os controles de escrita
   (Importar, Lançar Despesa, Editar, Excluir, Receber, Salvar formas de pagamento) aparecem desabilitados e
   não dependem apenas de CSS (ex.: clique não deve disparar nenhuma chamada de API).
