// components/patient-portal/PlanContractModal.tsx
import React, { useState } from 'react';
import { X, CheckCircle, MessageCircle } from 'lucide-react';
import { PlanForCard } from './PlanCard';

interface PlanContractModalProps {
  plan: PlanForCard;
  primaryColor: string;
  cardBg: string;
  cardText: string;
  borderColor: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const PlanContractModal: React.FC<PlanContractModalProps> = ({
  plan, primaryColor, cardBg, cardText, borderColor, onClose, onConfirm,
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
      >
        {/* Image header */}
        {plan.imageUrl && (
          <div className="relative h-40 overflow-hidden">
            <img src={plan.imageUrl} alt={plan.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white hover:bg-black/50 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-bold" style={{ color: cardText }}>{plan.name}</h2>
              {plan.description && (
                <p className="text-sm opacity-60 mt-1" style={{ color: cardText }}>{plan.description}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                {formatCurrency(plan.price)}
              </span>
              <span className="text-xs opacity-60 block" style={{ color: cardText }}>/mês</span>
            </div>
          </div>

          {/* Procedures included */}
          <div
            className="mb-4 p-4 rounded-xl"
            style={{ backgroundColor: `${primaryColor}10`, border: `1px solid ${primaryColor}20` }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-3 opacity-60" style={{ color: cardText }}>
              Incluso no plano
            </p>
            <div className="space-y-2">
              {plan.items.map(item => (
                <div key={item.procedureId} className="flex items-center gap-2 text-sm" style={{ color: cardText }}>
                  <CheckCircle className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                  <span className="font-medium">{item.procedureName}</span>
                  <span className="ml-auto opacity-60 text-xs">{item.sessionsPerCycle}x por mês</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment notice */}
          <div className="flex items-start gap-2 mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <MessageCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              O pagamento é combinado diretamente com a clínica via WhatsApp ou telefone após o primeiro agendamento.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors hover:opacity-70 disabled:opacity-40"
              style={{ color: cardText, borderColor }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Aguarde...' : 'Confirmar Plano'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
