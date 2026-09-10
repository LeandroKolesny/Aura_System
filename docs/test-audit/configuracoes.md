# Auditoria de Testes — Configurações

Escopo: `pages/Settings.tsx` (Perfil do Negócio, Assinatura, Google Calendar) +
`components/WhatsAppSettings.tsx` (integração WhatsApp via Evolution API), role
ADMIN/OWNER. Arquivos lidos: `pages/Settings.tsx`, `components/WhatsAppSettings.tsx`,
`services/api.ts`, `context/AppContext.tsx`, `utils/maskUtils.ts`,
`aura-backend/src/app/api/companies/[id]/route.ts`,
`aura-backend/src/app/api/whatsapp/instance/route.ts`,
`aura-backend/src/app/api/webhooks/whatsapp/route.ts`,
`aura-backend/src/app/api/auth/google/callback/route.ts`,
`aura-backend/src/app/api/auth/google/calendar/{status,sync,disconnect}/route.ts`,
`App.tsx`, `e2e/whatsapp-settings.spec.ts`, e os testes já existentes em
`aura-backend/src/__tests__/api/` e `__tests__/`.

## Funcionalidades identificadas

1. **Perfil do Negócio** (`Settings.tsx`)
   - Editar nome, CNPJ/CPF (com máscara e validação client-side), endereço, cidade, estado (dropdown BR), texto de apresentação.
   - Lista dinâmica de telefones de contato (adicionar/remover, com máscara).
   - Redes sociais: site, Facebook, Instagram.
   - Público-alvo: feminino / masculino / infantil (checkboxes, `targetAudience`).
   - Upload de logo (via `FileReader`, convertido para base64/data URL — **não é upload para storage/CDN**, o base64 vai direto no campo `logo` da empresa).
   - Salvar via botão "Salvar Alterações" (submit do form) e também via `triggerSave` disparado pela Sidebar (navegação com alterações pendentes).
   - Estado "sujo"/`hasUnsavedChanges` para avisar navegação com alterações não salvas.
2. **Assinatura** — exibição de plano atual, dias restantes, botão para abrir modal de assinatura (`setIsSubscriptionModalOpen`). Não faz chamada de API própria nesta tela (fora do escopo desta auditoria, mas está na mesma página).
3. **Integração Google Calendar** (`Settings.tsx`, dentro do header da página, fora do form)
   - Conectar (`calendarApi.connect` → redireciona para `/api/auth/google?mode=calendar`).
   - Status de conexão (`calendarApi.getStatus()` no mount).
   - Desconectar (`calendarApi.disconnect()`).
   - Sincronização inicial de eventos existentes do Google Calendar como bloqueios de indisponibilidade (`calendarApi.sync()`), disparada apenas quando a página detecta o retorno do OAuth com `google_calendar=connected`.
4. **Integração WhatsApp — Confirmações** (`components/WhatsAppSettings.tsx`, renderizado dentro do form de `Settings.tsx` apenas se `checkModuleAccess('whatsapp_notifications')`)
   - Ver status (`DISCONNECTED` / `CONNECTING` / `CONNECTED`) e telefone conectado.
   - Aceitar termos de uso (checkbox obrigatório) antes de conectar.
   - Conectar (gera QR Code via Evolution API) — `whatsappApi.connect(true)`.
   - Polling do status a cada 5s enquanto `CONNECTING` (para detectar o scan do QR Code).
   - Desconectar (com modal de confirmação via `useDialog()`), some com `confirm()` do `DialogContext` (segue o padrão do projeto, não usa `window.confirm`).
   - Ativar/desativar chatbot de agendamento automático (`whatsappApi.setChatbotEnabled`), toggle visível só para ADMIN/OWNER (`canManage`, checagem **apenas no frontend**).
   - Preview estático das mensagens automáticas (confirmação e lembrete 24h) — não chama API, é só texto ilustrativo.

## Endpoints de backend usados

| Ação | Endpoint | Arquivo |
|---|---|---|
| Buscar/editar dados da empresa | `GET/PUT /api/companies/:id` | `aura-backend/src/app/api/companies/[id]/route.ts` |
| Status Google Calendar | `GET /api/auth/google/calendar/status` | `.../calendar/status/route.ts` |
| Conectar Google Calendar | `GET /api/auth/google?mode=calendar` (redirect) + `.../auth/google/callback/route.ts` | |
| Sincronizar Google Calendar | `POST /api/auth/google/calendar/sync` | `.../calendar/sync/route.ts` |
| Desconectar Google Calendar | `POST /api/auth/google/calendar/disconnect` | `.../calendar/disconnect/route.ts` |
| Status/QR WhatsApp | `GET /api/whatsapp/instance` | `aura-backend/src/app/api/whatsapp/instance/route.ts` |
| Conectar WhatsApp | `POST /api/whatsapp/instance` | idem |
| Desconectar WhatsApp | `DELETE /api/whatsapp/instance` | idem |
| Ativar/desativar chatbot | `PATCH /api/whatsapp/instance` | idem |
| Webhook de eventos Evolution API (mensagens + `connection.update`) | `POST /api/webhooks/whatsapp` | `aura-backend/src/app/api/webhooks/whatsapp/route.ts` |

`GET /api/users/:id` **não é usado** nesta tela — dados do próprio usuário logado não são editáveis em Configurações (não há campo de nome/senha do usuário em `Settings.tsx`).

## Cobertura de testes atual

### Backend

Cobertura já é extensa e sólida:

- **`companies-id.test.ts`** — cobre GET/PUT `/api/companies/[id]`: 401, 403 (empresa de terceiros, role inválida), 404, validação de schema (400 para campo desconhecido, `businessHours` inválido), aplicação dos campos, mapeamento dos aliases `socialMedia`→website/facebook/instagram e `targetAudience`→targetFemale/Male/Kids, deduplicação de `paymentMethods`, e caso especial de OWNER editando empresa sem `companyId` próprio.
  - **Não cobre**: formato de CNPJ/CPF (não há validação nem teste — ver "Problemas encontrados").
- **`whatsapp-instance.test.ts`** — cobre GET (401, 403 módulo indisponível, instância inexistente, instância existente), POST (403 módulo, 403 termos não aceitos, 503 sem `EVOLUTION_API_URL`, 500 em falha de `createInstance`, criação com QR code, registro de webhook, gravação de IP/e-mail/hash dos termos), DELETE (403 módulo, fluxo de sucesso), PATCH (403 módulo, 404 sem instância, ativar/desativar chatbot).
  - **Não cobre**: papel do usuário (todos os testes usam `MOCK_USER` com `role: 'ADMIN'`) — não há teste garantindo que RECEPTIONIST/ESTHETICIAN não possam conectar/desconectar/alterar chatbot (ver "Problemas encontrados", a rota realmente não bloqueia por role).
- **`google-calendar-status.test.ts`** — 401, conectado com `calendarId`, não conectado, usuário não encontrado no banco.
- **`google-calendar-sync.test.ts`** — 401, 400 (não conectado / sem empresa), renovação de token expirado, 401 quando renovação falha, 502 na falha da API do Google, ignora eventos criados pelo próprio sistema, ignora eventos cancelados/sem horário, cria e atualiza regra de indisponibilidade a partir de evento externo, 500 em erro inesperado.
- **`google-calendar-disconnect.test.ts`** — 401, limpeza de credenciais sem watch, parar canal e remover watch quando existente, 500 em falha do banco.
- **`webhooks-whatsapp.test.ts`** — autenticação do webhook (401 sem secret, secret incorreto, secret não configurado), processamento de mensagem válida, ignora `connection.update`/eco, ignora instância desconhecida, ignora quando chatbot desativado, 400 JSON inválido, sempre retorna 200 mesmo com erro interno.
  - **Nota**: cobre apenas o *parsing* de mensagens de chatbot; não há teste (nem código) que trate `connection.update` como sinal de queda de conexão para atualizar `whatsappInstance.status` no banco.
- Não há um teste próprio de `auth/google/callback/route.ts` para o modo `calendar` especificamente redirecionando com `?google_calendar=connected` (o arquivo de teste mais próximo, `auth-google-setup-company.test.ts`, cobre outro fluxo — não confirmado em detalhe, mas nenhum arquivo de teste com nome relacionado a "google-callback" foi encontrado na pasta).

### Frontend

Confirmado: **não existe nenhum teste de página/componente** para Configurações.
Os únicos testes frontend do repositório são `__tests__/context/AppContext.test.tsx` e `__tests__/services/api.test.ts`.

- `AppContext.test.tsx` já cobre `updateCompany` razoavelmente bem: há um bloco `describe('AppContext > updateCompany (configurações da empresa)')` que testa a regressão de não aplicar atualização otimista quando a API falha, e testa que o estado é atualizado com os dados confirmados pelo servidor. Também cobre `completeOnboarding` chamando `updateCompany` com `onboardingCompleted:true`.
- `api.test.ts` cobre `calendarApi` por completo (`getStatus`, `connect`, `disconnect`, `sync`, incluindo caso de erro).
- `api.test.ts` **não tem nenhum teste para `companiesApi.update`/`companiesApi.get`, nem para `whatsappApi` (getStatus/connect/disconnect/setChatbotEnabled)** — busca por `describe('companiesApi'` e `whatsappApi.` não retornou nenhuma ocorrência.
- **Nenhum teste de componente (RTL) existe para `Settings.tsx` ou `WhatsAppSettings.tsx`** — validação de CNPJ na tela, upload de logo, lista de telefones, toggle de chatbot, exibição condicional por `canManage`/role, tudo isso roda hoje sem nenhum teste de unidade/componente.

### E2E

`e2e/whatsapp-settings.spec.ts` tem 4 testes, todos **somente sobre o acordeon do WhatsApp**, sem mockar a API (roda contra o backend/demo real):

1. Accordion "WhatsApp" aparece em `/settings`.
2. Accordion abre ao clicar.
3. Botão "Conectar WhatsApp" fica desabilitado sem aceitar os termos.
4. Botão "Conectar WhatsApp" habilita após aceitar os termos.

**O que o spec cobre**: apenas abertura do accordion e o gate do checkbox de termos.

**O que o spec NÃO cobre** (lacunas confirmadas por leitura):
- Não clica em "Conectar WhatsApp" de fato (não teria QR code real disponível em ambiente de teste) — o fluxo de geração/exibição de QR Code nunca é exercitado em E2E.
- Não testa o polling de status durante `CONNECTING`.
- Não testa desconexão (`handleDisconnect` + modal de confirmação do `useDialog`).
- Não testa o toggle do chatbot.
- Não testa nenhum campo de "Perfil do Negócio" (nome, CNPJ, endereço, telefones, redes sociais, público-alvo, upload de logo) — nada do formulário principal de Configurações é exercitado em E2E.
- Não testa a integração com Google Calendar (conectar/desconectar/status/sync) na página de Configurações.
- Não testa o fluxo de "salvar alterações" (botão do formulário) nem o aviso de navegação com alterações não salvas (`hasUnsavedChanges`/`triggerSave`).
- Não há nenhum spec E2E de Configurações fora deste arquivo.

## Problemas encontrados durante a revisão

1. **[ALTA — bug funcional/confiabilidade] Reconexão do WhatsApp após queda não é detectada.** O webhook `POST /api/webhooks/whatsapp` descarta explicitamente eventos `connection.update` do Evolution API (`parseInboundWebhook` retorna `null`, comentário no próprio código: `// evento irrelevante (ex: connection.update, eco do próprio bot)`). O único lugar que sincroniza `whatsappInstance.status` com o status real na Evolution API é o `GET /api/whatsapp/instance`, chamado (a) uma vez quando o accordion é aberto (`isOpen` muda) e (b) a cada 5s **somente enquanto o status já é `CONNECTING`** (`components/WhatsAppSettings.tsx`, efeito `if (status !== 'CONNECTING') return`). Ou seja, se o WhatsApp cair no celular enquanto o status salvo é `CONNECTED` (ex.: usuário desloga o aparelho, fica sem internet, número é banido), o sistema não tem nenhum mecanismo push nem polling contínuo para detectar isso — o admin só descobre se reabrir a aba de Configurações manualmente. Nesse intervalo, lembretes/confirmações automáticas continuam "achando" que o envio está disponível.
2. **[ALTA — falha de autorização no backend] `POST/DELETE/PATCH /api/whatsapp/instance` não verificam `role`.** A restrição "apenas ADMIN/OWNER podem configurar o WhatsApp" (`canManage` em `WhatsAppSettings.tsx`) é **só de UI**. As rotas de backend (conectar, desconectar, ativar/desativar chatbot) checam apenas autenticação + `companyId` + módulo do plano — qualquer usuário autenticado da empresa (RECEPTIONIST, ESTHETICIAN) pode chamar essas rotas diretamente (via fetch/Postman) e conectar/desconectar o WhatsApp da clínica ou ligar/desligar o chatbot, contornando a intenção de UX. Todos os testes existentes em `whatsapp-instance.test.ts` usam `MOCK_USER` com `role: 'ADMIN'`, então essa lacuna nunca foi exercitada nem detectada por teste.
3. **[MÉDIA — bug provável / código morto] Detecção do retorno do OAuth do Google Calendar provavelmente nunca dispara.** `Settings.tsx` (linhas ~116-130) comenta explicitamente `// This is a HashRouter app` e faz o parsing de `google_calendar=connected` a partir de `window.location.hash`. Porém `App.tsx` usa `BrowserRouter` (confirmado: `import { BrowserRouter as Router, ... } from 'react-router-dom'`), e o backend (`.../auth/google/callback/route.ts`) redireciona para `${FRONTEND_URL}/settings?google_calendar=connected` — uma **query string real**, não uma hash. Como consequência, o `if (hashQueryIndex !== -1)` provavelmente nunca encontra o parâmetro esperado no lugar certo, e a chamada de sincronização inicial (`calendarApi.sync()`, que importa eventos existentes do Google Calendar como bloqueios de indisponibilidade) nunca é disparada automaticamente após conectar. O status "conectado" ainda aparece corretamente na tela porque `calendarApi.getStatus()` roda de qualquer forma no mount e reflete o que já foi persistido no backend — mas o *side effect* do sync inicial parece ser código morto. Isso é coerente com o histórico registrado na memória do projeto sobre bugs de redirecionamento HashRouter vs BrowserRouter no fluxo Google OAuth. **Recomendo confirmar em ambiente real** (não foi corrigido nem executado neste levantamento).
4. **[MÉDIA] Validação de CNPJ/CPF existe apenas no frontend.** O schema Zod de `PUT /api/companies/[id]` (`updateCompanySchema`) aceita `cnpj` como `z.string().max(20).nullable().optional()` — sem nenhuma validação de formato/dígito verificador. A validação real (`validateCpfCnpj`) roda só em `Settings.tsx` antes de chamar `updateCompany`. Uma chamada direta à API (bypass do frontend) pode gravar um CNPJ/CPF com formato ou dígitos inválidos, e não há teste no backend cobrindo isso.
5. **[BAIXA — observação de padrão de engenharia, não é bug] `utils/maskUtils.ts` implementa validação própria de CPF/CNPJ** (`validateCPF`/`validateCNPJ`/`validateCpfCnpj`) em vez de usar uma biblioteca consolidada, contrariando a diretriz do `CLAUDE.md` do projeto ("Validação de CPF/CNPJ → `cpf-cnpj-validator` ou `@brazilian-utils/br-validators`"). Não foi avaliado se o algoritmo manual está correto; é só uma observação de aderência aos princípios de engenharia do projeto, não um teste corretivo pedido nesta auditoria.
6. **Nenhum vazamento de dado sensível encontrado.** `GET /api/whatsapp/instance` retorna apenas `status`, `phoneNumber`, `termsAccepted`, `chatbotEnabled` e `qrCode` — não expõe `instanceName`/`apikey` do Evolution API (que fica só no backend, em `lib/whatsapp.ts`, usando `process.env.EVOLUTION_API_KEY`). Este ponto foi verificado especificamente a pedido do escopo e está OK.
7. **Upload de "logo" não é upload de arquivo real** — `handleLogoUpload` em `Settings.tsx` converte a imagem para base64 via `FileReader` e guarda como string no campo `logo`, sem limite de tamanho de arquivo nem redimensionamento. Isso não é necessariamente um bug, mas é um ponto de atenção: um arquivo grande vira uma string enorme salva direto no banco via `PUT /api/companies/:id` (schema Zod limita `logo` a `.url().max(500)` — na verdade um data URL base64 de uma imagem real quase certamente **excede 500 caracteres e não é uma URL válida** (`z.string().url()` rejeitaria um `data:image/png;base64,...`). Isso sugere que o **salvamento do logo pelo fluxo atual do frontend provavelmente falha na validação do backend** (400 "Dados inválidos"), a menos que exista algum tratamento de upload real que não foi encontrado nesta leitura. Vale confirmar com um teste dedicado (ver recomendações).

## Testes recomendados

### Alta prioridade

1. **[Backend Vitest]** `aura-backend/src/__tests__/api/whatsapp-instance.test.ts` — adicionar casos com `MOCK_USER` de role `RECEPTIONIST` e `ESTHETICIAN` chamando `POST`, `DELETE` e `PATCH` de `/api/whatsapp/instance`, e decidir/confirmar o comportamento esperado (hoje passam sem bloqueio — se isso não for intencional, o teste deve documentar a falha de autorização até a rota ser corrigida).
2. **[Backend Vitest]** `aura-backend/src/app/api/companies/[id]/route.ts` — teste novo cobrindo que `PUT` com `logo` no formato `data:image/...;base64,...` (o formato real produzido por `handleLogoUpload`) é aceito ou rejeitado pelo schema Zod atual (`logo: z.string().url().max(500)`); e, separadamente, teste de que um `cnpj` com dígitos verificadores inválidos (ex.: `"11.111.111/1111-11"`) é aceito hoje pelo backend (documentando a lacuna) — arquivo `aura-backend/src/__tests__/api/companies-id.test.ts`.
3. **[Backend Vitest]** `aura-backend/src/app/api/webhooks/whatsapp/route.ts` — teste que confirma explicitamente que um payload de evento `connection.update` do Evolution API sinalizando queda de conexão **não** atualiza `whatsappInstance.status` no banco (documentando a lacuna descrita no problema 1), servindo de guarda de regressão até uma correção ser decidida — arquivo `aura-backend/src/__tests__/api/webhooks-whatsapp.test.ts`.
4. **[E2E Playwright]** `e2e/whatsapp-settings.spec.ts` (ou novo `e2e/settings-profile.spec.ts`) — cenário completo de editar e salvar o Perfil do Negócio: preencher nome, CNPJ válido, endereço, cidade/estado, telefone, redes sociais e público-alvo; clicar em "Salvar Alterações"; verificar toast de sucesso e persistência após reload da página. Hoje **nenhum** teste E2E ou de componente cobre o caminho feliz do formulário principal de Configurações.
5. **[E2E Playwright]** `e2e/settings-profile.spec.ts` — cenário de erro: preencher CNPJ inválido e verificar que o toast de erro aparece e a mensagem "Documento inválido" é exibida no campo, sem chamar a API de salvar (ou chamando e recebendo erro tratado).

### Média prioridade

6. **[Frontend Vitest+RTL]** novo arquivo `__tests__/components/WhatsAppSettings.test.tsx` — cobrir: (a) botão "Conectar WhatsApp" desabilitado sem aceitar termos e habilitado após aceitar (hoje só coberto em E2E, sem mock, tornando o teste dependente do ambiente); (b) `handleConnect` chama `whatsappApi.connect(true)` e transiciona para `CONNECTING` com o QR code retornado; (c) exibição de erro via `showAlert` quando `whatsappApi.connect` retorna `success: false`; (d) `handleDisconnect` abre o `confirm()` do `DialogContext` e só chama `whatsappApi.disconnect()` se confirmado; (e) toggle do chatbot chama `whatsappApi.setChatbotEnabled` com o valor invertido e atualiza o estado, incluindo o caminho de erro (`showAlert`); (f) usuário sem `canManage` (RECEPTIONIST/ESTHETICIAN) não vê os botões de conectar/desconectar/chatbot quando `DISCONNECTED`.
7. **[Frontend Vitest+RTL]** novo arquivo `__tests__/pages/Settings.test.tsx` — cobrir: (a) carregamento inicial popula os campos a partir de `currentCompany` (nome, CNPJ, endereço, telefones, público-alvo, redes sociais); (b) `validateCpfCnpj` bloqueia o submit e mostra `errorMsg` para CNPJ inválido, sem chamar `updateCompany`; (c) submit com dados válidos chama `updateCompany` com o payload esperado (incluindo filtro de telefones vazios) e mostra `successMsg`; (d) exibição de erro quando `updateCompany` retorna `{ success: false, error }`; (e) `addPhone`/`removePhone` atualizam a lista corretamente, inclusive não permitir lista vazia; (f) `WhatsAppSettings` só é renderizado quando `checkModuleAccess('whatsapp_notifications')` é `true`.
8. **[Frontend Vitest]** `__tests__/services/api.test.ts` — adicionar `describe('companiesApi')` cobrindo `get`/`update` (verbo HTTP, URL, corpo serializado, propagação de erro) e `describe('whatsappApi')` cobrindo `getStatus`/`connect`/`disconnect`/`setChatbotEnabled` (métodos HTTP corretos: GET/POST/DELETE/PATCH, e o body de `connect`/`setChatbotEnabled`), seguindo o padrão já usado para `calendarApi` no mesmo arquivo.
9. **[Backend Vitest]** `aura-backend/src/__tests__/api/companies-id.test.ts` — teste de que campos não incluídos no `updateCompanySchema` (ex.: tentativa de alterar `plan` ou `subscriptionStatus` via PUT) são rejeitados pelo `.strict()` do Zod (já parcialmente coberto pelo teste genérico de "campo desconhecido" — vale um teste nomeado explicitamente para esses dois campos sensíveis, já que são superfícies de escalação de privilégio/plano).
10. **[E2E Playwright]** `e2e/whatsapp-settings.spec.ts` — teste de que, ao clicar em "Desconectar WhatsApp" com o WhatsApp já conectado (via mock/seed), o modal de confirmação do `DialogContext` aparece (não `window.confirm`) e cancelar mantém o status `CONNECTED`.

### Baixa prioridade

11. **[E2E Playwright]** cenário de upload de logo em `/settings`: selecionar um arquivo de imagem pequeno, verificar preview, salvar e recarregar a página confirmando que o logo persiste (ou documentando a falha descrita no problema 7, se o backend rejeitar o base64).
12. **[Frontend Vitest+RTL]** teste de que a página de Configurações some/mostra a seção do Google Calendar corretamente (`calendarConnected` true/false) a partir do retorno de `calendarApi.getStatus()`, e que `handleConnectCalendar`/`handleDisconnectCalendar` chamam as funções corretas do `calendarApi` — incluindo, se o problema 3 for confirmado como bug real, um teste que force `window.location.hash` no formato correto de `BrowserRouter` (`?google_calendar=connected` em `window.location.search`, não em `.hash`) para expor a falha do parsing atual.
13. **[Backend Vitest]** teste dedicado para o modo `calendar` de `auth/google/callback/route.ts` verificando o redirect exato `${FRONTEND_URL}/settings?google_calendar=connected` (parece não existir um arquivo de teste específico para este endpoint/modo hoje).
14. **[E2E Playwright]** teste de acessibilidade/role: confirmar que um usuário RECEPTIONIST logado não vê os botões de conectar/desconectar WhatsApp nem o toggle de chatbot na tela de Configurações (cobertura de UI para o problema 2, já que o backend hoje não bloqueia).
