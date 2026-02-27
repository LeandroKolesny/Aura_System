import React, { useState, useEffect } from 'react';
import {
  Building, Users, CalendarCheck, RefreshCw, AlertTriangle,
  Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, UserCheck
} from 'lucide-react';
import { kingApi } from '../../services/api';

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

const CompanyCard: React.FC<{ company: Company }> = ({ company }) => {
  const expiresAt = company.subscriptionExpiresAt
    ? new Date(company.subscriptionExpiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Sem data';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-amber-100 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 font-bold text-lg flex items-center justify-center shrink-0">
          {company.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif font-bold text-slate-900 text-lg leading-tight truncate">{company.name}</p>
          <p className="text-xs text-slate-400 truncate">{company.slug}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <PlanBadge plan={company.plan} />
        <StatusBadge status={company.subscriptionStatus} />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { icon: Users, label: 'Pacientes', value: company._count.patients },
          { icon: CalendarCheck, label: 'Agend.', value: company._count.appointments },
          { icon: UserCheck, label: 'Usuários', value: company._count.users },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="text-center p-2 bg-slate-50 rounded-xl">
            <Icon className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-slate-800">{value}</p>
            <p className="text-[10px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Expiração */}
      <p className="text-xs text-slate-400 border-t border-slate-50 pt-2 mt-1">
        Expira: <span className="text-slate-600 font-medium">{expiresAt}</span>
      </p>
    </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {companies.map(company => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
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
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-sm font-medium">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
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
