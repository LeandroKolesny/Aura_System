import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { DollarSign, Users, CalendarCheck, TrendingUp, X, AlertTriangle, CheckCircle, ArrowRight, Package, UserCheck, History, XCircle, Building, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole, SystemAlert, Appointment } from '../types';
import { AlertDetailsModal } from '../components/Modals';
import { formatCurrency, formatDate } from '../utils/formatUtils';
import { ALERT_VISUAL_CONFIG } from '../utils/statusUtils';
import StatCard from '../components/StatCard';
import { dashboardApi, DashboardData } from '../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- COMPONENTES DE GRÁFICOS ---
const SimpleRevenueChart = ({ data }: { data: { name: string; value: number }[] }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; label: string } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center text-slate-400">
        Nenhum dado de receita disponível
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 100);
  const yTicks = [0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue];

  const formatYAxis = (value: number) => {
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    if (value === 0) return 'R$ 0';
    return `R$ ${Math.round(value)}`;
  };

  // Constantes para o layout do gráfico
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const chartHeight = 200;

  return (
    <div className="w-full relative">
      <svg
        viewBox={`0 0 800 ${chartHeight + paddingTop + paddingBottom}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bd7b65" stopOpacity={0.35}/>
            <stop offset="100%" stopColor="#bd7b65" stopOpacity={0.02}/>
          </linearGradient>
        </defs>

        {/* Grid horizontal */}
        {yTicks.map((tick, i) => {
          const y = paddingTop + chartHeight - (tick / maxValue * chartHeight);
          return (
            <line
              key={i}
              x1={paddingLeft}
              y1={y}
              x2={800 - paddingRight}
              y2={y}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
          );
        })}

        {/* Eixo Y - labels com R$ */}
        {yTicks.reverse().map((tick, i) => {
          const y = paddingTop + chartHeight - (tick / maxValue * chartHeight);
          return (
            <text
              key={i}
              x={paddingLeft - 8}
              y={y + 4}
              textAnchor="end"
              className="text-[11px]"
              fill="#64748b"
            >
              {formatYAxis(tick)}
            </text>
          );
        })}

        {/* Área preenchida com curva suave */}
        <path
          d={(() => {
            const points = data.map((d, i) => {
              const x = paddingLeft + (i * (800 - paddingLeft - paddingRight) / (data.length - 1));
              const y = paddingTop + chartHeight - (d.value / maxValue * chartHeight);
              return { x, y };
            });

            // Criar curva suave usando curvas de Bezier
            let path = `M ${points[0].x} ${paddingTop + chartHeight}`;
            path += ` L ${points[0].x} ${points[0].y}`;

            for (let i = 0; i < points.length - 1; i++) {
              const curr = points[i];
              const next = points[i + 1];
              const midX = (curr.x + next.x) / 2;
              path += ` C ${midX} ${curr.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
            }

            path += ` L ${points[points.length - 1].x} ${paddingTop + chartHeight} Z`;
            return path;
          })()}
          fill="url(#revenueGradient)"
        />

        {/* Linha do gráfico com curva suave */}
        <path
          d={(() => {
            const points = data.map((d, i) => {
              const x = paddingLeft + (i * (800 - paddingLeft - paddingRight) / (data.length - 1));
              const y = paddingTop + chartHeight - (d.value / maxValue * chartHeight);
              return { x, y };
            });

            let path = `M ${points[0].x} ${points[0].y}`;

            for (let i = 0; i < points.length - 1; i++) {
              const curr = points[i];
              const next = points[i + 1];
              const midX = (curr.x + next.x) / 2;
              path += ` C ${midX} ${curr.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
            }

            return path;
          })()}
          fill="none"
          stroke="#bd7b65"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pontos interativos */}
        {data.map((d, i) => {
          const x = paddingLeft + (i * (800 - paddingLeft - paddingRight) / (data.length - 1));
          const y = paddingTop + chartHeight - (d.value / maxValue * chartHeight);
          return (
            <g key={i}>
              {/* Área invisível maior para hover */}
              <circle
                cx={x}
                cy={y}
                r={20}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setTooltip({ x, y, value: d.value, label: d.name })}
                onMouseLeave={() => setTooltip(null)}
              />
              {/* Ponto visível */}
              <circle
                cx={x}
                cy={y}
                r={tooltip?.x === x ? 6 : 4}
                fill="#bd7b65"
                stroke="white"
                strokeWidth={2}
                className="transition-all duration-200"
              />
            </g>
          );
        })}

        {/* Eixo X - labels */}
        {data.map((d, i) => {
          const x = paddingLeft + (i * (800 - paddingLeft - paddingRight) / (data.length - 1));
          return (
            <text
              key={i}
              x={x}
              y={paddingTop + chartHeight + 25}
              textAnchor="middle"
              className="text-[12px]"
              fill="#64748b"
            >
              {d.name}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bg-white rounded-xl shadow-xl border border-slate-100 px-4 py-3 pointer-events-none z-10 transform -translate-x-1/2 -translate-y-full"
          style={{
            left: `${(tooltip.x / 800) * 100}%`,
            top: `${((tooltip.y) / (chartHeight + paddingTop + paddingBottom)) * 100}%`,
            marginTop: '-10px'
          }}
        >
          <div className="text-xs text-slate-500 mb-1">{tooltip.label}</div>
          <div className="text-sm font-semibold text-slate-800">{formatCurrency(tooltip.value)}</div>
        </div>
      )}
    </div>
  );
};

const SimpleBarChart = ({ data }: { data: { name: string; count: number }[] }) => {
    const [hoveredBar, setHoveredBar] = useState<number | null>(null);
    const max = Math.max(...data.map(d => d.count), 5);
    const yTicks = [0, Math.ceil(max * 0.25), Math.ceil(max * 0.5), Math.ceil(max * 0.75), max];

    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 40; // Mais espaço em cima para o tooltip
    const paddingBottom = 30; // Menos espaço embaixo
    const chartHeight = 200; // Gráfico mais alto
    const chartWidth = 400;
    const barWidth = Math.min(45, (chartWidth - paddingLeft - paddingRight) / data.length - 12);

    return (
        <div className="w-full relative">
            <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight + paddingTop + paddingBottom}`}
                className="w-full h-auto"
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Grid horizontal */}
                {yTicks.map((tick, i) => {
                    const y = paddingTop + chartHeight - (tick / max * chartHeight);
                    return (
                        <line
                            key={i}
                            x1={paddingLeft}
                            y1={y}
                            x2={chartWidth - paddingRight}
                            y2={y}
                            stroke="#f1f5f9"
                            strokeWidth={1}
                        />
                    );
                })}

                {/* Eixo Y - labels com "agend." */}
                {yTicks.map((tick, i) => {
                    const y = paddingTop + chartHeight - (tick / max * chartHeight);
                    return (
                        <text
                            key={i}
                            x={paddingLeft - 8}
                            y={y + 4}
                            textAnchor="end"
                            className="text-[10px]"
                            fill="#64748b"
                        >
                            {tick} agend.
                        </text>
                    );
                })}

                {/* Barras */}
                {data.map((d, i) => {
                    const barSpacing = (chartWidth - paddingLeft - paddingRight) / data.length;
                    const x = paddingLeft + (i * barSpacing) + (barSpacing - barWidth) / 2;
                    const barHeight = Math.max((d.count / max) * chartHeight, 3);
                    const y = paddingTop + chartHeight - barHeight;
                    const isHovered = hoveredBar === i;

                    return (
                        <g key={d.name}>
                            {/* Barra */}
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                rx={4}
                                fill={isHovered ? '#a8634d' : '#bd7b65'}
                                className="transition-all duration-200 cursor-pointer"
                                onMouseEnter={() => setHoveredBar(i)}
                                onMouseLeave={() => setHoveredBar(null)}
                            />

                            {/* Tooltip no hover */}
                            {isHovered && (
                                <g>
                                    <rect
                                        x={x + barWidth / 2 - 28}
                                        y={y - 28}
                                        width={56}
                                        height={22}
                                        rx={4}
                                        fill="#1e293b"
                                    />
                                    <text
                                        x={x + barWidth / 2}
                                        y={y - 13}
                                        textAnchor="middle"
                                        className="text-[10px]"
                                        fill="white"
                                    >
                                        {d.count} agend.
                                    </text>
                                </g>
                            )}

                            {/* Label do eixo X */}
                            <text
                                x={x + barWidth / 2}
                                y={paddingTop + chartHeight + 20}
                                textAnchor="middle"
                                className="text-[10px] font-medium"
                                fill="#64748b"
                            >
                                {d.name.split(' ')[0]}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// Loading Skeleton Component
const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="flex justify-between items-center">
      <div>
        <div className="h-8 w-48 bg-slate-200 rounded-lg mb-2"></div>
        <div className="h-4 w-64 bg-slate-100 rounded"></div>
      </div>
      <div className="h-10 w-32 bg-slate-200 rounded-xl"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-3 w-20 bg-slate-200 rounded mb-2"></div>
              <div className="h-6 w-24 bg-slate-300 rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="bg-white p-6 rounded-2xl border border-slate-200">
      <div className="h-5 w-40 bg-slate-200 rounded mb-6"></div>
      <div className="h-64 bg-slate-100 rounded-xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    </div>
  </div>
);

const ClinicDashboard: React.FC = () => {
  const { appointments, user, systemAlerts, currentCompany, dismissedAlertIds, dismissAlert, updateAppointmentStatus, addNotification, loadAppointments } = useApp();
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);
  const [revenueRange, setRevenueRange] = useState<'7d' | '30d'>('7d');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Estado para dados da API otimizada
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const DASHBOARD_CACHE_MS = 30000; // 30 segundos de cache

  // Carregar dados da API otimizada com cache
  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    // Se já tem dados e cache ainda válido, não recarregar
    const now = Date.now();
    if (!forceRefresh && dashboardData && (now - lastFetchTime < DASHBOARD_CACHE_MS)) {
      return;
    }

    setIsLoadingDashboard(true);
    try {
      const days = revenueRange === '7d' ? 7 : 30;
      console.log('📊 Carregando dashboard, dias:', days);
      const response = await dashboardApi.getStats(days);
      console.log('📊 Resposta dashboard:', JSON.stringify(response, null, 2));
      if (response.success && response.data) {
        setDashboardData(response.data);
        setLastFetchTime(now);
        console.log('✅ Dashboard KPIs:', JSON.stringify(response.data.kpis, null, 2));
        console.log('✅ Dashboard Charts:', JSON.stringify(response.data.charts, null, 2));
      } else {
        console.error('❌ Dashboard API falhou:', response.error);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dashboard:', error);
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [revenueRange, dashboardData, lastFetchTime]);

  // Carregar dados do dashboard e agendamentos (para mostrar pendentes)
  useEffect(() => {
    loadDashboardData();
    // Carregar agendamentos apenas se não tiver dados ou cache expirado
    loadAppointments();
  }, [loadDashboardData, loadAppointments]);

  // Recarregar quando mudar o range de tempo
  useEffect(() => {
    if (dashboardData) {
      loadDashboardData(true);
    }
  }, [revenueRange]);

  // Dados que ainda precisam vir do contexto (tempo real)
  const pendingApprovals = useMemo(() => {
    return appointments.filter(a => a.status === 'pending_approval');
  }, [appointments]);

  // Alertas do sistema (combina API + alertas do banco)
  const activeAlerts = useMemo(() => {
    const dbAlerts = systemAlerts.filter(a => (a.target === 'all' || a.target === user?.companyId) && a.status === 'active');
    const invAlerts = dashboardData?.alerts.lowStock.map(a => ({
      ...a,
      createdAt: new Date().toISOString()
    })) || [];
    return [...invAlerts, ...dbAlerts].filter(a => !dismissedAlertIds.includes(a.id)).slice(0, 5);
  }, [systemAlerts, user, dashboardData, dismissedAlertIds]);

  const handleQuickApprove = (appt: Appointment) => {
    setApprovingId(appt.id);
    setTimeout(() => {
      updateAppointmentStatus(appt.id, 'confirmed');
      addNotification({
        companyId: appt.companyId,
        recipientId: appt.patientId,
        message: `Olá ${appt.patientName}, seu agendamento para ${appt.service} em ${formatDate(appt.date)} foi APROVADO!`,
        type: 'success'
      });
      setApprovingId(null);
    }, 600);
  };

  // Mostrar skeleton enquanto carrega
  if (isLoadingDashboard || !dashboardData) {
    return <DashboardSkeleton />;
  }

  // Dados da API
  const { kpis, charts } = dashboardData;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-secondary-900 flex items-center gap-2">Dashboard <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-[10px] font-bold uppercase rounded-full border border-primary-100">{user?.role === UserRole.ADMIN ? currentCompany?.name : 'Recepção'}</span></h1>
            <p className="text-slate-500">Visão geral da clínica e performance em tempo real.</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                {['7d', '30d'].map(r => (
                    <button key={r} onClick={() => setRevenueRange(r as any)} className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all tracking-wider ${revenueRange === r ? 'bg-primary-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>{r.toUpperCase()}</button>
                ))}
          </div>
      </div>

      {pendingApprovals.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100">
                  <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      <span className="text-sm font-semibold text-amber-800">Novas Solicitações</span>
                      <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">{pendingApprovals.length}</span>
                  </div>
                  <span className="text-xs text-amber-600 font-medium hidden sm:block">Aguardando aprovação</span>
              </div>
              <div className="divide-y divide-amber-100 max-h-72 overflow-y-auto">
                  {pendingApprovals.map((appt) => (
                      <div key={appt.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                              {appt.patientName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{appt.patientName}</p>
                              <p className="text-xs text-slate-500 truncate">{appt.service} · {new Date(appt.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {new Date(appt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                              <button
                                  onClick={() => updateAppointmentStatus(appt.id, 'canceled')}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-colors"
                              >
                                  Recusar
                              </button>
                              <button
                                  onClick={() => handleQuickApprove(appt)}
                                  disabled={approvingId === appt.id}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50"
                              >
                                  {approvingId === appt.id ? 'Aprovando...' : 'Aprovar'}
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeAlerts.length > 0 && (
          <div className="space-y-3">
              {activeAlerts.slice(0, 3).map(alert => {
                  const config = ALERT_VISUAL_CONFIG[alert.type] || ALERT_VISUAL_CONFIG.info;
                  const Icon = config.icon;
                  return (
                    <div key={alert.id} onClick={() => setSelectedAlert(alert as any)} className={`group relative p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:shadow-sm ${config.bg} ${config.border} ${config.text}`}>
                        <div className="p-2 rounded-lg bg-white/50"><Icon className="w-5 h-5" /></div>
                        <div className="flex-1"><p className="font-bold text-sm tracking-tight">{alert.title}</p><p className="text-xs opacity-80 truncate max-w-[80%]">{alert.message}</p></div>
                        <div className="flex items-center gap-4 pr-2"><span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-slate-900">Ler mais</span><button onClick={(e) => { e.stopPropagation(); dismissAlert(alert.id); }} className="p-1.5 rounded-full hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-all"><X className="w-4 h-4" /></button></div>
                    </div>
                  );
              })}
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Faturamento" value={formatCurrency(kpis.revenue)} icon={DollarSign} color="bg-emerald-500" />
        <StatCard title="Ticket Médio" value={formatCurrency(kpis.ticketMedio)} icon={TrendingUp} color="bg-primary-500" />
        <StatCard title="Pacientes Atendidos" value={kpis.seenPatients} icon={Users} color="bg-blue-500" subtitle="No período" />
        <StatCard title="Taxa de Cancelamento" value={`${kpis.cancelRate}%`} icon={UserCheck} color="bg-indigo-500" subtitle="Performance" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
          <div className="p-4 lg:p-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
              <History className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">Total</p>
              <p className="text-2xl font-serif font-bold text-secondary-900 leading-none">{kpis.appointmentsTotal}</p>
            </div>
          </div>
          <div className="p-4 lg:p-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">Confirmadas</p>
              <p className="text-2xl font-serif font-bold text-emerald-600 leading-none">{kpis.appointmentsConfirmed}</p>
            </div>
          </div>
          <div className="p-4 lg:p-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">Canceladas</p>
              <p className="text-2xl font-serif font-bold text-red-500 leading-none">{kpis.appointmentsCanceled}</p>
            </div>
          </div>
          <div className="p-4 lg:p-5 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${kpis.cancelRate > 20 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
              <ArrowRight className={`w-4 h-4 ${kpis.cancelRate > 20 ? 'text-red-400' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">Taxa de Falta</p>
              <p className={`text-2xl font-serif font-bold leading-none ${kpis.cancelRate > 20 ? 'text-red-600' : 'text-secondary-900'}`}>{kpis.cancelRate}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 bg-white p-5 lg:p-6 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-primary-50">
              <TrendingUp className="w-4 h-4 text-primary-500" />
            </div>
            <h3 className="text-sm font-semibold text-secondary-800 tracking-wide">Histórico de Receita</h3>
          </div>
          <SimpleRevenueChart data={charts.revenueChart} />
        </div>
        <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-secondary-800 tracking-wide mb-5">Procedimentos Populares</h3>
          <SimpleBarChart data={charts.topProcedures} />
        </div>
      </div>

      {selectedAlert && <AlertDetailsModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />}
    </div>
  );
};

const SaaSDashboard: React.FC = () => {
  const { companies, patients, appointments, saasPlans, isLoading } = useApp();
  const mrr = useMemo(() => companies.reduce((acc, c) => acc + (saasPlans.find(p => p.id === c.plan)?.price || 0), 0), [companies, saasPlans]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-serif font-bold text-secondary-900 flex items-center gap-2">SaaS Overview <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-full border border-amber-200">Global Admin</span></h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Receita (MRR)" value={formatCurrency(mrr)} icon={DollarSign} color="bg-emerald-600" trend="+15%" />
            <StatCard title="Clínicas Ativas" value={companies.length} icon={Building} color="bg-blue-600" />
            <StatCard title="Agendamentos Global" value={appointments.length} icon={CalendarCheck} color="bg-purple-600" />
            <StatCard title="Total Pacientes" value={patients.length} icon={Users} color="bg-primary-50" />
        </div>
    </div>
  );
}

const Dashboard: React.FC = () => {
  const { user } = useApp();
  return user?.role === UserRole.OWNER ? <SaaSDashboard /> : <ClinicDashboard />;
};

export default Dashboard;
