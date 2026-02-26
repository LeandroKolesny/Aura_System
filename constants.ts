// Aura System - Constantes do Sistema
// Apenas constantes e configurações, SEM dados mock
// IMPORTANTE: Dados de planos (permissões, limites, preços) vêm do banco de dados via API

import { BusinessHours } from './types';

export const SAAS_COMPANY_NAME = "Aura System";

// Nomes padronizados dos planos (devem corresponder ao enum Plan no Prisma)
export const PLAN_NAMES = {
    FREE: 'FREE',
    BASIC: 'BASIC',
    STARTER: 'STARTER',
    PROFESSIONAL: 'PROFESSIONAL',
    PREMIUM: 'PREMIUM',
    ENTERPRISE: 'ENTERPRISE',
} as const;

// Interface para limites de plano (vem do banco)
export interface PlanLimits {
    maxPatients: number;      // Máximo de pacientes (-1 = ilimitado)
    maxProfessionals: number; // Máximo de profissionais (-1 = ilimitado)
}

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
// NOTA: Planos são carregados do banco de dados via API /api/plans
// Não há mais DEFAULT_PLANS hardcoded

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
