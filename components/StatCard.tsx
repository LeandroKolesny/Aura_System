import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, trend, icon: Icon, color, subtitle }) => (
  <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
    <div className="flex items-center justify-between mb-3 lg:mb-4">
      <div className={`p-2 lg:p-3 rounded-lg ${color} bg-opacity-10 transition-colors group-hover:bg-opacity-20`}>
        <Icon className={`w-5 h-5 lg:w-6 lg:h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      {trend && (
        <span className={`text-[10px] lg:text-xs font-bold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {trend}
        </span>
      )}
    </div>
    <h3 className="text-slate-500 text-[10px] lg:text-xs font-bold uppercase tracking-wider">{title}</h3>
    <div className="flex items-baseline gap-1 lg:gap-2 mt-1">
      <p className="text-xl lg:text-2xl font-bold text-slate-800 tracking-tight">{value.toString()}</p>
      {subtitle && <span className="text-[9px] lg:text-[10px] text-slate-400 font-medium">{subtitle}</span>}
    </div>
  </div>
);

export default StatCard;