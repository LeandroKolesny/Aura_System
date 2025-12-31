import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Smartphone, CheckCircle, ArrowRight, Menu, X, Sparkles, Shield,
  TrendingUp, Mail, MapPin, Phone, Instagram, Facebook, Linkedin,
  Crown, AlertTriangle, Ghost, Clock, BarChart3, RefreshCw,
  ChevronDown, ChevronUp, Lock, Calendar, DollarSign, Star,
  Database, Server, Headphones, XCircle, Check
} from 'lucide-react';
import AuraLogo from '../components/AuraLogo';
import { useApp } from '../context/AppContext';
import { plansApi, SaasPlan } from '../services/api';

const LandingPage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { saasPlans: contextPlans } = useApp();
  const [plansFromApi, setPlansFromApi] = useState<SaasPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const navigate = useNavigate();

  // Carregar planos da API ao montar
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await plansApi.list(true); // only active plans
        if (response.success && response.data && response.data.length > 0) {
          setPlansFromApi(response.data);
        }
        // Se não houver planos na API, mantém contextPlans (DEFAULT_PLANS)
      } catch (error) {
        console.error('Erro ao carregar planos:', error);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  // Usar planos da API se disponíveis, senão fallback para context (DEFAULT_PLANS)
  const saasPlans = plansFromApi.length > 0 ? plansFromApi : contextPlans;

  // States para a Demo Interativa
  const [activeDemoTab, setActiveDemoTab] = useState<'dashboard' | 'agenda' | 'financeiro' | 'retorno'>('dashboard');

  // State para FAQ
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const scrollToSection = (id: string) => {
    setIsMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  // Helper para ordenar os planos e filtrar ativos
  const sortedPlans = [...saasPlans]
      .filter(plan => plan.active)
      .sort((a, b) => {
          const order = { starter: 1, pro: 2, clinic: 3 };
          // Fallback sort by price if ID is not in order list
          const orderA = order[a.id as keyof typeof order] || (a.price || 9999);
          const orderB = order[b.id as keyof typeof order] || (b.price || 9999);
          return orderA - orderB;
      });

  return (
    <div className="min-h-screen bg-[#fdfcfb] text-stone-800 selection:bg-[#bd7b65] selection:text-white font-sans">
      {/* Navbar com Glassmorphism Refinado */}
      <nav className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-md transition-all duration-300 border-b border-stone-100">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <AuraLogo className="w-9 h-9" type="full" />
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-10">
              {['Funcionalidades', 'Pilares', 'Planos', 'Dúvidas'].map((item) => (
                <button 
                  key={item}
                  onClick={() => scrollToSection(item === 'Dúvidas' ? 'faq' : item.toLowerCase().replace('ç', 'c').replace('õ', 'o'))} 
                  className="text-sm font-medium text-stone-600 hover:text-[#bd7b65] transition-colors bg-transparent border-none cursor-pointer tracking-wide"
                >
                  {item}
                </button>
              ))}
              
              <div className="flex items-center gap-4 ml-6 pl-6 border-l border-stone-200">
                <Link to="/login" className="text-sm font-bold text-stone-800 hover:text-[#bd7b65] transition-colors">
                  Login
                </Link>
                <Link 
                  to="/king" 
                  className="p-2 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-600 transition-all hover:scale-110 border border-amber-100"
                  title="Acesso King (Owner)"
                >
                  <Crown className="w-4 h-4" />
                </Link>
                <Link 
                  to="/login" 
                  className="bg-stone-900 hover:bg-black text-white px-7 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  Teste Grátis
                </Link>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-stone-800 p-2">
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-stone-100 p-6 absolute w-full shadow-2xl animate-fade-in">
            <div className="flex flex-col space-y-6 text-center">
              <button onClick={() => scrollToSection('features')} className="text-stone-600 font-medium bg-transparent border-none p-0">Funcionalidades</button>
              <button onClick={() => scrollToSection('plans')} className="text-stone-600 font-medium bg-transparent border-none p-0">Planos & Preços</button>
              <button onClick={() => scrollToSection('faq')} className="text-stone-600 font-medium bg-transparent border-none p-0">Dúvidas Frequentes</button>
              <div className="flex flex-col gap-4 pt-4 border-t border-stone-100">
                  <Link to="/login" className="text-stone-900 font-bold">Entrar</Link>
                  <Link to="/login" className="bg-[#bd7b65] text-white py-3 rounded-full font-bold">Criar Conta Grátis</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section Premium (Ambient Glow: Rose Gold / Pele para combinar com "Ecossistema") */}
      <section className="relative pt-40 pb-20 lg:pt-52 lg:pb-32 overflow-hidden">
        {/* Glow Rose Gold Suave (#bd7b65) */}
        <div className="absolute top-1/2 left-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-[#bd7b65] blur-[150px] rounded-full pointer-events-none opacity-20"></div>
        <div className="absolute top-0 right-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-[#bd7b65] blur-[150px] rounded-full pointer-events-none opacity-20"></div>

        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-white border border-stone-200 rounded-full px-5 py-2 mb-8 shadow-sm animate-fade-in">
              <Sparkles className="w-3.5 h-3.5 text-[#bd7b65]" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-stone-500">Gestão Premium & Inteligência Artificial</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-serif text-stone-900 leading-[1.1] mb-8 tracking-tight">
              Não somos apenas uma agenda.<br />
              Somos um <span className="italic text-[#bd7b65]">Ecossistema.</span>
            </h1>
            
            <p className="text-xl text-stone-500 font-light max-w-2xl mx-auto leading-relaxed">
              Do agendamento à construção da sua marca: a única plataforma que une gestão, design e inteligência artificial em um só lugar.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-24">
            <Link 
              to="/login" 
              className="w-full sm:w-auto bg-[#bd7b65] hover:bg-[#a66550] text-white px-10 py-4 rounded-full font-bold text-sm uppercase tracking-wide transition-all shadow-xl shadow-[#bd7b65]/20 flex items-center justify-center gap-3 hover:-translate-y-1"
            >
              Testar 7 Dias Grátis <ArrowRight className="w-4 h-4" />
            </Link>
            <button 
              onClick={() => scrollToSection('features')}
              className="w-full sm:w-auto px-10 py-4 rounded-full font-bold text-sm uppercase tracking-wide text-stone-600 bg-white border border-stone-200 hover:border-stone-300 hover:shadow-lg transition-all flex items-center justify-center gap-3 hover:-translate-y-1"
            >
              <Smartphone className="w-4 h-4" /> Ver Demonstração
            </button>
          </div>

          <p className="text-center text-[10px] text-stone-400 font-bold tracking-[0.2em] uppercase mb-16 opacity-70">
            Cancele quando quiser · Suporte humanizado · Dados sempre seus
          </p>

          {/* Hero Image Container */}
          <div className="relative w-full max-w-[1200px] mx-auto">
             <div className="relative rounded-2xl overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-stone-200/60 bg-white p-2">
                <div className="rounded-xl overflow-hidden bg-stone-100 relative group">
                    <img 
                      src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=2668&auto=format&fit=crop" 
                      alt="Gestão de Clínica de Estética" 
                      className="w-full object-cover h-[400px] md:h-[650px] transition-transform duration-[2s] group-hover:scale-105"
                    />
                    
                    {/* Gradient Overlay Suave */}
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-900/30 via-transparent to-transparent"></div>

                    {/* Floating Card: Notification */}
                    <div className="absolute top-8 right-8 md:top-12 md:right-12 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg flex items-center gap-4 animate-bounce-slow max-w-xs z-20 border border-white/50">
                        <div className="w-10 h-10 rounded-full bg-stone-200 overflow-hidden shrink-0 ring-2 ring-white">
                            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80" alt="Beatriz" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <p className="font-bold text-stone-900 text-sm">Beatriz Lima</p>
                            <p className="text-xs text-stone-500">Toxina Botulínica • 14:30</p>
                        </div>
                        <div className="bg-green-100 p-1.5 rounded-full text-green-600 ml-2">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Floating Card: Revenue */}
                    <div className="absolute bottom-8 left-8 md:bottom-12 md:left-12 bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-xl flex items-center gap-4 z-20 animate-fade-in border border-white/50">
                        <div className="bg-[#bd7b65]/10 p-3 rounded-full text-[#bd7b65]">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-0.5">Receita Mensal</p>
                            <p className="text-2xl font-serif font-bold text-stone-900 leading-none">+ R$ 42.500</p>
                        </div>
                    </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* DORES / PERDA DE DINHEIRO - Ambient Glow Vermelho (Matching "dinheiro escorre") */}
      <section className="py-24 bg-white relative overflow-hidden">
          {/* Ambient Glow Effects (Vermelho Sutil) */}
          <div className="absolute top-1/2 left-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-red-500 blur-[150px] rounded-full pointer-events-none opacity-10"></div>
          <div className="absolute top-1/2 right-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-red-500 blur-[150px] rounded-full pointer-events-none opacity-10"></div>

          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
              <div className="text-center max-w-3xl mx-auto mb-20">
                  <span className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3 block">Atenção ao seu negócio</span>
                  <h2 className="text-4xl md:text-5xl font-serif text-stone-900 mb-6">
                      Enquanto você trabalha, <span className="italic text-red-500">dinheiro escorre pelo ralo</span>
                  </h2>
                  <p className="text-lg text-stone-500 font-light">
                      A cada semana sem sistema, você perde clientes, tempo e dinheiro. Identifique os gargalos:
                  </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                  {/* Card 1 - PROBLEMA (Background Vermelho Claro) */}
                  <div className="bg-red-50 rounded-[2rem] p-10 border border-red-100 transition-all hover:shadow-xl group">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="bg-red-100 p-2.5 rounded-xl text-red-600">
                              <AlertTriangle className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">O Problema</span>
                      </div>
                      <h3 className="text-2xl font-serif text-stone-900 mb-4">Cliente marca e não aparece</h3>
                      <p className="text-stone-600 mb-8 leading-relaxed">
                          Você bloqueia o horário, prepara a sala, e o cliente simplesmente some. 
                          <br/><strong className="text-stone-900">Cadeira vazia é prejuízo irreparável.</strong>
                      </p>
                      <div className="pt-6 border-t border-red-200/50 flex items-center justify-between">
                          <div>
                              <p className="text-xs text-stone-400 uppercase font-bold mb-1">Prejuízo Estimado</p>
                              <div className="text-3xl font-serif text-stone-900">R$ 800+<span className="text-sm font-sans text-stone-400 font-normal ml-1">/mês</span></div>
                          </div>
                      </div>
                  </div>

                  {/* Card 2 - SOLUÇÃO (Background Verde Claro) */}
                  <div className="bg-emerald-50 rounded-[2rem] p-10 border border-emerald-100 hover:border-emerald-200 transition-all hover:shadow-xl group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                      
                      <div className="flex items-center gap-3 mb-6 relative z-10">
                          <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600">
                              <CheckCircle className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">A Solução Aura</span>
                      </div>
                      <h3 className="text-2xl font-serif text-stone-900 mb-4 relative z-10">Confirmação Automática</h3>
                      <p className="text-stone-600 mb-8 leading-relaxed relative z-10">
                          O sistema envia WhatsApp automático 24h antes. Se não confirmar, o horário é liberado para outro cliente.
                      </p>
                      <div className="pt-6 border-t border-emerald-100 flex items-center justify-between relative z-10">
                          <div>
                              <p className="text-xs text-stone-400 uppercase font-bold mb-1">Resultado</p>
                              <div className="text-3xl font-serif text-emerald-600">80%<span className="text-sm font-sans text-stone-400 font-normal ml-1">menos faltas</span></div>
                          </div>
                      </div>
                  </div>

                  {/* Card 3 - PROBLEMA (Background Vermelho Claro) */}
                  <div className="bg-red-50 rounded-[2rem] p-10 border border-red-100 transition-all hover:shadow-xl group">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="bg-red-100 p-2.5 rounded-xl text-red-600">
                              <Ghost className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">O Problema</span>
                      </div>
                      <h3 className="text-2xl font-serif text-stone-900 mb-4">Clientes "Fantasmas"</h3>
                      <p className="text-stone-600 mb-8 leading-relaxed">
                          Aquela cliente fiel parou de vir e você nem notou. <br/>
                          <strong className="text-stone-900">Sem CRM, ela vai para a concorrência.</strong>
                      </p>
                      <div className="pt-6 border-t border-red-200/50 flex items-center justify-between">
                          <div>
                              <p className="text-xs text-stone-400 uppercase font-bold mb-1">Perda Anual</p>
                              <div className="text-3xl font-serif text-stone-900">30%<span className="text-sm font-sans text-stone-400 font-normal ml-1">da carteira</span></div>
                          </div>
                      </div>
                  </div>

                  {/* Card 4 - SOLUÇÃO (Background Verde Claro) */}
                  <div className="bg-emerald-50 rounded-[2rem] p-10 border border-emerald-100 hover:border-emerald-200 transition-all hover:shadow-xl group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                      
                      <div className="flex items-center gap-3 mb-6 relative z-10">
                          <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600">
                              <RefreshCw className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">A Solução Aura</span>
                      </div>
                      <h3 className="text-2xl font-serif text-stone-900 mb-4 relative z-10">Resgate Inteligente</h3>
                      <p className="text-stone-600 mb-8 leading-relaxed relative z-10">
                          O Aura detecta quem sumiu há 45 dias e sugere uma mensagem carinhosa para trazê-la de volta.
                      </p>
                      <div className="pt-6 border-t border-emerald-100 flex items-center justify-between relative z-10">
                          <div>
                              <p className="text-xs text-stone-400 uppercase font-bold mb-1">Resultado</p>
                              <div className="text-3xl font-serif text-emerald-600">40%<span className="text-sm font-sans text-stone-400 font-normal ml-1">recuperados</span></div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* 4 PILARES - Ambient Glow Rose Gold */}
      <section id="pillars" className="py-24 bg-white relative overflow-hidden">
          {/* Ambient Glow Effects (Rose Gold) */}
          <div className="absolute top-1/2 left-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-[#bd7b65] blur-[150px] rounded-full pointer-events-none opacity-20"></div>
          <div className="absolute top-1/2 right-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-[#bd7b65] blur-[150px] rounded-full pointer-events-none opacity-20"></div>

          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
              <div className="text-center mb-20">
                  <h2 className="text-4xl md:text-5xl font-serif text-stone-900 mb-6">
                      4 Pilares da <span className="italic text-[#bd7b65]">Transformação</span>
                  </h2>
                  <p className="text-lg text-stone-500 max-w-2xl mx-auto font-light">
                      Enquanto outros sistemas só organizam sua agenda, nós construímos uma <strong>marca premium completa</strong> para você.
                  </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-7xl mx-auto">
                  {/* Pilar 1 - Gestão (Cinza/Slate - Profissionalismo) */}
                  <div className="bg-slate-50 p-10 rounded-3xl border border-slate-100 hover:border-slate-200 transition-all hover:shadow-lg group">
                      <div className="w-16 h-16 bg-stone-900 rounded-2xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform duration-500 shadow-lg">
                          <Smartphone className="w-7 h-7" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Pilar 01</span>
                      <h3 className="text-2xl font-serif text-stone-900 mb-4">Gestão & Operação</h3>
                      <p className="text-stone-500 mb-8 font-light leading-relaxed">
                          O básico bem feito. Agendamento, confirmações e financeiro rodando no piloto automático para você focar no atendimento.
                      </p>
                      <ul className="space-y-3">
                          {['Agenda Inteligente', 'Financeiro Automático', 'Controle de Estoque'].map((item) => (
                              <li key={item} className="flex items-center gap-3 text-sm text-stone-600">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> {item}
                              </li>
                          ))}
                      </ul>
                  </div>

                  {/* Pilar 2 - Growth (Laranja/Rose - Crescimento) */}
                  <div className="bg-orange-50 p-10 rounded-3xl border border-orange-100 hover:border-orange-200 transition-all hover:shadow-lg group">
                      <div className="w-16 h-16 bg-[#bd7b65] rounded-2xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-[#bd7b65]/20">
                          <TrendingUp className="w-7 h-7" />
                      </div>
                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2 block">Pilar 02</span>
                      <h3 className="text-2xl font-serif text-stone-900 mb-4">Growth & Vendas</h3>
                      <p className="text-stone-500 mb-8 font-light leading-relaxed">
                          O motor de dinheiro. Ferramentas ativas que trazem clientes de volta, aumentam o ticket médio e enchem sua agenda.
                      </p>
                      <ul className="space-y-3">
                          {['CRM de Vendas', 'Resgate de Inativos', 'Dashboard em Tempo Real'].map((item) => (
                              <li key={item} className="flex items-center gap-3 text-sm text-stone-600">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#bd7b65]"></div> {item}
                              </li>
                          ))}
                      </ul>
                  </div>

                  {/* Pilar 3 - Branding & IA (Roxo - Tecnologia/Criatividade) */}
                  <div className="bg-purple-50 p-10 rounded-3xl border border-purple-100 hover:border-purple-200 transition-all hover:shadow-lg group">
                      <div className="w-16 h-16 bg-white text-purple-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-sm">
                          <Sparkles className="w-7 h-7" />
                      </div>
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2 block">Pilar 03</span>
                      <h3 className="text-2xl font-serif text-stone-900 mb-4">Branding & IA</h3>
                      <p className="text-stone-500 mb-8 font-light leading-relaxed">
                          Diferenciação pura. Inteligência artificial para encantar clientes e design que valoriza sua marca.
                      </p>
                      <ul className="space-y-3">
                          {['Resumos com IA', 'Pós-venda Personalizado', 'Galeria Antes & Depois'].map((item) => (
                              <li key={item} className="flex items-center gap-3 text-sm text-stone-600">
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div> {item}
                              </li>
                          ))}
                      </ul>
                  </div>

                  {/* Pilar 4 - Segurança (Azul - Confiança) */}
                  <div className="bg-blue-50 p-10 rounded-3xl border border-blue-100 hover:border-blue-200 transition-all hover:shadow-lg group">
                      <div className="w-16 h-16 bg-white text-blue-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-sm">
                          <Shield className="w-7 h-7" />
                      </div>
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 block">Pilar 04</span>
                      <h3 className="text-2xl font-serif text-stone-900 mb-4">Segurança & Suporte</h3>
                      <p className="text-stone-500 mb-8 font-light leading-relaxed">
                          Tranquilidade total. Seus dados protegidos, contratos digitais e um suporte que realmente resolve.
                      </p>
                      <ul className="space-y-3">
                          {['Termos Digitais', 'Prontuário Seguro', 'Backup Diário'].map((item) => (
                              <li key={item} className="flex items-center gap-3 text-stone-600">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> {item}
                              </li>
                          ))}
                      </ul>
                  </div>
              </div>
          </div>
      </section>

      {/* DEMO INTERATIVA (Ambient Glow Rose Gold) */}
      <section id="features" className="py-24 bg-white border-t border-stone-100 relative overflow-hidden">
          {/* Ambient Glow Effects */}
          <div className="absolute top-1/2 left-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-[#bd7b65] blur-[150px] rounded-full pointer-events-none opacity-10"></div>
          <div className="absolute top-1/2 right-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-[#bd7b65] blur-[150px] rounded-full pointer-events-none opacity-10"></div>

          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
              <div className="text-center mb-16">
                  <h2 className="text-4xl font-serif text-stone-900 mb-6">
                      Tour pelas <span className="italic text-[#bd7b65]">Funcionalidades</span>
                  </h2>
              </div>

              {/* Tabs Navigation */}
              <div className="flex flex-wrap justify-center gap-3 mb-16">
                  {[
                      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                      { id: 'agenda', label: 'Agenda', icon: Calendar },
                      { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
                      { id: 'retorno', label: 'Retorno Automático', icon: RefreshCw }
                  ].map((tab) => (
                      <button
                          key={tab.id}
                          onClick={() => setActiveDemoTab(tab.id as any)}
                          className={`px-8 py-3 rounded-full text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-300 ${
                              activeDemoTab === tab.id
                                  ? 'bg-stone-900 text-white shadow-lg transform scale-105'
                                  : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-800'
                          }`}
                      >
                          <tab.icon className="w-4 h-4" />
                          {tab.label}
                      </button>
                  ))}
              </div>

              {/* Tab Content */}
              <div className="bg-[#fcfbf9] rounded-[3rem] p-8 md:p-12 border border-stone-200 shadow-2xl shadow-stone-200/50 transition-all duration-500">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                      {/* Text Content */}
                      <div className="animate-fade-in order-2 lg:order-1 lg:col-span-5">
                          <span className="text-[#bd7b65] font-bold text-xs uppercase tracking-[0.2em] mb-4 block">
                              Visão 360º
                          </span>
                          
                          {activeDemoTab === 'dashboard' && (
                              <>
                                  <h3 className="text-4xl font-serif text-stone-900 mb-6">Controle total na palma da mão</h3>
                                  <p className="text-stone-600 mb-8 text-lg font-light leading-relaxed">
                                      Veja faturamento, clientes novos e retenção em tempo real. Chega de "achismos", tome decisões baseadas em dados.
                                  </p>
                                  <ul className="space-y-4 mb-10">
                                      {['Métricas financeiras claras', 'Análise de crescimento', 'Indicadores de performance'].map((item) => (
                                          <li key={item} className="flex items-center gap-3 text-stone-700">
                                              <CheckCircle className="w-5 h-5 text-[#bd7b65]" /> {item}
                                          </li>
                                      ))}
                                  </ul>
                              </>
                          )}

                          {activeDemoTab === 'agenda' && (
                              <>
                                  <h3 className="text-4xl font-serif text-stone-900 mb-6">Agenda Inteligente</h3>
                                  <p className="text-stone-600 mb-8 text-lg font-light leading-relaxed">
                                      Adeus papel. Uma agenda visual, intuitiva e integrada ao WhatsApp. Seus dias organizados sem esforço.
                                  </p>
                                  <ul className="space-y-4 mb-10">
                                      {['Visualização por cores', 'Confirmação automática', 'Link para clientes'].map((item) => (
                                          <li key={item} className="flex items-center gap-3 text-stone-700">
                                              <CheckCircle className="w-5 h-5 text-[#bd7b65]" /> {item}
                                          </li>
                                      ))}
                                  </ul>
                              </>
                          )}

                          {activeDemoTab === 'financeiro' && (
                              <>
                                  <h3 className="text-4xl font-serif text-stone-900 mb-6">Finanças sob controle</h3>
                                  <p className="text-stone-600 mb-8 text-lg font-light leading-relaxed">
                                      Saiba exatamente quanto lucrou. O sistema calcula comissões automaticamente e elimina erros de caixa.
                                  </p>
                                  <ul className="space-y-4 mb-10">
                                      {['Cálculo de comissões', 'Fluxo de caixa', 'Relatórios de lucro'].map((item) => (
                                          <li key={item} className="flex items-center gap-3 text-stone-700">
                                              <CheckCircle className="w-5 h-5 text-[#bd7b65]" /> {item}
                                          </li>
                                      ))}
                                  </ul>
                              </>
                          )}

                          {activeDemoTab === 'retorno' && (
                              <>
                                  <h3 className="text-4xl font-serif text-stone-900 mb-6">Fidelização Automática</h3>
                                  <p className="text-stone-600 mb-8 text-lg font-light leading-relaxed">
                                      O Aura avisa quem sumiu e sugere a mensagem certa para trazê-los de volta. É venda acontecendo enquanto você dorme.
                                  </p>
                                  <ul className="space-y-4 mb-10">
                                      {['Alerta de inatividade', 'Sugestão de mensagem IA', 'Aumento de recorrência'].map((item) => (
                                          <li key={item} className="flex items-center gap-3 text-stone-700">
                                              <CheckCircle className="w-5 h-5 text-[#bd7b65]" /> {item}
                                          </li>
                                      ))}
                                  </ul>
                              </>
                          )}

                          <Link to="/login" className="bg-[#bd7b65] hover:bg-[#a66550] text-white px-8 py-3 rounded-full font-bold uppercase text-xs tracking-widest shadow-lg transition-all inline-flex items-center gap-2">
                              Começar Agora <ArrowRight className="w-4 h-4" />
                          </Link>
                      </div>

                      {/* Image Content */}
                      <div className="order-1 lg:order-2 lg:col-span-7 relative group flex items-center justify-center">
                          <div className="absolute inset-0 bg-[#bd7b65]/10 rounded-[2rem] transform rotate-2 scale-95 transition-all group-hover:rotate-1"></div>
                          <img 
                              src={
                                  activeDemoTab === 'dashboard' ? "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426" :
                                  activeDemoTab === 'agenda' ? "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&q=80&w=2539" :
                                  activeDemoTab === 'financeiro' ? "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=2666" :
                                  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426"
                              } 
                              alt={`Tela ${activeDemoTab}`}
                              className="relative z-10 w-full rounded-2xl shadow-2xl border border-stone-100 object-cover min-h-[300px] lg:min-h-[450px]"
                          />
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* SEÇÃO: ANTES VS DEPOIS (TRANSFORMAÇÃO) - Ambient Glow Rose Gold */}
      <section className="py-24 bg-white border-t border-stone-200 relative overflow-hidden">
          {/* Ambient Glow Effects (Rose Gold) */}
          <div className="absolute top-1/2 left-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-[#bd7b65] blur-[150px] rounded-full pointer-events-none opacity-10"></div>
          <div className="absolute top-1/2 right-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-[#bd7b65] blur-[150px] rounded-full pointer-events-none opacity-10"></div>

          <div className="max-w-[1200px] mx-auto px-6 lg:px-12 relative z-10">
              <div className="text-center mb-16">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3 block">Realidade vs Transformação</span>
                  <h2 className="text-4xl md:text-5xl font-serif text-stone-900 mb-6">
                      Antes vs Depois do <span className="italic text-[#bd7b65]">Aura System</span>
                  </h2>
                  <p className="text-lg text-stone-500 max-w-2xl mx-auto font-light">
                      Veja a diferença clara na rotina de quem profissionalizou a gestão.
                  </p>
              </div>

              <div className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2">
                      {/* Antes */}
                      <div className="p-8 md:p-12 border-b md:border-b-0 md:border-r border-stone-100 bg-stone-50/50">
                          <h3 className="text-xl font-bold text-stone-400 mb-8 flex items-center gap-2">
                              <XCircle className="w-6 h-6 text-stone-300" /> Antes (Sem Sistema)
                          </h3>
                          <ul className="space-y-8">
                              <li className="flex gap-4 opacity-70">
                                  <div className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center shrink-0 mt-0.5"><X className="w-3 h-3" /></div>
                                  <div>
                                      <strong className="block text-stone-700">Agendamentos no Papel/Zap</strong>
                                      <p className="text-sm text-stone-500 mt-1">Confusão, mensagens perdidas e horários duplicados.</p>
                                  </div>
                              </li>
                              <li className="flex gap-4 opacity-70">
                                  <div className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center shrink-0 mt-0.5"><X className="w-3 h-3" /></div>
                                  <div>
                                      <strong className="block text-stone-700">Faltas Constantes</strong>
                                      <p className="text-sm text-stone-500 mt-1">Cliente esquece, não avisa e você perde dinheiro.</p>
                                  </div>
                              </li>
                              <li className="flex gap-4 opacity-70">
                                  <div className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center shrink-0 mt-0.5"><X className="w-3 h-3" /></div>
                                  <div>
                                      <strong className="block text-stone-700">Financeiro Cego</strong>
                                      <p className="text-sm text-stone-500 mt-1">Não sabe o lucro real, mistura contas pessoais e da clínica.</p>
                                  </div>
                              </li>
                              <li className="flex gap-4 opacity-70">
                                  <div className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center shrink-0 mt-0.5"><X className="w-3 h-3" /></div>
                                  <div>
                                      <strong className="block text-stone-700">Clientes Sumidos</strong>
                                      <p className="text-sm text-stone-500 mt-1">Você esquece de chamar quem não volta há meses.</p>
                                  </div>
                              </li>
                          </ul>
                      </div>

                      {/* Depois */}
                      <div className="p-8 md:p-12 bg-white relative overflow-hidden">
                          <div className="absolute top-0 right-0 bg-[#bd7b65] text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-widest">Aura System</div>
                          <h3 className="text-xl font-bold text-[#bd7b65] mb-8 flex items-center gap-2">
                              <CheckCircle className="w-6 h-6" /> Depois (Com Aura)
                          </h3>
                          <ul className="space-y-8">
                              <li className="flex gap-4">
                                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                                  <div>
                                      <strong className="block text-stone-900">Agenda Online 100% Digital</strong>
                                      <p className="text-sm text-stone-500 mt-1">Link na bio, cliente agenda sozinho, zero confusão.</p>
                                  </div>
                              </li>
                              <li className="flex gap-4">
                                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                                  <div>
                                      <strong className="block text-stone-900">Confirmação Automática</strong>
                                      <p className="text-sm text-stone-500 mt-1">O sistema cobra confirmação no WhatsApp 24h antes.</p>
                                  </div>
                              </li>
                              <li className="flex gap-4">
                                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                                  <div>
                                      <strong className="block text-stone-900">Gestão Financeira Clara</strong>
                                      <p className="text-sm text-stone-500 mt-1">Cálculo de comissões, lucro e caixa em tempo real.</p>
                                  </div>
                              </li>
                              <li className="flex gap-4">
                                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                                  <div>
                                      <strong className="block text-stone-900">Resgate Inteligente (IA)</strong>
                                      <p className="text-sm text-stone-500 mt-1">O sistema avisa quem sumiu e sugere a mensagem de retorno.</p>
                                  </div>
                              </li>
                          </ul>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* Planos Section */}
      <section id="plans" className="py-24 bg-white relative z-10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-serif text-stone-900 mb-4">Investimento</h2>
            <p className="text-stone-500 font-light">Planos transparentes para cada fase do seu negócio.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {loadingPlans ? (
                <div className="col-span-3 text-center py-12">
                    <RefreshCw className="w-8 h-8 text-stone-300 animate-spin mx-auto mb-4" />
                    <p className="text-stone-400">Carregando planos...</p>
                </div>
            ) : sortedPlans.length > 0 ? (
                sortedPlans.map(plan => {
                    const isStarter = plan.id === 'starter' || plan.name.toLowerCase().includes('starter');
                    return (
                        <div 
                            key={plan.id}
                            className={`rounded-[2rem] p-8 border flex flex-col transition-all duration-300
                                ${isStarter 
                                    ? 'bg-white border-[#bd7b65] shadow-2xl shadow-[#bd7b65]/10 relative transform md:-translate-y-4 z-10' 
                                    : 'bg-white border-stone-200 hover:shadow-xl hover:border-stone-300'}
                            `}
                        >
                            {isStarter && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#bd7b65] text-white text-[10px] font-bold px-4 py-1.5 rounded-b-lg tracking-widest uppercase">
                                    Recomendado
                                </div>
                            )}
                            <h4 className="text-xl font-bold mb-2 mt-4 text-stone-900 capitalize">
                                {plan.name}
                            </h4>
                            <div className="flex items-baseline mb-8">
                                <span className="text-4xl font-serif font-bold text-stone-900">R$ {plan.price}</span>
                                <span className="text-stone-400 text-sm ml-1">/mês</span>
                            </div>
                            <ul className="space-y-4 mb-10 flex-1">
                                {plan.features.map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-stone-600">
                                        <CheckCircle className={`w-4 h-4 mt-0.5 ${isStarter ? 'text-[#bd7b65]' : 'text-stone-400'}`} /> 
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link 
                                to="/login"
                                className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wide text-center transition-all
                                    ${isStarter 
                                        ? 'bg-[#bd7b65] text-white hover:bg-[#a66550] shadow-lg' 
                                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}
                                `}
                            >
                                {isStarter ? 'Assinar Agora' : 'Começar Teste'}
                            </Link>
                        </div>
                    );
                })
            ) : (
                <div className="col-span-3 text-center py-12 text-stone-400">
                    Nenhum plano disponível no momento.
                </div>
            )}
          </div>
        </div>
      </section>

      {/* SEÇÃO: TECNOLOGIA E SEGURANÇA (Ambient Light Blue/Slate) */}
      <section className="py-24 bg-stone-50 relative overflow-hidden border-t border-stone-200">
          {/* Ambient Glows for Tech Section (Slate/Blue Tone - Matching Trust/Security) */}
          <div className="absolute top-1/2 left-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-slate-400 blur-[150px] rounded-full pointer-events-none opacity-15"></div>
          <div className="absolute top-1/2 right-[-20%] -translate-y-1/2 w-[700px] h-[700px] bg-slate-400 blur-[150px] rounded-full pointer-events-none opacity-15"></div>

          <div className="max-w-[1200px] mx-auto px-6 lg:px-12 relative z-10">
              <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-serif mb-4 text-stone-900">
                      Tecnologia e Segurança de Ponta
                  </h2>
                  <p className="text-stone-500 font-light max-w-2xl mx-auto">
                      Sua operação protegida com infraestrutura profissional e suporte dedicado.
                  </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {/* Card 1 */}
                  <div className="bg-white p-8 rounded-2xl border border-stone-200 hover:border-[#bd7b65]/30 hover:shadow-xl transition-all group">
                      <div className="w-14 h-14 bg-[#bd7b65]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                          <Shield className="w-7 h-7 text-[#bd7b65]" />
                      </div>
                      <h3 className="font-bold text-lg mb-3 text-stone-900">Segurança SSL</h3>
                      <p className="text-sm text-stone-500 leading-relaxed">
                          Criptografia de ponta a ponta. Seus dados e dos seus clientes blindados contra invasões.
                      </p>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-white p-8 rounded-2xl border border-stone-200 hover:border-[#bd7b65]/30 hover:shadow-xl transition-all group">
                      <div className="w-14 h-14 bg-[#bd7b65]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                          <Database className="w-7 h-7 text-[#bd7b65]" />
                      </div>
                      <h3 className="font-bold text-lg mb-3 text-stone-900">Backup Diário</h3>
                      <p className="text-sm text-stone-500 leading-relaxed">
                          Cópias automáticas todos os dias. Nunca perca um agendamento ou ficha de paciente.
                      </p>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-white p-8 rounded-2xl border border-stone-200 hover:border-[#bd7b65]/30 hover:shadow-xl transition-all group">
                      <div className="w-14 h-14 bg-[#bd7b65]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                          <Server className="w-7 h-7 text-[#bd7b65]" />
                      </div>
                      <h3 className="font-bold text-lg mb-3 text-stone-900">Uptime 99.9%</h3>
                      <p className="text-sm text-stone-500 leading-relaxed">
                          Servidores de alta performance. O sistema está sempre disponível quando você precisa.
                      </p>
                  </div>

                  {/* Card 4 */}
                  <div className="bg-white p-8 rounded-2xl border border-stone-200 hover:border-[#bd7b65]/30 hover:shadow-xl transition-all group">
                      <div className="w-14 h-14 bg-[#bd7b65]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                          <Headphones className="w-7 h-7 text-[#bd7b65]" />
                      </div>
                      <h3 className="font-bold text-lg mb-3 text-stone-900">Suporte Humanizado</h3>
                      <p className="text-sm text-stone-500 leading-relaxed">
                          Time real, não robôs. Atendimento rápido via WhatsApp para resolver qualquer dúvida.
                      </p>
                  </div>
              </div>
          </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-24 bg-white border-t border-stone-100">
          <div className="max-w-[900px] mx-auto px-6 lg:px-12">
              <div className="text-center mb-16">
                  <h2 className="text-4xl font-serif text-stone-900 mb-4">Dúvidas Frequentes</h2>
              </div>

              <div className="space-y-4">
                  {[
                      { q: "Preciso de um cartão para fazer o Teste gratuito?", a: "Não. Você pode criar sua conta e testar todas as funcionalidades por 7 dias sem inserir nenhum dado de pagamento." },
                      { q: "Posso mudar de plano depois?", a: "Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento diretamente pelo painel do sistema." },
                      { q: "Como funciona o cancelamento?", a: "Sem fidelidade. Você pode cancelar sua assinatura a qualquer momento e o acesso será interrompido ao final do ciclo pago." },
                      { q: "Quais são as formas de pagamento?", a: "Aceitamos cartões de crédito (Visa, Mastercard, Elo, Amex) e Boleto Bancário para planos anuais." },
                      { q: "Posso gerenciar múltiplas empresas?", a: "Sim. O sistema suporta múltiplas unidades. Entre em contato para condições especiais para redes." }
                  ].map((item, idx) => (
                      <div key={idx} className="border border-stone-200 rounded-2xl overflow-hidden transition-all hover:border-stone-300 bg-[#fbfaf9]">
                          <button 
                              onClick={() => toggleFaq(idx)}
                              className="w-full p-6 flex items-center justify-between text-left focus:outline-none"
                          >
                              <span className="font-bold text-stone-800">{item.q}</span>
                              {openFaqIndex === idx ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
                          </button>
                          {openFaqIndex === idx && (
                              <div className="px-6 pb-6 pt-0 text-stone-600 text-sm leading-relaxed animate-fade-in">
                                  {item.a}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-100 pt-20 pb-10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <AuraLogo className="w-8 h-8 opacity-80" type="full" />
              </div>
              <p className="text-sm text-stone-500 leading-relaxed font-light">
                Tecnologia e design unidos para a gestão de clínicas de alta performance.
              </p>
            </div>
            <div>
              <h5 className="font-bold text-stone-900 mb-6 text-sm uppercase tracking-wider">Produto</h5>
              <ul className="space-y-3 text-sm text-stone-500">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-[#bd7b65] transition-colors text-left bg-transparent border-none p-0 cursor-pointer">Funcionalidades</button></li>
                <li><button onClick={() => scrollToSection('plans')} className="hover:text-[#bd7b65] transition-colors text-left bg-transparent border-none p-0 cursor-pointer">Planos & Preços</button></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-stone-900 mb-6 text-sm uppercase tracking-wider">Empresa</h5>
              <ul className="space-y-3 text-sm text-stone-500">
                <li><button className="hover:text-[#bd7b65] transition-colors text-left bg-transparent border-none p-0 cursor-pointer">Sobre nós</button></li>
                <li><button className="hover:text-[#bd7b65] transition-colors text-left bg-transparent border-none p-0 cursor-pointer">Contato</button></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold text-stone-900 mb-6 text-sm uppercase tracking-wider">Legal</h5>
              <ul className="space-y-3 text-sm text-stone-500">
                <li><button className="hover:text-[#bd7b65] transition-colors text-left bg-transparent border-none p-0 cursor-pointer">Privacidade</button></li>
                <li><button className="hover:text-[#bd7b65] transition-colors text-left bg-transparent border-none p-0 cursor-pointer">Termos</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-stone-100 pt-8 text-center flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-xs text-stone-400 font-medium">&copy; {new Date().getFullYear()} Aura System. Todos os direitos reservados.</span>
            <div className="flex gap-6 text-stone-400">
               <Instagram className="w-5 h-5 cursor-pointer hover:text-[#bd7b65] transition-colors" />
               <Facebook className="w-5 h-5 cursor-pointer hover:text-[#bd7b65] transition-colors" />
               <Linkedin className="w-5 h-5 cursor-pointer hover:text-[#bd7b65] transition-colors" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
