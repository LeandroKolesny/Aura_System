# Auditoria de Testes — Estoque

Escopo: aba "Estoque" (role ADMIN/OWNER), `pages/Inventory.tsx` + `InventoryModal` em
`components/Modals.tsx`, `components/ImportCSVModal.tsx` (compartilhado), integração com
`context/AppContext.tsx`, `hooks/useApi.ts` (`useInventory`), `services/api.ts` e as rotas
`aura-backend/src/app/api/inventory/*` + a lógica de dedução automática em
`aura-backend/src/app/api/appointments/[id]/status/route.ts`.

## Funcionalidades identificadas

1. **Listagem de itens de estoque** em tabela, carregada via `loadInventory()` (lazy, `inventoryApi.list({ limit: 100 })`, sem paginação real na UI).
2. **Busca por nome** (`searchTerm`, client-side sobre o array já carregado) e **filtro "Estoque Baixo"** (`filterLowStock`, também client-side: `currentStock <= minStock`).
3. **KPIs no topo** ("Total de Itens", "Estoque Crítico", "Valor em Estoque") — calculados 100% no frontend (`reduce`/`filter` sobre `inventory`), não usam o campo `summary` que o backend já calcula sobre todos os itens ativos da empresa.
4. **Criar item de estoque** (`InventoryModal` sem `initialData`): nome, unidade (select fixo: un/ml/g/cx/par/pct), custo unitário, estoque atual, estoque mínimo.
5. **Editar item de estoque** (mesmo modal, com `initialData`) — inclui reeditar `currentStock` **diretamente**, sem passar pela rota de ajuste auditado (ver "Problemas encontrados").
6. **Excluir item de estoque** — soft delete (`isActive: false`), com `confirm()` + `showAlert()` do `useDialog()` (segue o padrão do projeto, não usa `window.confirm`/`alert`).
7. **Importação em massa via planilha** (`ImportCSVModal` genérico + `inventoryApi.importCSV`): template com colunas `nome, unidade, custo, estoque, estoqueminimo`; cria ou atualiza (match por nome) linha a linha, com relatório de erros por linha.
8. **Ajuste manual de estoque com auditoria** (entrada/saída/perda/ajuste + motivo) — existe **rota de backend completa e testada** (`POST /api/inventory/[id]/adjust`) e até um hook pronto no frontend (`useInventory().adjustStock` em `hooks/useApi.ts`), mas **não há nenhum botão/tela que o utilize** — funcionalidade "fantasma" (ver "Problemas encontrados", item 1).
9. **Alerta de estoque baixo**: badge "Repor" na tabela, KPI "Estoque Crítico", filtro dedicado, e notificação (`AppNotification`) criada no backend em três lugares diferentes: `POST /adjust`, `deductStock` (baixa automática) — **mas não** em `PUT /api/inventory/[id]` (edição direta do item).
10. **Dedução automática de estoque ao concluir atendimento** — decidida inteiramente no backend, em `deductStock()` dentro de `PATCH /api/appointments/[id]/status`: ao mudar status para `COMPLETED` (e `appointment.stockDeducted === false`), decrementa `currentStock` de cada `ProcedureSupply` do procedimento, cria `StockMovement` (`type: OUT`) e cria alerta de estoque baixo se aplicável; também cria uma `Transaction` de despesa com o custo do procedimento e marca `appointment.stockDeducted = true`.
11. **Cálculo de custo total do estoque** — `sum(item.costPerUnit * item.currentStock)`, feito no frontend (`Inventory.tsx`) e também no backend (`GET /api/inventory`, campo `summary.totalValue`, sobre todos os itens ativos — não usado pelo frontend).

## Endpoints de backend usados

| Ação no frontend | Endpoint | Arquivo |
|---|---|---|
| Listar | `GET /api/inventory` | `aura-backend/src/app/api/inventory/route.ts` |
| Criar | `POST /api/inventory` | idem |
| Editar (inclusive `currentStock` direto) | `PUT /api/inventory/[id]` | `aura-backend/src/app/api/inventory/[id]/route.ts` |
| Excluir (soft delete) | `DELETE /api/inventory/[id]` | idem |
| Ajustar estoque (auditado) — **sem UI que o chame** | `POST /api/inventory/[id]/adjust` | `aura-backend/src/app/api/inventory/[id]/adjust/route.ts` |
| Importar planilha | `POST /api/inventory/import` | `aura-backend/src/app/api/inventory/import/route.ts` |
| (conectado) Completar agendamento → baixa automática | `PATCH /api/appointments/[id]/status` (função `deductStock`) | `aura-backend/src/app/api/appointments/[id]/status/route.ts` |

Validação Zod em `aura-backend/src/lib/validations/inventory.ts` (`createInventoryItemSchema`, `updateInventoryItemSchema = .partial()`, `stockAdjustmentSchema`, `listInventoryQuerySchema`). `unit` é `z.string().min(1).max(10)` — sem `enum`.

## Cobertura de testes atual

### Backend

Cobertura já é **boa nas 4 rotas dedicadas de estoque**, confirmadas em `aura-backend/src/__tests__/api/`:

- `inventory.test.ts` — 10 testes: `GET` (401, 403 sem empresa, 400 parâmetros inválidos, filtro `lowStock=true` em memória, cálculo de `summary`) e `POST` (401, 403 não-admin, 400 estoque negativo, criação + movimento inicial `IN` quando `currentStock > 0`, sem movimento quando `currentStock = 0`).
- `inventory-adjust.test.ts` — 12 testes: 401, 403, 404, 400 quantidade zero, soma `IN`, subtrai `OUT`, **400 quando o ajuste deixaria o estoque negativo**, `ADJUSTMENT` negativo dentro do limite, movimento registrado em valor absoluto, `Activity` de auditoria com estoque anterior/novo, notificação de estoque baixo criada quando `newStock <= minStock`, notificação **não** criada quando fica acima do mínimo.
- `inventory-import.test.ts` — 12 testes: sucesso, update por nome existente, nome ausente, unidade ausente, custo inválido, custo em formato BR (`45,00`), estoque/estoque mínimo padrão quando ausentes, coluna obrigatória ausente, CSV vazio, 401, 403 (RECEPTIONIST), mistura de linhas válidas/inválidas.
- `inventory-id.test.ts` — 10 testes: `PUT` (401, 403 RECEPTIONIST, 404 outra empresa, 400 estoque negativo, atualização com sucesso, 500 genérico em falha de banco) e `DELETE` (401, 403, 404, soft delete `isActive:false` confirmado — **não apaga de verdade**).

Total: **44 testes dedicados às 4 rotas de estoque**, cobrindo bem validação, permissão (RBAC), estoque negativo bloqueado no ajuste manual, e soft delete.

Adicionalmente, `appointments-status.test.ts` cobre parte da **dedução automática de estoque** (função `deductStock`, ligada a `COMPLETED`), dentro de um total de 17 testes da rota de status:
- `'COMPLETED deduz estoque quando stockDeducted=false'` — confirma `inventoryItem.update` chamado com `{ decrement: quantityUsed }` e `stockMovement.create` chamado.
- `'COMPLETED não deduz estoque quando stockDeducted=true'` — idempotência quando já deduzido.
- `'cria alerta de estoque baixo quando currentStock ≤ minStock após dedução'`.
- `'COMPLETED cria transação de DESPESA para custo de insumos'` (relacionado, mas é a `Transaction`, não o estoque em si).

**Lacunas identificadas no backend:**
- Nenhum teste cobre `deductStock` deixando o estoque **negativo** (ex.: `currentStock=1`, `quantityUsed=5`) — o código não bloqueia isso (ver "Problemas encontrados", item 2), e não há teste documentando o comportamento atual.
- Nenhum teste cobre falha parcial dentro do loop de `deductStock` (múltiplos supplies, um deles falhando) — relevante porque a função não usa `prisma.$transaction` (ver item 3).
- Nenhum teste de concorrência/race condition em `POST /api/inventory/[id]/adjust` (leitura de `currentStock` fora da transação — ver item 4).
- Nenhum teste de `PUT /api/inventory/[id]` cobrindo atualização parcial que **não** envia `currentStock` (comportamento do `.partial()` do Zod).

### Frontend

**Confirmado: não existe nenhum teste de página/componente.** Os únicos arquivos em `__tests__/` são `context/AppContext.test.tsx` e `services/api.test.ts` — nada em `__tests__/pages/` ou `__tests__/components/`.

Cobertura indireta já existente (não testa a página nem o modal):
- `AppContext.test.tsx` → `describe('AppContext > updateInventoryItem / removeInventoryItem')` e `describe('AppContext > addInventoryItem')`: 6 testes cobrindo que `addInventoryItem`/`updateInventoryItem`/`removeInventoryItem` chamam a API correta e propagam erro (regressão "não finge sucesso") em vez de mascarar falha.
- `api.test.ts`: 2 testes cobrindo `inventoryApi.importCSV` (envia `FormData` para `/api/inventory/import`; propaga erro HTTP).

**Não testado (gap real):**
- `pages/Inventory.tsx` inteiro — renderização, busca, filtro "Estoque Baixo", badge "Repor", cálculo de KPIs, estado vazio, loading skeleton, comportamento de `isReadOnly` nos botões.
- `InventoryModal` (dentro de `components/Modals.tsx`) — criação, edição (incluindo o fato de que edição altera `currentStock` diretamente), conversão de strings para número (`Number(...) || 0`), tratamento de erro via `showInventoryAlert`.
- `useInventory()` (`hooks/useApi.ts`) — hook morto (não importado em lugar nenhum do app), inclusive `adjustStock`, que é a única porta de entrada de frontend para a rota `/adjust` já testada e pronta no backend.
- `ImportCSVModal` com o wiring específico de Estoque (`templateHeaders`, `onImport={inventoryApi.importCSV}`, `onSuccess={() => loadInventory(true)}`).

### E2E

**Confirmado: nenhum spec cobre Estoque.** Os specs existentes (`dashboard.spec.ts`, `login.spec.ts`, `forgot-password.spec.ts`, `public-booking.spec.ts`, `register.spec.ts`, `whatsapp-settings.spec.ts`) não mencionam estoque/inventory em nenhum ponto (`grep` por "inventory|estoque" não retornou nada em `e2e/`).

## Problemas encontrados durante a revisão

1. **Funcionalidade de ajuste manual auditado é inacessível pela UI ("recurso fantasma").** `POST /api/inventory/[id]/adjust` está implementada, protegida por role, testada com 12 casos no backend, e até tem um hook pronto (`useInventory().adjustStock`) — mas `useInventory()` não é chamado em nenhum componente/página do app. Na prática, a única forma de mudar `currentStock` pela UI é reabrir o item no `InventoryModal` e editar o campo "Estoque Atual" via `PUT /api/inventory/[id]`, que **não** cria `StockMovement`, **não** cria `Activity` de auditoria e **não** dispara notificação de estoque baixo — ou seja, a trilha de auditoria que a rota `/adjust` foi desenhada para garantir nunca é usada na prática, e toda alteração manual de estoque hoje é "silenciosa".

2. **Dedução automática de estoque (`deductStock`) não bloqueia estoque negativo.** Diferente da rota manual `/adjust` (que retorna 400 "Estoque insuficiente" se o resultado for negativo), `deductStock()` em `appointments/[id]/status/route.ts` usa `prisma.inventoryItem.update({ data: { currentStock: { decrement: supply.quantityUsed } } })` sem nenhuma checagem prévia. Completar vários agendamentos que consomem o mesmo insumo além do estoque disponível deixa `currentStock` negativo silenciosamente — só dispara a notificação de "estoque baixo" (que também dispararia com valor negativo), sem indicar que o valor ficou negativo nem impedir a conclusão do atendimento.

3. **Falha parcial em `deductStock` não é transacional — risco de dupla dedução em retry.** A função itera os `supplies` do procedimento com `await` sequenciais, sem `prisma.$transaction`. Se o processamento de um supply falhar no meio do loop (ex.: erro de conexão), a exceção sobe até o `catch` externo da rota, que retorna 500 **antes** de `appointment.update({ data: { stockDeducted: true, status } })` ser executado. Como `appointment.status` continua o valor antigo (`CONFIRMED`) e `stockDeducted` continua `false`, uma nova tentativa de completar o mesmo agendamento roda `deductStock` de novo, deduzindo os insumos já deduzidos parcialmente **uma segunda vez**.

4. **Condição de corrida (race condition) em `POST /api/inventory/[id]/adjust`.** `currentStock` é lido via `findFirst` **fora** da transação; `newStock` (valor absoluto já calculado) é então gravado dentro de `prisma.$transaction`. Não é usado `{ increment }`/`{ decrement }` atômico do Prisma nem controle de versão otimista. Dois ajustes concorrentes no mesmo item (dois admins ajustando ao mesmo tempo, ou um ajuste manual concorrendo com uma baixa automática do `deductStock` no mesmo insumo) podem ler o mesmo `currentStock` inicial e um dos dois updates "vencer", perdendo o outro ajuste silenciosamente (lost update).

5. **Nenhuma proteção de role no frontend para a tela de Estoque (defesa em profundidade ausente).** `isReadOnly` (usado para desabilitar "Novo Item"/"Importar"/Editar/Excluir em `Inventory.tsx`) reflete apenas status de assinatura (`subscriptionExpiresAt`/plano `basic` vencido) — **não depende do `role` do usuário**. A rota `/inventory` em `App.tsx`/`PrivateLayout` também não tem checagem de role própria; só o item de menu é escondido para `RECEPTIONIST`/`ESTHETICIAN` via `roles: [ADMIN, OWNER]` no `Sidebar`. Um usuário `RECEPTIONIST`/`ESTHETICIAN` que navegue direto para `/inventory` pela URL vê todos os botões de mutação habilitados e só descobre que não tem permissão ao submeter (erro 403 do backend). O backend está correto; é uma lacuna de UX/defesa em profundidade no frontend.

6. **Unidade de medida (`unit`) sem enum — inconsistência potencial entre cadastro manual, importação e supplies de procedimento.** O schema Zod (`createInventoryItemSchema`) aceita qualquer string de 1 a 10 caracteres para `unit`; o modelo Prisma também não usa `enum`. O `InventoryModal` oferece um `<select>` fixo (un/ml/g/cx/par/pct), mas a importação em massa (`POST /api/inventory/import`) aceita **qualquer texto** digitado na coluna "unidade" sem normalizar (`"ML"`, `"Ml"`, `"mls"` seriam todos aceitos como estão). Além disso, `ProcedureSupply.quantityUsed` não tem campo de unidade próprio — assume implicitamente a mesma unidade do `InventoryItem` vinculado, sem nenhuma validação cruzada.

7. **KPIs e filtros da tela de Estoque são calculados sobre uma página parcial, não sobre o total real da empresa.** `AppContext.loadInventory()` chama `inventoryApi.list({ limit: 100 })` uma única vez, sem paginação real na UI, e **ignora completamente** o campo `summary` que o backend já calcula corretamente sobre todos os itens ativos (`GET /api/inventory` → `summary.totalItems`, `summary.lowStockCount`, `summary.totalValue`). `pages/Inventory.tsx` recalcula tudo no frontend a partir do array truncado em 100 itens. Uma empresa com mais de 100 itens de estoque ativos veria KPIs ("Total de Itens", "Estoque Crítico", "Valor em Estoque") incompletos/errados, silenciosamente, sem nenhum indicador de paginação na tela.

8. **(Menor) Contrato de tipo divergente do retorno real da API.** `inventoryApi.list` em `services/api.ts` declara `summary: { total: number; lowStock: number }`, mas o backend retorna `summary: { totalItems, lowStockCount, totalValue }`. Hoje é inofensivo porque nada no frontend lê `summary` (consequência do item 7), mas o tipo está errado e enganaria qualquer implementação futura que tentasse usá-lo.

9. **(Menor) Expressão redundante em `isReadOnly`.** `isExpired || (isBasic && isExpired)` em `AppContext.tsx` é logicamente equivalente a apenas `isExpired` — não é um bug funcional, mas é código morto/confuso que sinaliza uma correção incompleta em algum momento anterior.

## Testes recomendados

### Alta prioridade

1. **[Backend Vitest]** `deductStock` decrementando um insumo cujo `currentStock` é menor que `quantityUsed` (ex.: `currentStock=1`, `quantityUsed=5`) e confirmando que o resultado atual **não bloqueia** nem avisa que ficou negativo — teste de regressão documentando o "Problema 2", servindo de guarda até uma correção ser decidida. Arquivo: `aura-backend/src/__tests__/api/appointments-status.test.ts`.
2. **[Backend Vitest]** Simular falha no meio do loop de `deductStock` (procedimento com 2+ `supplies`, o segundo `inventoryItem.update` rejeitando) e confirmar que o primeiro insumo já foi decrementado, a rota retorna 500 e `appointment.stockDeducted` permanece `false` — documenta o risco de dupla dedução em retry ("Problema 3"). Mesmo arquivo.
3. **[Backend Vitest]** `POST /api/inventory/[id]/adjust` — simular duas chamadas concorrentes no mesmo item (mocks retornando o mesmo `currentStock` inicial para ambas as leituras via `findFirst`) e verificar que o resultado final reflete só um dos ajustes (lost update) — cobre a race condition do "Problema 4". Arquivo: `aura-backend/src/__tests__/api/inventory-adjust.test.ts` (novo `describe` de concorrência).
4. **[Frontend Vitest+RTL]** `pages/Inventory.tsx` — renderização da lista a partir de `useApp().inventory` mockado, busca por nome, toggle "Estoque Baixo" (`filterLowStock`), badge "Repor" em itens com `currentStock <= minStock`, e cálculo correto dos 3 KPIs. Arquivo sugerido: `__tests__/pages/Inventory.test.tsx`.
5. **[Frontend Vitest+RTL]** `pages/Inventory.tsx` — fluxo de exclusão: `confirm()` cancelado não chama `removeInventoryItem`; confirmado com erro da API chama `showAlert(result.error)`; confirmado com sucesso remove o item da lista renderizada. Mesmo arquivo.
6. **[E2E Playwright]** Fluxo completo de CRUD de estoque como ADMIN: login → Estoque → criar item → editar (alterar estoque mínimo) → aplicar filtro "Estoque Baixo" → excluir item → confirmar atualização da lista. Arquivo sugerido: `e2e/inventory.spec.ts`.
7. **[Frontend Vitest+RTL]** `InventoryModal` em modo edição — teste de regressão documentando explicitamente que alterar "Estoque Atual" chama `updateInventoryItem(id, { currentStock: novoValor, ... })` (via `PUT`), **sem** passar pela rota `/adjust` — serve de guarda para decidir conscientemente se esse campo deve ser removido/substituído por um botão de ajuste auditado (cobre o "Problema 1"). Arquivo: `__tests__/components/Modals.InventoryModal.test.tsx`.

### Média prioridade

8. **[Frontend Vitest+RTL]** `InventoryModal` — criação: submit converte campos de texto para número (`Number(formData.x) || 0`) antes de chamar `addInventoryItem`; erro da API aciona `showInventoryAlert`. Mesmo arquivo do item 7.
9. **[Frontend Vitest+RTL]** `pages/Inventory.tsx` — comportamento com `isReadOnly=true` (assinatura vencida): botões "Novo Item"/"Importar" desabilitados visualmente e não abrem modal; botões Editar/Excluir não disparam ação (`handleEdit`/`handleDelete` retornam cedo).
10. **[Frontend Vitest+RTL]** `hooks/useApi.ts` — testar `useInventory()` (`fetchInventory`, `createItem`, `adjustStock`) diretamente, já que hoje é a única cobertura possível desse fluxo de ajuste enquanto ele não tiver UI própria — evita perder totalmente a cobertura se o hook for removido por "não usado" sem essa constatação.
11. **[Backend Vitest]** `POST /api/inventory/import` — importar duas linhas para o mesmo item existente com unidade em capitalizações diferentes ("ML" vs "ml") e documentar se o valor é normalizado ou mantido como veio na segunda importação — cobre o "Problema 6".
12. **[E2E Playwright]** Acessar `/inventory` autenticado como `RECEPTIONIST` via URL direta (sem passar pelo menu): confirmar que os botões de mutação aparecem habilitados e documentar o comportamento atual ao tentar criar/editar/excluir (erro 403 do backend) — cobre o "Problema 5" e guia uma decisão futura de bloquear a rota também no frontend.
13. **[Backend Vitest]** `PUT /api/inventory/[id]` — atualização parcial enviando somente `{ minStock: 10 }` (sem `currentStock`, `name`, etc.) e confirmando que os demais campos permanecem inalterados — cenário do `.partial()` não coberto explicitamente hoje.
14. **[Frontend Vitest+RTL]** `pages/Inventory.tsx` — cenário com `inventory` mockado tendo exatamente 100 itens (limite do `loadInventory`) e confirmando que os KPIs batem apenas com o array recebido, não com um total real maior — teste de regressão documentando o "Problema 7".

### Baixa prioridade

15. **[Frontend Vitest+RTL]** `ImportCSVModal` usado em Estoque — `onImport` chama `inventoryApi.importCSV(file)` e `onSuccess` chama `loadInventory(true)` (force reload) após importação bem-sucedida.
16. **[Backend Vitest]** `GET /api/inventory` — teste de contrato comparando o shape real de `summary` (`totalItems`, `lowStockCount`, `totalValue`) com o tipo `ApiInventoryItem`/retorno declarado em `services/api.ts`, para não deixar a divergência do "Problema 8" passar despercebida em uma futura refatoração que passe a consumir `summary`.
17. **[Backend Vitest]** `deductStock`/`appointments-status` — procedimento **sem nenhum `ProcedureSupply`** vinculado ao completar o agendamento: confirmar que nenhum `StockMovement`/notificação é criado e que o restante do fluxo (transação de despesa, `lastVisit`, mudança de status) continua funcionando normalmente.
