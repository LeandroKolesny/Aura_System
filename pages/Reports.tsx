import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useApp } from '../context/AppContext';
import {
  BarChart3, TrendingUp, Users, DollarSign, Building, Crown, ChevronDown,
  Star, ArrowUpRight, Activity, CalendarCheck, UserCheck, Calendar,
  Briefcase, Target, Zap, Award, PieChart, Filter, Download, RefreshCw,
  ChevronRight, Sparkles, TrendingDown, AlertTriangle, Loader2, UserX
} from 'lucide-react';

const RetentionTab = lazy(() => import('../components/RetentionTab'));
import { formatCurrency } from '../utils/formatUtils';
import { UserRole } from '../types';
import { RevenueAreaChart, MetricDonutChart, HorizontalBarChart, KPICard, MiniSparkline } from '../components/charts';
import { ReportsSkeleton } from '../components/LoadingSkeleton';
import { UpgradeOverlay } from '../components/UpgradeOverlay';

// --- COMPONENTES AUXILIARES MODERNOS ---

const SectionHeader: React.FC<{
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  iconColor?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, iconColor = 'text-primary-600', action }) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const ModernRankingCard: React.FC<{
  title: string;
  items: { name: string; value: string | number; subtext?: string; avatar?: string }[];
  icon: React.ElementType;
  accentColor: string;
  emptyText?: string;
}> = ({ title, items, icon: Icon, accentColor, emptyText = 'Sem dados disponíveis' }) => (
  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-lg ${accentColor}/10`}>
          <Icon className={`w-4 h-4 ${accentColor.replace('bg-', 'text-')}`} />
        </div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
    </div>
    <div className="divide-y divide-slate-50">
      {items.map((item, index) => (
        <div key={index} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
          <div className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm
              ${index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white' :
                'bg-slate-100 text-slate-500 border border-slate-200'}
            `}>
              {index + 1}
            </div>
            <div>
              <p className="font-medium text-slate-700 text-sm group-hover:text-slate-900 transition-colors">{item.name}</p>
              {item.subtext && <p className="text-xs text-slate-400">{item.subtext}</p>}
            </div>
          </div>
          <div className="font-bold text-slate-700 text-sm">{item.value}</div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="px-5 py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-400">{emptyText}</p>
        </div>
      )}
    </div>
  </div>
);

const InsightCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: 'default' | 'highlight';
}> = ({ title, value, subtitle, variant = 'default' }) => (
  <div className={`p-4 rounded-xl transition-all duration-300 ${
    variant === 'highlight'
      ? 'bg-gradient-to-br from-white/20 to-white/5 border border-white/20 hover:border-white/30'
      : 'bg-white/10 hover:bg-white/15'
  }`}>
    <p className="text-[11px] text-slate-300 uppercase font-bold tracking-wider">{title}</p>
    <p className="text-xl font-bold mt-1.5 text-white">{value}</p>
    {subtitle && <p className="text-xs text-emerald-400 mt-1">{subtitle}</p>}
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; border: string }> = {
    'Estrela ⭐': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    'Popular 🔥': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'Premium 💎': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'Baixo Rendimento ⚠️': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    'Regular': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }
  };
  const style = config[status] || config['Regular'];

  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
      {status}
    </span>
  );
};

const Reports: React.FC = () => {
  const {
    companies, saasPlans, patients, appointments, transactions, procedures, professionals, user, currentCompany,
    loadPatients, loadAppointments, loadTransactions, loadProcedures, loadProfessionals, loadingStates, checkModuleAccess
  } = useApp();

  const hasReportsAccess = checkModuleAccess('reports');
  // State Initialization - Hook 1
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('6m');
  const [activeTab, setActiveTab] = useState<'analytics' | 'retention'>('analytics');

  const isOwner = user?.role === UserRole.OWNER;

  // Lazy loading - carregar todos os dados necessários para relatórios
  useEffect(() => {
    loadPatients();
    loadAppointments();
    loadTransactions();
    loadProcedures();
    loadProfessionals();
  }, [loadPatients, loadAppointments, loadTransactions, loadProcedures, loadProfessionals]);

  // Effect to set default company - Hook 2
  useEffect(() => {
      // Se não for owner, trava a empresa na do usuário logado
      if (user && user.role !== UserRole.OWNER) {
          setSelectedCompanyId(user.companyId);
      } else if (companies && companies.length > 0 && !selectedCompanyId) {
          // Se for owner e não tiver selecionado, pega a primeira
          setSelectedCompanyId(companies[0].id);
      }
  }, [companies, selectedCompanyId, user]);

  // Helper function to get start date based on range
  const getStartDate = (range: string) => {
      const now = new Date();
      const d = new Date(now);
      d.setHours(0, 0, 0, 0); // Reset time part for accurate comparison
      
      switch(range) {
          case '1w': d.setDate(d.getDate() - 7); break;
          case '1m': d.setMonth(d.getMonth() - 1); break;
          case '2m': d.setMonth(d.getMonth() - 2); break;
          case '3m': d.setMonth(d.getMonth() - 3); break;
          case '6m': d.setMonth(d.getMonth() - 6); break;
          case '1y': d.setFullYear(d.getFullYear() - 1); break;
          case '2y': d.setFullYear(d.getFullYear() - 2); break;
          case '3y': d.setFullYear(d.getFullYear() - 3); break;
          case '4y': d.setFullYear(d.getFullYear() - 4); break;
          case '5y': d.setFullYear(d.getFullYear() - 5); break;
          default: d.setMonth(d.getMonth() - 6);
      }
      return d;
  };

  const getMonthMultiplier = (range: string) => {
      switch(range) {
          case '1w': return 0.25;
          case '1m': return 1;
          case '2m': return 2;
          case '3m': return 3;
          case '6m': return 6;
          case '1y': return 12;
          case '2y': return 24;
          case '3y': return 36;
          case '4y': return 48;
          case '5y': return 60;
          default: return 1;
      }
  };

  const getTimeRangeLabel = (range: string) => {
      switch(range) {
          case '1w': return 'Última Semana';
          case '1m': return 'Último Mês';
          case '2m': return 'Últimos 2 Meses';
          case '3m': return 'Últimos 3 Meses';
          case '6m': return 'Últimos 6 Meses';
          case '1y': return 'Último Ano';
          case '2y': return 'Últimos 2 Anos';
          case '3y': return 'Últimos 3 Anos';
          case '4y': return 'Últimos 4 Anos';
          case '5y': return 'Últimos 5 Anos';
          default: return 'Período';
      }
  };

  // 1. RANKING: Clínicas que mais gastam no SaaS - Hook 3
  const topSpenderClinics = useMemo(() => {
      if (!companies) return [];
      const clinicSpend = companies.map(c => {
          const plan = saasPlans.find(p => p.id === c.plan);
          const monthlyPrice = plan ? plan.price : 0;
          return {
              id: c.id,
              name: c.name,
              value: monthlyPrice,
              planName: plan?.name || 'Desconhecido'
          };
      });
      return clinicSpend.sort((a, b) => b.value - a.value).slice(0, 5).map(c => ({
          name: c.name,
          value: formatCurrency(c.value),
          subtext: `Plano ${c.planName}`
      }));
  }, [companies, saasPlans]);

  // 2. RANKING: Clínicas com mais pacientes - Hook 4
  const topPopulousClinics = useMemo(() => {
      if (!companies) return [];
      const counts = companies.map(c => {
          const count = patients.filter(p => p.companyId === c.id).length;
          return { name: c.name, count };
      });
      return counts.sort((a, b) => b.count - a.count).slice(0, 5).map(c => ({
          name: c.name,
          value: c.count,
          subtext: 'pacientes ativos'
      }));
  }, [companies, patients]);

  // --- DADOS DA CLÍNICA SELECIONADA ---

  // 3. TOP PROCEDIMENTOS - Hook 5
  const topProceduresByClinic = useMemo(() => {
      if (!selectedCompanyId) return [];
      
      const startDate = getStartDate(timeRange);
      
      const validAppts = appointments.filter(a => 
          a.companyId === selectedCompanyId && 
          (a.status === 'completed' || a.status === 'confirmed') &&
          new Date(a.date) >= startDate
      );

      const counts: Record<string, number> = {};
      validAppts.forEach(a => {
          if (a.service) {
            counts[a.service] = (counts[a.service] || 0) + 1;
          }
      });

      return Object.entries(counts)
          .map(([name, value]) => ({ label: name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
  }, [selectedCompanyId, appointments, timeRange]);

  // 4. CLIENTES VIP - Hook 6
  const topSpendersInClinic = useMemo(() => {
      if (!selectedCompanyId) return [];

      const startDate = getStartDate(timeRange);

      const clinicTransactions = transactions.filter(t => 
          t.companyId === selectedCompanyId && 
          t.type === 'income' && 
          t.appointmentId &&
          new Date(t.date) >= startDate
      );

      const patientSpend: Record<string, number> = {};
      
      clinicTransactions.forEach(t => {
          const appt = appointments.find(a => a.id === t.appointmentId);
          if (appt && appt.patientName) {
              patientSpend[appt.patientName] = (patientSpend[appt.patientName] || 0) + t.amount;
          }
      });

      return Object.entries(patientSpend)
          .map(([name, total]) => ({ name, value: formatCurrency(total), raw: total }))
          .sort((a, b) => b.raw - a.raw)
          .slice(0, 5);

  }, [selectedCompanyId, transactions, appointments, timeRange]);

  // 5. MATRIZ DE EFICIÊNCIA - Hook 7
  const procedureEfficiency = useMemo(() => {
      if (!selectedCompanyId) return [];

      const startDate = getStartDate(timeRange);

      const clinicProcs = procedures.filter(p => p.companyId === selectedCompanyId);
      const clinicAppts = appointments.filter(a => 
          a.companyId === selectedCompanyId && 
          a.status === 'completed' &&
          new Date(a.date) >= startDate
      );

      return clinicProcs.map(proc => {
          const sales = clinicAppts.filter(a => a.service === proc.name);
          const volume = sales.length;
          const totalRevenue = sales.reduce((acc, curr) => acc + curr.price, 0);
          
          const realTicket = volume > 0 ? totalRevenue / volume : 0;
          
          // Classificação Simples (Lógica Atualizada)
          let status = 'Regular';
          if (volume > 5 && realTicket > 500) status = 'Estrela ⭐'; // Vende muito e caro
          else if (volume > 10) status = 'Popular 🔥'; // Vende muito, ticket menor
          else if (realTicket > 1000) status = 'Premium 💎'; // Vende pouco, mas caro
          else if (volume < 3) status = 'Baixo Rendimento ⚠️'; // Vende pouco e barato

          return {
              name: proc.name,
              volume,
              totalRevenue,
              ticket: realTicket,
              status
          };
      }).sort((a, b) => b.totalRevenue - a.totalRevenue); 

  }, [selectedCompanyId, procedures, appointments, timeRange]);

  // 6. HISTÓRICO DE RECEITA - Hook 8 (CORRIGIDO)
  const monthlyRevenueData = useMemo(() => {
    if (!selectedCompanyId) return [];
    
    const startDate = getStartDate(timeRange);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    let groupBy = 'month';
    if (['1w', '1m'].includes(timeRange)) {
        groupBy = 'day';
    }

    // Alinhar ao dia 1 para garantir iteração mensal limpa sem pular meses (ex: dia 31 -> dia 1)
    if (groupBy === 'month') {
        startDate.setDate(1); 
    }

    const dataMap = new Map<string, { label: string, value: number }>();

    const getKey = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        if (groupBy === 'day') {
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return `${y}-${m}`;
    };

    const getLabel = (date: Date) => {
        if (groupBy === 'day') {
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }
        return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
    };

    // 1. Inicializar slots vazios
    const loopDate = new Date(startDate);
    
    if (!isNaN(loopDate.getTime())) {
        while (loopDate <= endDate) {
            const key = getKey(loopDate);
            if (!dataMap.has(key)) {
                dataMap.set(key, { label: getLabel(loopDate), value: 0 });
            }
            
            if (groupBy === 'day') {
                loopDate.setDate(loopDate.getDate() + 1);
            } else {
                // Iteração Mensal Segura
                loopDate.setMonth(loopDate.getMonth() + 1);
                loopDate.setDate(1); // Força dia 1 para evitar bugs de 31 de Jan -> 3 de Mar
            }
        }
    }

    // 2. Agregar transações
    transactions.forEach(t => {
        if (t.companyId !== selectedCompanyId || t.type !== 'income') return;
        
        const tDate = new Date(t.date);
        
        // Removemos o filtro rígido de data aqui (tDate < startDate) e confiamos na chave do mapa.
        // Se a chave existir no mapa (que foi inicializado com o range correto), somamos.
        // Isso evita problemas de fuso horário ou datas limítrofes.
        
        const key = getKey(tDate);
        const entry = dataMap.get(key);
        if (entry) {
            entry.value += t.amount;
        }
    });

    return Array.from(dataMap.values());

  }, [selectedCompanyId, transactions, timeRange]);

  // 7. RETENÇÃO - Hook 9
  const retentionMetrics = useMemo(() => {
    if (!selectedCompanyId) return { single: 0, returning: 0, rate: '0' };

    const startDate = getStartDate(timeRange);

    // Consider appointments in the selected range
    const clinicAppts = appointments.filter(a => 
        a.companyId === selectedCompanyId && 
        a.status === 'completed' &&
        new Date(a.date) >= startDate
    );

    const patientCounts: Record<string, number> = {};
    clinicAppts.forEach(a => {
        if(a.patientId) {
            patientCounts[a.patientId] = (patientCounts[a.patientId] || 0) + 1;
        }
    });

    let returningCount = 0;
    let singleVisitCount = 0;

    Object.values(patientCounts).forEach(count => {
        if (count > 1) returningCount++;
        else singleVisitCount++;
    });

    const total = returningCount + singleVisitCount;
    const rate = total > 0 ? (returningCount / total) * 100 : 0;

    return { 
        returning: returningCount, 
        single: singleVisitCount, 
        rate: rate.toFixed(1) 
    };
  }, [selectedCompanyId, appointments, timeRange]);

  // 8. APPOINTMENT STATS - Hook 10
  const appointmentStats = useMemo(() => {
    if (!selectedCompanyId) return { completed: 0, canceled: 0, total: 0, cancelRate: '0' };

    const startDate = getStartDate(timeRange);

    const clinicAppts = appointments.filter(a => 
        a.companyId === selectedCompanyId &&
        new Date(a.date) >= startDate
    );
    
    const completed = clinicAppts.filter(a => a.status === 'completed').length;
    const canceled = clinicAppts.filter(a => a.status === 'canceled').length;
    const total = clinicAppts.length;
    const cancelRate = total > 0 ? (canceled / total) * 100 : 0;

    return { completed, canceled, total, cancelRate: cancelRate.toFixed(1) };
  }, [selectedCompanyId, appointments, timeRange]);

  // 9. PROFESSIONAL PERFORMANCE (NOVO) - Hook 11
  const professionalPerformance = useMemo(() => {
      if (!selectedCompanyId) return [];
      
      const startDate = getStartDate(timeRange);
      const monthsCount = getMonthMultiplier(timeRange);
      
      // Filtrar profissionais da empresa
      const clinicPros = professionals.filter(p => p.companyId === selectedCompanyId);
      
      // Calcular métricas para cada
      return clinicPros.map(pro => {
          const proAppts = appointments.filter(a => 
              a.professionalId === pro.id && 
              new Date(a.date) >= startDate
          );

          const completedAppts = proAppts.filter(a => a.status === 'completed');
          const canceledAppts = proAppts.filter(a => a.status === 'canceled');
          
          const totalRevenue = completedAppts.reduce((acc, curr) => acc + curr.price, 0);
          const totalAppts = completedAppts.length;
          const totalCanceled = canceledAppts.length;
          
          // Cost Logic
          let commissionCost = 0;
          if (pro.remunerationType === 'comissao' || pro.remunerationType === 'misto') {
              if (pro.commissionRate) {
                  commissionCost = totalRevenue * (pro.commissionRate / 100);
              }
          }

          let salaryCost = 0;
          if (pro.remunerationType === 'fixo' || pro.remunerationType === 'misto') {
              if (pro.fixedSalary) {
                  salaryCost = pro.fixedSalary * monthsCount;
              }
          }

          const totalCost = salaryCost + commissionCost;
          
          return {
              name: pro.name,
              revenue: totalRevenue,
              completedCount: totalAppts,
              canceledCount: totalCanceled,
              commissionCost,
              salaryCost,
              totalCost
          };
      }).sort((a, b) => b.revenue - a.revenue);
  }, [selectedCompanyId, professionals, appointments, timeRange]);

  // Compute total revenue for the selected company
  const totalRevenue = useMemo(() => {
    if (!selectedCompanyId) return 0;
    const startDate = getStartDate(timeRange);
    return transactions
      .filter(t => t.companyId === selectedCompanyId && t.type === 'income' && new Date(t.date) >= startDate)
      .reduce((acc, t) => acc + t.amount, 0);
  }, [selectedCompanyId, transactions, timeRange]);

  // Compute total patients
  const totalPatients = useMemo(() => {
    if (!selectedCompanyId) return 0;
    return patients.filter(p => p.companyId === selectedCompanyId).length;
  }, [selectedCompanyId, patients]);

  // Compute previous period for trend comparison
  const getPreviousPeriodDates = (range: string) => {
    const currentStart = getStartDate(range);
    const currentEnd = new Date();
    const periodMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodMs);
    return { prevStart, prevEnd };
  };

  const trendData = useMemo(() => {
    if (!selectedCompanyId) return { revenueTrend: 0, appointmentsTrend: 0, retentionTrend: 0 };
    const { prevStart, prevEnd } = getPreviousPeriodDates(timeRange);

    const prevRevenue = transactions
      .filter(t => t.companyId === selectedCompanyId && t.type === 'income' && new Date(t.date) >= prevStart && new Date(t.date) <= prevEnd)
      .reduce((acc, t) => acc + t.amount, 0);

    const prevCompleted = appointments.filter(a =>
      a.companyId === selectedCompanyId && a.status === 'completed' &&
      new Date(a.date) >= prevStart && new Date(a.date) <= prevEnd
    ).length;

    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      revenueTrend: calcTrend(totalRevenue, prevRevenue),
      appointmentsTrend: calcTrend(appointmentStats.completed, prevCompleted),
      retentionTrend: 0, // retenção não tem período anterior fácil de calcular
    };
  }, [selectedCompanyId, transactions, appointments, timeRange, totalRevenue, appointmentStats.completed]);

  // Loading state - mostrar skeleton apenas se TODOS os dados principais estão carregando
  const isInitialLoading = (loadingStates.patients && patients.length === 0) ||
                           (loadingStates.appointments && appointments.length === 0) ||
                           (loadingStates.transactions && transactions.length === 0) ||
                           (loadingStates.procedures && procedures.length === 0);

  // Flags para loading de seções específicas
  const isRevenueLoading = loadingStates.transactions && transactions.length === 0;
  const isAppointmentsLoading = loadingStates.appointments && appointments.length === 0;

  if (isInitialLoading) {
    return <ReportsSkeleton />;
  }

  // Early return ONLY AFTER hooks are called
  if (!companies || companies.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Nenhuma empresa cadastrada</h3>
          <p className="text-sm text-slate-400">Cadastre uma empresa para visualizar os relatórios.</p>
        </div>
      </div>
    );
  }

  const roleLabel = isOwner ? 'Global Admin' : (currentCompany?.name || 'Gestão da Clínica');

  const clinicName = currentCompany?.name ?? 'Clínica';
  const professionalOptions = professionals
    .filter((p) => !selectedCompanyId || p.companyId === selectedCompanyId)
    .map((p) => ({ id: p.id, name: p.name }));

  const reportsContent = (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* HEADER MODERNO */}
      <div className="relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/25">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-serif font-bold text-secondary-900">Relatórios de Inteligência</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-semibold rounded-md border border-primary-100">
                    {roleLabel}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500">{getTimeRangeLabel(timeRange)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <select
                className="h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none font-medium text-slate-700 text-sm cursor-pointer hover:border-slate-300 transition-colors"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="1w">1 Semana</option>
                <option value="1m">1 Mês</option>
                <option value="2m">2 Meses</option>
                <option value="3m">3 Meses</option>
                <option value="6m">6 Meses</option>
                <option value="1y">1 Ano</option>
                <option value="2y">2 Anos</option>
                <option value="3y">3 Anos</option>
                <option value="4y">4 Anos</option>
                <option value="5y">5 Anos</option>
              </select>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            {isOwner && (
              <div className="relative">
                <select
                  className="h-11 pl-4 pr-10 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none font-medium text-slate-700 text-sm min-w-[200px] cursor-pointer hover:border-slate-300 transition-colors"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'analytics'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Análise Geral
        </button>
        <button
          onClick={() => setActiveTab('retention')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'retention'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserX className="w-4 h-4" />
          Retorno de Pacientes
        </button>
      </div>

      {/* RETENTION TAB */}
      {activeTab === 'retention' && (
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        }>
          <RetentionTab clinicName={clinicName} professionalOptions={professionalOptions} />
        </Suspense>
      )}

      {activeTab === 'analytics' && <>

      {/* SEÇÃO OWNER: PERFORMANCE GLOBAL DO SAAS */}
      {isOwner && (
        <section className="space-y-6">
          <SectionHeader
            icon={Crown}
            title="Performance Global do SaaS"
            subtitle="Visão geral de todas as clínicas cadastradas"
            iconColor="text-amber-500"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernRankingCard
              title="Top Clínicas por Receita MRR"
              items={topSpenderClinics}
              icon={DollarSign}
              accentColor="bg-emerald-500"
              emptyText="Nenhuma clínica com plano ativo"
            />
            <ModernRankingCard
              title="Top Clínicas por Pacientes"
              items={topPopulousClinics}
              icon={Users}
              accentColor="bg-blue-500"
              emptyText="Nenhuma clínica com pacientes"
            />
          </div>
        </section>
      )}

      {/* SEÇÃO: KPIs PRINCIPAIS */}
      <section>
        <SectionHeader
          icon={Zap}
          title="Indicadores Chave"
          subtitle={`Performance da ${isOwner ? 'clínica selecionada' : 'sua clínica'} no período`}
          iconColor="text-amber-500"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="Faturamento Total"
            value={isRevenueLoading ? '...' : formatCurrency(totalRevenue)}
            subtitle={isRevenueLoading ? 'Carregando...' : getTimeRangeLabel(timeRange)}
            icon={isRevenueLoading ? Loader2 : DollarSign}
            variant="success"
            trend={isRevenueLoading ? undefined : {
              value: trendData.revenueTrend,
              label: trendData.revenueTrend !== 0 ? `vs período anterior` : undefined
            }}
          />
          <KPICard
            title="Atendimentos"
            value={isAppointmentsLoading ? '...' : appointmentStats.completed}
            subtitle={isAppointmentsLoading ? 'Carregando...' : `${appointmentStats.total} agendados`}
            icon={isAppointmentsLoading ? Loader2 : CalendarCheck}
            variant="primary"
            trend={isAppointmentsLoading ? undefined : {
              value: trendData.appointmentsTrend,
              label: trendData.appointmentsTrend !== 0 ? `vs período anterior` : undefined
            }}
          />
          <KPICard
            title="Pacientes Ativos"
            value={totalPatients}
            subtitle="Total cadastrado"
            icon={Users}
            variant="default"
          />
          <KPICard
            title="Taxa de Retenção"
            value={isAppointmentsLoading ? '...' : `${retentionMetrics.rate}%`}
            subtitle={isAppointmentsLoading ? 'Carregando...' : `${retentionMetrics.returning} recorrentes`}
            icon={UserCheck}
            variant={Number(retentionMetrics.rate) >= 30 ? 'success' : 'warning'}
            trend={isAppointmentsLoading ? undefined : {
              value: Number(retentionMetrics.rate) >= 30 ? 1 : -1,
              label: Number(retentionMetrics.rate) >= 30 ? 'Taxa saudável' : 'Abaixo do ideal'
            }}
          />
        </div>
      </section>

      {/* SEÇÃO: GRÁFICO FULL-WIDTH */}
      <section className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Evolução do Faturamento</h3>
              <p className="text-sm text-slate-500">{getTimeRangeLabel(timeRange)}</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 font-medium">Receita</span>
            </div>
          </div>
          {isRevenueLoading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-400">Carregando dados...</p>
              </div>
            </div>
          ) : (
            <RevenueAreaChart data={monthlyRevenueData} height={280} color="#10b981" />
          )}
        </div>

        {/* BARRA DE INSIGHTS HORIZONTAIS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/60 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl shrink-0">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Proc. Campeão</p>
              <p className="text-sm font-bold text-slate-800 truncate">{procedureEfficiency[0]?.name || '—'}</p>
              <p className="text-[11px] text-amber-700">{procedureEfficiency[0] ? formatCurrency(procedureEfficiency[0].totalRevenue) : '—'}</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/60 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Ticket Médio</p>
              <p className="text-sm font-bold text-slate-800">
                {formatCurrency(
                  procedureEfficiency.length > 0
                    ? procedureEfficiency.reduce((acc, curr) => acc + curr.totalRevenue, 0) /
                      Math.max(1, procedureEfficiency.reduce((acc, curr) => acc + curr.volume, 0))
                    : 0
                )}
              </p>
              <p className="text-[11px] text-emerald-700">por atendimento</p>
            </div>
          </div>

          <div className={`bg-gradient-to-br border rounded-2xl p-4 flex items-center gap-3 ${
            Number(appointmentStats.cancelRate) > 15
              ? 'from-rose-50 to-rose-100/50 border-rose-200/60'
              : 'from-slate-50 to-slate-100/50 border-slate-200/60'
          }`}>
            <div className={`p-2.5 rounded-xl shrink-0 ${Number(appointmentStats.cancelRate) > 15 ? 'bg-rose-100' : 'bg-slate-100'}`}>
              <Activity className={`w-4 h-4 ${Number(appointmentStats.cancelRate) > 15 ? 'text-rose-600' : 'text-slate-600'}`} />
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${Number(appointmentStats.cancelRate) > 15 ? 'text-rose-600' : 'text-slate-500'}`}>Cancelamentos</p>
              <p className="text-sm font-bold text-slate-800">{appointmentStats.cancelRate}%</p>
              <p className={`text-[11px] ${Number(appointmentStats.cancelRate) > 15 ? 'text-rose-600' : 'text-slate-500'}`}>
                {Number(appointmentStats.cancelRate) > 15 ? '⚠️ Acima do ideal' : '✓ Saudável'}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200/60 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-primary-100 rounded-xl shrink-0">
              <Award className="w-4 h-4 text-primary-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wider">Top Profissional</p>
              <p className="text-sm font-bold text-slate-800 truncate">{professionalPerformance[0]?.name || '—'}</p>
              <p className="text-[11px] text-primary-700">{professionalPerformance[0] ? formatCurrency(professionalPerformance[0].revenue) : '—'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO: MÉTRICAS VISUAIS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TOP PROCEDIMENTOS */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-purple-100">
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <h3 className="font-bold text-slate-800">Mais Vendidos</h3>
          </div>
          {isAppointmentsLoading ? (
            <div className="h-[200px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
          ) : (
            <HorizontalBarChart data={topProceduresByClinic} color="#8b5cf6" height={200} />
          )}
        </div>

        {/* RETENÇÃO DONUT */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-indigo-100">
              <UserCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="font-bold text-slate-800">Retenção de Pacientes</h3>
          </div>

          {isAppointmentsLoading ? (
            <div className="h-[220px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center py-4">
                <MetricDonutChart
                  data={[
                    { name: 'Recorrentes', value: retentionMetrics.returning, color: '#6366f1' },
                    { name: 'Única Visita', value: retentionMetrics.single, color: '#e2e8f0' }
                  ]}
                  centerValue={`${retentionMetrics.rate}%`}
                  centerLabel="Retenção"
                  size={180}
                  innerRadius={55}
                  outerRadius={80}
                />
              </div>

              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-xs text-slate-600">Recorrentes ({retentionMetrics.returning})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <span className="text-xs text-slate-600">Únicos ({retentionMetrics.single})</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* CANCELAMENTOS DONUT */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-rose-100">
              <CalendarCheck className="w-4 h-4 text-rose-600" />
            </div>
            <h3 className="font-bold text-slate-800">Status de Agendamentos</h3>
          </div>

          {isAppointmentsLoading ? (
            <div className="h-[220px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <MetricDonutChart
                data={[
                  { name: 'Realizados', value: appointmentStats.completed, color: '#10b981' },
                  { name: 'Cancelados', value: appointmentStats.canceled, color: '#f43f5e' }
                ]}
                centerValue={appointmentStats.total}
                centerLabel="Total"
                size={180}
                innerRadius={55}
                outerRadius={80}
              />
            </div>
          )}

          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-600">Realizados ({appointmentStats.completed})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-xs text-slate-600">Cancelados ({appointmentStats.canceled})</span>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO: CLIENTES VIP */}
      <section>
        <SectionHeader
          icon={Star}
          title="Clientes VIP"
          subtitle="Top pacientes por valor gasto no período"
          iconColor="text-amber-500"
        />

        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          {topSpendersInClinic.length === 0 ? (
            <div className="p-12 text-center">
              <Star className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum cliente VIP no período selecionado</p>
            </div>
          ) : (
            <>
              {/* Destaque #1 */}
              {topSpendersInClinic[0] && (
                <div className="bg-gradient-to-r from-amber-50 via-amber-50/60 to-white border-b border-amber-100 px-6 py-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-2xl shadow-lg shadow-amber-200/50 shrink-0">
                    👑
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">1º lugar · Melhor Cliente</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900 truncate">{topSpendersInClinic[0].name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-emerald-600">{topSpendersInClinic[0].value}</p>
                    <p className="text-xs text-slate-400">no período</p>
                  </div>
                </div>
              )}

              {/* Posições 2-5 */}
              <div className="divide-y divide-slate-50">
                {topSpendersInClinic.slice(1).map((client, idx) => {
                  const pos = idx + 2;
                  const medalColors = ['bg-gradient-to-br from-slate-300 to-slate-400', 'bg-gradient-to-br from-orange-300 to-orange-400'];
                  const medalColor = medalColors[idx] ?? 'bg-slate-100';
                  const medalText = idx < 2 ? 'text-white' : 'text-slate-500';
                  return (
                    <div key={idx} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/60 transition-colors group">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm shrink-0 ${medalColor} ${medalText}`}>
                        {pos}
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm group-hover:text-slate-900 truncate">{client.name}</p>
                        <p className="text-xs text-slate-400">#{pos} Top Spender</p>
                      </div>
                      <p className="font-bold text-emerald-600 shrink-0">{client.value}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* SEÇÃO: PERFORMANCE DA EQUIPE */}
      <section>
        <SectionHeader
          icon={Briefcase}
          title="Performance da Equipe"
          subtitle="Análise de produtividade, receita gerada e custos com pessoal"
          iconColor="text-slate-600"
        />

        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200/60">
                  <th className="px-6 py-4 font-semibold text-slate-600 uppercase text-xs tracking-wider">Profissional</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-600 uppercase text-xs tracking-wider">Atendimentos</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-600 uppercase text-xs tracking-wider">Receita</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-600 uppercase text-xs tracking-wider">Salário</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-600 uppercase text-xs tracking-wider">Comissões</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-600 uppercase text-xs tracking-wider">Total Pago</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-600 uppercase text-xs tracking-wider">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const totalTeamRevenue = professionalPerformance.reduce((acc, p) => acc + p.revenue, 0);
                  return professionalPerformance.map((pro, idx) => {
                    const margin = pro.revenue - pro.totalCost;
                    const revenuePercent = totalTeamRevenue > 0 ? (pro.revenue / totalTeamRevenue) * 100 : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm ${
                              idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                              idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                              'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {pro.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 group-hover:text-slate-900">{pro.name}</p>
                              {idx === 0 && <p className="text-[10px] text-amber-600 font-medium">🏆 Top Performer</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-700 text-base">{pro.completedCount}</span>
                            {pro.canceledCount > 0 && (
                              <span className="text-[10px] text-rose-500 font-medium">{pro.canceledCount} cancelados</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-emerald-600">{formatCurrency(pro.revenue)}</span>
                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${revenuePercent}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400">{revenuePercent.toFixed(0)}% do total</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500">
                          {pro.salaryCost > 0 ? formatCurrency(pro.salaryCost) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500">
                          {pro.commissionCost > 0 ? formatCurrency(pro.commissionCost) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-bold text-rose-600">{formatCurrency(pro.totalCost)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${
                            margin >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {margin >= 0 ? '+' : ''}{formatCurrency(margin)}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })()}
                {professionalPerformance.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Nenhum atendimento no período selecionado</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SEÇÃO: MATRIZ DE EFICIÊNCIA */}
      <section>
        <SectionHeader
          icon={Target}
          title="Matriz de Eficiência"
          subtitle="Análise de retorno x volume para identificar procedimentos mais lucrativos"
          iconColor="text-blue-600"
        />

        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200/60">
                  <th className="px-6 py-4 font-semibold text-slate-600 uppercase text-xs tracking-wider">Procedimento</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-600 uppercase text-xs tracking-wider">Classificação</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-600 uppercase text-xs tracking-wider">Volume</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-600 uppercase text-xs tracking-wider">Ticket Médio</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-600 uppercase text-xs tracking-wider">Faturamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {procedureEfficiency.map((proc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          proc.status.includes('Estrela') ? 'bg-amber-100 text-amber-700' :
                          proc.status.includes('Popular') ? 'bg-blue-100 text-blue-700' :
                          proc.status.includes('Premium') ? 'bg-purple-100 text-purple-700' :
                          proc.status.includes('Baixo') ? 'bg-rose-100 text-rose-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </div>
                        <span className="font-medium text-slate-800">{proc.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={proc.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-slate-700">{proc.volume}</span>
                      <span className="text-slate-400 text-xs ml-1">vendas</span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(proc.ticket)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-slate-900">{formatCurrency(proc.totalRevenue)}</span>
                    </td>
                  </tr>
                ))}
                {procedureEfficiency.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Nenhum dado para analisar no período selecionado</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      </>}
    </div>
  );

  if (!hasReportsAccess) {
    return (
      <UpgradeOverlay message="Ative a versão Pro ou superior para acessar Relatórios de Inteligência.">
        {reportsContent}
      </UpgradeOverlay>
    );
  }

  return reportsContent;
};

export default Reports;
