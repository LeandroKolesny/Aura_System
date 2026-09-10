
export type PlanType = string;

export type SubscriptionStatus = 'active' | 'trial' | 'overdue' | 'canceled';

// Módulos que podem ser habilitados/desabilitados dependendo do plano
export type SystemModule = 
  | 'financial' 
  | 'crm' 
  | 'multi_user' 
  | 'ai_features' 
  | 'reports' 
  | 'online_booking'
  | 'support'
  | 'inventory' // Novo módulo
  | 'whatsapp_notifications';

export interface Company {
  id: string;
  name: string;
  slug?: string; // Slug único da empresa
  address?: string;
  city?: string; // Cidade da clínica
  state?: string; // Estado (sigla: SP, RJ, RS...)
  logo?: string; // Novo campo para Logo

  onboardingCompleted?: boolean; // Flag para controlar o fluxo de boas-vindas

  // Dados de Assinatura
  plan: PlanType;
  lastPlan?: PlanType; // Plano anterior (para recuperação quando cair no Basic/Expirado)
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string; // ISO Date para validação de duração
  customPrice?: number; // Preço negociado (para ENTERPRISE)
  
  layoutConfig?: PublicLayoutConfig; 
  businessHours?: BusinessHours; 
  onlineBookingConfig?: OnlineBookingConfig; 
  
  // Campos de perfil
  cnpj?: string;
  presentation?: string;
  phones?: string[];
  targetAudience?: {
    female: boolean;
    male: boolean;
    kids: boolean;
  };
  socialMedia?: {
    website?: string;
    facebook?: string;
    instagram?: string;
  };
  paymentMethods?: string[]; 
  
  // Marketing SaaS
  lastMarketingSentAt?: string;
}

export interface OnlineBookingConfig {
  slotInterval: number; 
  minAdvanceTime: number; 
  maxBookingPeriod: number; 
  cancellationNotice: number; 
  cancellationPolicy?: string;
}

export interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  isOpen: boolean;
  start: string; 
  end: string;   
}

export interface UnavailabilityRule {
  id: string;
  companyId: string;
  description?: string;
  startTime: string;
  endTime: string;
  dates: string[]; 
  professionalIds: string[]; 
}

export interface PublicLayoutConfig {
  backgroundColor: string;
  primaryColor: string;
  textColor?: string; 
  fontFamily: 'inter' | 'serif' | 'system';
  baseFontSize: 'sm' | 'md' | 'lg';
  cardBackgroundColor?: string; 
  cardTextColor?: string; 
  headerBackgroundColor?: string; 
  headerTextColor?: string; 
}

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  RECEPTIONIST = 'RECEPTIONIST',
  ESTHETICIAN = 'ESTHETICIAN',
  PATIENT = 'PATIENT', 
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  isActive?: boolean; // Status do usuário
  patientId?: string; // Para usuários com role PATIENT, referência ao registro Patient

  title?: string;
  contractType?: 'clt' | 'pj' | 'freelancer'; // normalizado sempre minúsculo (ver normalizeProfessional em AppContext.tsx)
  remunerationType?: 'fixo' | 'comissao' | 'misto';
  commissionType?: 'porcentagem' | 'valor_fixo';
  commissionRate?: number; 
  fixedSalary?: number; // Salário Fixo Mensal
  contractNotes?: string;

  businessHours?: BusinessHours; // Horário específico do profissional
}

export interface SignatureMetadata {
  signedAt: string;
  ipAddress: string;
  userAgent: string;
  documentVersion: string;
}

export interface Patient {
  id: string;
  companyId: string; 
  name: string;
  phone: string;
  email: string;
  birthDate?: string; // Opcional no banco (Prisma: DateTime?) — nem todo paciente tem data de nascimento cadastrada
  cpf?: string;
  lastVisit?: string;
  status: 'active' | 'inactive' | 'lead';
  anamnesisSummary?: string;
  consentSignedAt?: string;
  consentSignatureUrl?: string; // Base64 image
  consentMetadata?: SignatureMetadata; // Dados de auditoria
  // Indicador leve de correção — o histórico completo (imagem de cada versão)
  // vem sob demanda via patientsApi.getConsentSignatureHistory.
  consentCorrectionCount?: number;
  lastConsentCorrectionAt?: string;
  lastConsentCorrectionReason?: string;
  anamnesisLinkSent?: boolean;
  lastMarketingMessageSentAt?: string;
  // Opt-out de contato promocional (LGPD). true = paciente recusou marketing/WhatsApp.
  marketingOptOut?: boolean;
}

// --- ESTOQUE ---
export interface InventoryItem {
  id: string;
  companyId: string;
  name: string;
  unit: string; // ml, un, cx, g
  currentStock: number;
  minStock: number; // Para alerta
  costPerUnit: number;
  lastRestockDate?: string;
}

export interface Supply {
  id: string;
  inventoryItemId?: string; // Link com item de estoque
  name: string;
  quantityUsed: number; // Quanto consome do estoque (ex: 50 unidades de botox)
  cost: number; // Custo calculado ou manual
}

export interface Procedure {
  id: string;
  companyId: string; 
  name: string;
  description?: string;
  imageUrl?: string; 
  price: number;
  cost: number;
  durationMinutes: number;
  supplies?: Supply[];
  
  // Novos campos para Marketing Automático
  maintenanceRequired?: boolean; 
  maintenanceIntervalDays?: number;
}

export interface Appointment {
  id: string;
  companyId: string; 
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  service: string;
  price: number;
  date: string;
  durationMinutes: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'canceled' | 'pending_approval';
  notes?: string;
  paid?: boolean;
  roomId?: number;
  stockDeducted?: boolean; // Flag para saber se já baixou estoque
  
  // Novos campos para Assinatura por procedimento
  signatureUrl?: string;
  signatureMetadata?: SignatureMetadata;
  // Indicador leve de correção — o histórico completo (imagem de cada versão)
  // vem sob demanda via appointmentsApi.getSignatureHistory.
  signatureCorrectionCount?: number;
  lastSignatureCorrectionAt?: string;
  lastSignatureCorrectionReason?: string;
}

export interface SignatureHistoryEntry {
  id: string;
  signatureUrl: string;
  signedAt: string;
  documentVersion: string;
  correctionReason: string | null;
}

export interface Transaction {
  id: string;
  companyId: string; 
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  status: 'paid' | 'pending';
  appointmentId?: string;
  installments?: number;
  installmentIndex?: number;
  installmentGroupId?: string;
  dueDate?: string;
}

export interface PhotoRecord {
  id: string;
  companyId: string; 
  patientId: string;
  date: string;
  url: string;
  type: 'before' | 'after';
  procedure: string;
  groupId: string; // Identificador único para vincular um Antes a um Depois
}

export interface AppNotification {
  id: string;
  companyId: string; 
  recipientId?: string; // Opcional: Se for para um usuário específico (ex: Paciente)
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: string;
  read: boolean;
}

// --- INTERFACES SAAS ---

export type LeadStatus = 'new' | 'contacted' | 'demo' | 'negotiation' | 'won' | 'lost';

export interface Lead {
  id: string;
  clinicName: string;
  contactName: string;
  phone: string;
  email: string;
  status: LeadStatus;
  value: number;
  createdAt: string;
  notes?: string;
  companyId?: string;
  seenByOwner?: boolean;
  movedAt?: string;
  demoAt?: string;
  demoNotes?: string;
  lostReason?: string;
  lostComment?: string;
  wonPlan?: string;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isAdmin: boolean; 
}

export interface Ticket {
  id: string;
  companyId: string;
  companyName: string;
  subject: string;
  status: 'open' | 'pending' | 'closed';
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface SaasPlan {
  id: string;
  name: string;           // Padronizado: FREE, BASIC, STARTER, PROFESSIONAL, PREMIUM, ENTERPRISE
  displayName?: string;   // Nome amigável para exibição
  price: number;
  maxProfessionals: number;  // -1 = ilimitado
  maxPatients: number;       // -1 = ilimitado
  modules: string[];         // Módulos habilitados neste plano
  features: string[];        // Lista de features para marketing
  active: boolean;
  stripePaymentLink?: string;
}

export interface SystemAlert {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  target: 'all' | string; 
  status: 'active' | 'inactive'; 
  createdAt: string;
}

export interface PublicCompanyData {
  company: Company;
  professionals: User[];
  procedures: Procedure[];
  appointments: Appointment[]; 
  unavailabilityRules: UnavailabilityRule[]; 
}
