import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  User, Company, Patient, Appointment, Transaction, Procedure,
  PhotoRecord, SaasPlan, Lead, Ticket, SystemAlert, AppNotification,
  UserRole, SystemModule, UnavailabilityRule, LeadStatus, InventoryItem, SignatureMetadata,
  SubscriptionStatus, BusinessHours, SignatureHistoryEntry
} from '../types';
import { PLAN_NAMES, PlanLimits } from '../constants';
import {
  authApi,
  patientsApi,
  appointmentsApi,
  transactionsApi,
  proceduresApi,
  inventoryApi,
  dashboardApi,
  companiesApi,
  usersApi,
  leadsApi,
  unavailabilityApi,
  photosApi,
  ticketsApi,
  systemAlertsApi,
  notificationsApi,
  plansApi,
  kingApi,
  subscriptionsApi,
  setAuthToken,
  getAuthToken,
  type ApiPatient,
  type ApiAppointment,
  type ApiTransaction,
  type ApiProcedure,
  type ApiProcedureSupply,
  type ApiUser_Extended,
  type ApiPhoto,
  type ApiLead,
  type ApiKingLead,
  type ApiCompany,
  type SaasPlan as ApiSaasPlan,
} from '../services/api';
import { installmentsApi } from '../services/installmentsApi';

interface AppContextType {
  user: User | null;
  isInitializing: boolean; // Loading enquanto valida sessão
  login: (email: string, password?: string) => Promise<boolean>;
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  registerCompany: (companyName: string, adminData: { name: string; email: string; password: string; phone?: string; acceptedTerms?: boolean; state?: string; marketingConsent?: boolean }) => Promise<{ success: boolean; error?: string }>;
  setupGoogleCompany: (companyName: string, state?: string, phone?: string) => Promise<{ success: boolean; error?: string }>;

  companies: Company[];
  currentCompany: Company | null;
  updateCompany: (companyId: string, data: Partial<Company>) => Promise<{ success: boolean; company?: Company; error?: string }>;
  completeOnboarding: () => void;

  patients: Patient[];
  addPatient: (patient: Omit<Patient, 'id' | 'companyId' | 'status'> & { status?: 'active' | 'inactive' | 'lead' }) => Promise<{ success: boolean; error?: string; patient?: Patient; limitReached?: boolean }>;
  updatePatient: (id: string, data: Partial<Patient>) => Promise<{ success: boolean; error?: string }>;
  removePatient: (id: string) => Promise<{ success: boolean; error?: string }>;
  signConsent: (id: string, signatureBase64: string) => Promise<{ success: boolean; error?: string }>;
  toggleAnamnesisSent: (id: string) => void;

  appointments: Appointment[];
  addAppointment: (appt: Record<string, unknown>, isPublic?: boolean, publicCompanyId?: string, patientInfo?: { name?: string; email: string; phone: string; password?: string }) => Promise<{ success: boolean; conflict?: boolean; error?: string; appointment?: Appointment }>;
  updateAppointment: (id: string, data: Partial<Appointment>) => void;
  signAppointmentConsent: (id: string, signatureBase64: string, correctionReason?: string) => Promise<{ success: boolean; error?: string }>;
  getAppointmentSignatureHistory: (id: string) => Promise<{ success: boolean; history?: SignatureHistoryEntry[]; error?: string }>;

  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id' | 'companyId'>) => Promise<{ success: boolean; error?: string; transaction?: Transaction }>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<{ success: boolean; error?: string }>;
  deleteTransaction: (id: string) => Promise<{ success: boolean; error?: string }>;
  processPayment: (appointment: Appointment, method: string, installments?: number) => Promise<{ success: boolean; error?: string }>;
  markInstallmentPaid: (transactionId: string) => Promise<{ success: boolean; error?: string }>;

  procedures: Procedure[];
  addProcedure: (proc: Omit<Procedure, 'id' | 'companyId'>) => Promise<{ success: boolean; error?: string; procedure?: Procedure }>;
  updateProcedure: (id: string, data: Partial<Procedure>) => Promise<{ success: boolean; error?: string }>;
  removeProcedure: (id: string) => Promise<{ success: boolean; error?: string }>;

  professionals: User[];
  addProfessional: (prof: Record<string, unknown>) => Promise<{ success: boolean; error?: string; user?: User; limitReached?: boolean }>;
  updateProfessional: (id: string, data: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  removeProfessional: (id: string) => Promise<{ success: boolean; error?: string }>;
  resetUserPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;

  photos: PhotoRecord[];
  addPhoto: (photo: Omit<PhotoRecord, 'id' | 'companyId'>) => Promise<{ success: boolean; error?: string; photo?: PhotoRecord }>;
  removePhoto: (id: string) => Promise<{ success: boolean; error?: string }>;

  saasPlans: SaasPlan[];
  addPlan: (plan: Omit<SaasPlan, 'id' | 'maxProfessionals' | 'maxPatients' | 'modules'> & { maxProfessionals?: number; maxPatients?: number; modules?: string[] }) => Promise<{ success: boolean; plan?: SaasPlan; error?: string }>;
  updatePlan: (id: string, data: Partial<SaasPlan>) => Promise<{ success: boolean; error?: string }>;
  removePlan: (id: string) => Promise<{ success: boolean; error?: string }>;
  loadPlans: (forceReload?: boolean) => Promise<void>;

  leads: Lead[];
  addLead: (lead: Omit<Lead, 'id'>) => Promise<{ success: boolean; error?: string; lead?: Lead }>;
  moveLead: (id: string, status: LeadStatus) => Promise<{ success: boolean; error?: string }>;

  tickets: Ticket[];
  createTicket: (subject: string, message: string) => Promise<{ success: boolean; error?: string; ticket?: Ticket }>;
  replyTicket: (ticketId: string, message: string) => Promise<{ success: boolean; error?: string }>;
  closeTicket: (ticketId: string) => Promise<{ success: boolean; error?: string }>;

  systemAlerts: SystemAlert[];
  addSystemAlert: (alert: Omit<SystemAlert, 'id' | 'createdAt' | 'status'>) => Promise<{ success: boolean; error?: string; alert?: SystemAlert }>;
  toggleSystemAlertStatus: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Gestão de alertas descartados
  dismissedAlertIds: string[];
  dismissAlert: (id: string) => void;

  notifications: AppNotification[];
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => Promise<{ success: boolean; error?: string; notification?: AppNotification }>;
  markNotificationAsRead: (id: string) => Promise<void>;

  unavailabilityRules: UnavailabilityRule[];
  addUnavailabilityRule: (rule: Omit<UnavailabilityRule, 'id' | 'companyId'>) => Promise<{ success: boolean; error?: string; rule?: UnavailabilityRule }>;
  removeUnavailabilityRule: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Inventory
  inventory: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'companyId'>) => Promise<{ success: boolean; error?: string; item?: InventoryItem }>;
  updateInventoryItem: (id: string, data: Partial<InventoryItem>) => Promise<{ success: boolean; error?: string }>;
  removeInventoryItem: (id: string) => Promise<{ success: boolean; error?: string }>;

  checkModuleAccess: (module: SystemModule) => boolean;
  isReadOnly: boolean;
  
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;
  triggerSave: boolean;
  setTriggerSave: (val: boolean) => void;
  pendingNavigationPath: string | null;
  setPendingNavigationPath: (path: string | null) => void;
  
  isSubscriptionModalOpen: boolean;
  setIsSubscriptionModalOpen: (val: boolean) => void;

  getPublicData: (companyId: string) => any;
  isLoading: boolean;

  // Lazy Loading - funções para carregar dados sob demanda
  loadPatients: (forceReload?: boolean) => Promise<void>;
  loadAppointments: (forceReload?: boolean) => Promise<void>;
  loadTransactions: (forceReload?: boolean) => Promise<void>;
  loadProcedures: (forceReload?: boolean) => Promise<void>;
  loadProfessionals: (forceReload?: boolean) => Promise<void>;
  loadInventory: (forceReload?: boolean) => Promise<void>;
  loadPhotos: (patientId?: string, forceReload?: boolean) => Promise<void>;
  loadLeads: (forceReload?: boolean) => Promise<void>;
  loadUnavailabilityRules: (forceReload?: boolean) => Promise<void>;
  pendingSubscriptionsCount: number;
  loadPendingSubscriptions: () => Promise<void>;
  newLeadsCount: number;
  changeAppointmentStatus: (id: string, status: string) => Promise<{ success: boolean; error?: string }>;

  // Estados de loading individuais
  loadingStates: {
    patients: boolean;
    appointments: boolean;
    transactions: boolean;
    procedures: boolean;
    professionals: boolean;
    inventory: boolean;
    plans: boolean;
    photos: boolean;
    leads: boolean;
  };

  // Estados de "já carregado" para evitar recarregar
  loadedStates: {
    patients: boolean;
    appointments: boolean;
    transactions: boolean;
    procedures: boolean;
    professionals: boolean;
    inventory: boolean;
    plans: boolean;
    photos: boolean;
    leads: boolean;
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Normaliza um profissional vindo da API pro formato usado no frontend:
// remunerationType/contractType em minúsculo PT-BR, commissionRate/fixedSalary
// como number (o Prisma usa Decimal, que serializa como string em JSON — sem
// essa conversão, somas tipo `soma + item.commissionRate` viram concatenação
// de string em vez de soma numérica, gerando totais absurdos como "151180%").
// Usar SEMPRE essa função ao inserir/atualizar um profissional no estado —
// nunca espalhar o objeto cru da API direto.
function normalizeProfessional<T extends Partial<ApiUser_Extended>>(u: T) {
  const remunerationMap: Record<string, string> = {
    'COMMISSION': 'comissao', 'FIXED': 'fixo', 'MIXED': 'misto',
    'commission': 'comissao', 'fixed': 'fixo', 'mixed': 'misto'
  };
  return {
    ...u,
    // Os valores do enum UserRole (OWNER/ADMIN/RECEPTIONIST/ESTHETICIAN/PATIENT)
    // já batem 1:1 com o que a API envia — só precisa do cast, sem transformação.
    role: (u.role || 'ESTHETICIAN') as UserRole,
    contractType: ((u.contractType as string | undefined)?.toLowerCase() || 'pj') as User['contractType'],
    remunerationType: (remunerationMap[u.remunerationType as string] || (u.remunerationType as string | undefined)?.toLowerCase() || 'comissao') as User['remunerationType'],
    commissionRate: Number(u.commissionRate) || 0,
    fixedSalary: Number(u.fixedSalary) || 0,
  };
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State Initialization - Inicializa vazio, dados vêm do Supabase
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [saasPlans, setSaasPlans] = useState<SaasPlan[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unavailabilityRules, setUnavailabilityRules] = useState<UnavailabilityRule[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [pendingSubscriptionsCount, setPendingSubscriptionsCount] = useState(0);

  // UI States
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [triggerSave, setTriggerSave] = useState(false);
  const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Loading inicial enquanto valida sessão

  // Computed
  const currentCompany = user ? companies.find(c => c.id === user.companyId) || null : null;
  
  const isReadOnly = React.useMemo(() => {
      if (!currentCompany) return false;
      if (user?.role === UserRole.OWNER) return false; 
      
      const isExpired = new Date(currentCompany.subscriptionExpiresAt) < new Date();
      const isBasic = currentCompany.plan === 'basic';
      
      return isExpired || (isBasic && isExpired); 
  }, [currentCompany, user]);

  const checkModuleAccess = (module: SystemModule): boolean => {
      if (!currentCompany) return false;
      if (user?.role === UserRole.OWNER) return true;

      // Se planos ainda não carregaram, permitir acesso temporariamente (evita race condition)
      if (saasPlans.length === 0) {
        return true; // Permitir enquanto carrega
      }

      // Busca o plano atual do array de planos carregados da API (case-insensitive)
      const companyPlanUpper = currentCompany.plan?.toUpperCase();
      const currentPlan = saasPlans.find(p => p.name?.toUpperCase() === companyPlanUpper);
      if (!currentPlan) {
        console.warn(`⚠️ Plano não encontrado: ${currentCompany.plan} (planos: ${saasPlans.map(p => p.name).join(', ')})`);
        return true; // Permitir se plano não encontrado (fallback seguro)
      }
      return currentPlan.modules.includes(module);
  };

  const checkWriteAccess = () => {
      if (isReadOnly) throw new Error("Ação não permitida. Plano expirado ou modo somente leitura.");
  };

  const checkPermission = (allowedRoles: UserRole[]) => {
      if (!user || !allowedRoles.includes(user.role)) {
          throw new Error("Permissão negada.");
      }
  };

  // SEMPRE usar API - não há mais modo mock
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Estados de loading individuais para lazy loading
  const [loadingStates, setLoadingStates] = useState({
    patients: false,
    appointments: false,
    transactions: false,
    procedures: false,
    professionals: false,
    inventory: false,
    plans: false,
    photos: false,
    leads: false,
  });

  // Estados de "já carregado" para evitar recarregar
  const [loadedStates, setLoadedStates] = useState({
    patients: false,
    appointments: false,
    transactions: false,
    procedures: false,
    professionals: false,
    inventory: false,
    plans: false,
    photos: false,
    leads: false,
  });

  // Helper para atualizar loading state
  const setLoading = (key: keyof typeof loadingStates, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const setLoaded = (key: keyof typeof loadedStates, value: boolean) => {
    setLoadedStates(prev => ({ ...prev, [key]: value }));
  };

  // ============================================
  // RESTAURAÇÃO DE SESSÃO NA INICIALIZAÇÃO
  // ============================================

  useEffect(() => {
    const restoreSession = async () => {
      // No localStorage — recover session from httpOnly cookie via /api/auth/me.
      // The backend reads the aura_session cookie (sent automatically with credentials: 'include')
      // and echoes the token back in the response body so the frontend can keep it in memory.
      try {
        // Validar sessão via cookie e obter dados do usuário
        const result = await authApi.me();

        if (result.success && result.data?.user) {
          const apiUser = result.data.user;

          // Recover token into memory so subsequent Bearer auth requests work
          if (result.data.token) {
            setAuthToken(result.data.token);
          }

          // Mapear role da API para o enum UserRole
          const roleMap: Record<string, UserRole> = {
            'ADMIN': UserRole.ADMIN,
            'OWNER': UserRole.OWNER,
            'RECEPTIONIST': UserRole.RECEPTIONIST,
            'ESTHETICIAN': UserRole.ESTHETICIAN,
            'PATIENT': UserRole.PATIENT,
          };
          const mappedRole = roleMap[apiUser.role?.toUpperCase()] || UserRole.ADMIN;

          const mappedUser: User = {
            id: apiUser.id,
            name: apiUser.name,
            email: apiUser.email,
            role: mappedRole,
            companyId: apiUser.company?.id || apiUser.companyId,
            avatar: apiUser.avatar,
            isActive: apiUser.isActive ?? true,
            patientId: apiUser.patientId,
          };

          // Se tiver dados da empresa, adiciona à lista de companies
          if (apiUser.company) {
            const mappedCompany: Company = {
              id: apiUser.company.id,
              name: apiUser.company.name,
              slug: apiUser.company.slug,
              plan: apiUser.company.plan?.toLowerCase() || 'free',
              subscriptionStatus: (apiUser.company.subscriptionStatus?.toLowerCase() || 'active') as SubscriptionStatus,
              subscriptionExpiresAt: apiUser.company.subscriptionExpiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              businessHours: (apiUser.company.businessHours || {}) as unknown as BusinessHours,
              onboardingCompleted: apiUser.company.onboardingCompleted ?? false,
            };
            setCompanies([mappedCompany]);
            console.log('🏢 Sessão restaurada - Empresa:', mappedCompany.name);
          }

          console.log('🔐 Sessão restaurada:', { email: apiUser.email, role: mappedRole });
          setUser(mappedUser);
        } else {
          // Cookie ausente ou expirado — nenhuma sessão ativa
          console.log('⚠️ Sem sessão ativa (cookie ausente ou expirado).');
        }
      } catch (error) {
        console.error('❌ Erro ao restaurar sessão:', error);
        // No-op: unauthenticated state is handled by the router guards
      } finally {
        setIsInitializing(false);
      }
    };

    restoreSession();
  }, []);

  // ============================================
  // FUNÇÕES DE LAZY LOADING INDIVIDUAIS
  // ============================================

  // Refs para controle de loading (evita loop infinito)
  const loadingRef = React.useRef({
    patients: false,
    appointments: false,
    transactions: false,
    procedures: false,
    professionals: false,
    inventory: false,
    plans: false,
    photos: false,
    leads: false,
    unavailabilityRules: false,
  });

  const loadedRef = React.useRef({
    patients: false,
    appointments: false,
    transactions: false,
    procedures: false,
    professionals: false,
    inventory: false,
    plans: false,
    photos: false,
    leads: false,
    unavailabilityRules: false,
  });

  const loadPatients = useCallback(async (forceReload?: boolean) => {
    if (!forceReload && (loadedRef.current.patients || loadingRef.current.patients)) return;
    if (forceReload) loadedRef.current.patients = false;
    loadingRef.current.patients = true;
    setLoading('patients', true);
    try {
      const res = await patientsApi.list({ limit: 100 });
      if (res.success && res.data?.patients) {
        const mapped = res.data.patients.map((p: ApiPatient) => ({
          ...p,
          status: (p.status?.toLowerCase() || 'active') as Patient['status']
        } as unknown as Patient));
        setPatients(mapped);
        loadedRef.current.patients = true;
        setLoaded('patients', true);
        console.log('✅ Pacientes carregados (lazy):', mapped.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar pacientes:', error);
    } finally {
      loadingRef.current.patients = false;
      setLoading('patients', false);
    }
  }, []);

  // Cache timestamps para evitar reloads desnecessários
  const cacheTimestamps = React.useRef<Record<string, number>>({});
  const CACHE_TTL_MS = 30000; // 30 segundos de cache no frontend

  const isCacheValid = (key: string) => {
    const timestamp = cacheTimestamps.current[key];
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_TTL_MS;
  };

  const loadAppointments = useCallback(async (forceReload = false) => {
    // Se não forçar e cache ainda válido, não recarregar
    if (!forceReload && isCacheValid('appointments')) return;
    if (!forceReload && (loadedRef.current.appointments || loadingRef.current.appointments)) return;
    if (forceReload) {
      loadedRef.current.appointments = false;
    }
    loadingRef.current.appointments = true;
    setLoading('appointments', true);
    try {
      const res = await appointmentsApi.list({ limit: 100 });
      if (res.success && res.data?.appointments) {
        type ApptWithRelations = ApiAppointment & {
          patient?: { id: string; name: string };
          professional?: { id: string; name: string };
          procedure?: { id: string; name: string };
          patientName?: string;
          professionalName?: string;
          service?: string;
        };
        const mapped = res.data.appointments.map((a: ApptWithRelations) => ({
          ...a,
          price: Number(a.price) || 0,
          durationMinutes: Number(a.durationMinutes) || 60,
          status: (a.status?.toLowerCase() || 'scheduled') as Appointment['status'],
          patientId: a.patientId || a.patient?.id,
          patientName: a.patient?.name || a.patientName,
          professionalId: a.professionalId || a.professional?.id,
          professionalName: a.professional?.name || a.professionalName,
          procedureId: a.procedureId || a.procedure?.id,
          service: a.procedure?.name || a.service
        }));
        setAppointments(mapped);
        loadedRef.current.appointments = true;
        setLoaded('appointments', true);
        cacheTimestamps.current.appointments = Date.now();
        console.log('✅ Agendamentos carregados (lazy):', mapped.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar agendamentos:', error);
    } finally {
      loadingRef.current.appointments = false;
      setLoading('appointments', false);
    }
  }, []);

  const loadTransactions = useCallback(async (forceReload = false) => {
    if (!forceReload && (loadedRef.current.transactions || loadingRef.current.transactions)) return;
    if (forceReload) {
      loadedRef.current.transactions = false;
    }
    loadingRef.current.transactions = true;
    setLoading('transactions', true);
    try {
      const res = await transactionsApi.list({ limit: 100 });
      if (res.success && res.data?.transactions) {
        const mapped = res.data.transactions.map((t: ApiTransaction) => ({
          ...t,
          amount: Number(t.amount) || 0,
          type: (t.type?.toLowerCase() || 'income') as Transaction['type'],
          status: (t.status?.toLowerCase() || 'paid') as Transaction['status']
        }));
        setTransactions(mapped);
        loadedRef.current.transactions = true;
        setLoaded('transactions', true);
        console.log('✅ Transações carregadas (lazy):', mapped.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar transações:', error);
    } finally {
      loadingRef.current.transactions = false;
      setLoading('transactions', false);
    }
  }, []);

  const loadProcedures = useCallback(async (forceReload?: boolean) => {
    if (!forceReload && (loadedRef.current.procedures || loadingRef.current.procedures)) return;
    if (forceReload) loadedRef.current.procedures = false;
    loadingRef.current.procedures = true;
    setLoading('procedures', true);
    try {
      const res = await proceduresApi.list({ limit: 100 });
      if (res.success && res.data?.procedures) {
        const mapped = res.data.procedures.map((p: ApiProcedure) => ({
          ...p,
          price: Number(p.price) || 0,
          cost: Number(p.cost) || 0,
          durationMinutes: Number(p.durationMinutes ?? p.duration) || 60,
          supplies: p.supplies?.map((s: ApiProcedureSupply) => ({
            id: s.id,
            inventoryItemId: s.inventoryItemId || s.inventoryItem?.id,
            name: s.inventoryItem?.name || s.name || 'Insumo',
            quantityUsed: Number(s.quantityUsed) || 1,
            cost: Number(s.inventoryItem?.costPerUnit || 0) * Number(s.quantityUsed || 1),
            unit: s.inventoryItem?.unit || 'un'
          })) || []
        }));
        setProcedures(mapped);
        loadedRef.current.procedures = true;
        setLoaded('procedures', true);
        console.log('✅ Procedimentos carregados (lazy):', mapped.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar procedimentos:', error);
    } finally {
      loadingRef.current.procedures = false;
      setLoading('procedures', false);
    }
  }, []);

  const loadProfessionals = useCallback(async () => {
    if (loadedRef.current.professionals || loadingRef.current.professionals) return;
    loadingRef.current.professionals = true;
    setLoading('professionals', true);
    try {
      const res = await usersApi.list({ limit: 100 });
      if (res.success && res.data?.users) {
        const mapped = res.data.users.map(normalizeProfessional);
        setProfessionals(mapped);
        loadedRef.current.professionals = true;
        setLoaded('professionals', true);
        console.log('✅ Profissionais carregados (lazy):', mapped.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar profissionais:', error);
    } finally {
      loadingRef.current.professionals = false;
      setLoading('professionals', false);
    }
  }, []);

  const loadInventory = useCallback(async (forceReload?: boolean) => {
    if (!forceReload && (loadedRef.current.inventory || loadingRef.current.inventory)) return;
    if (forceReload) loadedRef.current.inventory = false;
    loadingRef.current.inventory = true;
    setLoading('inventory', true);
    try {
      const res = await inventoryApi.list({ limit: 100 });
      if (res.success && res.data?.items) {
        setInventory(res.data.items);
        loadedRef.current.inventory = true;
        setLoaded('inventory', true);
        console.log('✅ Estoque carregado (lazy):', res.data.items.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar estoque:', error);
    } finally {
      loadingRef.current.inventory = false;
      setLoading('inventory', false);
    }
  }, []);

  const loadPhotos = useCallback(async (patientId?: string, forceReload = false) => {
    // Se não for forceReload e já carregou, não recarrega
    if (!forceReload && loadedRef.current.photos) return;
    if (loadingRef.current.photos) return;

    if (forceReload) {
      loadedRef.current.photos = false;
    }
    loadingRef.current.photos = true;
    setLoading('photos', true);
    try {
      // Sempre carrega todas as fotos da empresa (similar a outros recursos)
      // O filtro por patientId é feito no frontend
      const res = await photosApi.list({ limit: 500 });
      if (res.success && res.data?.photos) {
        const mapped = res.data.photos.map((p: ApiPhoto) => ({
          id: p.id,
          companyId: p.companyId,
          patientId: p.patientId,
          url: p.url,
          type: p.type?.toLowerCase() as 'before' | 'after',
          procedure: p.procedure,
          date: p.date,
          groupId: p.groupId,
        }));
        setPhotos(mapped);
        loadedRef.current.photos = true;
        setLoaded('photos', true);
        console.log('✅ Fotos carregadas (lazy):', mapped.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar fotos:', error);
    } finally {
      loadingRef.current.photos = false;
      setLoading('photos', false);
    }
  }, []);

  const loadPlans = useCallback(async (forceReload = false) => {
    if (!forceReload && (loadedRef.current.plans || loadingRef.current.plans)) return;
    if (forceReload) {
      loadedRef.current.plans = false;
    }
    loadingRef.current.plans = true;
    setLoading('plans', true);
    try {
      const res = await plansApi.list();
      if (res.success && res.data) {
        const mappedPlans = res.data.map((p: ApiSaasPlan & { displayName?: string }) => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName || p.name,
          price: Number(p.price) || 0,
          maxProfessionals: p.maxProfessionals ?? 1,
          maxPatients: p.maxPatients ?? 50,
          modules: p.modules || [], // IMPORTANTE: necessário para checkModuleAccess
          features: p.features || [],
          active: p.active ?? true,
          stripePaymentLink: p.stripePaymentLink || '',
        }));
        // Só atualiza se houver planos no banco, senão mantém os padrão
        if (mappedPlans.length > 0) {
          setSaasPlans(mappedPlans);
          console.log('✅ Planos carregados (lazy):', mappedPlans.length);
        } else {
          console.log('ℹ️ Nenhum plano no banco, mantendo planos padrão');
        }
        loadedRef.current.plans = true;
        setLoaded('plans', true);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar planos:', error);
    } finally {
      loadingRef.current.plans = false;
      setLoading('plans', false);
    }
  }, []);

  const loadLeads = useCallback(async (forceReload = false) => {
    if (!forceReload && (loadedRef.current.leads || loadingRef.current.leads)) return;
    if (forceReload) {
      loadedRef.current.leads = false;
    }
    loadingRef.current.leads = true;
    setLoading('leads', true);
    try {
      // OWNER usa API de vendas (empresas FREE/TRIAL), outros usam leads da clínica
      const isOwner = user?.role === UserRole.OWNER;
      const res = isOwner
        ? await kingApi.leads()
        : await leadsApi.list({ limit: 200 });
      if (res.success && res.data?.leads) {
        const mapped = res.data.leads.map((l: ApiLead | ApiKingLead) => ({
          ...l,
          status: (l.status as string | undefined)?.toLowerCase() || 'new',
          value: Number((l as ApiLead).value) || 0,
          clinicName: (l as ApiLead).clinicName || l.name || '',
          contactName: (l as ApiLead).contactName || l.name || '',
          createdAt: l.createdAt || new Date().toISOString(),
        } as unknown as Lead));
        setLeads(mapped);
        loadedRef.current.leads = true;
        setLoaded('leads', true);
        console.log(`✅ Leads carregados (lazy, ${isOwner ? 'OWNER' : 'clinic'}):`, mapped.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar leads:', error);
    } finally {
      loadingRef.current.leads = false;
      setLoading('leads', false);
    }
  }, [user?.role]);

  // ============================================
  // CARREGAMENTO INICIAL (apenas dados essenciais)
  // ============================================

  const loadDataFromApi = useCallback(async () => {
    if (!user) return;

    setApiLoading(true);
    console.log('📡 Carregando dados essenciais...');

    try {
      // Carregar dados essenciais no login (empresa, profissionais E planos para checkModuleAccess)
      const [companiesRes, usersRes, plansRes] = await Promise.all([
        companiesApi.list({ limit: 100 }),
        usersApi.list({ limit: 100 }),
        plansApi.list() // CRÍTICO: Necessário para checkModuleAccess funcionar
      ]);

      if (companiesRes.success && companiesRes.data?.companies) {
        const mappedCompanies = companiesRes.data.companies.map((c: ApiCompany) => ({
          ...c,
          plan: c.plan?.toLowerCase() || 'basic',
          subscriptionStatus: (c.subscriptionStatus?.toLowerCase() || 'active') as SubscriptionStatus,
          targetAudience: {
            female: c.targetFemale ?? true,
            male: c.targetMale ?? true,
            kids: c.targetKids ?? false
          },
          socialMedia: {
            instagram: c.instagram || '',
            facebook: c.facebook || '',
            website: c.website || ''
          }
        } as unknown as Company));
        setCompanies(mappedCompanies);
        console.log('✅ Empresas carregadas:', mappedCompanies.length);
      }

      if (usersRes.success && usersRes.data?.users) {
        const mapped = usersRes.data.users.map(normalizeProfessional);
        setProfessionals(mapped);
        setLoaded('professionals', true);
        console.log('✅ Profissionais carregados:', mapped.length);
      }

      // CRÍTICO: Carregar planos para checkModuleAccess funcionar corretamente
      if (plansRes.success && plansRes.data) {
        const mappedPlans = plansRes.data.map((p: ApiSaasPlan & { displayName?: string }) => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName || p.name,
          price: Number(p.price) || 0,
          maxProfessionals: p.maxProfessionals ?? 1,
          maxPatients: p.maxPatients ?? 50,
          modules: p.modules || [],
          features: p.features || [],
          active: p.active ?? true,
          stripePaymentLink: p.stripePaymentLink || '',
        }));
        if (mappedPlans.length > 0) {
          setSaasPlans(mappedPlans);
          loadedRef.current.plans = true;
          setLoaded('plans', true);
          console.log('✅ Planos carregados:', mappedPlans.length);
        }
      }

      console.log('🎉 Dados essenciais carregados! Outros dados serão carregados sob demanda.');
      setApiError(null);
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      setApiError('Erro ao carregar dados. Verifique a conexão.');
    } finally {
      setApiLoading(false);
    }
  }, [user]);

  // Carregar dados da API quando usuário loga
  useEffect(() => {
    // Use in-memory token (no localStorage) — token is set during login or session restore
    if (user && getAuthToken()) {
      loadDataFromApi();
    }
  }, [user, loadDataFromApi]);

  // --- ACTIONS ---

  const login = async (email: string, password: string): Promise<boolean> => {
      try {
        const result = await authApi.login(email, password);
        if (result.success && result.data?.user) {
          const apiUser = result.data.user;

          // Mapear role da API para o enum UserRole
          const roleMap: Record<string, UserRole> = {
            'ADMIN': UserRole.ADMIN,
            'OWNER': UserRole.OWNER,
            'RECEPTIONIST': UserRole.RECEPTIONIST,
            'ESTHETICIAN': UserRole.ESTHETICIAN,
            'PATIENT': UserRole.PATIENT,
          };
          const mappedRole = roleMap[apiUser.role?.toUpperCase()] || UserRole.ADMIN;

          const mappedUser: User = {
            id: apiUser.id,
            name: apiUser.name,
            email: apiUser.email,
            role: mappedRole,
            companyId: apiUser.company?.id || apiUser.companyId,
            avatar: apiUser.avatar,
            isActive: apiUser.isActive ?? true,
            patientId: apiUser.patientId, // Para pacientes, inclui o ID do registro Patient
          };

          // Se tiver dados da empresa, adiciona à lista de companies
          if (apiUser.company) {
            const mappedCompany: Company = {
              id: apiUser.company.id,
              name: apiUser.company.name,
              slug: apiUser.company.slug,
              plan: apiUser.company.plan?.toLowerCase() || 'free',
              subscriptionStatus: (apiUser.company.subscriptionStatus?.toLowerCase() || 'active') as SubscriptionStatus,
              subscriptionExpiresAt: apiUser.company.subscriptionExpiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              businessHours: (apiUser.company.businessHours || {}) as unknown as BusinessHours,
              onboardingCompleted: apiUser.company.onboardingCompleted ?? false,
            };
            setCompanies(prev => {
              const exists = prev.find(c => c.id === mappedCompany.id);
              if (exists) {
                return prev.map(c => c.id === mappedCompany.id ? mappedCompany : c);
              }
              return [...prev, mappedCompany];
            });
            console.log('🏢 Empresa carregada:', mappedCompany.name, '| Plano:', mappedCompany.plan);
          }

          console.log('🔐 Login bem sucedido:', { email: apiUser.email, role: mappedRole });
          setUser(mappedUser);
          return true;
        }
        return false;
      } catch (error) {
        console.error('❌ Erro no login:', error);
        return false;
      }
  };

  const loginWithToken = async (token: string): Promise<boolean> => {
    try {
      // Store token in memory so fetchApi can send it as Bearer on the /me call
      setAuthToken(token);
      const result = await authApi.me();
      if (result.success && result.data?.user) {
        const apiUser = result.data.user;

        // Mapear role da API para o enum UserRole
        const roleMap: Record<string, UserRole> = {
          'ADMIN': UserRole.ADMIN,
          'OWNER': UserRole.OWNER,
          'RECEPTIONIST': UserRole.RECEPTIONIST,
          'ESTHETICIAN': UserRole.ESTHETICIAN,
          'PATIENT': UserRole.PATIENT,
        };
        const mappedRole = roleMap[apiUser.role?.toUpperCase()] || UserRole.ADMIN;

        const mappedUser: User = {
          id: apiUser.id,
          name: apiUser.name,
          email: apiUser.email,
          role: mappedRole,
          companyId: apiUser.company?.id || apiUser.companyId,
          avatar: apiUser.avatar,
          isActive: apiUser.isActive ?? true,
          patientId: apiUser.patientId,
        };

        // Se tiver dados da empresa, adiciona à lista de companies
        if (apiUser.company) {
          const mappedCompany: Company = {
            id: apiUser.company.id,
            name: apiUser.company.name,
            slug: apiUser.company.slug,
            plan: apiUser.company.plan?.toLowerCase() || 'free',
            subscriptionStatus: (apiUser.company.subscriptionStatus?.toLowerCase() || 'active') as SubscriptionStatus,
            subscriptionExpiresAt: apiUser.company.subscriptionExpiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            businessHours: (apiUser.company.businessHours || {}) as unknown as BusinessHours,
            onboardingCompleted: apiUser.company.onboardingCompleted ?? false,
          };
          setCompanies(prev => {
            const exists = prev.find(c => c.id === mappedCompany.id);
            if (exists) {
              return prev.map(c => c.id === mappedCompany.id ? mappedCompany : c);
            }
            return [...prev, mappedCompany];
          });
          console.log('🏢 Empresa carregada (token):', mappedCompany.name, '| Plano:', mappedCompany.plan);
        }

        console.log('🔐 Login com token bem sucedido:', { email: apiUser.email, role: mappedRole });
        setUser(mappedUser);
        // loadDataFromApi será chamado automaticamente pelo useEffect que observa user
        return true;
      }
      // Token invalid — clear from memory
      setAuthToken(null);
      return false;
    } catch {
      // Error — clear from memory
      setAuthToken(null);
      return false;
    }
  };

  const logout = async () => {
      try {
        await authApi.logout();
      } catch (error) {
        console.error('Erro no logout via API:', error);
      }
      // Reset dos refs de lazy loading
      loadedRef.current = { patients: false, appointments: false, transactions: false, procedures: false, professionals: false, inventory: false, plans: false, photos: false, leads: false, unavailabilityRules: false };
      loadingRef.current = { patients: false, appointments: false, transactions: false, procedures: false, professionals: false, inventory: false, plans: false, photos: false, leads: false, unavailabilityRules: false };
      setLoadedStates({ patients: false, appointments: false, transactions: false, procedures: false, professionals: false, inventory: false, plans: false, photos: false, leads: false });
      // Limpar dados
      setPatients([]);
      setAppointments([]);
      setTransactions([]);
      setProcedures([]);
      setProfessionals([]);
      setInventory([]);
      setPhotos([]);
      setCompanies([]);
      setSaasPlans([]); // Reset - planos serão carregados da API
      setUser(null);
      setDismissedAlertIds([]);
  };

  const registerCompany = async (companyName: string, adminData: { name: string; email: string; password: string; phone?: string; acceptedTerms?: boolean; state?: string; marketingConsent?: boolean }): Promise<{ success: boolean; error?: string }> => {
      try {
        // Chamar API de registro para salvar no banco de dados
        const response = await authApi.register({
          name: adminData.name,
          email: adminData.email,
          password: adminData.password,
          companyName: companyName,
          acceptedTerms: adminData.acceptedTerms ?? false,
          state: adminData.state,
          marketingConsent: adminData.marketingConsent,
        });

        if (!response.success) {
          console.error('❌ Erro no registro:', response.error);
          return { success: false, error: response.error || 'Erro ao criar conta' };
        }

        console.log('✅ Empresa e usuário criados com sucesso!');

        // Criar lead para o owner acompanhar
        const newLead: Lead = {
          id: `l_${Date.now()}`,
          clinicName: companyName,
          contactName: adminData.name,
          email: adminData.email,
          phone: adminData.phone,
          status: 'new',
          value: 0,
          createdAt: new Date().toISOString()
        };
        setLeads(prev => [...prev, newLead]);

        return { success: true };
      } catch (error) {
        console.error('❌ Erro de conexão no registro:', error);
        return { success: false, error: 'Erro de conexão. Tente novamente.' };
      }
  };

  const setupGoogleCompany = async (companyName: string, state?: string, phone?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await authApi.googleSetupCompany({ companyName, state, phone });
      if (!result.success) {
        return { success: false, error: result.error || 'Erro ao criar empresa' };
      }
      // Refresh session so user.companyId and companies state are updated.
      // Use in-memory token — no localStorage read needed.
      const token = getAuthToken();
      if (token) {
        await loginWithToken(token);
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Erro de conexão. Tente novamente.' };
    }
  };

  const updateCompany = async (companyId: string, data: Partial<Company>) => {
      if (user?.role !== UserRole.OWNER) checkWriteAccess();

      // Regressão: antes atualizava o estado local ANTES de confirmar com a
      // API (otimista) e não desfazia em caso de falha — a tela mostrava
      // "salvo" mesmo quando a chamada retornava erro. Persiste primeiro e só
      // então atualiza o estado com o valor confirmado pelo servidor.
      try {
        const response = await companiesApi.update(companyId, data);
        if (response.success && response.data?.company) {
          // Atualiza com dados confirmados do servidor
          const updatedCompany = {
            ...response.data.company,
            plan: response.data.company.plan?.toLowerCase() || 'basic',
            subscriptionStatus: (response.data.company.subscriptionStatus?.toLowerCase() || 'active') as SubscriptionStatus,
            targetAudience: {
              female: response.data.company.targetFemale ?? true,
              male: response.data.company.targetMale ?? true,
              kids: response.data.company.targetKids ?? false
            },
            socialMedia: {
              instagram: response.data.company.instagram || '',
              facebook: response.data.company.facebook || '',
              website: response.data.company.website || ''
            }
          } as unknown as Company;
          setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, ...updatedCompany } : c));
          console.log('✅ Empresa atualizada no banco:', companyId);
          return { success: true, company: updatedCompany };
        }
        console.error('❌ Erro ao atualizar empresa na API:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao atualizar empresa:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const completeOnboarding = () => {
      if (currentCompany) {
          updateCompany(currentCompany.id, { onboardingCompleted: true });
      }
  };

  // --- Patient Actions (SEMPRE via API) ---
  const addPatient = async (patientData: Record<string, unknown>) => {
      checkWriteAccess();

      // Verificar limite de pacientes do plano (busca do estado saasPlans)
      if (currentCompany && user?.role !== UserRole.OWNER) {
        const companyPlanUpper = currentCompany.plan?.toUpperCase();
        const currentPlan = saasPlans.find(p => p.name?.toUpperCase() === companyPlanUpper);
        const maxPatients = currentPlan?.maxPatients ?? 50; // Default 50 se não encontrar
        const currentPatientCount = patients.filter(p => p.companyId === currentCompany.id).length;

        if (maxPatients !== -1 && currentPatientCount >= maxPatients) {
          console.warn(`⚠️ Limite de pacientes atingido: ${currentPatientCount}/${maxPatients}`);
          return {
            success: false,
            error: `Limite de pacientes atingido (${maxPatients}). Faça upgrade do seu plano para cadastrar mais pacientes.`,
            limitReached: true
          };
        }
      }

      try {
        const result = await patientsApi.create(patientData);
        if (result.success && result.data?.patient) {
          const newPatient = { ...result.data.patient, status: (result.data.patient.status?.toLowerCase() || 'active') as Patient['status'] } as unknown as Patient;
          setPatients(prev => [...prev, newPatient]);
          return { success: true, patient: newPatient };
        }
        console.error('❌ Erro ao criar paciente:', result.error);
        return { success: false, error: result.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar paciente:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const updatePatient = async (id: string, data: Partial<Patient>) => {
      checkWriteAccess();
      try {
        const result = await patientsApi.update(id, data);
        if (result.success && result.data?.patient) {
          setPatients(prev => prev.map(p => p.id === id ? ({ ...p, ...result.data!.patient } as unknown as Patient) : p));
          return { success: true };
        }
        console.error('❌ Erro ao atualizar paciente:', result.error);
        return { success: false, error: result.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao atualizar paciente:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const removePatient = async (id: string) => {
      checkWriteAccess();
      try {
        const result = await patientsApi.delete(id);
        if (result.success) {
          setPatients(prev => prev.filter(p => p.id !== id));
          return { success: true };
        }
        console.error('❌ Erro ao remover paciente:', result.error);
        return { success: false, error: result.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao remover paciente:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  // NOTA: existiu aqui uma `toggleConsent` que chamava o PUT genérico de paciente
  // com `consentSignedAt` — campo que o schema de update não aceita (mesma causa
  // raiz do bug de assinatura corrigido nesta sessão), então nunca persistia.
  // Função não tinha nenhum uso ativo na UI; removida em vez de meio-corrigida.
  // Salva a assinatura de consentimento do paciente via endpoint dedicado
  // (o PUT genérico de paciente não aceita esses campos — usar sempre /consent).
  const signConsent = async (id: string, signatureBase64: string) => {
      checkWriteAccess();
      try {
        const result = await patientsApi.signConsent(id, signatureBase64);
        if (result.success && result.data) {
          setPatients(prev => prev.map(p => p.id === id ? {
            ...p,
            consentSignedAt: result.data!.consentSignedAt,
            consentSignatureUrl: signatureBase64,
          } as Patient : p));
          return { success: true };
        }
        console.error('❌ Erro ao assinar consentimento:', result.error);
        return { success: false, error: result.error || 'Erro ao salvar assinatura' };
      } catch (error) {
        console.error('❌ Erro de conexão ao assinar consentimento:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const toggleAnamnesisSent = (id: string) => {
      checkWriteAccess();
      updatePatient(id, { anamnesisLinkSent: true });
  };

  // --- Appointment Actions (SEMPRE via API) ---
  const addAppointment = async (appt: { procedureId?: string; service?: string; professionalId?: string; date?: string; patientName?: string; companyId?: string; [key: string]: unknown }, isPublic = false, publicCompanyId?: string, patientInfo?: { name?: string; email: string; phone: string; password?: string }) => {
      if (!isPublic) checkWriteAccess();

      const companyId = isPublic ? publicCompanyId : user?.companyId;
      if (!companyId) return { success: false, error: 'Company ID missing' };

      try {
        let response: { success: boolean; error?: string; data?: { appointment: ApiAppointment; patient?: ApiPatient } };

        if (isPublic && patientInfo) {
          // Usar endpoint público para booking
          response = await appointmentsApi.createPublic({
            companyId,
            procedureId: appt.procedureId || appt.service, // fallback
            professionalId: appt.professionalId,
            date: appt.date,
            patientInfo: {
              name: patientInfo.name || appt.patientName,
              email: patientInfo.email,
              phone: patientInfo.phone,
              password: patientInfo.password,
            },
          });
        } else {
          // Usar endpoint autenticado
          const apiData = {
            ...appt,
            companyId,
          };
          response = await appointmentsApi.create(apiData);
        }

        if (response.success && response.data?.appointment) {
          const newAppt = response.data.appointment;
          // Mapear os campos corretamente (igual ao loadAppointments)
          const mappedAppt = {
            ...newAppt,
            price: Number(newAppt.price) || 0,
            durationMinutes: Number(newAppt.durationMinutes) || 60,
            status: (newAppt.status?.toLowerCase() || 'scheduled') as Appointment['status'],
            patientId: newAppt.patientId || newAppt.patient?.id,
            patientName: newAppt.patient?.name || newAppt.patientName,
            professionalId: newAppt.professionalId || newAppt.professional?.id,
            professionalName: newAppt.professional?.name || newAppt.professionalName,
            procedureId: newAppt.procedureId || newAppt.procedure?.id,
            service: newAppt.procedure?.name || newAppt.service
          } as unknown as Appointment;
          setAppointments(prev => [...prev, mappedAppt]);

          // Se criou novo paciente, adicionar ao estado local
          if (response.data.patient) {
            setPatients(prev => [...prev, response.data!.patient as unknown as Patient]);
          }

          console.log('✅ Agendamento criado:', mappedAppt.id);
          return { success: true, appointment: mappedAppt };
        }

        // Verificar se é conflito
        if (response.error?.includes('conflito') || response.error?.includes('conflict') || response.error?.includes('CONFLICT')) {
          return { success: false, conflict: true, error: 'Horário não disponível' };
        }

        console.error('❌ Erro ao criar agendamento:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar agendamento:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const updateAppointment = (id: string, data: Partial<Appointment>) => {
      checkWriteAccess();
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  };

  // NOTA: existiu aqui uma `updateAppointmentStatus` que só mexia no estado local
  // (setAppointments/setInventory), sem nenhuma chamada de API — mudanças de status
  // feitas por ela (aprovar/cancelar agendamento) nunca eram persistidas no banco e
  // se perdiam ao recarregar a página. Removida; usar sempre `changeAppointmentStatus`
  // abaixo, que chama a rota real (com dedução de estoque feita no servidor).
  const changeAppointmentStatus = useCallback(async (id: string, status: string): Promise<{ success: boolean; error?: string }> => {
    const res = await appointmentsApi.updateStatus(id, status);
    await loadAppointments(true);
    return { success: !!res.success, error: res.error };
  }, [loadAppointments]);

  // Salva a assinatura de consentimento do agendamento via endpoint dedicado
  // (o update genérico de agendamento não aceita esses campos — usar sempre /consent).
  // `correctionReason` é obrigatório (validado no backend) quando já existe uma
  // assinatura anterior — nunca sobrescreve sem motivo, a versão antiga fica
  // preservada em AppointmentSignatureHistory.
  const signAppointmentConsent = async (id: string, signatureBase64: string, correctionReason?: string) => {
    checkWriteAccess();
    try {
      const result = await appointmentsApi.signConsent(id, signatureBase64, undefined, correctionReason);
      if (result.success && result.data) {
        setAppointments(prev => prev.map(a => a.id === id ? {
          ...a,
          signatureUrl: result.data!.signatureUrl,
          signatureMetadata: result.data!.signatureMetadata as unknown as SignatureMetadata,
          signatureCorrectionCount: result.data!.signatureCorrectionCount,
          lastSignatureCorrectionAt: result.data!.lastSignatureCorrectionAt ?? undefined,
          lastSignatureCorrectionReason: result.data!.lastSignatureCorrectionReason ?? undefined,
        } : a));
        return { success: true };
      }
      console.error('❌ Erro ao assinar consentimento do agendamento:', result.error);
      return { success: false, error: result.error || 'Erro ao salvar assinatura' };
    } catch (error) {
      console.error('❌ Erro de conexão ao assinar consentimento do agendamento:', error);
      return { success: false, error: 'Erro de conexão' };
    }
  };

  // Busca a trilha completa de assinaturas de um agendamento (todas as versões,
  // com imagem e motivo de cada correção) — sob demanda, não vem na listagem.
  const getAppointmentSignatureHistory = async (id: string): Promise<{ success: boolean; history?: SignatureHistoryEntry[]; error?: string }> => {
    try {
      const result = await appointmentsApi.getSignatureHistory(id);
      if (result.success && result.data) {
        return { success: true, history: result.data.history };
      }
      return { success: false, error: result.error || 'Erro ao buscar histórico de assinaturas' };
    } catch (error) {
      console.error('❌ Erro de conexão ao buscar histórico de assinaturas:', error);
      return { success: false, error: 'Erro de conexão' };
    }
  };

  // --- Transactions (SEMPRE via API) ---
  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'companyId'>) => {
      checkWriteAccess();
      try {
        const response = await transactionsApi.create(transaction);
        if (response.success && response.data?.transaction) {
          const newTrans = {
            ...response.data.transaction,
            amount: Number(response.data.transaction.amount),
            type: response.data.transaction.type?.toLowerCase() as Transaction['type'],
            status: response.data.transaction.status?.toLowerCase() as Transaction['status'],
          };
          setTransactions(prev => [...prev, newTrans]);
          console.log('✅ Transação criada:', newTrans.id);
          return { success: true, transaction: newTrans };
        }
        console.error('❌ Erro ao criar transação:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar transação:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    checkWriteAccess();
    try {
      const response = await transactionsApi.update(id, data as Record<string, unknown>);
      if (response.success && response.data?.transaction) {
        const updated = {
          ...response.data.transaction,
          amount: Number(response.data.transaction.amount),
          type: response.data.transaction.type?.toLowerCase() as Transaction['type'],
          status: response.data.transaction.status?.toLowerCase() as Transaction['status'],
        };
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch {
      return { success: false, error: 'Erro de conexão' };
    }
  };

  const deleteTransaction = async (id: string) => {
    checkWriteAccess();
    try {
      const response = await transactionsApi.delete(id);
      if (response.success) {
        setTransactions(prev => prev.filter(t => t.id !== id));
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch {
      return { success: false, error: 'Erro de conexão' };
    }
  };

  const processPayment = async (appointment: Appointment, method: string, installments = 1) => {
      checkWriteAccess();

      try {
        const response = await appointmentsApi.processPayment(appointment.id, method, installments);
        if (response.success) {
          // Atualizar estado local com dados da API
          updateAppointment(appointment.id, { paid: true, status: 'completed' });

          // Trata parcelas (array) ou transação única
          const installmentTxs = response.data?.transactions?.installments;
          if (installmentTxs && Array.isArray(installmentTxs) && installmentTxs.length > 0) {
            const newTxs = installmentTxs.map((tx: {
              id: string;
              companyId: string;
              date: string;
              description: string;
              amount: number | string;
              category: string;
              status: string;
              appointmentId?: string;
              installments?: number;
              installmentIndex?: number;
              installmentGroupId?: string;
              dueDate?: string;
            }) => ({
              id: tx.id,
              companyId: tx.companyId,
              date: tx.date,
              description: tx.description,
              amount: Number(tx.amount),
              type: 'income' as const,
              category: tx.category,
              status: (tx.status === 'PAID' ? 'paid' : 'pending') as 'paid' | 'pending',
              appointmentId: tx.appointmentId,
              installments: tx.installments,
              installmentIndex: tx.installmentIndex,
              installmentGroupId: tx.installmentGroupId,
              dueDate: tx.dueDate,
            }));
            setTransactions(prev => [...prev, ...newTxs]);
          } else if (response.data?.transactions?.income) {
            const income = response.data.transactions.income;
            setTransactions(prev => [...prev, {
              id: income.id,
              companyId: income.companyId,
              date: income.date,
              description: income.description,
              amount: Number(income.amount),
              type: 'income' as const,
              category: income.category,
              status: 'paid' as const,
              appointmentId: income.appointmentId
            }]);
          }

          if (response.data?.transactions?.expense) {
            const expense = response.data.transactions.expense;
            setTransactions(prev => [...prev, {
              id: expense.id,
              companyId: expense.companyId,
              date: expense.date,
              description: expense.description,
              amount: Number(expense.amount),
              type: 'expense',
              category: expense.category,
              status: 'paid',
              appointmentId: expense.appointmentId
            }]);
          }

          // Atualizar estoque local (já foi atualizado na API)
          const responseData = response.data as { inventory?: { id: string; currentStock: number }[] } & typeof response.data;
          if (responseData?.inventory) {
            responseData.inventory.forEach((item: { id: string; currentStock: number }) => {
              setInventory(prev => prev.map(i => i.id === item.id ? { ...i, currentStock: Number(item.currentStock) } : i));
            });
          }

          console.log('✅ Pagamento processado:', response.data?.summary);
          return { success: true };
        }
        console.error('❌ Erro ao processar pagamento:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao processar pagamento:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const markInstallmentPaid = async (transactionId: string): Promise<{ success: boolean; error?: string }> => {
    checkWriteAccess();
    try {
      const response = await installmentsApi.markInstallmentPaid(transactionId);
      if (response.success) {
        setTransactions(prev =>
          prev.map(t => t.id === transactionId ? { ...t, status: 'paid' as const } : t)
        );
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      console.error('Erro ao marcar parcela como paga:', error);
      return { success: false, error: 'Erro de conexão' };
    }
  };

  // --- Procedures (SEMPRE via API) ---
  const addProcedure = async (proc: Omit<Procedure, 'id' | 'companyId'>) => {
      checkWriteAccess();

      const apiData = {
        name: proc.name,
        description: proc.description,
        imageUrl: proc.imageUrl,
        price: proc.price,
        cost: proc.cost,
        durationMinutes: proc.durationMinutes,
        maintenanceRequired: proc.maintenanceRequired,
        maintenanceIntervalDays: proc.maintenanceIntervalDays,
        supplies: proc.supplies?.filter(s => s.inventoryItemId).map(s => ({
          inventoryItemId: s.inventoryItemId,
          quantityUsed: s.quantityUsed
        })) || []
      };

      try {
        const response = await proceduresApi.create(apiData);
        if (response.success && response.data?.procedure) {
          const newProc = {
            ...response.data.procedure,
            price: Number(response.data.procedure.price) || 0,
            cost: Number(response.data.procedure.cost) || 0,
            durationMinutes: Number(response.data.procedure.durationMinutes ?? response.data.procedure.duration) || 60,
            supplies: response.data.procedure.supplies?.map((s: ApiProcedureSupply) => ({
              id: s.id,
              inventoryItemId: s.inventoryItemId,
              name: s.inventoryItem?.name || 'Insumo',
              quantityUsed: Number(s.quantityUsed) || 1,
              cost: Number(s.inventoryItem?.costPerUnit || 0) * Number(s.quantityUsed || 1)
            })) || []
          };
          setProcedures(prev => [...prev, newProc]);
          console.log('✅ Procedimento criado:', newProc.name);
          return { success: true, procedure: newProc };
        }
        console.error('❌ Erro ao criar procedimento:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar procedimento:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const updateProcedure = async (id: string, data: Partial<Procedure>) => {
      checkWriteAccess();

      const apiData = {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        price: data.price,
        cost: data.cost,
        durationMinutes: data.durationMinutes,
        maintenanceRequired: data.maintenanceRequired,
        maintenanceIntervalDays: data.maintenanceIntervalDays,
        supplies: data.supplies?.filter(s => s.inventoryItemId).map(s => ({
          inventoryItemId: s.inventoryItemId,
          quantityUsed: s.quantityUsed
        })) || []
      };

      try {
        const response = await proceduresApi.update(id, apiData);
        if (response.success && response.data?.procedure) {
          const updated = {
            ...response.data.procedure,
            price: Number(response.data.procedure.price) || 0,
            cost: Number(response.data.procedure.cost) || 0,
            durationMinutes: Number(response.data.procedure.durationMinutes ?? response.data.procedure.duration) || 60,
            supplies: response.data.procedure.supplies?.map((s: ApiProcedureSupply) => ({
              id: s.id,
              inventoryItemId: s.inventoryItemId,
              name: s.inventoryItem?.name || 'Insumo',
              quantityUsed: Number(s.quantityUsed) || 1,
              cost: Number(s.inventoryItem?.costPerUnit || 0) * Number(s.quantityUsed || 1)
            })) || []
          };
          setProcedures(prev => prev.map(p => p.id === id ? updated : p));
          console.log('✅ Procedimento atualizado:', updated.name);
          return { success: true };
        }
        console.error('❌ Erro ao atualizar procedimento:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao atualizar procedimento:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const removeProcedure = async (id: string) => {
      checkWriteAccess();
      try {
        const response = await proceduresApi.delete(id);
        if (response.success) {
          setProcedures(prev => prev.filter(p => p.id !== id));
          console.log('✅ Procedimento removido');
          return { success: true };
        }
        console.error('❌ Erro ao remover procedimento:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao remover procedimento:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  // --- Professionals (SEMPRE via API) ---
  const addProfessional = async (prof: Record<string, unknown>) => {
      checkWriteAccess();

      // Verificar limite de profissionais do plano (busca do estado saasPlans)
      if (currentCompany && user?.role !== UserRole.OWNER) {
        const companyPlanUpper = currentCompany.plan?.toUpperCase();
        const currentPlan = saasPlans.find(p => p.name?.toUpperCase() === companyPlanUpper);
        const maxProfessionals = currentPlan?.maxProfessionals ?? 1; // Default 1 se não encontrar
        const currentProfCount = professionals.filter(p => p.companyId === currentCompany.id).length;

        if (maxProfessionals !== -1 && currentProfCount >= maxProfessionals) {
          console.warn(`⚠️ Limite de profissionais atingido: ${currentProfCount}/${maxProfessionals}`);
          return {
            success: false,
            error: `Limite de profissionais atingido (${maxProfessionals}). Faça upgrade do seu plano para cadastrar mais profissionais.`,
            limitReached: true
          };
        }
      }

      try {
        const response = await usersApi.create(prof);
        if (response.success && response.data?.user) {
          const newProf = normalizeProfessional(response.data.user);
          setProfessionals(prev => [...prev, newProf]);
          console.log('✅ Profissional criado:', newProf.name);
          return { success: true, user: newProf };
        }
        console.error('❌ Erro ao criar profissional:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar profissional:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const updateProfessional = async (id: string, data: Partial<User>) => {
      checkWriteAccess();
      try {
        const response = await usersApi.update(id, data);
        if (response.success && response.data?.user) {
          const updated = normalizeProfessional(response.data.user);
          setProfessionals(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
          return { success: true };
        }
        console.error('❌ Erro ao atualizar profissional:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao atualizar profissional:', error);
        return { success: false, error: 'Erro de sistema. Tente novamente.' };
      }
  };

  const removeProfessional = async (id: string) => {
      checkWriteAccess();
      try {
        const response = await usersApi.delete(id);
        if (response.success) {
          setProfessionals(prev => prev.filter(p => p.id !== id));
          return { success: true };
        }
        console.error('❌ Erro ao remover profissional:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao remover profissional:', error);
        return { success: false, error: 'Erro de sistema. Tente novamente.' };
      }
  };

  const resetUserPassword = async (userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
      checkWriteAccess();
      try {
        const response = await usersApi.resetPassword(userId, newPassword);
        if (response.success) {
          console.log('✅ Senha redefinida com sucesso');
          return { success: true };
        }
        console.error('❌ Erro ao redefinir senha:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao redefinir senha:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  // --- Photos (SEMPRE via API) ---
  const addPhoto = async (photo: Omit<PhotoRecord, 'id' | 'companyId'>) => {
      checkWriteAccess();
      try {
        const response = await photosApi.create(photo);
        if (response.success && response.data?.photo) {
          const p = response.data.photo;
          // Mapear a foto igual ao loadPhotos para consistência
          const mappedPhoto: PhotoRecord = {
            id: p.id,
            companyId: p.companyId,
            patientId: p.patientId,
            url: p.url,
            type: p.type?.toLowerCase() as 'before' | 'after',
            procedure: p.procedure,
            date: p.date,
            groupId: p.groupId,
          };
          setPhotos(prev => [...prev, mappedPhoto]);
          console.log('✅ Foto criada:', mappedPhoto.id);
          return { success: true, photo: mappedPhoto };
        }
        console.error('❌ Erro ao criar foto:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar foto:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const removePhoto = async (id: string) => {
      checkWriteAccess();
      try {
        const response = await photosApi.delete(id);
        if (response.success) {
          setPhotos(prev => prev.filter(p => p.id !== id));
          console.log('✅ Foto removida:', id);
          return { success: true };
        }
        console.error('❌ Erro ao remover foto:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        // NOTA: antes isso fingia sucesso e removia a foto só localmente,
        // desincronizando do backend (a foto continuava existindo no servidor).
        console.error('❌ Erro de conexão ao remover foto:', error);
        return { success: false, error: 'Erro de sistema. Tente novamente.' };
      }
  };

  // --- Plans (SEMPRE via API) ---
  const addPlan = async (plan: Omit<SaasPlan, 'id' | 'maxProfessionals' | 'maxPatients' | 'modules'> & { maxProfessionals?: number; maxPatients?: number; modules?: string[] }): Promise<{ success: boolean; plan?: SaasPlan; error?: string }> => {
      checkPermission([UserRole.OWNER]);
      try {
        const response = await plansApi.create({
          name: plan.name,
          price: plan.price,
          features: plan.features,
          active: plan.active,
          stripePaymentLink: plan.stripePaymentLink,
          // Opcionais: o backend já assume defaults (maxProfessionals ?? 1,
          // maxPatients ?? 50, modules || []) quando omitidos — ver
          // aura-backend/src/app/api/plans/route.ts
          maxProfessionals: plan.maxProfessionals,
          maxPatients: plan.maxPatients,
          modules: plan.modules,
        });
        if (response.success && response.data?.plan) {
          const newPlan: SaasPlan = {
            id: response.data.plan.id,
            name: response.data.plan.name,
            price: Number(response.data.plan.price),
            maxProfessionals: response.data.plan.maxProfessionals ?? -1,
            maxPatients: response.data.plan.maxPatients ?? -1,
            modules: response.data.plan.modules || [],
            features: response.data.plan.features || [],
            active: response.data.plan.active ?? true,
            stripePaymentLink: response.data.plan.stripePaymentLink || '',
          };
          setSaasPlans(prev => [...prev, newPlan]);
          console.log('✅ Plano criado:', newPlan.name);
          return { success: true, plan: newPlan };
        }
        console.error('❌ Erro ao criar plano:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar plano:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const updatePlan = async (id: string, data: Partial<SaasPlan>): Promise<{ success: boolean; error?: string }> => {
      checkPermission([UserRole.OWNER]);
      try {
        const response = await plansApi.update(id, data);
        if (response.success && response.data?.plan) {
          const updatedPlan: SaasPlan = {
            id: response.data.plan.id,
            name: response.data.plan.name,
            price: Number(response.data.plan.price),
            maxProfessionals: response.data.plan.maxProfessionals ?? -1,
            maxPatients: response.data.plan.maxPatients ?? -1,
            modules: response.data.plan.modules || [],
            features: response.data.plan.features || [],
            active: response.data.plan.active ?? true,
            stripePaymentLink: response.data.plan.stripePaymentLink || '',
          };
          setSaasPlans(prev => prev.map(p => p.id === id ? updatedPlan : p));
          console.log('✅ Plano atualizado:', updatedPlan.name);
          return { success: true };
        }
        console.error('❌ Erro ao atualizar plano:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao atualizar plano:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const removePlan = async (id: string): Promise<{ success: boolean; error?: string }> => {
      checkPermission([UserRole.OWNER]);
      try {
        const response = await plansApi.delete(id);
        if (response.success) {
          setSaasPlans(prev => prev.filter(p => p.id !== id));
          console.log('✅ Plano removido:', id);
          return { success: true };
        }
        console.error('❌ Erro ao remover plano:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao remover plano:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  // --- Leads (SEMPRE via API) ---
  const addLead = async (lead: Omit<Lead, 'id'>) => {
      try {
        const response = await leadsApi.create(lead);
        if (response.success && response.data) {
          const newLead = {
            ...response.data,
            status: response.data.status?.toLowerCase() || 'new',
            clinicName: response.data.clinicName || response.data.name || '',
            contactName: response.data.contactName || response.data.name || '',
            value: Number(response.data.value) || 0,
            createdAt: response.data.createdAt || new Date().toISOString(),
          } as unknown as Lead;
          setLeads(prev => [...prev, newLead]);
          console.log('✅ Lead criado:', newLead.id);
          return { success: true, lead: newLead };
        }
        console.error('❌ Erro ao criar lead:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar lead:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const moveLead = async (id: string, status: LeadStatus) => {
      try {
        // OWNER usa kingApi (atualiza salesStatus da empresa)
        // Outros usam leadsApi (atualiza Lead da clínica)
        const isOwner = user?.role === UserRole.OWNER;
        const response = isOwner
          ? await kingApi.updateLead(id, { status })
          : await leadsApi.update(id, { status: status.toUpperCase() });

        if (response.success) {
          setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
          return { success: true };
        }
        console.error('❌ Erro ao mover lead:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        // NOTA: antes isso fingia sucesso e movia o lead só localmente,
        // desincronizando do backend (revertia ao recarregar a página).
        console.error('❌ Erro de conexão ao mover lead:', error);
        return { success: false, error: 'Erro de sistema. Tente novamente.' };
      }
  };

  // --- Tickets (SEMPRE via API) ---
  const createTicket = async (subject: string, message: string) => {
      if (!user) return { success: false, error: 'Usuário não autenticado' };
      try {
        const response = await ticketsApi.create({ subject, message });
        if (response.success && response.data?.ticket) {
          const ticket = {
            ...response.data.ticket,
            companyName: response.data.ticket.company?.name || currentCompany?.name || 'Unknown',
            status: response.data.ticket.status?.toLowerCase(),
          } as unknown as Ticket;
          setTickets(prev => [ticket, ...prev]);
          console.log('✅ Ticket criado:', ticket.id);
          return { success: true, ticket };
        }
        console.error('❌ Erro ao criar ticket:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar ticket:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const replyTicket = async (ticketId: string, message: string) => {
      if (!user) return { success: false, error: 'Usuário não autenticado' };
      try {
        const response = await ticketsApi.reply(ticketId, message);
        if (response.success && response.data?.ticket) {
          setTickets(prev => prev.map(t => t.id === ticketId ? {
            ...response.data!.ticket,
            companyName: response.data!.ticket.company?.name || t.companyName,
            status: response.data!.ticket.status?.toLowerCase(),
          } as unknown as Ticket : t));
          return { success: true };
        }
        console.error('❌ Erro ao responder ticket:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao responder ticket:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const closeTicket = async (ticketId: string) => {
      try {
        const response = await ticketsApi.close(ticketId);
        if (response.success) {
          setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'closed' } : t));
          return { success: true };
        }
        console.error('❌ Erro ao fechar ticket:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        // NOTA: antes isso fingia sucesso e fechava o ticket só localmente,
        // desincronizando do backend (o ticket continuava aberto no servidor).
        console.error('❌ Erro de conexão ao fechar ticket:', error);
        return { success: false, error: 'Erro de sistema. Tente novamente.' };
      }
  };

  // --- System Alerts (SEMPRE via API) ---
  const addSystemAlert = async (alert: Omit<SystemAlert, 'id' | 'createdAt' | 'status'>) => {
      checkPermission([UserRole.OWNER]);
      try {
        const response = await systemAlertsApi.create({
          title: alert.title,
          message: alert.message,
          type: alert.type,
          target: alert.target,
        });
        if (response.success && response.data?.alert) {
          const newAlert = {
            ...response.data.alert,
            status: response.data.alert.status?.toLowerCase(),
            type: response.data.alert.type?.toLowerCase(),
          } as unknown as SystemAlert;
          setSystemAlerts(prev => [newAlert, ...prev]);
          console.log('✅ Alerta criado:', newAlert.id);
          return { success: true, alert: newAlert };
        }
        console.error('❌ Erro ao criar alerta:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar alerta:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const toggleSystemAlertStatus = async (id: string) => {
      checkPermission([UserRole.OWNER]);
      try {
        // Encontrar status atual
        const current = systemAlerts.find(a => a.id === id);
        const newStatus = current?.status === 'active' ? 'INACTIVE' : 'ACTIVE';

        const response = await systemAlertsApi.toggleStatus(id, newStatus);
        if (response.success) {
          setSystemAlerts(prev => prev.map(a => a.id === id ? {
            ...a,
            status: newStatus.toLowerCase() as SystemAlert['status']
          } : a));
          return { success: true };
        }
        console.error('❌ Erro ao alterar status do alerta:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        // NOTA: antes isso fingia sucesso e alternava o status só localmente,
        // desincronizando do backend. Removido o fallback local.
        console.error('❌ Erro de conexão ao alterar alerta:', error);
        return { success: false, error: 'Erro de sistema. Tente novamente.' };
      }
  };

  const dismissAlert = (id: string) => {
      setDismissedAlertIds(prev => [...prev, id]);
  };

  // --- Notifications (SEMPRE via API) ---
  const addNotification = async (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
      try {
        const response = await notificationsApi.create({
          title: notif.type || 'Notificação',
          message: notif.message,
          type: notif.type?.toUpperCase() || 'INFO',
        });
        if (response.success && response.data?.notification) {
          const newNotif = {
            id: response.data.notification.id,
            companyId: notif.companyId,
            message: response.data.notification.message,
            type: response.data.notification.type?.toLowerCase() as AppNotification['type'],
            timestamp: response.data.notification.createdAt,
            read: response.data.notification.isRead,
          };
          setNotifications(prev => [newNotif, ...prev]);
          console.log('✅ Notificação criada:', newNotif.id);
          return { success: true, notification: newNotif };
        }
        console.error('❌ Erro ao criar notificação:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        // NOTA: antes isso fingia sucesso e criava a notificação só localmente
        // com um id falso (`n_${Date.now()}`) que nunca existiu no servidor —
        // desincronizando do backend.
        console.error('❌ Erro de conexão ao criar notificação:', error);
        return { success: false, error: 'Erro de sistema. Tente novamente.' };
      }
  };

  const markNotificationAsRead = async (id: string) => {
      try {
        await notificationsApi.markAsRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      } catch (error) {
        // Marcar como lida é de baixo risco (idempotente, sem perda de dados),
        // mas não fingimos sucesso local desincronizado do backend.
        console.error('❌ Erro ao marcar notificação como lida:', error);
      }
  };

  // --- Unavailability Rules (SEMPRE via API) ---
  const addUnavailabilityRule = async (rule: Omit<UnavailabilityRule, 'id' | 'companyId'>) => {
      checkWriteAccess();
      try {
        const response = await unavailabilityApi.create(rule);
        if (response.success && response.data?.rule) {
          setUnavailabilityRules(prev => [...prev, response.data!.rule as unknown as UnavailabilityRule]);
          console.log('✅ Regra de indisponibilidade criada:', response.data.rule.id);
          return { success: true, rule: response.data.rule };
        }
        console.error('❌ Erro ao criar regra de indisponibilidade:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar regra:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const removeUnavailabilityRule = async (id: string) => {
      checkWriteAccess();
      try {
        const response = await unavailabilityApi.delete(id);
        if (response.success) {
          setUnavailabilityRules(prev => prev.filter(r => r.id !== id));
          console.log('✅ Regra de indisponibilidade removida:', id);
          return { success: true };
        }
        console.error('❌ Erro ao remover regra:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        // NOTA: antes isso fingia sucesso e removia a regra só localmente,
        // desincronizando do backend (a regra continuava existindo no servidor).
        console.error('❌ Erro de conexão ao remover regra:', error);
        return { success: false, error: 'Erro de sistema. Tente novamente.' };
      }
  };

  const loadUnavailabilityRules = useCallback(async (forceReload = false) => {
    if (!forceReload && (loadedRef.current.unavailabilityRules || loadingRef.current.unavailabilityRules)) return;
    if (forceReload) loadedRef.current.unavailabilityRules = false;
    loadingRef.current.unavailabilityRules = true;
    try {
      const res = await unavailabilityApi.list({ limit: 500 });
      if (res.success && res.data?.rules) {
        setUnavailabilityRules(res.data.rules as unknown as UnavailabilityRule[]);
        loadedRef.current.unavailabilityRules = true;
        console.log('✅ Regras de indisponibilidade carregadas:', res.data.rules.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar regras de indisponibilidade:', error);
    } finally {
      loadingRef.current.unavailabilityRules = false;
    }
  }, []);

  const loadPendingSubscriptions = useCallback(async () => {
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER)) return;
    try {
      const res = await subscriptionsApi.listPending();
      if (res.success && res.data) {
        setPendingSubscriptionsCount(res.data.length);
      }
    } catch { /* silent */ }
  }, [user]);

  // Polling: pending subscriptions every 60s
  useEffect(() => {
    loadPendingSubscriptions();
    const interval = setInterval(loadPendingSubscriptions, 60_000);
    return () => clearInterval(interval);
  }, [loadPendingSubscriptions]);

  // --- Inventory Actions (SEMPRE via API) ---
  const addInventoryItem = async (item: Omit<InventoryItem, 'id' | 'companyId'>) => {
      checkWriteAccess();
      try {
        const response = await inventoryApi.create(item);
        if (response.success && response.data?.item) {
          setInventory(prev => [...prev, response.data!.item]);
          console.log('✅ Item de estoque criado:', response.data.item.name);
          return { success: true, item: response.data.item };
        }
        console.error('❌ Erro ao criar item de estoque:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao criar item de estoque:', error);
        return { success: false, error: 'Erro de conexão' };
      }
  };

  const updateInventoryItem = async (id: string, data: Partial<InventoryItem>) => {
      checkWriteAccess();
      try {
        const response = await inventoryApi.update(id, data);
        if (response.success && response.data?.item) {
          const updated = response.data.item;
          setInventory(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
          return { success: true };
        }
        console.error('❌ Erro ao atualizar item de estoque:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao atualizar item de estoque:', error);
        return { success: false, error: 'Erro de sistema. Tente novamente.' };
      }
  };

  const removeInventoryItem = async (id: string) => {
      checkWriteAccess();
      try {
        const response = await inventoryApi.delete(id);
        if (response.success) {
          setInventory(prev => prev.filter(i => i.id !== id));
          return { success: true };
        }
        console.error('❌ Erro ao remover item de estoque:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao remover item de estoque:', error);
        return { success: false, error: 'Erro de sistema. Tente novamente.' };
      }
  };

  // --- Public Data Access ---
  const getPublicData = (companyId: string) => {
      const company = companies.find(c => c.id === companyId);
      if (!company) return null;

      const compProcs = procedures.filter(p => p.companyId === companyId);
      const compProfs = professionals.filter(p => p.companyId === companyId && p.role !== UserRole.OWNER);
      const compAppts = appointments.filter(a => a.companyId === companyId);
      const compRules = unavailabilityRules.filter(r => r.companyId === companyId);

      return {
          company,
          procedures: compProcs,
          professionals: compProfs,
          appointments: compAppts,
          unavailabilityRules: compRules
      };
  };

  return (
    <AppContext.Provider value={{
      user,
      isInitializing,
      login,
      loginWithToken,
      logout,
      registerCompany,
      setupGoogleCompany,
      companies,
      currentCompany,
      updateCompany,
      completeOnboarding,
      patients: user?.role === UserRole.OWNER ? patients : patients.filter(p => p.companyId === user?.companyId),
      addPatient,
      updatePatient,
      removePatient,
      signConsent,
      toggleAnamnesisSent,
      appointments: user?.role === UserRole.OWNER ? appointments : appointments.filter(a => a.companyId === user?.companyId),
      addAppointment,
      updateAppointment,
      changeAppointmentStatus,
      signAppointmentConsent,
      getAppointmentSignatureHistory,
      transactions: user?.role === UserRole.OWNER ? transactions : transactions.filter(t => t.companyId === user?.companyId),
      addTransaction,
      updateTransaction,
      deleteTransaction,
      processPayment,
      markInstallmentPaid,
      procedures: user?.role === UserRole.OWNER ? procedures : procedures.filter(p => p.companyId === user?.companyId),
      addProcedure,
      updateProcedure,
      removeProcedure,
      professionals: user?.role === UserRole.OWNER ? professionals : professionals.filter(p => p.companyId === user?.companyId),
      addProfessional,
      updateProfessional,
      removeProfessional,
      resetUserPassword,
      photos: user?.role === UserRole.OWNER ? photos : photos.filter(p => p.companyId === user?.companyId),
      addPhoto,
      removePhoto,
      saasPlans,
      addPlan,
      updatePlan,
      removePlan,
      loadPlans,
      leads,
      addLead,
      moveLead,
      tickets: user?.role === UserRole.OWNER ? tickets : tickets.filter(t => t.companyId === user?.companyId),
      createTicket,
      replyTicket,
      closeTicket,
      systemAlerts,
      addSystemAlert,
      toggleSystemAlertStatus,
      dismissedAlertIds,
      dismissAlert,
      notifications: notifications.filter(n => n.companyId === user?.companyId),
      addNotification,
      markNotificationAsRead,
      unavailabilityRules: user?.role === UserRole.OWNER ? unavailabilityRules : unavailabilityRules.filter(r => r.companyId === user?.companyId),
      addUnavailabilityRule,
      removeUnavailabilityRule,
      inventory: user?.role === UserRole.OWNER ? inventory : inventory.filter(i => i.companyId === user?.companyId),
      addInventoryItem,
      updateInventoryItem,
      removeInventoryItem,
      
      checkModuleAccess,
      isReadOnly,
      hasUnsavedChanges,
      setHasUnsavedChanges,
      triggerSave,
      setTriggerSave,
      pendingNavigationPath,
      setPendingNavigationPath,
      isSubscriptionModalOpen,
      setIsSubscriptionModalOpen,
      getPublicData,
      isLoading: apiLoading,

      // Lazy Loading
      loadPatients,
      loadAppointments,
      loadTransactions,
      loadProcedures,
      loadProfessionals,
      loadInventory,
      loadPhotos,
      loadLeads,
      loadUnavailabilityRules,
      loadingStates,
      loadedStates,
      pendingSubscriptionsCount,
      loadPendingSubscriptions,
      newLeadsCount: leads.filter(l => !l.seenByOwner).length,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
