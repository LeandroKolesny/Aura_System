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

const LP_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300;1,9..40,400&display=swap');

  .lp { font-family: 'DM Sans', system-ui, sans-serif; background: #fdfaf7; color: #1a1512; }
  .lp h1, .lp h2, .lp h3, .lp h4 { font-family: 'Cormorant Garamond', serif; }

  .reveal {
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1), transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .reveal.is-visible { opacity: 1; transform: translateY(0); }
  .rd1 { transition-delay: 80ms; }
  .rd2 { transition-delay: 160ms; }
  .rd3 { transition-delay: 240ms; }
  .rd4 { transition-delay: 320ms; }
  .rd5 { transition-delay: 400ms; }

  .lp-btn-solid {
    display: inline-flex; align-items: center; gap: 0.55rem;
    background: #bd7b65; color: #fff;
    font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase;
    padding: 0.85rem 2rem; border: none; border-radius: 1px;
    cursor: pointer; text-decoration: none;
    transition: background 0.25s, transform 0.25s;
  }
  .lp-btn-solid:hover { background: #a66550; transform: translateY(-1px); }

  .lp-btn-outline {
    display: inline-flex; align-items: center; gap: 0.55rem;
    background: transparent; color: #1a1512;
    font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase;
    padding: 0.85rem 2rem; border: 1px solid #d8cec8; border-radius: 1px;
    cursor: pointer; text-decoration: none;
    transition: border-color 0.25s, color 0.25s, transform 0.25s;
  }
  .lp-btn-outline:hover { border-color: #bd7b65; color: #bd7b65; transform: translateY(-1px); }

  .sec-label {
    display: block; font-family: 'DM Sans', sans-serif;
    font-size: 0.62rem; font-weight: 600; letter-spacing: 0.24em;
    text-transform: uppercase; color: #bd7b65; margin-bottom: 0.9rem;
  }

  .lp-pilar { cursor: default; transition: background 0.2s; }
  .lp-pilar:hover { background: rgba(189,123,101,0.03); }
  .pilar-num {
    font-family: 'Cormorant Garamond', serif; font-size: 4.5rem;
    font-weight: 300; line-height: 1; color: #e8ddd5;
    transition: color 0.3s;
  }
  .lp-pilar:hover .pilar-num { color: #bd7b65; }

  .lp-tab {
    font-family: 'DM Sans', sans-serif; font-size: 0.7rem; font-weight: 500;
    letter-spacing: 0.15em; text-transform: uppercase;
    padding: 0.8rem 0; border: none; background: none;
    color: #b0a49e; cursor: pointer; position: relative;
    transition: color 0.25s;
    display: inline-flex; align-items: center; gap: 0.5rem;
  }
  .lp-tab::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0;
    height: 1.5px; background: #bd7b65;
    transform: scaleX(0); transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
  }
  .lp-tab.active, .lp-tab:hover { color: #1a1512; }
  .lp-tab.active::after { transform: scaleX(1); }

  .lp-nav-link {
    font-family: 'DM Sans', sans-serif; font-size: 0.7rem; font-weight: 500;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: #6b5e54; background: none; border: none; cursor: pointer;
    transition: color 0.2s; text-decoration: none;
  }
  .lp-nav-link:hover { color: #bd7b65; }

  .faq-row { border-bottom: 1px solid #e8ddd5; }
  .faq-btn {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    padding: 1.4rem 0; background: none; border: none; cursor: pointer; text-align: left;
  }
  .img-frame {
    position: absolute; inset: 0;
    border: 1px solid #e0d0c5;
    transform: translate(14px, 14px); border-radius: 1px; z-index: 0;
    pointer-events: none;
  }
`;

const LandingPage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { saasPlans } = useApp();
  const navigate = useNavigate();

  const [activeDemoTab, setActiveDemoTab] = useState<'dashboard' | 'agenda' | 'financeiro' | 'retorno'>('dashboard');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const scrollToSection = (id: string) => {
    setIsMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleFaq = (i: number) => setOpenFaqIndex(openFaqIndex === i ? null : i);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const sortedPlans = [...saasPlans]
    .filter(p => p.active)
    .sort((a, b) => {
      const order = { starter: 1, pro: 2, clinic: 3 };
      return (order[a.id as keyof typeof order] || a.price || 9999) - (order[b.id as keyof typeof order] || b.price || 9999);
    });

  const S = {
    cream: '#fdfaf7',
    ink: '#1a1512',
    rose: '#bd7b65',
    roseLight: '#f5e8e0',
    muted: '#6b5e54',
    faint: '#a89890',
    border: '#e8ddd5',
    borderLight: '#efe8e2',
    white: '#ffffff',
    dark: '#1a1512',
    darkBorder: '#2a2018',
    darkMuted: '#6b5e54',
    darkFaint: '#4a3d35',
  };

  const serif = (size: string, weight = 400, extra = '') =>
    `font-family:'Cormorant Garamond',serif;font-size:${size};font-weight:${weight};${extra}`;
  const sans = (size: string, weight = 400, extra = '') =>
    `font-family:'DM Sans',sans-serif;font-size:${size};font-weight:${weight};${extra}`;

  return (
    <>
      <style>{LP_STYLES}</style>

      <div className="lp min-h-screen" style={{ background: S.cream }}>

        {/* ═══════════════ NAVBAR ═══════════════ */}
        <nav
          className="fixed w-full top-0 z-50 transition-all duration-500"
          style={{
            background: scrolled ? 'rgba(253,250,247,0.93)' : 'transparent',
            backdropFilter: scrolled ? 'blur(18px)' : 'none',
            borderBottom: scrolled ? `1px solid ${S.borderLight}` : '1px solid transparent',
          }}
        >
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="flex justify-between items-center h-[4.5rem]">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <AuraLogo className="w-8 h-8" type="full" />
              </div>

              <div className="hidden md:flex items-center gap-9">
                {[
                  { label: 'Funcionalidades', id: 'features' },
                  { label: 'Pilares', id: 'pillars' },
                  { label: 'Planos', id: 'plans' },
                  { label: 'Dúvidas', id: 'faq' },
                ].map(item => (
                  <button key={item.id} onClick={() => scrollToSection(item.id)} className="lp-nav-link">
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="hidden md:flex items-center gap-5">
                <Link to="/login" className="lp-nav-link">Login</Link>
                <Link to="/king" style={{ color: '#c8a04a', transition: 'transform 0.2s' }} title="Acesso King">
                  <Crown className="w-4 h-4" />
                </Link>
                <Link to="/login" className="lp-btn-solid">Teste Grátis</Link>
              </div>

              <div className="md:hidden">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ color: S.ink, background: 'none', border: 'none', cursor: 'pointer' }}>
                  {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {isMenuOpen && (
            <div className="md:hidden absolute w-full shadow-2xl p-6" style={{ background: S.cream, borderTop: `1px solid ${S.borderLight}` }}>
              <div className="flex flex-col gap-5 text-center">
                <button onClick={() => scrollToSection('features')} className="lp-nav-link">Funcionalidades</button>
                <button onClick={() => scrollToSection('plans')} className="lp-nav-link">Planos & Preços</button>
                <button onClick={() => scrollToSection('faq')} className="lp-nav-link">Dúvidas Frequentes</button>
                <div className="flex flex-col gap-3 pt-4" style={{ borderTop: `1px solid ${S.borderLight}` }}>
                  <Link to="/login" className="lp-nav-link" style={{ fontWeight: 600 }}>Entrar</Link>
                  <Link to="/login" className="lp-btn-solid" style={{ justifyContent: 'center' }}>Criar Conta Grátis</Link>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* ═══════════════ HERO ═══════════════ */}
        <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
          {/* Decorative radial glow */}
          <div
            className="absolute pointer-events-none"
            style={{
              right: '-8%', top: '50%', transform: 'translateY(-50%)',
              width: '60vw', height: '60vw', maxWidth: '860px', maxHeight: '860px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #f5e0d4 0%, rgba(253,250,247,0) 65%)',
              zIndex: 0,
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              right: '10%', top: '12%',
              width: '280px', height: '280px', borderRadius: '50%',
              border: '1px solid #e8d5c8', zIndex: 0, opacity: 0.45,
            }}
          />

          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 w-full relative z-10">
            <div
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
              style={{ minHeight: '88vh', paddingTop: '5rem', paddingBottom: '4rem' }}
            >
              {/* Left: Text */}
              <div className="lg:col-span-5 reveal">
                <div
                  className="inline-flex items-center gap-3 mb-10"
                  style={{ borderBottom: `1px solid ${S.border}`, paddingBottom: '1rem' }}
                >
                  <Sparkles className="w-3 h-3" style={{ color: S.rose }} />
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: S.faint, fontWeight: 600 }}>
                    Gestão Premium & Inteligência Artificial
                  </span>
                </div>

                <h1
                  className="reveal rd1"
                  style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(2.8rem,5vw,4.4rem)', fontWeight: 400, lineHeight: 1.06, color: S.ink, marginBottom: '1.75rem' }}
                >
                  Não somos<br />
                  apenas uma agenda.<br />
                  Somos um{' '}
                  <em style={{ color: S.rose, fontStyle: 'italic' }}>Ecossistema.</em>
                </h1>

                <p
                  className="reveal rd2"
                  style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '1rem', fontWeight: 300, color: S.muted, lineHeight: 1.8, maxWidth: '38ch', marginBottom: '2.5rem' }}
                >
                  Do agendamento à construção da sua marca: a única plataforma que une gestão, design e inteligência artificial em um só lugar.
                </p>

                <div className="flex flex-wrap gap-4 mb-10 reveal rd3">
                  <Link to="/login" className="lp-btn-solid">
                    Testar 7 Dias Grátis <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => scrollToSection('features')} className="lp-btn-outline">
                    <Smartphone className="w-3.5 h-3.5" /> Ver Demo
                  </button>
                </div>

                <p
                  className="reveal rd4"
                  style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.62rem', color: '#c0b4ae', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500 }}
                >
                  Cancele quando quiser · Suporte humanizado · Dados sempre seus
                </p>
              </div>

              {/* Right: Image */}
              <div className="lg:col-span-7 relative reveal rd2">
                <div className="img-frame" />
                <div className="relative z-10 overflow-hidden" style={{ borderRadius: '1px' }}>
                  <img
                    src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=2668&auto=format&fit=crop"
                    alt="Gestão de Clínica de Estética"
                    style={{ width: '100%', objectFit: 'cover', height: 'clamp(320px,50vh,580px)', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(26,21,18,0.18) 0%, transparent 55%)' }} />

                  {/* Floating: Notification */}
                  <div
                    className="absolute flex items-center gap-3"
                    style={{
                      top: '1.5rem', right: '1.5rem',
                      background: 'rgba(253,250,247,0.93)', backdropFilter: 'blur(14px)',
                      padding: '0.8rem 1.1rem', borderRadius: '1px',
                      border: '1px solid rgba(255,255,255,0.55)',
                      boxShadow: '0 8px 30px rgba(26,21,18,0.08)',
                      maxWidth: '250px',
                    }}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ border: `1.5px solid ${S.border}` }}>
                      <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80" alt="Beatriz" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: '0.78rem', color: S.ink }}>Beatriz Lima</p>
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.68rem', color: S.faint }}>Toxina Botulínica · 14:30</p>
                    </div>
                    <div className="ml-2 p-1.5 rounded-full" style={{ background: '#edf7f0' }}>
                      <CheckCircle className="w-3.5 h-3.5" style={{ color: '#3db870' }} />
                    </div>
                  </div>

                  {/* Floating: Revenue */}
                  <div
                    className="absolute flex items-center gap-4"
                    style={{
                      bottom: '1.5rem', left: '1.5rem',
                      background: 'rgba(253,250,247,0.93)', backdropFilter: 'blur(14px)',
                      padding: '0.9rem 1.25rem', borderRadius: '1px',
                      border: '1px solid rgba(255,255,255,0.55)',
                      boxShadow: '0 8px 30px rgba(26,21,18,0.08)',
                    }}
                  >
                    <div style={{ background: S.roseLight, borderRadius: '1px', padding: '0.6rem' }}>
                      <TrendingUp className="w-5 h-5" style={{ color: S.rose }} />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.58rem', color: S.faint, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600 }}>Receita Mensal</p>
                      <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.65rem', fontWeight: 600, color: S.ink, lineHeight: 1.1 }}>+ R$ 42.500</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ DORES / SOLUÇÕES ═══════════════ */}
        <section className="py-28" style={{ background: S.white, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="text-center max-w-2xl mx-auto mb-20 reveal">
              <span className="sec-label">Atenção ao seu negócio</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(2rem,4vw,3.4rem)', fontWeight: 400, color: S.ink, lineHeight: 1.2 }}>
                Enquanto você trabalha,{' '}
                <em style={{ color: '#c0392b', fontStyle: 'italic' }}>dinheiro escorre pelo ralo</em>
              </h2>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.95rem', fontWeight: 300, color: S.muted, lineHeight: 1.75, marginTop: '1rem' }}>
                A cada semana sem sistema, você perde clientes, tempo e dinheiro.
              </p>
            </div>

            <div className="space-y-5">
              {[
                {
                  problem: { icon: AlertTriangle, title: 'Cliente marca e não aparece', desc: 'Você bloqueia o horário, prepara a sala, e o cliente simplesmente some. Cadeira vazia é prejuízo irreparável.', stat: 'R$ 800+', unit: '/mês', label: 'Prejuízo Estimado' },
                  solution: { icon: CheckCircle, title: 'Confirmação Automática', desc: 'O sistema envia WhatsApp automático 24h antes. Se não confirmar, o horário é liberado para outro cliente.', stat: '80%', unit: 'menos faltas', label: 'Resultado' },
                },
                {
                  problem: { icon: Ghost, title: 'Clientes "Fantasmas"', desc: 'Aquela cliente fiel parou de vir e você nem notou. Sem CRM, ela vai para a concorrência.', stat: '30%', unit: 'da carteira', label: 'Perda Anual' },
                  solution: { icon: RefreshCw, title: 'Resgate Inteligente', desc: 'O Aura detecta quem sumiu há 45 dias e sugere uma mensagem carinhosa para trazê-la de volta.', stat: '40%', unit: 'recuperados', label: 'Resultado' },
                },
              ].map((row, i) => (
                <div key={i} className={`grid grid-cols-1 md:grid-cols-2 gap-5 reveal ${i > 0 ? 'rd1' : ''}`}>
                  <div style={{ background: '#fdf5f4', border: '1px solid #f0ddd9', padding: '2.25rem', borderRadius: '1px' }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div style={{ background: '#fee2df', padding: '0.55rem', borderRadius: '1px' }}>
                        <row.problem.icon className="w-4 h-4" style={{ color: '#c0392b' }} />
                      </div>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: S.faint }}>O Problema</span>
                    </div>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.75rem', fontWeight: 500, color: S.ink, marginBottom: '0.65rem' }}>{row.problem.title}</h3>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 300, color: S.muted, lineHeight: 1.75, marginBottom: '1.5rem' }}>{row.problem.desc}</p>
                    <div style={{ borderTop: '1px solid #f0ddd9', paddingTop: '1.1rem' }}>
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: S.faint, marginBottom: '0.3rem' }}>{row.problem.label}</p>
                      <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2rem', fontWeight: 500, color: S.ink }}>
                        {row.problem.stat}<span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', fontWeight: 300, color: S.faint, marginLeft: '0.35rem' }}>{row.problem.unit}</span>
                      </p>
                    </div>
                  </div>

                  <div style={{ background: '#f3fbf6', border: '1px solid #c8ead8', padding: '2.25rem', borderRadius: '1px' }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div style={{ background: '#d0f0e0', padding: '0.55rem', borderRadius: '1px' }}>
                        <row.solution.icon className="w-4 h-4" style={{ color: '#2b9e5e' }} />
                      </div>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#2b9e5e' }}>A Solução Aura</span>
                    </div>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.75rem', fontWeight: 500, color: S.ink, marginBottom: '0.65rem' }}>{row.solution.title}</h3>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 300, color: S.muted, lineHeight: 1.75, marginBottom: '1.5rem' }}>{row.solution.desc}</p>
                    <div style={{ borderTop: '1px solid #c8ead8', paddingTop: '1.1rem' }}>
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: S.faint, marginBottom: '0.3rem' }}>{row.solution.label}</p>
                      <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2rem', fontWeight: 500, color: '#2b9e5e' }}>
                        {row.solution.stat}<span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', fontWeight: 300, color: S.faint, marginLeft: '0.35rem' }}>{row.solution.unit}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ 4 PILARES — Editorial numbered list ═══════════════ */}
        <section id="pillars" className="py-28" style={{ background: S.cream, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
              <div className="lg:col-span-5 reveal">
                <span className="sec-label">Os fundamentos</span>
                <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(2rem,4vw,3.4rem)', fontWeight: 400, color: S.ink, lineHeight: 1.15 }}>
                  4 Pilares da{' '}
                  <em style={{ color: S.rose }}>Transformação</em>
                </h2>
              </div>
              <div className="lg:col-span-6 lg:col-start-7 lg:pt-8 reveal rd1">
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.95rem', fontWeight: 300, color: S.muted, lineHeight: 1.8 }}>
                  Enquanto outros sistemas só organizam sua agenda, nós construímos uma{' '}
                  <strong style={{ color: S.ink, fontWeight: 500 }}>marca premium completa</strong> para você.
                </p>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${S.border}` }}>
              {[
                { num: '01', label: 'Gestão & Operação', color: S.ink, desc: 'O básico bem feito. Agendamento, confirmações e financeiro rodando no piloto automático para você focar no atendimento.', items: ['Agenda Inteligente', 'Financeiro Automático', 'Controle de Estoque'], Icon: Smartphone },
                { num: '02', label: 'Growth & Vendas', color: S.rose, desc: 'O motor de dinheiro. Ferramentas ativas que trazem clientes de volta, aumentam o ticket médio e enchem sua agenda.', items: ['CRM de Vendas', 'Resgate de Inativos', 'Dashboard em Tempo Real'], Icon: TrendingUp },
                { num: '03', label: 'Branding & IA', color: '#7c5cbf', desc: 'Diferenciação pura. Inteligência artificial para encantar clientes e design que valoriza sua marca.', items: ['Resumos com IA', 'Pós-venda Personalizado', 'Galeria Antes & Depois'], Icon: Sparkles },
                { num: '04', label: 'Segurança & Suporte', color: '#3d7ea6', desc: 'Tranquilidade total. Seus dados protegidos, contratos digitais e um suporte que realmente resolve.', items: ['Termos Digitais', 'Prontuário Seguro', 'Backup Diário'], Icon: Shield },
              ].map((p, i) => (
                <div
                  key={p.num}
                  className="lp-pilar grid grid-cols-12 items-start gap-4 py-9 reveal"
                  style={{ borderBottom: `1px solid ${S.border}`, transitionDelay: `${i * 70}ms`, padding: '2.25rem 0.75rem' }}
                >
                  <div className="col-span-2 md:col-span-1">
                    <span className="pilar-num">{p.num}</span>
                  </div>
                  <div className="col-span-10 md:col-span-3 flex items-start gap-4 pt-1">
                    <div style={{ background: `${p.color}18`, padding: '0.6rem', borderRadius: '1px', flexShrink: 0 }}>
                      <p.Icon className="w-4.5 h-4.5" style={{ color: p.color, width: '1.1rem', height: '1.1rem' }} />
                    </div>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.55rem', fontWeight: 500, color: S.ink, lineHeight: 1.2 }}>{p.label}</h3>
                  </div>
                  <div className="col-span-12 md:col-span-5 pt-1 md:col-start-5">
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 300, color: S.muted, lineHeight: 1.75 }}>{p.desc}</p>
                  </div>
                  <div className="col-span-12 md:col-span-3 pt-1">
                    <ul className="space-y-2.5">
                      {p.items.map(item => (
                        <li key={item} className="flex items-center gap-2.5" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', color: S.muted }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ DEMO INTERATIVA ═══════════════ */}
        <section id="features" className="py-28" style={{ background: S.white, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="text-center mb-16 reveal">
              <span className="sec-label">Visão 360°</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 400, color: S.ink }}>
                Tour pelas <em style={{ color: S.rose }}>Funcionalidades</em>
              </h2>
            </div>

            <div className="flex flex-wrap justify-center gap-8 mb-14 reveal" style={{ borderBottom: `1px solid ${S.border}` }}>
              {[
                { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                { id: 'agenda', label: 'Agenda', icon: Calendar },
                { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
                { id: 'retorno', label: 'Retorno Automático', icon: RefreshCw },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDemoTab(tab.id as any)}
                  className={`lp-tab ${activeDemoTab === tab.id ? 'active' : ''}`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center reveal">
              <div className="lg:col-span-5 order-2 lg:order-1">
                <span className="sec-label">
                  {activeDemoTab === 'dashboard' ? 'Controle Total' : activeDemoTab === 'agenda' ? 'Agendamento' : activeDemoTab === 'financeiro' ? 'Financeiro' : 'Fidelização'}
                </span>

                {activeDemoTab === 'dashboard' && (
                  <>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2.4rem', fontWeight: 400, color: S.ink, lineHeight: 1.15, marginBottom: '1.1rem' }}>Controle total na palma da mão</h3>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.92rem', fontWeight: 300, color: S.muted, lineHeight: 1.8, marginBottom: '1.75rem' }}>
                      Veja faturamento, clientes novos e retenção em tempo real. Chega de "achismos", tome decisões baseadas em dados.
                    </p>
                    <ul className="space-y-3 mb-8">
                      {['Métricas financeiras claras', 'Análise de crescimento', 'Indicadores de performance'].map(item => (
                        <li key={item} className="flex items-center gap-3" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: S.ink }}>
                          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: S.rose }} /> {item}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {activeDemoTab === 'agenda' && (
                  <>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2.4rem', fontWeight: 400, color: S.ink, lineHeight: 1.15, marginBottom: '1.1rem' }}>Agenda Inteligente</h3>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.92rem', fontWeight: 300, color: S.muted, lineHeight: 1.8, marginBottom: '1.75rem' }}>
                      Adeus papel. Uma agenda visual, intuitiva e integrada ao WhatsApp. Seus dias organizados sem esforço.
                    </p>
                    <ul className="space-y-3 mb-8">
                      {['Visualização por cores', 'Confirmação automática', 'Link para clientes'].map(item => (
                        <li key={item} className="flex items-center gap-3" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: S.ink }}>
                          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: S.rose }} /> {item}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {activeDemoTab === 'financeiro' && (
                  <>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2.4rem', fontWeight: 400, color: S.ink, lineHeight: 1.15, marginBottom: '1.1rem' }}>Finanças sob controle</h3>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.92rem', fontWeight: 300, color: S.muted, lineHeight: 1.8, marginBottom: '1.75rem' }}>
                      Saiba exatamente quanto lucrou. O sistema calcula comissões automaticamente e elimina erros de caixa.
                    </p>
                    <ul className="space-y-3 mb-8">
                      {['Cálculo de comissões', 'Fluxo de caixa', 'Relatórios de lucro'].map(item => (
                        <li key={item} className="flex items-center gap-3" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: S.ink }}>
                          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: S.rose }} /> {item}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {activeDemoTab === 'retorno' && (
                  <>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2.4rem', fontWeight: 400, color: S.ink, lineHeight: 1.15, marginBottom: '1.1rem' }}>Fidelização Automática</h3>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.92rem', fontWeight: 300, color: S.muted, lineHeight: 1.8, marginBottom: '1.75rem' }}>
                      O Aura avisa quem sumiu e sugere a mensagem certa para trazê-los de volta. É venda acontecendo enquanto você dorme.
                    </p>
                    <ul className="space-y-3 mb-8">
                      {['Alerta de inatividade', 'Sugestão de mensagem IA', 'Aumento de recorrência'].map(item => (
                        <li key={item} className="flex items-center gap-3" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', color: S.ink }}>
                          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: S.rose }} /> {item}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <Link to="/login" className="lp-btn-solid">Começar Agora <ArrowRight className="w-3.5 h-3.5" /></Link>
              </div>

              <div className="lg:col-span-7 order-1 lg:order-2 relative">
                <div style={{ position: 'absolute', inset: 0, background: S.roseLight, borderRadius: '1px', transform: 'rotate(1.5deg) scale(0.97)', zIndex: 0 }} />
                <img
                  src={
                    activeDemoTab === 'dashboard' ? 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426' :
                    activeDemoTab === 'agenda' ? 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&q=80&w=2539' :
                    activeDemoTab === 'financeiro' ? 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=2666' :
                    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426'
                  }
                  alt={`Tela ${activeDemoTab}`}
                  style={{ position: 'relative', zIndex: 10, width: '100%', borderRadius: '1px', minHeight: '300px', maxHeight: '460px', objectFit: 'cover', border: `1px solid ${S.border}`, boxShadow: '0 24px 60px rgba(26,21,18,0.08)' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ ANTES vs DEPOIS ═══════════════ */}
        <section className="py-28" style={{ background: S.cream, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
            <div className="text-center mb-16 reveal">
              <span className="sec-label">Realidade vs Transformação</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 400, color: S.ink, lineHeight: 1.2 }}>
                Antes vs Depois do <em style={{ color: S.rose }}>Aura System</em>
              </h2>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.92rem', fontWeight: 300, color: S.muted, marginTop: '0.9rem' }}>
                Veja a diferença clara na rotina de quem profissionalizou a gestão.
              </p>
            </div>

            <div className="overflow-hidden reveal" style={{ border: `1px solid ${S.border}`, borderRadius: '1px' }}>
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-9 md:p-12" style={{ background: '#f8f5f2', borderRight: `1px solid ${S.border}` }}>
                  <h3 className="flex items-center gap-2 mb-8" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: S.faint }}>
                    <XCircle className="w-4 h-4" style={{ color: '#c0b0a8' }} /> Antes — Sem Sistema
                  </h3>
                  <ul className="space-y-7">
                    {[
                      { t: 'Agendamentos no Papel/Zap', d: 'Confusão, mensagens perdidas e horários duplicados.' },
                      { t: 'Faltas Constantes', d: 'Cliente esquece, não avisa e você perde dinheiro.' },
                      { t: 'Financeiro Cego', d: 'Não sabe o lucro real, mistura contas pessoais e da clínica.' },
                      { t: 'Clientes Sumidos', d: 'Você esquece de chamar quem não volta há meses.' },
                    ].map(item => (
                      <li key={item.t} className="flex gap-4" style={{ opacity: 0.6 }}>
                        <div className="w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center" style={{ background: '#fee2df' }}>
                          <X className="w-2.5 h-2.5" style={{ color: '#c0392b' }} />
                        </div>
                        <div>
                          <strong style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 500, color: S.muted, display: 'block' }}>{item.t}</strong>
                          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', fontWeight: 300, color: S.faint, marginTop: '0.2rem' }}>{item.d}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-9 md:p-12 relative" style={{ background: S.white }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, background: S.rose, color: S.white, fontSize: '0.52rem', fontFamily: "'DM Sans',sans-serif", fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', padding: '0.3rem 0.85rem' }}>
                    Aura System
                  </div>
                  <h3 className="flex items-center gap-2 mb-8" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: S.rose }}>
                    <CheckCircle className="w-4 h-4" /> Depois — Com Aura
                  </h3>
                  <ul className="space-y-7">
                    {[
                      { t: 'Agenda Online 100% Digital', d: 'Link na bio, cliente agenda sozinho, zero confusão.' },
                      { t: 'Confirmação Automática', d: 'O sistema cobra confirmação no WhatsApp 24h antes.' },
                      { t: 'Gestão Financeira Clara', d: 'Cálculo de comissões, lucro e caixa em tempo real.' },
                      { t: 'Resgate Inteligente (IA)', d: 'O sistema avisa quem sumiu e sugere a mensagem de retorno.' },
                    ].map(item => (
                      <li key={item.t} className="flex gap-4">
                        <div className="w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center" style={{ background: '#d4f0e0' }}>
                          <Check className="w-2.5 h-2.5" style={{ color: '#2b9e5e' }} />
                        </div>
                        <div>
                          <strong style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 500, color: S.ink, display: 'block' }}>{item.t}</strong>
                          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', fontWeight: 300, color: S.muted, marginTop: '0.2rem' }}>{item.d}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ PLANOS ═══════════════ */}
        <section id="plans" className="py-28" style={{ background: S.white, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="text-center max-w-2xl mx-auto mb-16 reveal">
              <span className="sec-label">Investimento</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 400, color: S.ink }}>
                Planos para cada fase do seu negócio
              </h2>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.92rem', fontWeight: 300, color: S.muted, marginTop: '0.9rem' }}>
                Planos transparentes para cada fase do seu negócio.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {sortedPlans.length > 0 ? sortedPlans.map((plan, idx) => {
                const isStarter = plan.id === 'starter' || plan.name.toLowerCase().includes('starter');
                return (
                  <div
                    key={plan.id}
                    className="flex flex-col reveal"
                    style={{
                      background: isStarter ? S.dark : S.white,
                      border: `1px solid ${isStarter ? S.dark : S.border}`,
                      padding: '2.5rem',
                      borderRadius: '1px',
                      transform: isStarter ? 'translateY(-10px)' : undefined,
                      transitionDelay: `${idx * 80}ms`,
                    }}
                  >
                    {isStarter && (
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: S.rose, marginBottom: '1rem' }}>
                        ★ Recomendado
                      </p>
                    )}
                    <h4 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: isStarter ? S.faint : S.muted, marginBottom: '0.85rem' }}>
                      {plan.name}
                    </h4>
                    <div className="flex items-baseline mb-8">
                      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '3rem', fontWeight: 400, color: isStarter ? S.white : S.ink, lineHeight: 1 }}>R$ {plan.price}</span>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', color: isStarter ? '#4a3d35' : S.faint, marginLeft: '0.4rem' }}>/mês</span>
                    </div>
                    <ul className="space-y-3 mb-10 flex-1">
                      {plan.features.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.82rem', fontWeight: 300, color: isStarter ? '#b0a49e' : S.muted }}>
                          <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: isStarter ? S.rose : '#c0b4ae' }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/login"
                      className="lp-btn-solid"
                      style={{
                        background: isStarter ? S.rose : 'transparent',
                        color: isStarter ? S.white : S.ink,
                        border: isStarter ? 'none' : `1px solid ${S.border}`,
                        justifyContent: 'center',
                        borderRadius: '1px',
                      }}
                    >
                      {isStarter ? 'Assinar Agora' : 'Começar Teste'}
                    </Link>
                  </div>
                );
              }) : (
                <div className="col-span-3 text-center py-12" style={{ fontFamily: "'DM Sans',sans-serif", color: S.faint }}>
                  Nenhum plano disponível no momento.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ═══════════════ TECNOLOGIA ═══════════════ */}
        <section className="py-24" style={{ background: S.cream, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
            <div className="text-center mb-16 reveal">
              <span className="sec-label">Infraestrutura</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(2rem,3.5vw,2.8rem)', fontWeight: 400, color: S.ink }}>
                Tecnologia e Segurança de Ponta
              </h2>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.92rem', fontWeight: 300, color: S.muted, marginTop: '0.9rem' }}>
                Sua operação protegida com infraestrutura profissional e suporte dedicado.
              </p>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 reveal"
              style={{ border: `1px solid ${S.border}`, borderRadius: '1px', overflow: 'hidden' }}
            >
              {[
                { Icon: Shield, title: 'Segurança SSL', desc: 'Criptografia de ponta a ponta. Seus dados e dos seus clientes blindados contra invasões.' },
                { Icon: Database, title: 'Backup Diário', desc: 'Cópias automáticas todos os dias. Nunca perca um agendamento ou ficha de paciente.' },
                { Icon: Server, title: 'Uptime 99.9%', desc: 'Servidores de alta performance. O sistema está sempre disponível quando você precisa.' },
                { Icon: Headphones, title: 'Suporte Humanizado', desc: 'Time real, não robôs. Atendimento rápido via WhatsApp para resolver qualquer dúvida.' },
              ].map((card, i) => (
                <div
                  key={card.title}
                  style={{
                    background: S.white,
                    borderRight: i < 3 ? `1px solid ${S.border}` : 'none',
                    padding: '2rem',
                    transition: 'background 0.25s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = S.cream)}
                  onMouseLeave={e => (e.currentTarget.style.background = S.white)}
                >
                  <div style={{ background: S.roseLight, padding: '0.65rem', borderRadius: '1px', width: 'fit-content', marginBottom: '1.25rem' }}>
                    <card.Icon className="w-5 h-5" style={{ color: S.rose }} />
                  </div>
                  <h3 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.9rem', fontWeight: 600, color: S.ink, marginBottom: '0.5rem' }}>{card.title}</h3>
                  <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', fontWeight: 300, color: S.muted, lineHeight: 1.7 }}>{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ FAQ ═══════════════ */}
        <section id="faq" className="py-28" style={{ background: S.white, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[760px] mx-auto px-6 lg:px-12">
            <div className="text-center mb-16 reveal">
              <span className="sec-label">Tire suas dúvidas</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 400, color: S.ink }}>
                Dúvidas Frequentes
              </h2>
            </div>

            <div className="reveal">
              {[
                { q: 'Preciso de um cartão para fazer o Teste gratuito?', a: 'Não. Você pode criar sua conta e testar todas as funcionalidades por 7 dias sem inserir nenhum dado de pagamento.' },
                { q: 'Posso mudar de plano depois?', a: 'Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento diretamente pelo painel do sistema.' },
                { q: 'Como funciona o cancelamento?', a: 'Sem fidelidade. Você pode cancelar sua assinatura a qualquer momento e o acesso será interrompido ao final do ciclo pago.' },
                { q: 'Quais são as formas de pagamento?', a: 'Aceitamos cartões de crédito (Visa, Mastercard, Elo, Amex) e Boleto Bancário para planos anuais.' },
                { q: 'Posso gerenciar múltiplas empresas?', a: 'Sim. O sistema suporta múltiplas unidades. Entre em contato para condições especiais para redes.' },
              ].map((item, idx) => (
                <div key={idx} className="faq-row">
                  <button className="faq-btn" onClick={() => toggleFaq(idx)}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.92rem', fontWeight: 500, color: S.ink }}>
                      <em style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1rem', color: S.rose, marginRight: '0.85rem' }}>
                        {String(idx + 1).padStart(2, '0')}.
                      </em>
                      {item.q}
                    </span>
                    {openFaqIndex === idx
                      ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: S.rose }} />
                      : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: S.faint }} />}
                  </button>
                  {openFaqIndex === idx && (
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 300, color: S.muted, lineHeight: 1.8, paddingBottom: '1.25rem', paddingLeft: '2.5rem' }}>
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ FOOTER ═══════════════ */}
        <footer style={{ background: S.dark, borderTop: `1px solid ${S.darkBorder}` }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
              <div className="col-span-2 md:col-span-1">
                <div className="mb-5">
                  <AuraLogo className="w-7 h-7 opacity-60" type="full" />
                </div>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', fontWeight: 300, color: S.darkMuted, lineHeight: 1.75 }}>
                  Tecnologia e design unidos para a gestão de clínicas de alta performance.
                </p>
              </div>

              {[
                { title: 'Produto', links: [{ label: 'Funcionalidades', action: () => scrollToSection('features') }, { label: 'Planos & Preços', action: () => scrollToSection('plans') }] },
                { title: 'Empresa', links: [{ label: 'Sobre nós', action: () => {} }, { label: 'Contato', action: () => {} }] },
                { title: 'Legal', links: [{ label: 'Privacidade', action: () => {} }, { label: 'Termos', action: () => {} }] },
              ].map(col => (
                <div key={col.title}>
                  <h5 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: S.darkFaint, marginBottom: '1.25rem' }}>{col.title}</h5>
                  <ul className="space-y-3">
                    {col.links.map(link => (
                      <li key={link.label}>
                        <button
                          onClick={link.action}
                          style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.82rem', fontWeight: 300, color: S.darkMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.2s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = S.rose)}
                          onMouseLeave={e => (e.currentTarget.style.color = S.darkMuted)}
                        >
                          {link.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8" style={{ borderTop: `1px solid ${S.darkBorder}` }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.7rem', color: S.darkFaint, letterSpacing: '0.05em' }}>
                © {new Date().getFullYear()} Aura System. Todos os direitos reservados.
              </span>
              <div className="flex gap-5">
                {[Instagram, Facebook, Linkedin].map((Icon, i) => (
                  <Icon
                    key={i}
                    className="w-4 h-4 cursor-pointer"
                    style={{ color: S.darkFaint, transition: 'color 0.2s' }}
                    onMouseEnter={(e: any) => (e.currentTarget.style.color = S.rose)}
                    onMouseLeave={(e: any) => (e.currentTarget.style.color = S.darkFaint)}
                  />
                ))}
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
};

export default LandingPage;
