// components/patient-portal/PlanHistoryDrawer.tsx
import React, { useState, useEffect } from 'react';
import { X, Calendar, User, CheckCircle, Clock, ImageIcon } from 'lucide-react';
import { getAuthToken, API_BASE_URL } from '../../services/api';

interface AppointmentHistory {
  id: string;
  date: string;
  status: string;
  procedureName: string;
  professionalName: string;
  photos: { id: string; url: string; type: string; takenAt: string }[];
}

interface PlanHistoryDrawerProps {
  subscriptionId: string;
  planName: string;
  primaryColor: string;
  cardBg: string;
  cardText: string;
  borderColor: string;
  isDark: boolean;
  onClose: () => void;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SCHEDULED:        { label: 'Agendado',    color: '#3b82f6' },
  CONFIRMED:        { label: 'Confirmado',  color: '#6366f1' },
  COMPLETED:        { label: 'Concluído',   color: '#10b981' },
  CANCELED:         { label: 'Cancelado',   color: '#ef4444' },
  PENDING_APPROVAL: { label: 'Pendente',    color: '#f59e0b' },
};

export const PlanHistoryDrawer: React.FC<PlanHistoryDrawerProps> = ({
  subscriptionId, planName, primaryColor, cardBg, cardText, borderColor, isDark, onClose,
}) => {
  const [appointments, setAppointments] = useState<AppointmentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(
          `${API_BASE_URL}/api/subscriptions/patients/${subscriptionId}/history`,
          { headers: { Authorization: token ? `Bearer ${token}` : '' } }
        );
        const json = await res.json() as { success: boolean; data?: AppointmentHistory[] };
        if (json.success && json.data) setAppointments(json.data);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [subscriptionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm flex flex-col shadow-2xl"
        style={{
          backgroundColor: cardBg,
          borderLeft: `1px solid ${borderColor}`,
          animation: 'slideInRight 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: cardText }}>{planName}</h2>
            <p className="text-xs opacity-50 mt-0.5" style={{ color: cardText }}>Histórico de sessões</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-70"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              color: cardText,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div
                className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: primaryColor }}
              />
            </div>
          )}

          {!loading && appointments.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: cardText }} />
              <p className="text-sm opacity-50" style={{ color: cardText }}>
                Nenhuma sessão realizada ainda.
              </p>
              <p className="text-xs opacity-40 mt-1" style={{ color: cardText }}>
                Agende sua primeira sessão!
              </p>
            </div>
          )}

          {appointments.map((apt) => {
            const st = STATUS_MAP[apt.status] ?? { label: apt.status, color: '#64748b' };
            const beforePhoto = apt.photos.find(p => p.type === 'BEFORE');
            const afterPhoto  = apt.photos.find(p => p.type === 'AFTER');

            return (
              <div
                key={apt.id}
                className="rounded-xl border p-4 space-y-3"
                style={{
                  borderColor,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                }}
              >
                {/* Date + status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: cardText }}>
                    <Calendar className="w-3.5 h-3.5 opacity-60" />
                    {new Date(apt.date).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${st.color}20`, color: st.color }}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Procedure + professional */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs opacity-70" style={{ color: cardText }}>
                    <CheckCircle className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                    {apt.procedureName}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs opacity-60" style={{ color: cardText }}>
                    <User className="w-3.5 h-3.5" />
                    {apt.professionalName}
                  </div>
                </div>

                {/* Before/After photos */}
                {(beforePhoto || afterPhoto) && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {beforePhoto && (
                      <div>
                        <p className="text-[10px] opacity-50 mb-1 flex items-center gap-1" style={{ color: cardText }}>
                          <ImageIcon className="w-3 h-3" /> Antes
                        </p>
                        <img
                          src={beforePhoto.url}
                          alt="Antes"
                          className="w-full h-24 object-cover rounded-lg border"
                          style={{ borderColor }}
                        />
                      </div>
                    )}
                    {afterPhoto && (
                      <div>
                        <p className="text-[10px] opacity-50 mb-1 flex items-center gap-1" style={{ color: cardText }}>
                          <ImageIcon className="w-3 h-3" /> Depois
                        </p>
                        <img
                          src={afterPhoto.url}
                          alt="Depois"
                          className="w-full h-24 object-cover rounded-lg border"
                          style={{ borderColor }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
