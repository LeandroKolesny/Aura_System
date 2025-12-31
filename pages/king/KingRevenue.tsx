import React, { useState, useEffect } from 'react';
import {
  DollarSign, Building, RefreshCw, AlertTriangle, TrendingUp,
  CreditCard, Calendar, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp,
  Wallet, PiggyBank, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { kingApi } from '../../services/api';
import { formatCurrency } from '../../utils/formatUtils';

interface Company {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  _count: {
    patients: number;
    appointments: number;
    users: number;
  };
}

// Preços dos planos
const PLAN_PRICES: Record<string, number> = {
  FREE: 0,
  BASIC: 97,
  PROFESSIONAL: 197,
  PREMIUM: 297,
  ENTERPRISE: 497,
};

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  FREE: { bg: 'bg-slate-100', text: 'text-slate-600' },
  BASIC: { bg: 'bg-blue-100', text: 'text-blue-700' },
  PROFESSIONAL: { bg: 'bg-purple-100', text: 'text-purple-700' },
  PREMIUM: { bg: 'bg-amber-100', text: 'text-amber-700' },
  ENTERPRISE: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle, label: 'Ativo' },
  TRIAL: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock, label: 'Trial' },
  OVERDUE: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle, label: 'Inadimplente' },
  CANCELED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Cancelado' },
};

const KingRevenue: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await kingApi.companies({ limit: 200 });
      const apiData = response.data as { success: boolean; data: { companies: Company[] } };

      if (response.success && apiData?.success && apiData?.data) {
        setCompanies(apiData.data.companies);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calcular métricas
  const activeCompanies = companies.filter(c => c.subscriptionStatus === 'ACTIVE');
  const trialCompanies = companies.filter(c => c.subscriptionStatus === 'TRIAL');
  const overdueCompanies = companies.filter(c => c.subscriptionStatus === 'OVERDUE');
  const canceledCompanies = companies.filter(c => c.subscriptionStatus === 'CANCELED');

  // MRR atual (apenas ativos)
  const currentMRR = activeCompanies.reduce((acc, c) => {
    return acc + (PLAN_PRICES[c.plan] || 0);
  }, 0);

  // MRR potencial (trial que pode converter)
  const potentialMRR = trialCompanies.reduce((acc, c) => {
    return acc + (PLAN_PRICES[c.plan] || 0);
  }, 0);

  // MRR perdido (cancelados)
  const lostMRR = canceledCompanies.reduce((acc, c) => {
    return acc + (PLAN_PRICES[c.plan] || 0);
  }, 0);

  // MRR em risco (inadimplentes)
  const atRiskMRR = overdueCompanies.reduce((acc, c) => {
    return acc + (PLAN_PRICES[c.plan] || 0);
  }, 0);

  // ARR (Annual Recurring Revenue)
  const currentARR = currentMRR * 12;

  // Agrupar por plano
  const companiesByPlan = companies.reduce((acc, c) => {
    const plan = c.plan || 'FREE';
    if (!acc[plan]) acc[plan] = [];
    acc[plan].push(c);
    return acc;
  }, {} as Record<string, Company[]>);

  // Próximos vencimentos (próximos 30 dias)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingRenewals = companies
    .filter(c => {
      if (!c.subscriptionExpiresAt) return false;
      const expDate = new Date(c.subscriptionExpiresAt);
      return expDate >= now && expDate <= thirtyDaysFromNow && c.subscriptionStatus === 'ACTIVE';
    })
    .sort((a, b) => new Date(a.subscriptionExpiresAt!).getTime() - new Date(b.subscriptionExpiresAt!).getTime());

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const getDaysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-500" />
            Receita e Assinaturas
          </h1>
          <p className="text-slate-500 mt-1">Visão financeira das assinaturas do Aura System</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">MRR Atual</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(currentMRR)}</p>
                  <p className="text-emerald-200 text-xs mt-2">{activeCompanies.length} assinaturas ativas</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Wallet className="w-8 h-8" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">ARR Projetado</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(currentARR)}</p>
                  <p className="text-blue-200 text-xs mt-2">Receita anual recorrente</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <PiggyBank className="w-8 h-8" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">MRR Potencial</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(potentialMRR)}</p>
                  <p className="text-blue-600 text-xs mt-2 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    {trialCompanies.length} em trial
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">MRR em Risco</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(atRiskMRR)}</p>
                  <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3" />
                    {overdueCompanies.length} inadimplentes
                  </p>
                </div>
                <div className="p-3 bg-amber-100 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Status das Assinaturas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribuição por Status */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-400" />
                Status das Assinaturas
              </h3>
              <div className="space-y-3">
                {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                  const count = companies.filter(c => c.subscriptionStatus === status).length;
                  const percentage = companies.length > 0 ? (count / companies.length) * 100 : 0;
                  const Icon = config.icon;

                  return (
                    <div key={status} className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <Icon className={`w-4 h-4 ${config.text}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-slate-700">{config.label}</span>
                          <span className="text-sm text-slate-500">{count} empresas</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${config.bg.replace('100', '500')}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Próximos Vencimentos */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-400" />
                Próximos Vencimentos (30 dias)
              </h3>
              {upcomingRenewals.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhum vencimento nos próximos 30 dias
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {upcomingRenewals.map(company => {
                    const daysUntil = getDaysUntil(company.subscriptionExpiresAt!);
                    const isUrgent = daysUntil <= 7;

                    return (
                      <div
                        key={company.id}
                        className={`p-3 rounded-lg border ${isUrgent ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-slate-800">{company.name}</p>
                            <p className="text-xs text-slate-500">/{company.slug}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${isUrgent ? 'text-amber-600' : 'text-slate-600'}`}>
                              {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `${daysUntil} dias`}
                            </p>
                            <p className="text-xs text-slate-400">{formatDate(company.subscriptionExpiresAt!)}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-between items-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[company.plan]?.bg} ${PLAN_COLORS[company.plan]?.text}`}>
                            {company.plan}
                          </span>
                          <span className="text-sm font-medium text-emerald-600">
                            {formatCurrency(PLAN_PRICES[company.plan] || 0)}/mês
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Receita por Plano */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-400" />
                Receita por Plano
              </h3>
            </div>

            <div className="divide-y divide-slate-100">
              {Object.entries(PLAN_PRICES)
                .filter(([plan]) => plan !== 'FREE')
                .map(([plan, price]) => {
                  const planCompanies = companiesByPlan[plan] || [];
                  const activeInPlan = planCompanies.filter(c => c.subscriptionStatus === 'ACTIVE');
                  const planMRR = activeInPlan.length * price;
                  const isExpanded = expandedPlan === plan;

                  return (
                    <div key={plan}>
                      <div
                        onClick={() => setExpandedPlan(isExpanded ? null : plan)}
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <span className={`px-3 py-1 rounded-lg text-sm font-bold ${PLAN_COLORS[plan]?.bg} ${PLAN_COLORS[plan]?.text}`}>
                            {plan}
                          </span>
                          <div>
                            <p className="font-medium text-slate-800">{formatCurrency(price)}/mês por assinatura</p>
                            <p className="text-xs text-slate-500">
                              {activeInPlan.length} ativas de {planCompanies.length} total
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">{formatCurrency(planMRR)}</p>
                            <p className="text-xs text-slate-400">MRR do plano</p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Empresas do Plano (Expandido) */}
                      {isExpanded && planCompanies.length > 0 && (
                        <div className="bg-slate-50 border-t border-slate-100 p-4">
                          <table className="w-full">
                            <thead>
                              <tr className="text-xs font-bold text-slate-500 uppercase">
                                <th className="text-left pb-2">Empresa</th>
                                <th className="text-left pb-2">Status</th>
                                <th className="text-left pb-2">Vencimento</th>
                                <th className="text-right pb-2">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {planCompanies.map(company => {
                                const statusConfig = STATUS_CONFIG[company.subscriptionStatus] || STATUS_CONFIG.CANCELED;
                                const StatusIcon = statusConfig.icon;

                                return (
                                  <tr key={company.id} className="text-sm">
                                    <td className="py-2">
                                      <p className="font-medium text-slate-800">{company.name}</p>
                                      <p className="text-xs text-slate-400">/{company.slug}</p>
                                    </td>
                                    <td className="py-2">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {statusConfig.label}
                                      </span>
                                    </td>
                                    <td className="py-2 text-slate-600">
                                      {company.subscriptionExpiresAt
                                        ? formatDate(company.subscriptionExpiresAt)
                                        : '-'
                                      }
                                    </td>
                                    <td className="py-2 text-right font-medium text-emerald-600">
                                      {company.subscriptionStatus === 'ACTIVE'
                                        ? formatCurrency(price)
                                        : <span className="text-slate-400">-</span>
                                      }
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Resumo Financeiro */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider">Total Empresas</p>
                <p className="text-2xl font-bold mt-1">{companies.length}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider">Taxa de Conversão</p>
                <p className="text-2xl font-bold mt-1">
                  {companies.length > 0
                    ? `${Math.round((activeCompanies.length / companies.length) * 100)}%`
                    : '0%'
                  }
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider">Ticket Médio</p>
                <p className="text-2xl font-bold mt-1">
                  {activeCompanies.length > 0
                    ? formatCurrency(currentMRR / activeCompanies.length)
                    : formatCurrency(0)
                  }
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider">Churn Rate</p>
                <p className="text-2xl font-bold mt-1">
                  {companies.length > 0
                    ? `${Math.round((canceledCompanies.length / companies.length) * 100)}%`
                    : '0%'
                  }
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default KingRevenue;
