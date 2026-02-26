import React, { useState, useEffect } from 'react';
import {
  CalendarCheck, Building, RefreshCw, AlertTriangle,
  ChevronDown, ChevronUp, User, Clock, Filter
} from 'lucide-react';
import { kingApi } from '../../services/api';
import { formatCurrency } from '../../utils/formatUtils';

interface Appointment {
  id: string;
  date: string;
  durationMinutes: number;
  price: number;
  status: string;
  notes: string | null;
  patient: { id: string; name: string };
  professional: { id: string; name: string };
  procedure: { id: string; name: string };
  company: { id: string; name: string; slug: string };
}

interface Company {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  _count: {
    patients: number;
    appointments: number;
    users: number;
  };
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Agendado' },
    CONFIRMED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Confirmado' },
    COMPLETED: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Concluído' },
    CANCELED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelado' },
    PENDING_APPROVAL: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pendente' },
  };

  const { bg, text, label } = config[status] || { bg: 'bg-slate-100', text: 'text-slate-600', label: status };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
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
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[plan] || colors.FREE}`}>
      {plan}
    </span>
  );
};

const KingAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateFilter) {
      case 'today':
        return {
          startDate: today.toISOString(),
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        };
      case 'week':
        return {
          startDate: today.toISOString(),
          endDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
      case 'month':
        return {
          startDate: today.toISOString(),
          endDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
      default:
        return {};
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const dateRange = getDateRange();

      // Carregar empresas e agendamentos em paralelo
      const [companiesRes, appointmentsRes] = await Promise.all([
        kingApi.companies({ limit: 100 }),
        kingApi.appointments({
          limit: 500,
          status: statusFilter,
          ...dateRange,
        }),
      ]);

      const companiesData = companiesRes.data as { success: boolean; data: { companies: Company[] } };
      const appointmentsData = appointmentsRes.data as { success: boolean; data: { appointments: Appointment[] } };

      if (companiesRes.success && companiesData?.success && companiesData?.data) {
        setCompanies(companiesData.data.companies);
      }

      if (appointmentsRes.success && appointmentsData?.success && appointmentsData?.data) {
        setAppointments(appointmentsData.data.appointments);
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
  }, [statusFilter, dateFilter]);

  const toggleSection = (companyId: string) => {
    setExpandedSections(prev =>
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const expandAll = () => {
    setExpandedSections(companies.map(c => c.id));
  };

  const collapseAll = () => {
    setExpandedSections([]);
  };

  // Agrupar agendamentos por empresa
  const getCompanyAppointments = (companyId: string) => {
    return appointments.filter(a => a.company.id === companyId);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  // Calcular totais
  const totalAppointments = appointments.length;
  const totalRevenue = appointments.reduce((acc, a) => acc + Number(a.price), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <CalendarCheck className="w-8 h-8 text-amber-500" />
            Agendamentos por Clínica
          </h1>
          <p className="text-slate-500 mt-1">Visão global de agendamentos agrupados por clínica</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Total de Agendamentos</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalAppointments.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Clínicas</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{companies.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Valor Total</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Período</p>
          <p className="text-lg font-medium text-slate-700 mt-1">
            {dateFilter === 'all' ? 'Todos' : dateFilter === 'today' ? 'Hoje' : dateFilter === 'week' ? 'Semana' : 'Mês'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Período:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'today', label: 'Hoje' },
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mês' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateFilter(opt.value as any)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dateFilter === opt.value
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">Todos os Status</option>
          <option value="SCHEDULED">Agendados</option>
          <option value="CONFIRMED">Confirmados</option>
          <option value="COMPLETED">Concluídos</option>
          <option value="CANCELED">Cancelados</option>
          <option value="PENDING_APPROVAL">Pendentes</option>
        </select>

        <div className="flex-1" />

        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
          >
            Expandir Tudo
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
          >
            Recolher Tudo
          </button>
        </div>
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
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : (
        /* Companies Accordion */
        <div className="space-y-4">
          {companies.map(company => {
            const companyAppointments = getCompanyAppointments(company.id);
            const isExpanded = expandedSections.includes(company.id);
            const companyRevenue = companyAppointments.reduce((acc, a) => acc + Number(a.price), 0);

            // Se não tem agendamentos nessa empresa com os filtros atuais, mostrar zerado
            return (
              <div
                key={company.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
              >
                {/* Company Header */}
                <div
                  onClick={() => toggleSection(company.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Building className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        {company.name}
                        <PlanBadge plan={company.plan} />
                      </h3>
                      <p className="text-xs text-slate-400">/{company.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
                      {companyAppointments.length} agendamentos
                    </span>
                    <span className="text-emerald-600 font-medium text-sm">
                      {formatCurrency(companyRevenue)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Appointments Table (Expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-200 animate-fade-in">
                    {companyAppointments.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        Nenhum agendamento encontrado nesta clínica.
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Data/Hora</th>
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Paciente</th>
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Procedimento</th>
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Profissional</th>
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                            <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {companyAppointments.map((appt) => {
                            const { date, time } = formatDateTime(appt.date);
                            return (
                              <tr key={appt.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div>
                                    <p className="font-medium text-slate-900">{date}</p>
                                    <p className="text-sm text-slate-500 flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {time} ({appt.durationMinutes}min)
                                    </p>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="font-medium text-slate-900">{appt.patient.name}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-sm text-slate-700">{appt.procedure.name}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-sm text-slate-600 flex items-center gap-1">
                                    <User className="w-3 h-3" /> {appt.professional.name}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  <StatusBadge status={appt.status} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className="font-medium text-emerald-600">{formatCurrency(appt.price)}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {companies.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              Nenhuma empresa cadastrada.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KingAppointments;
