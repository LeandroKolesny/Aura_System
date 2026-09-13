# Auditoria de Testes — Cliente: Login / Navegação / Dashboard do Portal do Paciente

> Escopo: `apps/PatientPortalApp.tsx`, `pages/patient-portal/PatientLogin.tsx`,
> `components/patient-portal/PatientSidebar.tsx`, `context/ClinicContext.tsx`, `utils/subdomain.ts`.
> Fora do escopo (outros agentes): `pages/PublicBooking.tsx`, `pages/patient-portal/PatientPlans.tsx`,
> `components/patient-portal/Plan*.tsx`.

## Funcionalidades identificadas

### `utils/subdomain.ts`
1. `extractSlugFromPath(pathname)` — extrai o 1º segmento do path como slug de clínica, exceto se estiver na lista `ADMIN_ROUTES` (rotas do painel admin). O segmento é comparado e retornado **já em lowercase**.
2. `getClinicSlug()` — decide a estratégia por host: `localhost`/`127.0.0.1`/`vercel.app` → path-based (`extractSlugFromPath`); domínio próprio → subdomínio (`host.split('.')`, exige `parts.length >= 3`, ignora `www`).
3. `isPatientPortal()` / `isAdminSystem()` — wrappers booleanos sobre `getClinicSlug()`.
4. `getPortalBasePath()` — retorna `/${slug}` em localhost/Vercel, ou `''` em domínio próprio (o slug já está no subdomínio).
5. `getPortalUrl(slug, path)` — monta URL absoluta do portal (path-based ou subdomínio) para uso em links externos ao portal (ex.: painel admin linkando pro portal do cliente).
6. `getPathWithoutSlug(pathname)` — remove o prefixo `/slug` do pathname (path-based).

### `context/ClinicContext.tsx`
7. `ClinicProvider` busca os dados públicos da clínica via `publicApi.getCompanyBySlug(slug)` em um `useEffect` disparado por mudança de `slug`.
8. Mapeia `company`, `procedures` (normalizando `price`/`cost`/`durationMinutes` para `Number`) e `professionals` (dados públicos, sem email/role).
9. Aplica o tema visual da clínica (`applyClinicTheme`) via CSS custom properties no `document.documentElement`, só quando `layoutConfig` existe.
10. Expõe `isLoading` (`true` durante o fetch) e `error` (mensagem genérica `'Clínica não encontrada'` em caso de `!response.success` e `'Erro ao carregar dados da clínica'` em caso de exceção/rede) — não distingue 404 de erro de rede/500 para o usuário final, mas isso é decisão de UX consciente (mesma tela `ClinicNotFound` para ambos, ver Problema #5).
11. Se `slug` for falsy, `loadClinicData` nunca é chamado — `isLoading` fica `true` para sempre (nenhum estado terminal é atingido).

### `apps/PatientPortalApp.tsx`
12. `PatientPortalApp` monta `AppProvider` → `ClinicProvider` (com o `slug` recebido via prop) → `ClinicWrapper` → `Router` (BrowserRouter próprio, isolado do admin) → `PatientPortalRoutes`.
13. `ClinicWrapper` mostra `ClinicLoading` enquanto `isLoading`, `ClinicNotFound` se `error`, senão renderiza os filhos (rotas).
14. `PatientPortalRoutes` decide `usePathBasedRouting` comparando `window.location.host` (`localhost`/`127.0.0.1`/`vercel.app` → path-based com prefixo `/clinicSlug`; caso contrário, prefixo vazio — domínio próprio usa subdomínio).
15. Rotas públicas: `${prefix}/` e `${prefix}` → `PublicBooking` (fora do escopo); `${prefix}/login` → `PatientLogin`.
16. Rotas privadas (dentro de `PatientPortalLayout`): `minha-conta` (`PatientDashboard`), `meus-planos` (`PatientPlans`, fora do escopo), `agendamentos` (`Schedule`, reaproveitado do admin), `procedimentos` (`Procedures`, reaproveitado), `historico` (`PatientHistory`, reaproveitado).
17. Fallback `*` → redireciona para `${prefix}/`.
18. `PatientPortalLayout` — guarda de acesso:
    - `!user` → `<Navigate to="${basePath}/login">`.
    - `user.role !== UserRole.PATIENT` → `<Navigate to="${basePath}/">`.
    - **Não existe nenhuma verificação de `companyId`** entre o usuário logado e a clínica (`clinic`) resolvida pelo slug da URL (ver Problema #1 — bug confirmado).
    - Não considera `isInitializing` do `AppContext` (ver Problema #2 — bug confirmado).
19. `PatientPortalLayout` monta `PatientSidebar` + `Outlet`, com header mobile (hambúrguer) que abre/fecha a sidebar via `isMobileMenuOpen`, cores derivadas do `layoutConfig` da clínica (`isDarkBackground` calculado a partir do brilho percebido do `backgroundColor`).
20. `PatientDashboard` — 4 `DashboardCard`s: "Próximo Agendamento" (**descrição hardcoded, nunca busca dado real** — ver Problema #3, bug confirmado), "Histórico", "Meus Planos", "Novo Agendamento" — os 3 últimos são apenas links estáticos (comportamento correto, pois são "atalhos", não dados).
21. `isDarkBackground` está **duplicada** ao pé da letra entre `apps/PatientPortalApp.tsx` (linha 24) e `components/patient-portal/PatientSidebar.tsx` (linha 46) — mesma lógica de luminância, copiada, não extraída para um utilitário compartilhado (viola a regra "Não duplicar código" do `CLAUDE.md`) — ver Problema #6.

### `pages/patient-portal/PatientLogin.tsx`
22. Formulário de e-mail/senha, chama `login(email, password)` do `AppContext` (autenticação **global**, não escopada por clínica/slug — ver `aura-backend/src/app/api/auth/login/route.ts`, que não recebe nem valida nenhum `companyId`/slug).
23. **Não existe criação de conta** nesta página — o único CTA é "Faça um agendamento", que leva para `${basePath}/` (fluxo de criação de paciente acontece implicitamente no booking público, `POST /api/public/booking`, fora do escopo desta auditoria).
24. Tratamento de erro: `login()` retornando `false` → `'E-mail ou senha incorretos.'`; exceção lançada → `'Erro ao fazer login. Tente novamente.'`. Mensagens fixas — não repassam a mensagem real da API (ex.: conta desativada, e-mail não verificado, rate limit 429, manutenção 503 — todos caem na mensagem genérica de "incorretos", ver Problema #4).
25. Redirecionamento pós-login: `useEffect` observa `user`; se `user.role === PATIENT`, navega para `${basePath}/minha-conta`. **Não verifica `companyId`** (mesmo problema do item 18) e **não considera `isInitializing`** (mesmo problema do item 2) — ver Problemas #1 e #2.
26. Estilo (cores, logo) vem do `ClinicContext` (`clinic?.layoutConfig`, `clinic?.logo`, `clinic?.name`) — helper visual apenas, sem lógica de negócio.

### `components/patient-portal/PatientSidebar.tsx`
27. 5 itens de navegação fixos (`NavLink`): Minha Conta, Meus Planos, Agendamentos, Procedimentos, Histórico — todos com `path` construído via `getPortalBasePath()`.
28. Logout: `handleLogout` chama `logout()` do `AppContext` e navega para `${basePath}/login` — sempre navega, mesmo que `logout()` lance exceção (a função `logout` do `AppContext` já engole erros internamente com `catch`, então na prática não propaga, mas o handler local também não trata explicitamente um possível reject — ver Problema #7, risco baixo).
29. Responsivo: `isMobileOpen`/`onMobileClose` (prop drilling a partir do `PatientPortalLayout`), overlay escuro (`fixed inset-0 bg-black/50 lg:hidden`) fecha ao clicar fora, botão `X` fecha explicitamente, `translate-x-full`/`translate-x-0` com breakpoint `lg:`. Mesmo padrão (Tailwind breakpoint `lg:`, overlay, hambúrguer) usado no restante do app auditado nesta sessão — nenhuma divergência encontrada.
30. Cores derivadas dinamicamente do `layoutConfig` da clínica (`deriveSidebarColor`, clareia/escurece o `backgroundColor` em ±8/20 conforme tema claro/escuro) — lógica visual, não testada mas de baixo risco funcional.

## Endpoints de backend usados

| Método | Rota | Arquivo | Chamado por |
|---|---|---|---|
| POST | `/api/auth/login` | `aura-backend/src/app/api/auth/login/route.ts` | `authApi.login()` — `PatientLogin` via `AppContext.login()`. **Não recebe `companyId`/slug** — autenticação 100% global. |
| GET | `/api/auth/me` | `aura-backend/src/app/api/auth/me/route.ts` | `authApi.me()` — restauração de sessão via cookie `aura_session` (`AppContext` `restoreSession`, roda em todo mount de `AppProvider`, inclusive dentro do `PatientPortalApp`). |
| POST | `/api/auth/logout` | `aura-backend/src/app/api/auth/logout/route.ts` | `authApi.logout()` — `PatientSidebar.handleLogout` via `AppContext.logout()`. |
| GET | `/api/public/company/[slug]` | `aura-backend/src/app/api/public/company/[slug]/route.ts` | `publicApi.getCompanyBySlug()` — `ClinicContext`. Sem autenticação, com rate limit (60 req/15min/IP). Retorna `company` (dados públicos), `procedures` ativos e `professionals`. |
| POST | `/api/public/booking` | `aura-backend/src/app/api/public/booking/route.ts` | `appointmentsApi.createPublic()` — usado por `PublicBooking.tsx` (fora do escopo), é onde o registro implícito do paciente acontece. Mencionado aqui só como referência ao fluxo de "criação de conta". |

## Cobertura de testes atual

### Frontend
- **Nenhum teste existe hoje** para nenhum dos 5 arquivos do escopo. Busquei em `__tests__/` (recursivo) por `PatientPortalApp`, `PatientLogin`, `PatientSidebar`, `ClinicContext`, `subdomain` — nenhum resultado. Não existe `__tests__/apps/` nem `__tests__/pages/patient-portal/` ainda.
- `__tests__/context/AppContext.test.tsx` cobre `login`/`logout`/`restoreSession` do `AppContext` de forma genérica (não específica ao portal do paciente), então o comportamento de `login()` e `isInitializing` já tem alguma cobertura indireta reaproveitável para os novos testes (mock de `authApi`).

### Backend
- `POST /api/auth/login`: não explorei os testes existentes em detalhe (fora do escopo de arquivos a modificar), mas o endpoint em si não tem nenhuma noção de `companyId`/slug — não há (nem faria sentido haver) teste de "login escopado por clínica", porque a rota não implementa esse conceito. Esse é justamente o Problema #1 abaixo: a responsabilidade de isolar por clínica foi deixada 100% para o frontend, e o frontend não a implementa.
- `GET /api/public/company/[slug]`: fora do escopo de arquivos a modificar; não auditado a fundo.

### E2E
- Não encontrei nenhum spec Playwright específico do portal do paciente (`e2e/*.spec.ts`) durante esta auditoria — não investighei exaustivamente (fora do pedido, que é só Vitest/RTL), mas nenhum apareceu nas buscas realizadas.

## Problemas encontrados durante a revisão

1. **[BUG CONFIRMADO — isolamento entre clínicas] `PatientPortalLayout` não verifica se o `companyId` do usuário logado corresponde à clínica da URL.**
   Evidência: `apps/PatientPortalApp.tsx:76-78` — a guarda de acesso só checa `!user` e `user.role !== UserRole.PATIENT`; nunca compara `user.companyId` com `clinic?.id` (disponível via `useClinic()`, já importado no mesmo componente).
   Como isso é explorável: `context/AppContext.tsx:335-404` (`restoreSession`) roda em **todo mount** do `AppProvider` — inclusive o `AppProvider` que `PatientPortalApp.tsx:307` cria para cada portal — e restaura a sessão a partir do cookie `aura_session` (`httpOnly`, sem relação com o slug da URL) via `GET /api/auth/me`. O `POST /api/auth/login` (`aura-backend/src/app/api/auth/login/route.ts`) também não recebe nem valida `companyId`/slug algum (confirmado lendo o arquivo completo).
   Resultado: um paciente da Clínica A que já tem uma sessão válida (cookie), ao navegar para `/{slug-da-clinica-B}/minha-conta` (ou mesmo `/{slug-da-clinica-B}/login`, ver Problema #1b abaixo), é autenticado **automaticamente pelo cookie**, sem digitar nada, e a guarda de `PatientPortalLayout` deixa passar porque `role === PATIENT` é verdadeiro — apenas a marca/tema visual (`clinic.layoutConfig`, `clinic.name`, `clinic.logo`) fica "errada" (da Clínica B), mas o usuário consegue navegar pelas rotas privadas do portal de uma clínica da qual não é cliente. Os dados de `Schedule`/`Procedures`/`PatientHistory` continuam escopados pelo `companyId` do JWT (backend), então não há vazamento de dados clínicos de outros pacientes, mas há um vazamento de **acesso** ao portal errado — exatamente o comportamento que a tarefa pediu para confirmar.
   **Corrigido** (ver seção de correções): adicionada checagem `clinic && user.companyId !== clinic.id` em `PatientPortalLayout`.

   1b. **Efeito colateral necessário de corrigir junto:** `PatientLogin.tsx:24-28` redireciona para `/minha-conta` sempre que `user.role === PATIENT`, sem checar `companyId`. Se corrigirmos *apenas* o Problema #1 (guarda do layout), o resultado seria um **loop de redirecionamento infinito** entre `/login` (guarda do layout manda pra cá) e `/minha-conta` (login manda de volta pra lá), porque nenhum dos dois lados desloga o usuário nem quebra o ciclo. Corrigido nos dois arquivos em conjunto (login agora desloga e mostra erro quando há mismatch de empresa).

2. **[BUG CONFIRMADO — flash de redirecionamento] `PatientPortalLayout` e `PatientLogin` não consideram `isInitializing` do `AppContext`.**
   Evidência: `context/AppContext.tsx:242` (`isInitializing`, `true` até `restoreSession` resolver) é consumido em `App.tsx:177-179` e `pages/king/KingLayout.tsx:12,20` para não decidir nada de autenticação antes da sessão ser restaurada — mas `apps/PatientPortalApp.tsx` (`PatientPortalLayout`) e `pages/patient-portal/PatientLogin.tsx` nunca leem `isInitializing`.
   Resultado: ao recarregar a página em `/{slug}/minha-conta` com uma sessão de paciente válida (cookie), `user` começa `null` (antes do `authApi.me()` resolver) → `PatientPortalLayout` redireciona imediatamente para `/login` → assim que `restoreSession` termina e popula `user`, o `useEffect` do `PatientLogin` redireciona de volta para `/minha-conta`. Duas navegações (`replace`) e uma renderização visível da tela de login antes de voltar — comportamento inconsistente com o resto do app, que evita esse flash via `isInitializing`.
   **Corrigido**: ambos os componentes agora mostram um estado de carregamento (reaproveitando `ClinicLoading`) enquanto `isInitializing` é `true`, antes de decidir qualquer redirecionamento.

3. **[BUG CONFIRMADO — dado hardcoded] Card "Próximo Agendamento" do `PatientDashboard` nunca reflete dados reais.**
   Evidência: `apps/PatientPortalApp.tsx:229-230` (antes da correção) — `description="Você não tem agendamentos próximos"` é uma string fixa no JSX, sem nenhuma leitura de `appointments`/`loadAppointments` do `AppContext`. Mesmo um paciente com agendamentos futuros reais veria sempre essa mensagem.
   **Corrigido**: `PatientDashboard` agora usa `appointments` + `user.patientId` do `AppContext` (já carregados/expostos por `Schedule.tsx` da mesma forma) para calcular o próximo agendamento futuro (`status` não `canceled`, `date >= now`, ordenado ascendente) e exibir a data/serviço reais, ou a mensagem de "nenhum agendamento" apenas quando genuinamente não há nenhum.

4. **[Confirmado, não corrigido — decisão de produto] `PatientLogin` sempre mostra `'E-mail ou senha incorretos.'` mesmo para erros que não são de credencial.**
   Evidência: `pages/patient-portal/PatientLogin.tsx:38-47` — `AppContext.login()` (`context/AppContext.tsx:826-884`) retorna apenas `boolean` (`true`/`false`), nunca repassa a mensagem/`status` da resposta da API. O backend (`aura-backend/src/app/api/auth/login/route.ts`) distingue 401 (credenciais), 403 (conta desativada / e-mail não verificado), 429 (rate limit) e 503 (manutenção) — mas todos colapsam em "E-mail ou senha incorretos" no portal do paciente.
   **Não corrigido** nesta tarefa: mudar a assinatura de `login()` para propagar a mensagem de erro é uma mudança de contrato usada por várias telas do admin (`Login.tsx` do painel, fora do meu escopo de arquivos) — risco de regressão fora do escopo autorizado. Deixado documentado como recomendação de teste/melhoria futura.

5. **[A investigar — não confirmado como bug] `ClinicContext` usa a mesma tela (`ClinicNotFound`) tanto para "empresa não encontrada" (404) quanto para erro de rede/500.**
   `context/ClinicContext.tsx:78-84` seta a mesma família de mensagens genéricas (`'Clínica não encontrada'` / `'Erro ao carregar dados da clínica'`) só no `error` interno do contexto, mas `apps/PatientPortalApp.tsx` (`ClinicWrapper`) não usa a mensagem — sempre renderiza o texto fixo "Clínica não encontrada" independentemente da causa real. Pode ser intencional (não expor detalhes de erro de infraestrutura a um visitante não autenticado), então não tratei como bug — sinalizo para o time confirmar a intenção.

6. **[Confirmado, não corrigido — duplicação de código, viola `CLAUDE.md`] `isDarkBackground` duplicada.**
   Evidência: função idêntica (mesmo algoritmo de luminância, mesmos nomes de variável) em `apps/PatientPortalApp.tsx:24-33` e `components/patient-portal/PatientSidebar.tsx:46-55`. `CLAUDE.md` exige extrair para um utilitário compartilhado quando o mesmo bloco aparece em 2+ lugares.
   **Não corrigido** nesta tarefa: é refatoração pura (sem mudança de comportamento) e o escopo desta tarefa prioriza os bugs de login/navegação/dashboard; documentado para correção futura (ex.: mover para `utils/formatUtils.ts` ou um novo `utils/colorUtils.ts`).

7. **[Baixo risco, não corrigido] `PatientSidebar.handleLogout` não trata explicitamente uma falha de `logout()`.**
   `components/patient-portal/PatientSidebar.tsx:30-33` sempre navega para `/login` após `await logout()`. Como `AppContext.logout()` (linha 952) já engole erros internamente (`try/catch` sem re-throw), na prática o `await` nunca rejeita — então o comportamento observável está correto, mas não há teste que documente essa garantia. Listado como recomendação de teste (não como bug).

8. **`utils/subdomain.ts` — nenhum bug confirmado.** Casos de borda verificados por leitura de código: maiúsculas (normalizadas via `.toLowerCase()` tanto no path quanto no subdomínio), `www.` (excluído explicitamente), porta em dev (`host.includes('localhost')` ignora a porta), ausência de subdomínio/slug (retorna `null` corretamente, tratado como sistema admin), domínio apex de 2 labels (`aurasystem.com`, `parts.length < 3` → `null`). Cobertos por testes novos para travar esse comportamento (ver seção seguinte).

## Testes recomendados (e escritos nesta tarefa)

### Alta prioridade — escritos nesta tarefa (TDD: falharam antes da correção, passam depois)
1. `__tests__/apps/PatientPortalApp.test.tsx` — `PatientPortalLayout` redireciona para `/login` quando `user.companyId !== clinic.id` (prova o Problema #1 antes da correção, passa depois).
2. `__tests__/apps/PatientPortalApp.test.tsx` — `PatientPortalLayout` permite acesso quando `user.companyId === clinic.id` (regressão positiva).
3. `__tests__/apps/PatientPortalApp.test.tsx` — `PatientPortalLayout` mostra loading (não decide nada) enquanto `isInitializing === true`, mesmo com `user === null`.
4. `__tests__/apps/PatientPortalApp.test.tsx` — `PatientDashboard` exibe o próximo agendamento real (data/serviço) quando existe um agendamento futuro do paciente logado, e a mensagem "sem agendamentos" só quando não existe nenhum futuro não cancelado.
5. `__tests__/pages/PatientLogin.test.tsx` — login com sucesso mas `companyId` de outra clínica: mostra erro e chama `logout()`, sem navegar para `/minha-conta` (prova o Problema #1b).
6. `__tests__/pages/PatientLogin.test.tsx` — login bem-sucedido com `companyId` correto navega para `${basePath}/minha-conta`.
7. `__tests__/pages/PatientLogin.test.tsx` — credenciais inválidas (`login` retorna `false`) exibe `'E-mail ou senha incorretos.'`.
8. `__tests__/pages/PatientLogin.test.tsx` — exceção lançada por `login()` exibe `'Erro ao fazer login. Tente novamente.'`.
9. `__tests__/pages/PatientLogin.test.tsx` — enquanto `isInitializing === true`, não renderiza o formulário de login (evita o flash do Problema #2).
10. `__tests__/components/PatientSidebar.test.tsx` — renderiza os 5 itens de navegação com os `path`s corretos (usando `getPortalBasePath()`).
11. `__tests__/components/PatientSidebar.test.tsx` — clicar em "Sair" chama `logout()` e navega para `${basePath}/login`.
12. `__tests__/components/PatientSidebar.test.tsx` — `isMobileOpen` controla a classe de translação da sidebar e exibe/esconde o overlay; clicar no overlay ou no botão `X` chama `onMobileClose`.
13. `__tests__/context/ClinicContext.test.tsx` — sucesso: mapeia `clinic`/`procedures`/`professionals` corretamente a partir de `publicApi.getCompanyBySlug`.
14. `__tests__/context/ClinicContext.test.tsx` — `response.success === false` seta `error = 'Clínica não encontrada'` e `isLoading = false`.
15. `__tests__/context/ClinicContext.test.tsx` — exceção de rede seta `error = 'Erro ao carregar dados da clínica'`.
16. `__tests__/context/ClinicContext.test.tsx` — `useClinic()` fora de `ClinicProvider` lança erro (`'useClinic must be used within a ClinicProvider'`).
17. `__tests__/utils/subdomain.test.ts` — `getClinicSlug`/`getPortalBasePath`/`extractSlugFromPath` para: localhost com slug, localhost em rota admin (`/login`, `/king`, raiz `/`), Vercel com slug, `www.dominio.com` → `null`, `slug.dominio.com` → `"slug"`, domínio apex de 2 labels → `null`, maiúsculas no path e no subdomínio → lowercase, porta em dev (`localhost:5173/clinica/login`).

### Média prioridade (não escritos nesta tarefa — ficam como recomendação)
18. `__tests__/pages/PatientLogin.test.tsx` — repassar a mensagem real da API (403 conta desativada / 429 rate limit / 503 manutenção) em vez do texto genérico, **depois** que `AppContext.login()` for alterado para propagar a mensagem de erro (Problema #4) — mudança de contrato fora do escopo desta tarefa.
19. `__tests__/apps/PatientPortalApp.test.tsx` — `ClinicWrapper` distingue (ou documenta explicitamente que não distingue) 404 de erro de rede na mensagem exibida (Problema #5), após decisão do time sobre a intenção.
