
import React, { useState } from 'react';
import { Plus, Briefcase, Mail, MoreVertical, Trash2, Edit, Building, ChevronDown, ChevronUp, Search, Users, UserCheck, TrendingUp } from 'lucide-react';
import { KPICard } from '../components/charts/KPICard';
import { useApp } from '../context/AppContext';
import { ProfessionalModal } from '../components/Modals';
import { User, UserRole, BusinessHours } from '../types';
import { useDialog } from '../context/DialogContext';
import { getAvatarConfig, getAvatarInitials } from '../utils/formatUtils';

const Professionals: React.FC = () => {
  const { professionals, removeProfessional, user, companies, isReadOnly, currentCompany } = useApp();
  const { confirm } = useDialog();
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

  const handleDelete = async (id: string) => {
    if (isReadOnly) return;
    const ok = await confirm('Tem certeza que deseja remover este profissional?', { title: 'Remover profissional' });
    if (ok) removeProfessional(id);
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


  const getContractBadge = (type?: string) => {
    const map: Record<string, string> = {
      'CLT':        'bg-blue-50 text-blue-700 border-blue-200',
      'PJ':         'bg-violet-50 text-violet-700 border-violet-200',
      'Freelancer': 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return map[type || ''] ?? 'bg-slate-50 text-slate-500 border-slate-200';
  };

  const renderTable = (profList: User[], companyData?: { businessHours?: BusinessHours }) => {
    return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8 animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Nome / Cargo</th>
                <th className="hidden sm:table-cell px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Contato</th>
                <th className="hidden lg:table-cell px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Disponibilidade</th>
                <th className="hidden md:table-cell px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Contrato</th>
                <th className="hidden md:table-cell px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Comissão</th>
                <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {profList.map((prof) => {
                const availabilitySource = prof.businessHours || (isOwner && companyData ? companyData.businessHours : currentCompany?.businessHours);
                const avatarGradient = getAvatarConfig(prof.name).bg;
                const contractCls = getContractBadge(prof.contractType);

                return (
                <tr key={prof.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm`}>
                        {getAvatarInitials(prof.name)}
                      </div>
                      <div>
                        <div className="font-medium text-secondary-900 text-sm">{prof.name}</div>
                        <div className="text-xs text-slate-400">{prof.title || getRoleLabel(prof.role)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail className="w-3 h-3 text-slate-300" /> {prof.email}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4">
                    <div className="flex gap-1">
                      {weekDays.map(day => {
                        const isOpen = availabilitySource?.[day.key]?.isOpen ?? false;
                        return (
                          <div key={day.key} className="flex flex-col items-center gap-0.5 group/day cursor-help relative">
                            <div className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                            <span className={`text-[9px] font-medium ${isOpen ? 'text-slate-500' : 'text-slate-300'}`}>{day.label}</span>
                            <div className="absolute bottom-full mb-1 hidden group-hover/day:block bg-secondary-900 text-white text-[9px] px-2 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg">
                              {isOpen ? `${availabilitySource?.[day.key]?.start}–${availabilitySource?.[day.key]?.end}` : 'Folga'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${contractCls}`}>
                      {prof.contractType || 'N/A'}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
                    {prof.remunerationType === 'fixo' ? (
                      <span className="text-xs text-slate-500">Salário Fixo</span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600">{prof.commissionRate}%</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleEdit(prof)} disabled={isReadOnly} className={`min-h-[44px] min-w-[44px] p-2.5 rounded-lg transition-colors ${isReadOnly ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-primary-600 hover:bg-primary-50'}`} title="Editar">
                        <Edit className="w-4 h-4" />
                      </button>
                      {prof.role !== UserRole.OWNER && (
                        <button onClick={() => handleDelete(prof.id)} disabled={isReadOnly} className={`min-h-[44px] min-w-[44px] p-2.5 rounded-lg transition-colors ${isReadOnly ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`} title="Remover">
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
            <div className="p-12 text-center text-slate-400 text-sm">Nenhum profissional encontrado.</div>
        )}
    </div>
  )};

  const totalTeam = baseProfessionals.length;
  const estheticians = baseProfessionals.filter(p => p.role === UserRole.ESTHETICIAN).length;
  const commissionBased = baseProfessionals.filter(p => p.remunerationType !== 'fixo' && p.commissionRate && p.commissionRate > 0);
  const avgCommission = commissionBased.length > 0
    ? Math.round(commissionBased.reduce((s, p) => s + (p.commissionRate || 0), 0) / commissionBased.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-secondary-900">Profissionais</h1>
          <p className="text-slate-500">
             {isOwner ? 'Gerenciamento de usuários por clínica.' : 'Gerencie a equipe, acessos e comissões.'}
          </p>
        </div>
        {!isOwner && (
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={isReadOnly}
            className={`hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-all ${isReadOnly ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white hover:-translate-y-px'}`}
          >
            <Plus className="w-4 h-4" /> Adicionar Profissional
          </button>
        )}
      </div>

      {!isOwner && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-4">
          <KPICard title="Total da Equipe" value={totalTeam} icon={Users} variant="default" size="sm" />
          <KPICard title="Esteticistas" value={estheticians} icon={UserCheck} variant="primary" size="sm" />
          <KPICard title="Comissão Média" value={`${avgCommission}%`} icon={TrendingUp} variant="success" size="sm" subtitle={`${commissionBased.length} por comissão`} />
        </div>
      )}

      {/* Barra de Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome, cargo ou email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 text-sm transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
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

      {/* FAB mobile */}
      {!isOwner && !isReadOnly && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="sm:hidden fixed bottom-6 right-6 z-20 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
          title="Adicionar Profissional"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Professionals;
