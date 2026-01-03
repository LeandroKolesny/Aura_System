import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowRight, Lock, User, ArrowLeft, Building, Phone, Users, Mail, AlertTriangle, CheckCircle, Wrench, Loader2, MapPin } from 'lucide-react';
import AuraLogo from '../components/AuraLogo';
import { UserRole } from '../types';
import { maskPhone } from '../utils/maskUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const Login: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const { login, registerCompany, user } = useApp();
  const navigate = useNavigate();

  // Maintenance Mode State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');

  // Verificar modo de manutencao ao carregar
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const response = await fetch(`${API_URL}/api/system/status`);
        if (response.ok) {
          const data = await response.json();
          setMaintenanceMode(data.maintenanceMode || false);
          setMaintenanceMessage(data.maintenanceMessage || '');
        }
      } catch (error) {
        console.error('Erro ao verificar status do sistema:', error);
      }
    };
    checkMaintenance();
  }, []);

  // Register State
  const [regData, setRegData] = useState({
    name: '', // Novo campo
    companyName: '',
    state: '', // Estado (UF)
    email: '',
    phone: '',
    professionalsCount: '1',
    password: '',
    confirmPassword: '' // Novo campo de confirmação
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setRegisterSuccess('');
    setIsLoading(true);

    if (email && password) {
      try {
        const success = await login(email, password);
        if (!success) {
          setLoginError('Usuário ou senha incorretos. Verifique suas credenciais.');
        }
        // A navegação será tratada pelo useEffect abaixo quando o estado user atualizar
      } catch (error) {
        setLoginError('Erro ao fazer login. Tente novamente.');
      }
    }
    setIsLoading(false);
  };
  
  // UseEffect para redirecionar corretamente após o login ser processado
  React.useEffect(() => {
      if (user) {
          if (user.role === UserRole.PATIENT || user.role === UserRole.RECEPTIONIST || user.role === UserRole.ESTHETICIAN) {
              navigate('/schedule');
          } else {
              // Se é admin, o PrivateLayout ou OnboardingAuthWrapper vai decidir pra onde ele vai (onboarding ou dashboard)
              // Mas aqui direcionamos pro dashboard e o router intercepta
              navigate('/dashboard');
          }
      }
  }, [user, navigate]);

  const [isRegistering2, setIsRegistering2] = useState(false); // Loading state para registro

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!regData.name || !regData.companyName || !regData.email || !regData.phone || !regData.password) {
        setLoginError('Por favor, preencha todos os campos obrigatórios.');
        return;
    }

    if (regData.password !== regData.confirmPassword) {
        setLoginError('As senhas não coincidem.');
        return;
    }

    if (regData.email && regData.password && regData.companyName && regData.name) {
      setIsRegistering2(true);
      try {
        // Cria uma nova empresa e o usuário admin dessa empresa com o nome correto
        const result = await registerCompany(regData.companyName, {
            name: regData.name,
            email: regData.email,
            password: regData.password,
            phone: regData.phone,
            state: regData.state || undefined
        });

        if (!result.success) {
          setLoginError(result.error || 'Erro ao criar a conta. Tente novamente.');
          setIsRegistering2(false);
          return;
        }

        // Sucesso: Voltar para tela de login e mostrar mensagem
        setIsRegistering(false);
        setRegisterSuccess('Conta criada com sucesso! Faça login para continuar.');
        setEmail(regData.email); // Preenche o email automaticamente para facilitar
        setPassword(''); // Limpa a senha por segurança

        // Limpa form de registro
        setRegData({
            name: '',
            companyName: '',
            state: '',
            email: '',
            phone: '',
            professionalsCount: '1',
            password: '',
            confirmPassword: ''
        });

      } catch (err) {
        setLoginError('Ocorreu um erro ao criar a conta. Tente novamente.');
      } finally {
        setIsRegistering2(false);
      }
    }
  };

  const fillDemo = (role: 'admin' | 'reception' | 'basic') => {
    if (role === 'admin') {
        // Credenciais do backend
        setEmail('admin@aura.com');
        setPassword('admin123');
    } else if (role === 'reception') {
        // Fallback para dados mock
        setEmail('recepcao@aura.system');
        setPassword('123456');
    } else {
        // Fallback para dados mock
        setEmail('basico@aura.system');
        setPassword('123456');
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-200/30 rounded-full blur-[80px] translate-x-1/3 -translate-y-1/4"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary-200/30 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/4"></div>

      <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 text-secondary-500 hover:text-primary-600 transition-colors font-medium z-10">
        <ArrowLeft className="w-4 h-4" /> Voltar para o site
      </Link>

      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-white/50 relative z-10 overflow-hidden animate-fade-in">
        
        {/* Header da Card */}
        <div className="pt-8 pb-4 text-center px-8">
           <div className="flex justify-center mb-4">
              <AuraLogo className="w-12 h-12" />
           </div>
           
           <h1 className="text-2xl font-bold text-secondary-900 mb-2">
             {isRegistering ? 'Crie sua conta' : 'Acesse o sistema'}
           </h1>
           <p className="text-secondary-500 text-sm">
             {isRegistering 
               ? 'Comece a gerenciar seus atendimentos de forma simples e profissional.' 
               : 'Gestão Premium para sua clínica de estética.'}
           </p>
        </div>

        <div className="p-8 pt-2">
          {/* Banner de Manutencao */}
          {maintenanceMode && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="font-bold text-red-800">Sistema em Manutencao</p>
                  <p className="text-sm text-red-600">
                    {maintenanceMessage || 'Estamos realizando melhorias no sistema. Por favor, retorne mais tarde.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isRegistering ? (
            /* FORMULÁRIO DE CADASTRO */
            <form onSubmit={handleRegister} className="space-y-4">
              
              {/* Novo Campo: Nome Completo */}
              <div>
                <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">Seu Nome Completo</label>
                <div className="relative">
                  <User className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50 text-sm"
                    placeholder="Ex: Dra. Ana Silva"
                    value={regData.name}
                    onChange={(e) => setRegData({...regData,name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">Sua empresa</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50 text-sm"
                      placeholder="Nome da sua clínica"
                      value={regData.companyName}
                      onChange={(e) => setRegData({...regData, companyName: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">Estado</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      className="w-full pl-10 pr-2 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50 text-sm appearance-none"
                      value={regData.state}
                      onChange={(e) => setRegData({...regData, state: e.target.value})}
                    >
                      <option value="">UF</option>
                      <option value="AC">AC</option>
                      <option value="AL">AL</option>
                      <option value="AP">AP</option>
                      <option value="AM">AM</option>
                      <option value="BA">BA</option>
                      <option value="CE">CE</option>
                      <option value="DF">DF</option>
                      <option value="ES">ES</option>
                      <option value="GO">GO</option>
                      <option value="MA">MA</option>
                      <option value="MT">MT</option>
                      <option value="MS">MS</option>
                      <option value="MG">MG</option>
                      <option value="PA">PA</option>
                      <option value="PB">PB</option>
                      <option value="PR">PR</option>
                      <option value="PE">PE</option>
                      <option value="PI">PI</option>
                      <option value="RJ">RJ</option>
                      <option value="RN">RN</option>
                      <option value="RS">RS</option>
                      <option value="RO">RO</option>
                      <option value="RR">RR</option>
                      <option value="SC">SC</option>
                      <option value="SP">SP</option>
                      <option value="SE">SE</option>
                      <option value="TO">TO</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50 text-sm"
                    placeholder="Digite seu melhor e-mail"
                    value={regData.email}
                    onChange={(e) => setRegData({...regData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">Celular</label>
                   <div className="relative">
                     <Phone className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                     <input 
                       type="tel" 
                       required
                       className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50 text-sm"
                       placeholder="(99) 99999-9999"
                       value={regData.phone}
                       onChange={(e) => setRegData({...regData, phone: maskPhone(e.target.value)})}
                       maxLength={15}
                     />
                   </div>
                </div>
                <div>
                   <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">Profissionais</label>
                   <div className="relative">
                     <Users className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                     <select 
                       className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50 text-sm appearance-none"
                       value={regData.professionalsCount}
                       onChange={(e) => setRegData({...regData, professionalsCount: e.target.value})}
                     >
                       <option value="1">1</option>
                       <option value="2">2</option>
                       <option value="3">3</option>
                       <option value="4">4</option>
                       <option value="5">5</option>
                       <option value="6">6</option>
                       <option value="7">7</option>
                       <option value="8">8</option>
                       <option value="9">9</option>
                       <option value="10+">10 ou mais</option>
                     </select>
                   </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="password" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50 text-sm"
                    placeholder="Escolha uma senha segura"
                    value={regData.password}
                    onChange={(e) => setRegData({...regData, password: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="password" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50 text-sm"
                    placeholder="Repita a senha"
                    value={regData.confirmPassword}
                    onChange={(e) => setRegData({...regData, confirmPassword: e.target.value})}
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm animate-fade-in">
                   <AlertTriangle className="w-4 h-4" />
                   {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={maintenanceMode || isRegistering2}
                className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all mt-2 ${
                  maintenanceMode || isRegistering2
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transform hover:-translate-y-0.5'
                }`}
              >
                {isRegistering2 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Criando conta...
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4" /> {maintenanceMode ? 'Indisponível' : 'Criar conta'}
                  </>
                )}
              </button>

              <div className="text-center mt-4">
                <button 
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-sm text-secondary-600 hover:text-primary-600 transition-colors"
                >
                  Já tem uma conta? <span className="font-bold underline">Faça login</span>
                </button>
              </div>
            </form>
          ) : (
            /* FORMULÁRIO DE LOGIN */
            <form onSubmit={handleLogin} className="space-y-6">
              
              {registerSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 text-green-700 text-sm animate-fade-in mb-4">
                   <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                   <div>
                       <p className="font-bold">Bem-vindo(a)!</p>
                       <p>{registerSuccess}</p>
                   </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">E-mail</label>
                <div className="relative">
                  <User className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-secondary-500 uppercase tracking-wider mb-1">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="password" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-all bg-secondary-50/50"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                   <AlertTriangle className="w-4 h-4" />
                   {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || maintenanceMode}
                className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                  maintenanceMode
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-secondary-900 hover:bg-black text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {maintenanceMode ? 'Indisponivel' : isLoading ? 'Entrando...' : 'Acessar Sistema'} {!isLoading && !maintenanceMode && <ArrowRight className="w-4 h-4" />}
              </button>

               {/* Acesso Rápido Demo */}
               <div className="pt-4 border-t border-secondary-100">
                <p className="text-xs text-center text-secondary-400 mb-3 uppercase tracking-wider">Acesso Rápido (Demo)</p>
                <div className="grid grid-cols-3 gap-3">
                    <button 
                        type="button" 
                        onClick={() => fillDemo('admin')}
                        className="py-2 px-3 border border-secondary-200 rounded-lg text-[10px] text-secondary-600 hover:bg-secondary-50 hover:border-secondary-300 transition-colors flex items-center justify-center gap-1 font-bold"
                    >
                        <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0"></div>
                        Admin
                    </button>
                    <button 
                        type="button" 
                        onClick={() => fillDemo('reception')}
                        className="py-2 px-3 border border-secondary-200 rounded-lg text-[10px] text-secondary-600 hover:bg-secondary-50 hover:border-secondary-300 transition-colors flex items-center justify-center gap-1 font-bold"
                    >
                        <div className="w-2 h-2 rounded-full bg-secondary-500 shrink-0"></div>
                        Recepção
                    </button>
                    <button 
                        type="button" 
                        onClick={() => fillDemo('basic')}
                        className="py-2 px-3 border border-red-200 bg-red-50 rounded-lg text-[10px] text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-1 font-bold"
                    >
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                        Básico
                    </button>
                </div>
              </div>

              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => !maintenanceMode && setIsRegistering(true)}
                  disabled={maintenanceMode}
                  className={`text-sm transition-colors ${
                    maintenanceMode
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-secondary-600 hover:text-primary-600'
                  }`}
                >
                  Não tem conta? <span className={maintenanceMode ? '' : 'font-bold underline'}>{maintenanceMode ? 'Registro indisponivel' : 'Cadastre-se grátis'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;