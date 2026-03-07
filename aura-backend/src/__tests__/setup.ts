// aura-backend/src/__tests__/setup.ts
// Configuração global para todos os testes

// JWT_SECRET precisa estar definido antes de qualquer import de auth.ts
// pois é lido no nível do módulo (throw se ausente)
process.env.JWT_SECRET = 'test-secret-aura-system-vitest-32chars!!';
process.env.NODE_ENV = 'test';
