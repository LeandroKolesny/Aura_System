
# Aura System - Security Policy & Standards

Este documento define os padrões de segurança que devem ser seguidos por qualquer desenvolvedor (humano ou IA) trabalhando no Aura System.

## 1. Controle de Acesso (RBAC)
Todas as funções sensíveis no `AppContext` (nosso backend simulado) devem validar o cargo do usuário.

### Padrão Obrigatório:
```typescript
const deleteSomething = (id: string) => {
    // 1. Verificação de Permissão
    checkPermission([UserRole.OWNER, UserRole.ADMIN]);
    
    // 2. Validação de Dados
    if (!id) throw new Error("ID inválido");

    // 3. Execução
    // ...
}
```

## 2. Validação de Dados (Input Validation)
Nunca confie nos dados vindos de formulários.
- **CPF/CNPJ:** Obrigatório usar `validateCpfCnpj` de `utils/maskUtils.ts`.
- **Datas:** Obrigatório verificar se data de nascimento não é futura ou ano inválido (> 4 dígitos).
- **Telefones:** Devem ser sanitizados antes de salvar.

## 3. Segurança do SaaS (Multi-tenancy)
O sistema hospeda múltiplas clínicas. É CRÍTICO garantir que uma clínica nunca veja dados de outra.
- **Filtragem por CompanyID:** Todo `useMemo` ou query de dados deve filtrar por `user.companyId`.
- **Exceção:** Apenas o `UserRole.OWNER` (SaaS Admin) pode ver dados globais.

## 4. Prevenção de Fraude (Frontend Logic)
Como o frontend contém regras de negócio:
- Agendamentos via Link Público devem sempre entrar como `pending_approval`.
- O status `confirmed` ou `paid` nunca deve ser aceito vindo de uma requisição pública.

## 5. Auditoria
Qualquer alteração crítica (mudança de plano, remoção de usuário) deve ser logada (futuramente implementaremos logs de auditoria).
