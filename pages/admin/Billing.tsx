// pages/admin/Billing.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Zap, Star, Building2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { api, BillingPlan, BillingPlansResponse } from '../../services/api';

const PLAN_ICONS: Record<string, React.ElementType> = {
  Starter: Zap,
  Pro: Star,
  Clinic: Building2,
};

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string; button: string }> = {
  Starter: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-300',
    button: 'bg-primary-500 hover:bg-primary-600',
  },
  Pro: {
    bg: 'bg-primary-50',
    text: 'text-primary-700',
    border: 'border-primary-400',
    button: 'bg-primary-600 hover:bg-primary-700',
  },
  Clinic: {
    bg: 'bg-slate-800',
    text: 'text-amber-400',
    border: 'border-amber-500',
    button: 'bg-amber-600 hover:bg-amber-700',
  },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Ativo', color: 'text-emerald-600' },
  TRIAL: { label: 'Trial', color: 'text-blue-600' },
  OVERDUE: { label: 'Vencido', color: 'text-red-600' },
  CANCELED: { label: 'Cancelado', color: 'text-slate-500' },
};

const Billing: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<BillingPlansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [blockedPaymentUrl, setBlockedPaymentUrl] = useState<string | null>(null);
  const highlightedPlanId = searchParams.get('plan');
  const autoCheckout = searchParams.get('autoCheckout') === 'true';
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const autoCheckoutFired = useRef(false);

  useEffect(() => {
    api.billing.getPlans().then((res) => {
      if (res.success && res.data) {
        // fetchApi wraps the server JSON in { success, data: <serverJson> }
        // server returns { success, data: BillingPlansResponse }, so inner data is at res.data.data
        const wrapper = res.data as { data?: BillingPlansResponse } | BillingPlansResponse;
        const inner = (wrapper as { data?: BillingPlansResponse }).data ?? (wrapper as BillingPlansResponse);
        setData(inner);
      } else if (!res.success) {
        setError('Sessão expirada. Faça login novamente.');
      }
      setLoading(false);
    }).catch(() => {
      setError('Erro ao carregar planos.');
      setLoading(false);
    });
  }, []);

  // Auto-checkout: quando vindo da LandingPage, dispara o pagamento automaticamente
  useEffect(() => {
    if (!autoCheckout || !highlightedPlanId || loading || autoCheckoutFired.current) return;
    if (!data?.plans) return;

    const targetPlan = data.plans.find((p) => p.id === highlightedPlanId);
    if (!targetPlan) return;

    autoCheckoutFired.current = true;
    localStorage.removeItem('pendingPlan');
    handleSubscribe(targetPlan);
  }, [autoCheckout, highlightedPlanId, loading, data]);

  // Scroll até o plano pré-selecionado (apenas quando não for auto-checkout)
  useEffect(() => {
    if (highlightedPlanId && !autoCheckout && !loading) {
      localStorage.removeItem('pendingPlan');
      if (highlightRef.current) {
        highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedPlanId, autoCheckout, loading]);

  const handleSubscribe = async (plan: BillingPlan) => {
    setCheckingOut(plan.id);
    setError(null);
    setSuccessMsg(null);
    setBlockedPaymentUrl(null);

    try {
      const res = await api.billing.checkout(plan.id);

      if (res.success && res.data) {
        type CheckoutPayload = { paymentUrl?: string };
        const wrapper = res.data as { data?: CheckoutPayload } | CheckoutPayload;
        const inner: CheckoutPayload = (wrapper as { data?: CheckoutPayload }).data ?? (wrapper as CheckoutPayload);
        const { paymentUrl } = inner;

        if (paymentUrl) {
          const popup = window.open(paymentUrl, '_blank');
          if (popup) {
            navigate('/billing/aguardando');
          } else {
            // Popup bloqueado — mantém na página e mostra link para abrir manualmente
            setBlockedPaymentUrl(paymentUrl);
          }
        } else {
          setSuccessMsg('Assinatura criada! Você receberá o link de pagamento por email.');
        }
      } else {
        type ErrorPayload = { error?: string; data?: { error?: string } };
        const errData = res.data as ErrorPayload | undefined;
        const errMsg = res.error ?? errData?.error ?? errData?.data?.error ?? 'Erro ao iniciar assinatura.';
        setError(errMsg);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Erro de conexão: ${msg}`);
    } finally {
      setCheckingOut(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const currentStatus = data?.currentStatus ? STATUS_LABELS[data.currentStatus] : null;
  const expiresAt = data?.subscriptionExpiresAt
    ? new Date(data.subscriptionExpiresAt).toLocaleDateString('pt-BR')
    : null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Planos e Assinatura</h1>
        <p className="text-slate-500 mt-1">Escolha o plano ideal para sua clínica</p>
      </div>

      {/* Status atual */}
      {data?.currentPlan && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Plano atual</p>
            <p className="font-semibold text-slate-900 capitalize">
              {data.currentPlan.toLowerCase()}
              {currentStatus && (
                <span className={`ml-2 text-xs font-medium ${currentStatus.color}`}>
                  • {currentStatus.label}
                </span>
              )}
            </p>
            {expiresAt && (
              <p className="text-xs text-slate-400">Válido até {expiresAt}</p>
            )}
          </div>
        </div>
      )}

      {/* Mensagens */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="text-emerald-700 text-sm">{successMsg}</span>
        </div>
      )}
      {blockedPaymentUrl && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 text-sm font-medium mb-2">
              Pop-up bloqueado pelo navegador. Clique no botão abaixo para ir à página de pagamento:
            </p>
            <a
              href={blockedPaymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => navigate('/billing/aguardando')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Ir para o pagamento <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Cards de planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(data?.plans ?? []).map((plan) => {
          const Icon = PLAN_ICONS[plan.name] ?? Zap;
          const colors = PLAN_COLORS[plan.name] ?? PLAN_COLORS.Starter;
          const isCurrentPlan = data.currentPlan?.toUpperCase() === plan.name.toUpperCase();
          const isHighlighted = highlightedPlanId === plan.id;
          const isLoading = checkingOut === plan.id;

          return (
            <div
              key={plan.id}
              ref={isHighlighted ? highlightRef : null}
              className={`relative rounded-2xl border-2 p-6 flex flex-col transition-shadow ${
                plan.name === 'Clinic' ? 'bg-slate-900 text-white' : 'bg-white'
              } ${
                isCurrentPlan
                  ? `${colors.border} shadow-lg ring-2 ring-offset-2 ${colors.border.replace('border-', 'ring-')}`
                  : isHighlighted
                  ? `${colors.border} shadow-xl`
                  : 'border-slate-100 shadow-sm'
              }`}
            >
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow">
                    Seu Plano
                  </span>
                </div>
              )}

              {/* Header do plano */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${colors.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <div>
                  <h3 className={`font-bold ${plan.name === 'Clinic' ? 'text-white' : 'text-slate-900'}`}>{plan.displayName ?? plan.name}</h3>
                </div>
              </div>

              {/* Preço */}
              <div className="mb-4">
                <span className={`text-3xl font-bold ${plan.name === 'Clinic' ? 'text-white' : 'text-slate-900'}`}>
                  R$ {Number(plan.price).toFixed(0)}
                </span>
                <span className={`text-sm ${plan.name === 'Clinic' ? 'text-slate-400' : 'text-slate-500'}`}>/mês</span>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${plan.name === 'Clinic' ? 'text-slate-300' : 'text-slate-600'}`}>
                    <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${plan.name === 'Clinic' ? 'text-amber-400' : 'text-emerald-500'}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Botão */}
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={isLoading || isCurrentPlan}
                className={`w-full py-2.5 px-4 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors.button}`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrentPlan ? (
                  'Plano atual'
                ) : (
                  <>
                    Assinar <ExternalLink className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Nota sobre pagamento */}
      <p className="text-xs text-slate-400 text-center">
        Pagamento via PIX, cartão de crédito ou boleto. Após a confirmação, seu plano é ativado automaticamente.
        <br />
        Dúvidas? Fale com o suporte.
      </p>
    </div>
  );
};

export default Billing;
