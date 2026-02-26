
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Phone, Mail, Building, Edit, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NewPatientModal } from '../components/Modals';
import { UserRole, Patient } from '../types';
import { PatientsSkeleton } from '../components/LoadingSkeleton';

const Patients: React.FC = () => {
  const { patients, user, companies, removePatient, isReadOnly, loadPatients, loadingStates } = useApp();

  // Lazy loading: carregar pacientes quando a página montar
  useEffect(() => {
    loadPatients();
  }, [loadPatients]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Alterado para rastrear seções ABERTAS. Inicialmente vazio = tudo fechado.
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const navigate = useNavigate();

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isOwner = user?.role === UserRole.OWNER;

  const handleEdit = (patient: Patient) => {
    // Navega para a página de detalhes com o estado de edição ativado
    // Se isReadOnly, a página de detalhes deve tratar o bloqueio
    navigate(`/patients/${patient.id}`, { state: { editMode: !isReadOnly } });
  };

  const handleDelete = (patientId: string) => {
    if (isReadOnly) return;
    if (window.confirm("Tem certeza que deseja excluir este paciente?")) {
      removePatient(patientId);
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const getAvatarColors = (name: string) => {
    const palettes = [
      { bg: 'from-primary-400 to-primary-600', text: 'text-white' },
      { bg: 'from-rose-400 to-rose-600', text: 'text-white' },
      { bg: 'from-violet-400 to-violet-600', text: 'text-white' },
      { bg: 'from-sky-400 to-sky-600', text: 'text-white' },
      { bg: 'from-emerald-400 to-emerald-600', text: 'text-white' },
      { bg: 'from-amber-400 to-amber-600', text: 'text-white' },
    ];
    return palettes[(name.charCodeAt(0) || 0) % palettes.length];
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      lead:   'bg-blue-50 text-blue-700 border border-blue-200',
      inactive: 'bg-slate-100 text-slate-500 border border-slate-200',
    };
    const labels: Record<string, string> = { active: 'Ativo', lead: 'Novo Lead', inactive: 'Inativo' };
    return { cls: map[status] ?? map.inactive, label: labels[status] ?? 'Inativo' };
  };

  const renderTable = (patientList: Patient[]) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8 animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Nome</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Contato</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Status</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Última Visita</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {patientList.map((patient) => {
                const avatar = getAvatarColors(patient.name);
                const badge = getStatusBadge(patient.status);
                return (
                  <tr key={patient.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-6 py-4">
                      <Link to={`/patients/${patient.id}`} className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatar.bg} flex items-center justify-center font-bold text-xs ${avatar.text} flex-shrink-0 shadow-sm`}>
                          {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-secondary-900 group-hover:text-primary-600 transition-colors text-sm">{patient.name}</div>
                          <div className="text-xs text-slate-400">Nasc: {new Date(patient.birthDate).toLocaleDateString('pt-BR')}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs text-slate-500 gap-1">
                        <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-300" /> {patient.phone}</div>
                        <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-300" /> {patient.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString('pt-BR') : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(patient)} className="p-2 text-slate-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Editar">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(patient.id)} disabled={isReadOnly} className={`p-2 rounded-lg transition-colors ${isReadOnly ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`} title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {patientList.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-sm">
            Nenhum paciente encontrado nesta clínica.
          </div>
        )}
    </div>
  );

  // Loading state - usar skeleton
  if (loadingStates.patients && patients.length === 0) {
    return <PatientsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-secondary-900">Pacientes</h1>
          <p className="text-slate-500">
            {isOwner ? 'Visão global de pacientes por clínica.' : 'Gerencie os prontuários e informações dos clientes.'}
          </p>
        </div>
        {!isOwner && (
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={isReadOnly}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-all ${isReadOnly ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white hover:-translate-y-px'}`}
          >
            <Plus className="w-4 h-4" /> Novo Paciente
          </button>
        )}
      </div>

      {/* Barra de Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 text-sm transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Conteúdo: Agrupado por Empresa (Owner) ou Lista Única (Admin) */}
      {isOwner ? (
        <div className="space-y-4">
            {companies.map(company => {
                const companyPatients = filteredPatients.filter(p => p.companyId === company.id);
                // Se tiver filtro de busca e não tiver resultados na empresa, esconde a empresa (opcional)
                if (searchTerm && companyPatients.length === 0) return null;

                const isExpanded = expandedSections.includes(company.id);

                return (
                    <div key={company.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div 
                            onClick={() => toggleSection(company.id)}
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                                <Building className="w-5 h-5 text-slate-500" />
                                {company.name}
                                <span className="text-xs bg-white px-2 py-1 rounded border border-slate-200 text-slate-400 font-normal ml-2">
                                    {companyPatients.length} pacientes
                                </span>
                            </h3>
                            <div className="text-slate-400">
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
                        </div>
                        
                        {isExpanded && (
                            <div className="p-4 pt-0 border-t border-slate-200 bg-white animate-fade-in">
                                <div className="mt-4">
                                    {renderTable(companyPatients)}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
            {companies.length === 0 && <div className="text-center text-slate-500">Nenhuma empresa cadastrada.</div>}
        </div>
      ) : (
        renderTable(filteredPatients)
      )}

      {isModalOpen && !isReadOnly && <NewPatientModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default Patients;
