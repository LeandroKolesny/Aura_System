// pages/patient-portal/PatientLogin.tsx
// Página de login do Portal do Paciente

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useClinic } from '../../context/ClinicContext';
import { getPortalBasePath } from '../../utils/subdomain';
import { ArrowRight, Lock, Mail, AlertTriangle, ArrowLeft } from 'lucide-react';
import { UserRole } from '../../types';

const PatientLogin: React.FC = () => {
  const { login, user } = useApp();
  const { clinic } = useClinic();
  const navigate = useNavigate();
  const basePath = getPortalBasePath();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redireciona se já estiver logado como paciente
  useEffect(() => {
    if (user && user.role === UserRole.PATIENT) {
      navigate(`${basePath}/minha-conta`);
    }
  }, [user, navigate, basePath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, password);

      if (success) {
        // Login vai atualizar o estado do user, e o useEffect acima vai redirecionar
      } else {
        setError('E-mail ou senha incorretos.');
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Estilo baseado nas cores da clínica
  const primaryColor = clinic?.layoutConfig?.primaryColor || '#8b5cf6';
  const backgroundColor = clinic?.layoutConfig?.backgroundColor || '#fafaf9';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor }}
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-secondary-100 overflow-hidden">
        {/* Header */}
        <div className="p-8 text-center border-b border-secondary-100">
          {clinic?.logo ? (
            <img
              src={clinic.logo}
              alt={clinic.name}
              className="h-16 object-contain mx-auto mb-4"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              {clinic?.name?.charAt(0) || 'C'}
            </div>
          )}

          <h1 className="text-2xl font-bold text-secondary-900">
            {clinic?.name || 'Portal do Paciente'}
          </h1>
          <p className="text-secondary-500 mt-2">
            Acesse sua conta para ver seus agendamentos
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">
              E-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl font-bold text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
            {!isLoading && <ArrowRight className="w-4 h-4 inline ml-2" />}
          </button>
        </form>

        {/* Footer */}
        <div className="px-8 pb-8 text-center">
          <p className="text-sm text-secondary-500">
            Não tem conta?{' '}
            <Link
              to={`${basePath}/`}
              className="font-medium hover:underline"
              style={{ color: primaryColor }}
            >
              Faça um agendamento
            </Link>
          </p>

          <Link
            to={`${basePath}/`}
            className="inline-flex items-center gap-1 mt-4 text-sm text-secondary-400 hover:text-secondary-600"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar para agendamento
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PatientLogin;
