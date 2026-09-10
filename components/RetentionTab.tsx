import React, { useState, useEffect, useCallback } from 'react';
import { Users, Phone, AlertTriangle, RefreshCw, Loader2, MessageCircle, Shield } from 'lucide-react';
import { retentionApi, RetentionPatient } from '../services/api';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type Period = 30 | 60 | 90;
type Risk = RetentionPatient['risk'];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const RISK_CONFIG: Record<Risk, { label: string; dot: string; badge: string; text: string }> = {
  attention: {
    label: 'Atenção',
    dot: 'bg-yellow-400',
    badge: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    text: 'text-yellow-600',
  },
  at_risk: {
    label: 'Em Risco',
    dot: 'bg-orange-500',
    badge: 'bg-orange-50 border-orange-200 text-orange-700',
    text: 'text-orange-600',
  },
  lost: {
    label: 'Perdida',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 border-rose-200 text-rose-700',
    text: 'text-rose-600',
  },
};

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function buildWhatsAppLink(phone: string, patientName: string, procedure: string, lastVisit: string, clinicName: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  const message = `Oi ${patientName}! 😊\n\nAqui é da ${clinicName}.\nNotamos que faz um tempinho desde sua última visita de ${procedure} em ${formatDate(lastVisit)}.\n\nQue tal agendarmos sua próxima sessão? 🗓️`;
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

const KPICard: React.FC<{
  label: string;
  value: number | string;
  color: string;
  dotColor: string;
}> = ({ label, value, color, dotColor }) => (
  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
    <div className={`w-3 h-3 rounded-full ${dotColor} shrink-0`} />
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
    </div>
  </div>
);

const RiskBadge: React.FC<{ risk: Risk }> = ({ risk }) => {
  const cfg = RISK_CONFIG[risk];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

interface RetentionTabProps {
  clinicName: string;
  professionalOptions: { id: string; name: string }[];
}

const RetentionTab: React.FC<RetentionTabProps> = ({ clinicName, professionalOptions }) => {
  const [period, setPeriod] = useState<Period>(90);
  const [professionalId, setProfessionalId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ attention: number; at_risk: number; lost: number; retentionRate: number } | null>(null);
  const [patients, setPatients] = useState<RetentionPatient[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await retentionApi.getReport({
      period,
      professionalId: professionalId || undefined,
    });
    setLoading(false);
    if (res.success && res.data) {
      setSummary(res.data.summary);
      setPatients(res.data.patients);
      setLoaded(true);
    } else {
      setError(res.error ?? 'Erro ao carregar relatório');
    }
  }, [period, professionalId]);

  // Fetch once on mount
  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = () => fetchData();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Período:</label>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {([30, 60, 90] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p} dias
              </button>
            ))}
          </div>
        </div>

        {professionalOptions.length > 0 && (
          <select
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Todos os profissionais</option>
            {professionalOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        <button
          onClick={handleApply}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Atualizar
        </button>
      </div>

      {/* Loading state */}
      {loading && !loaded && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Analisando pacientes...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && loaded && summary && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Em Atenção"
              value={summary.attention}
              color="text-yellow-600"
              dotColor="bg-yellow-400"
            />
            <KPICard
              label="Em Risco"
              value={summary.at_risk}
              color="text-orange-600"
              dotColor="bg-orange-500"
            />
            <KPICard
              label="Perdidas"
              value={summary.lost}
              color="text-rose-600"
              dotColor="bg-rose-500"
            />
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
              <Shield className={`w-6 h-6 shrink-0 ${summary.retentionRate >= 70 ? 'text-emerald-500' : 'text-amber-500'}`} />
              <div>
                <p className={`text-2xl font-bold ${summary.retentionRate >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {summary.retentionRate}%
                </p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Taxa de Retenção</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            {patients.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Nenhuma paciente em atraso</p>
                <p className="text-sm text-slate-400 mt-1">Todas as pacientes estão dentro do intervalo esperado de retorno.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200/60">
                      <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider">Paciente</th>
                      <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider hidden md:table-cell">Último Procedimento</th>
                      <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider hidden md:table-cell">Última Visita</th>
                      <th className="px-5 py-3.5 font-semibold text-slate-600 uppercase text-xs tracking-wider hidden lg:table-cell">Retorno Esperado</th>
                      <th className="px-5 py-3.5 text-center font-semibold text-slate-600 uppercase text-xs tracking-wider">Atraso</th>
                      <th className="px-5 py-3.5 text-center font-semibold text-slate-600 uppercase text-xs tracking-wider">Risco</th>
                      <th className="px-5 py-3.5 text-center font-semibold text-slate-600 uppercase text-xs tracking-wider">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patients.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 shrink-0">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 group-hover:text-slate-900">{p.name}</p>
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />
                                {p.phone}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <p className="text-slate-700 font-medium">{p.lastProcedure}</p>
                          {p.isDefaultInterval && (
                            <p className="text-[10px] text-slate-400 mt-0.5">intervalo padrão</p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600 hidden md:table-cell">{formatDate(p.lastVisit)}</td>
                        <td className="px-5 py-4 text-slate-600 hidden lg:table-cell">{formatDate(p.expectedReturn)}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`font-bold text-sm ${RISK_CONFIG[p.risk].text}`}>
                            {p.daysOverdue}d
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <RiskBadge risk={p.risk} />
                        </td>
                        <td className="px-5 py-4 text-center">
                          <a
                            href={buildWhatsAppLink(p.phone, p.name, p.lastProcedure, p.lastVisit, clinicName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {patients.length > 0 && (
            <p className="text-xs text-slate-400 text-center">
              {patients.length} paciente{patients.length !== 1 ? 's' : ''} precisam de atenção nos últimos {period} dias
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default RetentionTab;
