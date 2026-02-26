import React, { useState, useEffect } from 'react';
import {
  Building, Users, CalendarCheck, RefreshCw, AlertTriangle,
  Search, ChevronLeft, ChevronRight, ExternalLink, CheckCircle, XCircle, Clock
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

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
    TRIAL: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
    OVERDUE: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
    CANCELED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  };

  const { bg, text, icon: Icon } = config[status] || config.CANCELED;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
};

const PlanBadge: React.FC<{ plan: string }> = ({ plan }) => {
  const colors: Record<string, string> = {
    FREE: 'bg-slate-100 text-slate-600',
    BASIC: 'bg-blue-100 text-blue-700',
    PROFESSIONAL: 'bg-purple-100 text-purple-700',
    PREMIUM: 'bg-amber-100 text-amber-700',
    ENTERPRISE: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${colors[plan] || colors.FREE}`}>
      {plan}
    </span>
  );
};

const KingCompanies: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const loadCompanies = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await kingApi.companies({ page, limit, search, status: statusFilter });
      const apiData = response.data as { success: boolean; data: { companies: Company[]; total: number } };

      if (response.success && apiData?.success && apiData?.data) {
        setCompanies(apiData.data.companies);
        setTotal(apiData.data.total);
      } else {
        setError('Erro ao carregar empresas');
      }
    } catch (err) {
      console.error('Error loading companies:', err);
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [page, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadCompanies();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Building className="w-8 h-8 text-blue-500" />
            Empresas
          </h1>
          <p className="text-slate-500 mt-1">Gerenciar todas as clínicas cadastradas</p>
        </div>
        <button
          onClick={loadCompanies}
          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome ou slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todos os Status</option>
          <option value="ACTIVE">Ativas</option>
          <option value="TRIAL">Trial</option>
          <option value="OVERDUE">Inadimplentes</option>
          <option value="CANCELED">Canceladas</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Nenhuma empresa encontrada
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Empresa</th>
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Plano</th>
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="text-center px-6 py-3 text-xs font-bold text-slate-500 uppercase">Usuários</th>
                <th className="text-center px-6 py-3 text-xs font-bold text-slate-500 uppercase">Pacientes</th>
                <th className="text-center px-6 py-3 text-xs font-bold text-slate-500 uppercase">Agendamentos</th>
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Criada em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{company.name}</p>
                      <p className="text-xs text-slate-400">/{company.slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <PlanBadge plan={company.plan} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={company.subscriptionStatus} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <Users className="w-4 h-4" />
                      {company._count.users}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-medium text-slate-900">{company._count.patients}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-medium text-slate-900">{company._count.appointments}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(company.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, total)} de {total} empresas
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-sm font-medium">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KingCompanies;
