// __tests__/utils/subdomain.test.ts
// Testes de detecção de slug/portal do paciente (utils/subdomain.ts).
// Cobre casos de borda: maiúsculas, www., porta em dev, subdomínio ausente,
// localhost vs. Vercel vs. domínio próprio.

import { describe, it, expect, afterEach } from 'vitest';
import {
  getClinicSlug,
  getPortalBasePath,
  isPatientPortal,
  isAdminSystem,
  getPortalUrl,
  getPathWithoutSlug,
} from '../../utils/subdomain';

function setLocation(host: string, pathname: string, protocol = 'https:') {
  Object.defineProperty(window, 'location', {
    value: { host, pathname, protocol },
    writable: true,
    configurable: true,
  });
}

describe('utils/subdomain', () => {
  afterEach(() => {
    // Restaura um location neutro pra não vazar estado entre testes
    setLocation('localhost:3000', '/');
  });

  describe('getClinicSlug — localhost (path-based)', () => {
    it('extrai o slug do primeiro segmento do path', () => {
      setLocation('localhost:3000', '/clinica-aura/login');
      expect(getClinicSlug()).toBe('clinica-aura');
    });

    it('retorna null na raiz (sistema admin)', () => {
      setLocation('localhost:3000', '/');
      expect(getClinicSlug()).toBeNull();
    });

    it('retorna null para rotas conhecidas do admin (login, king, dashboard)', () => {
      setLocation('localhost:3000', '/login');
      expect(getClinicSlug()).toBeNull();
      setLocation('localhost:3000', '/king');
      expect(getClinicSlug()).toBeNull();
      setLocation('localhost:3000', '/dashboard');
      expect(getClinicSlug()).toBeNull();
    });

    it('normaliza o slug para lowercase mesmo se o path vier em maiúsculas', () => {
      setLocation('localhost:3000', '/Clinica-Aura/login');
      expect(getClinicSlug()).toBe('clinica-aura');
    });

    it('ignora a porta ao detectar localhost', () => {
      setLocation('localhost:5173', '/clinica-aura/agendamentos');
      expect(getClinicSlug()).toBe('clinica-aura');
    });

    it('funciona também com 127.0.0.1', () => {
      setLocation('127.0.0.1:3000', '/clinica-aura');
      expect(getClinicSlug()).toBe('clinica-aura');
    });
  });

  describe('getClinicSlug — Vercel (path-based)', () => {
    it('extrai o slug do path em domínio *.vercel.app', () => {
      setLocation('aura-system-mu.vercel.app', '/clinica-aura/login');
      expect(getClinicSlug()).toBe('clinica-aura');
    });

    it('retorna null na raiz do domínio vercel.app', () => {
      setLocation('aura-system-mu.vercel.app', '/');
      expect(getClinicSlug()).toBeNull();
    });
  });

  describe('getClinicSlug — domínio próprio (subdomínio)', () => {
    it('extrai o subdomínio como slug', () => {
      setLocation('clinica-aura.aurasystem.com', '/login');
      expect(getClinicSlug()).toBe('clinica-aura');
    });

    it('normaliza o subdomínio para lowercase', () => {
      setLocation('Clinica-Aura.AuraSystem.com', '/');
      expect(getClinicSlug()).toBe('clinica-aura');
    });

    it('retorna null para www.dominio.com', () => {
      setLocation('www.aurasystem.com', '/');
      expect(getClinicSlug()).toBeNull();
    });

    it('retorna null para o domínio apex (2 labels, sem subdomínio)', () => {
      setLocation('aurasystem.com', '/');
      expect(getClinicSlug()).toBeNull();
    });

    it('ignora a porta ao extrair o subdomínio', () => {
      setLocation('clinica-aura.aurasystem.com:8080', '/');
      expect(getClinicSlug()).toBe('clinica-aura');
    });
  });

  describe('isPatientPortal / isAdminSystem', () => {
    it('isPatientPortal true e isAdminSystem false quando há slug', () => {
      setLocation('localhost:3000', '/clinica-aura/login');
      expect(isPatientPortal()).toBe(true);
      expect(isAdminSystem()).toBe(false);
    });

    it('isPatientPortal false e isAdminSystem true na raiz do admin', () => {
      setLocation('localhost:3000', '/dashboard');
      expect(isPatientPortal()).toBe(false);
      expect(isAdminSystem()).toBe(true);
    });
  });

  describe('getPortalBasePath', () => {
    it('inclui o slug em localhost/Vercel', () => {
      setLocation('localhost:3000', '/clinica-aura/minha-conta');
      expect(getPortalBasePath()).toBe('/clinica-aura');
    });

    it('retorna vazio em localhost sem slug (rota admin)', () => {
      setLocation('localhost:3000', '/dashboard');
      expect(getPortalBasePath()).toBe('');
    });

    it('retorna vazio em domínio próprio (slug já está no subdomínio)', () => {
      setLocation('clinica-aura.aurasystem.com', '/minha-conta');
      expect(getPortalBasePath()).toBe('');
    });
  });

  describe('getPortalUrl', () => {
    it('monta URL path-based em localhost', () => {
      setLocation('localhost:3000', '/');
      expect(getPortalUrl('clinica-aura', '/login')).toBe('https://localhost:3000/clinica-aura/login');
    });

    it('monta URL de subdomínio em domínio próprio', () => {
      setLocation('aurasystem.com', '/');
      expect(getPortalUrl('clinica-aura', '/login')).toBe('https://clinica-aura.aurasystem.com/login');
    });

    it('remove o www ao montar URL de subdomínio a partir de www.dominio.com', () => {
      setLocation('www.aurasystem.com', '/');
      expect(getPortalUrl('clinica-aura', '')).toBe('https://clinica-aura.aurasystem.com');
    });
  });

  describe('getPathWithoutSlug', () => {
    it('remove o prefixo do slug em localhost', () => {
      setLocation('localhost:3000', '/clinica-aura/agendamentos');
      expect(getPathWithoutSlug('/clinica-aura/agendamentos')).toBe('/agendamentos');
    });

    it('retorna "/" quando o path é só o slug', () => {
      setLocation('localhost:3000', '/clinica-aura');
      expect(getPathWithoutSlug('/clinica-aura')).toBe('/');
    });

    it('retorna o path original quando não há slug', () => {
      setLocation('localhost:3000', '/dashboard');
      expect(getPathWithoutSlug('/dashboard')).toBe('/dashboard');
    });
  });
});
