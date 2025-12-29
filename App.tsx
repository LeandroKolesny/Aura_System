
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
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
import PatientHistory from './pages/PatientHistory'; // Novo Import
import Onboarding from './pages/Onboarding';
import { AppProvider, useApp } from './context/AppContext';
import { UserRole } from './types';
import { AlertTriangle } from 'lucide-react';
import { SubscriptionModal } from './components/Modals';

const PrivateLayout: React.FC = () => {
  const { user, isReadOnly, currentCompany, isSubscriptionModalOpen, setIsSubscriptionModalOpen } = useApp();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirecionar para Onboarding se não completou
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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen relative">
        
        {/* Banner de Aviso para Plano Expirado / Básico (Apenas para Staff) */}
        {isReadOnly && user.role !== UserRole.OWNER && user.role !== UserRole.PATIENT && (
            <div className="bg-red-600 text-white px-6 py-2 text-sm font-medium flex items-center justify-between shadow-md z-50">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                        {currentCompany?.plan === 'basic' ? 'Seu plano expirou.' : 'Modo de Leitura.'} 
                        Você pode visualizar os dados, mas não pode criar ou editar registros.
                    </span>
                </div>
                <button 
                    onClick={() => setIsSubscriptionModalOpen(true)}
                    className="bg-white text-red-600 px-3 py-1 rounded text-xs font-bold uppercase tracking-wide hover:bg-red-50 transition-colors"
                >
                    Renovar Agora
                </button>
            </div>
        )}

        <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-[1600px] mx-auto">
                <Outlet />
            </div>
        </div>

        {/* Global Modal Render */}
        {isSubscriptionModalOpen && <SubscriptionModal onClose={() => setIsSubscriptionModalOpen(false)} />}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/king" element={<KingLogin />} />
          
          {/* Rota Pública de Agendamento (SaaS) */}
          <Route path="/booking/:companyId" element={<PublicBooking />} />
          
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
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AppProvider>
  );
};

const OnboardingAuthWrapper = () => {
    const { user, currentCompany } = useApp();
    if (!user) return <Navigate to="/login" replace />;
    
    // Se já completou, manda pro dashboard
    if (currentCompany && currentCompany.onboardingCompleted) {
        return <Navigate to="/dashboard" replace />;
    }
    
    return <Onboarding />;
};

export default App;
