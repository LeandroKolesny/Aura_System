import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  User, Company, Patient, Appointment, Transaction, Procedure,
  PhotoRecord, SaasPlan, Lead, Ticket, SystemAlert, AppNotification,
  UserRole, SystemModule, UnavailabilityRule, LeadStatus, InventoryItem, SignatureMetadata
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
  kingApi
} from '../services/api';

interface AppContextType {
  user: User | null;
  isInitializing: boolean; // Loading enquanto valida sessão
  login: (email: string, password?: string) => Promise<boolean>;
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  registerCompany: (companyName: string, adminData: any) => Promise<{ success: boolean; error?: string }>;
  setupGoogleCompany: (companyName: string, state?: string, phone?: string) => Promise<{ success: boolean; error?: string }>;

  companies: Company[];
  currentCompany: Company | null;
  updateCompany: (companyId: string, data: Partial<Company>) => Promise<{ success: boolean; company?: Company; error?: string }>;
  completeOnboarding: () => void;

  patients: Patient[];
  addPatient: (patient: Omit<Patient, 'id' | 'companyId' | 'status'> & { status?: 'active' | 'inactive' | 'lead' }) => void;
  updatePatient: (id: string, data: Partial<Patient>) => void;
  removePatient: (id: string) => void;
  toggleConsent: (id: string) => void;
  signConsent: (id: string, signatureBase64: string) => void; // Novo
  toggleAnamnesisSent: (id: string) => void;

  appointments: Appointment[];
  addAppointment: (appt: any, isPublic?: boolean, publicCompanyId?: string, patientInfo?: any) => { success: boolean; conflict?: boolean; error?: string };
  updateAppointment: (id: string, data: Partial<Appointment>) => void;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  signAppointmentConsent: (id: string, signatureBase64: string) => void; // Novo
  
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id' | 'companyId'>) => void;
  processPayment: (appointment: Appointment, method: string) => void;

  procedures: Procedure[];
  addProcedure: (proc: Omit<Procedure, 'id' | 'companyId'>) => void;
  updateProcedure: (id: string, data: Partial<Procedure>) => void;
  removeProcedure: (id: string) => void;

  professionals: User[];
  addProfessional: (prof: any) => void;
  updateProfessional: (id: string, data: Partial<User>) => void;
  removeProfessional: (id: string) => void;
  resetUserPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;

  photos: PhotoRecord[];
  addPhoto: (photo: Omit<PhotoRecord, 'id' | 'companyId'>) => void;
  removePhoto: (id: string) => void;

  saasPlans: SaasPlan[];
  addPlan: (plan: Omit<SaasPlan, 'id'>) => Promise<{ success: boolean; plan?: SaasPlan; error?: string }>;
  updatePlan: (id: string, data: Partial<SaasPlan>) => Promise<{ success: boolean; error?: string }>;
  removePlan: (id: string) => Promise<{ success: boolean; error?: string }>;
  loadPlans: (forceReload?: boolean) => Promise<void>;

  leads: Lead[];
  addLead: (lead: Omit<Lead, 'id'>) => void;
  moveLead: (id: string, status: LeadStatus) => void;

  tickets: Ticket[];
  createTicket: (subject: string, message: string) => void;
  replyTicket: (ticketId: string, message: string) => void;
  closeTicket: (ticketId: string) => void;

  systemAlerts: SystemAlert[];
  addSystemAlert: (alert: Omit<SystemAlert, 'id' | 'createdAt' | 'status'>) => void;
  toggleSystemAlertStatus: (id: string) => void;
  
  // Gestão de alertas descartados
  dismissedAlertIds: string[];
  dismissAlert: (id: string) => void;

  notifications: AppNotification[];
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;

  unavailabilityRules: UnavailabilityRule[];
  addUnavailabilityRule: (rule: Omit<UnavailabilityRule, 'id' | 'companyId'>) => void;
  removeUnavailabilityRule: (id: string) => void;

  // Inventory
  inventory: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'companyId'>) => void;
  updateInventoryItem: (id: string, data: Partial<InventoryItem>) => void;
  removeInventoryItem: (id: string) => void;

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

  const checkModuleAccess: any = (module: SystemModule): boolean => {
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
      const token = localStorage.getItem('aura_token');

      if (!token) {
        // Sem token, não há sessão para restaurar
        setIsInitializing(false);
        return;
      }

      try {
        // Validar token e obter dados do usuário
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
              subscriptionStatus: apiUser.company.subscriptionStatus?.toLowerCase() || 'active',
              subscriptionExpiresAt: apiUser.company.subscriptionExpiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              businessHours: apiUser.company.businessHours || {},
              onboardingCompleted: apiUser.company.onboardingCompleted ?? true,
            };
            setCompanies([mappedCompany]);
            console.log('🏢 Sessão restaurada - Empresa:', mappedCompany.name);
          }

          console.log('🔐 Sessão restaurada:', { email: apiUser.email, role: mappedRole });
          setUser(mappedUser);
        } else {
          // Token inválido ou expirado - limpar
          console.log('⚠️ Token inválido, limpando sessão...');
          localStorage.removeItem('aura_token');
        }
      } catch (error) {
        console.error('❌ Erro ao restaurar sessão:', error);
        localStorage.removeItem('aura_token');
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
  });

  const loadPatients = useCallback(async () => {
    if (loadedRef.current.patients || loadingRef.current.patients) return;
    loadingRef.current.patients = true;
    setLoading('patients', true);
    try {
      const res = await patientsApi.list({ limit: 100 });
      if (res.success && res.data?.patients) {
        const mapped = res.data.patients.map((p: any) => ({
          ...p,
          status: p.status?.toLowerCase() || 'active'
        }));
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
        const mapped = res.data.appointments.map((a: any) => ({
          ...a,
          price: Number(a.price) || 0,
          durationMinutes: Number(a.durationMinutes) || 60,
          status: a.status?.toLowerCase() || 'scheduled',
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
        const mapped = res.data.transactions.map((t: any) => ({
          ...t,
          amount: Number(t.amount) || 0,
          type: t.type?.toLowerCase() || 'income',
          status: t.status?.toLowerCase() || 'paid'
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

  const loadProcedures = useCallback(async () => {
    if (loadedRef.current.procedures || loadingRef.current.procedures) return;
    loadingRef.current.procedures = true;
    setLoading('procedures', true);
    try {
      const res = await proceduresApi.list({ limit: 100 });
      if (res.success && res.data?.procedures) {
        const mapped = res.data.procedures.map((p: any) => ({
          ...p,
          price: Number(p.price) || 0,
          cost: Number(p.cost) || 0,
          supplies: p.supplies?.map((s: any) => ({
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
        const remunerationMap: Record<string, string> = {
          'COMMISSION': 'comissao', 'FIXED': 'fixo', 'MIXED': 'misto',
          'commission': 'comissao', 'fixed': 'fixo', 'mixed': 'misto'
        };
        const mapped = res.data.users.map((u: any) => ({
          ...u,
          role: u.role || 'ESTHETICIAN',
          contractType: u.contractType?.toLowerCase() || 'pj',
          remunerationType: remunerationMap[u.remunerationType] || u.remunerationType?.toLowerCase() || 'comissao',
          commissionRate: Number(u.commissionRate) || 0,
          fixedSalary: Number(u.fixedSalary) || 0
        }));
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

  const loadInventory = useCallback(async () => {
    if (loadedRef.current.inventory || loadingRef.current.inventory) return;
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
        const mapped = res.data.photos.map((p: any) => ({
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
        const mappedPlans = res.data.map((p: any) => ({
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
        const mapped = res.data.leads.map((l: any) => ({
          ...l,
          status: l.status?.toLowerCase() || 'new',
          value: Number(l.value) || 0,
        }));
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
        const mappedCompanies = companiesRes.data.companies.map((c: any) => ({
          ...c,
          plan: c.plan?.toLowerCase() || 'basic',
          subscriptionStatus: c.subscriptionStatus?.toLowerCase() || 'active',
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
        }));
        setCompanies(mappedCompanies);
        console.log('✅ Empresas carregadas:', mappedCompanies.length);
      }

      if (usersRes.success && usersRes.data?.users) {
        const remunerationMap: Record<string, string> = {
          'COMMISSION': 'comissao', 'FIXED': 'fixo', 'MIXED': 'misto',
          'commission': 'comissao', 'fixed': 'fixo', 'mixed': 'misto'
        };
        const mapped = usersRes.data.users.map((u: any) => ({
          ...u,
          role: u.role || 'ESTHETICIAN',
          contractType: u.contractType?.toLowerCase() || 'pj',
          remunerationType: remunerationMap[u.remunerationType] || u.remunerationType?.toLowerCase() || 'comissao',
          commissionRate: Number(u.commissionRate) || 0,
          fixedSalary: Number(u.fixedSalary) || 0
        }));
        setProfessionals(mapped);
        setLoaded('professionals', true);
        console.log('✅ Profissionais carregados:', mapped.length);
      }

      // CRÍTICO: Carregar planos para checkModuleAccess funcionar corretamente
      if (plansRes.success && plansRes.data) {
        const mappedPlans = plansRes.data.map((p: any) => ({
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
    const token = localStorage.getItem('aura_token');
    if (user && token) {
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
              subscriptionStatus: apiUser.company.subscriptionStatus?.toLowerCase() || 'active',
              subscriptionExpiresAt: apiUser.company.subscriptionExpiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              businessHours: apiUser.company.businessHours || {},
              onboardingCompleted: apiUser.company.onboardingCompleted ?? true,
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
      localStorage.setItem('aura_token', token);
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
        };

        // Se tiver dados da empresa, adiciona à lista de companies
        if (apiUser.company) {
          const mappedCompany: Company = {
            id: apiUser.company.id,
            name: apiUser.company.name,
            slug: apiUser.company.slug,
            plan: apiUser.company.plan?.toLowerCase() || 'free',
            subscriptionStatus: apiUser.company.subscriptionStatus?.toLowerCase() || 'active',
            subscriptionExpiresAt: apiUser.company.subscriptionExpiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            businessHours: apiUser.company.businessHours || {},
            onboardingCompleted: apiUser.company.onboardingCompleted ?? true,
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
      localStorage.removeItem('aura_token');
      return false;
    } catch {
      localStorage.removeItem('aura_token');
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
      loadedRef.current = { patients: false, appointments: false, transactions: false, procedures: false, professionals: false, inventory: false, plans: false, photos: false, leads: false };
      loadingRef.current = { patients: false, appointments: false, transactions: false, procedures: false, professionals: false, inventory: false, plans: false, photos: false, leads: false };
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

  const registerCompany = async (companyName: string, adminData: any): Promise<{ success: boolean; error?: string }> => {
      try {
        // Chamar API de registro para salvar no banco de dados
        const response = await authApi.register({
          name: adminData.name,
          email: adminData.email,
          password: adminData.password,
          companyName: companyName,
          state: adminData.state,
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
      // Refresh session so user.companyId and companies state are updated
      const token = localStorage.getItem('aura_token');
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

      // Atualiza local state imediatamente para UI responsiva
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, ...data } : c));

      // Persiste no banco de dados via API
      try {
        const response = await companiesApi.update(companyId, data);
        if (response.success && response.data?.company) {
          // Atualiza com dados confirmados do servidor
          const updatedCompany = {
            ...response.data.company,
            plan: response.data.company.plan?.toLowerCase() || 'basic',
            subscriptionStatus: response.data.company.subscriptionStatus?.toLowerCase() || 'active',
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
          };
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
  const addPatient = async (patientData: any) => {
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
          const newPatient = { ...result.data.patient, status: result.data.patient.status?.toLowerCase() || 'active' };
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
          setPatients(prev => prev.map(p => p.id === id ? { ...p, ...result.data!.patient } : p));
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

  const toggleConsent = (id: string) => {
      checkWriteAccess();
      const patient = patients.find(p => p.id === id);
      if (patient) {
          updatePatient(id, { consentSignedAt: patient.consentSignedAt ? undefined : new Date().toISOString() });
      }
  };

  // Nova função para salvar assinatura com metadados
  const signConsent = (id: string, signatureBase64: string) => {
      checkWriteAccess();
      const metadata: SignatureMetadata = {
          signedAt: new Date().toISOString(),
          ipAddress: '192.168.1.' + Math.floor(Math.random() * 255), // Simulação de IP
          userAgent: navigator.userAgent,
          documentVersion: 'v1.0-2023'
      };

      updatePatient(id, { 
          consentSignedAt: new Date().toISOString(),
          consentSignatureUrl: signatureBase64,
          consentMetadata: metadata
      });
  };

  const toggleAnamnesisSent = (id: string) => {
      checkWriteAccess();
      updatePatient(id, { anamnesisLinkSent: true });
  };

  // --- Appointment Actions (SEMPRE via API) ---
  const addAppointment = async (appt: any, isPublic = false, publicCompanyId?: string, patientInfo?: any) => {
      if (!isPublic) checkWriteAccess();

      const companyId = isPublic ? publicCompanyId : user?.companyId;
      if (!companyId) return { success: false, error: 'Company ID missing' };

      try {
        let response;

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
            status: newAppt.status?.toLowerCase() || 'scheduled',
            patientId: newAppt.patientId || newAppt.patient?.id,
            patientName: newAppt.patient?.name || newAppt.patientName,
            professionalId: newAppt.professionalId || newAppt.professional?.id,
            professionalName: newAppt.professional?.name || newAppt.professionalName,
            procedureId: newAppt.procedureId || newAppt.procedure?.id,
            service: newAppt.procedure?.name || newAppt.service
          };
          setAppointments(prev => [...prev, mappedAppt]);

          // Se criou novo paciente, adicionar ao estado local
          if (response.data.patient) {
            setPatients(prev => [...prev, response.data!.patient]);
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

  const deductStock = (appointment: Appointment) => {
      const proc = procedures.find(p => p.name === appointment.service && p.companyId === appointment.companyId);
      
      if (proc && proc.supplies && proc.supplies.length > 0) {
          let updatedInventory = [...inventory];
          let lowStockAlerts: string[] = [];

          proc.supplies.forEach(supply => {
              if (supply.inventoryItemId) {
                  const itemIndex = updatedInventory.findIndex(i => i.id === supply.inventoryItemId);
                  if (itemIndex !== -1) {
                      updatedInventory[itemIndex] = {
                          ...updatedInventory[itemIndex],
                          currentStock: Math.max(0, updatedInventory[itemIndex].currentStock - supply.quantityUsed)
                      };

                      if (updatedInventory[itemIndex].currentStock <= updatedInventory[itemIndex].minStock) {
                          lowStockAlerts.push(updatedInventory[itemIndex].name);
                      }
                  }
              }
          });

          setInventory(updatedInventory);

          if (lowStockAlerts.length > 0) {
              const notif: AppNotification = {
                  id: `n_stock_${Date.now()}`,
                  companyId: appointment.companyId,
                  recipientId: 'clinic',
                  message: `Alerta de Estoque Baixo: ${lowStockAlerts.join(', ')}`,
                  type: 'error',
                  timestamp: new Date().toISOString(),
                  read: false
              };
              setNotifications(prev => [notif, ...prev]);
          }
      }
  };

  const updateAppointmentStatus = (id: string, status: Appointment['status']) => {
      checkWriteAccess();
      
      const appt = appointments.find(a => a.id === id);
      
      if (appt && status === 'completed' && !appt.stockDeducted) {
          deductStock(appt);
          updateAppointment(id, { status, stockDeducted: true });
      } else {
          updateAppointment(id, { status });
      }
      
      if (appt && status === 'completed') {
          updatePatient(appt.patientId, { lastVisit: new Date().toISOString() });
      }
  };

  const signAppointmentConsent = (id: string, signatureBase64: string) => {
    checkWriteAccess();
    const metadata: SignatureMetadata = {
      signedAt: new Date().toISOString(),
      ipAddress: 'Simulado',
      userAgent: navigator.userAgent,
      documentVersion: 'v1.0-appt-consent'
    };

    updateAppointment(id, {
      signatureUrl: signatureBase64,
      signatureMetadata: metadata
    });
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
            type: response.data.transaction.type?.toLowerCase(),
            status: response.data.transaction.status?.toLowerCase(),
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

  const processPayment = async (appointment: Appointment, method: string) => {
      checkWriteAccess();

      try {
        const response = await appointmentsApi.processPayment(appointment.id, method);
        if (response.success) {
          // Atualizar estado local com dados da API
          updateAppointment(appointment.id, { paid: true, status: 'completed' });

          // Adicionar transações ao estado local
          if (response.data?.transactions?.income) {
            const income = response.data.transactions.income;
            setTransactions(prev => [...prev, {
              id: income.id,
              companyId: income.companyId,
              date: income.date,
              description: income.description,
              amount: Number(income.amount),
              type: 'income',
              category: income.category,
              status: 'paid',
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
          if (response.data?.inventory) {
            response.data.inventory.forEach((item: any) => {
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
            supplies: response.data.procedure.supplies?.map((s: any) => ({
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
            supplies: response.data.procedure.supplies?.map((s: any) => ({
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
  const addProfessional = async (prof: any) => {
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
          const newProf = {
            ...response.data.user,
            role: response.data.user.role || 'ESTHETICIAN',
            commissionRate: Number(response.data.user.commissionRate) || 0,
            fixedSalary: Number(response.data.user.fixedSalary) || 0,
          };
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
      // Atualiza localmente por enquanto - API de update não existe ainda
      setProfessionals(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const removeProfessional = async (id: string) => {
      checkWriteAccess();
      // Remove localmente por enquanto - API de delete não existe ainda
      setProfessionals(prev => prev.filter(p => p.id !== id));
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
        console.error('❌ Erro de conexão ao remover foto:', error);
        setPhotos(prev => prev.filter(p => p.id !== id));
        return { success: true };
      }
  };

  // --- Plans (SEMPRE via API) ---
  const addPlan = async (plan: Omit<SaasPlan, 'id'>): Promise<{ success: boolean; plan?: SaasPlan; error?: string }> => {
      checkPermission([UserRole.OWNER]);
      try {
        const response = await plansApi.create({
          name: plan.name,
          price: plan.price,
          features: plan.features,
          active: plan.active,
          stripePaymentLink: plan.stripePaymentLink,
        });
        if (response.success && response.data?.plan) {
          const newPlan: SaasPlan = {
            id: response.data.plan.id,
            name: response.data.plan.name,
            price: Number(response.data.plan.price),
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
          };
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
        console.error('❌ Erro de conexão ao mover lead:', error);
        // Fallback local
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
        return { success: true };
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
          };
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
          } : t));
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
        console.error('❌ Erro de conexão ao fechar ticket:', error);
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'closed' } : t));
        return { success: true };
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
          };
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
            status: newStatus.toLowerCase()
          } : a));
          return { success: true };
        }
        console.error('❌ Erro ao alterar status do alerta:', response.error);
        return { success: false, error: response.error };
      } catch (error) {
        console.error('❌ Erro de conexão ao alterar alerta:', error);
        // Fallback local
        setSystemAlerts(prev => prev.map(a => a.id === id ? { ...a, status: a.status === 'active' ? 'inactive' : 'active' } : a));
        return { success: true };
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
            message: response.data.notification.message,
            type: response.data.notification.type?.toLowerCase(),
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
        console.error('❌ Erro de conexão ao criar notificação:', error);
        // Fallback local para não perder notificação
        const newNotif: AppNotification = {
          id: `n_${Date.now()}`,
          timestamp: new Date().toISOString(),
          read: false,
          ...notif
        };
        setNotifications(prev => [newNotif, ...prev]);
        return { success: true, notification: newNotif };
      }
  };

  const markNotificationAsRead = async (id: string) => {
      try {
        await notificationsApi.markAsRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      } catch (error) {
        console.error('❌ Erro ao marcar notificação como lida:', error);
        // Fallback local
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }
  };

  // --- Unavailability Rules (SEMPRE via API) ---
  const addUnavailabilityRule = async (rule: Omit<UnavailabilityRule, 'id' | 'companyId'>) => {
      checkWriteAccess();
      try {
        const response = await unavailabilityApi.create(rule);
        if (response.success && response.data?.rule) {
          setUnavailabilityRules(prev => [...prev, response.data!.rule]);
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
        console.error('❌ Erro de conexão ao remover regra:', error);
        // Fallback local
        setUnavailabilityRules(prev => prev.filter(r => r.id !== id));
        return { success: true };
      }
  };

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
      // Atualiza localmente por enquanto - API de update não existe ainda
      setInventory(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  };

  const removeInventoryItem = async (id: string) => {
      checkWriteAccess();
      // Remove localmente por enquanto - API de delete não existe ainda
      setInventory(prev => prev.filter(i => i.id !== id));
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
      toggleConsent,
      signConsent, 
      toggleAnamnesisSent,
      appointments: user?.role === UserRole.OWNER ? appointments : appointments.filter(a => a.companyId === user?.companyId),
      addAppointment,
      updateAppointment,
      updateAppointmentStatus,
      signAppointmentConsent, 
      transactions: user?.role === UserRole.OWNER ? transactions : transactions.filter(t => t.companyId === user?.companyId),
      addTransaction,
      processPayment,
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
      loadingStates,
      loadedStates
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
