import React, { useState, useEffect } from 'react';
import {
  Users, Building, RefreshCw, AlertTriangle,
  Search, ChevronDown, ChevronUp, Mail, Phone, ChevronLeft, ChevronRight
} from 'lucide-react';
import { kingApi } from '../../services/api';

interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  birthDate: string | null;
  lastVisit: string | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
  };
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
    ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ativo' },
    INACTIVE: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Inativo' },
    LEAD: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Lead' },
  };

  const { bg, text, label } = config[status] || config.INACTIVE;

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

const KingPatients: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Carregar empresas e pacientes em paralelo
      const [companiesRes, patientsRes] = await Promise.all([
        kingApi.companies({ limit: 100 }),
        kingApi.patients({ limit: 500 }),
      ]);

      const companiesData = companiesRes.data as { success: boolean; data: { companies: Company[] } };
      const patientsData = patientsRes.data as { success: boolean; data: { patients: Patient[] } };

      if (companiesRes.success && companiesData?.success && companiesData?.data) {
        setCompanies(companiesData.data.companies);
      }

      if (patientsRes.success && patientsData?.success && patientsData?.data) {
        setPatients(patientsData.data.patients);
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

  // Filtrar pacientes por busca
  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  );

  // Agrupar pacientes por empresa
  const getCompanyPatients = (companyId: string) => {
    return filteredPatients.filter(p => p.company.id === companyId);
  };

  // Total de pacientes encontrados
  const totalFiltered = filteredPatients.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-500" />
            Pacientes por Clínica
          </h1>
          <p className="text-slate-500 mt-1">Visão global de pacientes agrupados por clínica</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Total de Pacientes</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{patients.length.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Clínicas</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{companies.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Encontrados</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{totalFiltered.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>
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
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      ) : (
        /* Companies Accordion */
        <div className="space-y-4">
          {companies.map(company => {
            const companyPatients = getCompanyPatients(company.id);
            const isExpanded = expandedSections.includes(company.id);

            // Se tem busca e não tem resultados nessa empresa, esconde
            if (search && companyPatients.length === 0) return null;

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
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                      {companyPatients.length} pacientes
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Patients Table (Expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-200 animate-fade-in">
                    {companyPatients.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        Nenhum paciente encontrado nesta clínica.
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Paciente</th>
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Contato</th>
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Última Visita</th>
                            <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Cadastro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {companyPatients.map((patient) => (
                            <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">
                                    {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <span className="font-medium text-slate-900">{patient.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-1">
                                  <p className="text-sm text-slate-600 flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> {patient.email}
                                  </p>
                                  <p className="text-sm text-slate-500 flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {patient.phone}
                                  </p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <StatusBadge status={patient.status} />
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-500">
                                {patient.lastVisit
                                  ? new Date(patient.lastVisit).toLocaleDateString('pt-BR')
                                  : <span className="text-slate-400">-</span>
                                }
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-500">
                                {new Date(patient.createdAt).toLocaleDateString('pt-BR')}
                              </td>
                            </tr>
                          ))}
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

export default KingPatients;
