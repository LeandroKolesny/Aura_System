// components/patient-portal/PlanCard.tsx
import React from 'react';
import { Sparkles, CheckCircle, Clock } from 'lucide-react';

export interface PlanForCard {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
  items: { procedureId: string; procedureName: string; sessionsPerCycle: number }[];
}

export type PlanStatus = 'available' | 'active' | 'pending';

interface PlanCardProps {
  plan: PlanForCard;
  status: PlanStatus;
  primaryColor: string;
  cardBg: string;
  cardText: string;
  borderColor: string;
  onContract: () => void;
  onViewHistory: () => void;
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const PlanCard: React.FC<PlanCardProps> = ({
  plan, status, primaryColor, cardBg, cardText, borderColor, onContract, onViewHistory,
}) => {
  return (
    <div
      className="relative rounded-2xl overflow-hidden border shadow-sm group transition-all hover:shadow-lg"
      style={{ backgroundColor: cardBg, borderColor }}
    >
      {/* Image / header */}
      <div className="relative h-36 overflow-hidden">
        {plan.imageUrl ? (
          <>
            <img
              src={plan.imageUrl}
              alt={plan.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <Sparkles className="w-10 h-10 opacity-30" style={{ color: primaryColor }} />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          {status === 'active' && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white">
              Ativo
            </span>
          )}
          {status === 'pending' && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white flex items-center gap-1">
              <Clock className="w-3 h-3" /> Aguardando agendamento
            </span>
          )}
        </div>

        {/* Price */}
        <div className="absolute bottom-3 left-3">
          <span className="text-white font-bold text-lg drop-shadow">
            {formatCurrency(plan.price)}
            <span className="text-xs font-normal opacity-80">/mês</span>
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="font-bold text-base mb-1" style={{ color: cardText }}>
          {plan.name}
        </h3>
        {plan.description && (
          <p className="text-xs opacity-60 mb-3 line-clamp-2" style={{ color: cardText }}>
            {plan.description}
          </p>
        )}

        <div className="space-y-1 mb-4">
          {plan.items.map(item => (
            <div key={item.procedureId} className="flex items-center gap-1.5 text-xs" style={{ color: cardText }}>
              <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: primaryColor }} />
              <span>{item.procedureName} — {item.sessionsPerCycle}x/mês</span>
            </div>
          ))}
        </div>

        {status === 'available' && (
          <button
            onClick={onContract}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: primaryColor }}
          >
            Contratar Plano
          </button>
        )}
        {status === 'active' && (
          <button
            onClick={onViewHistory}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80 border"
            style={{ color: primaryColor, borderColor: `${primaryColor}40` }}
          >
            Ver Histórico de Sessões
          </button>
        )}
        {status === 'pending' && (
          <div
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-center opacity-60 border"
            style={{ color: cardText, borderColor }}
          >
            Agende sua 1ª sessão para ativar
          </div>
        )}
      </div>
    </div>
  );
};
