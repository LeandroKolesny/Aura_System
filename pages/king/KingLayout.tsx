import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Crown, LayoutDashboard, Building, Users, CalendarCheck,
  DollarSign, Settings, LogOut, Bell, ChevronRight, Target, Megaphone, Menu, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';

const KingLayout: React.FC = () => {
  const { user, logout, newLeadsCount } = useApp();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  React.useEffect(() => {
    if (user && user.role !== UserRole.OWNER) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  if (!user || user.role !== UserRole.OWNER) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Crown className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-pulse" />
          <p className="text-white">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/king');
  };

  const menuItems = [
    { path: '/king/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/king/companies', label: 'Empresas', icon: Building },
    { path: '/king/patients', label: 'Pacientes', icon: Users },
    { path: '/king/appointments', label: 'Agendamentos', icon: CalendarCheck },
    { path: '/king/leads', label: 'CRM', icon: Target },
    { path: '/king/alerts', label: 'Alertas', icon: Megaphone },
    { path: '/king/revenue', label: 'Receita', icon: DollarSign },
    { path: '/king/settings', label: 'Configurações', icon: Settings },
  ];

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Aura King</h1>
            <p className="text-xs text-slate-400">Painel Master</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-amber-500/20 text-amber-400 font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
            {item.path === '/king/leads' && newLeadsCount > 0 ? (
              <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {newLeadsCount}
              </span>
            ) : (
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-600 rounded-lg transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF8] flex overflow-x-clip">

      {/* Overlay mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Desktop — fixa */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-white flex-col fixed h-full z-20">
        {sidebarContent}
      </aside>

      {/* Sidebar Mobile — drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-slate-900 text-white flex flex-col z-40 transition-transform duration-300 lg:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 min-w-0">

        {/* Header Mobile com Hamburger */}
        <div className="lg:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <Crown className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm">Aura King</span>
          </div>
          <span className="px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">
            Owner
          </span>
        </div>

        {/* Top Bar Desktop */}
        <header className="hidden lg:block bg-[#FDFBF8] border-b border-amber-100/60 px-8 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-amber-600/70 uppercase tracking-[0.2em] font-medium">Aura System</p>
              <h2 className="font-serif text-xl font-bold text-slate-900">Painel Administrativo Master</h2>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-amber-50 rounded-lg relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="h-8 w-px bg-amber-100"></div>
              <span className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">
                Owner
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="px-4 py-4 lg:px-8 lg:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default KingLayout;
