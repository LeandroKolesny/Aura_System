// Aura System - Constantes do Sistema
// Apenas constantes e configurações, SEM dados mock

import { PlanType, SystemModule, SaasPlan, BusinessHours } from './types';

export const SAAS_COMPANY_NAME = "Aura System";

// --- REGRAS DE PERMISSÃO POR PLANO ---
export const PLAN_PERMISSIONS: Record<PlanType, SystemModule[]> = {
    // Basic: Plano Expirado. Vê tudo para não perder histórico, mas Context bloqueia escrita (Read Only)
    basic: ['online_booking', 'financial', 'support', 'crm', 'ai_features', 'multi_user', 'reports', 'inventory'],
    // Free: Agora é TRIAL (15 dias) - Acesso Total
    free: ['online_booking', 'financial', 'support', 'crm', 'ai_features', 'multi_user', 'reports', 'inventory'],
    starter: ['online_booking', 'financial', 'support', 'inventory'],
    pro: ['online_booking', 'financial', 'support', 'crm', 'ai_features', 'inventory'],
    clinic: ['online_booking', 'financial', 'support', 'crm', 'ai_features', 'multi_user', 'reports', 'inventory'],
    // Premium: Acesso Total (Plano Máximo)
    premium: ['online_booking', 'financial', 'support', 'crm', 'ai_features', 'multi_user', 'reports', 'inventory']
};

export const PAYMENT_METHODS_LIST = [
    { id: 'money', label: 'Dinheiro' },
    { id: 'credit_card', label: 'Cartão de Crédito' },
    { id: 'debit_card', label: 'Cartão de Débito' },
    { id: 'check', label: 'Cheque' },
    { id: 'bank_transfer', label: 'Transferência Bancária' },
    { id: 'deposit', label: 'Depósito' },
    { id: 'pix', label: 'Pix' },
];

export const PAYMENT_LABELS: Record<string, string> = PAYMENT_METHODS_LIST.reduce((acc, item) => {
    acc[item.id] = item.label;
    return acc;
}, {} as Record<string, string>);

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
    scheduled: 'Agendado',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    canceled: 'Cancelado',
    pending_approval: 'Pendente'
};

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
    monday: { isOpen: true, start: '08:00', end: '18:00' },
    tuesday: { isOpen: true, start: '08:00', end: '18:00' },
    wednesday: { isOpen: true, start: '08:00', end: '18:00' },
    thursday: { isOpen: true, start: '08:00', end: '18:00' },
    friday: { isOpen: true, start: '08:00', end: '18:00' },
    saturday: { isOpen: true, start: '09:00', end: '13:00' },
    sunday: { isOpen: false, start: '00:00', end: '00:00' }
};

// --- PLANOS SAAS ---
export const DEFAULT_PLANS: SaasPlan[] = [
    { 
        id: 'starter', 
        name: 'Starter', 
        price: 89.00, 
        features: [
            'Agenda Inteligente', 
            'Prontuário Digital', 
            'Até 200 Pacientes', 
            'Financeiro Básico',
            'Gestão de Estoque'
        ], 
        active: true,
        stripePaymentLink: ''
    },
    { 
        id: 'pro', 
        name: 'Profissional', 
        price: 197.00, 
        features: [
            'Tudo do Starter', 
            'Pacientes Ilimitados', 
            'Fotos Antes/Depois', 
            'WhatsApp Automatizado',
            'Aura AI (50 créditos)'
        ], 
        active: true,
        stripePaymentLink: ''
    },
    { 
        id: 'clinic', 
        name: 'Clinic', 
        price: 397.00, 
        features: [
            'Múltiplos Profissionais', 
            'Gestão de Comissões',
            'Aura AI Ilimitado',
            'API de Integração',
            'Gerente de Conta'
        ], 
        active: true,
        stripePaymentLink: ''
    },
];

// --- CATEGORIAS DE TRANSAÇÕES ---
export const TRANSACTION_CATEGORIES = {
    income: ['Procedimentos', 'Produtos', 'Pacotes', 'Outros'],
    expense: ['Aluguel', 'Salários', 'Insumos', 'Marketing', 'Utilidades', 'Materiais', 'Manutenção', 'Outros']
};

// --- ROLES DISPLAY ---
export const ROLE_LABELS: Record<string, string> = {
    OWNER: 'Proprietário SaaS',
    ADMIN: 'Administrador',
    ESTHETICIAN: 'Profissional',
    RECEPTIONIST: 'Recepcionista'
};

// --- STATUS LABELS ---
export const PATIENT_STATUS_LABELS: Record<string, string> = {
    active: 'Ativo',
    inactive: 'Inativo',
    lead: 'Lead'
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
    active: 'Ativo',
    trial: 'Trial',
    overdue: 'Vencido',
    canceled: 'Cancelado'
};
