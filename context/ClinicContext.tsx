// context/ClinicContext.tsx
// Contexto para o Portal do Paciente - dados da clínica

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { publicApi } from '../services/api';
import { Company, Procedure, User } from '../types';

interface ClinicContextType {
  clinic: Company | null;
  procedures: Procedure[];
  professionals: User[];
  isLoading: boolean;
  error: string | null;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

interface ClinicProviderProps {
  slug: string;
  children: ReactNode;
}

export const ClinicProvider: React.FC<ClinicProviderProps> = ({ slug, children }) => {
  const [clinic, setClinic] = useState<Company | null>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadClinicData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await publicApi.getCompanyBySlug(slug);

        if (response.success && response.data) {
          // Mapear dados da empresa
          const companyData = response.data.company;
          setClinic({
            ...companyData,
            plan: companyData.plan?.toLowerCase() || 'basic',
            subscriptionStatus: companyData.subscriptionStatus?.toLowerCase() || 'active',
            targetAudience: {
              female: companyData.targetFemale ?? true,
              male: companyData.targetMale ?? true,
              kids: companyData.targetKids ?? false
            },
            socialMedia: {
              instagram: companyData.instagram || '',
              facebook: companyData.facebook || '',
              website: companyData.website || ''
            }
          });

          // Mapear procedimentos
          if (response.data.procedures) {
            setProcedures(response.data.procedures.map((p: any) => ({
              ...p,
              price: Number(p.price) || 0,
              cost: Number(p.cost) || 0,
            })));
          }

          // Mapear profissionais
          if (response.data.professionals) {
            setProfessionals(response.data.professionals);
          }

          // Aplicar tema da clínica
          if (companyData.layoutConfig) {
            applyClinicTheme(companyData.layoutConfig);
          }

          console.log('✅ Dados da clínica carregados:', companyData.name);
        } else {
          setError('Clínica não encontrada');
        }
      } catch (err) {
        console.error('❌ Erro ao carregar clínica:', err);
        setError('Erro ao carregar dados da clínica');
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      loadClinicData();
    }
  }, [slug]);

  return (
    <ClinicContext.Provider value={{ clinic, procedures, professionals, isLoading, error }}>
      {children}
    </ClinicContext.Provider>
  );
};

export const useClinic = () => {
  const context = useContext(ClinicContext);
  if (context === undefined) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
};

// Aplica o tema visual da clínica via CSS variables
function applyClinicTheme(layoutConfig: any) {
  const root = document.documentElement;

  if (layoutConfig.primaryColor) {
    root.style.setProperty('--clinic-primary', layoutConfig.primaryColor);
  }
  if (layoutConfig.backgroundColor) {
    root.style.setProperty('--clinic-background', layoutConfig.backgroundColor);
  }
  if (layoutConfig.textColor) {
    root.style.setProperty('--clinic-text', layoutConfig.textColor);
  }
  if (layoutConfig.cardBackgroundColor) {
    root.style.setProperty('--clinic-card-bg', layoutConfig.cardBackgroundColor);
  }
  if (layoutConfig.cardTextColor) {
    root.style.setProperty('--clinic-card-text', layoutConfig.cardTextColor);
  }
  if (layoutConfig.headerBackgroundColor) {
    root.style.setProperty('--clinic-header-bg', layoutConfig.headerBackgroundColor);
  }
  if (layoutConfig.headerTextColor) {
    root.style.setProperty('--clinic-header-text', layoutConfig.headerTextColor);
  }
}
