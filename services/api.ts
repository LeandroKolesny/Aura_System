// Aura System - API Service
// Integração com o backend Next.js

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Adiciona token de autenticação se existir
  const token = localStorage.getItem('aura_token');
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
// AUTH API
// ============================================

export const authApi = {
  async login(email: string, password: string) {
    const result = await fetchApi<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.success && result.data?.token) {
      localStorage.setItem('aura_token', result.data.token);
    }

    return result;
  },

  async register(data: { name: string; email: string; password: string; companyName: string }) {
    return fetchApi<{ user: any; company: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async logout() {
    localStorage.removeItem('aura_token');
    return fetchApi('/api/auth/logout', { method: 'POST' });
  },

  async me() {
    return fetchApi<{ user: any }>('/api/auth/me');
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
};

// ============================================
// LEADS API
// ============================================

export const leadsApi = {
  async list(params?: { status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ leads: any[]; total: number }>(`/api/leads${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return fetchApi<any>(`/api/leads/${id}`);
  },

  async create(data: any) {
    return fetchApi<any>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return fetchApi<any>(`/api/leads/${id}`, {
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
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ tasks: any[]; total: number }>(`/api/tasks${query ? `?${query}` : ''}`);
  },

  async create(data: any) {
    return fetchApi<any>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return fetchApi<any>(`/api/tasks/${id}`, {
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
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ patients: any[]; pagination: any }>(`/api/patients${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return fetchApi<{ patient: any }>(`/api/patients/${id}`);
  },

  async create(data: any) {
    return fetchApi<{ patient: any }>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return fetchApi<{ patient: any }>(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi(`/api/patients/${id}`, { method: 'DELETE' });
  },
};

// ============================================
// APPOINTMENTS API
// ============================================

export const appointmentsApi = {
  async list(params?: { date?: string; professionalId?: string; status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ appointments: any[]; pagination: any }>(`/api/appointments${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return fetchApi<{ appointment: any }>(`/api/appointments/${id}`);
  },

  async create(data: any) {
    return fetchApi<{ appointment: any }>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Booking público (sem autenticação)
  async createPublic(data: {
    companyId: string;
    procedureId: string;
    professionalId: string;
    date: string;
    patientInfo: { name: string; email: string; phone: string; password?: string };
  }) {
    return fetchApi<{ appointment: any; patient: any }>('/api/public/booking', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return fetchApi<{ appointment: any }>(`/api/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateStatus(id: string, status: string) {
    return fetchApi<{ appointment: any }>(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async cancel(id: string) {
    return fetchApi(`/api/appointments/${id}`, { method: 'DELETE' });
  },

  async processPayment(id: string, paymentMethod: string) {
    return fetchApi<{
      success: boolean;
      appointment: any;
      transactions: { income: any; expense: any };
      summary: { revenue: number; cost: number; profit: number };
    }>(`/api/appointments/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
  },
};

// ============================================
// TRANSACTIONS API
// ============================================

export const transactionsApi = {
  async list(params?: { startDate?: string; endDate?: string; type?: string; status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ transactions: any[]; summary: any; pagination: any }>(`/api/transactions${query ? `?${query}` : ''}`);
  },

  async create(data: any) {
    return fetchApi<{ transaction: any }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async checkout(data: { appointmentId: string; paymentMethod: string; amount?: number; discount?: number }) {
    return fetchApi<{ transaction: any; commission?: any }>('/api/transactions/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async backfillExpenses(forceRecreate = true) {
    return fetchApi<{ success: boolean; message: string; results: any }>('/api/transactions/backfill-expenses', {
      method: 'POST',
      body: JSON.stringify({ forceRecreate }),
    });
  },

  async getMissingExpenses() {
    return fetchApi<{ total: number; missingExpenses: number; appointments: any[] }>('/api/transactions/backfill-expenses');
  },

  async diagnoseExpenses() {
    return fetchApi<any>('/api/transactions/diagnose');
  },

  async resetExpenses() {
    return fetchApi<{ success: boolean; deleted: number; created: number; details: any[] }>('/api/transactions/diagnose', {
      method: 'DELETE',
    });
  },
};

// ============================================
// PROCEDURES API
// ============================================

export const proceduresApi = {
  async list(params?: { search?: string; isActive?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ procedures: any[]; pagination: any }>(`/api/procedures${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return fetchApi<{ procedure: any }>(`/api/procedures/${id}`);
  },

  async create(data: any) {
    return fetchApi<{ procedure: any }>('/api/procedures', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return fetchApi<{ procedure: any }>(`/api/procedures/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<{ success: boolean }>(`/api/procedures/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// INVENTORY API
// ============================================

export const inventoryApi = {
  async list(params?: { search?: string; lowStock?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ items: any[]; summary: any; pagination: any }>(`/api/inventory${query ? `?${query}` : ''}`);
  },

  async create(data: any) {
    return fetchApi<{ item: any }>('/api/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async adjust(id: string, data: { quantity: number; type: string; reason: string }) {
    return fetchApi<{ item: any; movement: any }>(`/api/inventory/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============================================
// PRODUCTS API (Legacy - pode ser removido)
// ============================================

export const productsApi = {
  async list() {
    return fetchApi<{ products: any[] }>('/api/products');
  },

  async create(data: any) {
    return fetchApi<any>('/api/products', {
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
    const query = params ? new URLSearchParams(params as any).toString() : '';
    return fetchApi<{ rules: any[]; pagination: any }>(`/api/unavailability${query ? `?${query}` : ''}`);
  },

  async create(data: any) {
    return fetchApi<{ rule: any }>('/api/unavailability', {
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
    return fetchApi<{ notifications: any[] }>('/api/notifications');
  },

  async markAsRead(id: string) {
    return fetchApi(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },

  async create(data: any) {
    return fetchApi<{ notification: any }>('/api/notifications', {
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
    const query = params ? new URLSearchParams(params as any).toString() : '';
    return fetchApi<{ photos: any[] }>(`/api/photos${query ? `?${query}` : ''}`);
  },

  async create(data: any) {
    return fetchApi<{ photo: any }>('/api/photos', {
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
    const query = params ? new URLSearchParams(params as any).toString() : '';
    return fetchApi<{ tickets: any[] }>(`/api/tickets${query ? `?${query}` : ''}`);
  },

  async create(data: { subject: string; message: string }) {
    return fetchApi<{ ticket: any }>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async reply(ticketId: string, message: string) {
    return fetchApi<{ ticket: any }>('/api/tickets', {
      method: 'PATCH',
      body: JSON.stringify({ ticketId, message }),
    });
  },

  async close(ticketId: string) {
    return fetchApi<{ ticket: any }>('/api/tickets', {
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
    return fetchApi<{ alerts: any[] }>(`/api/system-alerts?activeOnly=${activeOnly}`);
  },

  async create(data: { title: string; message: string; type?: string; target?: string }) {
    return fetchApi<{ alert: any }>('/api/system-alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async toggleStatus(id: string, status: string) {
    return fetchApi<{ alert: any }>('/api/system-alerts', {
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
    const query = params ? new URLSearchParams(params as any).toString() : '';
    return fetchApi<{ companies: any[] }>(`/api/companies${query ? `?${query}` : ''}`);
  },

  async get(id: string) {
    return fetchApi<{ company: any }>(`/api/companies/${id}`);
  },

  async update(id: string, data: any) {
    return fetchApi<{ company: any }>(`/api/companies/${id}`, {
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
    return fetchApi<{
      company: any;
      procedures: any[];
      professionals: any[];
      appointments: any[];
      unavailabilityRules: any[];
    }>(`/api/public/company/${slug}`);
  },
};

// ============================================
// USERS API
// ============================================

export const usersApi = {
  async list(params?: { companyId?: string; role?: string; limit?: number }) {
    const query = params ? new URLSearchParams(params as any).toString() : '';
    return fetchApi<{ users: any[] }>(`/api/users${query ? `?${query}` : ''}`);
  },

  async create(data: any) {
    return fetchApi<{ user: any }>('/api/users', {
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
    return fetchApi<{ leads: any[] }>('/api/king/leads');
  },

  // Atualizar status de lead (conversão)
  updateLead: async (companyId: string, data: { status?: string; plan?: string }) => {
    return fetchApi('/api/king/leads', {
      method: 'PATCH',
      body: JSON.stringify({ companyId, ...data }),
    });
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
  features: string[];
  active: boolean;
  stripePaymentLink: string;
}

export const plansApi = {
  async list(activeOnly = false) {
    const query = activeOnly ? '?active=true' : '';
    return fetchApi<SaasPlan[]>(`/api/plans${query}`);
  },

  async create(data: { name: string; price: number; features: string[]; active?: boolean; stripePaymentLink?: string }) {
    return fetchApi<{ success: boolean; plan: SaasPlan }>('/api/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<{ name: string; price: number; features: string[]; active: boolean; stripePaymentLink: string }>) {
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
  calendar: calendarApi,
  public: publicApi,
  king: kingApi,
  system: systemApi,
  plans: plansApi,
};

export default api;

