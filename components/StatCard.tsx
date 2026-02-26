import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}

// Deriva cor de texto e gradiente a partir da classe bg-*
const deriveColors = (color: string) => {
  const map: Record<string, { text: string; from: string; to: string; ring: string }> = {
    'bg-emerald-500': { text: 'text-emerald-600', from: 'from-emerald-400', to: 'to-emerald-600', ring: 'ring-emerald-100' },
    'bg-emerald-600': { text: 'text-emerald-700', from: 'from-emerald-500', to: 'to-emerald-700', ring: 'ring-emerald-100' },
    'bg-primary-500': { text: 'text-primary-600', from: 'from-primary-400', to: 'to-primary-600', ring: 'ring-primary-100' },
    'bg-primary-50':  { text: 'text-primary-600', from: 'from-primary-400', to: 'to-primary-600', ring: 'ring-primary-100' },
    'bg-blue-500':    { text: 'text-blue-600',    from: 'from-blue-400',    to: 'to-blue-600',    ring: 'ring-blue-100'    },
    'bg-blue-600':    { text: 'text-blue-700',    from: 'from-blue-500',    to: 'to-blue-700',    ring: 'ring-blue-100'    },
    'bg-indigo-500':  { text: 'text-indigo-600',  from: 'from-indigo-400',  to: 'to-indigo-600',  ring: 'ring-indigo-100'  },
    'bg-purple-600':  { text: 'text-purple-700',  from: 'from-purple-500',  to: 'to-purple-700',  ring: 'ring-purple-100'  },
  };
  return map[color] ?? { text: 'text-slate-600', from: 'from-slate-400', to: 'to-slate-600', ring: 'ring-slate-100' };
};

const StatCard: React.FC<StatCardProps> = ({ title, value, trend, icon: Icon, color, subtitle }) => {
  const { text, from, to, ring } = deriveColors(color);

  return (
    <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden">
      {/* Linha decorativa no topo */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${from} ${to} opacity-60`} />

      <div className="flex items-start justify-between mb-4">
        {/* Ícone com gradiente */}
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${from} ${to} shadow-sm ring-4 ${ring}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
            {trend}
          </span>
        )}
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-1">{title}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl lg:text-4xl font-serif font-bold text-secondary-900 leading-none tracking-tight">
          {value.toString()}
        </p>
        {subtitle && <span className="text-[10px] text-slate-400 font-medium">{subtitle}</span>}
      </div>
    </div>
  );
};

export default StatCard;
