import React from 'react';
import { Loader2 } from 'lucide-react';

// Elemento base de skeleton com animação
const SkeletonBase: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
);

// Linha de texto
export const SkeletonLine: React.FC<{ width?: string; height?: string }> = ({
  width = 'w-full',
  height = 'h-4'
}) => (
  <SkeletonBase className={`${width} ${height}`} />
);

// Avatar/Círculo
export const SkeletonCircle: React.FC<{ size?: string }> = ({ size = 'w-10 h-10' }) => (
  <SkeletonBase className={`${size} rounded-full`} />
);

// Card de KPI
export const SkeletonKPICard: React.FC = () => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex items-center gap-4">
      <SkeletonCircle size="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <SkeletonLine width="w-20" height="h-3" />
        <SkeletonLine width="w-28" height="h-6" />
      </div>
    </div>
  </div>
);

// Grid de 4 KPIs
export const SkeletonKPIGrid: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[1, 2, 3, 4].map(i => <SkeletonKPICard key={i} />)}
  </div>
);

// Área de gráfico
export const SkeletonChart: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <SkeletonLine width="w-40" height="h-5" />
    <div className={`mt-6 ${height} bg-slate-100 rounded-xl flex items-center justify-center`}>
      <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
    </div>
  </div>
);

// Linha de tabela
export const SkeletonTableRow: React.FC<{ cols?: number }> = ({ cols = 5 }) => (
  <tr className="border-b border-slate-100">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <SkeletonLine width={i === 0 ? 'w-32' : i === cols - 1 ? 'w-16' : 'w-24'} />
      </td>
    ))}
  </tr>
);

// Tabela completa
export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <table className="w-full">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i} className="px-6 py-3">
              <SkeletonLine width="w-20" height="h-3" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
);

// Card de ranking
export const SkeletonRankingCard: React.FC = () => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
      <div className="flex items-center gap-2.5">
        <SkeletonCircle size="w-8 h-8" />
        <SkeletonLine width="w-32" height="h-4" />
      </div>
    </div>
    <div className="divide-y divide-slate-50">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SkeletonCircle size="w-7 h-7" />
            <div className="space-y-1">
              <SkeletonLine width="w-28" height="h-4" />
              <SkeletonLine width="w-20" height="h-3" />
            </div>
          </div>
          <SkeletonLine width="w-16" height="h-4" />
        </div>
      ))}
    </div>
  </div>
);

// === SKELETONS DE PÁGINAS COMPLETAS ===

// Skeleton para página de Reports
export const ReportsSkeleton: React.FC = () => (
  <div className="space-y-8 animate-pulse">
    {/* Header */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-3">
        <SkeletonCircle size="w-12 h-12" />
        <div className="space-y-2">
          <SkeletonLine width="w-48" height="h-7" />
          <SkeletonLine width="w-32" height="h-4" />
        </div>
      </div>
      <div className="flex gap-3">
        <SkeletonBase className="w-32 h-11 rounded-xl" />
        <SkeletonBase className="w-48 h-11 rounded-xl" />
      </div>
    </div>

    {/* KPIs */}
    <SkeletonKPIGrid />

    {/* Gráficos */}
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-1">
        <SkeletonBase className="w-full h-80 rounded-2xl" />
      </div>
      <div className="xl:col-span-2">
        <SkeletonChart height="h-64" />
      </div>
    </div>

    {/* Rankings */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SkeletonChart height="h-48" />
      <SkeletonChart height="h-48" />
      <SkeletonChart height="h-48" />
    </div>

    {/* Tabela */}
    <SkeletonTable rows={5} cols={5} />
  </div>
);

// Skeleton para página Financial
export const FinancialSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    {/* Header */}
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <SkeletonLine width="w-56" height="h-7" />
        <SkeletonLine width="w-40" height="h-4" />
      </div>
      <div className="flex gap-4 items-center">
        <SkeletonBase className="w-28 h-10 rounded-lg" />
        <SkeletonBase className="w-36 h-16 rounded-lg" />
      </div>
    </div>

    {/* Tabela */}
    <SkeletonTable rows={8} cols={5} />
  </div>
);

// Skeleton para página de Pacientes
export const PatientsSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    {/* Header */}
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <SkeletonLine width="w-40" height="h-7" />
        <SkeletonLine width="w-56" height="h-4" />
      </div>
      <SkeletonBase className="w-36 h-10 rounded-lg" />
    </div>

    {/* Filtros */}
    <div className="flex gap-4 bg-white p-4 rounded-xl border border-slate-200">
      <SkeletonBase className="flex-1 h-10 rounded-lg" />
      <SkeletonBase className="w-32 h-10 rounded-lg" />
    </div>

    {/* Cards de pacientes */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <SkeletonCircle size="w-14 h-14" />
            <div className="flex-1 space-y-2">
              <SkeletonLine width="w-32" height="h-5" />
              <SkeletonLine width="w-24" height="h-3" />
            </div>
          </div>
          <div className="space-y-2">
            <SkeletonLine width="w-full" height="h-3" />
            <SkeletonLine width="w-3/4" height="h-3" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Skeleton para página de Procedimentos
export const ProceduresSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    {/* Header */}
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <SkeletonLine width="w-44" height="h-7" />
        <SkeletonLine width="w-64" height="h-4" />
      </div>
      <SkeletonBase className="w-40 h-10 rounded-lg" />
    </div>

    {/* Cards de procedimentos */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <SkeletonBase className="w-full h-40" />
          <div className="p-5 space-y-3">
            <SkeletonLine width="w-3/4" height="h-5" />
            <SkeletonLine width="w-full" height="h-3" />
            <div className="flex justify-between pt-2">
              <SkeletonLine width="w-20" height="h-6" />
              <SkeletonLine width="w-16" height="h-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Componente de loading central (para estados transitórios)
export const CenteredLoader: React.FC<{ message?: string; submessage?: string }> = ({
  message = 'Carregando...',
  submessage
}) => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
      <p className="text-slate-500">{message}</p>
      {submessage && <p className="text-xs text-slate-400 mt-1">{submessage}</p>}
    </div>
  </div>
);

// Export all
export default {
  Line: SkeletonLine,
  Circle: SkeletonCircle,
  KPICard: SkeletonKPICard,
  KPIGrid: SkeletonKPIGrid,
  Chart: SkeletonChart,
  Table: SkeletonTable,
  TableRow: SkeletonTableRow,
  RankingCard: SkeletonRankingCard,
  // Page Skeletons
  Reports: ReportsSkeleton,
  Financial: FinancialSkeleton,
  Patients: PatientsSkeleton,
  Procedures: ProceduresSkeleton,
  // Loader
  CenteredLoader,
};
