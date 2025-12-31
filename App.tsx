
import React from 'react';
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

// Sistema Admin (rotas atuais)
const AdminApp: React.FC = () => {
  return (
    <AppProvider>
      <Router>
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
