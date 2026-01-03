import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradeOverlayProps {
  message?: string;
  children: React.ReactNode;
}

export const UpgradeOverlay: React.FC<UpgradeOverlayProps> = ({
  message = "Ative a versão Pro ou superior.",
  children
}) => {
  const navigate = useNavigate();

  return (
    <div className="relative">
      {/* Conteúdo original com blur e cinza */}
      <div className="filter blur-[2px] grayscale opacity-50 pointer-events-none select-none">
        {children}
      </div>

      {/* Overlay de bloqueio - responsivo: sem margem no mobile, com margem no desktop */}
      <div className="fixed top-0 right-0 bottom-0 left-0 lg:left-64 bg-slate-900/30 backdrop-blur-[1px] flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 lg:p-8 max-w-md w-full text-center animate-fade-in border border-slate-200">
          <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 lg:mb-6 shadow-lg shadow-primary-500/30">
            <Lock className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
          </div>

          <h2 className="text-xl lg:text-2xl font-bold text-slate-900 mb-2 lg:mb-3">
            Recurso Premium
          </h2>

          <p className="text-sm lg:text-base text-slate-600 mb-4 lg:mb-6">
            {message}
          </p>

          <button
            onClick={() => navigate('/settings', { state: { openPlans: true } })}
            className="w-full py-2.5 lg:py-3 px-4 lg:px-6 bg-gradient-to-r from-primary-500 to-purple-600 text-white text-sm lg:text-base font-bold rounded-xl hover:from-primary-600 hover:to-purple-700 transition-all shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 lg:w-5 lg:h-5" />
            Ver Planos e Fazer Upgrade
          </button>

          <p className="text-[10px] lg:text-xs text-slate-400 mt-3 lg:mt-4">
            Desbloqueie todos os recursos com um plano pago
          </p>
        </div>
      </div>
    </div>
  );
};

// Componente para mostrar alerta inline (para limites de quantidade)
interface UpgradeAlertProps {
  message: string;
  onUpgrade?: () => void;
}

export const UpgradeAlert: React.FC<UpgradeAlertProps> = ({ message, onUpgrade }) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate('/settings', { state: { openPlans: true } });
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 text-amber-600" />
        </div>
        <p className="text-amber-800 text-sm font-medium">
          {message}
        </p>
      </div>
      <button
        onClick={handleUpgrade}
        className="shrink-0 px-4 py-2 bg-gradient-to-r from-primary-500 to-purple-600 text-white text-sm font-bold rounded-lg hover:from-primary-600 hover:to-purple-700 transition-all shadow-md flex items-center gap-1.5"
      >
        <Sparkles className="w-4 h-4" />
        Fazer Upgrade
      </button>
    </div>
  );
};

export default UpgradeOverlay;
