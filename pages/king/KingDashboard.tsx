import React, { useState, useEffect } from 'react';
import {
  Building, Users, CalendarCheck, DollarSign, TrendingUp,
  Crown, RefreshCw, AlertTriangle, CheckCircle, Clock
} from 'lucide-react';
import { kingApi } from '../../services/api';
import { formatCurrency } from '../../utils/formatUtils';

interface GlobalStats {
  totalCompanies: number;
  activeCompanies: number;
  totalPatients: number;
  totalAppointments: number;
  todayAppointments: number;
  monthlyRevenue: number;
  mrr: number;
  companiesByPlan: Record<string, number>;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}> = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

const PlanBadge: React.FC<{ plan: string; count: number }> = ({ plan, count }) => {
  const colors: Record<string, string> = {
    FREE: 'bg-slate-100 text-slate-600',
    STARTER: 'bg-blue-100 text-blue-700',
    PRO: 'bg-purple-100 text-purple-700',
    CLINIC: 'bg-green-100 text-green-700',
    PREMIUM: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className={`px-3 py-2 rounded-lg ${colors[plan] || 'bg-slate-100 text-slate-600'} flex items-center justify-between`}>
      <span className="font-medium text-sm">{plan}</span>
      <span className="font-bold ml-2">{count}</span>
    </div>
  );
};

const KingDashboard: React.FC = () => {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await kingApi.dashboard();
      console.log('📊 King Dashboard API Response:', response);

      // A resposta da API vem em response.data (por causa do fetchApi wrapper)
      // E dentro dela temos { success, data } da API real
      const apiData = response.data as { success: boolean; data: GlobalStats; error?: string };

      if (response.success && apiData?.success && apiData?.data) {
        console.log('✅ Stats carregados:', apiData.data);
        setStats(apiData.data);
      } else {
        setError(apiData?.error || response.error || 'Erro ao carregar dados');
      }
    } catch (err) {
      console.error('❌ King Dashboard Error:', err);
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-700 font-medium">{error}</p>
        <button
          onClick={loadStats}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Crown className="w-8 h-8 text-amber-500" />
            King Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Visão global do Aura System</p>
        </div>
        <button
          onClick={loadStats}
          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Receita Recorrente (MRR)"
          value={formatCurrency(stats.mrr || 0)}
          icon={DollarSign}
          color="bg-emerald-600"
          subtitle="Baseado nos planos ativos"
        />
        <StatCard
          title="Clínicas Ativas"
          value={`${stats.activeCompanies || 0}/${stats.totalCompanies || 0}`}
          icon={Building}
          color="bg-blue-600"
          subtitle={`${stats.totalCompanies ? Math.round((stats.activeCompanies / stats.totalCompanies) * 100) : 0}% ativas`}
        />
        <StatCard
          title="Total de Pacientes"
          value={(stats.totalPatients || 0).toLocaleString('pt-BR')}
          icon={Users}
          color="bg-purple-600"
          subtitle="Em todas as clínicas"
        />
        <StatCard
          title="Agendamentos Hoje"
          value={stats.todayAppointments || 0}
          icon={CalendarCheck}
          color="bg-amber-600"
          subtitle={`${(stats.totalAppointments || 0).toLocaleString('pt-BR')} total`}
        />
      </div>

      {/* Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Plano */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            Distribuição por Plano
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats.companiesByPlan || {}).map(([plan, count]) => (
              <PlanBadge key={plan} plan={plan} count={count as number} />
            ))}
          </div>
          {(!stats.companiesByPlan || Object.keys(stats.companiesByPlan).length === 0) && (
            <p className="text-slate-400 text-sm text-center py-4">Nenhuma empresa cadastrada</p>
          )}
        </div>

        {/* Receita do Mês */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-slate-400" />
            Receita Operacional do Mês
          </h3>
          <div className="text-center py-8">
            <p className="text-4xl font-bold text-emerald-600">
              {formatCurrency(stats.monthlyRevenue || 0)}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Soma de todas as transações INCOME pagas
            </p>
          </div>
        </div>
      </div>

      {/* Status do Sistema */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-full">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Sistema Operacional</h3>
              <p className="text-slate-400 text-sm">Todas as APIs respondendo normalmente</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Última atualização</p>
            <p className="text-sm font-medium flex items-center gap-1 justify-end">
              <Clock className="w-4 h-4" />
              {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KingDashboard;
