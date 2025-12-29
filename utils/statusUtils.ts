import { CheckCircle, Clock, AlertTriangle, XCircle, Info, LucideIcon } from 'lucide-react';

export interface VisualConfig {
  bg: string;
  border: string;
  text: string;
  icon: LucideIcon;
  label?: string;
}

// Configuração para os Alertas de Sistema (Dashboard)
export const ALERT_VISUAL_CONFIG: Record<string, VisualConfig> = {
  success: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-800', icon: CheckCircle },
  warning: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-800', icon: AlertTriangle },
  error: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-800', icon: XCircle },
  info: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-800', icon: Info },
};

// Configuração para Status de Agendamento (Alinhado com o design original do calendário)
export const APPOINTMENT_VISUAL_CONFIG: Record<string, VisualConfig> = {
  scheduled: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-700', icon: Clock, label: 'Agendado' },
  confirmed: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: CheckCircle, label: 'Confirmado' },
  pending_approval: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: Clock, label: 'Pendente' },
  completed: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: CheckCircle, label: 'Concluído' },
  canceled: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700', icon: XCircle, label: 'Cancelado' },
};

// Configuração para Status Financeiro
export const FINANCIAL_VISUAL_CONFIG: Record<string, VisualConfig> = {
  paid: { bg: 'bg-green-100', border: 'border-green-200', text: 'text-green-800', icon: CheckCircle, label: 'Pago' },
  pending: { bg: 'bg-amber-100', border: 'border-amber-200', text: 'text-amber-800', icon: Clock, label: 'Pendente' },
  overdue: { bg: 'bg-red-100', border: 'border-red-200', text: 'text-red-800', icon: AlertTriangle, label: 'Atrasado' },
};
