
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowRight, Lock, User, ArrowLeft, Crown, AlertTriangle } from 'lucide-react';
import AuraLogo from '../components/AuraLogo';
import { UserRole } from '../types';

const KingLogin: React.FC = () => {
  const { login, user } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    if (email && password) {
      try {
          const success = login(email, password);
          if (success) {
            // Redirecionar para o dashboard
            navigate('/dashboard');
          } else {
            setLoginError('Acesso negado. Verifique suas credenciais reais.');
          }
      } catch (err) {
          setLoginError('Erro ao tentar logar. Tente novamente.');
      }
    }
  };

  // Redirecionamento automático se já logado
  React.useEffect(() => {
      if (user && user.role === UserRole.OWNER) {
          navigate('/dashboard');
      }
  }, [user, navigate]);

  const fillDemo = () => {
      setEmail('king@aura.system');
      setPassword('admin');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/4"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/4"></div>

      <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium z-10">
        <ArrowLeft className="w-4 h-4" /> Voltar para o site
      </Link>

      <div className="bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 relative z-10 overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300"></div>

        <div className="pt-10 pb-6 text-center px-8">
           <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Crown className="w-8 h-8 text-amber-400" />
           </div>
           
           <h1 className="text-2xl font-serif font-bold text-white mb-2">
             Acesso King
           </h1>
           <p className="text-slate-400 text-sm">
             Painel Administrativo Master do Aura System.
           </p>
        </div>

        <div className="p-8 pt-2">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail Master</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none transition-all placeholder-slate-600"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Senha de Acesso</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="password" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none transition-all placeholder-slate-600"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                   <AlertTriangle className="w-4 h-4" />
                   {loginError}
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-900/20 transform hover:-translate-y-0.5"
              >
                Entrar no Painel <ArrowRight className="w-4 h-4" />
              </button>

               {/* Atalho Dev */}
               <div className="pt-6 border-t border-slate-700 text-center">
                  <button 
                      type="button" 
                      onClick={fillDemo}
                      className="text-xs text-slate-500 hover:text-amber-400 transition-colors"
                  >
                      Preencher Credenciais (Dev)
                  </button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default KingLogin;
