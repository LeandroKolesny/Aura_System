// utils/subdomain.ts
// Detecta se estamos no portal de uma clínica ou no sistema admin

// Rotas do sistema admin - não são slugs de clínica
const ADMIN_ROUTES = [
  '', // raiz
  'login',
  'king',
  'dashboard',
  'schedule',
  'patients',
  'financial',
  'procedures',
  'professionals',
  'settings',
  'reports',
  'inventory',
  'marketing',
  'leads',
  'support',
  'plans',
  'system-alerts',
  'access-link',
  'business-hours',
  'onboarding',
  'history',
];

/**
 * Extrai o slug da clínica do PATH (para localhost)
 * Ex: /clinica-aura/login → "clinica-aura"
 * Ex: /login → null (é rota admin)
 */
function extractSlugFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return null; // raiz - é admin
  }

  const firstSegment = segments[0].toLowerCase();

  // Se o primeiro segmento é uma rota conhecida do admin, não é slug
  if (ADMIN_ROUTES.includes(firstSegment)) {
    return null;
  }

  // Caso contrário, é o slug da clínica
  return firstSegment;
}

/**
 * Detecta o slug da clínica baseado no ambiente:
 * - LOCALHOST: usa o PATH (/clinica-aura/...)
 * - PRODUÇÃO: usa o SUBDOMÍNIO (clinica-aura.aurasystem.com)
 *
 * @returns O slug da clínica ou null se for o sistema admin
 */
export function getClinicSlug(): string | null {
  if (typeof window === 'undefined') return null;

  const host = window.location.host;
  const pathname = window.location.pathname;

  // LOCALHOST - detecta pelo PATH
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return extractSlugFromPath(pathname);
  }

  // PRODUÇÃO - detecta pelo SUBDOMÍNIO
  // Ex: clinica-aura.aurasystem.com → "clinica-aura"
  // Ex: www.aurasystem.com → null
  // Ex: aurasystem.com → null
  const parts = host.split('.');

  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    // www não é um portal de clínica
    if (subdomain !== 'www') {
      return subdomain;
    }
  }

  return null; // é sistema admin
}

/**
 * Verifica se estamos no portal de uma clínica
 */
export function isPatientPortal(): boolean {
  return getClinicSlug() !== null;
}

/**
 * Verifica se estamos no sistema admin
 */
export function isAdminSystem(): boolean {
  return getClinicSlug() === null;
}

/**
 * Retorna o base path para links internos do portal
 * - LOCALHOST: /clinica-aura
 * - PRODUÇÃO: "" (vazio, pois o slug está no subdomínio)
 */
export function getPortalBasePath(): string {
  if (typeof window === 'undefined') return '';

  const host = window.location.host;

  // Em localhost, o base path inclui o slug
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    const slug = getClinicSlug();
    return slug ? `/${slug}` : '';
  }

  // Em produção, não precisa de base path (slug está no subdomínio)
  return '';
}

/**
 * Gera um link para o portal de uma clínica
 * @param slug - O slug da clínica
 * @param path - O caminho dentro do portal (ex: "/login")
 */
export function getPortalUrl(slug: string, path: string = ''): string {
  if (typeof window === 'undefined') return '';

  const host = window.location.host;
  const protocol = window.location.protocol;

  // LOCALHOST - usa path
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `${protocol}//${host}/${slug}${path}`;
  }

  // PRODUÇÃO - usa subdomínio
  // Extrai o domínio base (remove www se existir)
  const parts = host.split('.');
  let baseDomain: string;

  if (parts[0] === 'www') {
    baseDomain = parts.slice(1).join('.');
  } else if (parts.length >= 3) {
    // Já está em um subdomínio, pega o domínio base
    baseDomain = parts.slice(1).join('.');
  } else {
    baseDomain = host;
  }

  return `${protocol}//${slug}.${baseDomain}${path}`;
}

/**
 * Remove o prefixo do slug do pathname (para uso em localhost)
 * Ex: /clinica-aura/login → /login
 */
export function getPathWithoutSlug(pathname: string): string {
  const slug = getClinicSlug();

  if (!slug) return pathname;

  const host = window.location.host;

  // Só remove o prefixo em localhost
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    const prefix = `/${slug}`;
    if (pathname.startsWith(prefix)) {
      const newPath = pathname.slice(prefix.length);
      return newPath || '/';
    }
  }

  return pathname;
}
