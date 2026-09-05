
import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { getClinicSlug } from './utils/subdomain';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import { AppProvider, useApp } from './context/AppContext';
import { DialogProvider } from './context/DialogContext';
import { UserRole } from './types';
import { AlertTriangle, Menu, Loader2 } from 'lucide-react';
import { SubscriptionModal } from './components/Modals';
import AuraLogo from './components/AuraLogo';
import { SAAS_COMPANY_NAME } from './constants';

// Todas as páginas além da Landing são carregadas sob demanda (por rota),
// para o visitante da landing não baixar o código do app inteiro.
const PatientPortalApp = lazy(() => import('./apps/PatientPortalApp'));

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Financial = lazy(() => import('./pages/Financial'));
const Procedures = lazy(() => import('./pages/Procedures'));
const Professionals = lazy(() => import('./pages/Professionals'));
const Login = lazy(() => import('./pages/Login'));
const KingLogin = lazy(() => import('./pages/KingLogin'));
const AccessLink = lazy(() => import('./pages/AccessLink'));
const Settings = lazy(() => import('./pages/Settings'));
const BusinessHoursSettings = lazy(() => import('./pages/BusinessHoursSettings'));
const Leads = lazy(() => import('./pages/Leads'));
const Support = lazy(() => import('./pages/Support'));
const Plans = lazy(() => import('./pages/Plans'));
const SystemAlerts = lazy(() => import('./pages/SystemAlerts'));
const Reports = lazy(() => import('./pages/Reports'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Marketing = lazy(() => import('./pages/Marketing'));
const Inventory = lazy(() => import('./pages/Inventory'));
const PatientHistory = lazy(() => import('./pages/PatientHistory'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Billing = lazy(() => import('./pages/admin/Billing'));
const BillingPending = lazy(() => import('./pages/admin/BillingPending'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
// King (Owner) Pages
const KingLayout = lazy(() => import('./pages/king/KingLayout'));
const KingDashboard = lazy(() => import('./pages/king/KingDashboard'));
const KingCompanies = lazy(() => import('./pages/king/KingCompanies'));
const KingPatients = lazy(() => import('./pages/king/KingPatients'));
const KingAppointments = lazy(() => import('./pages/king/KingAppointments'));
const KingLeads = lazy(() => import('./pages/king/KingLeads'));
const KingAlerts = lazy(() => import('./pages/king/KingAlerts'));
const KingRevenue = lazy(() => import('./pages/king/KingRevenue'));
const KingSettings = lazy(() => import('./pages/king/KingSettings'));

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

      <div className="min-h-screen bg-[#FDFBF8] overflow-x-clip">
        {/* Main content - responsivo: sem margem no mobile, com margem no desktop */}
        <main className="lg:ml-64 flex flex-col min-h-screen overflow-x-clip">

        {/* Header Mobile com Hamburger */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
          <span className="font-semibold text-sm text-slate-800 truncate max-w-[160px]">{currentCompany?.name || SAAS_COMPANY_NAME}</span>
          {/* Avatar do usuário */}
          <div className="min-h-[44px] min-w-[44px] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
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
    <Suspense fallback={<InitializingScreen />}>
    <Routes>
      {/* Rotas Públicas */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verificar-email" element={<VerifyEmail />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/termos-de-uso" element={<TermsOfUse />} />
      <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
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
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/access-link" element={<AccessLink />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/billing/aguardando" element={<BillingPending />} />
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
    </Suspense>
  );
};

// Sistema Admin (rotas atuais)
const AdminApp: React.FC = () => {
  return (
    <AppProvider>
      <DialogProvider>
        <Router>
          <AppRoutes />
        </Router>
      </DialogProvider>
    </AppProvider>
  );
};

// App principal - decide qual aplicação carregar
const App: React.FC = () => {
  const clinicSlug = getClinicSlug();

  // Se detectou um slug de clínica, carrega o Portal do Paciente
  if (clinicSlug) {
    return (
      <Suspense fallback={<InitializingScreen />}>
        <PatientPortalApp clinicSlug={clinicSlug} />
      </Suspense>
    );
  }

  // Caso contrário, carrega o Sistema Admin
  return <AdminApp />;
};

export default App;
