# Auditoria de Testes — Login, Layout e Dashboard do Painel King (Owner)

> Escopo: `pages/KingLogin.tsx`, `pages/king/KingLayout.tsx`, `pages/king/KingDashboard.tsx`, `aura-backend/src/app/api/king/dashboard/route.ts`, `aura-backend/src/lib/kingGuard.ts` (leitura/teste, sem reescrita) e a rota de autenticação usada pelo login King (`POST /api/auth/login`, compartilhada com o resto do sistema). 1ª de 4 tarefas sequenciais sobre o painel King — as demais abas (`KingCompanies`, `KingPatients`, `KingAppointments`, `KingLeads`, `KingAlerts`, `KingRevenue`, `KingSettings`) e suas rotas ficam para os próximos 3 agentes.

## Funcionalidades identificadas

### `pages/KingLogin.tsx` (rota pública `/king`)
1. Formulário de e-mail/senha que chama `login(email, password)` do `AppContext` — **a mesma função e a mesma rota `POST /api/auth/login`** usadas pelo login normal da clínica (`pages/Login.tsx`) e pelo login do paciente (`pages/patient-portal/PatientLogin.tsx`). Não existe uma rota de autenticação exclusiva do King no backend.
2. Estado de carregamento (`isLoading`): desabilita o botão e troca o texto para "Entrando..." com spinner.
3. Erro de credenciais inválidas (`login()` retorna `false`): exibe "Acesso negado. Verifique suas credenciais.".
4. Exceção na chamada de login (rede etc.): exibe "Erro ao tentar logar. Tente novamente.".
5. Botão de atalho "Preencher Credenciais (Dev)" (`fillDemo`) que preenche `king@aura.system` / `admin` — **sem nenhum gate de ambiente** (`import.meta.env.DEV` ou similar). Ver "Problemas encontrados" #4 (observação, não corrigido).
6. Redirecionamento pós-login e proteção contra acesso indevido — **era o ponto mais frágil da tela, corrigido nesta sessão** (ver #1 em "Problemas encontrados").
7. Link "Voltar para o site" (`/`).

### `pages/king/KingLayout.tsx` (layout de `/king/*`, exceto o próprio `/king`)
1. **Guarda de rota** (client-side): `isInitializing` → tela de loading "Verificando acesso..."; `!user` → `<Navigate to="/king" replace />`; `user.role !== OWNER` → `<Navigate to="/dashboard" replace />`. Confirmado: nunca fica em tela quebrada — sempre um destino definitivo assim que a sessão resolve.
   - **Importante**: este guard é só de UX/roteamento. A segurança real está no backend — cada rota `/api/king/*` chama `requireOwner()` independentemente do que o frontend decide renderizar.
2. Menu lateral (8 itens: Dashboard, Empresas, Pacientes, Agendamentos, CRM, Alertas, Receita, Configurações) com badge numérico no item "CRM" quando `newLeadsCount > 0`.
3. Sidebar duplicada propositalmente: uma fixa para desktop (`hidden lg:flex`) e um drawer para mobile (`lg:hidden`, com overlay e toggle via hambúrguer) — mesmo conteúdo renderizado duas vezes no DOM.
4. Rodapé do menu: nome/e-mail do usuário logado + botão "Sair" (`logout()` seguido de `navigate('/king')`).
5. **Dependia de dado nunca carregado nesta tela** (`newLeadsCount`) — corrigido nesta sessão (ver #2 em "Problemas encontrados").

### `pages/king/KingDashboard.tsx` (`/king/dashboard`)
1. Busca `kingApi.dashboard()` (`GET /api/king/dashboard`) uma vez ao montar; botão "Atualizar" refaz a chamada.
2. Estados: `loading` (spinner), `error` (card vermelho com o texto do erro + botão "Tentar novamente"), vazio (`!stats` → não renderiza nada), sucesso (KPIs).
3. 4 KPIs principais: MRR (`stats.mrr`), Clínicas Ativas (`ativas/total` + `% ativas`, protegido contra `totalCompanies === 0`), Total de Pacientes, Agendamentos Hoje (+ total geral).
4. Widget "novos leads aguardando" (condicional a `newLeadsCount > 0`, do `AppContext`, não da própria chamada da página) com botão "Ver CRM" → `navigate('/king/leads')`.
5. Distribuição por plano (`companiesByPlan`) com estado vazio "Nenhuma empresa cadastrada".
6. Card de "Receita Operacional do Mês" (`monthlyRevenue`).
7. Faixa estática "Sistema Operacional" com hora local do navegador (`toLocaleTimeString`) — não vem da API, é só decorativo.
8. Tratamento de erro em duas camadas: erro de transporte (`response.success === false`, ex.: 401/403/500) usa `response.error`; erro de negócio com HTTP 200 (`{success:true, data:{success:false, error}}`) usa `apiData.error`. Ambos os casos comunicam a mensagem ao usuário (sem `alert()`/`window.confirm`), em conformidade com o CLAUDE.md.

### `aura-backend/src/lib/kingGuard.ts` (`requireOwner`) — usado por TODAS as rotas `/api/king/*`
Matriz de decisão confirmada por leitura de código e travada em testes (`aura-backend/src/__tests__/lib/kingGuard.test.ts`, novo):

| Cenário | Resultado |
|---|---|
| Sem cookie/header de sessão (`getAuthUser` → `null`) | `401 { error: "Não autenticado" }` |
| Token presente mas inválido/expirado/`tokenVersion` divergente (idem, via `getAuthUser`) | `401 { error: "Não autenticado" }` |
| Usuário autenticado, `role !== "OWNER"` (ADMIN, RECEPTIONIST, ESTHETICIAN, PATIENT, ou até uma string vazia/`"owner"` minúsculo) | `403 { error: "Acesso restrito ao Owner" }` |
| Usuário autenticado, `role === "OWNER"` | Autorizado — `user` retornado, `response: null` |
| OWNER com `companyId` preenchido (cenário atípico/erro de dado) | **Ainda autorizado** — o guard nunca lê `companyId`; a rota de dashboard também não, pois as estatísticas são sempre globais. Nenhum risco identificado para esta rota. |

**Ponto forte confirmado (não é bug):** `requireOwner` nunca confia na claim `role` do JWT. `getAuthUser` (`aura-backend/src/lib/auth.ts:71-143`) sempre busca o usuário atual no Postgres por `payload.userId` e usa o `role`/`isActive`/`tokenVersion` **do banco**, não do token. Isso significa que um token antigo de um usuário promovido/rebaixado de role não engana o guard — a decisão é sempre baseada no estado atual do usuário. **Nenhum bug encontrado em `kingGuard.ts` — não foi necessário alterá-lo.**

## Endpoints de backend usados

| Método | Rota | Arquivo | Guard | Chamado por |
|---|---|---|---|---|
| GET | `/api/king/dashboard` | `aura-backend/src/app/api/king/dashboard/route.ts` | `requireOwner` | `kingApi.dashboard()` — único fetch de `KingDashboard.tsx` |
| POST | `/api/auth/login` | `aura-backend/src/app/api/auth/login/route.ts` | — (rota pública, com rate limit) | `login()` do `AppContext`, chamado por `KingLogin.tsx` (mesma rota do login normal e do paciente) |

`queryGlobalStats()` (`aura-backend/src/lib/queries/index.ts:195-305`) roda 6 queries em paralelo (`Promise.all`): contagem de empresas/ativas, pacientes, agendamentos totais/hoje, soma de transações `INCOME`/`PAID` do mês corrente, e a lista de empresas com plano+usuários (usada para MRR e distribuição por plano). MRR exclui empresas que tenham um usuário com role `OWNER` (conta interna, não paga).

## Cobertura de testes atual (antes desta sessão)

### Backend
- `king-dashboard.test.ts` já cobria: 200 com dados, chamada sem parâmetros, 401 sem auth, 403 para ADMIN, 500 em erro de query — **5 testes**, boa base, mas faltava: as demais roles não-OWNER (RECEPTIONIST/ESTHETICIAN/PATIENT), o edge case de OWNER com `companyId`, e uma checagem de que o 500 não vaza detalhe interno do erro.
- `kingGuard.ts` **não tinha nenhum teste unitário direto** — só era exercitado indiretamente pelos testes de `king-dashboard.test.ts` (que usam o `requireOwner` real, sem mock).

### Frontend
- **Nenhum teste existia** para `KingLogin.tsx`, `KingLayout.tsx` ou `KingDashboard.tsx` (confirmado: nenhum arquivo com "king" em `__tests__/` antes desta sessão).

## Problemas encontrados durante a revisão (corrigidos)

1. **[CORRIGIDO] `KingLogin.tsx`: login bem-sucedido com credenciais válidas de um papel diferente de OWNER navegava silenciosamente para `/king/dashboard`, sem nenhum aviso ao usuário.**
   Evidência (código original, `pages/KingLogin.tsx:20-40`): `handleLogin` chamava `navigate('/king/dashboard')` incondicionalmente sempre que `login()` retornava `true`, **sem checar o role** do usuário recém-autenticado (a função nem tinha como saber o role naquele ponto — só um `boolean`). Como `login()` é a mesma chamada usada em toda a aplicação, qualquer ADMIN/RECEPTIONIST/ESTHETICIAN/PATIENT com credenciais corretas conseguia "logar" a partir da tela do King.
   Consequência prática: o `KingLayout.tsx` acaba redirecionando esse usuário para `/dashboard` (nenhum dado do King é exposto — não é uma falha de RBAC de acesso a dado), mas a mensagem de erro "Acesso negado. Verifique suas credenciais." (pensada para credenciais erradas) **nunca aparecia** nesse caso — o usuário via a tela de login simplesmente sumir e ser trocada por outra, sem explicação. Isso viola a regra do `CLAUDE.md` ("todo erro deve ser comunicado ao usuário — nunca deixar uma ação falhar silenciosamente").
   Contraste com o padrão já estabelecido no próprio repositório: `pages/patient-portal/PatientLogin.tsx:26-56` **nunca navega direto no handler de submit** — delega 100% ao `useEffect` que, além de verificar o papel, mostra uma mensagem explícita e desloga quando a sessão não corresponde ao portal (`"Esta conta pertence a outra clínica..."`). `KingLogin.tsx` era a exceção inconsistente com esse padrão.
   **Correção aplicada** (`pages/KingLogin.tsx`): removida a navegação direta do `handleLogin`; adicionada uma flag `pendingRoleCheck` e um único `useEffect` que, ao ver o `user` atualizado após uma tentativa de login nesta tela: navega para `/king/dashboard` se `role === OWNER`; senão, define `loginError = 'Acesso restrito ao proprietário da plataforma.'` e chama `logout()`. Sessões pré-existentes de outro role que apenas *abrem* a tela (sem tentar logar aqui) continuam intocadas — mostram o formulário normalmente, sem deslogar ninguém (mesma cautela do `PatientLogin`).

2. **[CORRIGIDO] `KingLayout.tsx`/`KingDashboard.tsx`: o badge de "novos leads" do menu CRM e o widget "novos leads aguardando" do Dashboard dependiam de um dado (`leads`/`newLeadsCount` do `AppContext`) que só era carregado ao abrir a aba CRM — nunca ao logar ou abrir o Dashboard.**
   Evidência: `loadLeads` é definido em `context/AppContext.tsx:704-729`, mas em todo o frontend só é chamado em um único lugar: `pages/king/KingLeads.tsx:85-89` (dentro do próprio `useEffect` da página de CRM). `KingLayout.tsx` e `KingDashboard.tsx` **leem** `leads`/`newLeadsCount` mas nunca disparam o carregamento.
   Consequência prática: um OWNER que loga e permanece no Dashboard (fluxo normal) nunca vê o badge vermelho no menu "CRM" nem o banner "X novos leads aguardando" — mesmo havendo leads reais pendentes no banco — até visitar a aba CRM ao menos uma vez na sessão. A informação existe (`kingApi.leads()`), mas não é buscada; o "erro" aqui é de dado nunca comunicado, no mesmo espírito dos bugs de "resultado de API ignorado" já mapeados em sessões anteriores.
   **Correção aplicada** (`pages/king/KingLayout.tsx`): adicionado um `useEffect` que chama `loadLeads()` uma vez, assim que `user.role === OWNER` é confirmado — antes dos `return` condicionais do guard (para respeitar a Regra dos Hooks), mas gatilhado apenas para o papel correto. `loadLeads()` já era idempotente (guarda interna via `loadedRef`), então chamadas repetidas não geram requisições extras.

## Problemas encontrados durante a revisão (documentados, não corrigidos — fora do escopo desta tarefa)

3. **`queryGlobalStats()` (`aura-backend/src/lib/queries/index.ts:195-305`) é infraestrutura compartilhada, fora dos arquivos desta tarefa**, mas alimenta o Dashboard hoje e provavelmente será estendida/reaproveitada pelas próximas 3 tarefas (`KingRevenue`, `KingCompanies` etc.). Registrado para conhecimento dos próximos agentes:
   - Loga o resultado completo (`JSON.stringify`) em `console.log` a cada requisição — ruído de log em produção, não é um bug de correção.
   - A exclusão de empresas com usuário `OWNER` do cálculo de MRR é uma regra de negócio razoável, mas **não tem nenhum teste que trave esse comportamento** — vale um teste dedicado quando essa lógica for tocada.
4. **Botão "Preencher Credenciais (Dev)" sem gate de ambiente** existe tanto em `KingLogin.tsx` quanto em `pages/Login.tsx` (`fillDemo`) — padrão pré-existente e replicado em toda a aplicação, não introduzido nesta área. Não foi alterado por ser uma mudança de escopo maior (afetaria `Login.tsx`, fora do escopo desta tarefa) e por já ser uma decisão consciente do projeto (ambiente de demonstração).

## Testes criados nesta sessão

### Backend (`aura-backend/src/__tests__/`)
- **`lib/kingGuard.test.ts`** (novo — 9 testes): sem sessão → 401; OWNER → autorizado; cada um de ADMIN/RECEPTIONIST/ESTHETICIAN/PATIENT → 403 (`it.each`); role vazio → 403; role `"owner"` minúsculo → 403 (comparação case-sensitive); OWNER com `companyId` preenchido → ainda autorizado.
- **`api/king-dashboard.test.ts`** (complementado — de 5 para 10 testes): adicionados os 403 de RECEPTIONIST/ESTHETICIAN/PATIENT (`it.each`), OWNER com `companyId` (200), e um teste de que o 500 nunca vaza o texto do erro interno na resposta.

### Frontend (`__tests__/pages/`)
- **`KingLogin.test.tsx`** (novo — 8 testes): erro de credenciais inválidas; exceção de rede; login OWNER navega para `/king/dashboard`; sessão OWNER já restaurada redireciona sozinha; **teste do bug corrigido** (login válido de ADMIN mostra erro e desloga); sessão pré-existente de outro role ao abrir a tela não desloga nem mostra erro; botão "Preencher Credenciais (Dev)"; estado de loading.
- **`KingLayout.test.tsx`** (novo — 9 testes): tela de "Verificando acesso..." durante `isInitializing`; sem usuário → `/king`; usuário não-OWNER → `/dashboard`; OWNER renderiza layout completo; **teste do bug corrigido** (`loadLeads()` chamado ao montar para OWNER); não chama `loadLeads` para não-OWNER; badge do CRM aparece/some conforme `newLeadsCount`; logout chama `logout()` e navega para `/king`.
- **`KingDashboard.test.tsx`** (novo — 11 testes): spinner de carregamento; 4 KPIs com valores corretos; `0% ativas` sem `NaN` quando não há empresas; distribuição por plano (com e sem dados); erro de rede + retry; erro HTTP (401/403/500) exibido; erro de negócio com HTTP 200 exibido; widget de leads oculto/exibido + navegação para CRM; botão "Atualizar".

## Testes recomendados (para sessões/agentes futuros, fora do escopo atual)

1. **[Backend]** Teste dedicado para a exclusão de empresas com usuário `OWNER` do cálculo de `mrr` em `queryGlobalStats` (hoje sem cobertura direta) — relevante para quem for mexer em `KingRevenue`.
2. **[Backend]** Teste de `queryGlobalStats` para `totalCompanies === 0` (division guard já existe no frontend, mas vale confirmar que o backend nunca retorna `NaN`/`Infinity` em campos derivados caso a lista de empresas venha vazia).
3. **[Frontend]** Teste de acessibilidade/mobile do drawer do `KingLayout` (abrir pelo hambúrguer, fechar pelo X ou pelo overlay) — não coberto nesta sessão por não ser um risco de RBAC/dado, mas é uma interação real da tela.
4. **[Frontend]** Se o botão "Preencher Credenciais (Dev)" for revisitado no futuro (ver item 4 acima), caberia um teste garantindo que ele só aparece fora de produção.
