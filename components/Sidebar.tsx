
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, DollarSign, Settings, LogOut, Syringe, Briefcase, Link as LinkIcon, Megaphone, LifeBuoy, Tag, BellRing, AlertTriangle, Save, Clock, BarChart3, Zap, Package, History, Menu, X, CreditCard, Repeat, type LucideIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole, SystemModule } from '../types';
import AuraLogo from './AuraLogo';
import { SAAS_COMPANY_NAME } from '../constants';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onMobileClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, checkModuleAccess, currentCompany, hasUnsavedChanges, setHasUnsavedChanges, setTriggerSave, setPendingNavigationPath, pendingSubscriptionsCount } = useApp();
  const [showExitModal, setShowExitModal] = useState(false);
  const [targetPath, setTargetPath] = useState<string | null>(null);

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (path: string) => {
      if (isActive(path)) {
        onMobileClose?.();
        return;
      }

      if (hasUnsavedChanges) {
          setTargetPath(path);
          setShowExitModal(true);
      } else {
          navigate(path);
          onMobileClose?.();
      }
  };

  const handleSaveAndExit = () => {
      if (targetPath) {
          setPendingNavigationPath(targetPath);
          setTriggerSave(true);
          setShowExitModal(false);
          onMobileClose?.();
      }
  };

  const handleExitWithoutSaving = () => {
      setHasUnsavedChanges(false);
      if (targetPath) {
          navigate(targetPath);
      }
      setShowExitModal(false);
      setTargetPath(null);
      onMobileClose?.();
  };

  const navItems: { path: string; label: string; icon: LucideIcon; roles: UserRole[]; module?: SystemModule }[] = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.OWNER] },
    { path: '/reports', label: 'Relatórios BI', icon: BarChart3, roles: [UserRole.OWNER, UserRole.ADMIN], module: 'reports' },
    { path: '/marketing', label: 'Marketing & IA', icon: Zap, roles: [UserRole.ADMIN, UserRole.OWNER], module: 'ai_features' },
    { path: '/leads', label: 'Comercial (CRM)', icon: Megaphone, roles: [UserRole.OWNER], module: 'crm' },
    { path: '/schedule', label: 'Agenda', icon: Calendar, roles: [UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.ESTHETICIAN, UserRole.PATIENT] },
    { path: '/patients', label: 'Pacientes', icon: Users, roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.ESTHETICIAN] },
    { path: '/procedures', label: 'Procedimentos', icon: Syringe, roles: [UserRole.ADMIN, UserRole.PATIENT] },
    { path: '/history', label: 'Histórico', icon: History, roles: [UserRole.PATIENT] },
    { path: '/inventory', label: 'Estoque', icon: Package, roles: [UserRole.ADMIN, UserRole.OWNER], module: 'inventory' },
    { path: '/professionals', label: 'Profissionais', icon: Briefcase, roles: [UserRole.ADMIN, UserRole.OWNER], module: 'multi_user' },
    { path: '/business-hours', label: 'Horários de Atend.', icon: Clock, roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST] },
    { path: '/plans', label: 'Planos & Preços', icon: Tag, roles: [UserRole.OWNER] },
    { path: '/system-alerts', label: 'Alertas Sistema', icon: BellRing, roles: [UserRole.OWNER] },
    { path: '/subscriptions', label: 'Clube de Assinaturas', icon: Repeat, roles: [UserRole.ADMIN, UserRole.OWNER] },
    { path: '/financial', label: 'Financeiro', icon: DollarSign, roles: [UserRole.ADMIN, UserRole.OWNER], module: 'financial' },
    { path: '/billing', label: 'Assinatura', icon: CreditCard, roles: [UserRole.ADMIN, UserRole.OWNER] },
    { path: '/access-link', label: 'Agenda Online', icon: LinkIcon, roles: [UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.ESTHETICIAN], module: 'online_booking' },
    { path: '/support', label: 'Suporte', icon: LifeBuoy, roles: [UserRole.ADMIN, UserRole.OWNER], module: 'support' },
  ];

  const alwaysShowModules: SystemModule[] = ['reports', 'crm', 'support', 'ai_features', 'multi_user'];

  const filteredItems = navItems.filter(item => {
    if (!user) return false;
    if (!item.roles.includes(user.role)) return false;
    if (item.module) {
        if (user.role === UserRole.OWNER) return true;
        if (alwaysShowModules.includes(item.module)) return true;
        return checkModuleAccess(item.module);
    }
    return true;
  });

  const getPlanBadgeStyle = (plan?: string) => {
      switch(plan) {
          case 'clinic': return 'bg-amber-400/20 text-amber-300 border border-amber-400/30';
          case 'pro': return 'bg-primary-400/20 text-primary-300 border border-primary-400/30';
          case 'starter': return 'bg-slate-600/40 text-slate-300 border border-slate-500/30';
          default: return 'bg-slate-700/40 text-slate-400 border border-slate-600/30';
      }
  };

  const planLabel = currentCompany?.plan ? currentCompany.plan.charAt(0).toUpperCase() + currentCompany.plan.slice(1) : 'Free';
  const showPlan = user?.role === UserRole.ADMIN || user?.role === UserRole.OWNER;

  const userRoleLabel = user?.role === UserRole.OWNER ? 'SaaS Admin' :
                        user?.role === UserRole.ADMIN ? 'Gestão' :
                        user?.role === UserRole.RECEPTIONIST ? 'Recepção' :
                        user?.role === UserRole.ESTHETICIAN ? 'Profissional' : '';

  const isPatient = user?.role === UserRole.PATIENT;
  const brandingName = isPatient ? (currentCompany?.name || "Minha Clínica") : SAAS_COMPANY_NAME;
  const patientPrimaryColor = currentCompany?.layoutConfig?.primaryColor || '#bd7b65';
  const sidebarStyle = isPatient ? { backgroundColor: patientPrimaryColor } : {};

  // Gera cor de avatar baseada na inicial do nome
  const getAvatarGradient = (name?: string) => {
    const gradients = [
      'from-primary-500 to-primary-700',
      'from-rose-500 to-pink-700',
      'from-violet-500 to-purple-700',
      'from-sky-500 to-blue-700',
      'from-emerald-500 to-teal-700',
    ];
    const idx = (name?.charCodeAt(0) || 0) % gradients.length;
    return gradients[idx];
  };

  return (
    <>
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={onMobileClose}
          />
        )}

        <aside
            className={`
              w-64 h-[100dvh] fixed left-0 top-0 flex flex-col z-[9999] text-white shadow-2xl transition-all duration-300
              ${!isPatient ? 'bg-secondary-900' : ''}
              ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
              lg:translate-x-0
            `}
            style={sidebarStyle}
        >
        {/* Fechamento mobile */}
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 lg:hidden transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className={`p-5 lg:p-6 border-b shrink-0 ${isPatient ? 'border-white/10' : 'border-secondary-800'}`}>
            {/* Logo + Nome da marca */}
            <div className="flex items-center gap-3 mb-5">
                {isPatient && currentCompany?.logo ? (
                    <img
                        src={currentCompany.logo}
                        alt={brandingName}
                        className="w-16 h-16 lg:w-20 lg:h-20 object-contain shrink-0"
                    />
                ) : (
                    <div className={`p-2 rounded-xl shrink-0 ${isPatient ? 'bg-white/20 border border-white/30' : 'bg-primary-500/15 border border-primary-400/20'}`}>
                        <AuraLogo className="w-6 h-6 lg:w-7 lg:h-7" />
                    </div>
                )}

                <div className="flex flex-col overflow-hidden">
                    <span className={`text-lg lg:text-xl font-serif font-bold tracking-widest truncate ${isPatient ? 'text-white' : 'text-primary-100'}`}>
                        {brandingName}
                    </span>
                    {userRoleLabel && (
                      <span className={`text-[9px] uppercase tracking-[0.2em] font-medium ${isPatient ? 'text-white/60' : 'text-secondary-500'}`}>
                        {userRoleLabel}
                      </span>
                    )}
                </div>
            </div>

            {/* Card do usuário */}
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${isPatient ? 'bg-black/10 border-white/10' : 'bg-white/5 border-white/8'}`}>
                <div
                  className={`w-9 h-9 lg:w-10 lg:h-10 rounded-full flex items-center justify-center font-bold shrink-0 text-sm text-white bg-gradient-to-br ${
                    isPatient ? '' : getAvatarGradient(user?.name)
                  }`}
                  style={isPatient ? { backgroundColor: 'rgba(255,255,255,0.25)' } : {}}
                >
                    {user?.name.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden flex-1">
                    <p className="text-xs lg:text-sm font-medium text-white truncate leading-tight" title={user?.name}>
                      {user?.name}
                    </p>
                    {!isPatient && (
                        <p className="text-[10px] text-secondary-500 truncate leading-tight">{currentCompany?.name}</p>
                    )}
                    {showPlan && (
                      <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${getPlanBadgeStyle(currentCompany?.plan || (user?.role === UserRole.OWNER ? 'clinic' : 'free'))}`}>
                          {user?.role === UserRole.OWNER ? 'SaaS Master' : planLabel}
                      </span>
                    )}
                </div>
            </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
            {filteredItems.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-sm ${
                    active
                      ? (isPatient
                          ? 'bg-white font-semibold shadow-lg'
                          : 'bg-primary-600 text-white font-medium shadow-lg shadow-primary-900/20 translate-x-1')
                      : (isPatient
                          ? 'text-white/75 hover:bg-white/15 hover:text-white'
                          : 'text-secondary-400 hover:bg-white/5 hover:text-white')
                  }`}
                  style={active && isPatient ? { color: patientPrimaryColor } : {}}
                >
                  <item.icon className={`w-4 h-4 lg:w-4 lg:h-4 shrink-0 transition-colors ${
                    active
                      ? (isPatient ? '' : 'text-white')
                      : item.path === '/subscriptions' && pendingSubscriptionsCount > 0
                        ? 'text-amber-400'
                        : (isPatient ? 'text-white/60 group-hover:text-white' : 'text-secondary-500 group-hover:text-secondary-300')
                  }`} />
                  <span className={`tracking-wide text-[13px] flex-1 ${
                    !active && item.path === '/subscriptions' && pendingSubscriptionsCount > 0
                      ? 'text-amber-400'
                      : ''
                  }`}>{item.label}</span>
                  {item.path === '/subscriptions' && pendingSubscriptionsCount > 0 && (
                    <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
                      {pendingSubscriptionsCount}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>

        {/* Rodapé */}
        <div className={`shrink-0 px-3 py-4 border-t ${isPatient ? 'border-white/10' : 'border-secondary-800'}`}>
            <div className="grid grid-cols-2 gap-2">
                {user?.role !== UserRole.PATIENT && (
                <button
                    onClick={() => handleNavigation('/settings')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      isActive('/settings')
                        ? 'bg-white/10 text-white'
                        : 'text-secondary-500 hover:bg-white/5 hover:text-white'
                    }`}
                    title="Configurações"
                >
                    <Settings className="w-3.5 h-3.5" /> Config
                </button>
                )}
                <button
                    onClick={logout}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
                        ${user?.role === UserRole.PATIENT
                            ? 'col-span-2 bg-white/15 hover:bg-white/25 text-white'
                            : 'text-secondary-500 hover:bg-red-500/10 hover:text-red-400'}`}
                    title="Sair do Sistema"
                >
                    <LogOut className="w-3.5 h-3.5" /> Sair
                </button>
            </div>
        </div>
        </aside>

        {/* Modal de confirmação de saída */}
        {showExitModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-100">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4 text-amber-500 ring-4 ring-amber-50">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-serif font-bold text-secondary-900 mb-1">Alterações não salvas</h3>
                        <p className="text-sm text-secondary-500 mb-6">
                            Você tem alterações pendentes. Deseja salvar antes de sair?
                        </p>
                        <div className="flex flex-col gap-2.5 w-full">
                            <button
                                onClick={handleSaveAndExit}
                                className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
                            >
                                <Save className="w-4 h-4" /> Salvar Alterações
                            </button>
                            <button
                                onClick={handleExitWithoutSaving}
                                className="w-full py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition-colors text-sm"
                            >
                                Sair sem salvar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default Sidebar;
