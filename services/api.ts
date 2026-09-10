// Aura System - API Service
// Integração com o backend Next.js

// Em produção, usamos caminho relativo (mesma origem) — o vercel.json reescreve
// /api/* para o backend por trás dos panos. Isso faz o navegador tratar frontend
// e backend como o mesmo site, evitando o bloqueio de cookies de terceiros que
// impedia o cookie de sessão (aura_session) de sobreviver a um recarregamento de página.
// Em dev, continua batendo direto no backend local (VITE_API_URL ou localhost:3001).
export const API_BASE_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3001');

// In-memory token storage (XSS-safe — not persisted to localStorage)
let _memoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  _memoryToken = token;
}

export function getAuthToken(): string | null {
  return _memoryToken;
}

// Tipos de resposta da API
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Configuração base do fetch
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Não definir Content-Type para FormData — o browser define automaticamente com o boundary correto
  const defaultHeaders: HeadersInit = options.body instanceof FormData
    ? {}
    : { 'Content-Type': 'application/json' };

  // Adiciona token de autenticação se existir (in-memory — não localStorage)
  const token = getAuthToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============================================
// SHARED MINIMAL TYPES
// ============================================

export interface ApiCompany {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  subscriptionStatus?: string;
  subscriptionExpiresAt?: string;
  businessHours?: Record<string, { isOpen?: boolean; start?: string; end?: string }>;
  onboardingCompleted?: boolean;
  targetFemale?: boolean;
  targetMale?: boolean;
  targetKids?: boolean;
  instagram?: string;
  facebook?: string;
  website?: string;
  address?: string;
  logo?: string;
  layoutConfig?: {
    backgroundColor: string;
    primaryColor: string;
    textColor?: string;
    fontFamily?: string;
    baseFontSize?: string;
    cardBackgroundColor?: string;
    cardTextColor?: string;
    headerBackgroundColor?: string;
    headerTextColor?: string;
  };
  onlineBookingConfig?: {
    slotInterval: number;
    minAdvanceTime: number;
    maxBookingPeriod: number;
    cancellationNotice: number;
    cancellationPolicy?: string;
  };
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
  emailVerified?: boolean;
  googleCalendarConnected?: boolean;
  googleCalendarId?: string | null;
  avatar?: string;
  isActive?: boolean;
  patientId?: string;
  company?: ApiCompany | null;
}

export interface ApiPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiLead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  companyId: string;
  clinicName?: string;
  contactName?: string;
  value?: number;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ApiTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  companyId: string;
  [key: string]: unknown;
}

export interface ApiPatient {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyId: string;
  status: string;
  birthDate?: string | null;
  cpf?: string | null;
  lastVisit?: string | null;
  anamnesisSummary?: string | null;
  consentSignedAt?: string | null;
  consentSignatureUrl?: string | null;
  consentMetadata?: Record<string, unknown> | null;
  consentCorrectionCount?: number;
  lastConsentCorrectionAt?: string | null;
  lastConsentCorrectionReason?: string | null;
  anamnesisLinkSent?: boolean;
  lastMarketingMessageSentAt?: string | null;
  marketingOptOut?: boolean | null;
}

export interface ApiAppointment {
  id: string;
  date: string;
  status: string;
  patientId: string;
  procedureId: string;
  professionalId: string;
  companyId: string;
  price?: number;
  durationMinutes?: number;
  patientName?: string;
  professionalName?: string;
  service?: string;
  // Relacionamentos aninhados que o backend inclui ao criar um agendamento
  // (não vêm em toda resposta — por isso opcionais).
  patient?: { id: string; name: string; phone?: string; email?: string };
  professional?: { id: string; name: string };
  procedure?: { id: string; name: string; durationMinutes?: number };
  // Indicador leve de correção de assinatura — o histórico completo (com a
  // imagem de cada versão) vem só sob demanda via appointmentsApi.getSignatureHistory.
  signatureCorrectionCount?: number;
  lastSignatureCorrectionAt?: string | null;
  lastSignatureCorrectionReason?: string | null;
  [key: string]: unknown;
}

export interface ApiSignatureHistoryEntry {
  id: string;
  signatureUrl: string;
  signedAt: string;
  documentVersion: string;
  correctionReason: string | null;
}

export interface ApiTransaction {
  id: string;
  type: string;
  status: string;
  amount: number | string;
  companyId: string;
  date: string;
  description: string;
  category: string;
  appointmentId?: string;
  installments?: number;
  installmentIndex?: number;
  installmentGroupId?: string;
  dueDate?: string;
  [key: string]: unknown;
}

export interface ApiTransactionSummary {
  revenue: number;
  expenses: number;
  profit: number;
  [key: string]: unknown;
}

export interface ApiProcedureSupply {
  id: string;
  inventoryItemId: string;
  quantityUsed: number;
  inventoryItem?: { id: string; name: string; costPerUnit: number; unit: string };
  name?: string;
}

export interface ApiProcedure {
  id: string;
  name: string;
  price: number;
  cost: number;
  duration: number;
  durationMinutes?: number;
  isActive: boolean;
  companyId: string;
  description?: string;
  imageUrl?: string;
  maintenanceRequired?: boolean;
  maintenanceIntervalDays?: number;
  supplies?: ApiProcedureSupply[];
}

export interface ApiInventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  companyId: string;
  lastRestockDate?: string | null;
  [key: string]: unknown;
}

export interface ApiInventoryMovement {
  id: string;
  type: string;
  quantity: number;
  itemId: string;
  [key: string]: unknown;
}

export interface ApiProduct {
  id: string;
  name: string;
  price: number;
  companyId: string;
  [key: string]: unknown;
}

export interface ApiUnavailabilityRule {
  id: string;
  companyId: string;
  description?: string;
  startTime: string;
  endTime: string;
  dates: string[];
  professionalIds: string[];
  [key: string]: unknown;
}

export interface ApiNotification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  type: string;
  createdAt: string;
  isRead: boolean;
}

export interface ApiPhoto {
  id: string;
  url: string;
  patientId: string;
  companyId: string;
  type: string;
  procedure: string;
  date: string;
  groupId?: string;
}

export interface ApiTicket {
  id: string;
  subject: string;
  status: string;
  companyId: string;
  company?: { name: string };
  createdAt: string;
  updatedAt: string;
  messages: { id: string; senderId: string; senderName: string; content: string; timestamp: string; isAdmin: boolean }[];
}

export interface ApiSystemAlert {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  target: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface ApiProfessional {
  id: string;
  name: string;
  companyId: string;
  [key: string]: unknown;
}

export interface ApiPublicBookingData {
  company: ApiCompany;
  procedures: ApiProcedure[];
  professionals: ApiProfessional[];
  appointments: ApiAppointment[];
  unavailabilityRules: ApiUnavailabilityRule[];
}

export interface ApiUser_Extended {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
  [key: string]: unknown;
}

export interface ApiKingLead {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  createdAt: string;
  [key: string]: unknown;
}

// ============================================
// AUTH API
// ============================================

export const authApi = {
  async login(email: string, password: string) {
    const result = await fetchApi<{ user: ApiUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.success && result.data?.token) {
      // Store token in memory only — never in localStorage (XSS protection)
      setAuthToken(result.data.token);
    }

    return result;
  },

  async register(data: { name: string; email: string; password: string; companyName: string; acceptedTerms?: boolean; state?: string; marketingConsent?: boolean }) {
    return fetchApi<{ user: ApiUser; company: ApiCompany }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async logout() {
    // Clear in-memory token first, then ask backend to expire the httpOnly cookie
    setAuthToken(null);
    return fetchApi('/api/auth/logout', { method: 'POST' });
  },

  async me() {
    return fetchApi<{ user: ApiUser; token: string | null }>('/api/auth/me');
  },

  async googleSignIn(mode: 'login' | 'register' | 'calendar' = 'login', returnTo = '/') {
    // Redirects browser to Google OAuth — no fetch needed
    const params = new URLSearchParams({ mode, returnTo });
    window.location.href = `${API_BASE_URL}/api/auth/google?${params}`;
  },

  async googleSetupCompany(data: { companyName: string; state?: string; phone?: string }) {
    return fetchApi('/api/auth/google/setup-company', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyEmail(token: string) {
    return fetchApi('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async resendVerification(email: string) {
    return fetchApi('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async forgotPassword(email: string) {
    return fetchApi('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, password: string) {
    return fetchApi('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
};

// ============================================
// LEADS API
// ============================================

export const leadsApi = {
  async list(params?: { status?: string; page?: number; limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ leads: ApiLead[]; total: number }>(`/api/leads${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return fetchApi<ApiLead>(`/api/leads/${id}`);
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<ApiLead>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return fetchApi<ApiLead>(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi(`/api/leads/${id}`, { method: 'DELETE' });
  },
};

// ============================================
// TASKS API
// ============================================

export const tasksApi = {
  async list(params?: { status?: string; priority?: string }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ tasks: ApiTask[]; total: number }>(`/api/tasks${query ? `?${query}` : ''}`);
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<ApiTask>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return fetchApi<ApiTask>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ============================================
// PATIENTS API
// ============================================

export const patientsApi = {
  async list(params?: { search?: string; page?: number; limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ patients: ApiPatient[]; pagination: ApiPagination }>(`/api/patients${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return fetchApi<{ patient: ApiPatient }>(`/api/patients/${id}`);
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<{ patient: ApiPatient }>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return fetchApi<{ patient: ApiPatient }>(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi(`/api/patients/${id}`, { method: 'DELETE' });
  },

  async importCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi<{ imported: number; updated: number; errors: { row: number; name: string; reason: string }[] }>(
      '/api/patients/import',
      { method: 'POST', body: formData }
    );
  },

  async signConsent(id: string, signatureUrl: string, metadata?: { documentVersion?: string }, correctionReason?: string) {
    return fetchApi<{
      success: boolean;
      consentSignedAt: string;
      consentSignatureUrl: string;
      consentCorrectionCount: number;
      lastConsentCorrectionAt: string | null;
      lastConsentCorrectionReason: string | null;
      message: string;
    }>(
      `/api/patients/${id}/consent`,
      { method: 'POST', body: JSON.stringify({ signatureUrl, metadata, correctionReason }) }
    );
  },

  async getConsentSignatureHistory(id: string) {
    return fetchApi<{ history: ApiSignatureHistoryEntry[] }>(`/api/patients/${id}/consent/history`);
  },
};

// ============================================
// APPOINTMENTS API
// ============================================

export const appointmentsApi = {
  async list(params?: { date?: string; professionalId?: string; status?: string; page?: number; limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ appointments: ApiAppointment[]; pagination: ApiPagination }>(`/api/appointments${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return fetchApi<{ appointment: ApiAppointment }>(`/api/appointments/${id}`);
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<{ appointment: ApiAppointment }>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async checkGoogleConflicts(professionalId: string, startTime: string, endTime: string) {
    const params = new URLSearchParams({ professionalId, startTime, endTime });
    return fetchApi<{ hasConflict: boolean; event?: { title: string; start: string; end: string } }>(
      `/api/appointments/check-google-conflicts?${params}`
    );
  },

  // Booking público (sem autenticação)
  async createPublic(data: {
    companyId: string;
    procedureId: string;
    professionalId: string;
    date: string;
    patientInfo: { name: string; email: string; phone: string; password?: string };
  }) {
    return fetchApi<{ appointment: ApiAppointment; patient: ApiPatient }>('/api/public/booking', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return fetchApi<{ appointment: ApiAppointment }>(`/api/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateStatus(id: string, status: string) {
    return fetchApi<{ appointment: ApiAppointment }>(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async cancel(id: string) {
    return fetchApi(`/api/appointments/${id}`, { method: 'DELETE' });
  },

  async processPayment(id: string, paymentMethod: string, installments = 1) {
    return fetchApi<{
      success: boolean;
      appointment: ApiAppointment;
      transactions: { income: ApiTransaction; expense: ApiTransaction; installments?: ApiTransaction[] };
      summary: { revenue: number; cost: number; profit: number };
    }>(`/api/appointments/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod, installments }),
    });
  },

  async signConsent(id: string, signatureUrl: string, metadata?: { documentVersion?: string }, correctionReason?: string) {
    return fetchApi<{
      success: boolean;
      signatureUrl: string;
      signatureMetadata: Record<string, unknown>;
      signatureCorrectionCount: number;
      lastSignatureCorrectionAt: string | null;
      lastSignatureCorrectionReason: string | null;
    }>(
      `/api/appointments/${id}/consent`,
      { method: 'POST', body: JSON.stringify({ signatureUrl, metadata, correctionReason }) }
    );
  },

  async getSignatureHistory(id: string) {
    return fetchApi<{ history: ApiSignatureHistoryEntry[] }>(`/api/appointments/${id}/signature-history`);
  },
};

// ============================================
// TRANSACTIONS API
// ============================================

export const transactionsApi = {
  async list(params?: { startDate?: string; endDate?: string; type?: string; status?: string; page?: number; limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ transactions: ApiTransaction[]; summary: ApiTransactionSummary; pagination: ApiPagination }>(`/api/transactions${query ? `?${query}` : ''}`);
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<{ transaction: ApiTransaction }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async checkout(data: { appointmentId: string; paymentMethod: string; amount?: number; discount?: number }) {
    return fetchApi<{ transaction: ApiTransaction; commission?: ApiTransaction }>('/api/transactions/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async backfillExpenses(forceRecreate = true) {
    return fetchApi<{ success: boolean; message: string; results: { created: number; skipped: number } }>('/api/transactions/backfill-expenses', {
      method: 'POST',
      body: JSON.stringify({ forceRecreate }),
    });
  },

  async getMissingExpenses() {
    return fetchApi<{ total: number; missingExpenses: number; appointments: ApiAppointment[] }>('/api/transactions/backfill-expenses');
  },

  async diagnoseExpenses() {
    return fetchApi<{ issues: string[]; details: Record<string, unknown> }>('/api/transactions/diagnose');
  },

  async resetExpenses() {
    return fetchApi<{ success: boolean; deleted: number; created: number; details: string[] }>('/api/transactions/diagnose', {
      method: 'DELETE',
    });
  },

  async importCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi<{ imported: number; updated: number; errors: { row: number; name: string; reason: string }[] }>('/api/transactions/import', {
      method: 'POST',
      body: formData,
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return fetchApi<{ transaction: ApiTransaction }>(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<{ success: boolean }>(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
  },

};

// ============================================
// PROCEDURES API
// ============================================

export const proceduresApi = {
  async list(params?: { search?: string; isActive?: string; page?: number; limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ procedures: ApiProcedure[]; pagination: ApiPagination }>(`/api/procedures${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return fetchApi<{ procedure: ApiProcedure }>(`/api/procedures/${id}`);
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<{ procedure: ApiProcedure }>('/api/procedures', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return fetchApi<{ procedure: ApiProcedure }>(`/api/procedures/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<{ success: boolean }>(`/api/procedures/${id}`, {
      method: 'DELETE',
    });
  },

  async importCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi<{ imported: number; updated: number; errors: { row: number; name: string; reason: string }[] }>(
      '/api/procedures/import',
      { method: 'POST', body: formData }
    );
  },
};

// ============================================
// INVENTORY API
// ============================================

export const inventoryApi = {
  async list(params?: { search?: string; lowStock?: string; page?: number; limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ items: ApiInventoryItem[]; summary: { total: number; lowStock: number }; pagination: ApiPagination }>(`/api/inventory${query ? `?${query}` : ''}`);
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<{ item: ApiInventoryItem }>('/api/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async adjust(id: string, data: { quantity: number; type: string; reason: string }) {
    return fetchApi<{ item: ApiInventoryItem; movement: ApiInventoryMovement }>(`/api/inventory/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return fetchApi<{ item: ApiInventoryItem }>(`/api/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<{ success: boolean; message: string }>(`/api/inventory/${id}`, { method: 'DELETE' });
  },

  async importCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi<{ imported: number; updated: number; errors: { row: number; name: string; reason: string }[] }>('/api/inventory/import', {
      method: 'POST',
      body: formData,
    });
  },
};

// ============================================
// PRODUCTS API (Legacy - pode ser removido)
// ============================================

export const productsApi = {
  async list() {
    return fetchApi<{ products: ApiProduct[] }>('/api/products');
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<ApiProduct>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============================================
// DASHBOARD API
// ============================================

export interface DashboardData {
  kpis: {
    revenue: number;
    ticketMedio: number;
    seenPatients: number;
    cancelRate: number;
    appointmentsTotal: number;
    appointmentsConfirmed: number;
    appointmentsCompleted: number;
    appointmentsCanceled: number;
  };
  charts: {
    revenueChart: { date: string; name: string; value: number }[];
    topProcedures: { name: string; count: number }[];
  };
  alerts: {
    lowStock: { id: string; title: string; message: string; type: string }[];
  };
  days: number;
}

export const dashboardApi = {
  async getStats(days: number = 7) {
    return fetchApi<DashboardData>(`/api/dashboard?days=${days}`);
  },
};

// ============================================
// UNAVAILABILITY API
// ============================================

export const unavailabilityApi = {
  async list(params?: { professionalId?: string; page?: number; limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ rules: ApiUnavailabilityRule[]; pagination: ApiPagination }>(`/api/unavailability${query ? `?${query}` : ''}`);
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<{ rule: ApiUnavailabilityRule }>('/api/unavailability', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi(`/api/unavailability/${id}`, { method: 'DELETE' });
  },
};

// ============================================
// NOTIFICATIONS API
// ============================================

export const notificationsApi = {
  async list() {
    return fetchApi<{ notifications: ApiNotification[] }>('/api/notifications');
  },

  async markAsRead(id: string) {
    return fetchApi(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<{ notification: ApiNotification }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============================================
// PHOTOS API
// ============================================

export const photosApi = {
  async list(params?: { patientId?: string; groupId?: string; limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ photos: ApiPhoto[] }>(`/api/photos${query ? `?${query}` : ''}`);
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<{ photo: ApiPhoto }>('/api/photos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi(`/api/photos?id=${id}`, { method: 'DELETE' });
  },
};

// ============================================
// TICKETS API
// ============================================

export const ticketsApi = {
  async list(params?: { status?: string; limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ tickets: ApiTicket[] }>(`/api/tickets${query ? `?${query}` : ''}`);
  },

  async create(data: { subject: string; message: string }) {
    return fetchApi<{ ticket: ApiTicket }>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async reply(ticketId: string, message: string) {
    return fetchApi<{ ticket: ApiTicket }>('/api/tickets', {
      method: 'PATCH',
      body: JSON.stringify({ ticketId, message }),
    });
  },

  async close(ticketId: string) {
    return fetchApi<{ ticket: ApiTicket }>('/api/tickets', {
      method: 'PATCH',
      body: JSON.stringify({ ticketId, status: 'CLOSED' }),
    });
  },
};

// ============================================
// SYSTEM ALERTS API
// ============================================

export const systemAlertsApi = {
  async list(activeOnly = true) {
    return fetchApi<{ alerts: ApiSystemAlert[] }>(`/api/system-alerts?activeOnly=${activeOnly}`);
  },

  async create(data: { title: string; message: string; type?: string; target?: string }) {
    return fetchApi<{ alert: ApiSystemAlert }>('/api/system-alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async toggleStatus(id: string, status: string) {
    return fetchApi<{ alert: ApiSystemAlert }>('/api/system-alerts', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    });
  },
};

// ============================================
// HEALTH CHECK
// ============================================

export const healthApi = {
  async check() {
    return fetchApi<{ status: string; version: string }>('/api/health');
  },
};

// ============================================
// COMPANIES API
// ============================================

export const companiesApi = {
  async list(params?: { limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ companies: ApiCompany[] }>(`/api/companies${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return fetchApi<{ company: ApiCompany }>(`/api/companies/${id}`);
  },

  async update(id: string, data: Record<string, unknown>) {
    return fetchApi<{ company: ApiCompany }>(`/api/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ============================================
// PUBLIC API (sem autenticação)
// ============================================

export const publicApi = {
  // Buscar empresa pelo slug (para página de booking)
  async getCompanyBySlug(slug: string) {
    return fetchApi<ApiPublicBookingData>(`/api/public/company/${slug}`);
  },
};

// ============================================
// USERS API
// ============================================

export const usersApi = {
  async list(params?: { companyId?: string; role?: string; limit?: number }) {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchApi<{ users: ApiUser_Extended[] }>(`/api/users${query ? `?${query}` : ''}`);
  },

  async create(data: Record<string, unknown>) {
    return fetchApi<{ user: ApiUser_Extended }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resetPassword(userId: string, newPassword: string) {
    return fetchApi<{ success: boolean; message: string }>(`/api/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return fetchApi<{ user: ApiUser_Extended }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<{ success: boolean; message: string }>(`/api/users/${id}`, { method: 'DELETE' });
  },
};

// ============ KING APIs (Owner Only) ============
export const kingApi = {
  // Dashboard global stats
  dashboard: async () => {
    return fetchApi('/api/king/dashboard');
  },

  // Todas as empresas
  companies: async (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    return fetchApi(`/api/king/companies?${query.toString()}`);
  },

  // Todos os pacientes (global)
  patients: async (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    return fetchApi(`/api/king/patients?${query.toString()}`);
  },

  // Todos os agendamentos (global)
  appointments: async (params?: { page?: number; limit?: number; startDate?: string; endDate?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.status) query.set('status', params.status);
    return fetchApi(`/api/king/appointments?${query.toString()}`);
  },

  // Leads de vendas (empresas FREE/TRIAL para conversão)
  leads: async () => {
    return fetchApi<{ leads: ApiKingLead[] }>('/api/king/leads');
  },

  // Atualizar status de lead (conversão)
  updateLead: async (companyId: string, data: {
    status?: string;
    plan?: string;
    demoAt?: string;
    demoNotes?: string;
    lostReason?: string;
    lostComment?: string;
  }) => {
    return fetchApi('/api/king/leads', {
      method: 'PATCH',
      body: JSON.stringify({ companyId, ...data }),
    });
  },

  // Marcar todos os leads como vistos pelo owner
  markLeadsSeen: async () => {
    return fetchApi('/api/king/leads/mark-seen', { method: 'PATCH' });
  },
};

// ============================================
// SYSTEM API (Maintenance Mode)
// ============================================

export const systemApi = {
  async getStatus() {
    return fetchApi<{ maintenanceMode: boolean; maintenanceMessage?: string }>('/api/system/status');
  },

  async getMaintenance() {
    return fetchApi<{ maintenanceMode: boolean; maintenanceMessage?: string; maintenanceStartedAt?: string }>('/api/system/maintenance');
  },

  async setMaintenance(enabled: boolean, message?: string) {
    return fetchApi<{ success: boolean; maintenanceMode: boolean; message: string }>('/api/system/maintenance', {
      method: 'POST',
      body: JSON.stringify({ enabled, message }),
    });
  },
};

// ============================================
// PLANS API (SaaS Plans - Owner Only)
// ============================================

export interface SaasPlan {
  id: string;
  name: string;
  price: number;
  maxProfessionals?: number;
  maxPatients?: number;
  modules?: string[];
  features: string[];
  active: boolean;
  stripePaymentLink: string;
}

export const plansApi = {
  async list(activeOnly = false) {
    const query = activeOnly ? '?active=true' : '';
    return fetchApi<SaasPlan[]>(`/api/plans${query}`);
  },

  async create(data: { name: string; price: number; features: string[]; active?: boolean; stripePaymentLink?: string; maxProfessionals?: number; maxPatients?: number; modules?: string[] }) {
    return fetchApi<{ success: boolean; plan: SaasPlan }>('/api/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<{ name: string; price: number; features: string[]; active: boolean; stripePaymentLink: string; maxProfessionals: number; maxPatients: number; modules: string[] }>) {
    return fetchApi<{ success: boolean; plan: SaasPlan }>(`/api/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<{ success: boolean }>(`/api/plans/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// BILLING API
// ============================================

export interface BillingPlan {
  id: string;
  name: string;
  displayName: string | null;
  price: number;
  features: string[];
  maxProfessionals: number;
  maxPatients: number;
}

export interface BillingPlansResponse {
  plans: BillingPlan[];
  currentPlan: string | null;
  currentStatus: string | null;
  subscriptionExpiresAt: string | null;
}

export const billingApi = {
  getPlans: () =>
    fetchApi<{ success: boolean; data: BillingPlansResponse }>('/api/billing/plans'),

  checkout: (planId: string) =>
    fetchApi<{ success: boolean; data: { subscriptionId: string; paymentUrl: string | null; planName: string } }>(
      '/api/billing/checkout',
      { method: 'POST', body: JSON.stringify({ planId }) }
    ),

  getStatus: () =>
    fetchApi<{ success: boolean; data: { status: string; plan: string; expiresAt: string | null } }>(
      '/api/billing/status'
    ),
};

// ============================================
// CALENDAR API
// ============================================

export const calendarApi = {
  async getStatus() {
    return fetchApi<{ connected: boolean; calendarId: string | null }>(
      '/api/auth/google/calendar/status'
    );
  },

  async connect(returnTo = '/settings') {
    // Redirects browser to Google OAuth with calendar scope
    window.location.href = `${API_BASE_URL}/api/auth/google?mode=calendar&returnTo=${encodeURIComponent(returnTo)}`;
  },

  async disconnect() {
    return fetchApi('/api/auth/google/calendar/disconnect', { method: 'POST' });
  },

  async sync() {
    return fetchApi<{ success: boolean; synced: number }>('/api/auth/google/calendar/sync', { method: 'POST' });
  },
};

// ============================================
// SUBSCRIPTIONS API (Clube de Assinaturas)
// ============================================

export interface SubscriptionPlanItem {
  id: string;
  procedureId: string;
  sessionsPerCycle: number;
  procedure: { id: string; name: string; price: number };
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  companyId: string;
  createdAt: string;
  items: SubscriptionPlanItem[];
  _count?: { subscribers: number };
}

export interface PatientSubscription {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELED' | 'OVERDUE' | 'PENDING';
  startDate: string | null;
  createdAt: string;
  nextBillingDate: string;
  sessionsUsedThisCycle: Record<string, number>;
  lastCycleReset: string;
  asaasSubscriptionId: string | null;
  patientId: string;
  planId: string;
  companyId: string;
  patient: { id: string; name: string; phone: string; email: string };
  plan: SubscriptionPlan;
}

export const subscriptionsApi = {
  // Plans
  async listPlans(includeInactive = false) {
    return fetchApi<SubscriptionPlan[]>(`/api/subscriptions/plans${includeInactive ? '?includeInactive=true' : ''}`);
  },
  async createPlan(data: { name: string; price: number; description?: string; imageUrl?: string; items: { procedureId: string; sessionsPerCycle: number }[] }) {
    return fetchApi<SubscriptionPlan>('/api/subscriptions/plans', { method: 'POST', body: JSON.stringify(data) });
  },
  async updatePlan(id: string, data: { name?: string; price?: number; description?: string; imageUrl?: string; isActive?: boolean; items?: { procedureId: string; sessionsPerCycle: number }[] }) {
    return fetchApi<SubscriptionPlan>(`/api/subscriptions/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deactivatePlan(id: string) {
    return fetchApi(`/api/subscriptions/plans/${id}`, { method: 'DELETE' });
  },

  // Subscribers
  async listSubscribers(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return fetchApi<PatientSubscription[]>(`/api/subscriptions/patients${qs}`);
  },
  async subscribe(data: { patientId: string; planId: string; nextBillingDate: string; asaasSubscriptionId?: string; asaasCustomerId?: string }) {
    return fetchApi<PatientSubscription>('/api/subscriptions/patients', { method: 'POST', body: JSON.stringify(data) });
  },
  async cancel(subscriptionId: string) {
    return fetchApi<PatientSubscription>(`/api/subscriptions/patients/${subscriptionId}/cancel`, { method: 'PUT' });
  },
  async activate(subscriptionId: string) {
    return fetchApi<PatientSubscription>(`/api/subscriptions/patients/${subscriptionId}/activate`, { method: 'PATCH' });
  },
  async listPending() {
    return fetchApi<PatientSubscription[]>('/api/subscriptions/patients?status=PENDING');
  },
  async listForPatient(patientId: string) {
    return fetchApi<PatientSubscription[]>(`/api/subscriptions/patients?patientId=${encodeURIComponent(patientId)}`);
  },
  async requestSelf(planId: string) {
    return fetchApi<{ id: string; status: string; planId: string }>(
      '/api/subscriptions/patients/self',
      { method: 'POST', body: JSON.stringify({ planId }) }
    );
  },
};

export const publicBookingApi = {
  async bookSubscriptionPlan(data: {
    companyId: string;
    planId: string;
    procedureId: string;
    professionalId: string | null;
    date: string;
    patientInfo: { name: string; email: string; phone: string; password?: string };
  }) {
    return fetchApi<{ appointmentId: string; patientToken: string }>('/api/public/subscriptions/book', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============================================
// RETENTION API
// ============================================

export interface RetentionPatient {
  id: string;
  name: string;
  phone: string;
  lastProcedure: string;
  lastVisit: string;
  expectedReturn: string;
  daysOverdue: number;
  risk: 'attention' | 'at_risk' | 'lost';
  intervalUsed: number;
  isDefaultInterval: boolean;
}

export interface RetentionReport {
  summary: { attention: number; at_risk: number; lost: number; retentionRate: number };
  patients: RetentionPatient[];
}

export const retentionApi = {
  async getReport(params?: { period?: 30 | 60 | 90; professionalId?: string }) {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', String(params.period));
    if (params?.professionalId) query.set('professionalId', params.professionalId);
    const qs = query.toString();
    return fetchApi<RetentionReport>(`/api/retention${qs ? `?${qs}` : ''}`);
  },
};

// ============================================
// WHATSAPP API
// ============================================

export const whatsappApi = {
  getStatus: () => fetchApi<{
    status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'
    phoneNumber?: string
    termsAccepted: boolean
    chatbotEnabled?: boolean
    qrCode?: string | null
  }>('/api/whatsapp/instance'),

  connect: (acceptTerms: boolean) =>
    fetchApi<{ qrCode: string; status: string }>('/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms }),
    }),

  disconnect: () =>
    fetchApi<{ success: boolean }>('/api/whatsapp/instance', { method: 'DELETE' }),

  setChatbotEnabled: (chatbotEnabled: boolean) =>
    fetchApi<{ chatbotEnabled: boolean }>('/api/whatsapp/instance', {
      method: 'PATCH',
      body: JSON.stringify({ chatbotEnabled }),
    }),
};

// Export all APIs
export const api = {
  auth: authApi,
  leads: leadsApi,
  tasks: tasksApi,
  patients: patientsApi,
  appointments: appointmentsApi,
  transactions: transactionsApi,
  procedures: proceduresApi,
  inventory: inventoryApi,
  products: productsApi,
  dashboard: dashboardApi,
  notifications: notificationsApi,
  unavailability: unavailabilityApi,
  photos: photosApi,
  tickets: ticketsApi,
  systemAlerts: systemAlertsApi,
  health: healthApi,
  companies: companiesApi,
  users: usersApi,
  billing: billingApi,
  calendar: calendarApi,
  public: publicApi,
  king: kingApi,
  system: systemApi,
  plans: plansApi,
  subscriptions: subscriptionsApi,
  retention: retentionApi,
  whatsapp: whatsappApi,
};

export default api;
