// pages/patient-portal/PatientPlans.tsx
// Página "Meus Planos" do Portal do Paciente

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, CalendarPlus, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { getPortalBasePath } from '../../utils/subdomain';
import { getAuthToken } from '../../services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

const PatientPlans: React.FC = () => {
  const { clinic } = useClinic();
  const basePath = getPortalBasePath();

  const [subscriptions, setSubscriptions] = useState<MySubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cores do layout da clínica
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

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE_URL}/api/subscriptions/patients/my`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        const json = await res.json() as { success: boolean; data?: MySubscription[]; error?: string };
        if (json.success && json.data) {
          setSubscriptions(json.data);
        } else {
          setError(json.error || 'Erro ao carregar planos');
        }
      } catch {
        setError('Erro de conexão');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, []);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: primaryColor }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm opacity-60" style={{ color: mainTextColor }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: mainTextColor }}>Meus Planos</h1>
        <p className="text-sm opacity-60" style={{ color: mainTextColor }}>Acompanhe seus planos de assinatura e sessões disponíveis</p>
      </div>

      {subscriptions.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center" style={{ backgroundColor: cardBg, borderColor, color: cardText }}>
          <Sparkles className="w-10 h-10 mx-auto mb-4 opacity-30" style={{ color: primaryColor }} />
          <p className="font-semibold mb-2">Você não possui planos ativos</p>
          <p className="text-sm opacity-60 mb-6">Assine um plano promocional para aproveitar sessões incluídas todo mês</p>
          <Link
            to={`${basePath}/`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ backgroundColor: primaryColor }}
          >
            <Sparkles className="w-4 h-4" />
            Ver Promoções
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="rounded-2xl border overflow-hidden shadow-sm" style={{ backgroundColor: cardBg, borderColor }}>
              {/* Plan header */}
              <div className="relative p-5 border-b" style={{ borderColor }}>
                {sub.plan.imageUrl && (
                  <div className="absolute inset-0 opacity-10">
                    <img src={sub.plan.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}20` }}>
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
                    <p className="font-bold text-base" style={{ color: primaryColor }}>{formatCurrency(sub.plan.price)}<span className="text-xs font-normal opacity-60">/mês</span></p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${sub.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {sub.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sessions per procedure */}
              <div className="p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-50" style={{ color: cardText }}>Sessões este ciclo</p>
                {sub.items.map((item) => (
                  <div key={item.procedureId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium" style={{ color: cardText }}>{item.procedureName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: item.sessionsRemaining > 0 ? primaryColor : 'inherit', opacity: item.sessionsRemaining > 0 ? 1 : 0.4 }}>
                          {item.sessionsRemaining} restante{item.sessionsRemaining !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs opacity-40" style={{ color: cardText }}>/ {item.sessionsPerCycle}</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
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
                          style={{ color: i < item.sessionsUsed ? primaryColor : borderColor, opacity: i < item.sessionsUsed ? 1 : 0.4 }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-4 text-xs opacity-50" style={{ color: cardText }}>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Desde {formatDate(sub.startDate)}</span>
                  <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Renova {formatDate(sub.nextBillingDate)}</span>
                </div>
                <Link
                  to={`${basePath}/`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105"
                  style={{ backgroundColor: primaryColor }}
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Agendar sessão
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientPlans;
