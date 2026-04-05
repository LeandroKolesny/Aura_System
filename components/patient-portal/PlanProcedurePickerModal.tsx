// components/patient-portal/PlanProcedurePickerModal.tsx
import React, { useState } from 'react';
import { X, CheckCircle, Sparkles } from 'lucide-react';

interface PlanItem {
  procedureId: string;
  procedureName: string;
  sessionsPerCycle: number;
  sessionsRemaining: number; // -1 means unknown (plan not yet active)
}

interface Props {
  planName: string;
  items: PlanItem[];
  primaryColor: string;
  cardBg: string;
  cardText: string;
  borderColor: string;
  onConfirm: (selectedProcedureIds: string[]) => void;
  onClose: () => void;
}

export const PlanProcedurePickerModal: React.FC<Props> = ({
  planName, items, primaryColor, cardBg, cardText, borderColor, onConfirm, onClose,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
            <h2 className="text-lg font-bold" style={{ color: cardText }}>Promoção {planName}</h2>
          </div>
          <p className="text-sm opacity-60 mb-5" style={{ color: cardText }}>
            Quais procedimentos deseja fazer nesta sessão?
          </p>

          <div className="space-y-2 mb-6">
            {items.map(item => {
              const isSelected = selected.has(item.procedureId);
              const noSessions = item.sessionsRemaining === 0;
              return (
                <button
                  key={item.procedureId}
                  onClick={() => !noSessions && toggle(item.procedureId)}
                  disabled={noSessions}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                    noSessions ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
                  }`}
                  style={{
                    borderColor: isSelected ? primaryColor : borderColor,
                    backgroundColor: isSelected ? `${primaryColor}15` : 'transparent',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-all"
                    style={{
                      borderColor: isSelected ? primaryColor : borderColor,
                      backgroundColor: isSelected ? primaryColor : 'transparent',
                    }}
                  >
                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <span className="flex-1 font-medium text-sm" style={{ color: cardText }}>
                    {item.procedureName}
                  </span>
                  <span className="text-xs opacity-60" style={{ color: cardText }}>
                    {item.sessionsRemaining === -1
                      ? `${item.sessionsPerCycle}x/mês`
                      : noSessions
                        ? 'Sem sessões'
                        : `${item.sessionsRemaining} restante${item.sessionsRemaining !== 1 ? 's' : ''}`
                    }
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors hover:opacity-70"
              style={{ color: cardText, borderColor }}
            >
              Cancelar
            </button>
            <button
              onClick={() => selected.size > 0 && onConfirm(Array.from(selected))}
              disabled={selected.size === 0}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: primaryColor }}
            >
              Confirmar ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
