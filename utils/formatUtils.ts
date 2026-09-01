// Utilitários de Formatação Global — importar daqui, nunca redefinir localmente

const AVATAR_PALETTES = [
  { bg: 'from-primary-400 to-primary-600', text: 'text-white' },
  { bg: 'from-rose-400 to-rose-600', text: 'text-white' },
  { bg: 'from-violet-400 to-violet-600', text: 'text-white' },
  { bg: 'from-sky-400 to-sky-600', text: 'text-white' },
  { bg: 'from-emerald-400 to-emerald-600', text: 'text-white' },
  { bg: 'from-amber-400 to-amber-600', text: 'text-white' },
];

export const getAvatarConfig = (name: string): { bg: string; text: string } =>
  AVATAR_PALETTES[(name.charCodeAt(0) || 0) % AVATAR_PALETTES.length];

export const getAvatarInitials = (name: string): string =>
  name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

export const formatCurrency = (value: number | string | undefined): string => {
  if (value === undefined || value === null) return 'R$ 0,00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
};

export const formatDate = (date: string | Date | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
};

export const formatDateTime = (date: string | Date | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const formatTime = (date: string | Date | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Calcula a diferença em dias entre duas datas.
 */
export const getDaysDifference = (d1: string | Date, d2: string | Date = new Date()): number => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    date1.setHours(0, 0, 0, 0);
    date2.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Retorna informações amigáveis do dispositivo para assinaturas digitais.
 */
export const getFriendlyDeviceInfo = (ua?: string): string => {
    if (!ua) return 'Dispositivo Desconhecido';
    let browser = 'Navegador';
    if (ua.includes('Edg/')) browser = 'Microsoft Edge';
    else if (ua.includes('Chrome/')) browser = 'Google Chrome';
    else if (ua.includes('Safari/')) browser = 'Apple Safari';
    else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
    
    let os = 'Sistema';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} no ${os}`;
};