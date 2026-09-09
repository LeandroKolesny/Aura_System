import React, { useState, useEffect } from 'react';
import {
  Target, Plus, Phone, Mail, DollarSign, Calendar,
  MoreHorizontal, XCircle, RotateCcw, ChevronRight, TrendingUp,
  CheckCircle, Crown, Loader2, MessageCircle, Clock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Lead, LeadStatus } from '../../types';
import { maskPhone } from '../../utils/maskUtils';
import { formatCurrency } from '../../utils/formatUtils';
import { companiesApi, kingApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import { SAAS_COMPANY_NAME } from '../../constants';

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

const CONVERSION_PLANS = [
  { id: 'STARTER', name: 'Starter', price: 97 },
  { id: 'PROFESSIONAL', name: 'Professional', price: 197 },
  { id: 'PREMIUM', name: 'Premium', price: 297 },
];

const LOST_REASONS = [
  'Preço muito alto',
  'Escolheu concorrente',
  'Sem interesse no momento',
  'Não respondeu mais',
  'Outro',
];

function buildWhatsAppUrl(lead: Lead): string {
  const digits = lead.phone.replace(/\D/g, '');
  const phone = digits.startsWith('55') ? digits : `55${digits}`;
  const text = `Olá, ${lead.contactName}! 👋\nAqui é da equipe ${SAAS_COMPANY_NAME}. Vi que ${lead.clinicName} se cadastrou na nossa plataforma.\nGostaria de entender melhor as suas necessidades e mostrar como podemos ajudar a gestão da sua empresa. Tem um minutinho para conversar?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function timeAgo(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

const KingLeads: React.FC = () => {
  const { leads, addLead, moveLead, loadLeads, loadingStates } = useApp();
  const { showAlert } = useDialog();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLead, setNewLead] = useState({ clinicName: '', contactName: '', phone: '', email: '', value: '' });
  const [activeMenuLeadId, setActiveMenuLeadId] = useState<string | null>(null);

  // Modal conversão (ganho)
  const [conversionModal, setConversionModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [selectedPlan, setSelectedPlan] = useState<string>('PROFESSIONAL');
  const [converting, setConverting] = useState(false);

  // Modal demo
  const [demoModal, setDemoModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [demoAt, setDemoAt] = useState('');
  const [demoNotes, setDemoNotes] = useState('');
  const [savingDemo, setSavingDemo] = useState(false);

  // Modal perdido
  const [lostModal, setLostModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [lostReason, setLostReason] = useState(LOST_REASONS[0]);
  const [lostComment, setLostComment] = useState('');
  const [savingLost, setSavingLost] = useState(false);

  useEffect(() => {
    loadLeads();
    // Marcar leads como vistos ao abrir o CRM
    kingApi.markLeadsSeen().catch(() => {});
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
    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex >= 0 && nextIndex < statusOrder.length) {
      const nextStatus = statusOrder[nextIndex];
      openModalForStatus(id, nextStatus);
    }
  };

  const handleStatusChange = (id: string, status: LeadStatus) => {
    openModalForStatus(id, status);
    setActiveMenuLeadId(null);
  };

  function openModalForStatus(id: string, status: LeadStatus) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    if (status === 'won') {
      setConversionModal({ open: true, lead });
    } else if (status === 'demo') {
      setDemoAt('');
      setDemoNotes('');
      setDemoModal({ open: true, lead });
    } else if (status === 'lost') {
      setLostReason(LOST_REASONS[0]);
      setLostComment('');
      setLostModal({ open: true, lead });
    } else {
      moveLead(id, status).then(result => {
        if (!result.success) {
          showAlert(result.error ?? 'Erro de sistema. Tente novamente.', { variant: 'danger' });
        }
      });
    }
  }

  const handleConversion = async () => {
    if (!conversionModal.lead?.companyId) {
      const result = await moveLead(conversionModal.lead!.id, 'won');
      if (!result.success) {
        showAlert(result.error ?? 'Erro de sistema. Tente novamente.', { variant: 'danger' });
        return;
      }
      setConversionModal({ open: false, lead: null });
      return;
    }
    setConverting(true);
    try {
      await companiesApi.update(conversionModal.lead.companyId, {
        plan: selectedPlan,
        subscriptionStatus: 'ACTIVE',
      });
      const result = await moveLead(conversionModal.lead.id, 'won');
      if (!result.success) {
        showAlert(result.error ?? 'Erro de sistema. Tente novamente.', { variant: 'danger' });
        return;
      }
      setConversionModal({ open: false, lead: null });
      showAlert('Lead convertido com sucesso!', { title: 'Conversão realizada', variant: 'success' });
    } catch {
      showAlert('Erro ao converter lead. Tente novamente.', { variant: 'danger', title: 'Erro' });
    } finally {
      setConverting(false);
    }
  };

  const handleConfirmDemo = async () => {
    if (!demoModal.lead) return;
    setSavingDemo(true);
    try {
      await kingApi.updateLead(demoModal.lead.companyId || demoModal.lead.id, {
        status: 'demo',
        demoAt: demoAt || undefined,
        demoNotes: demoNotes || undefined,
      });
      const result = await moveLead(demoModal.lead.id, 'demo');
      if (!result.success) {
        showAlert(result.error ?? 'Erro de sistema. Tente novamente.', { variant: 'danger' });
        return;
      }
      setDemoModal({ open: false, lead: null });
    } catch {
      showAlert('Erro ao salvar demo. Tente novamente.', { variant: 'danger', title: 'Erro' });
    } finally {
      setSavingDemo(false);
    }
  };

  const handleConfirmLost = async () => {
    if (!lostModal.lead) return;
    setSavingLost(true);
    try {
      if (lostModal.lead.companyId) {
        await companiesApi.update(lostModal.lead.companyId, {
          plan: 'BASIC',
          subscriptionStatus: 'CANCELED',
        });
      }
      await kingApi.updateLead(lostModal.lead.companyId || lostModal.lead.id, {
        status: 'lost',
        lostReason,
        lostComment: lostComment || undefined,
      });
      const result = await moveLead(lostModal.lead.id, 'lost');
      if (!result.success) {
        showAlert(result.error ?? 'Erro de sistema. Tente novamente.', { variant: 'danger' });
        return;
      }
      setLostModal({ open: false, lead: null });
    } catch {
      showAlert('Erro ao registrar perda. Tente novamente.', { variant: 'danger', title: 'Erro' });
    } finally {
      setSavingLost(false);
    }
  };

  const totalLeads = leads.length;
  const wonLeads = leads.filter(l => l.status === 'won').length;
  const totalPotential = leads.reduce((acc, l) => acc + (l.value || 0), 0);
  const wonValue = leads.filter(l => l.status === 'won').reduce((acc, l) => acc + (l.value || 0), 0);

  return (
    <div className="flex flex-col">
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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Total de Leads</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalLeads}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Leads Ganhos</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{wonLeads}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Valor Potencial</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalPotential)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">MRR Conquistado</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(wonValue)}</p>
        </div>
      </div>

      {/* Kanban Board */}
      <div
        className="sticky overflow-auto overscroll-x-contain"
        style={{ top: '76px', height: 'calc(100vh - 76px)' }}
      >
        <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
          {columns.map(col => {
            const colLeads = leads.filter(l => l.status === col.id);
            const colValue = colLeads.reduce((acc, l) => acc + (l.value || 0), 0);

            return (
              <div key={col.id} className="w-80 h-full flex flex-col rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
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
                  {colLeads.map(lead => {
                    const movementDate = lead.movedAt || lead.createdAt;
                    const dateLabel = lead.movedAt ? `Movido ${timeAgo(lead.movedAt)}` : `Criado ${timeAgo(lead.createdAt)}`;

                    return (
                      <div
                        key={lead.id}
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-100 transition-all duration-200 group relative"
                      >
                        {/* Card Header */}
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-slate-800 leading-tight">{lead.clinicName}</h4>
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
                                  onClick={(e) => { e.stopPropagation(); openModalForStatus(lead.id, 'lost'); setActiveMenuLeadId(null); }}
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

                        {/* Movement date */}
                        {dateLabel && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 mb-2">
                            <Clock className="w-3 h-3" /> {dateLabel}
                          </p>
                        )}

                        {/* Contact Name */}
                        <p className="text-sm text-slate-600 mb-3">{lead.contactName}</p>

                        {/* Demo info */}
                        {lead.status === 'demo' && lead.demoAt && (
                          <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 mb-3">
                            <p className="text-xs text-purple-700 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(lead.demoAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                            {lead.demoNotes && <p className="text-xs text-purple-600 mt-0.5 line-clamp-2">{lead.demoNotes}</p>}
                          </div>
                        )}

                        {/* Lost reason */}
                        {lead.status === 'lost' && lead.lostReason && (
                          <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                            <p className="text-xs text-red-600 font-medium">{lead.lostReason}</p>
                            {lead.lostComment && <p className="text-xs text-red-500 mt-0.5 line-clamp-2">{lead.lostComment}</p>}
                          </div>
                        )}

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
                        </div>

                        {/* Footer: WhatsApp + Ações */}
                        <div className="mt-4 flex gap-2">
                          {lead.phone && (
                            <a
                              href={buildWhatsAppUrl(lead)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </a>
                          )}
                          <div className="flex gap-2 flex-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {col.id !== 'new' && col.id !== 'lost' && col.id !== 'won' && (
                              <button
                                onClick={() => handleMove(lead.id, 'prev', col.id)}
                                className="flex-1 bg-slate-100 text-slate-600 py-1.5 rounded-lg text-xs hover:bg-slate-200 transition-colors"
                              >
                                ← Voltar
                              </button>
                            )}
                            {col.id === 'negotiation' ? (
                              <div className="flex flex-col gap-1 flex-1">
                                <button
                                  onClick={() => openModalForStatus(lead.id, 'won')}
                                  className="w-full bg-emerald-100 text-emerald-700 py-1.5 rounded-lg text-xs hover:bg-emerald-200 font-medium transition-colors flex items-center justify-center gap-1"
                                >
                                  <CheckCircle className="w-3 h-3" /> Fechado
                                </button>
                                <button
                                  onClick={() => openModalForStatus(lead.id, 'lost')}
                                  className="w-full bg-red-100 text-red-600 py-1.5 rounded-lg text-xs hover:bg-red-200 font-medium transition-colors flex items-center justify-center gap-1"
                                >
                                  <XCircle className="w-3 h-3" /> Perdido
                                </button>
                              </div>
                            ) : col.id !== 'lost' && col.id !== 'won' && (
                              <button
                                onClick={() => handleMove(lead.id, 'next', col.id)}
                                className="flex-1 bg-blue-100 text-blue-700 py-1.5 rounded-lg text-xs hover:bg-blue-200 font-medium transition-colors flex items-center justify-center gap-1"
                              >
                                Avançar <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

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
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Adicionar Novo Lead</h3>
              <p className="text-sm text-slate-500">Cadastre um potencial cliente</p>
            </div>
            <form onSubmit={handleAddLead} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nome da Clínica *</label>
                <input
                  type="text" required
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Clínica Beleza Natural"
                  value={newLead.clinicName}
                  onChange={e => setNewLead({ ...newLead, clinicName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Contato Principal *</label>
                <input
                  type="text" required
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Maria Silva"
                  value={newLead.contactName}
                  onChange={e => setNewLead({ ...newLead, contactName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Telefone</label>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Valor Mensal (R$)</label>
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                <input
                  type="email"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contato@clinica.com"
                  value={newLead.email}
                  onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Adicionar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Demo Agendada */}
      {demoModal.open && demoModal.lead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <Calendar className="w-7 h-7" />
                <div>
                  <h3 className="text-lg font-bold">Demo Agendada</h3>
                  <p className="text-purple-100 text-sm">{demoModal.lead.clinicName}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Data e Hora da Reunião</label>
                <input
                  type="datetime-local"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  value={demoAt}
                  onChange={e => setDemoAt(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Observações</label>
                <textarea
                  rows={3}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  placeholder="Pontos a abordar, necessidades do cliente..."
                  value={demoNotes}
                  onChange={e => setDemoNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setDemoModal({ open: false, lead: null })} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors" disabled={savingDemo}>
                Cancelar
              </button>
              <button onClick={handleConfirmDemo} disabled={savingDemo} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2">
                {savingDemo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Confirmar Demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Perdido */}
      {lostModal.open && lostModal.lead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <XCircle className="w-7 h-7" />
                <div>
                  <h3 className="text-lg font-bold">Registrar Perda</h3>
                  <p className="text-red-100 text-sm">{lostModal.lead.clinicName}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Motivo</label>
                <div className="space-y-2">
                  {LOST_REASONS.map(reason => (
                    <label key={reason} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${lostReason === reason ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input
                        type="radio" name="lostReason" value={reason}
                        checked={lostReason === reason}
                        onChange={() => setLostReason(reason)}
                        className="w-4 h-4 text-red-600"
                      />
                      <span className="text-sm text-slate-700">{reason}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Comentário (opcional)</label>
                <textarea
                  rows={2}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  placeholder="Detalhes adicionais..."
                  value={lostComment}
                  onChange={e => setLostComment(e.target.value)}
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setLostModal({ open: false, lead: null })} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors" disabled={savingLost}>
                Cancelar
              </button>
              <button onClick={handleConfirmLost} disabled={savingLost} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2">
                {savingLost ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Registrar Perda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Conversão (Ganho) */}
      {conversionModal.open && conversionModal.lead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <Crown className="w-8 h-8" />
                <div>
                  <h3 className="text-lg font-bold">Converter Lead</h3>
                  <p className="text-emerald-100 text-sm">{conversionModal.lead.clinicName}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm">Selecione o plano para ativar a assinatura desta clínica:</p>
              <div className="space-y-3">
                {CONVERSION_PLANS.map(plan => (
                  <label key={plan.id} className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedPlan === plan.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="plan" value={plan.id} checked={selectedPlan === plan.id} onChange={() => setSelectedPlan(plan.id)} className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium text-slate-800">{plan.name}</span>
                    </div>
                    <span className="font-bold text-emerald-600">{formatCurrency(plan.price)}/mês</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setConversionModal({ open: false, lead: null })} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors" disabled={converting}>
                Cancelar
              </button>
              <button onClick={handleConversion} disabled={converting} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium flex items-center gap-2">
                {converting ? <><Loader2 className="w-4 h-4 animate-spin" /> Convertendo...</> : <><CheckCircle className="w-4 h-4" /> Confirmar Conversão</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KingLeads;
