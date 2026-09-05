
import React from 'react';
import { SAAS_COMPANY_NAME } from '../constants';

interface LogoProps {
  className?: string;
  type?: 'full' | 'icon'; // 'full' inclui o texto escrito ao lado
}

const AuraLogo: React.FC<LogoProps> = ({ className = "w-10 h-10", type = 'icon' }) => {
  // ---------------------------------------------------------------------------
  // IMPORTANTE: Renomeie a imagem do seu logo para 'logo.png' e coloque na pasta 'public' do projeto.
  // O sistema irá carregar a imagem automaticamente.
  // ---------------------------------------------------------------------------
  const logoUrl = '/logo.png'; 

  return (
    <div className={`flex items-center gap-3 ${className.includes('w-') ? '' : 'w-auto'}`}>
      <img
        src={logoUrl}
        alt={`${SAAS_COMPANY_NAME} Logo`}
        className={`${className} object-contain mix-blend-multiply`}
        // mix-blend-multiply: Este efeito ajuda a tornar transparente o fundo branco da imagem quando sobreposta a fundos claros
      />

      {type === 'full' && (
        <div className="flex flex-col">
          <span className="font-serif text-2xl text-secondary-900 tracking-tight leading-none">{SAAS_COMPANY_NAME}</span>
        </div>
      )}
    </div>
  );
};

export default AuraLogo;
