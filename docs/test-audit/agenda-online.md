# Auditoria de Testes — Agenda Online

Escopo: `pages/AccessLink.tsx` (tela de configuração, roles ADMIN/RECEPTIONIST/ESTHETICIAN) e a página pública que consome essa configuração, `pages/PublicBooking.tsx`.

## Funcionalidades identificadas

Em `pages/AccessLink.tsx`:

1. **Exibição do link público** — monta `${window.location.origin}/${currentCompany.slug || currentCompany.id}` e permite copiar (`navigator.clipboard`) ou abrir em nova aba. Não há campo para editar o slug — ver "Problemas encontrados" (item 1).
2. **QR Code do link público** — gerado via serviço externo `api.qrserver.com` (não é gerado localmente), com botão de download.
3. **Configurações de horário do agendamento online** (accordion "Configurações de Horários dos Clientes"), somente dois campos editáveis:
   - `slotInterval` (intervalo de slots: 10/15/30/60 min, `<select>` fechado)
   - `minAdvanceTime` (antecedência mínima: 1h ou 24h, `<select>` fechado)
   - Salva via `updateCompany(id, { onlineBookingConfig })` → `PUT /api/companies/[id]`.
4. **Configuração de layout da página pública** (accordion "Configurar Layout de Acesso Público", visível só para ADMIN/OWNER via `canEditLayout`):
   - 5 presets prontos de estilo ("Aura Premium", "Midnight Gold", "Silk Nude", "Pure Clinic", "Wellness Spa") que sobrescrevem várias cores de uma vez.
   - Campos livres de cor (color picker + input de texto livre, sem validação de formato hex): fundo da página, cor principal, cor do texto, cor de fundo do cabeçalho.
   - Seleção de fonte (serif/inter/system).
   - Botão "Resetar" (`updateCompany(id, { layoutConfig: undefined })`) e "Salvar Design" (`updateCompany(id, { layoutConfig })`).
5. **Bloco estático "Como usar seu link?"** — apenas texto instrucional, sem lógica.

Campos existentes no tipo `OnlineBookingConfig` (`types.ts`) **mas sem qualquer UI correspondente** em `AccessLink.tsx`: `maxBookingPeriod`, `cancellationNotice`, `cancellationPolicy`. Eles têm efeito real em `PublicBooking.tsx` (limitam quantos dias à frente o paciente pode agendar), mas hoje só podem assumir os valores default do `useState` inicial (`maxBookingPeriod: 30`, `cancellationNotice: 1440`, `cancellationPolicy: ''`) ou o que já estiver salvo no banco por outro meio — não há como o ADMIN alterá-los pela tela. Idem para `baseFontSize` do `PublicLayoutConfig` (usado em `PublicBooking.tsx` para tamanho de fonte, mas sem seletor em `AccessLink.tsx`).

Em `pages/PublicBooking.tsx` (contexto, não é o alvo direto da auditoria):
- Wizard de 4 passos (procedimento/plano → profissional → data/horário → dados do paciente) consumindo `company.layoutConfig`, `company.onlineBookingConfig`, `company.businessHours`, `procedures`, `professionals`, `appointments`, `unavailabilityRules`, `subscriptionPlans`.
- Cálculo de slots disponíveis (`getAvailableSlots`) usa `slotInterval`, `minAdvanceTime`, `businessHours`, `unavailabilityRules` e conflitos de agenda/sala.
- Navegação de data (`changeDate`/`handleDirectDateChange`) usa `maxBookingPeriod` para limitar o avanço de datas.
- Suporte a paciente logado, planos de assinatura e paciente novo (com criação de conta e senha).

## Endpoints de backend usados

| Ação na UI | Endpoint | Arquivo |
|---|---|---|
| Salvar layout / salvar regras de horário / resetar layout | `PUT /api/companies/[id]` | `aura-backend/src/app/api/companies/[id]/route.ts` |
| Carregar dados da empresa (via `AppContext`, não diretamente em AccessLink) | `GET /api/companies/[id]` | idem |
| Carregar página pública pelo slug | `GET /api/public/company/[slug]` | `aura-backend/src/app/api/public/company/[slug]/route.ts` |
| Agendamento público (paciente novo) | `POST /api/public/booking` (via `appointmentsApi.createPublic`) | rota não lida nesta auditoria, mas coberta por testes (ver abaixo) |
| Agendamento público via plano de assinatura | `POST /api/public/subscriptions/book` (via `publicBookingApi.bookSubscriptionPlan`) | idem |

No schema Zod de `PUT /api/companies/[id]` (`updateCompanySchema`, `.strict()`):
- `slug` **não é um campo aceito** — confirma que o slug não é editável via essa rota (nem pelo frontend, nem por chamada direta válida).
- `onlineBookingConfig: z.record(z.unknown())` e `layoutConfig: z.record(z.unknown())` — **nenhuma validação de conteúdo**: qualquer chave/valor passa, incluindo tipos errados (string em vez de number, cores fora do padrão hex, números negativos, `minAdvanceTime > maxBookingPeriod`, etc.).

## Cobertura de testes atual

### Backend
Cobertura já existe e é razoavelmente extensa para as rotas envolvidas:

- `aura-backend/src/__tests__/api/companies-id.test.ts` (`GET`/`PUT /api/companies/[id]`): autenticação (401), permissão por role/empresa (403), 404, schema strict rejeitando campo desconhecido (400), erro de `businessHours` inválido (400), atualização de campos válidos (200), mapeamento de aliases `socialMedia`/`targetAudience`, deduplicação de `paymentMethods`, OWNER editando empresa de terceiros.
  - **Não há nenhum teste que envie `onlineBookingConfig` ou `layoutConfig`** no corpo do PUT — nem para o caminho feliz, nem para conteúdo malformado/inconsistente (já que o schema aceita qualquer coisa, não há teste documentando esse comportamento).
- `aura-backend/src/__tests__/api/companies.test.ts` (`GET /api/companies`): não é diretamente relevante a esta aba (lista empresas), mas cobre autenticação, escopo por role e normalização de `paymentMethods`.
- `aura-backend/src/__tests__/api/public-company-slug.test.ts` (`GET /api/public/company/[slug]`): rota pública sem auth, rate limit (429), 404 para slug inexistente, conversão de `Decimal` para `number` em procedimentos e planos, filtro de profissionais (só ADMIN/ESTHETICIAN ativos), filtro de agendamentos futuros/ativos, normalização de status, erro 500 genérico.
  - **Não testa se `layoutConfig`/`onlineBookingConfig` são retornados corretamente** na resposta (a rota faz `select` desses campos, mas nenhum teste afirma isso).
- `aura-backend/src/__tests__/api/public-booking.test.ts` (`POST /api/public/booking`): rate limit, validação de payload, 404 empresa/procedimento/profissional, 409 conflito de horário, criação com sucesso (201), reaproveitamento de paciente existente por email, condição de corrida (P2034) com 409.
  - Cobertura sólida do fluxo de agendamento em si; não testa efeitos de `onlineBookingConfig` (ex.: se o backend chegar a validar antecedência mínima/máxima no futuro).
- `aura-backend/src/__tests__/api/public-subscriptions-book.test.ts`: existe, não lido em detalhe (fora do escopo direto, mas relevante ao fluxo "Promoções" de `PublicBooking.tsx`).

### Frontend
- **Nenhum teste existe para `AccessLink.tsx`** — confirmado por busca em `__tests__/`, que só contém `context/AppContext.test.tsx` e `services/api.test.ts`.
- `__tests__/services/api.test.ts` **não cobre** `companiesApi.update`, `publicApi.getCompanyBySlug` nem `publicBookingApi.bookSubscriptionPlan` (busca por esses nomes não retornou nenhuma ocorrência no arquivo).
- Nenhum teste para `PublicBooking.tsx` como componente (RTL) tampouco.

### E2E
`e2e/public-booking.spec.ts` contém 3 testes, todos navegando para `/booking/${slug}`:
1. "exibe spinner ou conteúdo ao acessar URL de agendamento" — só verifica que o `<body>` não está vazio.
2. "exibe mensagem de erro para slug inexistente" — verifica texto de erro.
3. "wizard mostra passo 1" — verifica que aparece texto de seleção de procedimento quando não há erro.

**Isso não cobre a tela de configuração (`AccessLink.tsx`) — foco desta auditoria — de forma alguma.** Nenhum teste E2E navega para `/access-link`, copia o link, troca cores de layout ou salva regras de horário.

Além disso, foi encontrado um problema estrutural nesse spec — ver "Problemas encontrados", item 4.

## Problemas encontrados durante a revisão

1. **A tarefa de auditoria presumia edição de slug nesta tela, mas essa funcionalidade não existe.** `AccessLink.tsx` apenas exibe `currentCompany.slug` (read-only) dentro do link público; não há input, botão ou chamada de API para editar o slug. O slug é gerado automaticamente no cadastro (`aura-backend/src/app/api/auth/register/route.ts` e `.../auth/google/setup-company/route.ts`, via `slugify(companyName)` com resolução de colisão por sufixo de estado ou contador numérico) e o schema Zod de `PUT /api/companies/[id]` é `.strict()` e **não inclui `slug`** — ou seja, mesmo uma chamada direta à API para mudar o slug seria rejeitada com 400. Não há, portanto, o risco descrito de "mudança de slug quebrando links já compartilhados" a partir desta tela — mas também não há qualquer forma legítima de um cliente personalizar seu slug depois do cadastro automático.

2. **Slug duplicado entre empresas**: mitigado no nível de banco (`slug String @unique` em `schema.prisma`) e no nível de aplicação (busca por slug existente + fallback com sufixo de estado, depois contador incremental) tanto em `register/route.ts` quanto em `google/setup-company/route.ts`. Diferença encontrada entre as duas implementações: `register/route.ts` usa um `while (existingCompany)` **sem limite de tentativas**, enquanto `google/setup-company/route.ts` usa `counter <= 100` e retorna 409 explicitamente se esgotar as tentativas. Isso é uma inconsistência menor (risco teórico de loop longo em `register`), fora do escopo direto desta aba mas ligado ao mesmo mecanismo de slug.

3. **`onlineBookingConfig` e `layoutConfig` não têm validação de conteúdo no backend** (`z.record(z.unknown())` em `updateCompanySchema`). Isso significa que:
   - Nada impede `minAdvanceTime > maxBookingPeriod` (em minutos vs. dias — já são unidades diferentes, o que por si só é uma armadilha: `minAdvanceTime` está em minutos e `maxBookingPeriod` em dias, sem nenhuma normalização/validação cruzada).
   - Nada impede valores negativos, strings, ou cores fora do padrão `#RRGGBB` em `layoutConfig` (os inputs de texto livre em `AccessLink.tsx` também não validam formato hexadecimal — só o `<input type="color">` emparelhado garante formato válido; o campo de texto ao lado aceita qualquer string, incluindo valores que quebrariam o `style={{backgroundColor: ...}}` em `PublicBooking.tsx`).
   - Como a tela atual só oferece dropdowns fechados para `slotInterval`/`minAdvanceTime`, esse risco só se materializa via chamada direta à API (não pela UI atual), mas fica sem qualquer rede de segurança no backend caso a UI evolua.

4. **Suspeita forte de bug no E2E `e2e/public-booking.spec.ts`: o path usado não corresponde ao roteamento real da aplicação.** O spec navega para `/booking/${BOOKING_SLUG}` (ex.: `/booking/demo`), mas o link público real gerado por `AccessLink.tsx` é `${origin}/${slug}` (ex.: `/demo`, sem o segmento `/booking`). Rastreando o roteamento (`App.tsx` → `getClinicSlug()` → `utils/subdomain.ts` → `apps/PatientPortalApp.tsx`):
   - `extractSlugFromPath` trata o **primeiro segmento do path** como slug da clínica, a menos que esteja na lista `ADMIN_ROUTES`. `"booking"` **não está** nessa lista.
   - Logo, ao acessar `/booking/demo`, o sistema interpreta `"booking"` como o slug da clínica (não `"demo"`), monta `prefix = "/booking"` e as únicas rotas registradas são exatamente `/booking/` e `/booking` — a URL real `/booking/demo` não bate com nenhuma delas e cai no `<Route path="*">`, que redireciona para `/booking/` — ou seja, o teste acaba sempre carregando (ou tentando carregar) a empresa de slug **"booking"**, não o slug configurado em `E2E_BOOKING_SLUG`.
   - Efeito prático: o teste 1 e o teste 3 ("wizard mostra passo 1") não testam de fato o slug pretendido — testam se existe (ou não) uma empresa cujo slug literal é `"booking"`. Como isso dificilmente existe em qualquer ambiente, o teste 3 provavelmente sempre cai no ramo `if (!hasError)` como falso e não verifica nada de fato (o `expect` dentro do `if` nunca roda). O teste 2 ("slug inexistente") passa "pelo motivo errado" — não porque o slug realmente não existe, mas porque `"booking"` como slug de clínica também não existe.
   - Isso é uma suspeita a ser confirmada rodando o teste com um `E2E_BOOKING_SLUG` real e observando a URL/estado carregado — mas a leitura do código dá indícios fortes de que o teste está estruturalmente quebrado e nunca validou o fluxo publicado de fato desde que a convenção de rota é `/:slug` e não `/booking/:slug`.

5. **Sem UI para `maxBookingPeriod`, `cancellationNotice` e `cancellationPolicy`** (ver item 1 de "Funcionalidades identificadas"). Não é um bug de execução, mas um gap de produto/teste: esses campos existem no tipo e afetam `PublicBooking.tsx` (`maxBookingPeriod` limita quantos dias à frente dá para agendar), porém o ADMIN não tem como configurá-los pela tela "Agenda Online".

6. **Comparação de preset ativo (`isPresetActive`) é frágil**: compara apenas `backgroundColor`, `primaryColor` e `headerBackgroundColor` do config salvo com o preset. Isso pode marcar um preset como "Em uso" mesmo que o usuário tenha alterado manualmente `textColor`, `cardBackgroundColor`, `cardTextColor` ou `fontFamily` depois de aplicar o preset — falso positivo visual, sem impacto funcional na página pública.

7. **QR Code depende de serviço externo (`api.qrserver.com`)** sem fallback local — se o serviço estiver fora do ar, a imagem do QR Code simplesmente não carrega (sem tratamento de erro/`onError` no `<img>`). Risco baixo, mas vale nota.

## Testes recomendados

### Alta prioridade

1. **[E2E]** Corrigir (ou, se a correção for feita pelo time de dev, então testar) a navegação em `e2e/public-booking.spec.ts` para usar `/${BOOKING_SLUG}` em vez de `/booking/${BOOKING_SLUG}`, alinhado ao link real gerado por `AccessLink.tsx` e à lógica de `utils/subdomain.ts`. Arquivo: `e2e/public-booking.spec.ts`. Cenário: os 3 testes existentes devem navegar para a URL correta; adicionar uma asserção que capture a URL final/roteamento (ex.: checar que não houve redirect para uma tela de "empresa não encontrada" por causa do slug errado) para evitar regressão silenciosa dessa mesma armadilha.
2. **[E2E]** Novo spec cobrindo a tela de configuração: login como ADMIN, navegar até `/access-link`, verificar que o input do link público exibe `origin + '/' + slug`, clicar em "Copiar" e verificar feedback visual ("Copiado!"), abrir o accordion de horários, trocar `slotInterval` e `minAdvanceTime`, clicar "Salvar Regras" e verificar mensagem de sucesso. Arquivo sugerido: `e2e/access-link.spec.ts`.
3. **[Backend Vitest]** `PUT /api/companies/[id]` com `onlineBookingConfig` no corpo — caminho feliz (200, dado persistido corretamente) e verificação de que o valor retornado bate com o enviado. Arquivo: `aura-backend/src/__tests__/api/companies-id.test.ts`.
4. **[Backend Vitest]** `PUT /api/companies/[id]` com `layoutConfig` no corpo — caminho feliz e verificação de que campos parciais (ex.: só `primaryColor`) são aceitos sem apagar os demais campos do objeto (checar se o comportamento atual é "replace total" do JSON, já que não há merge no backend — isso deveria ser documentado com um teste, pois pode ser origem de bug se o frontend não reenviar o objeto completo). Arquivo: `aura-backend/src/__tests__/api/companies-id.test.ts`.
5. **[Backend Vitest]** Documentar via teste o comportamento atual (falta de validação) de `onlineBookingConfig`: enviar `minAdvanceTime: -100`, `slotInterval: "abc"` ou `maxBookingPeriod: 0` e confirmar se a rota aceita (200) hoje — isso vira uma trava de regressão: quando a validação for adicionada, o teste precisará ser atualizado para esperar 400, tornando a mudança de comportamento visível e intencional. Arquivo: `aura-backend/src/__tests__/api/companies-id.test.ts`.
6. **[Frontend Vitest+RTL]** Criar `__tests__/pages/AccessLink.test.tsx`: renderizar com um `currentCompany` mockado (slug definido), verificar que o link exibido é `origin/slug`, simular clique em "Copiar" e checar chamada a `navigator.clipboard.writeText` com o valor correto, simular alteração de `slotInterval`/`minAdvanceTime` e clique em "Salvar Regras", mockando `updateCompany` para retornar sucesso e para retornar erro (`{ success: false, error: '...' }`) — neste último caso, verificar que `showAlert` é chamado com a mensagem de erro (regra do projeto: nunca ignorar retorno de mutação).
7. **[Frontend Vitest+RTL]** No mesmo arquivo, testar o gate de role: usuário `RECEPTIONIST`/`ESTHETICIAN` não deve ver a seção "Configurar Layout de Acesso Público" (`canEditLayout` = false), mas deve ver o link e a seção de horários.

### Média prioridade

8. **[Backend Vitest]** `GET /api/public/company/[slug]`: adicionar asserção explícita de que `layoutConfig` e `onlineBookingConfig` retornam no payload da resposta (hoje o `select` inclui os campos, mas nenhum teste afirma isso — uma remoção acidental do campo no `select` passaria despercebida). Arquivo: `aura-backend/src/__tests__/api/public-company-slug.test.ts`.
9. **[Frontend Vitest+RTL]** Testar `handleResetLayout`: mock de `updateCompany` para `{ layoutConfig: undefined }`, verificar que o estado local volta para `defaultLayout` e mensagem "Layout restaurado para o padrão." aparece; e o caminho de erro (mostrar `showAlert`).
10. **[Frontend Vitest+RTL]** Testar aplicação de preset (`handleApplyPreset`): clicar em um card de preset, verificar que os inputs de cor refletem os valores do preset e que `setHasUnsavedChanges(true)` foi disparado (via mock do contexto).
11. **[E2E]** No fluxo público (`e2e/public-booking.spec.ts`, já corrigido o path do item 1), adicionar um teste que valide o **efeito** da configuração de horário: usando uma empresa de teste com `onlineBookingConfig.minAdvanceTime` alto (ex.: 1440 min), verificar que os horários mais próximos aparecem marcados como "Indisponível" no passo 3 do wizard — conectando a configuração feita em `AccessLink.tsx` ao comportamento real da página pública.
12. **[Backend Vitest]** Teste de regressão para a rota `POST /api/auth/register` cobrindo geração de slug com colisão (nome de empresa repetido) — hoje não está claro se `companies.test.ts`/outro arquivo cobre isso; se não cobrir, adicionar teste que força `findUnique` a retornar empresa existente na primeira chamada e confirma que o `finalSlug` gerado tem o sufixo esperado (estado ou contador).

### Baixa prioridade

13. **[Frontend Vitest+RTL]** Testar `isPresetActive`: dado um `layoutConfig` salvo que bate parcialmente com um preset (mesmas 3 cores comparadas, mas `fontFamily` diferente), confirmar visualmente que o preset ainda aparece marcado como "Em uso" — documentando o comportamento frágil apontado no achado 6 (não necessariamente para "corrigir", mas para não regressar silenciosamente caso a lógica de comparação mude).
14. **[E2E]** Testar o botão "Baixar QR Code" / exibição da imagem do QR Code — no mínimo, verificar que a tag `<img>` do QR Code tem `src` contendo o link público codificado corretamente (`encodeURIComponent`).
15. **[Frontend Vitest+RTL]** Teste de acessibilidade básica dos inputs de cor (par `<input type="color">` + `<input type="text">`): garantir que digitar um valor inválido no campo de texto livre (ex.: `"nao-e-uma-cor"`) não quebra a renderização — hoje não há sanitização, então esse teste documentaria o comportamento atual antes de eventualmente adicionar validação de formato hex.
16. **[Backend Vitest]** Teste de contraste entre `register/route.ts` (loop sem limite) e `google/setup-company/route.ts` (loop limitado a 100 tentativas + 409): considerar alinhar os dois testes/comportamentos, com um teste que simule esgotamento de tentativas em `register/route.ts` para garantir que não trava indefinidamente (hoje não tem cap, então tecnicamente não há como "esgotar" e retornar erro — o teste serviria para forçar a decisão de adicionar um limite).
