import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { DollarSign, Users, CalendarCheck, TrendingUp, X, AlertTriangle, CheckCircle, ArrowRight, Package, UserCheck, History, XCircle, Building, Clock, UserPlus, Check, RefreshCw, Loader2 } from 'lucide-react';
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
      const response = await dashboardApi.getStats(days);
      if (response.success && response.data) {
        setDashboardData(response.data);
        setLastFetchTime(now);
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
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
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">Dashboard <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-[10px] font-bold uppercase rounded-full border border-primary-100">{user?.role === UserRole.ADMIN ? currentCompany?.name : 'Recepção'}</span></h1>
            <p className="text-slate-500">Visão geral da clínica e performance em tempo real.</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                {['7d', '30d'].map(r => (
                    <button key={r} onClick={() => setRevenueRange(r as any)} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${revenueRange === r ? 'bg-primary-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{r.toUpperCase()}</button>
                ))}
          </div>
      </div>

      {pendingApprovals.length > 0 && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-[2px] shadow-2xl shadow-amber-500/20 animate-fade-in">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 via-transparent to-rose-400/20 animate-pulse"></div>
              <div className="relative bg-white rounded-[22px] overflow-hidden">
                  {/* Header com gradiente */}
                  <div className="relative px-4 lg:px-6 py-4 lg:py-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 lg:gap-4">
                              <div className="relative">
                                  <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                      <UserPlus className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                                  </div>
                                  <div className="absolute -top-1 -right-1 w-4 h-4 lg:w-5 lg:h-5 bg-red-500 rounded-full flex items-center justify-center animate-bounce">
                                      <span className="text-[8px] lg:text-[10px] text-white font-bold">{pendingApprovals.length}</span>
                                  </div>
                              </div>
                              <div>
                                  <h3 className="text-base lg:text-lg font-bold text-slate-800">Novas Solicitações</h3>
                                  <p className="text-xs lg:text-sm text-slate-500">Clientes aguardando aprovação</p>
                              </div>
                          </div>
                          <div className="hidden sm:flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-amber-100/50 rounded-full">
                              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                              <span className="text-[10px] lg:text-xs font-semibold text-amber-700">Ação necessária</span>
                          </div>
                      </div>
                  </div>

                  {/* Lista de solicitações */}
                  <div className="p-3 lg:p-4 space-y-3 max-h-[400px] overflow-y-auto">
                      {pendingApprovals.map((appt, index) => (
                          <div
                              key={appt.id}
                              className="group relative bg-gradient-to-r from-slate-50 to-white p-3 lg:p-5 rounded-xl lg:rounded-2xl border border-slate-100 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-100 transition-all duration-300"
                              style={{ animationDelay: `${index * 100}ms` }}
                          >
                              <div className="flex flex-col gap-3 lg:gap-4">
                                  {/* Info do paciente */}
                                  <div className="flex items-center gap-3 lg:gap-4 flex-1">
                                      <div className="relative shrink-0">
                                          <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-base lg:text-xl font-bold shadow-lg shadow-primary-500/30">
                                              {appt.patientName.charAt(0).toUpperCase()}
                                          </div>
                                          <div className="absolute -bottom-1 -right-1 w-4 h-4 lg:w-5 lg:h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
                                              <Clock className="w-2 h-2 lg:w-3 lg:h-3 text-white" />
                                          </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <p className="font-bold text-slate-800 text-sm lg:text-base truncate">{appt.patientName}</p>
                                          <p className="text-xs lg:text-sm text-primary-600 font-medium truncate">{appt.service}</p>
                                          <div className="flex items-center gap-1.5 lg:gap-2 mt-0.5 lg:mt-1">
                                              <CalendarCheck className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-slate-400 shrink-0" />
                                              <span className="text-[10px] lg:text-xs text-slate-500 truncate">
                                                  {new Date(appt.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} às {new Date(appt.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                              </span>
                                          </div>
                                      </div>
                                  </div>

                                  {/* Botões de ação */}
                                  <div className="flex items-center gap-2 lg:gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 lg:pl-4 lg:border-l border-slate-100">
                                      <button
                                          onClick={() => updateAppointmentStatus(appt.id, 'canceled')}
                                          className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 lg:gap-2 px-3 lg:px-5 py-2 lg:py-2.5 text-xs lg:text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg lg:rounded-xl border border-slate-200 hover:border-red-200 transition-all duration-200"
                                      >
                                          <XCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                          <span>Recusar</span>
                                      </button>
                                      <button
                                          onClick={() => handleQuickApprove(appt)}
                                          disabled={approvingId === appt.id}
                                          className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 lg:gap-2 px-3 lg:px-6 py-2 lg:py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white text-xs lg:text-sm font-bold rounded-lg lg:rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                          {approvingId === appt.id ? (
                                              <>
                                                  <RefreshCw className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin" />
                                                  <span>Aprovando...</span>
                                              </>
                                          ) : (
                                              <>
                                                  <CheckCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                                  <span>Aprovar</span>
                                              </>
                                          )}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
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

      <div className="bg-white p-4 lg:p-6 rounded-xl lg:rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
          <div className="flex items-center gap-2 lg:gap-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shrink-0"><History className="w-5 h-5 lg:w-6 lg:h-6" /></div>
              <div><p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase">Agendamentos</p><p className="text-lg lg:text-xl font-bold text-slate-800">{kpis.appointmentsTotal}</p></div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-green-50 flex items-center justify-center text-green-500 border border-green-100 shrink-0"><CheckCircle className="w-5 h-5 lg:w-6 lg:h-6" /></div>
              <div><p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase">Confirmadas</p><p className="text-lg lg:text-xl font-bold text-slate-800">{kpis.appointmentsConfirmed}</p></div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 border border-red-100 shrink-0"><XCircle className="w-5 h-5 lg:w-6 lg:h-6" /></div>
              <div><p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase">Canceladas</p><p className="text-lg lg:text-xl font-bold text-slate-800">{kpis.appointmentsCanceled}</p></div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4 bg-slate-50 rounded-lg lg:rounded-xl p-2 lg:p-3 border border-slate-100">
              <div><p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase">Taxa de Falta</p><p className={`text-lg lg:text-xl font-bold ${kpis.cancelRate > 20 ? 'text-red-600' : 'text-slate-800'}`}>{kpis.cancelRate}%</p></div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 bg-white p-4 lg:p-6 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 opacity-20"></div>
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 lg:mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-primary-500" /> Histórico de Receita</h3>
          <SimpleRevenueChart data={charts.revenueChart} />
        </div>
        <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 lg:mb-6">Procedimentos Populares</h3>
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
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">SaaS Overview <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-full border border-amber-200">Global Admin</span></h1>
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
