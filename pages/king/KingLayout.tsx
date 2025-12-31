import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Crown, LayoutDashboard, Building, Users, CalendarCheck,
  DollarSign, Settings, LogOut, Bell, ChevronRight, Target, Megaphone
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';

const KingLayout: React.FC = () => {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  // Guard: Redirecionar se não for OWNER
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

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full">
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
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
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
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Aura System</p>
              <h2 className="font-bold text-slate-800">Painel Administrativo Master</h2>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="h-8 w-px bg-slate-200"></div>
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full uppercase">
                Owner
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default KingLayout;
