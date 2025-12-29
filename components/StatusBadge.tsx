import React from 'react';
import { APPOINTMENT_VISUAL_CONFIG, FINANCIAL_VISUAL_CONFIG } from '../utils/statusUtils';

interface StatusBadgeProps {
  status: string;
  type?: 'appointment' | 'financial';
  showIcon?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'appointment', showIcon = false }) => {
  const config = type === 'appointment' 
    ? APPOINTMENT_VISUAL_CONFIG[status] 
    : FINANCIAL_VISUAL_CONFIG[status];

  if (!config) return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">{status}</span>;

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${config.bg} ${config.text} ${config.border}`}>
      {showIcon && <Icon className="w-3 h-3" />}
      {config.label || status}
    </span>
  );
};

export default StatusBadge;