import React, { useMemo, useEffect, useState } from 'react';
import { DollarSign, Users, CalendarCheck, TrendingUp, X, AlertTriangle, CheckCircle, ArrowRight, Package, UserCheck, History, XCircle, Building, Clock, UserPlus, Check, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole, SystemAlert, Appointment } from '../types';
import { AlertDetailsModal } from '../components/Modals';
import { formatCurrency, formatDate } from '../utils/formatUtils';
import { ALERT_VISUAL_CONFIG } from '../utils/statusUtils';
import StatCard from '../components/StatCard';
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

const ClinicDashboard: React.FC = () => {
  const { appointments, transactions, user, notifications, markNotificationAsRead, systemAlerts, currentCompany, inventory, dismissedAlertIds, dismissAlert, updateAppointmentStatus, addNotification } = useApp();
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);
  const [revenueRange, setRevenueRange] = useState<'7d' | '30d'>('7d');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const pendingApprovals = useMemo(() => {
      return appointments.filter(a => a.status === 'pending_approval');
  }, [appointments]);

  const handleQuickApprove = (appt: Appointment) => {
      setApprovingId(appt.id);
      setTimeout(() => {
        updateAppointmentStatus(appt.id, 'confirmed');
        // ENVIAR NOTIFICAÇÃO DIRECIONADA AO PACIENTE
        addNotification({
            companyId: appt.companyId,
            recipientId: appt.patientId, // <--- DIRECIONADO AO PACIENTE
            message: `Olá ${appt.patientName}, seu agendamento para ${appt.service} em ${formatDate(appt.date)} foi APROVADO!`,
            type: 'success'
        });
        setApprovingId(null);
      }, 600);
  };

  const activeAlerts = useMemo(() => {
      const dbAlerts = systemAlerts.filter(a => (a.target === 'all' || a.target === user?.companyId) && a.status === 'active');
      const invAlerts = inventory.filter(i => i.currentStock <= i.minStock).map(i => ({
          id: `auto_inv_${i.id}`,
          title: `Alerta de Estoque: ${i.name}`,
          message: `O estoque de ${i.name} (${i.currentStock} ${i.unit}) atingiu o nível mínimo.`,
          type: 'warning' as any,
          createdAt: new Date().toISOString()
      }));
      return [...invAlerts, ...dbAlerts].filter(a => !dismissedAlertIds.includes(a.id)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [systemAlerts, user, inventory, dismissedAlertIds]);

  const kpiData = useMemo(() => {
    const rangeDate = new Date();
    rangeDate.setDate(rangeDate.getDate() - (revenueRange === '7d' ? 7 : 30));
    const periodTrans = transactions.filter(t => new Date(t.date) >= rangeDate);
    const periodAppts = appointments.filter(a => new Date(a.date) >= rangeDate);
    const income = periodTrans.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const seenPatients = new Set(periodAppts.filter(a => a.status === 'completed').map(a => a.patientId)).size;
    const canceled = periodAppts.filter(a => a.status === 'canceled').length;
    const incomeCount = periodTrans.filter(t => t.type === 'income').length;
    return { income, seenPatients, count: periodAppts.length, confirmed: periodAppts.filter(a => ['confirmed', 'completed'].includes(a.status)).length, canceled, ticket: incomeCount > 0 ? income / incomeCount : 0, cancelRate: periodAppts.length > 0 ? (canceled / periodAppts.length) * 100 : 0 };
  }, [transactions, appointments, revenueRange]);

  const revenueChartData = useMemo(() => {
    const data: { name: string; value: number }[] = [];
    const today = new Date();
    const days = revenueRange === '7d' ? 6 : 29;

    for (let i = days; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      // Busca transações do dia - garantindo que date é string
      const dayTransactions = transactions.filter(t => {
        const isIncome = t.type === 'income';
        const dateStr = typeof t.date === 'string' ? t.date : (t.date as any)?.toISOString?.() || '';
        const dateMatch = dateStr.substring(0, 10) === dateKey;
        return isIncome && dateMatch;
      });
      const val = dayTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
      data.push({
        name: revenueRange === '7d' ? d.toLocaleDateString('pt-BR', { weekday: 'short' }) : d.toLocaleDateString('pt-BR', { day: '2-digit' }),
        value: val
      });
    }
    return data;
  }, [transactions, revenueRange]);

  const proceduresChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach(a => { if (a.status !== 'canceled') counts[a.service] = (counts[a.service] || 0) + 1; });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [appointments]);

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
          <div className="bg-amber-50 rounded-2xl border border-amber-200 overflow-hidden shadow-sm animate-fade-in">
              <div className="p-4 border-b border-amber-200 flex justify-between items-center bg-white/50">
                  <h3 className="font-bold text-amber-800 flex items-center gap-2">
                      <UserPlus className="w-5 h-5" /> Solicitações Aguardando Aprovação
                  </h3>
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                      {pendingApprovals.length} Pendentes
                  </span>
              </div>
              <div className="p-4 space-y-3">
                  {pendingApprovals.map(appt => (
                      <div key={appt.id} className="bg-white p-4 rounded-xl border border-amber-100 flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:shadow-md">
                          <div className="flex items-center gap-4 w-full md:w-auto">
                              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                                  {appt.patientName.charAt(0)}
                              </div>
                              <div>
                                  <p className="font-bold text-slate-800 text-sm">{appt.patientName}</p>
                                  <p className="text-xs text-slate-500">{appt.service} • {new Date(appt.date).toLocaleDateString()} às {new Date(appt.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-2 w-full md:w-auto">
                              <button 
                                onClick={() => updateAppointmentStatus(appt.id, 'canceled')}
                                className="flex-1 md:flex-none px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                Recusar
                              </button>
                              <button 
                                onClick={() => handleQuickApprove(appt)}
                                disabled={approvingId === appt.id}
                                className="flex-1 md:flex-none px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {approvingId === appt.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                {approvingId === appt.id ? 'Aprovando...' : 'Aprovar Agora'}
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
        <StatCard title="Faturamento" value={formatCurrency(kpiData.income)} trend="+8%" icon={DollarSign} color="bg-emerald-500" />
        <StatCard title="Ticket Médio" value={formatCurrency(kpiData.ticket)} icon={TrendingUp} color="bg-primary-500" />
        <StatCard title="Pacientes Atendidos" value={kpiData.seenPatients} icon={Users} color="bg-blue-500" subtitle="No período" />
        <StatCard title="Taxa de Cancelamento" value={`${kpiData.cancelRate.toFixed(1)}%`} icon={UserCheck} color="bg-indigo-500" subtitle="Performance" />
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100"><History className="w-6 h-6" /></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Agendamentos</p><p className="text-xl font-bold text-slate-800">{kpiData.count}</p></div>
          </div>
          <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-500 border border-green-100"><CheckCircle className="w-6 h-6" /></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Confirmadas</p><p className="text-xl font-bold text-slate-800">{kpiData.confirmed}</p></div>
          </div>
          <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 border border-red-100"><XCircle className="w-6 h-6" /></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Canceladas</p><p className="text-xl font-bold text-slate-800">{kpiData.canceled}</p></div>
          </div>
          <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Taxa de Falta</p><p className={`text-xl font-bold ${kpiData.cancelRate > 20 ? 'text-red-600' : 'text-slate-800'}`}>{kpiData.cancelRate.toFixed(1)}%</p></div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 opacity-20"></div>
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary-500" /> Histórico de Receita</h3>
          <SimpleRevenueChart data={revenueChartData} />
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Procedimentos Populares</h3>
          <SimpleBarChart data={proceduresChartData} />
        </div>
      </div>

      {selectedAlert && <AlertDetailsModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />}
    </div>
  );
};

const SaaSDashboard: React.FC = () => {
  const { companies, patients, appointments, saasPlans } = useApp();
  const mrr = useMemo(() => companies.reduce((acc, c) => acc + (saasPlans.find(p => p.id === c.plan)?.price || 0), 0), [companies, saasPlans]);
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
