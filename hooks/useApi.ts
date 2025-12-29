// Aura System - Hook para consumir APIs do Backend
// Substitui gradualmente as funções mock do AppContext
import { useState, useCallback } from 'react';
import { 
  patientsApi, 
  appointmentsApi, 
  transactionsApi, 
  proceduresApi, 
  inventoryApi,
  dashboardApi 
} from '../services/api';

// Hook genérico para gerenciar estado de loading e erro
function useApiState<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return { data, setData, loading, setLoading, error, setError };
}

// ============================================
// PATIENTS HOOK
// ============================================
export function usePatients() {
  const { data: patients, setData: setPatients, loading, setLoading, error, setError } = useApiState<any[]>();
  const [pagination, setPagination] = useState<any>(null);

  const fetchPatients = useCallback(async (params?: { search?: string; page?: number; limit?: number }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await patientsApi.list(params);
      if (result.success && result.data) {
        setPatients(result.data.patients);
        setPagination(result.data.pagination);
      } else {
        setError(result.error || 'Erro ao carregar pacientes');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPatient = useCallback(async (data: any) => {
    setLoading(true);
    try {
      const result = await patientsApi.create(data);
      if (result.success && result.data) {
        setPatients(prev => prev ? [...prev, result.data!.patient] : [result.data!.patient]);
        return { success: true, patient: result.data.patient };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePatient = useCallback(async (id: string, data: any) => {
    try {
      const result = await patientsApi.update(id, data);
      if (result.success && result.data) {
        setPatients(prev => prev?.map(p => p.id === id ? result.data!.patient : p) || null);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    }
  }, []);

  const deletePatient = useCallback(async (id: string) => {
    try {
      const result = await patientsApi.delete(id);
      if (result.success) {
        setPatients(prev => prev?.filter(p => p.id !== id) || null);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    }
  }, []);

  return { patients, pagination, loading, error, fetchPatients, createPatient, updatePatient, deletePatient };
}

// ============================================
// APPOINTMENTS HOOK
// ============================================
export function useAppointments() {
  const { data: appointments, setData: setAppointments, loading, setLoading, error, setError } = useApiState<any[]>();
  const [pagination, setPagination] = useState<any>(null);

  const fetchAppointments = useCallback(async (params?: any) => {
    setLoading(true);
    setError(null);
    try {
      const result = await appointmentsApi.list(params);
      if (result.success && result.data) {
        setAppointments(result.data.appointments);
        setPagination(result.data.pagination);
      } else {
        setError(result.error || 'Erro ao carregar agendamentos');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  const createAppointment = useCallback(async (data: any) => {
    setLoading(true);
    try {
      const result = await appointmentsApi.create(data);
      if (result.success && result.data) {
        setAppointments(prev => prev ? [...prev, result.data!.appointment] : [result.data!.appointment]);
        return { success: true, appointment: result.data.appointment };
      }
      return { success: false, error: result.error, conflict: result.error?.includes('Conflito') };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = useCallback(async (id: string, status: string) => {
    try {
      const result = await appointmentsApi.updateStatus(id, status);
      if (result.success && result.data) {
        setAppointments(prev => prev?.map(a => a.id === id ? result.data!.appointment : a) || null);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    }
  }, []);

  const cancelAppointment = useCallback(async (id: string) => {
    try {
      const result = await appointmentsApi.cancel(id);
      if (result.success) {
        setAppointments(prev => prev?.map(a => a.id === id ? { ...a, status: 'CANCELED' } : a) || null);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    }
  }, []);

  return { appointments, pagination, loading, error, fetchAppointments, createAppointment, updateStatus, cancelAppointment };
}

// ============================================
// TRANSACTIONS HOOK
// ============================================
export function useTransactions() {
  const { data: transactions, setData: setTransactions, loading, setLoading, error, setError } = useApiState<any[]>();
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchTransactions = useCallback(async (params?: any) => {
    setLoading(true);
    setError(null);
    try {
      const result = await transactionsApi.list(params);
      if (result.success && result.data) {
        setTransactions(result.data.transactions);
        setSummary(result.data.summary);
        setPagination(result.data.pagination);
      } else {
        setError(result.error || 'Erro ao carregar transações');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  const createTransaction = useCallback(async (data: any) => {
    setLoading(true);
    try {
      const result = await transactionsApi.create(data);
      if (result.success && result.data) {
        setTransactions(prev => prev ? [...prev, result.data!.transaction] : [result.data!.transaction]);
        return { success: true, transaction: result.data.transaction };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    } finally {
      setLoading(false);
    }
  }, []);

  const processCheckout = useCallback(async (data: { appointmentId: string; paymentMethod: string; amount?: number; discount?: number }) => {
    setLoading(true);
    try {
      const result = await transactionsApi.checkout(data);
      if (result.success && result.data) {
        return { success: true, transaction: result.data.transaction, commission: result.data.commission };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    } finally {
      setLoading(false);
    }
  }, []);

  return { transactions, summary, pagination, loading, error, fetchTransactions, createTransaction, processCheckout };
}

// ============================================
// DASHBOARD HOOK
// ============================================
export function useDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (period?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardApi.getStats(period);
      if (result.success && result.data) {
        setMetrics(result.data.metrics);
        setCharts(result.data.charts);
        setAlerts(result.data.alerts);
        setActivities(result.data.recentActivities || []);
      } else {
        setError(result.error || 'Erro ao carregar dashboard');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  return { metrics, charts, alerts, activities, loading, error, fetchDashboard };
}

// ============================================
// INVENTORY HOOK
// ============================================
export function useInventory() {
  const { data: items, setData: setItems, loading, setLoading, error, setError } = useApiState<any[]>();
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchInventory = useCallback(async (params?: any) => {
    setLoading(true);
    setError(null);
    try {
      const result = await inventoryApi.list(params);
      if (result.success && result.data) {
        setItems(result.data.items);
        setSummary(result.data.summary);
        setPagination(result.data.pagination);
      } else {
        setError(result.error || 'Erro ao carregar estoque');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  const createItem = useCallback(async (data: any) => {
    setLoading(true);
    try {
      const result = await inventoryApi.create(data);
      if (result.success && result.data) {
        setItems(prev => prev ? [...prev, result.data!.item] : [result.data!.item]);
        return { success: true, item: result.data.item };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    } finally {
      setLoading(false);
    }
  }, []);

  const adjustStock = useCallback(async (id: string, data: { quantity: number; type: string; reason: string }) => {
    try {
      const result = await inventoryApi.adjust(id, data);
      if (result.success && result.data) {
        setItems(prev => prev?.map(i => i.id === id ? result.data!.item : i) || null);
        return { success: true, item: result.data.item, movement: result.data.movement };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    }
  }, []);

  return { items, summary, pagination, loading, error, fetchInventory, createItem, adjustStock };
}

// ============================================
// PROCEDURES HOOK
// ============================================
export function useProcedures() {
  const { data: procedures, setData: setProcedures, loading, setLoading, error, setError } = useApiState<any[]>();
  const [pagination, setPagination] = useState<any>(null);

  const fetchProcedures = useCallback(async (params?: any) => {
    setLoading(true);
    setError(null);
    try {
      const result = await proceduresApi.list(params);
      if (result.success && result.data) {
        setProcedures(result.data.procedures);
        setPagination(result.data.pagination);
      } else {
        setError(result.error || 'Erro ao carregar procedimentos');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  const createProcedure = useCallback(async (data: any) => {
    setLoading(true);
    try {
      const result = await proceduresApi.create(data);
      if (result.success && result.data) {
        setProcedures(prev => prev ? [...prev, result.data!.procedure] : [result.data!.procedure]);
        return { success: true, procedure: result.data.procedure };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Erro de conexão' };
    } finally {
      setLoading(false);
    }
  }, []);

  return { procedures, pagination, loading, error, fetchProcedures, createProcedure };
}

