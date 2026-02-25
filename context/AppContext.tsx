import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  User, Company, Patient, Appointment, Transaction, Procedure,
  PhotoRecord, SaasPlan, Lead, Ticket, SystemAlert, AppNotification,
  UserRole, SystemModule, UnavailabilityRule, LeadStatus, InventoryItem, SignatureMetadata
} from '../types';
import { DEFAULT_PLANS, PLAN_PERMISSIONS } from '../constants';
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
  notificationsApi
} from '../services/api';

interface AppContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<boolean>;
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  registerCompany: (companyName: string, adminData: any) => void;
  
  companies: Company[];
  currentCompany: Company | null;
  updateCompany: (companyId: string, data: Partial<Company>) => void;
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

  photos: PhotoRecord[];
  addPhoto: (photo: Omit<PhotoRecord, 'id' | 'companyId'>) => void;
  removePhoto: (id: string) => void;

  saasPlans: SaasPlan[];
  addPlan: (plan: SaasPlan) => void;
  updatePlan: (id: string, data: Partial<SaasPlan>) => void;
  removePlan: (id: string) => void;

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
  const [saasPlans, setSaasPlans] = useState<SaasPlan[]>(DEFAULT_PLANS);
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
      const permissions = PLAN_PERMISSIONS[currentCompany.plan] || [];
      return permissions.includes(module);
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

  // Carrega dados da API quando o usuário loga via API
  const loadDataFromApi = useCallback(async () => {
    if (!user) return;

    setApiLoading(true);
    console.log('📡 Carregando dados da API...');

    try {
      // Carregar dados em paralelo
      const [companiesRes, usersRes, patientsRes, appointmentsRes, transactionsRes, proceduresRes, inventoryRes] = await Promise.all([
        companiesApi.list({ limit: 100 }),
        usersApi.list({ limit: 100 }),
        patientsApi.list({ limit: 100 }),
        appointmentsApi.list({ limit: 100 }),
        transactionsApi.list({ limit: 100 }),
        proceduresApi.list({ limit: 100 }),
        inventoryApi.list({ limit: 100 })
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
        // Mapeamento de tipos de remuneração (banco -> frontend)
        const remunerationMap: Record<string, string> = {
          'COMMISSION': 'comissao',
          'FIXED': 'fixo',
          'MIXED': 'misto',
          'commission': 'comissao',
          'fixed': 'fixo',
          'mixed': 'misto'
        };

        const mappedUsers = usersRes.data.users.map((u: any) => ({
          ...u,
          role: u.role || 'ESTHETICIAN',
          contractType: u.contractType?.toLowerCase() || 'pj',
          remunerationType: remunerationMap[u.remunerationType] || u.remunerationType?.toLowerCase() || 'comissao',
          commissionRate: Number(u.commissionRate) || 0,
          fixedSalary: Number(u.fixedSalary) || 0
        }));
        setProfessionals(mappedUsers);
        console.log('✅ Profissionais carregados:', mappedUsers.length, mappedUsers);
      }

      if (patientsRes.success && patientsRes.data?.patients) {
        const mappedPatients = patientsRes.data.patients.map((p: any) => ({
          ...p,
          status: p.status?.toLowerCase() || 'active'
        }));
        setPatients(mappedPatients);
        console.log('✅ Pacientes carregados:', mappedPatients.length);
      }

      if (appointmentsRes.success && appointmentsRes.data?.appointments) {
        const mappedAppts = appointmentsRes.data.appointments.map((a: any) => ({
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
        setAppointments(mappedAppts);
        console.log('✅ Agendamentos carregados:', mappedAppts.length, 'Exemplo:', mappedAppts[0]);
      }

      if (transactionsRes.success && transactionsRes.data?.transactions) {
        const mappedTrans = transactionsRes.data.transactions.map((t: any) => ({
          ...t,
          amount: Number(t.amount) || 0,
          type: t.type?.toLowerCase() || 'income',
          status: t.status?.toLowerCase() || 'paid'
        }));
        setTransactions(mappedTrans);
        console.log('✅ Transações carregadas:', mappedTrans.length);
      }

      if (proceduresRes.success && proceduresRes.data?.procedures) {
        const mappedProcs = proceduresRes.data.procedures.map((p: any) => ({
          ...p,
          price: Number(p.price) || 0,
          cost: Number(p.cost) || 0,
          // Mapear supplies do formato API para formato frontend
          supplies: p.supplies?.map((s: any) => ({
            id: s.id,
            inventoryItemId: s.inventoryItemId || s.inventoryItem?.id,
            name: s.inventoryItem?.name || s.name || 'Insumo',
            quantityUsed: Number(s.quantityUsed) || 1,
            cost: Number(s.inventoryItem?.costPerUnit || 0) * Number(s.quantityUsed || 1),
            unit: s.inventoryItem?.unit || 'un'
          })) || []
        }));
        setProcedures(mappedProcs);
        console.log('✅ Procedimentos carregados:', mappedProcs.length, 'Exemplo:', mappedProcs[0]);
      }

      if (inventoryRes.success && inventoryRes.data?.items) {
        setInventory(inventoryRes.data.items);
        console.log('✅ Estoque carregado:', inventoryRes.data.items.length);
      }

      console.log('🎉 Dados carregados com sucesso!');
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
      setUser(null);
      setDismissedAlertIds([]); // Limpa os alertas fechados ao deslogar
  };

  const registerCompany = (companyName: string, adminData: any) => {
      const newCompanyId = `c_${Date.now()}`;
      const newCompany: Company = {
          id: newCompanyId,
          name: companyName,
          plan: 'free', // Começa como free/trial
          subscriptionStatus: 'trial',
          subscriptionExpiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 dias
          businessHours: {
            monday: { isOpen: true, start: '08:00', end: '18:00' },
            tuesday: { isOpen: true, start: '08:00', end: '18:00' },
            wednesday: { isOpen: true, start: '08:00', end: '18:00' },
            thursday: { isOpen: true, start: '08:00', end: '18:00' },
            friday: { isOpen: true, start: '08:00', end: '18:00' },
            saturday: { isOpen: true, start: '09:00', end: '13:00' },
            sunday: { isOpen: false, start: '00:00', end: '00:00' }
          },
          onboardingCompleted: false
      };

      const newAdmin: User = {
          id: `u_${Date.now()}`,
          companyId: newCompanyId,
          name: adminData.name,
          email: adminData.email,
          password: adminData.password,
          role: UserRole.ADMIN,
          phone: adminData.phone,
          contractType: 'PJ',
          remunerationType: 'fixo',
          commissionRate: 0
      };

      setCompanies(prev => [...prev, newCompany]);
      setProfessionals(prev => [...prev, newAdmin]);

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
  };

  const updateCompany = (companyId: string, data: Partial<Company>) => {
      if (user?.role !== UserRole.OWNER) checkWriteAccess();
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, ...data } : c));
  };

  const completeOnboarding = () => {
      if (currentCompany) {
          updateCompany(currentCompany.id, { onboardingCompleted: true });
      }
  };

  // --- Patient Actions (SEMPRE via API) ---
  const addPatient = async (patientData: any) => {
      checkWriteAccess();
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
          setAppointments(prev => [...prev, {
            ...newAppt,
            status: newAppt.status?.toLowerCase() || 'scheduled',
          }]);

          // Se criou novo paciente, adicionar ao estado local
          if (response.data.patient) {
            setPatients(prev => [...prev, response.data!.patient]);
          }

          console.log('✅ Agendamento criado:', newAppt.id);
          return { success: true, appointment: newAppt };
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

  // --- Photos (SEMPRE via API) ---
  const addPhoto = async (photo: Omit<PhotoRecord, 'id' | 'companyId'>) => {
      checkWriteAccess();
      try {
        const response = await photosApi.create(photo);
        if (response.success && response.data?.photo) {
          setPhotos(prev => [...prev, response.data!.photo]);
          console.log('✅ Foto criada:', response.data.photo.id);
          return { success: true, photo: response.data.photo };
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

  // --- Plans ---
  const addPlan = (plan: SaasPlan) => {
      checkPermission([UserRole.OWNER]);
      const newPlan = { ...plan, id: plan.name.toLowerCase().replace(/\s/g, '-') as any }; 
      setSaasPlans(prev => [...prev, newPlan]);
  };

  const updatePlan = (id: string, data: Partial<SaasPlan>) => {
      checkPermission([UserRole.OWNER]);
      setSaasPlans(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const removePlan = (id: string) => {
      checkPermission([UserRole.OWNER]);
      setSaasPlans(prev => prev.filter(p => p.id !== id));
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
        const response = await leadsApi.update(id, { status: status.toUpperCase() });
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
      login,
      loginWithToken,
      logout,
      registerCompany,
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
      photos: user?.role === UserRole.OWNER ? photos : photos.filter(p => p.companyId === user?.companyId),
      addPhoto,
      removePhoto,
      saasPlans,
      addPlan,
      updatePlan,
      removePlan,
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
      getPublicData
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
