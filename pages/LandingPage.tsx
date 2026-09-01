import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Smartphone, CheckCircle, ArrowRight, Menu, X, Sparkles, Shield,
  TrendingUp, Mail, MapPin, Phone, Instagram, Facebook, Linkedin,
  Crown, AlertTriangle, Ghost, BarChart3, RefreshCw,
  Calendar, DollarSign, Star, Check, Zap, Play, Plus, Twitter,
  XCircle,
} from 'lucide-react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';
import AuraLogo from '../components/AuraLogo';

const LandingDemoPlayer = React.lazy(() => import('../components/LandingDemoPlayer'));
const demoPlayerFallback = (
  <div style={{ width: '100%', aspectRatio: '720 / 440', background: '#f0edea' }} />
);
import { useApp } from '../context/AppContext';

/* ══ Palette type ══════════════════════════════════════════════ */
interface ColorPalette {
  cream: string; ink: string; rose: string; roseLight: string;
  muted: string; faint: string; border: string; borderLight: string;
  white: string; dark: string; darkBorder: string; darkMuted: string; darkFaint: string;
}
type StyleFn = (size: string, weight?: number, extra?: React.CSSProperties) => React.CSSProperties;

/* ══ ROI Calculator ════════════════════════════════════════════ */
const ROICalculator: React.FC<{ S: ColorPalette; serif: StyleFn; sans: StyleFn }> = ({ S, serif, sans }) => {
  const [appointments, setAppointments] = useState(100);
  const [noShowRate, setNoShowRate] = useState(15);
  const [avgTicket, setAvgTicket] = useState(150);
  const monthlyLoss = (appointments * (noShowRate / 100)) * avgTicket;
  const recoveredWithSaaS = monthlyLoss * 0.8;
  return (
    <div className="lp-card" style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem' }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h3 style={{ ...serif('1.8rem', 700), color: S.ink, marginBottom: '1.5rem' }}>Simule sua Economia</h3>
          <p style={{ ...sans('0.95rem'), color: S.muted, marginBottom: '2rem' }}>
            Descubra quanto faturamento você está deixando na mesa e quanto o Aura pode recuperar para você.
          </p>
          <div className="space-y-6">
            {[
              { label: 'Agendamentos / Mês', val: appointments, set: setAppointments, min: 10, max: 1000, step: 10, fmt: (v: number) => String(v) },
              { label: 'Taxa de Faltas (No-show) %', val: noShowRate, set: setNoShowRate, min: 1, max: 50, step: 1, fmt: (v: number) => `${v}%` },
              { label: 'Ticket Médio (R$)', val: avgTicket, set: setAvgTicket, min: 50, max: 1000, step: 10, fmt: (v: number) => `R$ ${v}` },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between mb-2">
                  <label style={{ ...sans('0.85rem', 600), color: S.ink }}>{item.label}</label>
                  <span style={{ color: S.rose, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{item.fmt(item.val)}</span>
                </div>
                <input type="range" min={item.min} max={item.max} step={item.step} value={item.val}
                  onChange={e => item.set(Number(e.target.value))} className="w-full accent-rose-500" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center p-8 rounded-3xl" style={{ background: S.cream, border: `1px solid ${S.border}` }}>
          <div className="text-center mb-8">
            <p style={{ ...sans('0.85rem', 600), color: S.faint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Perda Mensal Atual</p>
            <p style={{ ...serif('2.5rem', 800), color: S.ink }}>R$ {monthlyLoss.toLocaleString('pt-BR')}</p>
          </div>
          <div className="text-center p-6 rounded-2xl" style={{ background: S.white, boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            <p style={{ ...sans('0.85rem', 600), color: '#2b9e5e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recuperado com Aura</p>
            <p style={{ ...serif('3rem', 800), color: '#2b9e5e' }}>R$ {recoveredWithSaaS.toLocaleString('pt-BR')}</p>
            <p style={{ ...sans('0.8rem'), color: S.muted, marginTop: '0.5rem' }}>
              Economia anual de R$ {(recoveredWithSaaS * 12).toLocaleString('pt-BR')}
            </p>
          </div>
          <Link to="/login" className="lp-btn-solid w-full mt-8" style={{ justifyContent: 'center' }}>
            Quero recuperar meu lucro <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
};

/* ══ Hero Blobs ════════════════════════════════════════════════ */
const HeroBlobs: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
    <div className="blob-b absolute" style={{ left: '-10%', top: '-20%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, rgba(189,123,101,0.18) 0%, rgba(189,123,101,0.06) 40%, transparent 70%)', filter: 'blur(40px)' }} />
    <div className="blob-c absolute" style={{ right: '-5%', top: '10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle at 70% 30%, rgba(124,92,191,0.14) 0%, rgba(124,92,191,0.04) 40%, transparent 70%)', filter: 'blur(40px)' }} />
    <div className="blob-a absolute" style={{ left: '20%', bottom: '-20%', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%, rgba(43,158,94,0.07) 0%, rgba(43,158,94,0.02) 40%, transparent 70%)', filter: 'blur(60px)' }} />
  </div>
);

/* ══ Animated Counter ══════════════════════════════════════════ */
const AnimatedCounter: React.FC<{ value: number; prefix?: string; suffix?: string; duration?: number }> = ({
  value, prefix = '', suffix = '', duration = 2.2,
}) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(value);
      return;
    }
    const durationMs = duration * 1000;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value, duration]);
  return <span ref={ref}>{prefix}{count}{suffix}</span>;
};

/* ══ LP Styles ═════════════════════════════════════════════════ */
const LP_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');

  .lp { font-family: 'Inter', system-ui, sans-serif; background: #fdfbf9; color: #1a1512; }
  .lp h1, .lp h2, .lp h3, .lp h4 { font-family: 'Outfit', sans-serif; }

  .reveal {
    opacity: 0; transform: translateY(28px);
    transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1), transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .reveal.is-visible { opacity: 1; transform: translateY(0); }
  .rd1 { transition-delay: 80ms; } .rd2 { transition-delay: 160ms; }
  .rd3 { transition-delay: 240ms; } .rd4 { transition-delay: 320ms; }

  .lp-btn-solid {
    display: inline-flex; align-items: center; gap: 0.55rem;
    background: #bd7b65; color: #fff;
    font-family: 'Inter', sans-serif; font-size: 0.88rem; font-weight: 600;
    padding: 1rem 2.5rem; border: none; border-radius: 9999px;
    cursor: pointer; text-decoration: none;
    transition: all 0.3s ease;
    box-shadow: 0 4px 14px rgba(189,123,101,0.30);
  }
  .lp-btn-solid:hover { background: #a66550; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(189,123,101,0.40); }

  .lp-btn-outline {
    display: inline-flex; align-items: center; gap: 0.55rem;
    background: transparent; color: #1a1512;
    font-family: 'Inter', sans-serif; font-size: 0.88rem; font-weight: 600;
    padding: 1rem 2.5rem; border: 2px solid #e8e0da; border-radius: 9999px;
    cursor: pointer; text-decoration: none; transition: all 0.3s ease;
  }
  .lp-btn-outline:hover { border-color: #bd7b65; color: #bd7b65; transform: translateY(-2px); }

  .lp-card {
    background: #ffffff; border-radius: 28px; padding: 1.8rem 2.2rem;
    border: 1px solid #f0edea;
    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 8px 30px rgba(26,21,18,0.03);
  }
  .lp-card:hover { transform: translateY(-8px); box-shadow: 0 25px 50px rgba(189,123,101,0.12); border-color: rgba(189,123,101,0.25); }

  .lp-card-dark {
    background: #1a1512; border-radius: 28px; padding: 2.2rem;
    color: #ffffff; border: 1px solid #2a2420;
    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .lp-card-dark:hover { transform: translateY(-8px); box-shadow: 0 25px 50px rgba(0,0,0,0.3); border-color: rgba(189,123,101,0.25); }

  .vibrant-blob {
    position: absolute; border-radius: 50%;
    filter: blur(100px); z-index: 0; pointer-events: none; opacity: 0.10;
  }

  .sec-label {
    display: block; font-family: 'Inter', sans-serif;
    font-size: 0.62rem; font-weight: 600; letter-spacing: 0.24em;
    text-transform: uppercase; color: #bd7b65; margin-bottom: 0.9rem;
  }

  .lp-tab {
    font-family: 'Inter', sans-serif; font-size: 0.7rem; font-weight: 500;
    letter-spacing: 0.15em; text-transform: uppercase;
    padding: 0.8rem 0; border: none; background: none;
    color: #b0a49e; cursor: pointer; position: relative;
    transition: color 0.25s; display: inline-flex; align-items: center; gap: 0.5rem;
  }
  .lp-tab::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0;
    height: 1.5px; background: #bd7b65;
    transform: scaleX(0); transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
  }
  .lp-tab.active, .lp-tab:hover { color: #1a1512; }
  .lp-tab.active::after { transform: scaleX(1); }

  .lp-nav-link {
    font-family: 'Inter', sans-serif; font-size: 0.88rem; font-weight: 500;
    color: #6b5e54; background: none; border: none; cursor: pointer;
    transition: color 0.2s; text-decoration: none;
  }
  .lp-nav-link:hover { color: #bd7b65; }

  .faq-row { border-bottom: 1px solid #e8e0da; }
  .faq-btn {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    padding: 1.4rem 0; background: none; border: none; cursor: pointer; text-align: left;
  }

  @keyframes blobFloat {
    0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
    33% { transform: translate(10px, -16px) rotate(4deg) scale(1.04); }
    66% { transform: translate(-8px, 10px) rotate(-3deg) scale(0.97); }
  }
  @keyframes blobFloat2 {
    0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
    33% { transform: translate(-12px, 10px) rotate(-5deg) scale(1.05); }
    66% { transform: translate(8px, -8px) rotate(3deg) scale(0.96); }
  }
  .blob-a { animation: blobFloat 9s ease-in-out infinite; }
  .blob-b { animation: blobFloat2 11s ease-in-out infinite; animation-delay: -4s; }
  .blob-c { animation: blobFloat 13s ease-in-out infinite; animation-delay: -7s; }

  .tcard {
    transition: transform 0.55s cubic-bezier(0.16,1,0.3,1), opacity 0.55s cubic-bezier(0.16,1,0.3,1),
                filter 0.55s cubic-bezier(0.16,1,0.3,1);
  }
  .tcard-active { opacity: 1 !important; transform: scale(1) translateY(0) !important; filter: none !important; z-index: 2; }
  .tcard-side { opacity: 0.42 !important; transform: scale(0.91) translateY(14px) !important; filter: blur(0.5px) !important; z-index: 1; }
  .tcard-far { opacity: 0.2 !important; transform: scale(0.84) translateY(22px) !important; filter: blur(1.5px) !important; z-index: 0; }
  .tdot { border: none; cursor: pointer; padding: 0; transition: all 0.3s cubic-bezier(0.16,1,0.3,1); }
`;

/* ══════════════════════════════════════════════════════════════ */
/*  LANDING PAGE                                                   */
/* ══════════════════════════════════════════════════════════════ */
const LandingPage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const { saasPlans, loadPlans }    = useApp();
  const navigate                    = useNavigate();

  const [activeFeature, setActiveFeature] = useState(0);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [openFaqIndex, setOpenFaqIndex]   = useState<number | null>(null);
  const [testimonialIndex, setTestimonialIndex] = useState(1);

  const scrollToSection = (id: string) => {
    setIsMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { loadPlans(); }, [loadPlans]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [saasPlans]);

  useEffect(() => {
    const t = setInterval(() => setTestimonialIndex(p => (p + 1) % 3), 4500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = featureRefs.current.findIndex(r => r === entry.target);
          if (idx !== -1) setActiveFeature(idx);
        }
      }),
      { threshold: 0.5, rootMargin: '-10% 0px -35% 0px' }
    );
    featureRefs.current.forEach(r => r && obs.observe(r));
    return () => obs.disconnect();
  }, []);

  const sortedPlans = [...saasPlans]
    .filter(p => p.active)
    .sort((a, b) => {
      const freeA = a.price === 0 || a.name.toLowerCase().includes('free') || a.name.toLowerCase().includes('gratu');
      const freeB = b.price === 0 || b.name.toLowerCase().includes('free') || b.name.toLowerCase().includes('gratu');
      if (freeA && !freeB) return -1;
      if (!freeA && freeB) return 1;
      const order: Record<string, number> = { starter: 2, pro: 3, clinic: 4 };
      return (order[a.id] ?? a.price ?? 9999) - (order[b.id] ?? b.price ?? 9999);
    });

  const S: ColorPalette = {
    cream: '#fdfbf9', ink: '#1a1512', rose: '#bd7b65', roseLight: '#fdf8f6',
    muted: '#4a4440', faint: '#a39c97', border: '#f0edea', borderLight: '#f7f4f2',
    white: '#ffffff', dark: '#1a1512', darkBorder: '#2a2420',
    darkMuted: '#a39c97', darkFaint: '#7a7470',
  };

  const serif: StyleFn = (size, weight = 400, extra = {}) => ({ fontFamily: "'Outfit', sans-serif", fontSize: size, fontWeight: weight, ...extra });
  const sans:  StyleFn = (size, weight = 400, extra = {}) => ({ fontFamily: "'Inter', sans-serif",  fontSize: size, fontWeight: weight, ...extra });

  /* ── helpers rápidos ──────────────────────────────────────── */
  const isPro     = (plan: typeof saasPlans[0]) => plan.id === 'pro'    || plan.name.toLowerCase().includes('pro');
  const isClinic  = (plan: typeof saasPlans[0]) => plan.id === 'clinic' || plan.name.toLowerCase().includes('clinic');
  const isFree    = (plan: typeof saasPlans[0]) => plan.price === 0     || plan.name.toLowerCase().match(/free|gratu/);
  const isHighlight = (plan: typeof saasPlans[0], idx: number) =>
    isPro(plan) || (!isFree(plan) && !isClinic(plan) && idx === Math.floor(sortedPlans.length / 2));

  return (
    <>
      <style>{LP_STYLES}</style>
      <div className="lp min-h-screen" style={{ background: S.cream }}>

        {/* ══════════ NAVBAR ══════════════════════════════════════ */}
        <nav className="fixed w-full top-0 z-50 transition-all duration-500" style={{
          background: scrolled ? 'rgba(253,251,249,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? `1px solid ${S.border}` : '1px solid transparent',
          padding: scrolled ? '0.5rem 0' : '1rem 0',
        }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="flex justify-between items-center h-[4.5rem]">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <AuraLogo className="w-8 h-8" type="full" />
              </div>
              <div className="hidden md:flex items-center gap-10">
                {[{ label: 'Funcionalidades', id: 'features' }, { label: 'Calculadora', id: 'roi' }, { label: 'Planos', id: 'plans' }, { label: 'Dúvidas', id: 'faq' }].map(item => (
                  <button key={item.id} onClick={() => scrollToSection(item.id)} className="lp-nav-link">{item.label}</button>
                ))}
              </div>
              <div className="hidden md:flex items-center gap-6">
                <Link to="/login" className="lp-nav-link">Login</Link>
                <Link to="/king" style={{ color: '#c8a04a', transition: 'transform 0.2s' }} title="Acesso King"><Crown className="w-4 h-4" /></Link>
                <Link to="/login" className="lp-btn-solid" style={{ padding: '0.75rem 1.75rem' }}>Teste Grátis</Link>
              </div>
              <div className="md:hidden">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ color: S.ink, background: 'none', border: 'none', cursor: 'pointer' }}>
                  {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>
          {isMenuOpen && (
            <div className="md:hidden absolute w-full shadow-2xl p-8" style={{ background: S.cream, borderTop: `1px solid ${S.border}` }}>
              <div className="flex flex-col gap-6 text-center">
                {[['Funcionalidades', 'features'], ['Calculadora', 'roi'], ['Planos', 'plans'], ['Dúvidas', 'faq']].map(([label, id]) => (
                  <button key={id} onClick={() => scrollToSection(id)} className="lp-nav-link">{label}</button>
                ))}
                <div className="flex flex-col gap-4 pt-6" style={{ borderTop: `1px solid ${S.border}` }}>
                  <Link to="/login" className="lp-nav-link" style={{ fontWeight: 600 }}>Entrar</Link>
                  <Link to="/login" className="lp-btn-solid" style={{ justifyContent: 'center' }}>Criar Conta Grátis</Link>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* ══════════ HERO ════════════════════════════════════════ */}
        <section className="relative pt-36 pb-20 overflow-hidden" style={{ background: S.cream }}>
          <HeroBlobs />
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 w-full relative z-10 text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8" style={{ background: `${S.rose}10`, border: `1px solid ${S.rose}20` }}>
                <Sparkles size={14} color={S.rose} />
                <span style={{ ...sans('0.75rem', 600), color: S.rose, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  #1 Plataforma para Clínicas de Estética
                </span>
              </div>
              <h1 style={{ ...serif('clamp(2.8rem, 8vw, 5.2rem)', 800), color: S.ink, lineHeight: 1, letterSpacing: '-0.04em', maxWidth: '1000px', margin: '0 auto 2rem' }}>
                Não somos apenas uma agenda.<br />
                Somos um <span style={{ color: S.rose }}>Ecossistema.</span>
              </h1>
              <p style={{ ...sans('clamp(1.1rem, 2vw, 1.3rem)', 300), color: S.muted, maxWidth: '680px', margin: '0 auto 3.5rem', lineHeight: 1.65 }}>
                Do agendamento à construção da sua marca: a única plataforma que une gestão, design e inteligência artificial para clínicas premium.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-20">
                <Link to="/login" className="lp-btn-solid" style={{ fontSize: '1rem', padding: '1.25rem 3rem' }}>
                  Começar Agora — É Grátis
                </Link>
                <button onClick={() => scrollToSection('features')} className="lp-btn-outline" style={{ background: S.white, fontSize: '1rem', padding: '1.25rem 3rem' }}>
                  <Play size={18} fill="currentColor" /> Ver Demonstração
                </button>
              </div>
              <div className="pt-16 border-t" style={{ borderColor: S.border }}>
                <p style={{ ...sans('0.75rem', 600), color: S.faint, marginBottom: '2.5rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                  Confiado por clínicas de estética em todo o Brasil
                </p>
                <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-8 opacity-25 grayscale">
                  {['VOGUE BEAUTY', 'GLAMOUR', 'SAÚDE & ESTÉTICA', 'BEAUTY BUSINESS', 'FORBES'].map(brand => (
                    <span key={brand} style={{ ...serif('1.4rem', 800), color: S.ink, letterSpacing: '-0.02em' }}>{brand}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══════════ STATS ════════════════════════════════════════ */}
        <section className="py-24" style={{ background: S.ink }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
              {[
                { value: 847, prefix: '', suffix: '+', label: 'Clínicas Ativas' },
                { value: 98, prefix: '', suffix: '%', label: 'Taxa de Satisfação' },
                { value: 12, prefix: 'R$ ', suffix: 'M+', label: 'Gerenciados/mês' },
                { value: 3, prefix: '', suffix: ' min', label: 'Setup Inicial' },
              ].map((s, idx) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}>
                  <div style={{ ...serif('clamp(2rem, 4vw, 3rem)', 800), color: S.rose, marginBottom: '0.5rem', letterSpacing: '-0.04em' }}>
                    <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} />
                  </div>
                  <p style={{ ...sans('0.85rem', 500), color: S.darkMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ DORES / SOLUÇÕES ═════════════════════════════ */}
        <section className="py-32 relative overflow-hidden" style={{ background: S.white }}>
          <div className="vibrant-blob" style={{ top: '-10%', right: '-5%', width: '600px', height: '600px', background: S.rose }} />
          <div className="vibrant-blob" style={{ bottom: '10%', left: '-10%', width: '500px', height: '500px', background: '#7c5cbf' }} />
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-24 reveal">
              <span className="sec-label">O Problema vs. A Solução Aura</span>
              <h2 style={{ ...serif('clamp(2.2rem, 5vw, 3.8rem)', 800), color: S.ink, lineHeight: 1.1, letterSpacing: '-0.04em' }}>
                Enquanto você trabalha, <span style={{ color: '#c0392b' }}>dinheiro escorre pelo ralo.</span>
              </h2>
              <p style={{ ...sans('1.1rem', 300), color: S.muted, lineHeight: 1.6, marginTop: '1.5rem' }}>
                A cada semana sem sistema, você perde clientes, tempo e dinheiro.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {[
                { type: 'problem', title: 'Cliente marca e não aparece', desc: 'Você bloqueia o horário, prepara a sala e o cliente simplesmente some. Cadeira vazia é prejuízo irreparável.', stat: 'R$ 800+', unit: '/mês', label: 'Prejuízo Estimado', bg: 'rgba(255,245,244,0.5)', border: '#f0ddd9', iconBg: '#fee2df', iconColor: '#be185d', Icon: AlertTriangle, tag: 'O Problema' },
                { type: 'solution', title: 'Confirmação Automática', desc: 'O sistema envia WhatsApp automático 24h antes. Se não confirmar, o horário é liberado para outro cliente.', stat: '80%', unit: 'menos faltas', label: 'Resultado', bg: 'rgba(243,251,246,0.5)', border: '#c8ead8', iconBg: '#d0f0e0', iconColor: '#2b9e5e', Icon: CheckCircle, tag: 'A Solução Aura' },
                { type: 'problem', title: 'Clientes "Fantasmas"', desc: 'Aquela cliente fiel parou de vir e você nem notou. Sem CRM, ela vai para a concorrência.', stat: '30%', unit: 'da carteira', label: 'Perda Anual', bg: 'rgba(255,245,244,0.5)', border: '#f0ddd9', iconBg: '#fee2df', iconColor: '#be185d', Icon: AlertTriangle, tag: 'O Problema' },
                { type: 'solution', title: 'Resgate Inteligente com IA', desc: 'O Aura detecta quem sumiu há 45 dias e sugere uma mensagem carinhosa para trazê-la de volta.', stat: '40%', unit: 'recuperados', label: 'Resultado', bg: 'rgba(243,251,246,0.5)', border: '#c8ead8', iconBg: '#d0f0e0', iconColor: '#2b9e5e', Icon: CheckCircle, tag: 'A Solução Aura' },
              ].map((card, i) => (
                <div key={i} className={`lp-card reveal ${i > 0 ? 'rd1' : ''}`} style={{ background: card.bg, borderColor: card.border, display: 'flex', flexDirection: 'column' }}>
                  <div className="flex items-center gap-3 mb-6">
                    <div style={{ background: card.iconBg, padding: '0.5rem', borderRadius: '8px' }}><card.Icon size={18} color={card.iconColor} /></div>
                    <span style={{ ...sans('0.65rem', 700), letterSpacing: '0.1em', textTransform: 'uppercase', color: card.type === 'problem' ? S.faint : card.iconColor }}>{card.tag}</span>
                  </div>
                  <h3 style={{ ...serif('1.4rem', 700), color: S.ink, marginBottom: '0.75rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{card.title}</h3>
                  <p style={{ ...sans('0.88rem', 300), color: S.muted, lineHeight: 1.65, marginBottom: '1.5rem', flexGrow: 1 }}>{card.desc}</p>
                  <div className="pt-5 border-t" style={{ borderColor: card.border }}>
                    <p style={{ ...sans('0.65rem', 600), color: S.faint, marginBottom: '0.4rem', textTransform: 'uppercase' }}>{card.label}</p>
                    <p style={{ ...serif('1.8rem', 800), color: card.type === 'problem' ? S.ink : card.iconColor }}>{card.stat}<span style={{ ...sans('0.75rem', 400), color: S.faint, marginLeft: '0.4rem' }}>{card.unit}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ BENTO FEATURES ════════════════════════════════ */}
        <section id="features" className="py-32 relative overflow-hidden" style={{ background: S.ink }}>
          <div className="vibrant-blob" style={{ top: '20%', left: '10%', width: '400px', height: '400px', background: S.rose, opacity: 0.08 }} />
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
            <div className="text-center mb-20 reveal">
              <span className="sec-label" style={{ color: S.rose }}>Funcionalidades Elite</span>
              <h2 style={{ ...serif('clamp(2.5rem, 5vw, 4rem)', 800), color: S.white, lineHeight: 1.1, letterSpacing: '-0.04em' }}>
                Tudo que você precisa para <span style={{ color: S.rose }}>dominar o mercado.</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <div className="md:col-span-2 lg:col-span-2 row-span-2 lp-card-dark p-10 flex flex-col justify-between" style={{ background: '#2a2420', border: '1px solid #3a3430' }}>
                <div>
                  <div style={{ background: `${S.rose}20`, padding: '0.75rem', borderRadius: '12px', width: 'fit-content', marginBottom: '2rem' }}>
                    <Calendar style={{ color: S.rose }} size={28} />
                  </div>
                  <h3 style={{ ...serif('2.2rem', 700), color: S.white, marginBottom: '1rem' }}>Agenda Inteligente</h3>
                  <p style={{ ...sans('1.1rem', 300), color: S.darkMuted, lineHeight: 1.6 }}>
                    Não é apenas uma agenda. É um sistema de confirmação ativa via WhatsApp que reduz o no-show em até 80% sem você tocar no celular.
                  </p>
                </div>
                <div className="mt-12 p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <span style={{ ...sans('0.8rem', 600), color: S.darkFaint }}>Taxa de Ocupação</span>
                    <span style={{ ...sans('0.8rem', 700), color: '#2b9e5e' }}>+45% este mês</span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ width: '85%', background: S.rose }} />
                  </div>
                </div>
              </div>
              {[
                { Icon: TrendingUp, color: '#7c5cbf', bg: '#7c5cbf20', title: 'CRM de Vendas', desc: 'Recupere clientes inativos e gerencie leads automaticamente.' },
                { Icon: BarChart3, color: '#3d7ea6', bg: '#3d7ea620', title: 'Financeiro Real', desc: 'DRE, fluxo de caixa e comissões calculadas em tempo real. Sem planilhas.' },
              ].map(item => (
                <div key={item.title} className="lp-card-dark p-8" style={{ background: '#2a2420', border: '1px solid #3a3430' }}>
                  <div style={{ background: item.bg, padding: '0.6rem', borderRadius: '10px', width: 'fit-content', marginBottom: '1.5rem' }}>
                    <item.Icon style={{ color: item.color }} size={20} />
                  </div>
                  <h3 style={{ ...serif('1.5rem', 700), color: S.white, marginBottom: '0.75rem' }}>{item.title}</h3>
                  <p style={{ ...sans('0.9rem', 300), color: S.darkMuted, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
              <div className="md:col-span-2 lp-card-dark p-8 flex items-center gap-8" style={{ background: '#2a2420', border: '1px solid #3a3430' }}>
                <div style={{ background: '#2b9e5e20', padding: '1rem', borderRadius: '16px' }}>
                  <Shield style={{ color: '#2b9e5e' }} size={32} />
                </div>
                <div>
                  <h3 style={{ ...serif('1.5rem', 700), color: S.white, marginBottom: '0.5rem' }}>Segurança & LGPD</h3>
                  <p style={{ ...sans('0.9rem', 300), color: S.darkMuted, lineHeight: 1.5 }}>
                    Dados dos seus pacientes protegidos com criptografia e backups diários. Conformidade LGPD total.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ ROI CALCULATOR ════════════════════════════════ */}
        <section id="roi" className="py-32 relative overflow-hidden" style={{ background: S.cream }}>
          <div className="vibrant-blob" style={{ bottom: '10%', left: '5%', width: '400px', height: '400px', background: S.rose, opacity: 0.05 }} />
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-20 reveal">
              <span className="sec-label">Calculadora de Lucro</span>
              <h2 style={{ ...serif('clamp(2.2rem, 5vw, 3.5rem)', 800), color: S.ink, lineHeight: 1.1, letterSpacing: '-0.04em' }}>
                Quanto você está <span style={{ color: S.rose }}>deixando na mesa?</span>
              </h2>
            </div>
            <ROICalculator S={S} serif={serif} sans={sans} />
          </div>
        </section>

        {/* ══════════ CTA CENTRAL ═══════════════════════════════════
            Cores originais (#1a1512 bg, #bd7b65 rose) + fonte Outfit/Inter
        ══════════════════════════════════════════════════════════════ */}
        <section style={{ background: '#1a1512', padding: '5rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(189,123,101,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <span className="sec-label" style={{ color: 'rgba(189,123,101,0.8)' }}>Comece hoje</span>
            <h2 className="reveal" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(2.2rem,5vw,4rem)', fontWeight: 700, color: '#fdfbf9', lineHeight: 1.1, marginBottom: '1.25rem', letterSpacing: '-0.03em' }}>
              Pare de perder dinheiro.<br />
              <em style={{ color: '#bd7b65', fontStyle: 'italic', fontWeight: 800 }}>Comece agora, em 3 minutos.</em>
            </h2>
            <p className="reveal rd1" style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 300, color: '#a39c97', lineHeight: 1.8, maxWidth: '48ch', margin: '0 auto 2rem' }}>
              7 dias grátis, sem cartão de crédito. Configure sua clínica em minutos e veja a agenda cheia ainda essa semana.
            </p>
            <div className="reveal rd1" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
              {['✓ Sem fidelidade', '✓ Cancele quando quiser', '✓ Dados sempre seus', '✓ Suporte humanizado'].map(s => (
                <span key={s} style={{ fontFamily: "'Inter',sans-serif", fontSize: '0.72rem', color: '#7a7470', letterSpacing: '0.08em' }}>{s}</span>
              ))}
            </div>
            <div className="reveal rd2" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
              <Link to="/login" className="lp-btn-solid" style={{ borderRadius: '9999px', fontSize: '0.9rem', padding: '1rem 2.5rem' }}>
                Testar 7 Dias Grátis <ArrowRight className="w-4 h-4" />
              </Link>
              <button onClick={() => scrollToSection('plans')} className="lp-btn-outline" style={{ borderRadius: '9999px', borderColor: 'rgba(255,255,255,0.12)', color: '#a39c97', fontSize: '0.9rem', padding: '1rem 2.5rem' }}>
                Ver Planos & Preços
              </button>
            </div>
            <p className="reveal rd3" style={{ fontFamily: "'Inter',sans-serif", fontSize: '0.65rem', color: '#4a4440', marginTop: '1.25rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              847 clínicas já transformaram sua gestão
            </p>
          </div>
        </section>

        {/* ══════════ TOUR PELAS FUNCIONALIDADES (scrollytelling) ════ */}
        {(() => {
          const features = [
            { id: 'f0', label: 'Dashboard', Icon: BarChart3, secLabel: 'Controle Total', title: 'Controle total na palma da mão', desc: 'Veja faturamento, clientes novos e retenção em tempo real. Chega de "achismos", tome decisões baseadas em dados.', items: ['Métricas financeiras claras', 'Análise de crescimento', 'Indicadores de performance'] },
            { id: 'f1', label: 'Agenda', Icon: Calendar, secLabel: 'Agendamento', title: 'Agenda Inteligente', desc: 'Adeus papel. Uma agenda visual, intuitiva e integrada ao WhatsApp. Seus dias organizados sem esforço.', items: ['Visualização por cores', 'Confirmação automática', 'Link para clientes'] },
            { id: 'f2', label: 'Financeiro', Icon: DollarSign, secLabel: 'Financeiro', title: 'Finanças sob controle', desc: 'Saiba exatamente quanto lucrou. O sistema calcula comissões automaticamente e elimina erros de caixa.', items: ['Cálculo de comissões', 'Fluxo de caixa', 'Relatórios de lucro'] },
            { id: 'f3', label: 'Retorno Automático', Icon: RefreshCw, secLabel: 'Fidelização', title: 'Fidelização Automática', desc: 'O Aura avisa quem sumiu e sugere a mensagem certa para trazê-los de volta. É venda acontecendo enquanto você dorme.', items: ['Alerta de inatividade', 'Sugestão de mensagem IA', 'Aumento de recorrência'] },
          ];
          return (
            <section id="tour" style={{ background: S.white, borderTop: `1px solid ${S.borderLight}` }}>
              <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pt-20 pb-10">
                <div className="text-center reveal">
                  <span className="sec-label">Visão 360°</span>
                  <h2 style={{ ...serif('clamp(2rem,4vw,3.2rem)', 700), color: S.ink }}>
                    Tour pelas <em style={{ color: S.rose, fontStyle: 'italic' }}>Funcionalidades</em>
                  </h2>
                </div>
                <div className="flex flex-wrap justify-center gap-8 mt-10" style={{ borderBottom: `1px solid ${S.border}` }}>
                  {features.map((f, i) => (
                    <button key={f.id} onClick={() => featureRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={`lp-tab ${activeFeature === i ? 'active' : ''}`}>
                      <f.Icon className="w-3.5 h-3.5" />{f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-w-[1400px] mx-auto px-6 lg:px-12 pb-20">
                {/* Desktop: scrollytelling */}
                <div className="hidden lg:grid" style={{ gridTemplateColumns: '5fr 7fr', gap: '5rem', alignItems: 'start' }}>
                  <div>
                    {features.map((f, i) => (
                      <div key={f.id} ref={el => { featureRefs.current[i] = el; }} style={{ minHeight: '75vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '4rem', paddingBottom: '4rem', opacity: activeFeature === i ? 1 : 0.28, transition: 'opacity 0.5s ease' }}>
                        <span className="sec-label">{f.secLabel}</span>
                        <h3 style={{ ...serif('2.5rem', 700), color: S.ink, lineHeight: 1.15, marginBottom: '1rem', letterSpacing: '-0.03em' }}>{f.title}</h3>
                        <p style={{ ...sans('0.92rem', 300), color: S.muted, lineHeight: 1.8, marginBottom: '1.75rem', maxWidth: '38ch' }}>{f.desc}</p>
                        <ul className="space-y-3 mb-8">
                          {f.items.map(item => (
                            <li key={item} className="flex items-center gap-3" style={{ ...sans('0.85rem'), color: S.ink }}>
                              <CheckCircle className="w-4 h-4 shrink-0" style={{ color: S.rose }} />{item}
                            </li>
                          ))}
                        </ul>
                        {activeFeature === i && (
                          <Link to="/login" className="lp-btn-solid" style={{ width: 'fit-content' }}>
                            Começar Agora <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ position: 'sticky', top: '96px' }}>
                    <motion.div key={activeFeature} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 32px 64px rgba(26,21,18,0.13), 0 4px 16px rgba(26,21,18,0.07)', border: `1px solid ${S.border}` }}>
                      <React.Suspense fallback={demoPlayerFallback}>
                        <LandingDemoPlayer key={activeFeature} tabIndex={activeFeature} />
                      </React.Suspense>
                    </motion.div>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '1.25rem' }}>
                      {features.map((_, i) => (
                        <button key={i} onClick={() => featureRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })} style={{ height: '3px', borderRadius: '2px', border: 'none', cursor: 'pointer', padding: 0, width: activeFeature === i ? '28px' : '12px', background: activeFeature === i ? S.rose : S.border, transition: 'all 0.35s ease' }} />
                      ))}
                    </div>
                  </div>
                </div>
                {/* Mobile: linear */}
                <div className="lg:hidden">
                  {features.map((f, i) => (
                    <div key={f.id} style={{ paddingTop: '3rem', paddingBottom: '3rem', borderBottom: i < 3 ? `1px solid ${S.borderLight}` : 'none' }}>
                      <span className="sec-label">{f.secLabel}</span>
                      <h3 style={{ ...serif('2rem', 700), color: S.ink, lineHeight: 1.15, marginBottom: '0.9rem', letterSpacing: '-0.03em' }}>{f.title}</h3>
                      <p style={{ ...sans('0.9rem', 300), color: S.muted, lineHeight: 1.8, marginBottom: '1.5rem' }}>{f.desc}</p>
                      {/* Demo animado no mobile */}
                      <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 16px 40px rgba(26,21,18,0.10), 0 2px 8px rgba(26,21,18,0.06)', border: `1px solid ${S.border}` }}>
                        <React.Suspense fallback={demoPlayerFallback}>
                          <LandingDemoPlayer tabIndex={i} />
                        </React.Suspense>
                      </div>
                      <ul className="space-y-2">
                        {f.items.map(item => (
                          <li key={item} className="flex items-center gap-3" style={{ ...sans('0.82rem'), color: S.ink }}>
                            <CheckCircle className="w-4 h-4 shrink-0" style={{ color: S.rose }} />{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <Link to="/login" className="lp-btn-solid">Começar Agora <ArrowRight className="w-3.5 h-3.5" /></Link>
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ══════════ ANTES vs DEPOIS ═══════════════════════════════ */}
        <section className="hidden md:block py-28" style={{ background: 'rgba(189,123,101,0.055)', borderTop: `1px solid rgba(189,123,101,0.12)` }}>
          <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
            <div className="text-center mb-16 reveal">
              <span className="sec-label">Realidade vs Transformação</span>
              <h2 style={{ ...serif('clamp(2rem,4vw,3.2rem)', 700), color: S.ink, lineHeight: 1.2 }}>
                Antes vs Depois do <em style={{ color: S.rose }}>Aura System</em>
              </h2>
              <p style={{ ...sans('0.92rem', 300), color: S.muted, marginTop: '0.9rem' }}>
                Veja a diferença clara na rotina de quem profissionalizou a gestão.
              </p>
            </div>
            <div className="overflow-hidden reveal" style={{ border: `1px solid ${S.border}`, borderRadius: '12px' }}>
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-9 md:p-12" style={{ background: '#f8f5f2', borderRight: `1px solid ${S.border}` }}>
                  <h3 className="flex items-center gap-2 mb-8" style={{ ...sans('0.62rem', 700), letterSpacing: '0.22em', textTransform: 'uppercase', color: S.faint }}>
                    <XCircle className="w-4 h-4" style={{ color: '#c0b0a8' }} /> Antes — Sem Sistema
                  </h3>
                  <ul className="space-y-7">
                    {[
                      { t: 'Agendamentos no Papel/Zap', d: 'Confusão, mensagens perdidas e horários duplicados.' },
                      { t: 'Faltas Constantes', d: 'Cliente esquece, não avisa e você perde dinheiro.' },
                      { t: 'Financeiro Cego', d: 'Não sabe o lucro real, mistura contas pessoais e da clínica.' },
                      { t: 'Clientes Sumidos', d: 'Você esquece de chamar quem não volta há meses.' },
                    ].map(item => (
                      <li key={item.t} className="flex gap-4">
                        <div className="w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center" style={{ background: '#fee2df' }}>
                          <X className="w-2.5 h-2.5" style={{ color: '#be185d' }} />
                        </div>
                        <div>
                          <strong style={{ ...sans('0.88rem', 500), color: S.muted, display: 'block' }}>{item.t}</strong>
                          <p style={{ ...sans('0.8rem', 300), color: S.faint, marginTop: '0.2rem' }}>{item.d}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-9 md:p-12 relative" style={{ background: S.white }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, background: S.rose, color: S.white, fontSize: '0.52rem', fontFamily: "'Inter',sans-serif", fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', padding: '0.3rem 0.85rem' }}>
                    Aura System
                  </div>
                  <h3 className="flex items-center gap-2 mb-8" style={{ ...sans('0.62rem', 700), letterSpacing: '0.22em', textTransform: 'uppercase', color: S.rose }}>
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
                          <strong style={{ ...sans('0.88rem', 500), color: S.ink, display: 'block' }}>{item.t}</strong>
                          <p style={{ ...sans('0.8rem', 300), color: S.muted, marginTop: '0.2rem' }}>{item.d}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ DEPOIMENTOS ═══════════════════════════════════ */}
        <section className="py-12 md:py-28 relative overflow-hidden" style={{ background: `linear-gradient(175deg, ${S.cream} 0%, #f8f2ee 50%, ${S.cream} 100%)`, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="blob-a absolute pointer-events-none" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '80vw', height: '70%', borderRadius: '50% 50% 40% 60% / 40% 60% 40% 60%', background: 'radial-gradient(ellipse at 50% 50%, rgba(189,123,101,0.06) 0%, transparent 65%)' }} />
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12" style={{ position: 'relative', zIndex: 1 }}>
            <div className="text-center mb-10 md:mb-16 reveal">
              <span className="sec-label">Premium Testimonials</span>
              <h2 style={{ ...serif('clamp(2rem,4vw,3.2rem)', 700), color: S.ink }}>
                Clínicas que <em style={{ color: S.rose }}>cresceram</em> com o Aura
              </h2>
            </div>
            {(() => {
              const testimonials = [
                { quote: 'Antes eu perdia em média 8 consultas por mês por faltas. Hoje, com a confirmação automática, praticamente zerou. Em 3 meses recuperei o investimento do plano.', name: 'Dra. Carolina Menezes', role: 'Clínica de Estética · São Paulo, SP', result: '−92% em faltas', initials: 'CM', avatarColors: ['rgba(189,123,101,0.28)', 'rgba(189,123,101,0.08)'] },
                { quote: 'O módulo de Resgate com IA foi surreal. Mandei mensagem para 15 pacientes inativas e 9 voltaram na mesma semana. É como ter uma recepcionista trabalhando 24h.', name: 'Renata Oliveira', role: 'Studio de Beleza · Curitiba, PR', result: '60% de retorno', initials: 'RO', avatarColors: ['rgba(124,92,191,0.24)', 'rgba(124,92,191,0.07)'] },
                { quote: 'Finalmente sei exatamente quanto lucrei, quanto gastei e quanto cada profissional produziu. O financeiro automático mudou completamente a gestão do meu negócio.', name: 'Juliana Ferreira', role: 'Espaço de Dermato Estética · Belo Horizonte, MG', result: '+35% de receita', initials: 'JF', avatarColors: ['rgba(61,126,166,0.26)', 'rgba(61,126,166,0.08)'] },
              ];
              return (
                <>
                  <div className="reveal" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', padding: '1rem 0 2rem' }}>
                    {testimonials.map((t, i) => {
                      const dist = Math.abs(i - testimonialIndex);
                      const isActive = i === testimonialIndex;
                      return (
                        <div key={i} className={`tcard ${dist === 0 ? 'tcard-active' : dist === 1 ? 'tcard-side' : 'tcard-far'}`}
                          onClick={() => setTestimonialIndex(i)}
                          style={{ flexShrink: 0, width: isActive ? 'min(420px, 44vw)' : 'min(280px, 28vw)', background: S.white, border: isActive ? `1.5px solid rgba(189,123,101,0.35)` : `1px solid ${S.border}`, borderRadius: '20px', padding: isActive ? '2.25rem' : '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', boxShadow: isActive ? '0 24px 60px rgba(26,21,18,0.10), 0 4px 16px rgba(189,123,101,0.12)' : '0 4px 16px rgba(26,21,18,0.04)', cursor: !isActive ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }}>
                          {isActive && <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', borderRadius: '0 20px 0 120px', background: 'radial-gradient(ellipse at 80% 20%, rgba(189,123,101,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />}
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ width: isActive ? '64px' : '48px', height: isActive ? '64px' : '48px', borderRadius: '50%', background: `radial-gradient(135deg, ${t.avatarColors[0]} 0%, ${t.avatarColors[1]} 100%)`, border: isActive ? `2px solid rgba(189,123,101,0.3)` : `1.5px solid ${S.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit',sans-serif", fontSize: isActive ? '1.35rem' : '1rem', fontWeight: 700, color: S.rose, boxShadow: isActive ? '0 4px 20px rgba(189,123,101,0.18)' : 'none', transition: 'all 0.55s cubic-bezier(0.16,1,0.3,1)' }}>{t.initials}</div>
                          </div>
                          {isActive && <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>{Array.from({ length: 5 }).map((_, si) => <Star key={si} className="w-3.5 h-3.5" style={{ color: '#f4b942', fill: '#f4b942' }} />)}</div>}
                          <blockquote style={{ fontFamily: "'Inter',sans-serif", fontSize: isActive ? '0.9rem' : '0.78rem', fontWeight: 300, color: S.muted, lineHeight: 1.8, margin: 0, textAlign: isActive ? 'center' : 'left', display: '-webkit-box', WebkitLineClamp: isActive ? 99 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{t.quote}"</blockquote>
                          <div style={{ textAlign: 'center', paddingTop: isActive ? '0.75rem' : '0.25rem', borderTop: `1px solid ${S.borderLight}` }}>
                            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: isActive ? '0.88rem' : '0.78rem', fontWeight: 600, color: S.ink }}>{t.name}</div>
                            {isActive && <div style={{ fontFamily: "'Inter',sans-serif", fontSize: '0.72rem', fontWeight: 300, color: S.faint, marginTop: '0.2rem' }}>{t.role}</div>}
                          </div>
                          {isActive && (
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <div style={{ background: `${S.rose}15`, border: `1px solid ${S.rose}30`, borderRadius: '20px', padding: '0.3rem 0.9rem' }}>
                                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: '0.62rem', fontWeight: 700, color: S.rose, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.result}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    {testimonials.map((_, i) => (
                      <button key={i} className="tdot" onClick={() => setTestimonialIndex(i)} style={{ width: testimonialIndex === i ? '24px' : '8px', height: '8px', borderRadius: '4px', background: testimonialIndex === i ? S.rose : S.border }} />
                    ))}
                  </div>
                  <div className="hidden md:flex" style={{ justifyContent: 'center', gap: '1rem' }}>
                    {[{ label: '‹', fn: () => setTestimonialIndex(p => (p - 1 + 3) % 3) }, { label: '›', fn: () => setTestimonialIndex(p => (p + 1) % 3) }].map(btn => (
                      <button key={btn.label} onClick={btn.fn} style={{ width: '40px', height: '40px', borderRadius: '50%', border: `1px solid ${S.border}`, background: S.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.muted, fontFamily: 'sans-serif', fontSize: '1rem' }}>{btn.label}</button>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </section>

        {/* ══════════ PLANOS ════════════════════════════════════════ */}
        <section id="plans" className="py-32 relative overflow-hidden" style={{ background: S.cream }}>
          <div className="vibrant-blob" style={{ top: '10%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '400px', background: S.rose, opacity: 0.05 }} />
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-20 reveal">
              <span className="sec-label">Planos & Preços</span>
              <h2 style={{ ...serif('clamp(2.5rem, 5vw, 4rem)', 800), color: S.ink, lineHeight: 1.1, letterSpacing: '-0.04em' }}>
                Escolha o plano ideal para o seu <span style={{ color: S.rose }}>momento.</span>
              </h2>
              <p style={{ ...sans('1.15rem', 300), color: S.muted, lineHeight: 1.6, marginTop: '1.5rem' }}>
                Preços transparentes, sem taxas escondidas. Cancele quando quiser.
              </p>
            </div>
            {sortedPlans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                {sortedPlans.map((plan, idx) => {
                  const highlight = isHighlight(plan, idx);
                  return (
                    <div key={plan.id} className={highlight ? 'lp-card' : 'lp-card-dark'} style={{ display: 'flex', flexDirection: 'column', background: highlight ? S.rose : '#1a1512', borderColor: highlight ? S.rose : '#2a2420', color: '#fff', padding: '3.5rem 2.5rem', position: 'relative', overflow: 'hidden' }}>
                      {highlight && (
                        <div style={{ position: 'absolute', top: '1.5rem', right: '-2.5rem', background: '#fff', color: S.rose, padding: '0.25rem 3rem', transform: 'rotate(45deg)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}>POPULAR</div>
                      )}
                      <h3 style={{ ...serif('1.5rem', 700), marginBottom: '0.5rem', letterSpacing: '-0.02em', color: '#fff' }}>{plan.name}</h3>
                      <div className="flex items-baseline gap-1 mb-6">
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.25rem', fontWeight: 500 }}>R$</span>
                        <span style={{ ...serif('3.5rem', 800), letterSpacing: '-0.04em' }}>{plan.price}</span>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', opacity: 0.7 }}>/mês</span>
                      </div>
                      <div className="flex-grow">
                        <ul className="space-y-4 mb-10">
                          {plan.features.map((f: string) => (
                            <li key={f} className="flex items-center gap-3" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>
                              <Check size={18} color={highlight ? '#fff' : S.rose} />{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button className="lp-btn-solid" style={{ width: '100%', justifyContent: 'center', background: highlight ? '#fff' : S.rose, color: highlight ? S.rose : '#fff', boxShadow: 'none' }}
                        onClick={() => { localStorage.setItem('pendingPlan', JSON.stringify({ planId: plan.id, planName: plan.name, price: plan.price })); navigate('/login?redirect=checkout'); }}>
                        Assinar Agora
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ textAlign: 'center', ...sans('1rem'), color: S.faint }}>Carregando planos...</p>
            )}
            <p className="text-center mt-12" style={{ ...sans('0.9rem'), color: S.faint }}>
              Todos os planos incluem 7 dias grátis para teste. Cancele a qualquer momento.
            </p>
          </div>
        </section>

        {/* ══════════ FAQ ═══════════════════════════════════════════ */}
        <section id="faq" className="py-32 relative overflow-hidden" style={{ background: S.white, borderTop: `1px solid ${S.border}` }}>
          <div className="vibrant-blob" style={{ bottom: '-10%', right: '-5%', width: '400px', height: '400px', background: '#7c5cbf', opacity: 0.05 }} />
          <div className="max-w-[1000px] mx-auto px-6 lg:px-12 relative z-10">
            <div className="text-center mb-20 reveal">
              <span className="sec-label">FAQ</span>
              <h2 style={{ ...serif('clamp(2.2rem, 5vw, 3.5rem)', 800), color: S.ink, lineHeight: 1.1, letterSpacing: '-0.04em' }}>
                Dúvidas <span style={{ color: S.rose }}>Frequentes.</span>
              </h2>
            </div>
            <div className="space-y-4">
              {[
                { q: 'Como funciona o período de teste grátis?', a: 'Você tem acesso total a todas as funcionalidades do plano Pro por 7 dias. Não pedimos cartão de crédito para começar.' },
                { q: 'Posso mudar de plano a qualquer momento?', a: 'Sim! Você pode fazer upgrade ou downgrade do seu plano diretamente pelo painel de controle, com ajuste pro-rata automático.' },
                { q: 'Meus dados e os de meus pacientes estão seguros?', a: 'Utilizamos criptografia de ponta a ponta e backups diários. O sistema é 100% aderente à LGPD.' },
                { q: 'Funciona pelo celular?', a: 'Sim. O Aura é totalmente responsivo e funciona em qualquer dispositivo — celular, tablet ou computador.' },
                { q: 'Oferecem suporte para migração de dados?', a: 'Com certeza. Nossa equipe ajuda você a importar seus dados de outros sistemas de forma rápida e segura.' },
              ].map((item, i) => (
                <div key={i} className="lp-card" style={{ padding: '1.5rem 2rem' }}>
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.05rem', fontWeight: 600, color: S.ink }}>
                        <span style={{ color: S.rose, marginRight: '1rem', opacity: 0.5 }}>0{i + 1}</span>{item.q}
                      </span>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: S.borderLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Plus size={18} color={S.rose} />
                      </div>
                    </summary>
                    <div className="pt-6" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', color: S.muted, lineHeight: 1.6 }}>{item.a}</div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ FOOTER ════════════════════════════════════════ */}
        <footer className="py-24" style={{ background: S.ink, color: S.white }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
              <div className="lg:col-span-1">
                <div className="flex items-center gap-3 mb-8">
                  <AuraLogo className="w-9 h-9" type="full" />
                </div>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: S.darkMuted, lineHeight: 1.6, marginBottom: '2rem' }}>
                  A plataforma definitiva para clínicas de estética que buscam gestão premium, crescimento e eficiência.
                </p>
                <div className="flex gap-4">
                  {[Instagram, Twitter, Linkedin, Facebook].map((Icon, idx) => (
                    <a key={idx} href="#" style={{ width: 40, height: 40, borderRadius: '50%', background: '#2a2420', display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.darkMuted, transition: 'all 0.3s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = S.rose; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#2a2420'; e.currentTarget.style.color = S.darkMuted; }}>
                      <Icon size={18} />
                    </a>
                  ))}
                </div>
              </div>
              {[
                { title: 'Produto', items: ['Funcionalidades', 'Planos', 'Novidades', 'Changelog'] },
                { title: 'Empresa', items: ['Sobre Nós', 'Contato', 'Blog', 'Carreiras'] },
                { title: 'Legal', items: ['Privacidade', 'Termos de Uso', 'LGPD', 'Segurança'] },
              ].map(col => (
                <div key={col.title}>
                  <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.1rem', fontWeight: 700, marginBottom: '2rem' }}>{col.title}</h4>
                  <ul className="space-y-4">
                    {col.items.map(item => (
                      <li key={item}>
                        <a href="#" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: S.darkMuted, textDecoration: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.color = S.rose}
                          onMouseLeave={e => e.currentTarget.style.color = S.darkMuted}>{item}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="pt-12 border-t" style={{ borderColor: '#2a2420', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '2rem' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: S.darkFaint }}>© 2026 Aura System. Todos os direitos reservados.</p>
              <div className="flex items-center gap-2">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2b9e5e' }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: S.darkFaint }}>Sistemas Operacionais</span>
              </div>
            </div>
          </div>
        </footer>

      </div>

      {/* ══════════ MOBILE STICKY CTA ═════════════════════════════ */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-4" style={{ background: 'rgba(253,251,249,0.95)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${S.border}` }}>
        <Link to="/login" className="lp-btn-solid w-full" style={{ justifyContent: 'center' }}>
          Testar Grátis por 7 Dias <ArrowRight size={18} />
        </Link>
      </div>
    </>
  );
};

export default LandingPage;
