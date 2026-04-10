import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  CreditCard, Plus, Users, DollarSign, ToggleLeft, ToggleRight,
  Loader2, AlertTriangle, Edit2, UserX, CheckCircle, Clock
} from 'lucide-react';
import { subscriptionsApi, SubscriptionPlan, PatientSubscription } from '../services/api';
import SubscriptionPlanModal from '../components/SubscriptionPlanModal';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const STATUS_CONFIG: Record<PatientSubscription['status'], { label: string; badge: string }> = {
  ACTIVE:   { label: 'Ativa',      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PAUSED:   { label: 'Pausada',    badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  CANCELED: { label: 'Cancelada',  badge: 'bg-slate-100 text-slate-500 border-slate-200' },
  OVERDUE:  { label: 'Em atraso',  badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  PENDING:  { label: 'Pendente',   badge: 'bg-purple-50 text-purple-700 border-purple-200' },
};

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

const KPICard: React.FC<{ icon: React.ElementType; label: string; value: string | number; color: string }> = ({
  icon: Icon, label, value, color,
}) => (
  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
    </div>
  </div>
);

// ──────────────────────────────────────────────
// Enroll Modal (simple)
// ──────────────────────────────────────────────

interface EnrollModalProps {
  plans: SubscriptionPlan[];
  patients: { id: string; name: string }[];
  onClose: () => void;
  onEnrolled: () => void;
}

const EnrollModal: React.FC<EnrollModalProps> = ({ plans, patients, onClose, onEnrolled }) => {
  const [patientId, setPatientId] = useState('');
  const [planId, setPlanId] = useState('');
  const [nextBillingDate, setNextBillingDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!patientId) { setError('Selecione uma paciente'); return; }
    if (!planId) { setError('Selecione um plano'); return; }
    if (!nextBillingDate) { setError('Informe a próxima data de cobrança'); return; }

    setSaving(true);
    const res = await subscriptionsApi.subscribe({ patientId, planId, nextBillingDate });
    setSaving(false);
    if (res.success) {
      onEnrolled();
    } else {
      setError(res.error ?? 'Erro ao inscrever paciente');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Inscrever Paciente</h2>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Paciente *</label>
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="">Selecione...</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Plano *</label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="">Selecione...</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}/mês</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Próxima cobrança *</label>
          <input
            type="date"
            value={nextBillingDate}
            onChange={(e) => setNextBillingDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Inscrever
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────

const Subscriptions: React.FC = () => {
  const { patients, procedures, loadPatients, loadProcedures } = useApp();

  const [activeTab, setActiveTab] = useState<'plans' | 'subscribers' | 'pending'>('plans');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscribers, setSubscribers] = useState<PatientSubscription[]>([]);
  const [pendingSubscriptions, setPendingSubscriptions] = useState<PatientSubscription[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [plansRes, subsRes] = await Promise.all([
      subscriptionsApi.listPlans(true),
      subscriptionsApi.listSubscribers(),
    ]);
    setLoading(false);
    if (plansRes.success && Array.isArray(plansRes.data)) setPlans(plansRes.data as SubscriptionPlan[]);
    if (subsRes.success && Array.isArray(subsRes.data)) setSubscribers(subsRes.data as PatientSubscription[]);
    if (!plansRes.success) setError(plansRes.error ?? 'Erro ao carregar dados');
    const pendingRes = await subscriptionsApi.listPending();
    if (pendingRes.success && pendingRes.data) setPendingSubscriptions(pendingRes.data as PatientSubscription[]);
  }, []);

  useEffect(() => {
    loadData();
    loadPatients();
    loadProcedures();
  }, [loadData, loadPatients, loadProcedures]);

  const handleCancelSubscription = async (id: string) => {
    if (!confirm('Cancelar a assinatura desta paciente?')) return;
    setCancellingId(id);
    await subscriptionsApi.cancel(id);
    setCancellingId(null);
    loadData();
  };

  const handleDeactivatePlan = async (planId: string) => {
    if (!confirm('Desativar este plano? Assinantes existentes não serão afetados.')) return;
    await subscriptionsApi.deactivatePlan(planId);
    loadData();
  };

  const activePlans = plans.filter((p) => p.isActive);
  const activeSubscribers = subscribers.filter((s) => s.status === 'ACTIVE');
  const mrr = activeSubscribers.reduce((acc, s) => acc + Number(s.plan.price), 0);

  const patientOptions = patients.map((p) => ({ id: p.id, name: p.name }));
  const procedureOptions = procedures.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/25">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-secondary-900">Clube de Assinaturas</h1>
            <p className="text-sm text-slate-500">Planos recorrentes para fidelizar pacientes</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowEnrollModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 font-medium text-sm hover:bg-primary-100 transition-colors"
          >
            <Users className="w-4 h-4" />
            Inscrever Paciente
          </button>
          <button
            onClick={() => { setEditingPlan(null); setShowPlanModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Plano
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={CreditCard} label="Planos ativos" value={activePlans.length} color="bg-primary-100 text-primary-600" />
        <KPICard icon={Users} label="Assinantes ativos" value={activeSubscribers.length} color="bg-emerald-100 text-emerald-600" />
        <KPICard icon={DollarSign} label="Receita recorrente/mês" value={formatCurrency(mrr)} color="bg-amber-100 text-amber-600" />
        <KPICard icon={Clock} label="Pendentes" value={pendingSubscriptions.length} color="bg-amber-100 text-amber-700" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {(['plans', 'subscribers', 'pending'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'plans' && <><CreditCard className="w-4 h-4" /> Planos</>}
            {tab === 'subscribers' && <><Users className="w-4 h-4" /> Assinantes</>}
            {tab === 'pending' && (
              <>
                <Clock className="w-4 h-4" />
                Pendentes
                {pendingSubscriptions.length > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
                    {pendingSubscriptions.length}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* PLANS TAB */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.length === 0 ? (
            <div className="col-span-3 py-16 text-center">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Nenhum plano criado</p>
              <p className="text-sm text-slate-400 mt-1">Crie seu primeiro plano de assinatura para começar.</p>
            </div>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  plan.isActive ? 'border-slate-200/60' : 'border-slate-200 opacity-60'
                }`}
              >
                {plan.imageUrl && (
                  <div className="relative h-36 overflow-hidden bg-slate-100">
                    <img src={plan.imageUrl} alt={plan.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-800">{plan.name}</h3>
                      {plan.description && <p className="text-sm text-slate-500 mt-0.5">{plan.description}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg border ${plan.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {plan.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <p className="text-2xl font-bold text-primary-600 mb-4">
                    {formatCurrency(plan.price)}<span className="text-sm font-normal text-slate-400">/mês</span>
                  </p>

                  <div className="space-y-1.5 mb-4">
                    {plan.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{item.procedure.name}</span>
                        <span className="font-semibold text-slate-700">{item.sessionsPerCycle}x</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {plan._count?.subscribers ?? 0} assinante(s)
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingPlan(plan); setShowPlanModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {plan.isActive && (
                        <button
                          onClick={() => handleDeactivatePlan(plan.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                          title="Desativar"
                        >
                          <ToggleRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SUBSCRIBERS TAB */}
      {activeTab === 'subscribers' && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          {subscribers.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Nenhuma assinante</p>
              <p className="text-sm text-slate-400 mt-1">Inscreva pacientes em um plano para começar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200/60">
                    <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider">Paciente</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider hidden md:table-cell">Plano</th>
                    <th className="px-5 py-3.5 text-center font-semibold text-slate-600 uppercase text-xs tracking-wider">Status</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider hidden lg:table-cell">Próx. Cobrança</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider hidden lg:table-cell">Sessões usadas</th>
                    <th className="px-5 py-3.5 text-center font-semibold text-slate-600 uppercase text-xs tracking-wider">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscribers.map((sub) => {
                    const cfg = STATUS_CONFIG[sub.status];
                    const sessionsUsed = (Object.values(sub.sessionsUsedThisCycle) as number[]).reduce((a: number, b: number) => a + b, 0);
                    const sessionsCap = sub.plan.items.reduce((a: number, i) => a + Number(i.sessionsPerCycle), 0);
                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 shrink-0">
                              {sub.patient.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 group-hover:text-slate-900">{sub.patient.name}</p>
                              <p className="text-xs text-slate-400">{sub.patient.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <p className="font-medium text-slate-700">{sub.plan.name}</p>
                          <p className="text-xs text-slate-400">{formatCurrency(sub.plan.price)}/mês</p>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(sub.nextBillingDate).toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${sessionsUsed >= sessionsCap ? 'bg-rose-400' : 'bg-emerald-400'}`}
                                style={{ width: `${sessionsCap > 0 ? Math.min(100, (sessionsUsed / sessionsCap) * 100) : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 font-medium shrink-0">{sessionsUsed}/{sessionsCap}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {sub.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleCancelSubscription(sub.id)}
                              disabled={cancellingId === sub.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                              {cancellingId === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserX className="w-3 h-3" />}
                              Cancelar
                            </button>
                          )}
                          {sub.status === 'CANCELED' && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <CheckCircle className="w-3.5 h-3.5" /> Encerrada
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PENDING TAB */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          {pendingSubscriptions.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Nenhum plano pendente</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider">Paciente</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider hidden md:table-cell">Plano</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider hidden lg:table-cell">Solicitado em</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingSubscriptions.map(sub => (
                  <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{sub.patient.name}</p>
                      <p className="text-xs text-slate-500">{sub.patient.email}</p>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="font-medium text-purple-700">Promoção {sub.plan.name}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 hidden lg:table-cell">
                      {new Date(sub.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            await subscriptionsApi.cancel(sub.id);
                            setPendingSubscriptions(prev => prev.filter(s => s.id !== sub.id));
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                        >
                          Recusar
                        </button>
                        <button
                          onClick={async () => {
                            setActivatingId(sub.id);
                            const res = await subscriptionsApi.activate(sub.id);
                            if (res.success) setPendingSubscriptions(prev => prev.filter(s => s.id !== sub.id));
                            setActivatingId(null);
                          }}
                          disabled={activatingId === sub.id}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {activatingId === sub.id ? 'Ativando...' : 'Ativar Plano'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      {showPlanModal && (
        <SubscriptionPlanModal
          plan={editingPlan}
          procedures={procedureOptions}
          onClose={() => { setShowPlanModal(false); setEditingPlan(null); }}
          onSaved={() => { setShowPlanModal(false); setEditingPlan(null); loadData(); }}
        />
      )}

      {showEnrollModal && (
        <EnrollModal
          plans={activePlans}
          patients={patientOptions}
          onClose={() => setShowEnrollModal(false)}
          onEnrolled={() => { setShowEnrollModal(false); loadData(); }}
        />
      )}
    </div>
  );
};

export default Subscriptions;
