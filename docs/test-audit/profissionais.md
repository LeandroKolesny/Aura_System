# Auditoria de Testes — Profissionais

> Escopo: aba "Profissionais" (`pages/Professionals.tsx`), modal de criar/editar
> (`ProfessionalModal` em `components/Modals.tsx`), estado global relacionado em
> `context/AppContext.tsx` e as rotas de backend que essa aba consome.

## Funcionalidades identificadas

1. **Listar profissionais da empresa** — tabela com nome, cargo, contato, disponibilidade semanal (a partir de `businessHours`), tipo de contrato e comissão/salário. Para `OWNER` a tela agrupa por empresa (accordion) e mostra todas as empresas.
2. **Buscar/filtrar** por nome, email ou cargo (`searchTerm`, client-side).
3. **KPIs** (só para não-`OWNER`): Total da Equipe, Esteticistas, Comissão Média (calculados no client a partir do array `professionals` já carregado).
4. **Criar profissional** (`ProfessionalModal` sem `initialData`) — campos: nome, email, senha (obrigatória, mín. 6 no front / mín. 8 se depois passar por reset), telefone, cargo, nível de acesso (`ADMIN`/`ESTHETICIAN`/`RECEPTIONIST` — nunca `OWNER`/`PATIENT` pelo select), tipo de contrato (`pj`/`clt`/`freelancer`), modelo de remuneração (`fixo`/`comissao`/`misto`), salário fixo, taxa de comissão (%), horário específico (`BusinessHoursEditor`, opcional — cai no `businessHours` da empresa se não preenchido).
5. **Editar profissional** (`ProfessionalModal` com `initialData`) — mesmos campos exceto email (bloqueado) e senha (substituída pelo fluxo de "Redefinir Senha").
6. **Redefinir senha** — gera senha aleatória de 8 caracteres no client (`generatePassword`) e envia via `resetUserPassword`; senha é exibida uma única vez na tela para o admin copiar/repassar.
7. **Excluir profissional** — na verdade é **soft delete** (`isActive:false` no backend); UI mostra apenas como "Remover" com modal de confirmação (`useDialog().confirm`), e o botão nem aparece para o próprio `OWNER` na linha.
8. **Bloqueio de escrita (`isReadOnly`)** — todos os botões de criar/editar/excluir ficam desabilitados quando o plano está expirado/básico expirado (`isReadOnly` do `AppContext`).
9. **Limite de profissionais por plano** — `addProfessional` no `AppContext` verifica `maxProfessionals` do plano atual antes de chamar a API e bloqueia no client com mensagem "Limite de profissionais atingido".
10. **Normalização de dados vindos da API** — `normalizeProfessional()` no `AppContext.tsx` converte `commissionRate`/`fixedSalary` (Decimal do Prisma, vem como string) para `number`, e mapeia `contractType`/`remunerationType` para minúsculo PT-BR, com fallback (`'pj'`, `'comissao'`) quando ausentes.
11. **Não há UI para reativar um profissional desativado** nem indicador visual de status ativo/inativo na tabela (ver "Problemas encontrados").
12. **Horário específico do profissional** (`businessHours` por usuário) — se não definido, a tabela usa o horário da empresa como fallback (`availabilitySource`).

## Endpoints de backend usados

| Ação (frontend) | Função em `services/api.ts` | Rota | Arquivo da rota |
|---|---|---|---|
| Listar profissionais | `usersApi.list` | `GET /api/users` | `aura-backend/src/app/api/users/route.ts` |
| Criar profissional | `usersApi.create` | `POST /api/users` | `aura-backend/src/app/api/users/route.ts` |
| Editar profissional | `usersApi.update` | `PUT /api/users/[id]` | `aura-backend/src/app/api/users/[id]/route.ts` |
| Remover (soft delete) | `usersApi.delete` | `DELETE /api/users/[id]` | `aura-backend/src/app/api/users/[id]/route.ts` |
| Redefinir senha | `usersApi.resetPassword` | `POST /api/users/[id]/reset-password` | `aura-backend/src/app/api/users/[id]/reset-password/route.ts` |
| (Relatório relacionado, não chamado por esta tela, mas consome os mesmos campos) | — | `GET /api/reports/commissions` | `aura-backend/src/app/api/reports/commissions/route.ts` |

Validação de entrada:
- `POST /api/users` (criar) — **sem Zod**, mapeamento manual via `roleMap`/`contractMap`/`remunerationMap`; `commissionRate`/`fixedSalary` só passam por `parseFloat`, sem limites.
- `PUT /api/users/[id]` (editar) — usa `updateUserSchema` (`aura-backend/src/lib/validations/user.ts`), que valida `commissionRate` (0–100) e `fixedSalary` (≥0), com aliases PT-BR/EN para `remunerationType`.
- **Assimetria confirmada**: a mesma regra de negócio (taxa de comissão válida) é aplicada só na edição, não na criação.

## Cobertura de testes atual

### Backend
Todos em `aura-backend/src/__tests__/`:

- `api/users.test.ts` — **15 testes** (`GET`: 6 — 401, escopo por empresa, filtro `companyId` do OWNER, exclusão de `PATIENT`, filtro por `role`, nunca seleciona `password`; `POST`: 9 — 401, 403 sem empresa, 402 plano sem escrita, 403 role errado, 400 campos obrigatórios, 400 email duplicado, 201 criação com role padrão, mapeamento de enums minúsculos, hash de senha). **Nenhum teste cobre `commissionRate`/`fixedSalary` inválidos na criação.**
- `api/users-id.test.ts` — **18 testes** (`PUT`: 13, incluindo `it.each` de 5 variações de `remunerationType`; `DELETE`: 5, incluindo bloqueio de auto-remoção e confirmação do soft delete). Boa cobertura de autorização e da regressão de normalização de enums.
- `api/users-reset-password.test.ts` — **7 testes** cobrindo 401, 403 (role errado e empresa diferente), 400 (senha curta), 404, sucesso do OWNER, hash + `tokenVersion` incrementado.
- `lib/validations/user.test.ts` — **21 testes** diretos do `updateUserSchema`, incluindo os aliases de `remunerationType`, limites de `commissionRate`/`fixedSalary` e `isActive` booleano.
- `api/reports-commissions.test.ts` — **12 testes**, cobrindo os três tipos de remuneração (COMMISSION/FIXED/MIXED), filtro por `professionalId`, totais agregados e guardas de acesso/módulo/role. **Nenhum teste cobre remuneração ausente/desconhecida, taxa negativa/>100, ou o filtro `isActive:true` da query de profissionais.**

Total: **73 testes de backend** relacionados a Profissionais já existem, com boa cobertura de autorização, normalização e cálculo básico de comissão.

### Frontend
- `__tests__/context/AppContext.test.tsx` cobre parcialmente a lógica de Profissionais dentro do `AppContext`:
  - `updateProfessional`: chama API (não mais estado local), normaliza `commissionRate` (string→number) e `remunerationType` (→ minúsculo PT-BR), propaga erro da API.
  - `removeProfessional`: chama API, propaga erro da API.
  - `resetUserPassword`: sucesso e propagação de erro.
  - **`addProfessional` não tem nenhum teste** — inclusive a lógica de limite de profissionais por plano (`maxProfessionals`) nunca é exercitada.
  - **`normalizeProfessional` não tem teste unitário isolado** — é testada apenas indiretamente via `loadProfessionals`/`updateProfessional`, e só no caminho de `remunerationType='COMMISSION'`. Não há teste para: `contractType` (maiúsculo→minúsculo, nem seu fallback `'pj'`), fallback de `remunerationType` quando ausente (`'comissao'`), nem para `commissionRate`/`fixedSalary` ausentes (`Number(undefined) || 0`).
- **Não existe nenhum arquivo de teste para `pages/Professionals.tsx` nem para `ProfessionalModal` em `components/Modals.tsx`** — confirmado por busca no diretório `__tests__/`, que hoje só contém `context/AppContext.test.tsx`, `services/api.test.ts` e `setup.ts`.

### E2E
- Busca por "profission" em `e2e/*.spec.ts` não retornou nenhuma ocorrência. Nenhum dos 6 specs existentes (`dashboard`, `login`, `forgot-password`, `public-booking`, `register`, `whatsapp-settings`) toca a aba Profissionais. **Cobertura E2E: zero.**

## Problemas encontrados durante a revisão

1. **Taxa de comissão sem validação na criação (bug confirmado)** — `POST /api/users` não usa `updateUserSchema` nem qualquer Zod; `commissionRate`/`fixedSalary` só passam por `parseFloat(...)`. É possível criar um profissional com `commissionRate: -50` ou `commissionRate: 500` via API (o formulário também não tem `min`/`max` no `<input type="number">`). Já a edição (`PUT`), via `updateUserSchema`, rejeita corretamente valores fora de 0–100. Essa assimetria é o achado mais crítico: o `GET /api/reports/commissions` calcula `commissionAmount = (totalRevenue * commissionRate) / 100` sem clamping, então uma taxa de 500% criada por essa brecha gera comissão 5x a receita sem qualquer aviso.
2. **`GET /api/reports/commissions` sem tratamento explícito para `remunerationType` ausente/desconhecido** — o `switch` (linhas ~118-128) não tem `case default`; se `remunerationType` vier `null`/valor não mapeado, `totalEarnings` fica silenciosamente `0` sem sinalizar erro. Hoje o schema do Prisma tem `@default(COMMISSION)` e o `PUT` não aceita `null`, então o cenário é difícil de alcançar por essas duas rotas — mas nada impede que o dado fique inconsistente por outra via (migração, seed, edição direta no banco), e o comportamento resultante (ganhos zerados sem alerta) é justamente o tipo de falha silenciosa que o `CLAUDE.md` do projeto pede para nunca acontecer.
3. **Exclusão ("Remover") é soft delete, mas sem verificação de agendamentos futuros e sem aviso ao usuário** — `DELETE /api/users/[id]` apenas seta `isActive:false`; não há checagem de agendamentos futuros vinculados ao profissional, nem mensagem diferenciada quando existem. Como é soft delete (não hard delete), não há erro 500 de FK, mas o profissional desativado passa a ser **excluído do relatório de comissões** (`GET /api/reports/commissions` filtra `isActive:true`) mesmo que tenha tido agendamentos concluídos e pagos no período — o histórico financeiro dele desaparece do relatório sem aviso. O modal de confirmação no frontend (`useDialog().confirm`) não informa nada sobre agendamentos futuros existentes.
4. **Não existe UI para reativar um profissional desativado** — o schema Zod (`updateUserSchema`) já aceita `isActive: boolean`, e a rota `PUT` aceitaria `{ isActive: true }`, mas nem `Professionals.tsx` nem `ProfessionalModal` expõem esse campo. Um profissional "removido" fica permanentemente inacessível pela UI (sem contornar via API direta), e também não há nenhum indicador visual (badge, opacidade, filtro) na tabela mostrando quem está inativo — pior ainda, `GET /api/users` não filtra por `isActive` (retorna ativos e inativos juntos), então um profissional desativado continua listado normalmente, indistinguível de um ativo.
5. **Inconsistência mínimo de senha do reset** — `ProfessionalModal.generatePassword()` sempre gera 8 caracteres; a rota de reset exige `newPassword.length >= 8`. Não é um bug hoje (8 ≥ 8 passa), mas é um acoplamento frágil — se alguém reduzir `length: 8` para `length: 6` no gerador (achando que bate com o mínimo de senha do cadastro, que é 6 no formulário de criação), o reset passa a falhar silenciosamente sem que o teste de criação pegue isso.
6. **Formulário de criação/edição não limita `commissionRate` (0–100) nem `fixedSalary` (≥0) no client** — não há `min`/`max` nos `<input type="number">` do modal; toda a validação de limite hoje depende só do backend, e — como no item 1 — o backend de criação nem valida.

## Testes recomendados

### Alta prioridade

1. **[Backend]** `aura-backend/src/__tests__/api/users.test.ts` — `POST /api/users` com `commissionRate: -10` e com `commissionRate: 150` deve ser rejeitado (400) ou, no mínimo, persistido dentro de 0–100. Hoje falha (expõe o bug #1): documentar o comportamento atual e, após correção, adicionar `updateUserSchema`-like validação também na criação (ou um schema `createUserSchema` dedicado) coberto por este teste.
2. **[Backend]** `aura-backend/src/__tests__/api/users.test.ts` — `POST /api/users` com `fixedSalary: -500` deve ser rejeitado (mesmo racional do item acima).
3. **[Frontend Vitest+RTL]** `__tests__/context/AppContext.test.tsx` (ou novo arquivo `__tests__/context/normalizeProfessional.test.tsx`) — testes unitários isolados de `normalizeProfessional`/`addProfessional` cobrindo: `contractType` ausente → fallback `'pj'`; `contractType='CLT'` → normaliza para `'clt'`; `remunerationType` ausente → fallback `'comissao'`; `commissionRate`/`fixedSalary` ausentes → `0`, não `NaN`. Isso hoje não existe (só o caminho `remunerationType='COMMISSION'` é exercitado indiretamente).
4. **[Frontend Vitest+RTL]** `__tests__/context/AppContext.test.tsx` — cobrir `addProfessional`: (a) sucesso normal chamando `usersApi.create` e normalizando o retorno; (b) bloqueio quando `currentProfCount >= maxProfessionals` do plano, retornando `{ success:false, limitReached:true }` sem chamar a API; (c) `maxProfessionals === -1` (ilimitado) permite criar mesmo acima da contagem atual. Hoje `addProfessional` não tem nenhum teste.
5. **[E2E Playwright]** novo `e2e/professionals.spec.ts` — fluxo completo: login como ADMIN → navegar para Profissionais → criar profissional (preencher nome/email/senha/contrato/remuneração) → verificar que aparece na tabela com o badge de contrato e comissão corretos → editar (mudar `remunerationType` de comissão para misto e conferir que os campos condicionais de salário fixo aparecem) → excluir (confirmar modal) → verificar que sai da lista. Esta é a lacuna mais visível do relatório: zero cobertura E2E na aba inteira.
6. **[Backend]** `aura-backend/src/__tests__/api/reports-commissions.test.ts` — profissional com `remunerationType` fora de `FIXED`/`COMMISSION`/`MIXED` (ex.: `null` ou string desconhecida) deve ter comportamento explícito e testado (hoje cai no `switch` sem `default` e vira `totalEarnings: 0` silenciosamente) — documentar/travar esse comportamento com um teste, e considerar logar/alertar em vez de zerar silenciosamente.

### Média prioridade

7. **[Backend]** `aura-backend/src/__tests__/api/reports-commissions.test.ts` — profissional desativado (`isActive:false`) com agendamentos `COMPLETED`/`paid` no período **não** deve aparecer no relatório (documentar esse efeito colateral do soft delete — problema #3) e considerar se isso é o comportamento desejado.
8. **[Frontend Vitest+RTL]** novo `__tests__/pages/Professionals.test.tsx` — renderização da tabela: nome/cargo, badge de contrato (`getContractBadge` para `CLT`/`PJ`/`Freelancer`/valor desconhecido → cinza `N/A`), coluna de comissão (`fixo` → "Salário Fixo" vs. percentual), disponibilidade semanal a partir de `businessHours` (aberto/fechado por dia), busca por nome/email/cargo filtrando a lista, e botões de ação desabilitados quando `isReadOnly=true`.
9. **[Frontend Vitest+RTL]** novo `__tests__/components/ProfessionalModal.test.tsx` — validações do formulário: senha obrigatória só na criação; campos de "Salário Fixo"/"Comissão (%)" aparecem/somem conforme `remunerationType`; `handleResetPassword` exibe a senha gerada uma única vez e trata erro da API (`showAlert`); submissão de edição nunca envia o campo `password`.
10. **[Backend]** `aura-backend/src/__tests__/api/users-id.test.ts` — `PUT` com `isActive: true` deve reativar um profissional (hoje o schema aceita, mas não há teste que exercite reativação via este endpoint — relevante para futura correção do problema #4).
11. **[E2E Playwright]** `e2e/professionals.spec.ts` — cenário de "Redefinir Senha": abrir edição de um profissional existente, clicar em "Redefinir Senha", verificar que a senha temporária aparece na tela.
12. **[Backend]** `aura-backend/src/__tests__/api/users.test.ts` — `POST /api/users` com `role: 'OWNER'` enviado por um ADMIN não deve conseguir criar outro OWNER (checar se o mapeamento de role permite escalonamento de privilégio indevido — não verificado nesta auditoria a fundo, mas o `roleMap` aceita `'OWNER'` sem checagem adicional de quem está criando).

### Baixa prioridade

13. **[Frontend Vitest+RTL]** teste de `getContractBadge`/`getRoleLabel` (funções utilitárias dentro de `Professionals.tsx`) como testes puros de mapeamento, se forem extraídas para um arquivo utilitário testável isoladamente.
14. **[E2E Playwright]** cenário de limite de plano: com um plano cujo `maxProfessionals` já foi atingido, tentar adicionar mais um profissional e verificar a mensagem de erro exibida via `showAlert`.
15. **[Backend]** teste de regressão para o acoplamento entre `generatePassword()` (8 caracteres, frontend) e o mínimo de 8 caracteres exigido pelo reset — não é um teste de backend isolado por si, mas vale um comentário/asserção cruzada caso alguém altere um dos dois lados independentemente (problema #5).
16. **[Frontend Vitest+RTL]** teste do agrupamento por empresa na visão `OWNER` (`baseProfessionals`, expandir/colapsar `expandedSections`, ocultar empresa sem resultados durante busca).
