
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lead, LeadStatus } from '../types';
import { Plus, Phone, Mail, DollarSign, Calendar, MoreHorizontal, XCircle, RotateCcw } from 'lucide-react';
import { maskPhone } from '../utils/maskUtils';

const Leads: React.FC = () => {
  const { leads, addLead, moveLead } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLead, setNewLead] = useState({ clinicName: '', contactName: '', phone: '', email: '', value: '' });
  const [activeMenuLeadId, setActiveMenuLeadId] = useState<string | null>(null);

  const columns: { id: LeadStatus; title: string; color: string }[] = [
    { id: 'new', title: 'Novos Contatos', color: 'border-blue-500' },
    { id: 'contacted', title: 'Em Contato', color: 'border-yellow-500' },
    { id: 'demo', title: 'Demo Agendada', color: 'border-purple-500' },
    { id: 'negotiation', title: 'Negociação', color: 'border-orange-500' },
    { id: 'won', title: 'Fechado (Ganho)', color: 'border-green-500' },
    { id: 'lost', title: 'Perdido', color: 'border-red-500' },
  ];

  const handleAddLead = (e: React.FormEvent) => {
      e.preventDefault();
      if (newLead.clinicName && newLead.contactName) {
          addLead({
              ...newLead,
              value: Number(newLead.value) || 0,
              status: 'new',
              createdAt: new Date().toISOString()
          });
          setNewLead({ clinicName: '', contactName: '', phone: '', email: '', value: '' });
          setIsModalOpen(false);
      }
  };

  // Simples drag and drop handler (mudança de status via clique ou botão para simplificar implementação sem dnd-kit)
  const handleMove = (id: string, direction: 'next' | 'prev', currentStatus: LeadStatus) => {
      const statusOrder: LeadStatus[] = ['new', 'contacted', 'demo', 'negotiation', 'won', 'lost'];
      const currentIndex = statusOrder.indexOf(currentStatus);
      
      let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      
      // Pular 'lost' na navegação sequencial, deixar apenas por ação direta se preferir, mas aqui vamos linear
      if (nextIndex >= 0 && nextIndex < statusOrder.length) {
          moveLead(id, statusOrder[nextIndex]);
      }
  };

  const handleStatusChange = (id: string, status: LeadStatus) => {
      moveLead(id, status);
      setActiveMenuLeadId(null);
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col relative">
      {/* Backdrop invisível para fechar menus ao clicar fora */}
      {activeMenuLeadId && (
          <div className="fixed inset-0 z-10 cursor-default" onClick={() => setActiveMenuLeadId(null)}></div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM Comercial</h1>
          <p className="text-slate-500">Pipeline de vendas e gestão de leads.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Lead
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max h-full">
          {columns.map(col => (
            <div key={col.id} className="w-80 flex flex-col h-full rounded-xl bg-slate-100 border border-slate-200">
              <div className={`p-3 border-t-4 ${col.color} bg-white rounded-t-xl border-b border-slate-200 flex justify-between items-center`}>
                <h3 className="font-bold text-slate-700">{col.title}</h3>
                <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">
                  {leads.filter(l => l.status === col.id).length}
                </span>
              </div>
              <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {leads.filter(l => l.status === col.id).map(lead => (
                  <div key={lead.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-grab group relative">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-800">{lead.clinicName}</h4>
                        
                        {/* Botão Menu ... */}
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuLeadId(activeMenuLeadId === lead.id ? null : lead.id);
                            }}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors relative z-20"
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu Flutuante */}
                        {activeMenuLeadId === lead.id && (
                            <div className="absolute right-2 top-8 bg-white rounded-lg shadow-xl border border-slate-100 z-30 w-48 overflow-hidden animate-fade-in">
                                {lead.status !== 'lost' ? (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, 'lost'); }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" /> Marcar como Perdido
                                    </button>
                                ) : (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, 'new'); }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Reabrir Lead
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{lead.contactName}</p>
                    
                    <div className="space-y-2 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" /> {lead.phone}
                        </div>
                        <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" /> {lead.email}
                        </div>
                        <div className="flex items-center gap-2 text-green-600 font-medium">
                            <DollarSign className="w-3 h-3" /> Potencial: R$ {lead.value}
                        </div>
                        <div className="flex items-center gap-2 opacity-70">
                            <Calendar className="w-3 h-3" /> {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                    </div>

                    {/* Controles Rápidos */}
                    <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {col.id !== 'new' && (
                            <button 
                                onClick={() => handleMove(lead.id, 'prev', col.id)}
                                className="flex-1 bg-slate-50 text-slate-600 py-1 rounded text-xs hover:bg-slate-200"
                            >
                                ← Voltar
                            </button>
                        )}
                        {col.id !== 'lost' && col.id !== 'won' && (
                            <button 
                                onClick={() => handleMove(lead.id, 'next', col.id)}
                                className="flex-1 bg-primary-50 text-primary-700 py-1 rounded text-xs hover:bg-primary-100 font-bold"
                            >
                                Avançar →
                            </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Novo Lead */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Adicionar Novo Lead</h3>
                <form onSubmit={handleAddLead} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Clínica</label>
                        <input type="text" required className="w-full p-2 border rounded-lg" value={newLead.clinicName} onChange={e => setNewLead({...newLead, clinicName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contato Principal</label>
                        <input type="text" required className="w-full p-2 border rounded-lg" value={newLead.contactName} onChange={e => setNewLead({...newLead, contactName: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                            <input type="text" className="w-full p-2 border rounded-lg" value={newLead.phone} onChange={e => setNewLead({...newLead, phone: maskPhone(e.target.value)})} maxLength={15} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Mensal (R$)</label>
                            <input type="number" className="w-full p-2 border rounded-lg" value={newLead.value} onChange={e => setNewLead({...newLead, value: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input type="email" className="w-full p-2 border rounded-lg" value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Adicionar</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
