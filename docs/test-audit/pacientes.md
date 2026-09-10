# Auditoria de Testes — Pacientes

> Escopo: aba "Pacientes" (roles ADMIN/OWNER/RECEPTIONIST/ESTHETICIAN) — listagem, ficha do paciente, importação CSV, consentimento LGPD, assinatura por procedimento, fotos antes/depois (upload, marcação, download, exclusão), IA (resumo de anamnese, follow-up), solicitação de anamnese via WhatsApp.
>
> Arquivos revisados: `pages/Patients.tsx`, `pages/PatientDetail.tsx`, `components/ImportCSVModal.tsx`, `components/PhotoAnnotationModal.tsx`, `components/Modals.tsx` (NewPatientModal, NewPhotoModal, SignatureModal, SignatureHistoryModal), `context/AppContext.tsx`, `services/api.ts`, `services/geminiService.ts`, `utils/formatUtils.ts`, `utils/maskUtils.ts`, e as rotas de backend correspondentes em `aura-backend/src/app/api/patients/**`, `aura-backend/src/app/api/photos/route.ts`, `aura-backend/src/app/api/appointments/[id]/consent/route.ts` e `.../signature-history/route.ts`, além de `aura-backend/src/lib/validations/patient.ts`.

## Funcionalidades identificadas

1. **Listagem de pacientes** (`pages/Patients.tsx`) — busca client-side por nome/email, KPIs (total, ativos, com visita), tabela com badge de status (`active`/`lead`/`inactive`), agrupamento por empresa com seções expansíveis para OWNER, ação editar (navega para ficha com `editMode`) e excluir (com dialog de confirmação), FAB mobile, bloqueio de escrita via `isReadOnly`.
2. **Criar paciente** (`NewPatientModal` em `Modals.tsx`) — validação client-side de nome/telefone obrigatórios, CPF (`validateCPF`) e data de nascimento (`validateBirthDate`), toggle "enviar convite de acesso".
3. **Editar paciente** (`PatientDetail.tsx`, modo inline `isEditing`) — formulário visível edita apenas `name` e `status`; valida `birthDate` em `handleSaveEdit` antes de salvar.
4. **Excluir paciente** (`Patients.tsx handleDelete`) — confirmação via `useDialog().confirm`, chama `removePatient` → backend faz soft delete (`status = INACTIVE`).
5. **Importação em massa via CSV/XLSX** (`ImportCSVModal.tsx` + rota `import`) — download de template `.xlsx`, upload com validação de extensão no frontend, resultado com contadores de importados/atualizados/erros por linha.
6. **Consentimento geral LGPD** — assinar (`SignatureModal` + `signConsent`), corrigir assinatura existente (exige motivo ≥3 caracteres), ver histórico de versões (`SignatureHistoryModal` com `source="patient-consent"`).
7. **Assinatura por procedimento** (dentro do histórico de agendamentos da ficha) — ver comprovante digital (`AppointmentEvidenceModal`) com assinatura + metadados de auditoria (IP, user-agent, data/hora), corrigir assinatura (`signAppointmentConsent`), ver histórico (`SignatureHistoryModal` com `source="appointment"`).
8. **Upload de fotos antes/depois** (`NewPhotoModal`) — validação de tipo de arquivo (`ALLOWED_IMAGE_TYPES`) e tamanho (`MAX_FILE_SIZE_BYTES`) no frontend, conversão para base64, campo de procedimento como `<select>` (lista dinâmica de procedimentos já realizados) ou texto livre, campo "Fase" (antes/depois) travável (`lockFields`) quando adicionando o "depois" de um conjunto já existente.
9. **Agrupamento de fotos por procedimento + groupId** (`photosByProcedure` — `useMemo` em `PatientDetail.tsx`) — lógica de negócio no frontend que agrupa fotos em `{ [procedure]: { [groupId]: { before, after } } }` para parear antes/depois do mesmo "conjunto".
10. **Marcação em fotos** (`PhotoAnnotationModal.tsx`, Konva) — ferramentas círculo/seta/traço livre, cores, desfazer/limpar, salva o resultado como **nova** foto (`addPhoto`) com `groupId` derivado (`${photo.groupId}_anotado_${timestamp}`), preservando a original.
11. **Download de foto** (`downloadPhoto` em `utils/formatUtils.ts`) — monta nome de arquivo a partir de procedimento/fase/data e extensão detectada da data URL.
12. **Exclusão de foto** — modal de confirmação, `removePhoto`.
13. **Geração de resumo de anamnese via IA** (`summarizeAnamnesis` → `POST /api/ai/generate` tipo `anamnesis`).
14. **Geração de mensagem de follow-up via IA** (`generateFollowUpMessage` → mesmo endpoint, tipo `followup`) + envio via WhatsApp (`handleSendFollowUp`, monta link `wa.me`).
15. **Solicitação de anamnese via WhatsApp** (`sendAnamnesisLink`) — monta link `wa.me` com mensagem fixa e marca `anamnesisLinkSent` via `toggleAnamnesisSent` (que delega a `updatePatient`).
16. **Histórico de procedimentos** na ficha — lista agendamentos do paciente ordenados por data, com status e indicador de assinatura.

## Endpoints de backend usados

| Endpoint | Método | Uso |
|---|---|---|
| `/api/patients` | GET | Listar pacientes da empresa (busca, paginação, ordenação) |
| `/api/patients` | POST | Criar paciente |
| `/api/patients/[id]` | GET | Ficha completa (paciente + últimos 10 agendamentos + 20 fotos + 10 transações) |
| `/api/patients/[id]` | PUT | Atualizar paciente |
| `/api/patients/[id]` | DELETE | Soft delete (status → INACTIVE) |
| `/api/patients/import` | POST | Importação em massa CSV/XLSX |
| `/api/patients/[id]/consent` | POST | Assinar/corrigir consentimento LGPD |
| `/api/patients/[id]/consent` | GET | Status do consentimento (`hasConsent`) |
| `/api/patients/[id]/consent/history` | GET | Histórico de versões da assinatura de consentimento |
| `/api/photos` | GET | Listar fotos (filtro por `patientId`/`groupId`) |
| `/api/photos` | POST | Criar foto (upload) |
| `/api/photos` | DELETE (`?id=`) | Remover foto |
| `/api/appointments/[id]/consent` | POST | Assinar/corrigir assinatura de um procedimento específico |
| `/api/appointments/[id]/signature-history` | GET | Histórico de assinaturas do procedimento |
| `/api/ai/generate` | POST | Resumo de anamnese e mensagem de follow-up (endpoint genérico de IA, compartilhado com outras telas) |
| `/api/king/patients` | GET | Visão global de pacientes (todas as empresas) — usado pelo módulo King/OWNER; **não** é chamado por `loadPatients()` (ver seção de problemas) |

## Cobertura de testes atual

### Backend
Cobertura extensa e específica já existe em `aura-backend/src/__tests__/api/`:

- **`patients.test.ts`** (28 testes) — GET (paginação, busca, 403 para PATIENT, 401, 403 sem empresa, campos de assinatura no select), POST (criação, 409 email duplicado, 403 role, 400 validação, log de atividade, bloqueio por limite do plano), GET/PUT/DELETE `[id]` (404, 401, 403 role, soft delete confirmado).
- **`patients-id.test.ts`** (16 testes) — cobre praticamente o mesmo conjunto de cenários de `[id]` com foco em auditoria (log de atividade), conversão de `birthDate` string→Date, duplicidade de email ao editar (permitindo manter o mesmo email).
- **`patients-import.test.ts`** (11 testes) — importação com sucesso, upsert por email, erro por linha (nome ausente, data inválida), formato `DD/MM/YYYY`, paciente sem email (placeholder), CSV sem coluna `nome`, CSV vazio, 401/403, mistura de linhas válidas/inválidas.
- **`patients-consent.test.ts`** (16 testes) — 401/403 (inclusive **PATIENT bloqueado de assinar**), RECEPTIONIST pode assinar em nome do paciente, 404, 400 sem assinatura, captura de IP/user-agent, fallback "unknown", **correção sem motivo é rejeitada (400)**, correção com motivo preserva histórico, **backfill de assinatura legada sem histórico prévio**, 500 sem vazar detalhes, GET de status (`hasConsent`).
- **`patients-consent-history.test.ts`** (5 testes) — 401, **PATIENT bloqueado de ver histórico**, 404, ordem cronológica, 500 sem vazar detalhes.
- **`photos.test.ts`** (25 testes) — GET (401, lista, filtro por `patientId`, cap de 100 registros, isolamento por `companyId`), POST com validação Zod extensiva (XSS via `javascript:`/`ftp:` na URL, enum de tipo, aceitação de `before`/`after` minúsculo, data URL base64 válida/; rejeição de mime não-imagem e payload não-base64; formatos de data `YYYY-MM-DD` e ISO completo), DELETE (400 sem id, isolamento por empresa, 401).
- **`appointments-consent.test.ts`** (12 testes) e **`appointments-signature-history.test.ts`** (6 testes) — assinatura por procedimento: equipe assina em nome do paciente, **paciente assina o próprio agendamento**, **paciente bloqueado de assinar/ver agendamento de outro paciente**, correção com/sem motivo, backfill de assinatura legada, 500 sem vazar detalhes.
- **`king-patients.test.ts`** (7 testes) — visão global do OWNER via `/api/king/patients` (sem filtro de `companyId`, 403 para ADMIN).

**Conclusão**: a funcionalidade de assinatura (consentimento LGPD geral + assinatura por procedimento, correção e histórico) implementada nesta mesma sessão de trabalho **já tem cobertura de backend muito boa e específica** — incluindo os casos de borda mais delicados (backfill de assinatura legada, correção sem motivo, isolamento entre pacientes, vazamento de erro interno). Não há necessidade de testes de backend adicionais para esse fluxo especificamente; as lacunas reais estão no frontend e em E2E (abaixo), e em dois pontos pontuais de isolamento por empresa detalhados na seção de problemas.

### Frontend
Confirmado: hoje só existem dois arquivos de teste em `__tests__/` — `__tests__/context/AppContext.test.tsx` e `__tests__/services/api.test.ts`. **Não existe nenhum teste de página ou componente React** (Vitest + RTL) para nada relacionado a Pacientes.

`AppContext.test.tsx` já cobre, na camada de estado global (não na UI):
- `signConsent` / correção de consentimento (chama `patientsApi.signConsent`, não o update genérico).
- `signAppointmentConsent`.
- `addPhoto` (sucesso).
- `removePhoto` (erro de conexão não remove localmente).
- `addPatient` / `updatePatient` / `removePatient` / `toggleAnamnesisSent` (sucesso e propagação de erro da API, incluindo regressões específicas: "propaga erro em vez de fingir sucesso").

Isso significa que a camada de dados (`AppContext`) tem alguma cobertura, mas **nenhum componente/página que consome esse estado é testado**: `Patients.tsx`, `PatientDetail.tsx`, `ImportCSVModal.tsx`, `PhotoAnnotationModal.tsx`, e os modais `NewPatientModal`, `NewPhotoModal`, `SignatureModal`, `SignatureHistoryModal` não têm nenhum teste de renderização, interação ou lógica de negócio embutida no componente. Em particular, sem cobertura:
- Agrupamento `photosByProcedure` (before/after por `groupId`) — lógica pura dentro de um `useMemo`, fácil de quebrar silenciosamente.
- Cálculo/exibição do "badge de correção" (`!!patient.consentCorrectionCount`, `!!appointment.signatureCorrectionCount`).
- Tratamento de paciente sem `birthDate` (campo opcional) em `formatDate`, na listagem e na ficha.
- Validação de `validateBirthDate`/`validateCPF` nos formulários de criação/edição.
- Exibição condicional de erro (`showAlert`) quando `removePatient`/`removePhoto`/`signConsent`/`signAppointmentConsent`/`addPhoto` retornam `{success:false}`.

### E2E
Specs existentes em `e2e/`: `dashboard.spec.ts`, `login.spec.ts`, `forgot-password.spec.ts`, `public-booking.spec.ts`, `register.spec.ts`, `whatsapp-settings.spec.ts`. **Confirmado: nenhum spec cobre o fluxo de paciente** (criar, editar, importar, assinar consentimento, upload de foto, etc.). Esta é a maior lacuna estrutural da aba.

## Problemas encontrados durante a revisão

(Anotados conforme solicitado — **sem corrigir**.)

1. **Isolamento entre empresas (companyId) em `POST /api/photos`**: a rota (`aura-backend/src/app/api/photos/route.ts`) valida o corpo com Zod mas **nunca verifica que o `patientId` informado pertence a `user.companyId`** antes de criar o registro — a foto é salva com `companyId: user.companyId!` mas o `patientId` pode apontar para um paciente de outra empresa (o Prisma só exige que o FK exista, não que a empresa bata). Isso permite, na prática, anexar uma foto de "antes/depois" a um paciente de outra clínica. Não há teste cobrindo esse cenário em `photos.test.ts` (o teste de isolamento existente cobre apenas GET e DELETE, não POST).
2. **`loadPatients()` no `AppContext` nunca usa `/api/king/patients`**: o `AppContext.loadPatients()` sempre chama `patientsApi.list()` → `GET /api/patients`, que retorna 403 quando `user.companyId` é nulo. A página `Patients.tsx` trata explicitamente o caso `isOwner` (agrupando pacientes por empresa usando o array `companies`), o que sugere que a intenção original era usar a visão global (`kingApi.patients` → `/api/king/patients`, que já existe e é testado em `king-patients.test.ts`). Vale confirmar manualmente se o usuário OWNER possui um `companyId` válido — caso não possua, a aba Pacientes provavelmente carrega vazia para esse role, e o agrupamento por empresa em `Patients.tsx` nunca teria dados para exibir.
3. **Paginação inexistente na listagem**: `loadPatients()` chama `patientsApi.list({ limit: 100 })` com limite fixo e a UI de `Patients.tsx` não tem nenhum controle de paginação/"carregar mais". Clínicas com mais de 100 pacientes ativos nunca verão os excedentes na lista, mesmo que o backend suporte paginação (`page`/`limit`) e a busca seja apenas client-side sobre o array já carregado.
4. **Texto de exclusão de paciente é enganoso**: `Patients.tsx handleDelete` exibe "Esta ação não pode ser desfeita", mas o backend faz soft delete (`status → INACTIVE`), ou seja, é reversível (bastaria reativar o paciente). Não é um bug funcional, mas é uma mensagem incorreta para o usuário final.
5. **Formulário de edição de paciente incompleto**: em `PatientDetail.tsx`, o modo `isEditing` só renderiza campos para `name` e `status`; `editData` inclui `phone`, `email` e `birthDate` (e `handleSaveEdit` chega a validar `birthDate`), mas não há nenhum `<input>` visível para o usuário alterar esses três campos. Parece uma funcionalidade parcialmente implementada — vale confirmar com o time se é intencional ou um regressão de UI.
6. **"Enviar convite de acesso" em `NewPatientModal` é só um `console.log`**: quando `sendInvite` está marcado, o texto promete um e-mail com link de acesso, mas o código só executa `console.log(...)` — não há chamada de API para de fato disparar o envio. Se o backend já dispara esse e-mail automaticamente ao criar o paciente, o `console.log` é código morto; caso contrário, a funcionalidade anunciada na UI não existe.
7. **Regex de nome não aceita hífen/apóstrofo**: `createPatientSchema.name` usa `/^[a-zA-ZÀ-ÿ\s]+$/`, que rejeita nomes como "Ana-Paula" ou "O'Brien". Efeito colateral em clínicas com clientes de nomes compostos por hífen.
8. **Permissões de importação CSV diferem das de criação manual**: `POST /api/patients` permite `OWNER/ADMIN/RECEPTIONIST/ESTHETICIAN`, mas `POST /api/patients/import` só permite `OWNER/ADMIN/RECEPTIONIST` (`ALLOWED_ROLES` em `import/route.ts`) — ESTHETICIAN não pode importar em massa embora possa cadastrar um a um. Pode ser intencional, mas não está documentado nem testado explicitamente como regra de negócio (o teste de 403 em `patients-import.test.ts` cobre apenas PATIENT).

## Testes recomendados

### Alta prioridade

1. **[Backend]** `POST /api/photos` deve rejeitar (404 ou 403) quando `patientId` pertence a um paciente de **outra empresa** — arquivo: `aura-backend/src/__tests__/api/photos.test.ts`. Cenário: usuário autenticado da Empresa A envia `patientId` de um paciente da Empresa B; hoje nada impede a criação. Cobre o achado nº 1.
2. **[E2E]** Fluxo completo de ficha do paciente — arquivo: `e2e/patient-detail.spec.ts` (novo). Cenário: login como ADMIN → abrir um paciente existente → assinar consentimento LGPD → verificar badge "Assinado em ..." → corrigir a assinatura informando motivo → abrir histórico e verificar 2 versões. É o fluxo de maior risco de regressão silenciosa (não há nenhum E2E hoje) e envolve três telas (ficha, `SignatureModal`, `SignatureHistoryModal`).
3. **[E2E]** Cadastro e exclusão de paciente — arquivo: `e2e/patients.spec.ts` (novo). Cenário: abrir "Pacientes" → "Novo Paciente" → preencher nome/telefone/data de nascimento/email → salvar → paciente aparece na tabela → excluir com confirmação → paciente some da lista (ou aparece como inativo, dependendo do filtro padrão).
4. **[E2E]** Upload de foto antes/depois e exclusão — arquivo: `e2e/patient-detail.spec.ts`. Cenário: aba "Fotos Antes/Depois" → "Novo Procedimento" → selecionar/anexar imagem válida → salvar → foto aparece no slot "Antes" → adicionar "Depois" no mesmo conjunto → excluir uma das fotos com confirmação.
5. **[Frontend Vitest+RTL]** `PatientDetail.tsx` — agrupamento `photosByProcedure`: renderizar com fotos de dois procedimentos e dois `groupId` diferentes (um conjunto completo antes+depois, um conjunto só com "antes") e verificar que os slots corretos aparecem preenchidos/vazios ("Registro ausente" / "Aguardando resultado") — arquivo: `__tests__/pages/PatientDetail.test.tsx` (novo). Este é o principal ponto de lógica de negócio no frontend sem nenhuma cobertura.
6. **[Frontend Vitest+RTL]** `PatientDetail.tsx` — paciente sem `birthDate` (campo opcional): renderizar a ficha com um paciente cujo `birthDate` é `undefined`/`null` e verificar que não quebra (`formatDate` recebendo valor vazio) e que a listagem (`Patients.tsx`) não exibe a linha "Nasc: ..." — arquivo: `__tests__/pages/Patients.test.tsx` e `__tests__/pages/PatientDetail.test.tsx` (novos). Cobre a instrução explícita da tarefa sobre esse campo.

### Média prioridade

7. **[Backend]** `POST /api/patients/import` — teste de permissão explícito confirmando que `ESTHETICIAN` recebe 403 (hoje só há teste de 403 para `PATIENT`) — arquivo: `patients-import.test.ts`. Cobre o achado nº 8 e documenta a regra de negócio.
8. **[Frontend Vitest+RTL]** `NewPatientModal` — validações client-side: nome/telefone obrigatórios, CPF inválido bloqueia submit, data de nascimento futura/ano inválido bloqueia submit, exibição de erro vindo de `addPatient` quando `{success:false, error}` — arquivo: `__tests__/components/NewPatientModal.test.tsx` (novo).
9. **[Frontend Vitest+RTL]** `SignatureModal` — botão "Confirmar" desabilitado com canvas vazio; em modo correção (`isCorrection`), botão continua desabilitado até o motivo ter ≥3 caracteres; "Limpar" reseta o canvas — arquivo: `__tests__/components/SignatureModal.test.tsx` (novo).
10. **[Frontend Vitest+RTL]** `ImportCSVModal` — seleção de arquivo com extensão inválida mostra erro e não habilita "Importar"; fluxo de sucesso mostra contadores de importados/atualizados/erros e chama `onSuccess`; erro genérico da API é exibido em vez de travar o modal — arquivo: `__tests__/components/ImportCSVModal.test.tsx` (novo).
11. **[Frontend Vitest+RTL]** `PatientDetail.tsx` — badge de correção: com `consentCorrectionCount > 0` mostra "Corrigida em ..."; com `signatureCorrectionCount > 0` no `AppointmentEvidenceModal` mostra o mesmo aviso; sem correção, nenhum badge aparece — arquivo: `__tests__/pages/PatientDetail.test.tsx`.
12. **[Frontend Vitest+RTL]** `PatientDetail.tsx` — tratamento de erro em ações de mutação: `removePhoto`, `signConsent` e `signAppointmentConsent` retornando `{success:false, error}` devem disparar `showAlert` com a mensagem (não falhar silenciosamente) — arquivo: `__tests__/pages/PatientDetail.test.tsx`. Verifica aderência à regra "todo erro deve ser comunicado ao usuário".
13. **[E2E]** Importação de pacientes via CSV — arquivo: `e2e/patients.spec.ts`. Cenário: baixar template, fazer upload de um CSV pequeno com 1 linha válida e 1 linha com nome ausente, verificar resumo (1 importado, 1 erro) exibido no modal.
14. **[Backend]** `GET /api/patients/[id]` — teste explícito de isolamento cross-tenant: buscar um `id` de paciente que existe mas pertence a outra empresa deve retornar 404 (comportamento já implementado via `findFirst({ id, companyId })`, mas vale um teste dedicado nomeando o cenário de "outra empresa" em vez de apenas "não encontrado") — arquivo: `patients-id.test.ts` (se ainda não estiver explícito nesse teste).

### Baixa prioridade

15. **[Frontend Vitest+RTL]** `downloadPhoto` (`utils/formatUtils.ts`) — geração do nome de arquivo: extensão detectada corretamente para `png`/`jpeg`/`gif`/`webp`, fallback para `jpg` quando a URL não é uma data URL reconhecida, slug do procedimento remove caracteres especiais e acentos — arquivo: `__tests__/utils/formatUtils.test.ts` (novo ou seção nova em um arquivo existente).
16. **[Frontend Vitest+RTL]** `PhotoAnnotationModal` — trocar ferramenta (círculo/seta/traço) e cor atualiza o estado visualmente selecionado; "Desfazer" remove a última forma; "Salvar Marcação" fica desabilitado com `shapes.length === 0` — arquivo: `__tests__/components/PhotoAnnotationModal.test.tsx` (novo). Prioridade baixa porque a lógica de desenho em si depende de Konva/canvas, difícil de testar de forma significativa em jsdom; focar apenas nos estados de UI (botões habilitados/desabilitados).
17. **[Frontend Vitest+RTL]** `PatientDetail.tsx` — geração de resumo de anamnese e de mensagem de follow-up via IA: mock de `summarizeAnamnesis`/`generateFollowUpMessage`, verificar estado de loading ("Gerando...", "Processando IA...") e exibição do resultado; "Enviar Agora" monta a URL `wa.me` corretamente com o telefone sem máscara — arquivo: `__tests__/pages/PatientDetail.test.tsx`. Prioridade baixa porque a chamada de IA em si (`/api/ai/generate`) já tem teste de backend dedicado (`ai-generate.test.ts`) fora do escopo desta aba.
18. **[Frontend Vitest+RTL]** `sendAnamnesisLink` — verificar que a chamada abre `wa.me` com a mensagem esperada e chama `toggleAnamnesisSent`, e que o botão muda de "Solicitar Anamnese" para o badge "Anamnese Solicitada" após o clique — arquivo: `__tests__/pages/PatientDetail.test.tsx`.
