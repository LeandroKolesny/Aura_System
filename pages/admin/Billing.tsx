// pages/admin/Billing.tsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, Zap, Star, Building2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { api, BillingPlan, BillingPlansResponse } from '../../services/api';

const PLAN_ICONS: Record<string, React.ElementType> = {
  Starter: Zap,
  Pro: Star,
  Clinic: Building2,
};

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string; button: string }> = {
  Starter: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    button: 'bg-blue-600 hover:bg-blue-700',
  },
  Pro: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    button: 'bg-purple-600 hover:bg-purple-700',
  },
  Clinic: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
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
  const [data, setData] = useState<BillingPlansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    api.billing.getPlans().then((res) => {
      if (res.success && res.data) {
        setData(res.data as any);
      }
      setLoading(false);
    }).catch(() => {
      setError('Erro ao carregar planos.');
      setLoading(false);
    });
  }, []);

  const handleSubscribe = async (plan: BillingPlan) => {
    setCheckingOut(plan.id);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.billing.checkout(plan.id);

      if (res.success && res.data) {
        const { paymentUrl } = res.data as any;

        if (paymentUrl) {
          window.open(paymentUrl, '_blank');
          setSuccessMsg('Link de pagamento aberto. Após confirmar o pagamento, seu plano será ativado automaticamente.');
        } else {
          setSuccessMsg('Assinatura criada! Você receberá o link de pagamento por email.');
        }
      } else {
        setError('Erro ao iniciar assinatura. Tente novamente.');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
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

      {/* Cards de planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {data?.plans.map((plan) => {
          const Icon = PLAN_ICONS[plan.name] ?? Zap;
          const colors = PLAN_COLORS[plan.name] ?? PLAN_COLORS.Starter;
          const isCurrentPlan = data.currentPlan?.toUpperCase() === plan.name.toUpperCase();
          const isLoading = checkingOut === plan.id;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border-2 p-6 flex flex-col ${
                isCurrentPlan ? `${colors.border} shadow-md` : 'border-slate-100 shadow-sm'
              }`}
            >
              {/* Header do plano */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${colors.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{plan.displayName ?? plan.name}</h3>
                  {isCurrentPlan && (
                    <span className="text-xs text-emerald-600 font-medium">Plano atual</span>
                  )}
                </div>
              </div>

              {/* Preço */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-slate-900">
                  R$ {Number(plan.price).toFixed(0)}
                </span>
                <span className="text-slate-500 text-sm">/mês</span>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
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
        Pagamento via PIX. Após a confirmação, seu plano é ativado automaticamente.
        <br />
        Dúvidas? Fale com o suporte.
      </p>
    </div>
  );
};

export default Billing;
