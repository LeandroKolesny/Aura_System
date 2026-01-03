import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Zap, MessageCircle, RefreshCw, DollarSign, Filter, Search, Share2, Check, Crown, AlertTriangle, XCircle, TrendingUp, Building, ArrowRight, ArrowUpRight, Copy, X } from 'lucide-react';
import { generateReturnMessage, generateRetentionMessage } from '../services/geminiService';
import { formatCurrency, formatDate } from '../utils/formatUtils';
import { UserRole } from '../types';
import { UpgradeOverlay } from '../components/UpgradeOverlay';

// --- COMPONENTE 1: VISÃO DA CLÍNICA (Admin/Staff) ---
const ClinicMarketing: React.FC = () => {
  const { patients, appointments, currentCompany, isReadOnly, procedures, updatePatient } = useApp();
  const [activeTab, setActiveTab] = useState<'recovery' | 'maintenance'>('recovery');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMsg, setGeneratedMsg] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [daysFilter, setDaysFilter] = useState(90);

  const opportunities = useMemo(() => {
      const today = new Date();
      const list: any[] = [];

      patients.forEach(patient => {
          const patientAppts = appointments
              .filter(a => a.patientId === patient.id && a.status === 'completed')
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          const lastAppt = patientAppts[0];

          if (lastAppt) {
              const lastDate = new Date(lastAppt.date);
              const diffTime = Math.abs(today.getTime() - lastDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              const item = {
                  id: patient.id,
                  name: patient.name,
                  phone: patient.phone,
                  lastVisit: lastDate,
                  daysAgo: diffDays,
                  lastProcedure: lastAppt.service,
                  lastValue: lastAppt.price,
                  totalValue: patientAppts.reduce((acc, curr) => acc + curr.price, 0),
                  lastMarketingMessageSentAt: patient.lastMarketingMessageSentAt,
                  type: 'generic'
              };

              if (activeTab === 'recovery') {
                  if (diffDays >= daysFilter) {
                      list.push({ ...item, type: 'recovery' });
                  }
              }
              else if (activeTab === 'maintenance') {
                  const procConfig = procedures.find(p => p.name === lastAppt.service);
                  if (procConfig?.maintenanceRequired && procConfig.maintenanceIntervalDays) {
                      const interval = procConfig.maintenanceIntervalDays;
                      const minDays = interval - 15;
                      const maxDays = interval + 90;
                      
                      // Mostra se já passou do tempo ideal ou está próximo
                      if (diffDays >= minDays) {
                          list.push({ ...item, type: 'maintenance', maintenanceInterval: interval });
                      }
                  }
              }
          }
      });

      return list.sort((a, b) => b.daysAgo - a.daysAgo);
  }, [patients, appointments, activeTab, daysFilter, procedures]);

  const potentialRevenue = useMemo(() => {
      return opportunities.reduce((acc, curr) => acc + curr.lastValue, 0);
  }, [opportunities]);

  const handleGenerateMessage = async (patient: any) => {
      if (isReadOnly) return;
      setIsGenerating(true);
      setSelectedPatientId(patient.id);
      
      const clinicName = currentCompany?.name || "Nossa Clínica";
      const msg = await generateReturnMessage(patient.name, patient.lastProcedure, patient.daysAgo, clinicName);
      
      setGeneratedMsg(msg);
      setIsGenerating(false);
  };

  const handleSendMessage = () => {
      const patient = patients.find(p => p.id === selectedPatientId);
      if (patient && generatedMsg) {
          updatePatient(patient.id, { lastMarketingMessageSentAt: new Date().toISOString() });
          const phone = patient.phone.replace(/\D/g, '');
          const url = `https://wa.me/55${phone}?text=${encodeURIComponent(generatedMsg)}`;
          window.open(url, '_blank');
          setGeneratedMsg(null);
          setSelectedPatientId(null);
      }
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Zap className="w-6 h-6 text-amber-500 fill-amber-500" /> Pós-vendas / IA
                </h1>
                <p className="text-slate-500">Recupere clientes inativos e garanta o retorno de procedimentos recorrentes.</p>
            </div>
            
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <button 
                    onClick={() => { setActiveTab('recovery'); setGeneratedMsg(null); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                        ${activeTab === 'recovery' ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
                    `}
                >
                    <RefreshCw className="w-4 h-4" /> Recuperação de Inativos
                </button>
                <button 
                    onClick={() => { setActiveTab('maintenance'); setGeneratedMsg(null); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                        ${activeTab === 'maintenance' ? 'bg-purple-100 text-purple-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
                    `}
                >
                    <Sparkles className="w-4 h-4" /> Ciclo de Manutenção
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Search className="w-5 h-5" /></div>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Oportunidades</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{opportunities.length}</div>
                <p className="text-xs text-slate-400 mt-1">Clientes identificados na lista</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-green-100 p-2 rounded-lg text-green-600"><DollarSign className="w-5 h-5" /></div>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Receita Potencial</span>
                </div>
                <div className="text-3xl font-bold text-green-600">{formatCurrency(potentialRevenue)}</div>
                <p className="text-xs text-slate-400 mt-1">Baseado no último ticket de cada cliente</p>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-xl shadow-lg text-white flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-200" /> Aura AI ativada</h3>
                <p className="text-amber-100 text-sm opacity-90">
                    Use a inteligência artificial para criar mensagens personalizadas e aumentar sua taxa de conversão.
                </p>
            </div>
        </div>

        {activeTab === 'recovery' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">Mostrar clientes sem visita há mais de:</span>
                <select 
                    className="bg-white border border-slate-300 rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-amber-500 outline-none"
                    value={daysFilter}
                    onChange={(e) => setDaysFilter(Number(e.target.value))}
                >
                    <option value={30}>30 dias</option>
                    <option value={60}>60 dias</option>
                    <option value={90}>90 dias</option>
                    <option value={180}>6 meses</option>
                    <option value={365}>1 ano</option>
                </select>
            </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Última Visita</th>
                            <th className="px-6 py-4">Procedimento Anterior</th>
                            <th className="px-6 py-4 text-right">Potencial</th>
                            <th className="px-6 py-4 text-center">Ação</th>
                            <th className="px-6 py-4 text-center">Status Envio</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {opportunities.map((opp) => {
                            const hasSentMessage = opp.lastMarketingMessageSentAt && 
                                                   new Date(opp.lastMarketingMessageSentAt) > new Date(opp.lastVisit);
                            
                            return (
                                <tr key={opp.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                                                {opp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{opp.name}</div>
                                                <div className="text-xs text-slate-500">{opp.phone}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {formatDate(opp.lastVisit)}
                                        <span className="block text-xs text-slate-400">{opp.daysAgo} dias atrás</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {opp.lastProcedure}
                                        {opp.type === 'maintenance' && (
                                            <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-bold">
                                                Retoque
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-green-600">
                                        {formatCurrency(opp.lastValue)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {generatedMsg && selectedPatientId === opp.id ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={handleSendMessage}
                                                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                                                >
                                                    <Share2 className="w-3 h-3" /> Enviar
                                                </button>
                                                <button 
                                                    onClick={() => { setGeneratedMsg(null); setSelectedPatientId(null); }}
                                                    className="text-slate-400 hover:text-slate-600 p-1"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handleGenerateMessage(opp)}
                                                disabled={isGenerating || hasSentMessage}
                                                className={`mx-auto px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors
                                                    ${hasSentMessage 
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}
                                                `}
                                            >
                                                <MessageCircle className="w-3 h-3" /> {isGenerating && selectedPatientId === opp.id ? 'Gerando...' : 'Gerar Msg'}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center align-middle">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            {hasSentMessage ? (
                                                <>
                                                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                                        <Check className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-[10px] font-medium text-green-600 uppercase tracking-wide">Enviado</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
                                                        <X className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-[10px] font-medium text-red-400 uppercase tracking-wide">Não enviado</span>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {opportunities.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                                    Nenhuma oportunidade encontrada com os filtros atuais.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* MODAL CENTRALIZADO (CLINIC VIEW) */}
        {generatedMsg && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-full max-w-lg relative">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                            <Sparkles className="w-5 h-5 text-amber-500" /> Sugestão da IA
                        </h4>
                        <button onClick={() => { setGeneratedMsg(null); setSelectedPatientId(null); }} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl text-slate-700 leading-relaxed italic border border-slate-200 max-h-[60vh] overflow-y-auto mb-6">
                        "{generatedMsg}"
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button 
                            onClick={handleSendMessage}
                            className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all"
                        >
                            <Share2 className="w-4 h-4" /> Enviar no WhatsApp
                        </button>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(generatedMsg);
                                alert("Mensagem copiada!");
                            }}
                            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                        >
                            <Copy className="w-4 h-4" /> Copiar Texto
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

// --- COMPONENTE 2: VISÃO SAAS (Owner) ---
const SaaSMarketing: React.FC = () => {
    const { companies, saasPlans, updateCompany } = useApp();
    const [activeTab, setActiveTab] = useState<'churn' | 'upsell'>('churn');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [generatedMsg, setGeneratedMsg] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Mapeamento de Oportunidades
    const opportunities = useMemo(() => {
        const today = new Date();
        const list: any[] = [];

        companies.forEach(company => {
            const expires = new Date(company.subscriptionExpiresAt);
            const diffTime = expires.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const plan = saasPlans.find(p => p.id === company.plan);
            const mrr = plan ? plan.price : 0;

            // Busca nome do plano antigo se existir
            let lastPlanName = '';
            if (company.lastPlan) {
                lastPlanName = saasPlans.find(p => p.id === company.lastPlan)?.name || company.lastPlan;
            }

            const baseItem = {
                id: company.id,
                name: company.name,
                contact: company.phones?.[0] || 'Sem telefone',
                plan: company.plan,
                lastPlan: company.lastPlan,
                lastPlanName: lastPlanName,
                mrr: mrr,
                daysLeft: daysLeft,
                status: company.subscriptionStatus,
                lastMarketingSentAt: company.lastMarketingSentAt
            };

            // Lógica CHURN (Risco de Perda):
            // Clientes Pagantes (Pro/Clinic) que estão vencendo (< 7 dias) ou já vencidos ('overdue')
            // mas que AINDA NÃO caíram para o plano 'basic'.
            if (activeTab === 'churn') {
                if (company.plan !== 'basic' && company.plan !== 'free' && (daysLeft < 7 || company.subscriptionStatus === 'overdue')) {
                    list.push({ ...baseItem, type: 'churn' });
                }
            }
            // Lógica UPSELL / RECUPERAÇÃO:
            // 1. Clientes em planos de entrada (Free/Starter) ativos (Upsell Padrão)
            // 2. Clientes que CAÍRAM para 'basic' (Expirados) que tinham plano anterior (Recuperação/Win-back)
            else if (activeTab === 'upsell') {
                const isLowTier = ['free', 'starter'].includes(company.plan);
                const isExpiredBasic = company.plan === 'basic' && !!company.lastPlan;

                if (isLowTier || isExpiredBasic) {
                    list.push({ 
                        ...baseItem, 
                        type: isExpiredBasic ? 'winback' : 'upsell' 
                    });
                }
            }
        });

        // Ordenar: Prioridade para quem paga mais ou venceu há mais tempo
        return list.sort((a, b) => a.daysLeft - b.daysLeft);
    }, [companies, saasPlans, activeTab]);

    const totalRiskMRR = useMemo(() => {
        if (activeTab === 'churn') return opportunities.reduce((acc, curr) => acc + curr.mrr, 0);
        // Para upsell, poderíamos somar o valor potencial, mas deixaremos 0 por enquanto
        return 0;
    }, [opportunities, activeTab]);

    const handleGenerateMessage = async (company: any) => {
        setIsGenerating(true);
        setSelectedCompanyId(company.id);
        const planName = saasPlans.find(p => p.id === company.plan)?.name || company.plan;
        
        let scenario: 'overdue' | 'expiring' | 'upsell' | 'winback' = 'expiring';
        
        if (activeTab === 'churn') {
            if (company.daysLeft < 0) {
                scenario = 'overdue';
            } else {
                scenario = 'expiring';
            }
        } else {
            if (company.type === 'winback') {
                scenario = 'winback';
            } else {
                scenario = 'upsell';
            }
        }

        // Melhoria: Vamos chamar generateRetentionMessage passando o plano ALVO se for winback
        const targetPlan = company.type === 'winback' ? company.lastPlanName : planName;
        
        const msg = await generateRetentionMessage(company.name, Math.abs(company.daysLeft), targetPlan, scenario);
        
        setGeneratedMsg(msg);
        setIsGenerating(false);
    };

    const handleCopyMessage = () => {
        if (generatedMsg) {
            navigator.clipboard.writeText(generatedMsg);
            alert("Mensagem copiada para a área de transferência!");
        }
    };

    const handleSendWhatsApp = () => {
        if (generatedMsg && selectedCompanyId) {
            const company = companies.find(c => c.id === selectedCompanyId);
            // Atualiza status na empresa
            updateCompany(selectedCompanyId, { lastMarketingSentAt: new Date().toISOString() });

            const phone = company?.phones?.[0]?.replace(/\D/g, '');
            if (phone) {
                const url = `https://wa.me/55${phone}?text=${encodeURIComponent(generatedMsg)}`;
                window.open(url, '_blank');
                setGeneratedMsg(null);
                setSelectedCompanyId(null);
            } else {
                alert("Esta empresa não possui um telefone cadastrado válido para WhatsApp.");
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Crown className="w-6 h-6 text-amber-500" /> Customer Success (SaaS)
                    </h1>
                    <p className="text-slate-500">Gestão inteligente de retenção e expansão da base de clínicas.</p>
                </div>

                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button 
                        onClick={() => { setActiveTab('churn'); setGeneratedMsg(null); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                            ${activeTab === 'churn' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
                        `}
                    >
                        <AlertTriangle className="w-4 h-4" /> Prevenção de Churn
                    </button>
                    <button 
                        onClick={() => { setActiveTab('upsell'); setGeneratedMsg(null); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                            ${activeTab === 'upsell' ? 'bg-green-50 text-green-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
                        `}
                    >
                        <TrendingUp className="w-4 h-4" /> Oportunidades Upsell
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${activeTab === 'churn' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            <Building className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                            {activeTab === 'churn' ? 'Clínicas em Risco' : 'Potencial de Expansão'}
                        </span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{opportunities.length}</div>
                    <p className="text-xs text-slate-400 mt-1">Empresas listadas abaixo</p>
                </div>

                {activeTab === 'churn' && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><DollarSign className="w-5 h-5" /></div>
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">MRR em Risco</span>
                        </div>
                        <div className="text-3xl font-bold text-amber-600">{formatCurrency(totalRiskMRR)}</div>
                        <p className="text-xs text-slate-400 mt-1">Receita mensal recorrente ameaçada</p>
                    </div>
                )}

                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-xl shadow-lg text-white flex flex-col justify-center relative overflow-hidden md:col-span-1">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-200" /> B2B Intelligence</h3>
                    <p className="text-indigo-100 text-sm opacity-90">
                        IA treinada para comunicação corporativa. Gere e-mails e mensagens de negociação em segundos.
                    </p>
                </div>
            </div>

            {/* Tabela de Oportunidades */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Clínica</th>
                                <th className="px-6 py-4">Plano Atual</th>
                                <th className="px-6 py-4">Status / Vencimento</th>
                                <th className="px-6 py-4 text-right">Valor Mensal</th>
                                <th className="px-6 py-4 text-center">Ação Recomendada</th>
                                <th className="px-6 py-4 text-center">Status Envio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {opportunities.map((opp) => {
                                const hasSentMessage = opp.lastMarketingSentAt;
                                return (
                                <tr key={opp.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div>
                                            <div className="font-bold text-slate-800">{opp.name}</div>
                                            <div className="text-xs text-slate-500">{opp.contact}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-start">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold uppercase border border-slate-200">
                                                {opp.plan}
                                            </span>
                                            {/* MOSTRAR PLANO ANTIGO SE FOR WINBACK */}
                                            {opp.lastPlanName && opp.plan === 'basic' && (
                                                <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                    <ArrowUpRight className="w-3 h-3" /> Era {opp.lastPlanName}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {opp.daysLeft < 0 ? (
                                            <span className="text-red-600 font-bold flex items-center gap-1">
                                                <XCircle className="w-3 h-3" /> Venceu há {Math.abs(opp.daysLeft)} dias
                                            </span>
                                        ) : opp.daysLeft <= 7 ? (
                                            <span className="text-amber-600 font-bold flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" /> Vence em {opp.daysLeft} dias
                                            </span>
                                        ) : (
                                            <span className="text-green-600 font-medium">
                                                {opp.daysLeft} dias restantes
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-700">
                                        {formatCurrency(opp.mrr)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {generatedMsg && selectedCompanyId === opp.id ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-default"
                                                >
                                                    <Check className="w-3 h-3" /> Gerado
                                                </button>
                                                <button 
                                                    onClick={() => { setGeneratedMsg(null); setSelectedCompanyId(null); }}
                                                    className="text-slate-400 hover:text-slate-600 p-1"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handleGenerateMessage(opp)}
                                                disabled={isGenerating}
                                                className={`mx-auto px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors
                                                    ${isGenerating && selectedCompanyId === opp.id
                                                        ? 'bg-slate-100 text-slate-400' 
                                                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}
                                                `}
                                            >
                                                <Sparkles className="w-3 h-3" /> 
                                                {isGenerating && selectedCompanyId === opp.id ? 'Gerando...' : (activeTab === 'churn' ? 'Cobrar' : 'Ofertar')}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center align-middle">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            {hasSentMessage ? (
                                                <>
                                                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                                        <Check className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-[10px] font-medium text-green-600 uppercase tracking-wide">Enviado</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
                                                        <X className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-[10px] font-medium text-red-400 uppercase tracking-wide">Não enviado</span>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )})}
                            {opportunities.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                                        Nenhuma clínica encontrada para esta categoria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL CENTRALIZADO */}
            {generatedMsg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-full max-w-lg relative">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                <Sparkles className="w-5 h-5 text-indigo-500" /> Sugestão B2B (IA)
                            </h4>
                            <button onClick={() => { setGeneratedMsg(null); setSelectedCompanyId(null); }} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-xl text-slate-700 leading-relaxed italic border border-slate-200 max-h-[60vh] overflow-y-auto mb-6">
                            "{generatedMsg}"
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button 
                                onClick={handleSendWhatsApp}
                                className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all"
                            >
                                <Share2 className="w-4 h-4" /> Enviar no WhatsApp
                            </button>
                            <button 
                                onClick={handleCopyMessage}
                                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                            >
                                <Copy className="w-4 h-4" /> Copiar Texto
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---
const Marketing: React.FC = () => {
  const { user, checkModuleAccess } = useApp();

  // Verifica tanto ai_features quanto crm - precisa de um dos dois
  const hasMarketingAccess = checkModuleAccess('ai_features') || checkModuleAccess('crm');

  const content = user?.role === UserRole.OWNER ? <SaaSMarketing /> : <ClinicMarketing />;

  if (!hasMarketingAccess) {
    return (
      <UpgradeOverlay message="Ative a versão Pro ou superior para acessar Pós-vendas / Marketing com IA.">
        {content}
      </UpgradeOverlay>
    );
  }

  return content;
};

export default Marketing;
