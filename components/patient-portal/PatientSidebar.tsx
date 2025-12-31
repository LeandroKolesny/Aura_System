// components/patient-portal/PatientSidebar.tsx
// Sidebar simplificada para o Portal do Paciente

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, Scissors, Clock, LogOut, User } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { useApp } from '../../context/AppContext';
import { getPortalBasePath } from '../../utils/subdomain';

const PatientSidebar: React.FC = () => {
  const { clinic } = useClinic();
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const basePath = getPortalBasePath();

  const menuItems = [
    { icon: Home, label: 'Minha Conta', path: `${basePath}/minha-conta` },
    { icon: Calendar, label: 'Agendamentos', path: `${basePath}/agendamentos` },
    { icon: Scissors, label: 'Procedimentos', path: `${basePath}/procedimentos` },
    { icon: Clock, label: 'Histórico', path: `${basePath}/historico` },
  ];

  const handleLogout = async () => {
    await logout();
    navigate(`${basePath}/login`);
  };

  // Layout config da clínica
  const layoutConfig = clinic?.layoutConfig;
  const primaryColor = layoutConfig?.primaryColor || '#8b5cf6';
  const backgroundColor = layoutConfig?.backgroundColor || '#fafaf9';
  const textColor = layoutConfig?.textColor;

  // Detecta se o fundo é escuro
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

  const isDark = isDarkBackground(backgroundColor);

  // Deriva cor da sidebar a partir do backgroundColor
  const deriveSidebarColor = (bgColor?: string): string => {
    if (!bgColor) return isDark ? '#1a1a1a' : '#ffffff';
    const hex = bgColor.replace('#', '');
    if (hex.length !== 6) return isDark ? '#1a1a1a' : '#ffffff';
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Se fundo escuro, sidebar fica um pouco mais clara. Se claro, fica mais escura.
    const adjustment = isDark ? 20 : -8;
    const newR = Math.min(255, Math.max(0, r + adjustment));
    const newG = Math.min(255, Math.max(0, g + adjustment));
    const newB = Math.min(255, Math.max(0, b + adjustment));
    return `rgb(${newR}, ${newG}, ${newB})`;
  };

  const sidebarBgColor = deriveSidebarColor(backgroundColor);
  const mainTextColor = textColor || (isDark ? '#f5f5f5' : '#1e293b');
  const secondaryTextColor = isDark ? 'rgba(255,255,255,0.6)' : '#64748b';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // Estilos derivados
  const sidebarStyle: React.CSSProperties = {
    backgroundColor: sidebarBgColor,
    borderColor: borderColor,
  };

  const headerBorderStyle: React.CSSProperties = {
    borderColor: borderColor,
  };

  const titleStyle: React.CSSProperties = {
    color: mainTextColor,
  };

  // Gera classes de hover customizadas
  const getNavLinkStyle = (isActive: boolean): React.CSSProperties => {
    if (isActive) {
      return {
        backgroundColor: `${primaryColor}15`, // 15% opacity
        color: primaryColor,
      };
    }
    return {
      color: secondaryTextColor,
    };
  };

  const getNavLinkHoverStyle = (): React.CSSProperties => {
    return {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      color: mainTextColor,
    };
  };

  const userAvatarStyle: React.CSSProperties = {
    backgroundColor: `${primaryColor}20`, // 20% opacity
  };

  const userIconStyle: React.CSSProperties = {
    color: primaryColor,
  };

  const footerBorderStyle: React.CSSProperties = {
    borderColor: borderColor,
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-64 border-r flex flex-col"
      style={sidebarStyle}
    >
      {/* Header com logo da clínica */}
      <div className="p-6 border-b" style={headerBorderStyle}>
        {clinic?.logo ? (
          <img
            src={clinic.logo}
            alt={clinic.name}
            className="h-10 object-contain"
          />
        ) : (
          <h1 className="text-xl font-bold" style={titleStyle}>
            {clinic?.name || 'Portal'}
          </h1>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
                style={({ isActive }) => getNavLinkStyle(isActive)}
                onMouseEnter={(e) => {
                  const target = e.currentTarget;
                  if (!target.classList.contains('active')) {
                    Object.assign(target.style, getNavLinkHoverStyle());
                  }
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget;
                  if (!target.classList.contains('active')) {
                    target.style.backgroundColor = 'transparent';
                    target.style.color = secondaryTextColor;
                  }
                }}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer com dados do usuário */}
      <div className="p-4 border-t" style={footerBorderStyle}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={userAvatarStyle}
          >
            <User className="w-5 h-5" style={userIconStyle} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: mainTextColor }}>
              {user?.name || 'Paciente'}
            </p>
            <p className="text-xs truncate" style={{ color: secondaryTextColor }}>
              {user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors"
          style={{
            color: '#ef4444',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
};

export default PatientSidebar;
