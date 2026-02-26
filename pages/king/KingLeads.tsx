import React, { useState, useEffect } from 'react';
import {
  Target, Plus, Phone, Mail, DollarSign, Calendar,
  MoreHorizontal, XCircle, RotateCcw, ChevronRight, TrendingUp,
  CheckCircle, Crown, Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Lead, LeadStatus } from '../../types';
import { maskPhone } from '../../utils/maskUtils';
import { formatCurrency } from '../../utils/formatUtils';
import { companiesApi } from '../../services/api';

interface Column {
  id: LeadStatus;
  title: string;
  color: string;
  bgColor: string;
}

const columns: Column[] = [
  { id: 'new', title: 'Novos Contatos', color: 'border-blue-500', bgColor: 'bg-blue-500' },
  { id: 'contacted', title: 'Em Contato', color: 'border-amber-500', bgColor: 'bg-amber-500' },
  { id: 'demo', title: 'Demo Agendada', color: 'border-purple-500', bgColor: 'bg-purple-500' },
  { id: 'negotiation', title: 'Negociação', color: 'border-orange-500', bgColor: 'bg-orange-500' },
  { id: 'won', title: 'Fechado (Ganho)', color: 'border-emerald-500', bgColor: 'bg-emerald-500' },
  { id: 'lost', title: 'Perdido', color: 'border-red-500', bgColor: 'bg-red-500' },
];

// Planos disponíveis para conversão
const CONVERSION_PLANS = [
  { id: 'BASIC', name: 'Basic', price: 97 },
  { id: 'PROFESSIONAL', name: 'Professional', price: 197 },
  { id: 'PREMIUM', name: 'Premium', price: 297 },
];

const KingLeads: React.FC = () => {
  const { leads, addLead, moveLead, loadLeads, loadingStates } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLead, setNewLead] = useState({ clinicName: '', contactName: '', phone: '', email: '', value: '' });
  const [activeMenuLeadId, setActiveMenuLeadId] = useState<string | null>(null);

  // Modal de conversão
  const [conversionModal, setConversionModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [selectedPlan, setSelectedPlan] = useState<string>('PROFESSIONAL');
  const [converting, setConverting] = useState(false);

  // Carregar leads ao montar
  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

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

  const handleMove = (id: string, direction: 'next' | 'prev', currentStatus: LeadStatus) => {
    const statusOrder: LeadStatus[] = ['new', 'contacted', 'demo', 'negotiation', 'won', 'lost'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex >= 0 && nextIndex < statusOrder.length) {
      const nextStatus = statusOrder[nextIndex];
      // Se for marcar como ganho, abre modal de conversão
      if (nextStatus === 'won') {
        const lead = leads.find(l => l.id === id);
        if (lead) {
          setConversionModal({ open: true, lead });
        }
      } else {
        moveLead(id, nextStatus);
      }
    }
  };

  const handleStatusChange = (id: string, status: LeadStatus) => {
    // Se for marcar como ganho, abre modal de conversão
    if (status === 'won') {
      const lead = leads.find(l => l.id === id);
      if (lead) {
        setConversionModal({ open: true, lead });
      }
    } else {
      moveLead(id, status);
    }
    setActiveMenuLeadId(null);
  };

  // Converter lead em cliente (marcar como ganho + atualizar empresa)
  const handleConversion = async () => {
    if (!conversionModal.lead?.companyId) {
      // Lead manual sem empresa vinculada - apenas marca como ganho
      moveLead(conversionModal.lead!.id, 'won');
      setConversionModal({ open: false, lead: null });
      return;
    }

    setConverting(true);
    try {
      // Atualizar empresa para o plano selecionado
      await companiesApi.update(conversionModal.lead.companyId, {
        plan: selectedPlan,
        subscriptionStatus: 'ACTIVE',
      });
      // Marcar lead como ganho
      moveLead(conversionModal.lead.id, 'won');
      setConversionModal({ open: false, lead: null });
      alert('🎉 Lead convertido com sucesso!');
    } catch (error) {
      console.error('Erro ao converter lead:', error);
      alert('Erro ao converter lead. Tente novamente.');
    } finally {
      setConverting(false);
    }
  };

  // Marcar como perdido (BASIC + CANCELED)
  const handleMarkAsLost = async (lead: Lead) => {
    if (lead.companyId) {
      try {
        await companiesApi.update(lead.companyId, {
          plan: 'BASIC',
          subscriptionStatus: 'CANCELED',
        });
      } catch (error) {
        console.error('Erro ao atualizar empresa:', error);
      }
    }
    moveLead(lead.id, 'lost');
    setActiveMenuLeadId(null);
  };

  // Calcular métricas
  const totalLeads = leads.length;
  const wonLeads = leads.filter(l => l.status === 'won').length;
  const totalPotential = leads.reduce((acc, l) => acc + (l.value || 0), 0);
  const wonValue = leads.filter(l => l.status === 'won').reduce((acc, l) => acc + (l.value || 0), 0);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col relative overflow-hidden">
      {/* Backdrop para fechar menus */}
      {activeMenuLeadId && (
        <div className="fixed inset-0 z-10" onClick={() => setActiveMenuLeadId(null)} />
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Target className="w-8 h-8 text-blue-500" />
            CRM Comercial
          </h1>
          <p className="text-slate-500 mt-1">Pipeline de vendas e gestão de leads de novas clínicas</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Lead
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Total de Leads</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalLeads}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Leads Ganhos</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{wonLeads}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Valor Potencial</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalPotential)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">MRR Conquistado</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(wonValue)}</p>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4 max-w-full">
        <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
          {columns.map(col => {
            const colLeads = leads.filter(l => l.status === col.id);
            const colValue = colLeads.reduce((acc, l) => acc + (l.value || 0), 0);

            return (
              <div key={col.id} className="w-80 flex flex-col h-full rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
                {/* Column Header */}
                <div className={`p-4 border-t-4 ${col.color} bg-white border-b border-slate-200`}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">{col.title}</h3>
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">
                      {colLeads.length}
                    </span>
                  </div>
                  {colValue > 0 && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Potencial: {formatCurrency(colValue)}/mês
                    </p>
                  )}
                </div>

                {/* Cards */}
                <div className="p-3 space-y-3 overflow-y-auto flex-1">
                  {colLeads.map(lead => (
                    <div
                      key={lead.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative"
                    >
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-slate-800">{lead.clinicName}</h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuLeadId(activeMenuLeadId === lead.id ? null : lead.id);
                          }}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors relative z-20"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuLeadId === lead.id && (
                          <div className="absolute right-2 top-10 bg-white rounded-xl shadow-xl border border-slate-100 z-30 w-48 overflow-hidden animate-fade-in">
                            {lead.status !== 'won' && lead.status !== 'lost' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConversionModal({ open: true, lead }); setActiveMenuLeadId(null); }}
                                className="w-full text-left px-4 py-3 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 transition-colors border-b border-slate-100"
                              >
                                <CheckCircle className="w-4 h-4" /> Marcar como Ganho
                              </button>
                            )}
                            {lead.status !== 'lost' ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMarkAsLost(lead); }}
                                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                              >
                                <XCircle className="w-4 h-4" /> Marcar como Perdido
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(lead.id, 'new'); }}
                                className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                              >
                                <RotateCcw className="w-4 h-4" /> Reabrir Lead
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Contact Name */}
                      <p className="text-sm text-slate-600 mb-3">{lead.contactName}</p>

                      {/* Contact Info */}
                      <div className="space-y-2 text-xs text-slate-500">
                        {lead.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" /> {lead.email}
                          </div>
                        )}
                        {lead.value > 0 && (
                          <div className="flex items-center gap-2 text-emerald-600 font-medium">
                            <DollarSign className="w-3 h-3" /> {formatCurrency(lead.value)}/mês
                          </div>
                        )}
                        <div className="flex items-center gap-2 opacity-70">
                          <Calendar className="w-3 h-3" /> {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {col.id !== 'new' && (
                          <button
                            onClick={() => handleMove(lead.id, 'prev', col.id)}
                            className="flex-1 bg-slate-100 text-slate-600 py-1.5 rounded-lg text-xs hover:bg-slate-200 transition-colors"
                          >
                            ← Voltar
                          </button>
                        )}
                        {col.id !== 'lost' && col.id !== 'won' && (
                          <button
                            onClick={() => handleMove(lead.id, 'next', col.id)}
                            className="flex-1 bg-blue-100 text-blue-700 py-1.5 rounded-lg text-xs hover:bg-blue-200 font-medium transition-colors flex items-center justify-center gap-1"
                          >
                            Avançar <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {colLeads.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Nenhum lead
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Novo Lead */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Adicionar Novo Lead</h3>
              <p className="text-sm text-slate-500">Cadastre um potencial cliente</p>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddLead} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Nome da Clínica *
                </label>
                <input
                  type="text"
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Clínica Beleza Natural"
                  value={newLead.clinicName}
                  onChange={e => setNewLead({ ...newLead, clinicName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Contato Principal *
                </label>
                <input
                  type="text"
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Maria Silva"
                  value={newLead.contactName}
                  onChange={e => setNewLead({ ...newLead, contactName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="(00) 00000-0000"
                    value={newLead.phone}
                    onChange={e => setNewLead({ ...newLead, phone: maskPhone(e.target.value) })}
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Valor Mensal (R$)
                  </label>
                  <input
                    type="number"
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="297"
                    value={newLead.value}
                    onChange={e => setNewLead({ ...newLead, value: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contato@clinica.com"
                  value={newLead.email}
                  onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Adicionar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Conversão */}
      {conversionModal.open && conversionModal.lead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <Crown className="w-8 h-8" />
                <div>
                  <h3 className="text-lg font-bold">Converter Lead</h3>
                  <p className="text-emerald-100 text-sm">{conversionModal.lead.clinicName}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm">
                Selecione o plano para ativar a assinatura desta clínica:
              </p>

              <div className="space-y-3">
                {CONVERSION_PLANS.map(plan => (
                  <label
                    key={plan.id}
                    className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={selectedPlan === plan.id}
                        onChange={() => setSelectedPlan(plan.id)}
                        className="w-4 h-4 text-emerald-600"
                      />
                      <span className="font-medium text-slate-800">{plan.name}</span>
                    </div>
                    <span className="font-bold text-emerald-600">{formatCurrency(plan.price)}/mês</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setConversionModal({ open: false, lead: null })}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                disabled={converting}
              >
                Cancelar
              </button>
              <button
                onClick={handleConversion}
                disabled={converting}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium flex items-center gap-2"
              >
                {converting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Convertendo...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Conversão
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KingLeads;
