import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label?: string;
  };
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  default: {
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    accent: 'bg-slate-500'
  },
  success: {
    bg: 'bg-emerald-50/50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    accent: 'bg-emerald-500'
  },
  warning: {
    bg: 'bg-amber-50/50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    accent: 'bg-amber-500'
  },
  danger: {
    bg: 'bg-rose-50/50',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    accent: 'bg-rose-500'
  },
  primary: {
    bg: 'bg-primary-50/50',
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
    accent: 'bg-primary-500'
  }
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  variant = 'default',
  size = 'md'
}) => {
  const styles = variantStyles[variant];
  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;
  const isNeutral = !trend || trend.value === 0;

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  
  const sizeStyles = {
    sm: { container: 'p-4', value: 'text-xl', icon: 'w-4 h-4' },
    md: { container: 'p-5', value: 'text-2xl', icon: 'w-5 h-5' },
    lg: { container: 'p-6', value: 'text-3xl', icon: 'w-6 h-6' }
  };

  return (
    <div className={`relative bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group ${sizeStyles[size].container}`}>
      {/* Accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${styles.accent} opacity-80`} />
      
      <div className="flex items-start justify-between mb-3">
        <div className={`${styles.iconBg} p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110`}>
          <Icon className={`${sizeStyles[size].icon} ${styles.iconColor}`} />
        </div>
        
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
            isPositive ? 'bg-emerald-100 text-emerald-700' : 
            isNegative ? 'bg-rose-100 text-rose-700' : 
            'bg-slate-100 text-slate-600'
          }`}>
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</h4>
        <p className={`${sizeStyles[size].value} font-bold text-slate-900 tracking-tight leading-none`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-1.5">{subtitle}</p>
        )}
        {trend?.label && (
          <p className="text-[10px] text-slate-400 mt-1">{trend.label}</p>
        )}
      </div>
    </div>
  );
};

