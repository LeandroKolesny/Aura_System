
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, DollarSign, Settings, LogOut, Syringe, Briefcase, Link as LinkIcon, Megaphone, LifeBuoy, Tag, BellRing, AlertTriangle, Save, Clock, BarChart3, Zap, Package, History, Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole, SystemModule } from '../types';
import AuraLogo from './AuraLogo';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onMobileClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, checkModuleAccess, currentCompany, hasUnsavedChanges, setHasUnsavedChanges, setTriggerSave, setPendingNavigationPath } = useApp();
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
          onMobileClose?.(); // Fecha menu mobile ao navegar
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

  // Definição dos itens de navegação com permissão de Módulo SaaS (opcional)
  const navItems: { path: string; label: string; icon: any; roles: UserRole[]; module?: SystemModule }[] = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.OWNER] },

    // Reports: Owner e Admin (com módulo reports)
    { path: '/reports', label: 'Relatórios BI', icon: BarChart3, roles: [UserRole.OWNER, UserRole.ADMIN], module: 'reports' },

    // Marketing: Requer módulo IA
    { path: '/marketing', label: 'Marketing & IA', icon: Zap, roles: [UserRole.ADMIN, UserRole.OWNER], module: 'ai_features' },

    // Leads: Apenas Owner ou Clínicas com Módulo CRM (Ex: Plano Clinic)
    { path: '/leads', label: 'Comercial (CRM)', icon: Megaphone, roles: [UserRole.OWNER], module: 'crm' },

    { path: '/schedule', label: 'Agenda', icon: Calendar, roles: [UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.ESTHETICIAN, UserRole.PATIENT] },
    { path: '/patients', label: 'Pacientes', icon: Users, roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.ESTHETICIAN] },
    { path: '/procedures', label: 'Procedimentos', icon: Syringe, roles: [UserRole.ADMIN, UserRole.PATIENT] },

    // Histórico: Apenas para Pacientes (Novo)
    { path: '/history', label: 'Histórico', icon: History, roles: [UserRole.PATIENT] },

    // Inventory: Novo módulo
    { path: '/inventory', label: 'Estoque', icon: Package, roles: [UserRole.ADMIN, UserRole.OWNER], module: 'inventory' },

    // Professionals: Apenas Owner ou Clínicas com Multi-user
    { path: '/professionals', label: 'Profissionais', icon: Briefcase, roles: [UserRole.ADMIN, UserRole.OWNER], module: 'multi_user' },

    // Horários de Atendimento (Reposicionado para ficar após Profissionais)
    { path: '/business-hours', label: 'Horários de Atend.', icon: Clock, roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST] },

    // Planos: Apenas Owner
    { path: '/plans', label: 'Planos & Preços', icon: Tag, roles: [UserRole.OWNER] },

    // Alertas: Apenas Owner
    { path: '/system-alerts', label: 'Alertas Sistema', icon: BellRing, roles: [UserRole.OWNER] },

    // Financeiro: Requer módulo financeiro
    { path: '/financial', label: 'Financeiro', icon: DollarSign, roles: [UserRole.ADMIN, UserRole.OWNER], module: 'financial' },

    // Agenda Online: Requer módulo online_booking
    { path: '/access-link', label: 'Agenda Online', icon: LinkIcon, roles: [UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.ESTHETICIAN], module: 'online_booking' },

    // Suporte: Requer módulo suporte (Geralmente todos)
    { path: '/support', label: 'Suporte', icon: LifeBuoy, roles: [UserRole.ADMIN, UserRole.OWNER], module: 'support' },
  ];

  // Módulos que devem aparecer sempre no menu (bloqueio acontece dentro da página)
  const alwaysShowModules: SystemModule[] = ['reports', 'crm', 'support', 'ai_features', 'multi_user'];

  const filteredItems = navItems.filter(item => {
    if (!user) return false;

    // 1. Verifica Role do Usuário (Se ele é Admin, Recepção, etc)
    if (!item.roles.includes(user.role)) return false;

    // 2. Verifica se a Empresa pagou pelo Módulo (SaaS Check)
    if (item.module) {
        // Se for Owner do SaaS, vê tudo
        if (user.role === UserRole.OWNER) return true;

        // Se for módulo que deve sempre aparecer, mostra (bloqueio é na página)
        if (alwaysShowModules.includes(item.module)) return true;

        // Para outros módulos, checa acesso normalmente
        return checkModuleAccess(item.module);
    }

    return true;
  });

  const getPlanBadgeColor = (plan?: string) => {
      switch(plan) {
          case 'clinic': return 'bg-amber-500 text-black';
          case 'pro': return 'bg-primary-500 text-white';
          case 'starter': return 'bg-slate-600 text-white';
          default: return 'bg-slate-700 text-slate-300';
      }
  };

  const planLabel = currentCompany?.plan ? currentCompany.plan.charAt(0).toUpperCase() + currentCompany.plan.slice(1) : 'Free';
  const showPlan = user?.role === UserRole.ADMIN || user?.role === UserRole.OWNER;

  const userRoleLabel = user?.role === UserRole.OWNER ? 'SaaS Admin' :
                        user?.role === UserRole.ADMIN ? 'Gestão' :
                        user?.role === UserRole.RECEPTIONIST ? 'Recepção' :
                        user?.role === UserRole.ESTHETICIAN ? 'Profissional' : '';

  // --- LÓGICA DE BRANDING (Pacientes vs Admin) ---
  const isPatient = user?.role === UserRole.PATIENT;

  // Se for paciente, usa o nome e logo da empresa. Se for Admin, usa "Aura System".
  const brandingName = isPatient ? (currentCompany?.name || "Minha Clínica") : "Aura System";

  // Cores dinâmicas para paciente
  const patientPrimaryColor = currentCompany?.layoutConfig?.primaryColor || '#bd7b65';
  const sidebarStyle = isPatient
    ? { backgroundColor: patientPrimaryColor }
    : {}; // Admin usa classes padrão (bg-secondary-900)

  return (
    <>
        {/* Overlay para fechar menu no mobile */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onMobileClose}
          />
        )}

        <aside
            className={`
              w-64 h-screen fixed left-0 top-0 flex flex-col z-[9999] text-white shadow-2xl transition-all duration-300
              ${!isPatient ? 'bg-secondary-900' : ''}

              /* Mobile: escondido por padrão, aparece quando isMobileOpen */
              ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}

              /* Desktop (lg+): sempre visível */
              lg:translate-x-0
            `}
            style={sidebarStyle}
        >
        {/* Botão fechar no mobile */}
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header com Logo e Perfil do Usuário */}
        <div className={`p-4 lg:p-6 border-b shrink-0 ${isPatient ? 'border-white/10' : 'border-secondary-800'}`}>
            <div className="flex items-center gap-3 mb-4 lg:mb-6">
                {/* Lógica do Logo: Se for paciente e tiver logo customizado, exibe sem borda e maior. */}
                {isPatient && currentCompany?.logo ? (
                    <img
                        src={currentCompany.logo}
                        alt={brandingName}
                        className="w-16 h-16 lg:w-20 lg:h-20 object-contain shrink-0"
                    />
                ) : (
                    // Admin View ou Default: Container com borda
                    <div className={`p-2 rounded-xl border shrink-0 ${isPatient ? 'bg-white/20 border-white/30 text-white' : 'bg-primary-500/10 text-primary-400 border-primary-500/20'}`}>
                        <AuraLogo className="w-6 h-6 lg:w-8 lg:h-8" />
                    </div>
                )}

                <div className="flex flex-col overflow-hidden">
                    <span className={`text-lg lg:text-xl font-serif font-bold tracking-wide truncate ${isPatient ? 'text-white' : 'text-primary-100'}`}>
                        {brandingName}
                    </span>
                    {userRoleLabel && <span className={`text-[10px] uppercase tracking-wider font-bold ${isPatient ? 'text-white/80' : 'text-secondary-500'}`}>{userRoleLabel}</span>}
                </div>
            </div>

            {/* Card do Usuário e Plano */}
            <div className={`flex items-center gap-3 px-3 py-2 lg:py-3 rounded-xl border ${isPatient ? 'bg-black/10 border-white/10' : 'bg-secondary-800/50 border-secondary-700/50'}`}>
                <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center font-bold shrink-0 shadow-inner text-sm lg:text-base ${isPatient ? 'bg-white' : 'bg-secondary-800 border border-secondary-600 text-primary-400'}`} style={isPatient ? { color: patientPrimaryColor } : {}}>
                    {user?.name.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                    <p className="text-xs lg:text-sm font-medium text-white truncate" title={user?.name}>{user?.name}</p>
                    {/* Mostrar o nome da empresa para o Admin aqui, já que o título principal é Aura System */}
                    {!isPatient && (
                        <p className="text-[9px] lg:text-[10px] text-secondary-400 truncate">{currentCompany?.name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                        {/* Badge do Plano */}
                        {showPlan && (
                            <span className={`text-[9px] lg:text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${getPlanBadgeColor(currentCompany?.plan || (user?.role === UserRole.OWNER ? 'clinic' : 'free'))}`}>
                                {user?.role === UserRole.OWNER ? 'SaaS Master' : `${planLabel}`}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 p-3 lg:p-4 space-y-1 lg:space-y-2 mt-2 overflow-y-auto custom-scrollbar">
            {filteredItems.map((item) => (
            <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl transition-all duration-200 group text-sm lg:text-base ${
                isActive(item.path)
                    ? (isPatient
                        ? 'bg-white font-bold shadow-lg translate-x-1'
                        : 'bg-primary-600 text-white font-medium shadow-lg shadow-primary-900/20 translate-x-1')
                    : (isPatient
                        ? 'text-white/80 hover:bg-white/20 hover:text-white'
                        : 'text-secondary-400 hover:bg-secondary-800 hover:text-white')
                }`}
                style={isActive(item.path) && isPatient ? { color: patientPrimaryColor } : {}}
            >
                <item.icon className={`w-4 h-4 lg:w-5 lg:h-5 ${isActive(item.path) ? 'currentColor' : (isPatient ? 'text-white/70 group-hover:text-white' : 'text-secondary-500 group-hover:text-primary-300')}`} />
                <span className="tracking-wide">{item.label}</span>
            </button>
            ))}
        </nav>

        {/* Rodapé com Botões de Ação */}
        <div className={`p-3 lg:p-4 border-t ${isPatient ? 'border-white/10 bg-black/10' : 'border-secondary-800 bg-secondary-900/50'}`}>
            <div className="grid grid-cols-2 gap-2">
                {user?.role !== UserRole.PATIENT && (
                <button
                    onClick={() => handleNavigation('/settings')}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary-800 text-secondary-400 hover:bg-secondary-700 hover:text-white transition-colors text-xs font-medium"
                    title="Configurações"
                >
                    <Settings className="w-4 h-4" /> Config
                </button>
                )}
                <button
                    onClick={logout}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                        ${user?.role === UserRole.PATIENT
                            ? 'col-span-2 bg-white/20 hover:bg-white/30 text-white'
                            : 'bg-secondary-800 hover:bg-red-900/30 text-red-400 hover:text-red-300'}`}
                    title="Sair do Sistema"
                >
                    <LogOut className="w-4 h-4" /> Sair
                </button>
            </div>
        </div>
        </aside>

        {/* Modal de Confirmação de Saída */}
        {showExitModal && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border border-slate-200">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Alterações não salvas</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Você tem alterações pendentes. Deseja salvar antes de sair?
                        </p>
                        <div className="flex flex-col gap-3 w-full">
                            <button
                                onClick={handleSaveAndExit}
                                className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200 flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Salvar Alterações
                            </button>
                            <button
                                onClick={handleExitWithoutSaving}
                                className="w-full py-2.5 px-4 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
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
