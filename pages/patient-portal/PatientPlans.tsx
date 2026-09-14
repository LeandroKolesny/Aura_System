// pages/patient-portal/PatientPlans.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, RefreshCw, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { getPortalBasePath, getClinicSlug } from '../../utils/subdomain';
import { getAuthToken, API_BASE_URL } from '../../services/api';
import { PlanCard, PlanForCard, PlanStatus } from '../../components/patient-portal/PlanCard';
import { PlanContractModal } from '../../components/patient-portal/PlanContractModal';
import { PlanHistoryDrawer } from '../../components/patient-portal/PlanHistoryDrawer';
import { DialogProvider, useDialog } from '../../context/DialogContext';


interface SubscriptionItem {
  procedureId: string;
  procedureName: string;
  sessionsPerCycle: number;
  sessionsUsed: number;
  sessionsRemaining: number;
}

interface MySubscription {
  id: string;
  status: string;
  hasPendingAppointment?: boolean;
  startDate: string;
  nextBillingDate: string;
  lastCycleReset: string;
  plan: {
    id: string;
    name: string;
    price: number;
    description?: string | null;
    imageUrl?: string | null;
  };
  items: SubscriptionItem[];
}

// `apps/PatientPortalApp.tsx` (fora do escopo desta auditoria) ainda não
// envolve o portal com <DialogProvider> — só o AdminApp em App.tsx tem esse
// provider hoje. Sem ele, useDialog() lançaria "useDialog deve ser usado
// dentro de DialogProvider" e quebraria a página inteira. Para cumprir a
// regra obrigatória do projeto (nunca `alert()`/`window.confirm()`, sempre
// useDialog()) sem mexer em arquivo de outro agente, esta página cria seu
// próprio DialogProvider local, restrito à sua própria árvore. Recomendação
// para uma tarefa futura: mover o DialogProvider para a raiz do
// PatientPortalApp e remover este wrapper local.
const PatientPlans: React.FC = () => (
  <DialogProvider>
    <PatientPlansContent />
  </DialogProvider>
);

const PatientPlansContent: React.FC = () => {
  const { clinic } = useClinic();
  const navigate = useNavigate();
  const basePath = getPortalBasePath();
  const clinicSlug = getClinicSlug();
  const { showAlert } = useDialog();

  // Colors from clinic layout
  const layoutConfig = clinic?.layoutConfig;
  const primaryColor = layoutConfig?.primaryColor || '#8b5cf6';
  const backgroundColor = layoutConfig?.backgroundColor || '#fafaf9';
  const cardBgColor = layoutConfig?.cardBackgroundColor;
  const cardTextColor = layoutConfig?.cardTextColor;

  const isDark = (() => {
    const hex = (backgroundColor || '').replace('#', '');
    if (hex.length !== 6) return false;
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  })();

  const mainTextColor = layoutConfig?.textColor || (isDark ? '#f5f5f5' : '#1e293b');
  const cardBg = cardBgColor || (isDark ? 'rgba(255,255,255,0.05)' : '#ffffff');
  const cardText = cardTextColor || mainTextColor;
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // State
  const [subscriptions, setSubscriptions] = useState<MySubscription[]>([]);
  const [availablePlans, setAvailablePlans] = useState<PlanForCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractModal, setContractModal] = useState<PlanForCard | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<{ id: string; name: string } | null>(null);
  const [loadError, setLoadError] = useState(false);

  const fetchData = async () => {
    const token = getAuthToken();
    setLoadError(false);

    const promises: Promise<void>[] = [
      // Fetch my subscriptions
      fetch(`${API_BASE_URL}/api/subscriptions/patients/my`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      }).then(r => r.json()).then((json: { success: boolean; data?: MySubscription[] }) => {
        // Uma resposta sem sucesso (401/500/etc.) NÃO deve renderizar como
        // "você não possui planos" — isso esconderia um erro real atrás do
        // estado vazio legítimo de quem realmente não tem plano nenhum.
        if (json.success && json.data) {
          setSubscriptions(json.data);
        } else {
          setLoadError(true);
        }
      }).catch((err) => {
        console.error('Erro ao buscar assinaturas do paciente:', err);
        setLoadError(true);
      }),
    ];

    // Fetch available plans from public company endpoint
    if (clinicSlug) {
      promises.push(
        fetch(`${API_BASE_URL}/api/public/company/${clinicSlug}`)
          .then(r => r.json())
          .then((json: { subscriptionPlans?: PlanForCard[] }) => {
            if (json.subscriptionPlans) {
              setAvailablePlans(json.subscriptionPlans.map(p => ({
                ...p,
                items: p.items.map((i: { procedureId: string; procedureName?: string; sessionsPerCycle: number; procedure?: { name: string } }) => ({
                  procedureId: i.procedureId,
                  procedureName: i.procedureName || i.procedure?.name || '',
                  sessionsPerCycle: i.sessionsPerCycle,
                })),
              })));
            }
          })
          .catch(() => {})
      );
    }

    await Promise.all(promises);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [clinicSlug]);

  const getPlanStatus = (planId: string): PlanStatus => {
    const sub = subscriptions.find(s => s.plan.id === planId);
    if (!sub) return 'available';
    if (sub.status === 'ACTIVE' || sub.status === 'PAUSED') return 'active';
    if (sub.status === 'PENDING') return 'pending';
    return 'available';
  };

  const getSubscriptionForPlan = (planId: string) =>
    subscriptions.find(s => s.plan.id === planId);

  const handleContract = async () => {
    if (!contractModal) return;
    const plan = contractModal;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/subscriptions/patients/self`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId: plan.id }),
      });
      const json = await res.json() as { error?: string };

      // 201 = criada agora, 200 = já existia uma PENDING/ACTIVE/PAUSED para
      // este plano (POST /api/subscriptions/patients/self retorna 200 nesse
      // caso, nunca 409 — o `res.status === 409` abaixo é só uma defesa extra
      // caso o contrato da rota mude no futuro) — ambos navegam para o agendamento.
      if (res.ok || res.status === 409) {
        setContractModal(null);
        navigate(`${basePath}/`, {
          state: {
            pendingPlanId: plan.id,
            pendingPlanName: plan.name,
          },
        });
      } else {
        await showAlert(json.error ?? 'Não foi possível contratar o plano. Tente novamente.', { variant: 'danger' });
      }
    } catch (err) {
      console.error('Erro ao contratar plano:', err);
      await showAlert('Não foi possível contratar o plano. Verifique sua conexão e tente novamente.', { variant: 'danger' });
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: primaryColor }}
        />
      </div>
    );
  }

  // Active/paused subscriptions to show in "Meus Planos" section
  const activeSubscriptions = subscriptions.filter(s => s.status === 'ACTIVE' || s.status === 'PAUSED');

  return (
    <div className="space-y-10">
      {loadError && (
        <div
          className="rounded-2xl border p-4 flex items-center gap-3"
          style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}
        >
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Não foi possível carregar seus planos agora.</p>
            <p className="text-xs text-red-600/80 mt-0.5">Verifique sua conexão e tente novamente.</p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: '#dc2626' }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ===== SECTION 1: Available Plans ===== */}
      {availablePlans.length > 0 && (
        <section>
          <div className="mb-5">
            <h2 className="text-xl font-bold" style={{ color: mainTextColor }}>Promoções Disponíveis</h2>
            <p className="text-sm opacity-60 mt-0.5" style={{ color: mainTextColor }}>
              Assine um plano e aproveite sessões incluídas todo mês
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availablePlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                status={getPlanStatus(plan.id)}
                primaryColor={primaryColor}
                cardBg={cardBg}
                cardText={cardText}
                borderColor={borderColor}
                onContract={() => setContractModal(plan)}
                onViewHistory={() => {
                  const sub = getSubscriptionForPlan(plan.id);
                  if (sub) setHistoryDrawer({ id: sub.id, name: plan.name });
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ===== SECTION 2: My Active Plans ===== */}
      <section>
        <div className="mb-5">
          <h2 className="text-xl font-bold" style={{ color: mainTextColor }}>Meus Planos</h2>
          <p className="text-sm opacity-60 mt-0.5" style={{ color: mainTextColor }}>
            Acompanhe suas assinaturas e sessões disponíveis
          </p>
        </div>

        {activeSubscriptions.length === 0 && subscriptions.filter(s => s.status === 'PENDING').length === 0 ? (
          // Se o carregamento falhou (loadError), o banner de erro acima já
          // avisa o paciente — não mostrar também a mensagem de "você não tem
          // planos", que é enganosa quando na verdade é um erro de rede/API.
          loadError ? null : (
            <div
              className="rounded-2xl border p-10 text-center"
              style={{ backgroundColor: cardBg, borderColor, color: cardText }}
            >
              <Sparkles className="w-10 h-10 mx-auto mb-4 opacity-30" style={{ color: primaryColor }} />
              <p className="font-semibold mb-2">Você não possui planos ativos</p>
              <p className="text-sm opacity-60">
                {availablePlans.length > 0
                  ? 'Contrate um plano acima para começar!'
                  : 'Assine um plano promocional para aproveitar sessões incluídas todo mês'}
              </p>
            </div>
          )
        ) : (
          <div className="space-y-6">
            {/* Pending subscriptions */}
            {subscriptions.filter(s => s.status === 'PENDING').map(sub => (
              <div
                key={sub.id}
                className="rounded-2xl border overflow-hidden shadow-sm"
                style={{ backgroundColor: cardBg, borderColor }}
              >
                <div className="p-4 border-b flex items-center gap-3" style={{ borderColor, backgroundColor: `${primaryColor}08` }}>
                  <Clock className="w-4 h-4" style={{ color: primaryColor }} />
                  <div className="flex-1">
                    <span className="font-bold text-sm" style={{ color: cardText }}>{sub.plan.name}</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                      {sub.hasPendingAppointment ? 'Pendente.' : 'Aguardando 1º agendamento'}
                    </span>
                  </div>
                  <span className="font-bold text-sm" style={{ color: primaryColor }}>
                    {formatCurrency(sub.plan.price)}<span className="text-xs font-normal opacity-60">/mês</span>
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-xs opacity-60" style={{ color: cardText }}>
                    {sub.hasPendingAppointment
                      ? 'Sua sessão já foi agendada e está aguardando aprovação da clínica.'
                      : 'Agende sua primeira sessão para ativar o plano e combinar o pagamento com a clínica.'}
                  </p>
                  <button
                    onClick={() => navigate(`${basePath}/`, {
                      state: { pendingPlanId: sub.plan.id, pendingPlanName: sub.plan.name },
                    })}
                    className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Agendar agora
                  </button>
                </div>
              </div>
            ))}

            {/* Active/paused subscriptions */}
            {activeSubscriptions.map(sub => (
              <div
                key={sub.id}
                className="rounded-2xl border overflow-hidden shadow-sm"
                style={{ backgroundColor: cardBg, borderColor }}
              >
                {/* Plan header */}
                <div className="relative p-5 border-b" style={{ borderColor }}>
                  {sub.plan.imageUrl && (
                    <div className="absolute inset-0 opacity-10">
                      <img src={sub.plan.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${primaryColor}20` }}
                      >
                        <Sparkles className="w-5 h-5" style={{ color: primaryColor }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-base" style={{ color: cardText }}>{sub.plan.name}</h3>
                        {sub.plan.description && (
                          <p className="text-xs opacity-60 mt-0.5" style={{ color: cardText }}>{sub.plan.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-base" style={{ color: primaryColor }}>
                        {formatCurrency(sub.plan.price)}
                        <span className="text-xs font-normal opacity-60">/mês</span>
                      </p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${sub.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {sub.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sessions per procedure */}
                <div className="p-5 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-50" style={{ color: cardText }}>
                    Sessões este ciclo
                  </p>
                  {sub.items.map(item => (
                    <div key={item.procedureId}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium" style={{ color: cardText }}>{item.procedureName}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-bold"
                            style={{
                              color: item.sessionsRemaining > 0 ? primaryColor : 'inherit',
                              opacity: item.sessionsRemaining > 0 ? 1 : 0.4,
                            }}
                          >
                            {item.sessionsRemaining} restante{item.sessionsRemaining !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs opacity-40" style={{ color: cardText }}>/ {item.sessionsPerCycle}</span>
                        </div>
                      </div>
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(item.sessionsUsed / item.sessionsPerCycle) * 100}%`,
                            backgroundColor: item.sessionsRemaining > 0 ? primaryColor : '#ef4444',
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {Array.from({ length: item.sessionsPerCycle }).map((_, i) => (
                          <CheckCircle
                            key={i}
                            className="w-3.5 h-3.5"
                            style={{
                              color: i < item.sessionsUsed ? primaryColor : borderColor,
                              opacity: i < item.sessionsUsed ? 1 : 0.4,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-4 text-xs opacity-50" style={{ color: cardText }}>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Desde {formatDate(sub.startDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Renova {formatDate(sub.nextBillingDate)}
                    </span>
                  </div>
                  <button
                    onClick={() => setHistoryDrawer({ id: sub.id, name: sub.plan.name })}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all hover:opacity-80"
                    style={{ color: primaryColor, borderColor: `${primaryColor}40` }}
                  >
                    Ver histórico
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Contract Modal */}
      {contractModal && (
        <PlanContractModal
          plan={contractModal}
          primaryColor={primaryColor}
          cardBg={cardBg}
          cardText={cardText}
          borderColor={borderColor}
          onClose={() => setContractModal(null)}
          onConfirm={handleContract}
        />
      )}

      {/* History Drawer */}
      {historyDrawer && (
        <PlanHistoryDrawer
          subscriptionId={historyDrawer.id}
          planName={historyDrawer.name}
          primaryColor={primaryColor}
          cardBg={cardBg}
          cardText={cardText}
          borderColor={borderColor}
          isDark={isDark}
          onClose={() => setHistoryDrawer(null)}
        />
      )}
    </div>
  );
};

export default PatientPlans;
