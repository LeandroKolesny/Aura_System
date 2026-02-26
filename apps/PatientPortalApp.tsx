// apps/PatientPortalApp.tsx
// Aplicação do Portal do Paciente - Responsivo

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { ClinicProvider, useClinic } from '../context/ClinicContext';
import { AppProvider, useApp } from '../context/AppContext';
import { UserRole, PublicLayoutConfig } from '../types';
import { getPortalBasePath } from '../utils/subdomain';
import { Menu } from 'lucide-react';

// Páginas reutilizadas
import PublicBooking from '../pages/PublicBooking';
import Schedule from '../pages/Schedule';
import Procedures from '../pages/Procedures';
import PatientHistory from '../pages/PatientHistory';

// Páginas novas do portal
import PatientLogin from '../pages/patient-portal/PatientLogin';
import PatientSidebar from '../components/patient-portal/PatientSidebar';

// Utilitários de cores
const isDarkBackground = (hex?: string): boolean => {
  if (!hex) return false;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return false;
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
};

// Loading component
const ClinicLoading: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-secondary-600">Carregando...</p>
    </div>
  </div>
);

// Error component
const ClinicNotFound: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="text-center max-w-md px-4">
      <h1 className="text-4xl font-bold text-secondary-900 mb-4">Clínica não encontrada</h1>
      <p className="text-secondary-600 mb-6">
        A clínica que você está procurando não existe ou não está disponível.
      </p>
      <a
        href="/"
        className="inline-block bg-primary-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-600 transition-colors"
      >
        Voltar para o início
      </a>
    </div>
  </div>
);

// Layout privado do portal (paciente logado)
const PatientPortalLayout: React.FC = () => {
  const { user } = useApp();
  const { clinic } = useClinic();
  const basePath = getPortalBasePath();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Se não está logado, redireciona para login do portal
  if (!user) {
    return <Navigate to={`${basePath}/login`} replace />;
  }

  // Se não é paciente, não deveria estar aqui
  if (user.role !== UserRole.PATIENT) {
    return <Navigate to={`${basePath}/`} replace />;
  }

  // Cores do layout
  const layoutConfig = clinic?.layoutConfig;
  const backgroundColor = layoutConfig?.backgroundColor || '#fafaf9';
  const primaryColor = layoutConfig?.primaryColor || '#8b5cf6';
  const isDark = isDarkBackground(backgroundColor);
  const mainTextColor = layoutConfig?.textColor || (isDark ? '#f5f5f5' : '#1e293b');

  const mainStyle: React.CSSProperties = {
    backgroundColor: backgroundColor,
  };

  return (
    <div className="flex min-h-screen" style={mainStyle}>
      <PatientSidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

      {/* Main content - responsivo */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Header Mobile com Hamburger */}
        <div
          className="lg:hidden px-4 py-3 flex items-center justify-between sticky top-0 z-30 border-b"
          style={{
            backgroundColor: backgroundColor,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          }}
        >
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
          >
            <Menu className="w-6 h-6" style={{ color: mainTextColor }} />
          </button>
          <span className="font-semibold" style={{ color: mainTextColor }}>
            {clinic?.name || 'Portal'}
          </span>
          <div className="w-10" />
        </div>

        <div className="flex-1 p-4 lg:p-8">
          <div className="max-w-[1200px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

// Wrapper que verifica se a clínica foi carregada
const ClinicWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading, error } = useClinic();

  if (isLoading) {
    return <ClinicLoading />;
  }

  if (error) {
    return <ClinicNotFound />;
  }

  return <>{children}</>;
};

// Rotas do portal
const PatientPortalRoutes: React.FC<{ clinicSlug: string }> = ({ clinicSlug }) => {
  const basePath = getPortalBasePath();
  const host = window.location.host;

  // Localhost e Vercel usam path-based routing (/clinica-aura/login)
  // Produção com domínio próprio usa subdomínio (clinica-aura.dominio.com/login)
  const usePathBasedRouting = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('vercel.app');
  const prefix = usePathBasedRouting ? `/${clinicSlug}` : '';

  return (
    <Routes>
      {/* Rotas Públicas do Portal */}
      <Route path={`${prefix}/`} element={<PublicBooking clinicSlug={clinicSlug} />} />
      <Route path={`${prefix}`} element={<PublicBooking clinicSlug={clinicSlug} />} />
      <Route path={`${prefix}/login`} element={<PatientLogin />} />

      {/* Rotas Privadas do Portal (paciente logado) */}
      <Route element={<PatientPortalLayout />}>
        <Route path={`${prefix}/minha-conta`} element={<PatientDashboard />} />
        <Route path={`${prefix}/agendamentos`} element={<Schedule />} />
        <Route path={`${prefix}/procedimentos`} element={<Procedures />} />
        <Route path={`${prefix}/historico`} element={<PatientHistory />} />
      </Route>

      {/* Fallback - redireciona para página inicial do portal */}
      <Route path="*" element={<Navigate to={`${prefix}/`} replace />} />
    </Routes>
  );
};

// Dashboard simples do paciente
const PatientDashboard: React.FC = () => {
  const { user } = useApp();
  const { clinic } = useClinic();

  // Cores do layout
  const layoutConfig = clinic?.layoutConfig;
  const primaryColor = layoutConfig?.primaryColor || '#8b5cf6';
  const backgroundColor = layoutConfig?.backgroundColor || '#fafaf9';
  const textColor = layoutConfig?.textColor;
  const cardBgColor = layoutConfig?.cardBackgroundColor;
  const cardTextColor = layoutConfig?.cardTextColor;

  const isDark = isDarkBackground(backgroundColor);
  const mainTextColor = textColor || (isDark ? '#f5f5f5' : '#1e293b');
  const secondaryTextColor = isDark ? 'rgba(255,255,255,0.6)' : '#64748b';

  // Cor do card derivada
  const cardBackground = cardBgColor || (isDark ? 'rgba(255,255,255,0.05)' : '#ffffff');
  const cardText = cardTextColor || mainTextColor;
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const cardShadow = isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.05)';

  const titleStyle: React.CSSProperties = {
    color: mainTextColor,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: cardBackground,
    borderColor: cardBorder,
    boxShadow: cardShadow,
    color: cardText,
  };

  const cardTitleStyle: React.CSSProperties = {
    color: cardText,
  };

  const cardDescStyle: React.CSSProperties = {
    color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b',
  };

  const linkStyle: React.CSSProperties = {
    color: primaryColor,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={titleStyle}>
        Olá, {user?.name?.split(' ')[0]}!
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard
          title="Próximo Agendamento"
          description="Você não tem agendamentos próximos"
          link={`${getPortalBasePath()}/agendamentos`}
          linkText="Ver agendamentos"
          cardStyle={cardStyle}
          titleStyle={cardTitleStyle}
          descStyle={cardDescStyle}
          linkStyle={linkStyle}
        />
        <DashboardCard
          title="Histórico"
          description="Veja seu histórico de procedimentos"
          link={`${getPortalBasePath()}/historico`}
          linkText="Ver histórico"
          cardStyle={cardStyle}
          titleStyle={cardTitleStyle}
          descStyle={cardDescStyle}
          linkStyle={linkStyle}
        />
        <DashboardCard
          title="Novo Agendamento"
          description="Agende um novo procedimento"
          link={`${getPortalBasePath()}/`}
          linkText="Agendar agora"
          cardStyle={cardStyle}
          titleStyle={cardTitleStyle}
          descStyle={cardDescStyle}
          linkStyle={linkStyle}
        />
      </div>
    </div>
  );
};

// Card do dashboard
const DashboardCard: React.FC<{
  title: string;
  description: string;
  link: string;
  linkText: string;
  cardStyle?: React.CSSProperties;
  titleStyle?: React.CSSProperties;
  descStyle?: React.CSSProperties;
  linkStyle?: React.CSSProperties;
}> = ({ title, description, link, linkText, cardStyle, titleStyle, descStyle, linkStyle }) => (
  <div
    className="rounded-xl border p-6 transition-transform hover:scale-[1.02]"
    style={cardStyle}
  >
    <h3 className="font-semibold mb-2" style={titleStyle}>{title}</h3>
    <p className="text-sm mb-4" style={descStyle}>{description}</p>
    <Link
      to={link}
      className="text-sm font-medium hover:underline"
      style={linkStyle}
    >
      {linkText} →
    </Link>
  </div>
);

// App principal do portal
interface PatientPortalAppProps {
  clinicSlug: string;
}

const PatientPortalApp: React.FC<PatientPortalAppProps> = ({ clinicSlug }) => {
  return (
    <AppProvider>
      <ClinicProvider slug={clinicSlug}>
        <ClinicWrapper>
          <Router>
            <PatientPortalRoutes clinicSlug={clinicSlug} />
          </Router>
        </ClinicWrapper>
      </ClinicProvider>
    </AppProvider>
  );
};

export default PatientPortalApp;
