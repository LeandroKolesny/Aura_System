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

export const dashboardApi = {
  async getStats(period?: string) {
    const query = period ? `?period=${period}` : '';
    return fetchApi<{ metrics: any; charts: any; alerts: any; recentActivities: any }>(`/api/dashboard${query}`);
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
};

export default api;

