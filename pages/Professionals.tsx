
import React, { useState } from 'react';
import { Plus, Briefcase, Mail, MoreVertical, Trash2, Edit, Building, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProfessionalModal } from '../components/Modals';
import { User, UserRole, BusinessHours } from '../types';

const Professionals: React.FC = () => {
  const { professionals, removeProfessional, user, companies, isReadOnly, currentCompany } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<User | undefined>(undefined);
  // Alterado para rastrear seções ABERTAS. Inicialmente vazio = tudo fechado.
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleEdit = (prof: User) => {
    if (isReadOnly) return;
    setEditingProfessional(prof);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
      if (isReadOnly) return;
      if (window.confirm("Tem certeza que deseja remover este profissional?")) {
          removeProfessional(id);
      }
  };

  const handleClose = () => {
    setEditingProfessional(undefined);
    setIsModalOpen(false);
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.OWNER: return 'Proprietário (SaaS)';
      case UserRole.ADMIN: return 'Proprietário (Clínica)';
      case UserRole.RECEPTIONIST: return 'Recepção';
      case UserRole.ESTHETICIAN: return 'Esteticista';
      case UserRole.PATIENT: return 'Paciente (Acesso)';
      default: return role;
    }
  };

  const isOwner = user?.role === UserRole.OWNER;

  // Separar o próprio Owner/King da lista geral para não aparecer solto ou duplicado se não tiver empresa
  const baseProfessionals = isOwner 
    ? professionals.filter(p => p.role !== UserRole.OWNER) 
    : professionals;

  const filteredProfessionals = baseProfessionals.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.title && p.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const weekDays: { key: keyof BusinessHours; label: string }[] = [
    { key: 'monday', label: 'S' },
    { key: 'tuesday', label: 'T' },
    { key: 'wednesday', label: 'Q' },
    { key: 'thursday', label: 'Q' },
    { key: 'friday', label: 'S' },
    { key: 'saturday', label: 'S' },
    { key: 'sunday', label: 'D' },
  ];

  const renderTable = (profList: User[], companyData?: any) => {
    return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8 animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <th className="px-6 py-3">Nome / Cargo</th>
                <th className="px-6 py-3">Contato</th>
                <th className="px-6 py-3">Disponibilidade</th>
                <th className="px-6 py-3">Tipo Contrato</th>
                <th className="px-6 py-3">Comissão</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profList.map((prof) => {
                // Determina a fonte de horário para ESTE profissional específico.
                // Prioridade: 1. Horário específico do profissional | 2. Horário da clínica (CompanyData se Owner, CurrentCompany se Admin)
                const availabilitySource = prof.businessHours || (isOwner && companyData ? companyData.businessHours : currentCompany?.businessHours);

                return (
                <tr key={prof.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary-100 text-secondary-600 flex items-center justify-center font-bold text-sm">
                        {prof.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{prof.name}</div>
                        <div className="text-xs text-slate-500">{prof.title || getRoleLabel(prof.role)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                       <Mail className="w-3 h-3 text-slate-400" /> {prof.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5">
                        {weekDays.map(day => {
                            const isOpen = availabilitySource?.[day.key]?.isOpen ?? false;
                            return (
                                <div key={day.key} className="flex flex-col items-center gap-1 group/day cursor-help relative">
                                    <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-300'}`}></div>
                                    <span className={`text-[10px] font-bold ${isOpen ? 'text-slate-600' : 'text-slate-300'}`}>{day.label}</span>
                                    
                                    {/* Tooltip simples */}
                                    <div className="absolute bottom-full mb-1 hidden group-hover/day:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                                        {isOpen 
                                            ? `${availabilitySource?.[day.key]?.start} - ${availabilitySource?.[day.key]?.end}` 
                                            : 'Folga'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded border border-slate-200">
                      {prof.contractType || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {prof.remunerationType === 'fixo' ? (
                      'Salário Fixo'
                    ) : (
                      <span className="text-green-600 font-medium">
                        {prof.commissionRate}%
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(prof)}
                        disabled={isReadOnly}
                        className={`p-2 rounded-lg transition-colors ${isReadOnly ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-primary-600 hover:bg-primary-50'}`}
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {prof.role !== UserRole.OWNER && (
                        <button 
                          onClick={() => handleDelete(prof.id)}
                          disabled={isReadOnly}
                          className={`p-2 rounded-lg transition-colors ${isReadOnly ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        {profList.length === 0 && (
            <div className="p-6 text-center text-slate-500 text-sm">Nenhum profissional encontrado.</div>
        )}
    </div>
  )};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profissionais</h1>
          <p className="text-slate-500">
             {isOwner ? 'Gerenciamento de usuários por clínica.' : 'Gerencie a equipe, acessos e comissões.'}
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
            <Plus className="w-4 h-4" /> Adicionar Profissional
            </button>
        )}
      </div>

      {/* Barra de Busca Global */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por nome, cargo ou email..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
      </div>

      {isOwner ? (
          <div className="space-y-4">
              {companies.map(company => {
                  const companyPros = filteredProfessionals.filter(p => p.companyId === company.id);
                  
                  // Se tiver filtro de busca e não tiver resultados na empresa, esconde a empresa
                  if (searchTerm && companyPros.length === 0) return null;

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
                                      {companyPros.length} usuários
                                  </span>
                              </h3>
                              <div className="text-slate-400">
                                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </div>
                          </div>
                          
                          {isExpanded && (
                              <div className="p-4 pt-0 border-t border-slate-200 bg-white animate-fade-in">
                                  <div className="mt-4">
                                      {renderTable(companyPros, company)}
                                  </div>
                              </div>
                          )}
                      </div>
                  )
              })}
              {companies.length === 0 && <div className="text-center text-slate-500">Nenhuma empresa cadastrada.</div>}
          </div>
      ) : (
          renderTable(filteredProfessionals)
      )}

      {isModalOpen && !isReadOnly && (
        <ProfessionalModal 
          onClose={handleClose} 
          initialData={editingProfessional}
        />
      )}
    </div>
  );
};

export default Professionals;
