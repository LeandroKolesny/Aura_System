# Auditoria de Testes — Procedimentos

Escopo: aba "Procedimentos" (role ADMIN/OWNER), `pages/Procedures.tsx` + `NewProcedureModal` em
`components/Modals.tsx`, integração com `context/AppContext.tsx`, `services/api.ts` e as rotas
`aura-backend/src/app/api/procedures/*`.

## Funcionalidades identificadas

1. **Listagem de procedimentos** em cards (grid), com paginação implícita (`limit: 100` fixo no `loadProcedures`).
2. **Visualização condicional por role**: `ADMIN`/`OWNER` veem custo e margem de lucro (`showFinancials`); `PATIENT` não vê financeiro e, ao clicar no card, é navegado para a tela de agendamento (`/schedule` ou rota do portal do paciente) em vez de editar.
3. **Criar procedimento** (`NewProcedureModal` sem `initialData`): nome, descrição opcional, imagem opcional, preço de venda, duração (minutos), insumos, manutenção/retoque.
4. **Editar procedimento** (mesmo modal, com `initialData`) — clique no card (quando `canEdit`).
5. **Excluir procedimento** — botão na hover do card, com `confirm()` do `useDialog()` (não usa `window.confirm`, conforme padrão do projeto) e tratamento de erro via `showAlert()`.
6. **Upload de imagem do procedimento**: input de arquivo local (PNG/JPG/WEBP, máx. 2MB no frontend), compressão client-side via `<canvas>` (redimensiona para máx. 800px, `toDataURL('image/jpeg', 0.8)`) e o resultado (uma string **base64 `data:` URI**, não uma URL de storage) é enviado como campo `imageUrl` direto no JSON de criação/atualização — não existe endpoint de upload dedicado (diferente de outros módulos do sistema).
7. **Preço e duração**: validados no frontend (`doFinalSave`) como obrigatoriamente `> 0` (rejeita zero e negativo com mensagens "Preço inválido." / "Duração inválida.").
8. **Vínculo de insumos (supplies)** ao procedimento, de duas formas:
   - **Do estoque** (`inventory`): seleciona um item, informa quantidade, custo calculado automaticamente (`qty * item.costPerUnit`).
   - **Manual/custom**: nome livre + custo livre, sem vínculo a item de estoque (`inventoryItemId` ausente).
   - Cálculo de **custo total** (`totalCost`) somando `cost` de todos os supplies — feito inteiramente no frontend.
   - Cálculo de **margem de lucro** (`margin = price - cost`, `marginPercent = margin / price * 100`) — feito no `Procedures.tsx`, também só no frontend.
   - Fluxo de confirmação "esqueceu de adicionar o insumo preenchido?" (`showPendingConfirm`) antes de salvar.
9. **Manutenção automática**: checkbox `maintenanceRequired` + campo `maintenanceIntervalDays` (dias para retorno), usado depois pelo módulo de Marketing para sugerir retorno do paciente.
10. **Importação em massa via planilha** (`ImportCSVModal` genérico + `proceduresApi.importCSV`): template com colunas `nome, preco, duracaominutos, custo, descricao`; cria ou atualiza (match por nome) linha a linha, com relatório de erros por linha.
11. **Dedução de estoque ligada aos supplies do procedimento** (não fica na própria aba, mas é consequência direta do cadastro): ao completar um agendamento (`PATCH /api/appointments/[id]/status` → `COMPLETED`), o backend decrementa `currentStock` de cada `ProcedureSupply` do procedimento, registra `StockMovement` e cria alerta de estoque baixo — protegido por flag `stockDeducted` para não duplicar a baixa.

## Endpoints de backend usados

| Ação no frontend | Endpoint | Arquivo |
|---|---|---|
| Listar | `GET /api/procedures` | `aura-backend/src/app/api/procedures/route.ts` |
| Criar | `POST /api/procedures` | idem |
| Buscar por id | `GET /api/procedures/[id]` | `aura-backend/src/app/api/procedures/[id]/route.ts` |
| Editar | `PUT /api/procedures/[id]` | idem |
| Excluir | `DELETE /api/procedures/[id]` | idem |
| Importar planilha | `POST /api/procedures/import` | `aura-backend/src/app/api/procedures/import/route.ts` |
| (conectado) Completar agendamento → baixa de estoque | `PATCH /api/appointments/[id]/status` | `aura-backend/src/app/api/appointments/[id]/status/route.ts` |

Validação Zod em `aura-backend/src/lib/validations/procedure.ts` (`createProcedureSchema`, `updateProcedureSchema` = `.partial()`, `listProceduresQuerySchema`).

## Cobertura de testes atual

### Backend

Cobertura já é **extensa e boa** — confirmado que já existem 4 arquivos dedicados:

- `aura-backend/src/__tests__/api/procedures.test.ts` — 13 testes: `GET` (401, 403 sem empresa, 400 paginação inválida, filtro `isActive`, `isActive=all`, busca por nome/descrição, cálculo de paginação) e `POST` (401, 403 não-admin, 400 preço negativo, 400 item de estoque inexistente, criação sem insumos usando custo informado, cálculo de custo a partir dos insumos usando **o maior valor entre calculado e informado**).
- `aura-backend/src/__tests__/api/procedures-id.test.ts` — 15 testes: `GET` (401, 404 outra empresa, retorno com insumos), `PUT` (401, 403, 400 dados inválidos, 404, atualização sem alterar custo quando `supplies` não enviado, substituição de insumos + recálculo de custo), `DELETE` (401, 403, 404, **409 quando há agendamentos vinculados**, **409 quando vinculado a plano de assinatura**, remoção quando não há vínculos).
- `aura-backend/src/__tests__/api/procedures-import.test.ts` — 13 testes: sucesso, update por nome existente, nome ausente, preço inválido, preço em formato BR (`150,00`), duração inválida, duração padrão 60min, colunas obrigatórias ausentes (nome/preco), CSV vazio, 401, 403 (RECEPTIONIST), mistura de linhas válidas/inválidas.
- `aura-backend/src/__tests__/lib/validations/procedure.test.ts` — 18 testes: schema `createProcedureSchema`/`updateProcedureSchema`/`listProceduresQuerySchema`, incluindo explicitamente **"price zero → sucesso (procedimento cortesia é permitido)"**.

Total: **59 testes de backend** já cobrindo a maior parte dos cenários de validação, permissão e regras de negócio (inclusive bloqueio de exclusão por FK). Não encontrada nenhuma lacuna grande aqui, exceto:
- Nenhum teste cobre **nome duplicado** na criação/edição (porque a rota não valida isso — ver "Problemas encontrados").
- Nenhum teste cobre a rota de status de agendamento (`appointments/[id]/status`) do ponto de vista específico de **dedução de estoque a partir dos `supplies` do procedimento** — pode já estar coberta em algum arquivo de teste de agendamentos/estoque (não verificado neste escopo, mas vale conferir já que é a ponte Procedimentos↔Estoque).

### Frontend

**Confirmado: não existe nenhum teste de página/componente.** Os únicos arquivos em `__tests__/` são `context/AppContext.test.tsx` e `services/api.test.ts` — nenhum arquivo em `__tests__/pages/` ou `__tests__/components/`.

Dentro de `AppContext.test.tsx` já existe cobertura (boa, mas indireta — não testa a página nem o modal):
- `describe('AppContext > addProcedure / updateProcedure / removeProcedure')`: `addProcedure` chama a API e adiciona ao estado; propagação de erro (regressão) em vez de "fingir sucesso"; `updateProcedure` chama API e atualiza em memória + regressão de erro; `removeProcedure` chama API e remove da lista + regressão de erro (inclusive erro de "procedimento com agendamentos vinculados").

**Não testado (gap real):**
- `pages/Procedures.tsx` — renderização, permissões por role (`canEdit`, `showFinancials`, `isPatient`), clique no card (edição vs. navegação para agendamento), botão excluir + fluxo de `confirm()`/`showAlert()`, estado vazio, skeleton de loading.
- `NewProcedureModal` inteiro (dentro de `components/Modals.tsx`) — **nenhum teste**, incluindo lógica sensível calculada só no frontend:
  - Cálculo de `totalCost` a partir da lista de `supplies` (soma de custos de itens de estoque + itens manuais).
  - Cálculo de custo por item de estoque (`qty * invItem.costPerUnit`).
  - Validação de preço/duração `> 0` antes de salvar.
  - Fluxo de "insumo pendente não adicionado" (`showPendingConfirm`) — inclui/ignora o supply pendente.
  - Filtragem de `supplies` sem `inventoryItemId` antes de enviar ao backend (`AppContext.addProcedure`/`updateProcedure`) — os insumos manuais entram no `cost` mas não são persistidos como linha (ver problema abaixo).
  - Upload/compressão de imagem (canvas, limite de 2MB, tipos aceitos).
- Cálculo de **margem de lucro** em `Procedures.tsx` (`margin = price - cost`, `marginPercent = margin / price * 100`) — lógica de exibição financeira sensível, sem nenhum teste, e com bug potencial de divisão por zero (ver abaixo).
- `ImportCSVModal` (componente genérico usado por Procedimentos e outras telas) não tem nenhum teste próprio; o wiring específico de Procedimentos (`onImport={(file) => proceduresApi.importCSV(file)}`, headers do template, `onSuccess={() => loadProcedures(true)}`) também não é testado.

### E2E

**Confirmado: nenhum spec cobre Procedimentos.** Os specs existentes (`dashboard.spec.ts`, `login.spec.ts`, `forgot-password.spec.ts`, `public-booking.spec.ts`, `register.spec.ts`, `whatsapp-settings.spec.ts`) não mencionam procedimentos em nenhum ponto (`grep` por "rocedure|Procedimento" não retornou nada em `e2e/`).

## Problemas encontrados durante a revisão

1. **Inconsistência frontend x backend em preço zero ("cortesia")** — O backend suporta explicitamente procedimento com `price: 0` (schema permite `min(0)`, e há teste dedicado "price zero → sucesso (procedimento cortesia é permitido)"). Porém o modal do frontend (`doFinalSave` em `NewProcedureModal`) **bloqueia** qualquer preço `<= 0` com a mensagem "Preço inválido.", impedindo que o admin cadastre um procedimento cortesia/gratuito pela UI — um recurso que o backend foi desenhado para suportar fica inacessível.

2. **Divisão por zero na margem de lucro quando `price = 0`** — Em `pages/Procedures.tsx`: `marginPercent = (margin / proc.price) * 100`. Se algum procedimento com preço 0 existir (via import CSV, que aceita preço 0, ou via API direta), `marginPercent` vira `NaN` (`0/0`) e seria renderizado como "NaN%" no card, sem tratamento.

3. **Perda silenciosa de insumos manuais (custom supplies) ao reeditar um procedimento** — `AppContext.addProcedure`/`updateProcedure` filtram `proc.supplies?.filter(s => s.inventoryItemId)` antes de enviar ao backend — ou seja, insumos "manuais" (nome livre + custo livre, sem `inventoryItemId`) **contribuem para o `cost` total enviado, mas nunca são persistidos como `ProcedureSupply`** (o schema Zod de supply exige `inventoryItemId`). Consequência: ao reabrir o modal de edição, `initialData.supplies` vem só com os insumos de estoque (o backend só devolve os que persistiu); o insumo manual desaparece da lista visível. Se o admin salvar novamente sem re-adicionar o insumo manual, o `totalCost` recalculado (frontend) será menor, e o `cost` do procedimento cai silenciosamente na próxima atualização — sem aviso ao usuário. Isso é uma perda de dado + inconsistência de custo/margem que merece teste e provavelmente correção futura (fora do escopo desta auditoria).

4. **Duplicação de nome de procedimento na mesma empresa não é bloqueada** — Nem `createProcedureSchema`/`updateProcedureSchema`, nem as rotas `POST /api/procedures` e `PUT /api/procedures/[id]` verificam se já existe um procedimento com o mesmo `name` na mesma `companyId`; o modelo Prisma `Procedure` também não tem `@@unique([companyId, name])`. Comportamento atual: **duplicatas são permitidas silenciosamente**. Isso é diferente do fluxo de importação CSV, que usa o nome como chave de "match" para decidir criar vs. atualizar (`prisma.procedure.findFirst({ where: { name, companyId } })`) — ou seja, se já existirem 2 procedimentos com o mesmo nome (criados manualmente), a importação por CSV vai atualizar apenas o primeiro encontrado (`findFirst`), e o usuário não tem visibilidade disso. Não é necessariamente um bug (pode ser decisão de produto), mas o comportamento não está coberto por teste nem documentado — deveria ser, no mínimo, para não ser "corrigido" incidentalmente sem avaliação de impacto no import.

5. **Exclusão de procedimento vinculado a agendamento** — **Já tratado corretamente** pelo backend (bloqueia com 409, com contagem de agendamentos vinculados, e também bloqueia se vinculado a item de plano de assinatura) — comportamento correto e já coberto por teste no backend. Citado aqui apenas para registrar que essa checagem **não é validada em nenhum teste de frontend/E2E** (ex.: o usuário realmente vê a mensagem de erro correta no card ao tentar excluir).

6. **Imagem como base64 embutido no JSON, sem endpoint de upload dedicado** — `imageUrl` recebe uma string `data:image/jpeg;base64,...` (após compressão canvas) e é enviada dentro do corpo JSON de `POST`/`PUT /api/procedures`. Isso é o mesmo padrão de payload (base64 grande dentro de JSON) que já causou o bug corrigido recentemente no commit `59bb78b` ("fix: corrige upload de foto antes/depois sempre falhando com 400 em produção") para fotos de antes/depois. Vale confirmar que o limite de body configurado no Next.js/Vercel comporta imagens comprimidas de até ~2MB (o limite do frontend) em produção — não há teste de backend cobrindo `imageUrl` como data URI grande, nem teste de regressão específico para esse padrão de payload.

7. **`Math.max(calculatedCost, procedureData.cost)` no backend** — tanto em `POST` quanto em `PUT`, o backend usa o **maior valor** entre o custo calculado a partir dos insumos de estoque e o custo enviado pelo frontend. Isso está coberto por teste, mas o efeito colateral é: um admin não consegue **reduzir** o custo total abaixo do valor calculado pelos insumos vinculados ao estoque, mesmo que isso seja intencional (ex.: desconto de fornecedor). Comportamento provavelmente intencional (evitar subestimar custo), mas não documentado como tal — registrar aqui para não ser confundido com bug em auditorias futuras.

## Testes recomendados

### Alta prioridade

1. **[Frontend Vitest+RTL]** `NewProcedureModal` — bloqueia submissão com preço `0` ou negativo, exibindo "Preço inválido.", e bloqueia duração `0`/negativa com "Duração inválida." — arquivo sugerido: `__tests__/components/Modals.NewProcedureModal.test.tsx`.
2. **[Frontend Vitest+RTL]** `NewProcedureModal` — cálculo de `totalCost`/`cost` enviado ao salvar: adicionar 1 insumo de estoque (calcula `qty * costPerUnit`) + 1 insumo manual, confirmar que `cost` final enviado a `addProcedure` é a soma correta — mesmo arquivo acima.
3. **[Frontend Vitest+RTL]** `NewProcedureModal` — reabrir modal em modo edição (`initialData` com `supplies` só de estoque) e confirmar que insumos manuais adicionados anteriormente não aparecem mais e que resalvar sem reconferir o custo reduz o `cost` enviado — teste de regressão documentando o "Problema 3" acima.
4. **[Frontend Vitest+RTL]** `Procedures.tsx` — card de procedimento com `price = 0`: verificar que a margem exibida não quebra a UI (hoje resultaria em `NaN%`) — teste de regressão para o "Problema 2"; se a correção não for aplicada, o teste deve pelo menos documentar o comportamento atual explicitamente (`toBe('NaN%')` ou o texto renderizado) para não regredir silenciosamente pior.
5. **[Backend Vitest]** `POST /api/procedures` e `PUT /api/procedures/[id]` — criar/editar dois procedimentos com o **mesmo `name`** na mesma `companyId` e confirmar (documentar) que ambos são aceitos sem erro — cobre o "Problema 4" (duplicidade não bloqueada) e serve de guarda de regressão caso decidam adicionar validação de unicidade depois — arquivo: `aura-backend/src/__tests__/api/procedures.test.ts` (ou novo `procedures-duplicate-name.test.ts`).
6. **[E2E Playwright]** Fluxo completo de CRUD de procedimento como ADMIN: login → Procedimentos → criar procedimento com insumo de estoque vinculado → editar preço → excluir com sucesso (procedimento sem agendamentos) — arquivo sugerido: `e2e/procedures.spec.ts`.
7. **[E2E Playwright]** Tentativa de excluir procedimento **com agendamento vinculado**: deve exibir o erro 409 do backend via `showAlert` (mensagem "Não é possível excluir: este procedimento possui N agendamento(s) vinculado(s).") e o procedimento deve permanecer na lista — mesmo arquivo acima; cobre ponta a ponta o "Problema 5".

### Média prioridade

8. **[Frontend Vitest+RTL]** `Procedures.tsx` — permissões por role: `PATIENT` não vê custo/margem (`showFinancials=false`) e clique no card navega para agendamento em vez de abrir modal de edição; `RECEPTIONIST`/`ESTHETICIAN` (se acessarem a tela) não veem botões de criar/editar/excluir (`canEdit=false`).
9. **[Frontend Vitest+RTL]** `Procedures.tsx` — clique em excluir chama `confirm()`; se usuário cancela, `removeProcedure` não é chamado; se confirma e a API retorna erro, `showAlert` é chamado com a mensagem de erro (ex.: "possui agendamentos vinculados").
10. **[Frontend Vitest+RTL]** `NewProcedureModal` — checkbox "Requer Manutenção/Retoque": ao marcar, campo de dias aparece com default 120; ao desmarcar antes de salvar, `maintenanceIntervalDays` não é enviado (`undefined`) mesmo que o campo tenha sido preenchido antes.
11. **[Frontend Vitest+RTL]** `NewProcedureModal` — fluxo de "insumo pendente" (`showPendingConfirm`): preencher campos de insumo manual/estoque sem clicar em "+", submeter o formulário, confirmar que aparece o aviso, e testar os dois caminhos ("incluir e salvar" vs "salvar sem ele") verificando o `cost` final em cada caso.
12. **[Frontend Vitest+RTL]** `NewProcedureModal` — upload de imagem: arquivo > 2MB dispara `showAlert` de erro e não altera `imageUrl`; arquivo válido gera preview e permite remover (`setImageUrl('')`).
13. **[Backend Vitest]** `POST /api/procedures/import` — linha com `preco` igual a `"0"` é aceita (courtesy) — hoje coberto implicitamente pelo `parseDecimal` (`num < 0` retorna null, então 0 passa), mas não há teste explícito para esse caso específico de preço zero via import, que reforça a inconsistência do "Problema 1" por outra via de entrada.
14. **[Backend Vitest]** `PUT /api/procedures/[id]` — enviar `supplies: []` explicitamente deve remover todos os insumos vinculados e zerar/recalcular `cost` para 0 (a não ser que `cost` enviado seja maior) — cenário de "remover todos os insumos" não parece coberto explicitamente nos testes atuais (só "substitui os insumos e recalcula").
15. **[Frontend Vitest+RTL]** `Procedures.tsx` — estado vazio ("Nenhum procedimento cadastrado.") e skeleton de loading (`ProceduresSkeleton`) quando `loadingStates.procedures && procedures.length === 0`.

### Baixa prioridade

16. **[Frontend Vitest+RTL]** `ImportCSVModal` usado em Procedimentos — verificar que `onImport` chama `proceduresApi.importCSV(file)` e `onSuccess` chama `loadProcedures(true)` (force reload) após importação bem-sucedida.
17. **[E2E Playwright]** Importação de planilha de procedimentos via UI (upload do template preenchido) e verificação do resumo de importados/atualizados/erros exibido na tela.
18. **[Backend Vitest]** `GET /api/procedures` — confirmar que `include.supplies.inventoryItem` nunca vaza itens de estoque de outra empresa (teste de isolamento multi-tenant no relacionamento aninhado, já que o filtro principal é só em `companyId` do procedimento, não do insumo).
19. **[Backend Vitest]** Adicionar teste (se ainda não existir em `appointments`/`inventory`) para `deductStock()` em `appointments/[id]/status/route.ts`: completar o mesmo agendamento duas vezes não duplica a baixa de estoque (guarda por `stockDeducted`), e transição para `COMPLETED` cria a transação de despesa "Custo Insumos" apenas quando `procedure.cost > 0`.
20. **[Frontend Vitest+RTL]** `Procedures.tsx` — card com `proc.imageUrl` definido aplica estilos de overlay/texto branco corretamente vs. card sem imagem (teste de snapshot/classe, baixo valor mas rápido de escrever).
