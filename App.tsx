
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { getClinicSlug } from './utils/subdomain';
import PatientPortalApp from './apps/PatientPortalApp';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Schedule from './pages/Schedule';
import Financial from './pages/Financial';
import Procedures from './pages/Procedures';
import Professionals from './pages/Professionals';
import Login from './pages/Login';
import KingLogin from './pages/KingLogin';
import LandingPage from './pages/LandingPage';
import AccessLink from './pages/AccessLink';
import PublicBooking from './pages/PublicBooking';
import Settings from './pages/Settings';
import BusinessHoursSettings from './pages/BusinessHoursSettings';
import Leads from './pages/Leads';
import Support from './pages/Support';
import Plans from './pages/Plans';
import SystemAlerts from './pages/SystemAlerts';
import Reports from './pages/Reports';
import Marketing from './pages/Marketing';
import Inventory from './pages/Inventory';
import PatientHistory from './pages/PatientHistory';
import Onboarding from './pages/Onboarding';
// King (Owner) Pages
import KingLayout from './pages/king/KingLayout';
import KingDashboard from './pages/king/KingDashboard';
import KingCompanies from './pages/king/KingCompanies';
import KingPatients from './pages/king/KingPatients';
import KingAppointments from './pages/king/KingAppointments';
import KingLeads from './pages/king/KingLeads';
import KingAlerts from './pages/king/KingAlerts';
import KingRevenue from './pages/king/KingRevenue';
import KingSettings from './pages/king/KingSettings';
import { AppProvider, useApp } from './context/AppContext';
import { UserRole } from './types';
import { AlertTriangle, Menu, Loader2 } from 'lucide-react';
import { SubscriptionModal } from './components/Modals';
import AuraLogo from './components/AuraLogo';

// Loading Screen enquanto valida sessão
const InitializingScreen: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
    <div className="text-center">
      <div className="flex justify-center mb-6">
        <AuraLogo className="w-16 h-16 animate-pulse" />
      </div>
      <div className="flex items-center justify-center gap-2 text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Carregando...</span>
      </div>
    </div>
  </div>
);

const PrivateLayout: React.FC = () => {
  const { user, isReadOnly, currentCompany, isSubscriptionModalOpen, setIsSubscriptionModalOpen } = useApp();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirecionar para Onboarding se não completou
  if (user.role === UserRole.ADMIN && !currentCompany) {
    return <Navigate to="/onboarding" replace />;
  }
  if (user.role === UserRole.ADMIN && currentCompany && currentCompany.onboardingCompleted === false) {
      return <Navigate to="/onboarding" replace />;
  }

  // Proteção de rotas
  if ((user.role === UserRole.RECEPTIONIST || user.role === UserRole.ESTHETICIAN) && location.pathname === '/dashboard') {
    return <Navigate to="/schedule" replace />;
  }

  if (user.role === UserRole.PATIENT) {
      const allowedPaths = ['/schedule', '/procedures', '/history'];
      if (!allowedPaths.includes(location.pathname)) {
           return <Navigate to="/schedule" replace />;
      }
  }

  return (
    <>
      {/* Sidebar fora do flex container para evitar problemas de z-index */}
      <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

      <div className="min-h-screen bg-slate-50 overflow-x-clip">
        {/* Main content - responsivo: sem margem no mobile, com margem no desktop */}
        <main className="lg:ml-64 flex flex-col min-h-screen overflow-x-clip">

        {/* Header Mobile com Hamburger */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Menu className="w-6 h-6 text-slate-700" />
          </button>
          <span className="font-semibold text-slate-800">{currentCompany?.name || 'Aura System'}</span>
          <div className="w-10" /> {/* Spacer para centralizar o título */}
        </div>

        {/* Banner de Aviso para Plano Expirado / Básico (Apenas para Staff) */}
        {isReadOnly && user.role !== UserRole.OWNER && user.role !== UserRole.PATIENT && (
            <div className="bg-red-600 text-white px-4 lg:px-6 py-2 text-xs lg:text-sm font-medium flex items-center justify-between shadow-md z-20">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="line-clamp-2">
                        {currentCompany?.plan === 'basic' ? 'Plano expirado.' : 'Modo Leitura.'}
                        <span className="hidden sm:inline"> Você pode visualizar os dados, mas não pode criar ou editar registros.</span>
                    </span>
                </div>
                <button
                    onClick={() => setIsSubscriptionModalOpen(true)}
                    className="bg-white text-red-600 px-2 lg:px-3 py-1 rounded text-[10px] lg:text-xs font-bold uppercase tracking-wide hover:bg-red-50 transition-colors shrink-0"
                >
                    Renovar
                </button>
            </div>
        )}

        <div className="flex-1 p-4 lg:p-8 overflow-auto">
            <div className="w-full">
                <Outlet />
            </div>
        </div>

        {/* Global Modal Render */}
        {isSubscriptionModalOpen && <SubscriptionModal onClose={() => setIsSubscriptionModalOpen(false)} />}
      </main>
      </div>
    </>
  );
};

// Wrapper de autenticação para Onboarding
const OnboardingAuthWrapper = () => {
  const { user, currentCompany } = useApp();
  if (!user) return <Navigate to="/login" replace />;

  // Se já completou, manda pro dashboard
  if (currentCompany && currentCompany.onboardingCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Onboarding />;
};

// Wrapper que aguarda inicialização antes de renderizar as rotas
const AppRoutes: React.FC = () => {
  const { isInitializing } = useApp();

  if (isInitializing) {
    return <InitializingScreen />;
  }

  return (
    <Routes>
      {/* Rotas Públicas */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/king" element={<KingLogin />} />

      {/* Rotas King (Owner) - Layout Exclusivo */}
      <Route path="/king" element={<KingLayout />}>
        <Route path="dashboard" element={<KingDashboard />} />
        <Route path="companies" element={<KingCompanies />} />
        <Route path="patients" element={<KingPatients />} />
        <Route path="appointments" element={<KingAppointments />} />
        <Route path="leads" element={<KingLeads />} />
        <Route path="alerts" element={<KingAlerts />} />
        <Route path="revenue" element={<KingRevenue />} />
        <Route path="settings" element={<KingSettings />} />
      </Route>

      {/* Rota de Onboarding (Privada mas sem Sidebar) */}
      <Route path="/onboarding" element={<OnboardingAuthWrapper />} />

      {/* Rotas Privadas (App) */}
      <Route element={<PrivateLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/procedures" element={<Procedures />} />
        <Route path="/professionals" element={<Professionals />} />
        <Route path="/financial" element={<Financial />} />
        <Route path="/access-link" element={<AccessLink />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/business-hours" element={<BusinessHoursSettings />} />

        {/* Rota de Histórico para Pacientes */}
        <Route path="/history" element={<PatientHistory />} />

        {/* Novas Rotas SaaS */}
        <Route path="/leads" element={<Leads />} />
        <Route path="/support" element={<Support />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/system-alerts" element={<SystemAlerts />} />
      </Route>

      {/* Fallback - redireciona rotas não encontradas para landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Sistema Admin (rotas atuais)
const AdminApp: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AppProvider>
  );
};

// App principal - decide qual aplicação carregar
const App: React.FC = () => {
  const clinicSlug = getClinicSlug();

  // Se detectou um slug de clínica, carrega o Portal do Paciente
  if (clinicSlug) {
    return <PatientPortalApp clinicSlug={clinicSlug} />;
  }

  // Caso contrário, carrega o Sistema Admin
  return <AdminApp />;
};

export default App;
