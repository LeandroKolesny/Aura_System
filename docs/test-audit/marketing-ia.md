# Auditoria de Testes — Marketing & IA

**Escopo:** `pages/Marketing.tsx` (visão ADMIN/RECEPTIONIST/ESTHETICIAN — `ClinicMarketing` — e visão OWNER — `SaaSMarketing`), `services/geminiService.ts`, `aura-backend/src/app/api/ai/generate/route.ts`, e os endpoints de persistência usados para marcar mensagem enviada (`PUT /api/patients/[id]`, `PUT /api/companies/[id]`).

**Data da auditoria:** 2026-09-09

---

## Funcionalidades identificadas

### `ClinicMarketing` (não-OWNER — ADMIN/RECEPTIONIST/ESTHETICIAN acessam a mesma view)
1. Três abas de segmentação de pacientes, calculadas em `useMemo` (`opportunities`):
   - **Recuperação de Inativos** (`recovery`): pacientes com `lastAppt.status === 'completed'` cuja última visita está a mais de `daysFilter` dias (opções 30/60/90/180/365).
   - **Ciclo de Manutenção** (`maintenance`): pacientes cujo último procedimento tem `procConfig.maintenanceRequired` e já passou de `maintenanceIntervalDays - 15` dias.
   - **Aniversariantes** (`birthday`): calcula `daysUntilBirthday`, `isToday`, idade (`age`/`nextAge`), filtrando por `today` / `week` (≤7 dias) / `month` (≤30 dias).
2. Card "Receita Potencial" (`potentialRevenue`) somando `lastValue` de todas as oportunidades listadas.
3. Geração de mensagem por IA (`handleGenerateMessage`): chama `generateBirthdayMessage` ou `generateReturnMessage` (`services/geminiService.ts` → `POST /api/ai/generate`). Bloqueado se `isReadOnly`.
4. Regeneração de mensagem (`handleRegenerateMessage`) reaproveitando os dados guardados em `selectedPatientData`.
5. Envio da mensagem (`handleSendMessage`): grava `lastMarketingMessageSentAt` via `updatePatient(...)` e abre link `https://wa.me/55<telefone>?text=<mensagem>` em nova aba (**não há integração automática com WhatsApp Business/API — é um deep link manual**).
6. Copiar texto gerado para a área de transferência.
7. Lógica "anti-spam" de exibição: `hasSentMessage = lastMarketingMessageSentAt && (lastVisit ? new Date(lastMarketingMessageSentAt) > new Date(lastVisit) : true)` — desabilita o botão "Gerar Msg" e mostra badge "Enviado"/"Não enviado".
8. Estado de carregamento (`isLoadingData`) e estado vazio ("Nenhuma oportunidade encontrada").

### `SaaSMarketing` (OWNER)
1. Duas abas: **Prevenção de Churn** (planos pagos vencendo em <7 dias ou `overdue`) e **Oportunidades Upsell** (planos `free`/`starter` = upsell; empresas caídas para `basic` com `lastPlan` = `winback`).
2. Card "MRR em Risco" (`totalRiskMRR`), só na aba churn.
3. Geração de mensagem B2B por IA (`handleGenerateMessage` → `generateRetentionMessage`, mapeando cenário `overdue`/`expiring`/`upsell`/`winback`).
4. Regeneração (`handleRegenerateMessage`), cópia (`handleCopyMessage`).
5. Envio (`handleSendWhatsApp`): grava `lastMarketingSentAt` via `updateCompany(...)` **e só abre o `wa.me` se `result.success` for `true`**; se a empresa não tiver telefone, mostra alerta e não abre nada.
6. `hasSentMessage` aqui é um simples `!!opp.lastMarketingSentAt` (sem comparação de data — ver "Problemas encontrados").

### Componente raiz `Marketing`
- Decide a view por `user?.role === UserRole.OWNER ? SaaSMarketing : ClinicMarketing` (qualquer não-OWNER cai em `ClinicMarketing`).
- Gate de plano: `hasMarketingAccess = checkModuleAccess('ai_features') || checkModuleAccess('crm')`; sem acesso, envolve o conteúdo em `<UpgradeOverlay>` (blur + `pointer-events-none`, funciona corretamente como bloqueio visual/interativo no frontend).

### `services/geminiService.ts`
- Wrapper fino sobre `POST {API_BASE_URL}/api/ai/generate`, usado pelas duas views (`generateReturnMessage`, `generateBirthdayMessage`, `generateRetentionMessage`) e por outras telas (`summarizeAnamnesis`, `generateFollowUpMessage` — não usadas em Marketing.tsx).

---

## Endpoints de backend usados

| Endpoint | Uso na aba Marketing | Arquivo |
|---|---|---|
| `POST /api/ai/generate` | Geração de mensagens (`return`, `birthday`, `retention`) | `aura-backend/src/app/api/ai/generate/route.ts` |
| `PUT /api/patients/[id]` | Persistir `lastMarketingMessageSentAt` (via `updatePatient`) | `aura-backend/src/app/api/patients/[id]/route.ts` |
| `PUT /api/companies/[id]` | Persistir `lastMarketingSentAt` (via `updateCompany`) | `aura-backend/src/app/api/companies/[id]/route.ts` |

Não há chamada a nenhuma rota de `aura-backend/src/app/api/whatsapp/*` a partir de Marketing.tsx — o "envio" é sempre um link `wa.me` manual, não uma integração de disparo automático.

---

## Cobertura de testes atual

### Backend
- **`ai-generate.test.ts`** (`aura-backend/src/__tests__/api/ai-generate.test.ts`) — cobertura boa e específica: 401 sem auth, 400 sem `type`/`data`, 400 para tipo não suportado, fallback estático sem `GEMINI_API_KEY` para `return`/`birthday`/`followup`/`retention`/`anamnesis`, sanitização anti-prompt-injection, uso real do Gemini com limpeza de markdown, texto vazio do Gemini, e falha do Gemini → 500. **Não cobre**: nenhuma verificação de `role` ou de módulo de plano (porque a rota não implementa nenhuma — ver Problemas).
- **`patients-id.test.ts`** / **`patients.test.ts`** — cobrem CRUD/validação genérica de paciente (email duplicado, 404, permissões de role, soft delete). Não há nenhum teste que envie `lastMarketingMessageSentAt` no `PUT` e verifique se o campo é persistido.
- **`companies-id.test.ts`** — já tem um teste genérico (`companies-id.test.ts:106`, "retorna 400 para dados inválidos (schema strict rejeita campos desconhecidos)") que, sem intenção, comprova o mesmo mecanismo que quebra `lastMarketingSentAt` (ver Problema #3). Não há teste específico com esse campo.
- **`marketing-consent.test.ts`** — cobre `GET/PUT /api/account/marketing-consent`, mas isso é o opt-in de e-mail do **usuário da plataforma** (staff da clínica) para receber marketing do próprio Aura System — **não tem nenhuma relação com consentimento do Patient para receber WhatsApp da clínica**, que é o que a aba Marketing dispara.
- Nenhum teste (backend) cobre o modelo `Patient` quanto a consentimento/opt-out de marketing, porque **o campo não existe no schema** (`model Patient` não tem nenhum `marketingConsent`/`optOut`, apenas `lastMarketingMessageSentAt`, que é só um timestamp de "última vez que foi contatado", não uma permissão).

### Frontend
- Confirmado: `C:\Aura_System\__tests__\` só contém `context/AppContext.test.tsx`, `services/api.test.ts` e `setup.ts`. **Não existe nenhum arquivo de teste de página ou componente** — nem para Marketing, nem para nenhuma outra página.
- `AppContext.test.tsx` testa `updatePatient`/`updateCompany` de forma genérica (sucesso e propagação de erro da API), mas **não** com os campos `lastMarketingMessageSentAt`/`lastMarketingSentAt` especificamente, e não testa nenhuma lógica de `pages/Marketing.tsx`.
- **Nenhum teste cobre**: a lógica de segmentação de oportunidades (datas de aniversário, dias de inatividade, ciclo de manutenção), o cálculo de `hasSentMessage` (anti-duplicidade), o comportamento de `handleSendMessage`/`handleSendWhatsApp` (inclusive o fato de que um deles não trata o retorno da API — ver Problema #2), nem o gate `hasMarketingAccess`/`UpgradeOverlay`.

### E2E
- Specs existentes em `C:\Aura_System\e2e\`: `dashboard.spec.ts`, `forgot-password.spec.ts`, `login.spec.ts`, `public-booking.spec.ts`, `register.spec.ts`, `whatsapp-settings.spec.ts`. **Nenhum menciona ou cobre `/marketing`.** Zero cobertura E2E para a aba Marketing & IA, tanto na visão clínica quanto na visão SaaS/Owner.

---

## Problemas encontrados durante a revisão

1. **[CRÍTICO — LGPD] Não existe nenhum campo de consentimento/opt-out de marketing no model `Patient`.** O schema (`aura-backend/prisma/schema.prisma`) só tem `marketingConsent`/`marketingConsentAt`/`marketingConsentIp` no model `User` (staff da própria clínica, para receber e-mail de marketing do Aura System — feature totalmente diferente, implementada em `docs/plans/2026-03-27-lgpd-compliance.md` Task 3). Para o `Patient`, existe apenas `lastMarketingMessageSentAt` (timestamp de controle de duplicidade, não uma permissão). Ou seja: **nenhum paciente tem como registrar que não quer mais receber contato promocional**, e `ClinicMarketing` não filtra/bloqueia ninguém por esse motivo — todo paciente com `birthDate`/histórico de visita elegível aparece na lista e pode receber mensagem indefinidamente. Isso é uma lacuna de conformidade LGPD (direito de revogação do consentimento, art. 8º §5º) — é ausência de funcionalidade, não um bug pontual de código.

2. **[CRÍTICO — bug/violação da própria regra do projeto] `ClinicMarketing.handleSendMessage` não verifica o retorno de `updatePatient` (mutação assíncrona ignorada).**
   ```js
   const handleSendMessage = () => {
       const patient = patients.find(p => p.id === selectedPatientId);
       if (patient && generatedMsg) {
           updatePatient(patient.id, { lastMarketingMessageSentAt: new Date().toISOString() }); // não aguardado, retorno ignorado
           const phone = patient.phone.replace(/\D/g, '');
           window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(generatedMsg)}`, '_blank');
           setGeneratedMsg(null);
           setSelectedPatientId(null);
       }
   };
   ```
   Isso viola diretamente a regra "Tratamento de erros (OBRIGATÓRIO)" do `CLAUDE.md` do projeto ("nunca ignorar o retorno de funções assíncronas de mutação"). Compare com `SaaSMarketing.handleSendWhatsApp`, que faz `await updateCompany(...)`, checa `result.success` e só abre o WhatsApp se der certo — ou seja, as duas metades da mesma tela tratam o mesmo tipo de operação de forma inconsistente, e a versão da clínica (a mais usada, no dia a dia) é a que está errada.

3. **[CRÍTICO — bug funcional, feature quebrada] `updateCompanySchema` (`aura-backend/src/app/api/companies/[id]/route.ts`) é `.strict()` e não inclui `lastMarketingSentAt`.** O campo existe no Prisma (`schema.prisma:165`) e é exatamente o que `SaaSMarketing.handleSendWhatsApp` envia, mas como o schema Zod é `.strict()`, o `safeParse` falha e a rota retorna 400 "Dados inválidos". Isso já está comprovado pelo teste genérico existente `companies-id.test.ts:106` ("schema strict rejeita campos desconhecidos"), que usa exatamente esse mecanismo com outro nome de campo qualquer. Consequência real: como `handleSendWhatsApp` **verifica** `result.success` (ponto positivo, ver item 2), o fluxo cai no `showAlert(result.error)` e faz `return` — **a mensagem de retenção/upsell nunca é enviada e o WhatsApp nunca abre**. A funcionalidade "Customer Success (SaaS) → Enviar no WhatsApp" parece estar 100% quebrada.

4. **[ALTO — bug funcional silencioso] `updatePatientSchema` (`aura-backend/src/lib/validations/patient.ts`) não inclui `lastMarketingMessageSentAt` e NÃO é `.strict()`.** Diferente do caso da empresa, aqui o Zod aceita a requisição normalmente (200 OK) mas descarta silenciosamente o campo antes do `prisma.patient.update` — o valor nunca é persistido no banco. Combinado com o Problema #2 (retorno não verificado), essa falha é totalmente invisível na UI: o usuário vê o WhatsApp abrir normalmente, acha que "enviou", mas ao recarregar a página o paciente volta a aparecer como "Não enviado" e pode ser re-contatado (ou re-gerar a mensagem) sem limite. O mecanismo de "evitar spam ao mesmo paciente" citado no escopo desta auditoria **não funciona hoje**.

5. **[MÉDIO — RBAC/plano não reforçado no backend] `POST /api/ai/generate` só verifica autenticação (`getAuthUser`), sem checar `role` nem o módulo de plano (`ai_features`/`crm`).** O gate de plano (`checkModuleAccess`) e o `UpgradeOverlay` existem só no frontend. Qualquer usuário autenticado da empresa (inclusive `RECEPTIONIST`/`ESTHETICIAN`, ou uma empresa em plano sem IA) pode chamar a rota diretamente (fora da UI) e gerar mensagens via Gemini, consumindo cota paga sem estar habilitado pelo plano contratado.

6. **[MÉDIO — RBAC frontend incompleto] A rota `/marketing` (`App.tsx`) não tem guard de `role` — apenas o item do menu é escondido na `Sidebar` para quem não é `ADMIN`/`OWNER`.** Como `Marketing.tsx` só distingue `OWNER` de "todo o resto" (`user?.role === UserRole.OWNER ? <SaaSMarketing/> : <ClinicMarketing/>`), um `RECEPTIONIST` ou `ESTHETICIAN` que navegue manualmente para `/marketing` visualiza a mesma tela `ClinicMarketing` que um `ADMIN` veria (dados de pacientes, receita potencial, geração/"envio" de mensagens), quando o escopo documentado da aba é ADMIN/OWNER.

7. **[BAIXO — confiabilidade] O status "Enviado" é gravado no momento em que o botão é clicado e `window.open` é disparado, não quando a mensagem é de fato enviada dentro do WhatsApp.** O usuário pode fechar a aba do WhatsApp, cancelar o envio, ou o número pode ser inválido — mesmo assim o sistema (quando o Problema #3/#4 forem corrigidos) marcaria como contatado.

8. **[BAIXO] `hasSentMessage` em `SaaSMarketing` é um `!!lastMarketingSentAt` simples, sem janela de validade** (diferente do lado paciente, que compara com `lastVisit`). Uma vez que uma empresa recebe uma campanha de churn/upsell, ela nunca mais volta a aparecer como elegível em ciclos futuros — não há expiração/reset do "enviado".

---

## Testes recomendados

### Alta prioridade

1. **[Backend Vitest]** `PUT /api/companies/[id]` deve aceitar e persistir `lastMarketingSentAt` — arquivo: `aura-backend/src/__tests__/api/companies-id.test.ts`. Cenário: ADMIN/OWNER autenticado, empresa existente, `PUT` com body `{ lastMarketingSentAt: '<ISO date>' }`; esperar `res.status === 200` e que `prisma.company.update` tenha sido chamado com `lastMarketingSentAt` dentro de `data`. **Hoje esse teste falharia com 400** (reproduz o Problema #3) — serve tanto para travar a correção quanto para não deixar a regressão voltar.

2. **[Backend Vitest]** `PUT /api/patients/[id]` deve persistir `lastMarketingMessageSentAt` quando enviado — arquivo: `aura-backend/src/__tests__/api/patients-id.test.ts`. Cenário: `PUT` com `{ lastMarketingMessageSentAt: '<ISO date>' }`; esperar 200 **e** que o objeto passado para `prisma.patient.update({ data })` contenha esse campo (hoje ele é removido pelo `.partial()` do `updatePatientSchema` sem `.extend()`, reproduzindo o Problema #4 de forma silenciosa — vale destacar no teste um comentário/assert que capture exatamente essa omissão).

3. **[Frontend Vitest+RTL]** `pages/Marketing.tsx` (`ClinicMarketing`) — `handleSendMessage` deve aguardar `updatePatient` e, se `result.success` for `false`, chamar `showAlert(result.error ?? 'Erro inesperado.')` e **não** abrir o WhatsApp (mockar `window.open` e o retorno de `updatePatient` via contexto). Arquivo sugerido: `__tests__/pages/Marketing.test.tsx`. Este teste documenta e força a correção do Problema #2 (hoje falha porque o código nem aguarda a Promise).

4. **[Frontend Vitest+RTL]** `pages/Marketing.tsx` (`ClinicMarketing`) — o botão "Gerar Msg" deve ficar desabilitado e mostrar o badge "Enviado" quando `lastMarketingMessageSentAt` do paciente é mais recente que `lastVisit`, e deve permanecer habilitado/"Não enviado" quando é mais antigo (regressão exata da lógica de anti-duplicidade descrita no Problema #4/#1 do escopo). Arquivo: `__tests__/pages/Marketing.test.tsx`.

5. **[Backend Vitest]** Consentimento/opt-out de marketing para `Patient` (a implementar): assim que um campo equivalente for adicionado ao schema (`Patient.marketingOptOut` ou similar), criar testes cobrindo: (a) endpoint de opt-out retorna 200 e persiste o campo; (b) `GET`/listagem de pacientes elegíveis para marketing **exclui** quem optou por não receber; (c) tentativa de gerar/enviar mensagem para paciente com opt-out retorna 403/409 com mensagem clara. Arquivo sugerido: `aura-backend/src/__tests__/api/patients-marketing-opt-out.test.ts` (ou nome equivalente à rota que vier a ser criada). Esta é a lacuna mais sensível legalmente (LGPD) e não tem como ser testada hoje porque a funcionalidade não existe — está listada aqui para não ser esquecida quando for implementada.

6. **[E2E Playwright]** Fluxo completo da aba Marketing (visão clínica): login como ADMIN → navegar para `/marketing` → trocar entre as três abas (Recuperação/Manutenção/Aniversariantes) → gerar mensagem para um paciente elegível → verificar que o modal de sugestão aparece → clicar "Copiar Texto" e validar toast de sucesso. Arquivo: `e2e/marketing.spec.ts`. Prioridade alta por ser a primeira cobertura E2E da aba (hoje zero).

### Média prioridade

7. **[Frontend Vitest+RTL]** Lógica de segmentação (`opportunities` `useMemo`) de `ClinicMarketing`: dado um conjunto de pacientes/agendamentos mockados, verificar que (a) aba "Recuperação" só lista pacientes com `daysAgo >= daysFilter` para cada valor do filtro (30/60/90/180/365); (b) aba "Ciclo de Manutenção" só lista quem tem `procedure.maintenanceRequired` e já passou de `maintenanceIntervalDays - 15`; (c) aba "Aniversariantes" calcula corretamente `isToday`, `daysUntilBirthday` e a idade que a pessoa está completando, inclusive no caso de aniversário já ter passado no ano corrente (rollover para o ano seguinte).

8. **[Backend Vitest]** `POST /api/ai/generate` — adicionar verificação de autorização por `role`/plano (após a correção do Problema #5): teste que usuário sem módulo `ai_features`/`crm` habilitado recebe 403. Arquivo: `ai-generate.test.ts`.

9. **[Frontend Vitest+RTL]** `Marketing.tsx` (componente raiz) — roteamento por role: `user.role === OWNER` renderiza `SaaSMarketing`; qualquer outro role habilitado renderiza `ClinicMarketing`; sem `hasMarketingAccess`, o conteúdo aparece dentro de `UpgradeOverlay` (verificar que os botões de ação ficam com `pointer-events: none`/não disparam `onClick` quando clicados via `fireEvent`).

10. **[Frontend Vitest+RTL]** `SaaSMarketing` — segmentação de oportunidades: plano pago vencendo em <7 dias ou `overdue` cai em "churn"; plano `free`/`starter` cai em "upsell"; plano `basic` com `lastPlan` preenchido cai em "winback" (e usa `lastPlanName` na exibição/target da mensagem). Verificar também que `totalRiskMRR` soma apenas os itens da aba churn.

11. **[E2E Playwright]** Fluxo Customer Success (visão OWNER): login como OWNER → `/marketing` → aba "Prevenção de Churn" → gerar mensagem para uma clínica em risco → clicar "Enviar no WhatsApp" → confirmar que o badge muda para "Enviado" (só faz sentido após correção do Problema #3; até lá, este teste documentaria o bug ao falhar). Arquivo: `e2e/marketing-saas.spec.ts`.

12. **[Backend Vitest]** `POST /api/ai/generate` com `GEMINI_API_KEY` configurada — cenário de timeout/demora: mockar `generateContent` para rejeitar com erro de timeout e confirmar que a rota retorna 500 com `{ error: "Erro ao gerar mensagem" }` (já parcialmente coberto para erro genérico — vale um teste específico simulando timeout/`AbortError` para garantir que não trava a requisição indefinidamente).

### Baixa prioridade

13. **[Frontend Vitest+RTL]** Botão "Gerar Novo Texto" (`handleRegenerateMessage`) chama novamente `generateReturnMessage`/`generateBirthdayMessage`/`generateRetentionMessage` reaproveitando os dados guardados (`selectedPatientData`/`selectedCompanyData`), e fica desabilitado (`disabled`) enquanto `isGenerating` é `true`.

14. **[Frontend Vitest+RTL]** Estado vazio ("Nenhuma oportunidade encontrada...") e estado de loading (`isLoadingData` com spinner) renderizam corretamente quando as listas estão vazias/carregando.

15. **[Backend Vitest]** `GET`/listagem de pacientes usada para popular `opportunities` — garantir que `lastMarketingMessageSentAt` é sempre retornado no payload do paciente (hoje é consumido pelo frontend, mas vale um teste de contrato garantindo que o campo não seja removido do `select`/serialização por engano no futuro).

16. **[E2E Playwright]** Acessibilidade básica da aba Marketing: navegação por teclado entre as abas (Recuperação/Manutenção/Aniversariantes) e foco visível no botão "Gerar Msg".
