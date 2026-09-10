# Auditoria de Testes — Suporte

## Funcionalidades identificadas

Arquivo principal: `pages/Support.tsx`. Lógica de dados em `context/AppContext.tsx` (funções `createTicket`, `replyTicket`, `closeTicket`, estado `tickets`). Cliente HTTP em `services/api.ts` (`ticketsApi`).

1. **Abrir novo ticket** — formulário (assunto + mensagem) visível só para não-OWNER (`isOwner` esconde o botão "Novo Chamado"). Chama `createTicket()` → `ticketsApi.create()` → `POST /api/tickets`.
2. **Responder ticket existente** — input de mensagem no rodapé do chat, visível apenas quando `selectedTicket.status === 'open'`. Chama `replyTicket()` → `ticketsApi.reply()` → `PATCH /api/tickets` com `{ ticketId, message }`.
3. **Encerrar ticket** — botão "Encerrar" visível apenas quando `status === 'open'`. Chama `closeTicket()` → `ticketsApi.close()` → `PATCH /api/tickets` com `{ ticketId, status: 'CLOSED' }`.
4. **Ver status do ticket** (aberto/fechado) — badge visual na lista e no cabeçalho do ticket selecionado. Puramente derivado do campo `status` já carregado em memória (não há chamada de API dedicada).
5. **Listar histórico de tickets da empresa** — sidebar esquerda lista `tickets` do contexto, filtrados por `companyId` do usuário (exceto OWNER, que vê todas as empresas, com nome da empresa exibido). **Ver bug crítico abaixo: essa listagem nunca é populada a partir do backend.**
6. **Visão OWNER (King)** — a mesma página `Support.tsx` é reutilizada para `UserRole.OWNER`: esconde o botão "Novo Chamado", mostra o nome da empresa em cada ticket/mensagem e rotula o remetente `isAdmin` como "{SAAS_COMPANY_NAME} (Suporte)". Não existe uma tela separada em `pages/king/` para atendimento de suporte — é a mesma rota/componente para os dois papéis. (Fora do escopo principal deste relatório, mas mencionado para contexto: não há endpoint/rota de suporte fora de `/api/tickets`.)
7. **Bloqueio por plano** — `checkModuleAccess('support')` controla acesso à aba inteira via `UpgradeOverlay` (módulo `support` está sempre visível conforme `Sidebar.tsx`, mas o conteúdo é bloqueado se o plano não incluir o módulo).

## Endpoints de backend usados

- `GET /api/tickets` (`aura-backend/src/app/api/tickets/route.ts`) — lista tickets, com `where.companyId = user.companyId` para não-OWNER; aceita `status` e `limit` como query params. **Confirmado: esta rota nunca é chamada pelo frontend** (`ticketsApi.list()` existe em `services/api.ts` mas não é referenciado em nenhum lugar do código de produção — apenas declarado).
- `POST /api/tickets` — cria ticket + primeira mensagem (`isAdmin: false`). Passa por `checkWriteAccess(user)` (bloqueio de plano/limite de escrita).
- `PATCH /api/tickets` — rota única que trata tanto resposta (`message`) quanto mudança de status (`status`), condicionalmente. Marca `isAdmin: user.role === "OWNER"`. **Não chama `checkWriteAccess`** e **não valida `companyId` do ticket contra o usuário** (ver "Problemas encontrados").

## Cobertura de testes atual

### Backend
`aura-backend/src/__tests__/api/tickets.test.ts` — único arquivo, 15 testes, cobrindo diretamente `GET`/`POST`/`PATCH` de `route.ts`:
- `GET`: 401 sem auth; escopo por `companyId` para não-OWNER; OWNER vê todas as empresas; filtro de `status` normalizado para maiúsculas. (4 testes)
- `POST`: 401 sem auth; bloqueio por `checkWriteAccess` (plano); 400 quando falta assunto/mensagem; criação correta com `isAdmin=false`. (4 testes)
- `PATCH`: 401 sem auth; 400 sem `ticketId`; mensagem com `isAdmin=false` para usuário comum; `isAdmin=true` para OWNER; atualização de status normalizado; nenhuma ação quando não há `message` nem `status`; retorno do ticket atualizado. (7 testes)

**O que NÃO está coberto:**
- Nenhum teste verifica isolamento entre empresas no `PATCH` (responder ou fechar ticket de outra empresa) — condizente com o fato de a própria rota não ter essa checagem (ver bug).
- Nenhum teste verifica que um ticket com `status: CLOSED` recusa novas mensagens (a rota aceita incondicionalmente).
- Nenhum teste cobre `GET` combinando `companyId` de não-OWNER **e** `status` ao mesmo tempo, nem `limit`.
- Nenhum teste verifica 404/erro quando `ticketId` não existe (o `PATCH` prossegue e falha silenciosamente ou retorna `ticket: null`).
- Nenhum teste verifica que `PATCH` deveria (ou não) respeitar `checkWriteAccess` para respostas.

### Frontend
- `__tests__/context/AppContext.test.tsx`: cobre `createTicket` (sucesso e erro de negócio), `replyTicket` (sucesso e erro de negócio), e `closeTicket` **apenas** o caso de erro de conexão (regressão de "fingir sucesso"). **Não há teste de sucesso para `closeTicket`**, nem qualquer teste de `ticketsApi.list` (consistente com o fato de nunca ser chamado).
- `__tests__/services/api.test.ts`: **zero** menções a `ticket`/`ticketsApi` — nenhuma cobertura direta do cliente HTTP de tickets.
- Não existe nenhum arquivo de teste para `pages/Support.tsx` (confirmado — não há `__tests__/pages/Support*` nem qualquer RTL test do componente). Confirma o que a tarefa já esperava: zero testes de página/componente no projeto todo além dos dois arquivos citados no contexto.

### E2E
Specs existentes em `e2e/`: `dashboard.spec.ts`, `login.spec.ts`, `forgot-password.spec.ts`, `public-booking.spec.ts`, `register.spec.ts`, `whatsapp-settings.spec.ts`. **Nenhum cobre a aba Suporte/tickets.**

## Problemas encontrados durante a revisão

1. **[CRÍTICO — funcional] O histórico de tickets nunca é carregado do backend.** `ticketsApi.list()` está implementado em `services/api.ts` mas não é chamado em nenhum lugar de `AppContext.tsx` (nem em nenhum outro arquivo do projeto — confirmado via busca global). O estado `tickets` começa como `[]` e só é populado localmente quando o próprio usuário cria um ticket na sessão atual (`createTicket` faz `setTickets(prev => [ticket, ...prev])`). Isso significa que, ao recarregar a página, trocar de aba e voltar, ou logar de outro dispositivo/sessão, **a lista de tickets aparece vazia mesmo havendo tickets abertos no banco**, tanto para ADMIN quanto para OWNER. Isso invalida na prática a funcionalidade "listar histórico de tickets da empresa" e a visão do OWNER sobre chamados de todas as clínicas.

2. **[CRÍTICO — segurança/isolamento] `PATCH /api/tickets` não valida que o ticket pertence à empresa do usuário.** Ao contrário do `GET` (que filtra por `companyId`) e do `POST` (que grava `companyId: user.companyId!`), o handler `PATCH` (responder mensagem e/ou fechar ticket) apenas verifica autenticação (`getAuthUser`) e não confere se `ticket.companyId === user.companyId` antes de criar a `ticketMessage` ou atualizar o `status`. Qualquer usuário autenticado (ADMIN/RECEPTIONIST/ESTHETICIAN de **qualquer** empresa) que descubra ou adivinhe um `ticketId` de outra empresa pode responder ou encerrar esse ticket. Esse é exatamente o cenário de isolamento mencionado no escopo da tarefa.

3. **[MÉDIO — regra de negócio] Ticket fechado ainda aceita novas mensagens via API.** O frontend esconde o formulário de resposta quando `status === 'closed'`, mas o backend (`PATCH`) não verifica o status atual do ticket antes de criar uma nova `ticketMessage`. Um cliente HTTP direto (ou um bug futuro no frontend) pode enviar mensagem para um ticket já `CLOSED` sem qualquer bloqueio ou reabertura explícita do ticket.

4. **[BAIXO — inconsistência] `PATCH` não passa por `checkWriteAccess`.** `POST` (criar ticket) verifica `checkWriteAccess(user)` (bloqueio por plano), mas `PATCH` (responder/fechar) não. Pode ser intencional (permitir responder mesmo com plano vencido), mas não há teste nem comentário confirmando que é proposital.

5. **[BAIXO — cobertura de teste, não bug] Não há teste de sucesso para `closeTicket` no frontend.** Só existe o teste de regressão do erro de conexão; falta o caminho feliz (fechar com sucesso e refletir `status: 'closed'` no estado).

## Testes recomendados

### Alta prioridade
1. **[Backend/Vitest]** `aura-backend/src/__tests__/api/tickets.test.ts` — `PATCH /api/tickets`: usuário ADMIN da empresa `c1` tenta responder (`message`) um ticket cujo `companyId` é `c2` → deve retornar 403/404 e **não** chamar `prisma.ticketMessage.create`. Cobre o achado #2 (isolamento).
2. **[Backend/Vitest]** Mesmo arquivo — `PATCH /api/tickets`: usuário ADMIN da empresa `c1` tenta fechar (`status: 'CLOSED'`) um ticket de `companyId` `c2` → deve ser bloqueado e **não** chamar `prisma.ticket.update`. Cobre o achado #2.
3. **[Backend/Vitest]** Mesmo arquivo — `PATCH /api/tickets` com ticket já `status: 'CLOSED'` recebendo nova `message` → definir e testar o comportamento esperado (rejeitar com erro claro, ou permitir reabertura explícita) em vez do comportamento atual silencioso. Cobre o achado #3.
4. **[Frontend/Vitest+RTL]** Novo arquivo `__tests__/pages/Support.test.tsx` (ou similar) — mockar `useApp()` com uma lista de tickets no contexto (sem chamar API real) e assegurar que a lista de tickets é exibida corretamente ao montar a página. Este teste, ao ser escrito, tende a expor o achado #1 (o componente confia inteiramente no `tickets` do contexto, que hoje nunca é preenchido a partir do backend).
5. **[Frontend/Vitest]** `__tests__/context/AppContext.test.tsx` — adicionar teste garantindo que, ao carregar/logar, `ticketsApi.list()` é chamado e popula `tickets` no contexto (este teste **deve falhar hoje**, evidenciando o bug #1, até que a chamada seja implementada em `AppContext.tsx`).

### Média prioridade
6. **[Backend/Vitest]** `PATCH /api/tickets`: retorno 404 (ou tratamento explícito) quando `ticketId` não corresponde a nenhum ticket existente (hoje `prisma.ticket.findUnique` retornaria `null` e a rota devolveria `{ ticket: null }` com status 200).
7. **[Backend/Vitest]** `GET /api/tickets`: combinação de `status` + escopo por `companyId` para não-OWNER na mesma chamada (hoje os dois filtros são testados separadamente, nunca juntos).
8. **[Backend/Vitest]** `GET /api/tickets`: teste de `limit` (ex.: `?limit=5` deve passar `take: 5` para o Prisma) e valor padrão (`50`) quando omitido.
9. **[Frontend/Vitest]** `__tests__/context/AppContext.test.tsx` — adicionar caminho de sucesso para `closeTicket` (hoje só existe o teste de erro de conexão), verificando que `tickets` reflete `status: 'closed'` após chamada bem-sucedida.
10. **[Frontend/Vitest+RTL]** `Support.tsx` — teste de que o formulário de resposta e o botão "Encerrar" ficam ocultos quando `selectedTicket.status !== 'open'`, e que a mensagem "Este chamado foi encerrado." aparece.
11. **[Frontend/Vitest+RTL]** `Support.tsx` — teste de que, para `role !== OWNER`, o botão "Novo Chamado" aparece e abre o formulário de criação; para `role === OWNER`, o botão não aparece e o texto de cabeçalho muda para "Gerencie os chamados das clínicas."
12. **[E2E/Playwright]** Novo `e2e/support.spec.ts` — fluxo completo como ADMIN: login → navegar para `/support` → criar ticket com assunto/mensagem → verificar que aparece na lista com status "Aberto" → responder → encerrar → verificar badge "Fechado" e que a área de resposta desaparece.

### Baixa prioridade
13. **[Backend/Vitest]** `POST /api/tickets`: teste explícito de que o `companyId` do ticket criado é sempre `user.companyId`, mesmo que o corpo da requisição tente enviar outro `companyId` (payload não deveria ser aceito, mas vale confirmar que o campo é ignorado — hoje o código já usa `user.companyId!` fixo, então é um teste de regressão/proteção).
14. **[Backend/Vitest]** `PATCH /api/tickets`: decidir e testar explicitamente se deveria (ou não) chamar `checkWriteAccess` como o `POST` faz, documentando a decisão de produto (achado #4).
15. **[E2E/Playwright]** `support.spec.ts` — cenário de plano sem acesso ao módulo `support`: verificar que `UpgradeOverlay` é exibido em vez do conteúdo da aba.
16. **[Frontend/Vitest+RTL]** `Support.tsx` — teste de que mensagens do próprio usuário (`isMe`) e mensagens do suporte (`isSupport`/`isAdmin`) recebem estilos/alinhamentos diferentes (baixo risco, mas fácil de quebrar em refatoração de CSS).
