import React, { useState, useEffect } from 'react';
import {
  Settings, DollarSign, Bell, Shield, Database, Mail,
  Save, RefreshCw, CheckCircle, AlertTriangle, Globe, Palette,
  Plus, X, Edit, Trash2, Building, Calendar, Clock, PlusCircle,
  ChevronRight, Link as LinkIcon, Tag, Eye, EyeOff
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SaasPlan, Company } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatUtils';
import { systemApi } from '../../services/api';

const KingSettings: React.FC = () => {
  const {
    saasPlans, addPlan, updatePlan, removePlan, loadPlans,
    companies, updateCompany
  } = useApp();

  // Carregar planos da API ao montar
  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const [activeTab, setActiveTab] = useState<'plans' | 'notifications' | 'system' | 'appearance'>('plans');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // === ESTADOS PARA GESTAO DE PLANOS ===

  // Modal de Criar/Editar Plano
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

  // Modal de Adicionar Tempo
  const [timeModal, setTimeModal] = useState<{ isOpen: boolean; company: Company | null }>({
    isOpen: false,
    company: null
  });

  // Modal de Alterar Plano da Empresa
  const [planChangeModal, setPlanChangeModal] = useState<{ isOpen: boolean; company: Company | null }>({
    isOpen: false,
    company: null
  });

  const [newFeatureText, setNewFeatureText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Configuracoes de notificacoes (local state - pode ser migrado para API)
  const [notifications, setNotifications] = useState({
    newCompanyEmail: true,
    overdueEmail: true,
    weeklyReport: true,
    trialExpiringEmail: true,
    lowActivityAlert: false,
  });

  // Configuracoes do sistema (local state - pode ser migrado para API)
  const [systemConfig, setSystemConfig] = useState({
    trialDays: 14,
    gracePeriodDays: 7,
    maxUsersDefault: 5,
    autoSuspendOverdue: true,
  });

  // Estado do modo manutencao (vem da API)
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState('');

  // Carregar status de manutencao ao montar
  useEffect(() => {
    const loadMaintenanceStatus = async () => {
      try {
        const response = await systemApi.getMaintenance();
        if (response.success && response.data) {
          setMaintenanceMode(response.data.maintenanceMode || false);
        }
      } catch (error) {
        console.error('Erro ao carregar status de manutencao:', error);
      }
    };
    loadMaintenanceStatus();
  }, []);

  // Handler para ativar/desativar manutencao
  const handleToggleMaintenance = async (enabled: boolean) => {
    setMaintenanceLoading(true);
    setMaintenanceError('');

    try {
      const response = await systemApi.setMaintenance(enabled);

      if (response.success) {
        setMaintenanceMode(enabled);
        if (enabled) {
          alert('Modo manutencao ATIVADO! Usuarios serao impedidos de fazer login.');
        } else {
          alert('Modo manutencao DESATIVADO! Sistema voltou ao normal.');
        }
      } else {
        setMaintenanceError(response.error || 'Erro ao alterar modo manutencao');
      }
    } catch (error) {
      console.error('Erro ao alterar modo manutencao:', error);
      setMaintenanceError('Erro de conexao. Tente novamente.');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  // === HANDLERS DE GESTAO DE ATIVACOES ===

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

    updateCompany(planChangeModal.company.id, { plan: planId });
    setPlanChangeModal({ isOpen: false, company: null });
  };

  // === HANDLERS DE CRUD DE PLANOS ===

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

  const [savingPlan, setSavingPlan] = useState(false);

  const handleSavePlan = async () => {
    setErrorMsg('');
    const price = parseFloat(planModal.data.price);

    if (!planModal.data.name || isNaN(price)) {
      setErrorMsg("Preencha o nome e o preco corretamente.");
      return;
    }
    if (planModal.data.features.length === 0) {
      setErrorMsg("Adicione pelo menos um recurso ao plano.");
      return;
    }

    setSavingPlan(true);
    try {
      if (planModal.mode === 'create') {
        const result = await addPlan({
          name: planModal.data.name,
          price: price,
          features: planModal.data.features,
          active: true,
          stripePaymentLink: planModal.data.stripePaymentLink
        });
        if (!result.success) {
          setErrorMsg(result.error || "Erro ao criar plano.");
          setSavingPlan(false);
          return;
        }
      } else if (planModal.mode === 'edit' && planModal.planId) {
        const result = await updatePlan(planModal.planId, {
          name: planModal.data.name,
          price: price,
          features: planModal.data.features,
          stripePaymentLink: planModal.data.stripePaymentLink
        });
        if (!result.success) {
          setErrorMsg(result.error || "Erro ao atualizar plano.");
          setSavingPlan(false);
          return;
        }
      }
      setPlanModal(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
      setErrorMsg("Erro ao salvar o plano.");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este plano?")) {
      const result = await removePlan(id);
      if (!result.success) {
        alert("Erro ao excluir plano: " + (result.error || "Erro desconhecido"));
      }
    }
  };

  const togglePlanVisibility = async (plan: SaasPlan) => {
    const result = await updatePlan(plan.id, { active: !plan.active });
    if (!result.success) {
      alert("Erro ao alterar visibilidade: " + (result.error || "Erro desconhecido"));
    }
  };

  // === HANDLER DE SALVAR CONFIGURACOES ===

  const handleSave = async () => {
    setSaving(true);
    // TODO: Implementar salvamento das configuracoes no backend
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs = [
    { id: 'plans', label: 'Planos & Precos', icon: DollarSign },
    { id: 'notifications', label: 'Notificacoes/Email', icon: Bell },
    { id: 'system', label: 'Sistema', icon: Database },
    { id: 'appearance', label: 'Aparencia', icon: Palette },
  ];

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-slate-500" />
            Configuracoes do Sistema
          </h1>
          <p className="text-slate-500 mt-1">Gerencie as configuracoes globais do Aura System</p>
        </div>
        {activeTab !== 'plans' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</>
            ) : saved ? (
              <><CheckCircle className="w-4 h-4" /> Salvo!</>
            ) : (
              <><Save className="w-4 h-4" /> Salvar Alteracoes</>
            )}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-50 text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* ============ ABA PLANOS & PRECOS ============ */}
          {activeTab === 'plans' && (
            <div className="space-y-8">

              {/* SECAO 1: GESTAO DE ATIVACOES */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Gestao de Ativacoes</h2>
                    <p className="text-xs text-slate-500">Monitore o tempo restante e altere os planos das clinicas</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                        <th className="px-4 py-3">Clinica</th>
                        <th className="px-4 py-3">Plano</th>
                        <th className="px-4 py-3">Vencimento</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Acoes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {companies.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                            Nenhuma empresa cadastrada
                          </td>
                        </tr>
                      ) : (
                        companies.map(company => {
                          const days = getDaysRemaining(company.subscriptionExpiresAt);
                          const isExpired = days <= 0;
                          const planData = saasPlans.find(p => p.id === company.plan);

                          return (
                            <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                    <Building className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800 text-sm">{company.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{company.slug || company.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setPlanChangeModal({ isOpen: true, company })}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded border border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  {planData?.name || company.plan || 'Free'}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <Calendar className="w-4 h-4 text-slate-300" />
                                  {formatDate(company.subscriptionExpiresAt)}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500 animate-pulse' : days < 7 ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                                  <span className={`text-sm font-bold ${isExpired ? 'text-red-600' : days < 7 ? 'text-amber-600' : 'text-slate-700'}`}>
                                    {isExpired ? 'Expirado' : `${days} dias`}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => setTimeModal({ isOpen: true, company })}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors"
                                >
                                  <PlusCircle className="w-3 h-3" /> Adicionar Tempo
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* SECAO 2: CONFIGURACAO DE PLANOS */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Configuracao de Planos</h2>
                      <p className="text-xs text-slate-500">Gerencie os planos disponiveis na landing page</p>
                    </div>
                  </div>
                  <button
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Novo Plano
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">Alteracoes nos precos afetarao apenas novas assinaturas. Clientes existentes manterao os valores atuais.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {saasPlans.map(plan => (
                    <div
                      key={plan.id}
                      className={`bg-white rounded-xl p-5 border-2 transition-all ${
                        !plan.active ? 'opacity-60 grayscale border-slate-200' :
                        plan.id === 'clinic' ? 'border-amber-400 shadow-lg' : 'border-slate-200'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            plan.id === 'starter' ? 'bg-blue-100 text-blue-600' :
                            plan.id === 'pro' ? 'bg-purple-100 text-purple-600' :
                            plan.id === 'clinic' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Tag className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">{plan.name}</h4>
                            <p className="text-lg font-bold text-slate-900">{formatCurrency(plan.price)}<span className="text-xs text-slate-400 font-normal">/mes</span></p>
                          </div>
                        </div>
                        <button
                          onClick={() => togglePlanVisibility(plan)}
                          className={`p-2 rounded-lg transition-colors ${
                            plan.active ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title={plan.active ? 'Visivel na landing' : 'Oculto na landing'}
                        >
                          {plan.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Features */}
                      <ul className="space-y-2 mb-4">
                        {plan.features.slice(0, 4).map((feat, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span className="truncate">{feat}</span>
                          </li>
                        ))}
                        {plan.features.length > 4 && (
                          <li className="text-xs text-slate-400 pl-6">+{plan.features.length - 4} mais recursos</li>
                        )}
                      </ul>

                      {/* Stripe Link */}
                      {plan.stripePaymentLink && (
                        <div className="text-xs text-slate-400 flex items-center gap-1 mb-4">
                          <LinkIcon className="w-3 h-3" /> Checkout configurado
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(plan)}
                          className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                        >
                          <Edit className="w-4 h-4" /> Editar
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ============ ABA NOTIFICACOES ============ */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <p className="text-sm text-slate-600">Configure quais notificacoes voce deseja receber como Owner do sistema.</p>

              <div className="space-y-4">
                {[
                  { key: 'newCompanyEmail', label: 'Nova empresa cadastrada', desc: 'Receba um email quando uma nova empresa se cadastrar' },
                  { key: 'overdueEmail', label: 'Assinatura inadimplente', desc: 'Alertas quando uma empresa ficar inadimplente' },
                  { key: 'weeklyReport', label: 'Relatorio semanal', desc: 'Resumo semanal de metricas do sistema' },
                  { key: 'trialExpiringEmail', label: 'Trial expirando', desc: 'Aviso quando um trial estiver proximo do fim' },
                  { key: 'lowActivityAlert', label: 'Baixa atividade', desc: 'Alerta quando empresas apresentarem baixa atividade' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <Mail className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications[item.key as keyof typeof notifications]}
                        onChange={(e) => setNotifications(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============ ABA SISTEMA ============ */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Configuracoes de Trial
                  </h4>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Dias de Trial</label>
                      <input
                        type="number"
                        value={systemConfig.trialDays}
                        onChange={(e) => setSystemConfig(prev => ({ ...prev, trialDays: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Periodo de teste gratuito para novas empresas</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Dias de Carencia</label>
                      <input
                        type="number"
                        value={systemConfig.gracePeriodDays}
                        onChange={(e) => setSystemConfig(prev => ({ ...prev, gracePeriodDays: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Dias apos vencimento antes de suspender</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Configuracoes Padrao
                  </h4>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Max. Usuarios (padrao)</label>
                      <input
                        type="number"
                        value={systemConfig.maxUsersDefault}
                        onChange={(e) => setSystemConfig(prev => ({ ...prev, maxUsersDefault: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Limite padrao de usuarios por empresa</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">Suspender automaticamente</p>
                        <p className="text-xs text-slate-500">Suspender apos periodo de carencia</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={systemConfig.autoSuspendOverdue}
                          onChange={(e) => setSystemConfig(prev => ({ ...prev, autoSuspendOverdue: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modo Manutencao */}
              <div className={`p-4 rounded-xl border-2 ${maintenanceMode ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${maintenanceMode ? 'bg-red-100' : 'bg-white border border-slate-200'}`}>
                      <Globe className={`w-5 h-5 ${maintenanceMode ? 'text-red-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Modo Manutencao</p>
                      <p className="text-xs text-slate-500">Bloqueia login de todas as empresas no sistema</p>
                    </div>
                  </div>
                  {maintenanceLoading ? (
                    <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
                  ) : (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={maintenanceMode}
                        onChange={(e) => handleToggleMaintenance(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  )}
                </div>
                {maintenanceError && (
                  <div className="mt-3 p-3 bg-amber-100 rounded-lg">
                    <p className="text-sm text-amber-700 font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {maintenanceError}
                    </p>
                  </div>
                )}
                {maintenanceMode && (
                  <div className="mt-3 p-3 bg-red-100 rounded-lg">
                    <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      O sistema esta em modo manutencao. Usuarios nao conseguirao fazer login.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ ABA APARENCIA ============ */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <p className="text-sm text-slate-600">Personalize a aparencia global do Aura System.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-4">Logo do Sistema</h4>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
                      A
                    </div>
                    <div>
                      <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                        Alterar Logo
                      </button>
                      <p className="text-xs text-slate-500 mt-2">PNG ou SVG, max. 2MB</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-4">Cor Principal</h4>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      defaultValue="#8B5CF6"
                      className="w-20 h-20 rounded-xl cursor-pointer border-0"
                    />
                    <div>
                      <p className="text-sm text-slate-700 font-medium">Cor da marca</p>
                      <p className="text-xs text-slate-500 mt-1">Aplicada em botoes e elementos de destaque</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="font-bold text-slate-800 mb-4">Preview do Tema</h4>
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg"></div>
                    <div>
                      <p className="font-bold text-slate-800">Aura System</p>
                      <p className="text-xs text-slate-500">Gestao para clinicas de estetica</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium">
                      Botao Primario
                    </button>
                    <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">
                      Botao Secundario
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ MODAL: ALTERAR PLANO DA EMPRESA ============ */}
      {planChangeModal.isOpen && planChangeModal.company && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900">Alterar Plano</h3>
                <p className="text-xs text-slate-500 mt-0.5">{planChangeModal.company.name}</p>
              </div>
              <button onClick={() => setPlanChangeModal({ isOpen: false, company: null })} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 bg-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Planos Disponiveis</p>
              {saasPlans.filter(p => p.active).map(plan => (
                <button
                  key={plan.id}
                  onClick={() => handleChangePlan(plan.id)}
                  className={`w-full p-4 border rounded-xl flex items-center justify-between group transition-all text-left ${
                    planChangeModal.company?.plan === plan.id
                      ? 'border-amber-500 bg-white ring-2 ring-amber-500 ring-opacity-20'
                      : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800">{plan.name}</p>
                      {planChangeModal.company?.plan === plan.id && (
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">Atual</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(plan.price)} / mes</p>
                  </div>
                  {planChangeModal.company?.plan === plan.id ? (
                    <CheckCircle className="w-5 h-5 text-amber-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => setPlanChangeModal({ isOpen: false, company: null })} className="px-6 py-2 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-lg">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: ADICIONAR TEMPO ============ */}
      {timeModal.isOpen && timeModal.company && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-900">Extensao Manual</h3>
              <button onClick={() => setTimeModal({ isOpen: false, company: null })} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Clinica Selecionada</p>
                <p className="font-bold text-slate-800 text-lg">{timeModal.company.name}</p>
                <p className="text-sm text-slate-500 mt-1">Vence em: {formatDate(timeModal.company.subscriptionExpiresAt)}</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Escolha o Periodo</p>
                <button onClick={() => handleAddTime(30)} className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-amber-500 hover:bg-amber-50/30 transition-all group">
                  <span className="font-bold text-slate-700">Adicionar 30 dias</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500" />
                </button>
                <button onClick={() => handleAddTime(90)} className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-amber-500 hover:bg-amber-50/30 transition-all group">
                  <span className="font-bold text-slate-700">Adicionar 90 dias</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500" />
                </button>
                <button onClick={() => handleAddTime(365)} className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-amber-500 hover:bg-amber-50/30 transition-all group">
                  <span className="font-bold text-slate-700">Adicionar 1 ano</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button onClick={() => setTimeModal({ isOpen: false, company: null })} className="w-full py-2.5 text-slate-500 font-bold text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: CRIAR/EDITAR PLANO ============ */}
      {planModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-slate-900">
                {planModal.mode === 'create' ? 'Criar Novo Plano' : 'Editar Plano'}
              </h3>
              <button onClick={() => setPlanModal({ ...planModal, isOpen: false })} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-50 overflow-y-auto flex-1">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nome do Plano</label>
                  <input
                    type="text"
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Ex: Enterprise"
                    value={planModal.data.name}
                    onChange={e => setPlanModal(prev => ({ ...prev, data: { ...prev.data, name: e.target.value } }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mensalidade (R$)</label>
                  <input
                    type="number"
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="0.00"
                    value={planModal.data.price}
                    onChange={e => setPlanModal(prev => ({ ...prev, data: { ...prev.data, price: e.target.value } }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Link de Pagamento (Stripe)</label>
                  <div className="relative">
                    <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      className="w-full pl-9 p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="https://buy.stripe.com/..."
                      value={planModal.data.stripePaymentLink}
                      onChange={e => setPlanModal(prev => ({ ...prev, data: { ...prev.data, stripePaymentLink: e.target.value } }))}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <label className="block text-xs font-medium text-slate-700 mb-2">Recursos do Plano</label>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    className="flex-1 p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Novo recurso"
                    value={newFeatureText}
                    onChange={e => setNewFeatureText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddFeature()}
                  />
                  <button onClick={handleAddFeature} className="bg-emerald-600 text-white p-2.5 rounded-lg hover:bg-emerald-700 transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {planModal.data.features.map((feat, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <span className="text-sm text-slate-700">{feat}</span>
                      <button onClick={() => handleRemoveFeature(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {planModal.data.features.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">Adicione recursos ao plano</p>
                  )}
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-4 bg-red-50 border-t border-red-100 text-red-700 text-sm flex items-center gap-2 justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />{errorMsg}
              </div>
            )}

            <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
              <button onClick={() => setPlanModal({ ...planModal, isOpen: false })} disabled={savingPlan} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleSavePlan} disabled={savingPlan} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                {savingPlan ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KingSettings;
