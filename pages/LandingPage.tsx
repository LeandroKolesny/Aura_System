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
    padding: 0.85rem 2rem; border: none; border-radius: 8px;
    cursor: pointer; text-decoration: none;
    transition: background 0.25s, transform 0.25s;
  }
  .lp-btn-solid:hover { background: #a66550; transform: translateY(-1px); }

  .lp-btn-outline {
    display: inline-flex; align-items: center; gap: 0.55rem;
    background: transparent; color: #1a1512;
    font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase;
    padding: 0.85rem 2rem; border: 1px solid #d8cec8; border-radius: 8px;
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

// ─── MOCKUPS ───────────────────────────────────────────────────────────────

const MockupShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    background: '#ffffff', borderRadius: '12px',
    boxShadow: '0 32px 64px rgba(26,21,18,0.14), 0 8px 24px rgba(26,21,18,0.08)',
    overflow: 'hidden', border: '1px solid #ede8e3',
    fontFamily: "'DM Sans', sans-serif",
  }}>
    {/* Browser bar */}
    <div style={{ background: '#f4f0ec', borderBottom: '1px solid #ede8e3', padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        {['#ff6b6b','#ffd93d','#6bcb77'].map(c => <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />)}
      </div>
      <div style={{ flex: 1, background: '#fff', borderRadius: '6px', padding: '0.2rem 0.75rem', marginLeft: '0.5rem', fontSize: '0.65rem', color: '#a89890', border: '1px solid #ede8e3' }}>
        aura-system-mu.vercel.app
      </div>
    </div>
    <div style={{ display: 'flex', height: '340px' }}>
      {/* Mini sidebar */}
      <div style={{ width: '48px', background: '#1a1512', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '0.75rem', gap: '0.5rem', flexShrink: 0 }}>
        {['#bd7b65','#4a3d35','#4a3d35','#4a3d35','#4a3d35'].map((c, i) => (
          <div key={i} style={{ width: '32px', height: '32px', borderRadius: '8px', background: c === '#bd7b65' ? 'rgba(189,123,101,0.2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: c, opacity: c === '#bd7b65' ? 1 : 0.35 }} />
          </div>
        ))}
      </div>
      {children}
    </div>
  </div>
);

const AgendaMockup: React.FC = () => {
  const S = { rose: '#bd7b65', ink: '#1a1512', faint: '#a89890', border: '#ede8e3', cream: '#fdfaf7' };
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const slots = [
    { day: 0, time: '09:00', name: 'Ana Paula M.', proc: 'Limpeza de Pele', color: '#bd7b65', span: 2 },
    { day: 1, time: '10:00', name: 'Mariana Costa', proc: 'Botox', color: '#7c5cbf', span: 1 },
    { day: 2, time: '11:00', name: 'Roberta F.', proc: 'Drenagem', color: '#3d7ea6', span: 2 },
    { day: 3, time: '09:00', name: 'Camila S.', proc: 'Peeling', color: '#2b9e5e', span: 1 },
    { day: 4, time: '14:00', name: 'Fernanda L.', proc: 'Limpeza', color: '#bd7b65', span: 1 },
    { day: 1, time: '14:00', name: 'Juliana R.', proc: 'Fio de PDO', color: '#c07840', span: 2 },
  ];
  return (
    <MockupShell>
      <div style={{ flex: 1, padding: '0.75rem', overflow: 'hidden', background: S.cream }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1rem', fontWeight: 500, color: S.ink }}>Agenda — Janeiro 2025</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['Semana','Mês'].map((v, i) => <div key={v} style={{ padding: '2px 8px', borderRadius: '4px', background: i === 0 ? S.rose : 'transparent', color: i === 0 ? '#fff' : S.faint, fontSize: '0.6rem', fontWeight: 600, border: `1px solid ${i === 0 ? S.rose : S.border}` }}>{v}</div>)}
          </div>
        </div>
        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(5, 1fr)', gap: '3px' }}>
          <div />
          {days.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.1em', color: S.faint, paddingBottom: '4px', borderBottom: `1px solid ${S.border}` }}>{d}</div>)}
          {['09:00','10:00','11:00','12:00','13:00','14:00','15:00'].map((t, ti) => (
            <React.Fragment key={t}>
              <div style={{ fontSize: '0.52rem', color: S.faint, paddingTop: '2px' }}>{t}</div>
              {days.map((_, di) => {
                const slot = slots.find(s => s.day === di && s.time === t);
                return (
                  <div key={di} style={{ height: '36px', borderRadius: '4px', background: slot ? `${slot.color}20` : `${S.border}40`, border: slot ? `1px solid ${slot.color}60` : 'none', padding: slot ? '2px 4px' : 0, overflow: 'hidden' }}>
                    {slot && (
                      <>
                        <div style={{ fontSize: '0.52rem', fontWeight: 600, color: slot.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.name}</div>
                        <div style={{ fontSize: '0.48rem', color: S.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.proc}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </MockupShell>
  );
};

const FinanceiroMockup: React.FC = () => {
  const S = { rose: '#bd7b65', ink: '#1a1512', faint: '#a89890', border: '#ede8e3', cream: '#fdfaf7', green: '#2b9e5e' };
  const bars = [55, 72, 48, 88, 65, 92, 78, 84, 70, 95, 82, 89];
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return (
    <MockupShell>
      <div style={{ flex: 1, padding: '0.75rem', overflow: 'hidden', background: S.cream }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '0.75rem' }}>
          {[
            { label: 'Faturamento', value: 'R$ 24.8k', sub: '+18% vs mês ant.', color: S.green },
            { label: 'Ticket Médio', value: 'R$ 312', sub: '+5% vs mês ant.', color: '#3d7ea6' },
            { label: 'Comissões', value: 'R$ 4.2k', sub: '3 profissionais', color: S.rose },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: '8px', padding: '0.55rem', boxShadow: '0 2px 6px rgba(26,21,18,0.04)' }}>
              <div style={{ fontSize: '0.5rem', color: S.faint, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.2rem' }}>{k.label}</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.1rem', fontWeight: 600, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: '0.48rem', color: S.green, marginTop: '0.2rem' }}>{k.sub}</div>
            </div>
          ))}
        </div>
        {/* Bar chart */}
        <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: '8px', padding: '0.6rem', marginBottom: '0.6rem' }}>
          <div style={{ fontSize: '0.5rem', color: S.faint, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>Faturamento — 12 meses</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '60px' }}>
            {bars.map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ width: '100%', background: i === 11 ? S.rose : `rgba(189,123,101,${0.15 + i * 0.06})`, borderRadius: '2px 2px 0 0', height: `${h}%` }} />
                <div style={{ fontSize: '0.38rem', color: S.faint }}>{months[i]}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Transactions */}
        <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: '8px', padding: '0.55rem' }}>
          <div style={{ fontSize: '0.5rem', color: S.faint, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem' }}>Últimas Transações</div>
          {[
            { name: 'Ana Paula M.', proc: 'Botox', val: 'R$ 450', type: 'entrada' },
            { name: 'Mariana C.', proc: 'Limpeza de Pele', val: 'R$ 180', type: 'entrada' },
            { name: 'Comissão — Dra. Lima', proc: 'Profissional', val: 'R$ 135', type: 'saída' },
          ].map((tx, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', borderBottom: i < 2 ? `1px solid ${S.border}` : 'none' }}>
              <div>
                <div style={{ fontSize: '0.55rem', fontWeight: 500, color: S.ink }}>{tx.name}</div>
                <div style={{ fontSize: '0.48rem', color: S.faint }}>{tx.proc}</div>
              </div>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, color: tx.type === 'entrada' ? S.green : '#c0392b' }}>{tx.type === 'saída' ? '-' : '+'}{tx.val}</div>
            </div>
          ))}
        </div>
      </div>
    </MockupShell>
  );
};

const RetornoMockup: React.FC = () => {
  const S = { rose: '#bd7b65', ink: '#1a1512', faint: '#a89890', border: '#ede8e3', cream: '#fdfaf7', green: '#2b9e5e', purple: '#7c5cbf' };
  return (
    <MockupShell>
      <div style={{ flex: 1, padding: '0.75rem', overflow: 'hidden', background: S.cream }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1rem', fontWeight: 500, color: S.ink }}>CRM — Resgate de Clientes</span>
          <div style={{ background: S.purple, color: '#fff', fontSize: '0.5rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', letterSpacing: '0.08em' }}>✦ IA Ativa</div>
        </div>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '0.6rem' }}>
          {[
            { label: 'Inativos +45d', val: '23', color: '#c0392b' },
            { label: 'Msg Enviadas', val: '18', color: S.rose },
            { label: 'Retornaram', val: '9', color: S.green },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.4rem', fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: '0.48rem', color: S.faint, marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Client list */}
        <div style={{ background: '#fff', border: `1px solid ${S.border}`, borderRadius: '8px', padding: '0.55rem', marginBottom: '0.55rem' }}>
          <div style={{ fontSize: '0.5rem', color: S.faint, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Clientes para Resgatar</div>
          {[
            { name: 'Claudia Mendes', days: '67 dias', proc: 'Última: Botox', status: 'urgente' },
            { name: 'Patricia Lima', days: '52 dias', proc: 'Última: Peeling', status: 'atenção' },
            { name: 'Renata Souza', days: '48 dias', proc: 'Última: Drenagem', status: 'atenção' },
          ].map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: i < 2 ? `1px solid ${S.border}` : 'none' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: c.status === 'urgente' ? '#fee2df' : '#fff8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color: c.status === 'urgente' ? '#c0392b' : '#c07840', flexShrink: 0 }}>
                {c.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 500, color: S.ink }}>{c.name}</div>
                <div style={{ fontSize: '0.48rem', color: S.faint }}>{c.proc}</div>
              </div>
              <div style={{ fontSize: '0.48rem', background: c.status === 'urgente' ? '#fee2df' : '#fff8e8', color: c.status === 'urgente' ? '#c0392b' : '#c07840', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, flexShrink: 0 }}>{c.days}</div>
            </div>
          ))}
        </div>
        {/* AI message suggestion */}
        <div style={{ background: `${S.purple}12`, border: `1px solid ${S.purple}30`, borderRadius: '8px', padding: '0.5rem' }}>
          <div style={{ fontSize: '0.48rem', color: S.purple, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>✦ Sugestão IA para Claudia</div>
          <p style={{ fontSize: '0.52rem', color: S.ink, lineHeight: 1.5, margin: 0 }}>
            "Oi Claudia! Sentimos sua falta 💕 Que tal agendar sua manutenção de Botox? Reservamos um horário especial para você esta semana."
          </p>
          <div style={{ display: 'flex', gap: '4px', marginTop: '0.4rem' }}>
            <div style={{ flex: 1, background: S.purple, color: '#fff', fontSize: '0.48rem', fontWeight: 600, textAlign: 'center', padding: '3px', borderRadius: '4px' }}>Enviar via WhatsApp</div>
            <div style={{ background: '#fff', color: S.faint, fontSize: '0.48rem', fontWeight: 600, textAlign: 'center', padding: '3px 6px', borderRadius: '4px', border: `1px solid ${S.border}` }}>Editar</div>
          </div>
        </div>
      </div>
    </MockupShell>
  );
};

const DashboardMockup: React.FC = () => {
  const S2 = { bg: '#ffffff', border: '#ede8e3', rose: '#bd7b65', ink: '#1a1512', muted: '#6b5e54', faint: '#a89890', green: '#2b9e5e', cream: '#fdfaf7' };
  const bars = [42, 68, 55, 80, 63, 90, 74];
  const appointments = [
    { name: 'Ana Paula M.', time: '10:00', proc: 'Limpeza de Pele' },
    { name: 'Mariana Costa', time: '11:30', proc: 'Drenagem Linfática' },
    { name: 'Roberta Faria', time: '14:00', proc: 'Toxina Botulínica' },
  ];

  return (
    <div style={{
      background: S2.bg, borderRadius: '12px',
      boxShadow: '0 32px 64px rgba(26,21,18,0.14), 0 8px 24px rgba(26,21,18,0.08)',
      overflow: 'hidden', border: `1px solid ${S2.border}`,
      transform: 'rotate(-1.5deg)',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Browser bar */}
      <div style={{ background: '#f4f0ec', borderBottom: `1px solid ${S2.border}`, padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {['#ff6b6b','#ffd93d','#6bcb77'].map(c => (
            <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, background: S2.bg, borderRadius: '6px', padding: '0.2rem 0.75rem', marginLeft: '0.5rem', fontSize: '0.65rem', color: S2.faint, border: `1px solid ${S2.border}` }}>
          aura-system-mu.vercel.app/dashboard
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '1.25rem', background: '#fdfbf8' }}>
        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.65rem', marginBottom: '1.1rem' }}>
          {[
            { label: 'Receita', value: 'R$ 12.4k', color: S2.rose },
            { label: 'Consultas', value: '48', color: '#3d7ea6' },
            { label: 'Satisfação', value: '94%', color: S2.green },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: S2.bg, border: `1px solid ${S2.border}`, borderRadius: '8px', padding: '0.75rem', boxShadow: '0 2px 8px rgba(26,21,18,0.04)' }}>
              <div style={{ fontSize: '0.55rem', color: S2.faint, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>{kpi.label}</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: 600, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Mini bar chart */}
        <div style={{ background: S2.bg, border: `1px solid ${S2.border}`, borderRadius: '8px', padding: '0.75rem', marginBottom: '1.1rem', boxShadow: '0 2px 8px rgba(26,21,18,0.04)' }}>
          <div style={{ fontSize: '0.55rem', color: S2.faint, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.65rem' }}>Receita — 7 dias</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '48px' }}>
            {bars.map((h, i) => (
              <div key={i} style={{ flex: 1, background: i === 5 ? S2.rose : `rgba(189,123,101,${0.18 + i * 0.04})`, borderRadius: '3px 3px 0 0', height: `${h}%`, transition: 'height 0.4s' }} />
            ))}
          </div>
        </div>

        {/* Appointment list */}
        <div style={{ background: S2.bg, border: `1px solid ${S2.border}`, borderRadius: '8px', padding: '0.75rem', boxShadow: '0 2px 8px rgba(26,21,18,0.04)' }}>
          <div style={{ fontSize: '0.55rem', color: S2.faint, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.55rem' }}>Próximos Agendamentos</div>
          {appointments.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0', borderBottom: i < 2 ? `1px solid ${S2.border}` : 'none' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: `rgba(189,123,101,${0.15 + i * 0.08})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: S2.rose, flexShrink: 0 }}>
                {a.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 500, color: S2.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                <div style={{ fontSize: '0.58rem', color: S2.faint }}>{a.proc}</div>
              </div>
              <div style={{ fontSize: '0.6rem', color: S2.rose, fontWeight: 600, flexShrink: 0 }}>{a.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const LandingPage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { saasPlans, loadPlans } = useApp();
  const navigate = useNavigate();

  const [activeDemoTab, setActiveDemoTab] = useState<'dashboard' | 'agenda' | 'financeiro' | 'retorno'>('dashboard');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const scrollToSection = (id: string) => {
    setIsMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleFaq = (i: number) => setOpenFaqIndex(openFaqIndex === i ? null : i);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

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
  }, [saasPlans]);

  const sortedPlans = [...saasPlans]
    .filter(p => p.active)
    .sort((a, b) => {
      const isFreeA = a.price === 0 || a.name.toLowerCase().includes('free') || a.name.toLowerCase().includes('gratu');
      const isFreeB = b.price === 0 || b.name.toLowerCase().includes('free') || b.name.toLowerCase().includes('gratu');
      if (isFreeA && !isFreeB) return -1;
      if (!isFreeA && isFreeB) return 1;
      const order: Record<string, number> = { starter: 2, pro: 3, clinic: 4 };
      const posA = order[a.id] ?? (a.price || 9999);
      const posB = order[b.id] ?? (b.price || 9999);
      return posA - posB;
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
        <section
          className="relative flex items-center pt-16 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(189,123,101,0.09) 0%, #fdfaf7 55%)' }}
        >
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
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center"
              style={{ paddingTop: '4rem', paddingBottom: '3rem' }}
            >
              {/* Left: Text */}
              <div className="lg:col-span-5 reveal">
                <div
                  className="inline-flex items-center gap-3 mb-6"
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

                <div className="flex flex-wrap gap-4 mb-6 reveal rd3">
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

              {/* Right: Dashboard Mockup */}
              <div className="lg:col-span-7 relative reveal rd2 hidden lg:block" style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                <DashboardMockup />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ DORES / SOLUÇÕES ═══════════════ */}
        <section className="py-12 md:py-28" style={{ background: S.white, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="text-center max-w-2xl mx-auto mb-10 md:mb-20 reveal">
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
                  <div style={{ background: '#fdf5f4', border: '1px solid #f0ddd9', padding: '2.25rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(26,21,18,0.05)' }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div style={{ background: '#fee2df', padding: '0.55rem', borderRadius: '8px' }}>
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

                  <div style={{ background: '#f3fbf6', border: '1px solid #c8ead8', padding: '2.25rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(26,21,18,0.05)' }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div style={{ background: '#d0f0e0', padding: '0.55rem', borderRadius: '8px' }}>
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

        {/* ═══════════════ 4 PILARES — 2x2 Cards ═══════════════ */}
        <section id="pillars" className="py-20" style={{ background: S.cream, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-14">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { num: '01', label: 'Gestão & Operação', color: S.ink, bg: 'rgba(26,21,18,0.04)', desc: 'O básico bem feito. Agendamento, confirmações e financeiro rodando no piloto automático para você focar no atendimento.', items: ['Agenda Inteligente', 'Financeiro Automático', 'Controle de Estoque'], Icon: Smartphone },
                { num: '02', label: 'Growth & Vendas', color: S.rose, bg: 'rgba(189,123,101,0.07)', desc: 'O motor de dinheiro. Ferramentas ativas que trazem clientes de volta, aumentam o ticket médio e enchem sua agenda.', items: ['CRM de Vendas', 'Resgate de Inativos', 'Dashboard em Tempo Real'], Icon: TrendingUp },
                { num: '03', label: 'Branding & IA', color: '#7c5cbf', bg: 'rgba(124,92,191,0.06)', desc: 'Diferenciação pura. Inteligência artificial para encantar clientes e design que valoriza sua marca.', items: ['Resumos com IA', 'Pós-venda Personalizado', 'Galeria Antes & Depois'], Icon: Sparkles },
                { num: '04', label: 'Segurança & Suporte', color: '#3d7ea6', bg: 'rgba(61,126,166,0.06)', desc: 'Tranquilidade total. Seus dados protegidos, contratos digitais e um suporte que realmente resolve.', items: ['Termos Digitais', 'Prontuário Seguro', 'Backup Diário'], Icon: Shield },
              ].map((p, i) => (
                <div
                  key={p.num}
                  className={`reveal ${i > 0 ? `rd${Math.min(i, 4)}` : ''}`}
                  style={{
                    background: p.bg,
                    border: `1px solid ${S.border}`,
                    borderRadius: '14px',
                    padding: '2.25rem',
                    transitionDelay: `${i * 70}ms`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Large decorative number */}
                  <span style={{
                    position: 'absolute', top: '1.25rem', right: '1.75rem',
                    fontFamily: "'Cormorant Garamond',serif", fontSize: '5rem',
                    fontWeight: 300, lineHeight: 1, color: `${p.color}40`,
                    userSelect: 'none', pointerEvents: 'none',
                  }}>{p.num}</span>

                  {/* Icon */}
                  <div style={{ background: `${p.color}18`, padding: '0.75rem', borderRadius: '10px', width: 'fit-content', marginBottom: '1.25rem' }}>
                    <p.Icon style={{ color: p.color, width: '1.25rem', height: '1.25rem' }} />
                  </div>

                  <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.65rem', fontWeight: 500, color: S.ink, lineHeight: 1.2, marginBottom: '0.75rem' }}>{p.label}</h3>
                  <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 300, color: S.muted, lineHeight: 1.75, marginBottom: '1.5rem' }}>{p.desc}</p>

                  <ul className="space-y-2">
                    {p.items.map(item => (
                      <li key={item} className="flex items-center gap-2.5" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', color: S.muted }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ CTA CENTRAL ═══════════════ */}
        <section style={{ background: '#1a1512', padding: '5rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(189,123,101,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <span className="sec-label" style={{ color: 'rgba(189,123,101,0.8)' }}>Comece hoje</span>
            <h2
              className="reveal"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2.2rem,5vw,4rem)', fontWeight: 400, color: '#fdfaf7', lineHeight: 1.1, marginBottom: '1.25rem' }}
            >
              Pare de perder dinheiro.<br />
              <em style={{ color: '#bd7b65', fontStyle: 'italic' }}>Comece agora, em 3 minutos.</em>
            </h2>
            <p
              className="reveal rd1"
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', fontWeight: 300, color: '#a89890', lineHeight: 1.8, maxWidth: '48ch', margin: '0 auto 2rem' }}
            >
              7 dias grátis, sem cartão de crédito. Configure sua clínica em minutos e veja a agenda cheia ainda essa semana.
            </p>
            <div className="reveal rd1" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
              {['✓ Sem fidelidade', '✓ Cancele quando quiser', '✓ Dados sempre seus', '✓ Suporte humanizado'].map(s => (
                <span key={s} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.72rem', color: '#6b5e54', letterSpacing: '0.08em' }}>{s}</span>
              ))}
            </div>
            <div className="reveal rd2" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
              <Link to="/login" className="lp-btn-solid" style={{ borderRadius: '8px', fontSize: '0.78rem', padding: '1rem 2.5rem', background: '#bd7b65' }}>
                Testar 7 Dias Grátis <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => scrollToSection('plans')}
                className="lp-btn-outline"
                style={{ borderRadius: '8px', borderColor: 'rgba(255,255,255,0.15)', color: '#a89890', fontSize: '0.78rem', padding: '1rem 2.5rem' }}
              >
                Ver Planos & Preços
              </button>
            </div>
            <p className="reveal rd3" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.65rem', color: '#4a3d35', marginTop: '1.25rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              847 clínicas já transformaram sua gestão
            </p>
          </div>
        </section>

        {/* ═══════════════ DEMO INTERATIVA ═══════════════ */}
        <section id="features" className="py-20" style={{ background: S.white, borderTop: `1px solid ${S.borderLight}` }}>
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
                  onClick={() => setActiveDemoTab(tab.id as 'dashboard' | 'agenda' | 'financeiro' | 'retorno')}
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
                <div style={{ position: 'absolute', inset: 0, background: S.roseLight, borderRadius: '16px', transform: 'rotate(1.5deg) scale(0.97)', zIndex: 0 }} />
                <div style={{ position: 'relative', zIndex: 10 }}>
                  {activeDemoTab === 'dashboard' && <DashboardMockup />}
                  {activeDemoTab === 'agenda' && <AgendaMockup />}
                  {activeDemoTab === 'financeiro' && <FinanceiroMockup />}
                  {activeDemoTab === 'retorno' && <RetornoMockup />}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ ANTES vs DEPOIS — hidden on mobile ═══════════════ */}
        <section className="hidden md:block py-28" style={{ background: 'rgba(189,123,101,0.055)', borderTop: `1px solid rgba(189,123,101,0.12)` }}>
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

            <div className="overflow-hidden reveal" style={{ border: `1px solid ${S.border}`, borderRadius: '12px' }}>
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
                      <li key={item.t} className="flex gap-4">
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

        {/* ═══════════════ SOCIAL PROOF BAR ═══════════════ */}
        <section style={{ background: S.ink, padding: '2.5rem 1.5rem', borderTop: '1px solid #2a2018' }}>
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { num: '847+', label: 'Clínicas ativas' },
                { num: '98%', label: 'Taxa de satisfação' },
                { num: 'R$ 12M+', label: 'Gerenciados/mês' },
                { num: '3 min', label: 'Setup inicial' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 500, color: S.rose, lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.72rem', color: '#a89890', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500, marginTop: '0.4rem' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ DEPOIMENTOS ═══════════════ */}
        <section className="py-12 md:py-28" style={{ background: S.cream, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="text-center mb-10 md:mb-16 reveal">
              <span className="sec-label">Quem já transformou</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 400, color: S.ink }}>
                Clínicas que <em style={{ color: S.rose }}>cresceram</em> com o Aura
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote: 'Antes eu perdia em média 8 consultas por mês por faltas. Hoje, com a confirmação automática, praticamente zerou. Em 3 meses recuperei o investimento do plano.',
                  name: 'Dra. Carolina Menezes',
                  mobileOnly: false,
                  role: 'Clínica de Estética · São Paulo, SP',
                  result: '−92% em faltas',
                  stars: 5,
                  initials: 'CM',
                },
                {
                  quote: 'O módulo de Resgate com IA foi surreal. Mandei mensagem para 15 pacientes inativas e 9 voltaram na mesma semana. É como ter uma recepcionista trabalhando 24h.',
                  name: 'Renata Oliveira',
                  role: 'Studio de Beleza · Curitiba, PR',
                  result: '60% de retorno',
                  stars: 5,
                  initials: 'RO',
                  mobileOnly: false,
                },
                {
                  quote: 'Finalmente sei exatamente quanto lucrei, quanto gastei e quanto cada profissional produziu. O financeiro automático mudou completamente a gestão do meu negócio.',
                  name: 'Juliana Ferreira',
                  role: 'Espaço de Dermato Estética · Belo Horizonte, MG',
                  result: '+35% de receita',
                  stars: 5,
                  initials: 'JF',
                  mobileOnly: false,
                },
              ].map((t, i) => (
                <div key={i} className={i > 0 ? 'hidden md:block' : ''}>
                <div
                  className={`reveal ${i > 0 ? `rd${i}` : ''}`}
                  style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 8px 24px rgba(26,21,18,0.05)' }}
                >
                  {/* Stars */}
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {Array.from({ length: t.stars }).map((_, si) => (
                      <Star key={si} className="w-3.5 h-3.5" style={{ color: '#f4b942', fill: '#f4b942' }} />
                    ))}
                  </div>

                  {/* Result badge */}
                  <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: `${S.rose}15`, border: `1px solid ${S.rose}30`, borderRadius: '20px', padding: '0.25rem 0.75rem' }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.62rem', fontWeight: 700, color: S.rose, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.result}</span>
                  </div>

                  {/* Quote */}
                  <blockquote style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.88rem', fontWeight: 300, color: S.muted, lineHeight: 1.8, margin: 0, flex: 1 }}>
                    "{t.quote}"
                  </blockquote>

                  {/* Author */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '1rem', borderTop: `1px solid ${S.borderLight}` }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                      background: `radial-gradient(135deg, rgba(189,123,101,${0.25 + i * 0.08}) 0%, rgba(189,123,101,${0.08 + i * 0.04}) 100%)`,
                      border: `1.5px solid rgba(189,123,101,${0.35 + i * 0.1})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Cormorant Garamond',serif", fontSize: '1rem', fontWeight: 600, color: S.rose,
                      boxShadow: `0 2px 12px rgba(189,123,101,${0.15 + i * 0.05})`,
                    }}>
                      {t.initials}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.85rem', fontWeight: 500, color: S.ink }}>{t.name}</div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.72rem', fontWeight: 300, color: S.faint }}>{t.role}</div>
                    </div>
                  </div>
                </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ PLANOS ═══════════════ */}
        <section id="plans" className="py-12 md:py-28" style={{ background: S.white, borderTop: `1px solid ${S.borderLight}` }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <div className="text-center max-w-2xl mx-auto mb-16 reveal">
              <span className="sec-label">Investimento</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 400, color: S.ink }}>
                Planos para cada fase do seu negócio
              </h2>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.92rem', fontWeight: 300, color: S.muted, marginTop: '0.9rem' }}>
                Comece grátis. Cresça no seu ritmo. Sem surpresas na fatura.
              </p>
            </div>

            {/* Grid: todos os planos vêm do banco */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">

              {sortedPlans.map((plan, idx) => {
                const isFree = plan.price === 0 || plan.name.toLowerCase().includes('free') || plan.name.toLowerCase().includes('gratu');
                const isPro = !isFree && (plan.id === 'pro' || plan.name.toLowerCase().includes('pro'));
                const isClinic = !isFree && (plan.id === 'clinic' || plan.name.toLowerCase().includes('clinic'));

                if (isFree) {
                  // FREE — entrada sem compromisso
                  return (
                    <div key={plan.id} className="flex flex-col reveal" style={{ border: `1px solid ${S.border}`, borderRadius: '14px', padding: '2rem', background: S.cream, transitionDelay: `${idx * 80}ms` }}>
                      <div style={{ marginBottom: '0.6rem' }}>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: S.muted }}>
                          Para começar
                        </span>
                      </div>
                      <h4 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.7rem', fontWeight: 600, color: S.ink, marginBottom: '0.2rem' }}>
                        {plan.name}
                      </h4>
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', fontWeight: 300, color: S.muted, marginBottom: '1.4rem' }}>
                        Experimente sem compromisso
                      </p>
                      <div className="flex items-baseline mb-6">
                        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2.6rem', fontWeight: 400, color: S.ink, lineHeight: 1 }}>R$ 0</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', color: S.faint, marginLeft: '0.4rem' }}>/sempre</span>
                      </div>
                      <ul className="space-y-2.5 mb-8 flex-1">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', fontWeight: 300, color: S.muted }}>
                            <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#c0b4ae' }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => navigate('/login?tab=register')}
                        style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', padding: '0.7rem 1.2rem', borderRadius: '8px', border: `1px solid ${S.border}`, background: 'transparent', color: S.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = S.roseLight; (e.currentTarget as HTMLButtonElement).style.borderColor = S.rose; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = S.border; }}
                      >
                        Começar a testar <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                if (isPro) {
                  // PRO — destaque máximo (mais popular)
                  return (
                    <div key={plan.id} className="flex flex-col reveal" style={{ background: S.dark, border: `2px solid ${S.rose}`, borderRadius: '14px', padding: '2rem', transform: 'translateY(-14px)', transitionDelay: `${(idx + 1) * 80}ms`, position: 'relative', overflow: 'hidden' }}>
                      {/* Badge mais popular */}
                      <div style={{ position: 'absolute', top: 0, right: 0, background: S.rose, color: S.white, fontFamily: "'DM Sans',sans-serif", fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0.35rem 0.9rem', borderBottomLeftRadius: '10px' }}>
                        ★ Mais Popular
                      </div>
                      <div style={{ marginBottom: '0.6rem' }}>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6b5c54' }}>
                          Para clínicas em crescimento
                        </span>
                      </div>
                      <h4 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.7rem', fontWeight: 600, color: S.white, marginBottom: '0.2rem' }}>
                        {plan.name}
                      </h4>
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', fontWeight: 300, color: '#8a7a72', marginBottom: '1.4rem' }}>
                        CRM + IA + relatórios completos
                      </p>
                      <div className="flex items-baseline mb-6">
                        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2.6rem', fontWeight: 400, color: S.white, lineHeight: 1 }}>R$ {plan.price}</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', color: '#6b5c54', marginLeft: '0.4rem' }}>/mês</span>
                      </div>
                      <ul className="space-y-2.5 mb-8 flex-1">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', fontWeight: 300, color: '#b0a49e' }}>
                            <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: S.rose }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => { localStorage.setItem('pendingPlan', JSON.stringify({ planId: plan.id, planName: plan.name, price: plan.price })); navigate('/login?redirect=checkout'); }}
                        style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', padding: '0.7rem 1.2rem', borderRadius: '8px', border: 'none', background: S.rose, color: S.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                      >
                        Assinar Agora <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                if (isClinic) {
                  // CLINIC — premium escuro
                  return (
                    <div key={plan.id} className="flex flex-col reveal" style={{ background: '#0f0d0b', border: '1px solid #3a2e28', borderRadius: '14px', padding: '2rem', transitionDelay: `${(idx + 1) * 80}ms` }}>
                      <div style={{ marginBottom: '0.6rem' }}>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c9a87c' }}>
                          Para redes & franquias
                        </span>
                      </div>
                      <h4 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.7rem', fontWeight: 600, color: '#f5ede4', marginBottom: '0.2rem' }}>
                        {plan.name}
                      </h4>
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', fontWeight: 300, color: '#6b5c54', marginBottom: '1.4rem' }}>
                        Multi-unidades com gerente dedicado
                      </p>
                      <div className="flex items-baseline mb-6">
                        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2.6rem', fontWeight: 400, color: '#c9a87c', lineHeight: 1 }}>R$ {plan.price}</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', color: '#4a3d35', marginLeft: '0.4rem' }}>/mês</span>
                      </div>
                      <ul className="space-y-2.5 mb-8 flex-1">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', fontWeight: 300, color: '#7a6b62' }}>
                            <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#c9a87c' }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => { localStorage.setItem('pendingPlan', JSON.stringify({ planId: plan.id, planName: plan.name, price: plan.price })); navigate('/login?redirect=checkout'); }}
                        style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', padding: '0.7rem 1.2rem', borderRadius: '8px', border: '1px solid #3a2e28', background: 'transparent', color: '#c9a87c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                      >
                        Assinar Agora <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                // STARTER (e outros planos pagos) — rosé quente
                const isHighTier = plan.price >= 300;
                return (
                  <div key={plan.id} className="flex flex-col reveal" style={{ background: S.roseLight, border: `1.5px solid ${S.rose}`, borderRadius: '14px', padding: '2rem', transitionDelay: `${idx * 80}ms` }}>
                    <div style={{ marginBottom: '0.6rem' }}>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: S.rose }}>
                        {isHighTier ? 'Para clínicas consolidadas' : 'Para autônomos'}
                      </span>
                    </div>
                    <h4 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.7rem', fontWeight: 600, color: S.ink, marginBottom: '0.2rem' }}>
                      {plan.name}
                    </h4>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', fontWeight: 300, color: S.muted, marginBottom: '1.4rem' }}>
                      Agenda profissional completa
                    </p>
                    <div className="flex items-baseline mb-6">
                      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '2.6rem', fontWeight: 400, color: S.ink, lineHeight: 1 }}>R$ {plan.price}</span>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.75rem', color: S.muted, marginLeft: '0.4rem' }}>/mês</span>
                    </div>
                    <ul className="space-y-2.5 mb-8 flex-1">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.8rem', fontWeight: 300, color: S.muted }}>
                          <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: S.rose }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => { localStorage.setItem('pendingPlan', JSON.stringify({ planId: plan.id, planName: plan.name, price: plan.price })); navigate('/login?redirect=checkout'); }}
                      style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', padding: '0.7rem 1.2rem', borderRadius: '8px', border: 'none', background: S.rose, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                      Assinar Agora <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {sortedPlans.length === 0 && (
                <div className="col-span-4 text-center py-12" style={{ fontFamily: "'DM Sans',sans-serif", color: S.faint }}>
                  Nenhum plano disponível no momento.
                </div>
              )}
            </div>

            {/* Nota de rodapé */}
            <p className="text-center mt-10 reveal" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '0.78rem', fontWeight: 300, color: S.faint }}>
              Todos os planos incluem 7 dias grátis para teste. Cancele a qualquer momento, sem multas.
            </p>
          </div>
        </section>

        {/* ═══════════════ TECNOLOGIA ═══════════════ */}
        <section className="py-12 md:py-24" style={{ background: S.cream, borderTop: `1px solid ${S.borderLight}` }}>
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
              style={{ border: `1px solid ${S.border}`, borderRadius: '12px', overflow: 'hidden' }}
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
                  <div style={{ background: S.roseLight, padding: '0.65rem', borderRadius: '8px', width: 'fit-content', marginBottom: '1.25rem' }}>
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
        <section id="faq" className="py-12 md:py-28" style={{ background: S.white, borderTop: `1px solid ${S.borderLight}` }}>
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

        {/* ═══════════════ CTA FINAL (simplificado) ═══════════════ */}
        <section style={{ background: S.cream, borderTop: `1px solid ${S.borderLight}`, padding: '4rem 1.5rem', textAlign: 'center' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem,3vw,2.8rem)', fontWeight: 400, color: S.ink, lineHeight: 1.2, marginBottom: '1.25rem' }}>
              Sua clínica merece a melhor gestão.<br />
              <em style={{ color: S.rose }}>Comece grátis hoje.</em>
            </h2>
            <div className="reveal rd1" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
              <Link to="/login" className="lp-btn-solid" style={{ borderRadius: '8px', fontSize: '0.78rem', padding: '1rem 2.5rem' }}>
                Testar 7 Dias Grátis <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════ FOOTER ═══════════════ */}
        <footer className="pb-24 md:pb-0" style={{ background: S.dark, borderTop: `1px solid ${S.darkBorder}` }}>
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
                    onMouseEnter={(e: React.MouseEvent<SVGSVGElement>) => ((e.currentTarget as SVGSVGElement & { style: CSSStyleDeclaration }).style.color = S.rose)}
                    onMouseLeave={(e: React.MouseEvent<SVGSVGElement>) => ((e.currentTarget as SVGSVGElement & { style: CSSStyleDeclaration }).style.color = S.darkFaint)}
                  />
                ))}
              </div>
            </div>
          </div>
        </footer>

      </div>

      {/* ═══════════════ MOBILE STICKY CTA ═══════════════ */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-4"
        style={{
          background: 'rgba(253,250,247,0.96)',
          backdropFilter: 'blur(16px)',
          borderTop: `1px solid ${S.borderLight}`,
          boxShadow: '0 -8px 32px rgba(26,21,18,0.10)',
        }}
      >
        <Link
          to="/login"
          className="lp-btn-solid"
          style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '0.9rem' }}
        >
          Testar 7 Dias Grátis — Sem Cartão <ArrowRight className="w-4 h-4" />
        </Link>
        <p style={{ textAlign: 'center', fontFamily: "'DM Sans',sans-serif", fontSize: '0.6rem', color: S.faint, marginTop: '0.4rem', letterSpacing: '0.06em' }}>
          Cancele quando quiser · Sem fidelidade
        </p>
      </div>
    </>
  );
};

export default LandingPage;
