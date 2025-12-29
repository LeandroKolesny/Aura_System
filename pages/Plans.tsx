
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle, Save, Tag, DollarSign, Plus, X, Edit, AlertTriangle, Link as LinkIcon, Trash2, Building, Calendar, Clock, PlusCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { SaasPlan, Company } from '../types';
import { formatDate, formatCurrency } from '../utils/formatUtils';

const Plans: React.FC = () => {
  const { saasPlans, updatePlan, addPlan, removePlan, companies, updateCompany } = useApp();
  
  // Estado para Modal de Adicionar Tempo
  const [timeModal, setTimeModal] = useState<{ isOpen: boolean; company: Company | null }>({
      isOpen: false,
      company: null
  });

  // Estado para Modal de Alterar Plano
  const [planChangeModal, setPlanChangeModal] = useState<{ isOpen: boolean; company: Company | null }>({
      isOpen: false,
      company: null
  });

  // Estado unificado para Modal de Criar/Editar Plano
  const [planModal, setPlanModal] = useState<{
      isOpen: boolean;
      mode: 'create' | 'edit';
      planId: string | null;
      data: { name: string; price: string; features: string[]; stripePaymentLink: string };
  }>({
      isOpen: false,
      mode: 'create',
      planId: null,
      data: { name: '', price: '', features: [], stripePaymentLink: '' }
  });

  const [newFeatureText, setNewFeatureText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // --- LÓGICA DE GESTÃO DE ATIVAÇÕES ---
  const getDaysRemaining = (expiresAt: string) => {
    const today = new Date();
    const expiration = new Date(expiresAt);
    const diffTime = expiration.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleAddTime = (days: number) => {
      if (!timeModal.company) return;
      
      const company = timeModal.company;
      const currentExpiration = new Date(company.subscriptionExpiresAt);
      const today = new Date();
      
      // Se já expirou, conta a partir de hoje. Se não, estende a partir do vencimento.
      const baseDate = currentExpiration > today ? currentExpiration : today;
      const newExpiration = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
      
      updateCompany(company.id, { 
          subscriptionExpiresAt: newExpiration.toISOString(),
          subscriptionStatus: 'active'
      });
      
      setTimeModal({ isOpen: false, company: null });
  };

  const handleChangePlan = (planId: string) => {
      if (!planChangeModal.company) return;
      
      updateCompany(planChangeModal.company.id, { 
          plan: planId,
          lastPlan: planChangeModal.company.plan // Mantém histórico se necessário
      });
      
      setPlanChangeModal({ isOpen: false, company: null });
  };

  // --- HANDLERS DE PLANOS ---
  const openCreateModal = () => {
      setPlanModal({
          isOpen: true,
          mode: 'create',
          planId: null,
          data: { name: '', price: '', features: [], stripePaymentLink: '' }
      });
      setErrorMsg('');
  };

  const openEditModal = (plan: SaasPlan) => {
      setPlanModal({
          isOpen: true,
          mode: 'edit',
          planId: plan.id,
          data: { 
              name: plan.name, 
              price: plan.price.toString(), 
              features: [...plan.features],
              stripePaymentLink: plan.stripePaymentLink || ''
          }
      });
      setErrorMsg('');
  };

  const handleAddFeature = () => {
      if (newFeatureText.trim()) {
          setPlanModal(prev => ({
              ...prev,
              data: { ...prev.data, features: [...prev.data.features, newFeatureText.trim()] }
          }));
          setNewFeatureText('');
      }
  };

  const handleRemoveFeature = (index: number) => {
      setPlanModal(prev => ({
          ...prev,
          data: { ...prev.data, features: prev.data.features.filter((_, i) => i !== index) }
      }));
  };

  const handleSavePlan = () => {
      setErrorMsg('');
      const price = parseFloat(planModal.data.price);
      if (!planModal.data.name || isNaN(price)) {
          setErrorMsg("Preencha o nome e o preço corretamente.");
          return;
      }
      if (planModal.data.features.length === 0) {
          setErrorMsg("Adicione pelo menos um recurso ao plano.");
          return;
      }

      try {
        if (planModal.mode === 'create') {
            addPlan({
                name: planModal.data.name,
                price: price,
                features: planModal.data.features,
                active: true,
                stripePaymentLink: planModal.data.stripePaymentLink,
                id: planModal.data.name.toLowerCase().replace(/\s/g, '-')
            });
        } else if (planModal.mode === 'edit' && planModal.planId) {
            updatePlan(planModal.planId, {
                name: planModal.data.name,
                price: price,
                features: planModal.data.features,
                stripePaymentLink: planModal.data.stripePaymentLink
            });
        }
        setPlanModal(prev => ({ ...prev, isOpen: false }));
      } catch (err) {
          setErrorMsg("Erro ao salvar o plano.");
      }
  };

  const handleDeletePlan = (id: string) => {
      if (window.confirm("Tem certeza que deseja excluir este plano?")) {
          removePlan(id);
      }
  };

  const togglePlanVisibility = (plan: SaasPlan) => {
      updatePlan(plan.id, { active: !plan.active });
  };

  return (
    <div className="space-y-8 relative pb-12">
      
      {/* --- SEÇÃO 1: GESTÃO DE ATIVAÇÕES (AGORA NO TOPO) --- */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <div className="bg-primary-100 p-2 rounded-lg text-primary-600">
                  <Clock className="w-5 h-5" />
              </div>
              <div>
                  <h2 className="text-lg font-bold text-slate-800">Gestão de Ativações</h2>
                  <p className="text-xs text-slate-500">Monitore o tempo restante e altere os planos das clínicas.</p>
              </div>
          </div>
          
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100">
                          <th className="px-6 py-4">Clínica / Admin</th>
                          <th className="px-6 py-4">Plano</th>
                          <th className="px-6 py-4">Vencimento</th>
                          <th className="px-6 py-4">Tempo Restante</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {companies.map(company => {
                          const days = getDaysRemaining(company.subscriptionExpiresAt);
                          const isExpired = days <= 0;
                          const planData = saasPlans.find(p => p.id === company.plan);

                          return (
                              <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                              <Building className="w-5 h-5" />
                                          </div>
                                          <div>
                                              <p className="font-bold text-slate-800 text-sm">{company.name}</p>
                                              <p className="text-[10px] text-slate-400 font-mono">ID: {company.id}</p>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <button 
                                          onClick={() => setPlanChangeModal({ isOpen: true, company })}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded border border-slate-200 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-all shadow-sm"
                                          title="Clique para alterar o plano desta clínica"
                                      >
                                          <RefreshCw className="w-3 h-3" />
                                          {planData?.name || company.plan}
                                      </button>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-2 text-sm text-slate-600">
                                          <Calendar className="w-4 h-4 text-slate-300" />
                                          {formatDate(company.subscriptionExpiresAt)}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500 animate-pulse' : days < 7 ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                                          <span className={`text-sm font-bold ${isExpired ? 'text-red-600' : days < 7 ? 'text-amber-600' : 'text-slate-700'}`}>
                                              {isExpired ? 'Expirado' : `${days} dias`}
                                          </span>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      <button 
                                          onClick={() => setTimeModal({ isOpen: true, company })}
                                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors shadow-sm"
                                      >
                                          <PlusCircle className="w-4 h-4" /> Adicionar Tempo
                                      </button>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </section>

      {/* --- SEÇÃO 2: CABEÇALHO DA PÁGINA (MOVIDO PARA BAIXO) --- */}
      <div className="flex justify-between items-center pt-4 border-t border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuração de Planos</h1>
          <p className="text-slate-500">Gerencie as ofertas, preços e links de checkout do seu SaaS.</p>
        </div>
        <button 
            onClick={openCreateModal}
            className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary-200 transition-all transform hover:-translate-y-0.5"
        >
            <Plus className="w-5 h-5" /> Novo Plano
        </button>
      </div>

      {/* LISTAGEM DE PLANOS (EXISTENTE) */}
      <div className="pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {saasPlans.map(plan => (
                  <div key={plan.id} className={`rounded-2xl p-8 border relative flex flex-col transition-all duration-300 ${plan.id === 'clinic' ? 'bg-slate-900 text-white border-slate-800 shadow-xl' : 'bg-white border-slate-200 text-slate-900 shadow-sm'} ${!plan.active ? 'opacity-75 grayscale' : ''}`}>
                      <div className="flex justify-between items-center mb-6">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${plan.active ? 'bg-green-500 border-green-500' : 'bg-transparent border-slate-400'}`}>
                                  {plan.active && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <input type="checkbox" className="hidden" checked={plan.active} onChange={() => togglePlanVisibility(plan)} />
                              <span className={`text-xs font-bold uppercase tracking-wider ${plan.id === 'clinic' ? 'text-slate-400' : 'text-slate-500'}`}>{plan.active ? 'Visível' : 'Oculto'}</span>
                          </label>
                          <button onClick={() => handleDeletePlan(plan.id)} className={`p-2 rounded-full transition-colors ${plan.id === 'clinic' ? 'hover:bg-slate-800 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`} title="Excluir Plano"><Trash2 className="w-4 h-4" /></button>
                      </div>

                      <div className="flex items-center gap-3 mb-4">
                          <div className={`p-2 rounded-lg ${plan.id === 'clinic' ? 'bg-slate-800 text-primary-400' : 'bg-primary-50 text-primary-600'}`}><Tag className="w-5 h-5" /></div>
                          <h3 className="font-bold text-xl capitalize">{plan.name}</h3>
                      </div>

                      <div className="mb-6">
                          <p className={`text-sm mb-1 ${plan.id === 'clinic' ? 'text-slate-400' : 'text-slate-500'}`}>Mensalidade</p>
                          <span className="text-4xl font-bold">R$ {plan.price.toFixed(2)}</span>
                      </div>

                      <ul className="space-y-3 mb-8 flex-1">
                          {plan.features.map((feat, i) => (
                              <li key={i} className="flex items-center gap-3 text-sm">
                                  <CheckCircle className={`w-4 h-4 ${plan.id === 'clinic' ? 'text-primary-400' : 'text-green-500'}`} />
                                  <span className={plan.id === 'clinic' ? 'text-slate-300' : 'text-slate-600'}>{feat}</span>
                              </li>
                          ))}
                      </ul>

                      <div className="space-y-3">
                          {plan.stripePaymentLink && <div className="text-xs flex items-center gap-2 opacity-70 justify-center"><LinkIcon className="w-3 h-3" /> Checkout Configurado</div>}
                          <button onClick={() => openEditModal(plan)} className={`w-full py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${plan.id === 'clinic' ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}><Edit className="w-4 h-4" /> Editar Plano</button>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* --- MODAL: ALTERAR PLANO DA CLÍNICA --- */}
      {planChangeModal.isOpen && planChangeModal.company && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                      <div>
                          <h3 className="font-bold text-slate-900">Alterar Plano Contratado</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{planChangeModal.company.name}</p>
                      </div>
                      <button onClick={() => setPlanChangeModal({ isOpen: false, company: null })} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-3 bg-slate-50">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Planos Ativos no Sistema</p>
                      {saasPlans.filter(p => p.active).map(plan => (
                          <button
                              key={plan.id}
                              onClick={() => handleChangePlan(plan.id)}
                              className={`w-full p-4 border rounded-xl flex items-center justify-between group transition-all text-left
                                  ${planChangeModal.company?.plan === plan.id 
                                      ? 'border-primary-500 bg-white ring-2 ring-primary-500 ring-opacity-10' 
                                      : 'border-slate-200 bg-white hover:border-primary-300 hover:bg-primary-50/30'}
                              `}
                          >
                              <div>
                                  <div className="flex items-center gap-2">
                                      <p className="font-bold text-slate-800 capitalize">{plan.name}</p>
                                      {planChangeModal.company?.plan === plan.id && (
                                          <span className="text-[9px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-bold uppercase">Atual</span>
                                      )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(plan.price)} / mês</p>
                              </div>
                              {planChangeModal.company?.plan === plan.id ? (
                                  <CheckCircle className="w-5 h-5 text-primary-600" />
                              ) : (
                                  <div className="bg-slate-100 p-1.5 rounded-full text-slate-300 group-hover:text-primary-500 group-hover:bg-primary-100 transition-colors">
                                      <ChevronRight className="w-4 h-4" />
                                  </div>
                              )}
                          </button>
                      ))}
                  </div>

                  <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                      <button onClick={() => setPlanChangeModal({ isOpen: false, company: null })} className="px-6 py-2 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-lg">Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL: ADICIONAR TEMPO MANUALMENTE --- */}
      {timeModal.isOpen && timeModal.company && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-bold text-slate-900">Extensão Manual</h3>
                      <button onClick={() => setTimeModal({ isOpen: false, company: null })} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 space-y-6">
                      <div>
                          <p className="text-xs text-slate-500 uppercase font-bold mb-1">Clínica Selecionada</p>
                          <p className="font-bold text-slate-800 text-lg">{timeModal.company.name}</p>
                          <p className="text-sm text-slate-500 mt-1">Vence em: {formatDate(timeModal.company.subscriptionExpiresAt)}</p>
                      </div>

                      <div className="space-y-3">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Escolha o Período</p>
                          <button onClick={() => handleAddTime(30)} className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-primary-500 hover:bg-primary-50/30 transition-all group">
                              <span className="font-bold text-slate-700">Adicionar 30 dias</span>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500" />
                          </button>
                          <button onClick={() => handleAddTime(90)} className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-primary-500 hover:bg-primary-50/30 transition-all group">
                              <span className="font-bold text-slate-700">Adicionar 90 dias</span>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500" />
                          </button>
                          <button onClick={() => handleAddTime(365)} className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-primary-500 hover:bg-primary-50/30 transition-all group">
                              <span className="font-bold text-slate-700">Adicionar 1 ano</span>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500" />
                          </button>
                      </div>
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100">
                      <button onClick={() => setTimeModal({ isOpen: false, company: null })} className="w-full py-2.5 text-slate-500 font-bold text-sm">Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      {/* Modal de Criar/Editar Plano */}
      {planModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-900">{planModal.mode === 'create' ? 'Criar Novo Plano' : 'Editar Plano'}</h3>
                      <button onClick={() => setPlanModal({ ...planModal, isOpen: false })} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6 bg-slate-50">
                      <div className="space-y-4 mb-6">
                          <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Nome do Plano</label>
                              <input type="text" className="w-full p-2 border border-slate-200 rounded-lg" placeholder="Ex: Enterprise" value={planModal.data.name} onChange={e => setPlanModal(prev => ({ ...prev, data: { ...prev.data, name: e.target.value } }))} />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Mensalidade (R$)</label>
                              <input type="number" className="w-full p-2 border border-slate-200 rounded-lg" placeholder="0.00" value={planModal.data.price} onChange={e => setPlanModal(prev => ({ ...prev, data: { ...prev.data, price: e.target.value } }))} />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Link de Pagamento</label>
                              <div className="relative">
                                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                  <input type="text" className="w-full pl-9 p-2 border border-slate-200 rounded-lg" placeholder="https://buy.stripe.com/..." value={planModal.data.stripePaymentLink} onChange={e => setPlanModal(prev => ({ ...prev, data: { ...prev.data, stripePaymentLink: e.target.value } }))} />
                              </div>
                          </div>
                      </div>

                      <div className="border-t border-slate-200 pt-4">
                          <label className="block text-xs font-medium text-slate-700 mb-2">Recursos</label>
                          <div className="flex gap-2 mb-4">
                              <input type="text" className="flex-1 p-2 border border-slate-200 rounded-lg text-sm" placeholder="Novo recurso" value={newFeatureText} onChange={e => setNewFeatureText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddFeature()} />
                              <button onClick={handleAddFeature} className="bg-primary-600 text-white p-2 rounded-lg hover:bg-primary-700 transition-colors"><Plus className="w-5 h-5" /></button>
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                              {planModal.data.features.map((feat, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm group">
                                      <span className="text-sm text-slate-700">{feat}</span>
                                      <button onClick={() => handleRemoveFeature(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  {errorMsg && <div className="p-4 bg-red-50 border-t border-red-100 text-red-700 text-sm flex items-center gap-2 justify-center"><AlertTriangle className="w-4 h-4" />{errorMsg}</div>}
                  <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                      <button onClick={() => setPlanModal({ ...planModal, isOpen: false })} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancelar</button>
                      <button onClick={handleSavePlan} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium shadow-lg">Salvar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Plans;
