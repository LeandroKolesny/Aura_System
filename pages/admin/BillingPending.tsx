// pages/admin/BillingPending.tsx
// Página de aguardo de confirmação de pagamento
// Faz polling em /api/billing/status a cada 10s até status ACTIVE ou timeout de 30min

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';

const POLL_INTERVAL_MS = 10_000;   // 10 segundos
const TIMEOUT_MS = 30 * 60_000;   // 30 minutos

const BillingPending: React.FC = () => {
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);
  const startTime = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      // Timeout após 30 minutos
      if (Date.now() - startTime.current >= TIMEOUT_MS) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimedOut(true);
        return;
      }

      try {
        const res = await api.billing.getStatus();
        const statusData = (res.data as any)?.data;
        if (res.success && statusData?.status === 'ACTIVE') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          navigate('/dashboard', { replace: true, state: { paymentSuccess: true } });
        }
      } catch {
        // Falha silenciosa — continua tentando
      }
    };

    // Primeira chamada imediata para não esperar 10s
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [navigate]);

  if (timedOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Não identificamos seu pagamento ainda
        </h1>
        <p className="text-slate-500 text-sm max-w-sm mb-6">
          Se você já concluiu o pagamento, aguarde alguns minutos — a confirmação pode levar até 5 minutos para o PIX e até 3 dias úteis para boleto.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/billing')}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Voltar para Planos
          </button>
          <button
            onClick={() => {
              startTime.current = Date.now();
              setTimedOut(false);
            }}
            className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            Verificar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">
        Aguardando confirmação do pagamento
      </h1>
      <p className="text-slate-500 text-sm max-w-sm mb-2">
        Complete o pagamento na aba que abrimos. Assim que confirmarmos, você será redirecionado automaticamente.
      </p>
      <p className="text-slate-400 text-xs mb-8">
        Verificando a cada 10 segundos...
      </p>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-sm w-full space-y-2 mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          PIX: confirmação imediata
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          Cartão: confirmação em minutos
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          Boleto: até 3 dias úteis
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate('/billing')}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          Voltar para Planos
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 text-slate-500 text-sm hover:text-slate-700 transition-colors flex items-center gap-1"
        >
          Ir para o Dashboard <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default BillingPending;
