
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Phone, Mail, Building, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NewPatientModal } from '../components/Modals';
import { UserRole, Patient } from '../types';

const Patients: React.FC = () => {
  const { patients, user, companies, removePatient, isReadOnly } = useApp();
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

  const renderTable = (patientList: Patient[]) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8 animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Contato</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Última Visita</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patientList.map((patient) => (
                <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <Link to={`/patients/${patient.id}`} className="flex items-center gap-3 hover:opacity-80">
                      <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm">
                        {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 group-hover:text-primary-600 transition-colors">{patient.name}</div>
                        <div className="text-xs text-slate-500">Nasc: {new Date(patient.birthDate).toLocaleDateString('pt-BR')}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-sm text-slate-600 gap-1">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-slate-400" /> {patient.phone}
                      </div>
                      <div className="flex items-center gap-2">
                         <Mail className="w-3 h-3 text-slate-400" /> {patient.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${patient.status === 'active' ? 'bg-green-100 text-green-800' : 
                        patient.status === 'lead' ? 'bg-blue-100 text-blue-800' : 
                        'bg-slate-100 text-slate-800'}`}>
                      {patient.status === 'active' ? 'Ativo' : patient.status === 'lead' ? 'Novo Lead' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(patient)}
                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(patient.id)}
                        disabled={isReadOnly}
                        className={`p-2 rounded-lg transition-colors ${isReadOnly ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {patientList.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            Nenhum paciente encontrado nesta clínica.
          </div>
        )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-slate-500">
            {isOwner ? 'Visão global de pacientes por clínica.' : 'Gerencie os prontuários e informações dos clientes.'}
          </p>
        </div>
        {!isOwner && (
          <button 
            onClick={() => setIsModalOpen(true)}
            disabled={isReadOnly}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm
                ${isReadOnly ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white'}
            `}
          >
            <Plus className="w-4 h-4" /> Novo Paciente
          </button>
        )}
      </div>

      {/* Barra de Busca Global */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por nome, email ou CPF..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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
