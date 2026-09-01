import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';

/* ── Paleta ────────────────────────────────── */
const C = {
  cream: '#faf5f0',
  ink: '#1a1512',
  rose: '#bd7b65',
  white: '#ffffff',
  muted: '#6b5e54',
  faint: '#a89890',
  border: '#e8ddd5',
  bg: '#f8f5f2',
  green: '#2b9e5e',
  greenBg: '#d4f0e4',
  blue: '#3d7ea6',
  blueBg: '#d6eaf8',
  purple: '#7c5cbf',
  purpleBg: '#e8e0f8',
  red: '#c0392b',
  redBg: '#fee2df',
};

const ease = Easing.out(Easing.cubic);

const fadeUp = (frame: number, start: number, end: number, yFrom = 20) => ({
  opacity: interpolate(frame, [start, end], [0, 1], { extrapolateRight: 'clamp', easing: ease }),
  transform: `translateY(${interpolate(frame, [start, end], [yFrom, 0], { extrapolateRight: 'clamp', easing: ease })}px)`,
});

const fadeIn = (frame: number, start: number, end: number) => ({
  opacity: interpolate(frame, [start, end], [0, 1], { extrapolateRight: 'clamp', easing: ease }),
});

/* ── Browser Shell ─────────────────────────── */
const BrowserBar: React.FC<{ path: string }> = ({ path }) => (
  <div style={{ background: '#f0ece7', borderBottom: `1px solid ${C.border}`, height: 38, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8, flexShrink: 0 }}>
    {['#ff6b6b', '#ffd93d', '#6bcb77'].map(c => (
      <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
    ))}
    <div style={{ flex: 1, background: C.white, borderRadius: 5, height: 20, display: 'flex', alignItems: 'center', paddingLeft: 8, marginLeft: 6, border: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 9, color: C.faint, fontFamily: 'sans-serif' }}>{path}</span>
    </div>
  </div>
);

/* ── Sidebar ───────────────────────────────── */
const Sidebar: React.FC<{ active: number }> = ({ active }) => (
  <div style={{ width: 64, background: C.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, gap: 12, flexShrink: 0 }}>
    <div style={{ width: 28, height: 28, borderRadius: 7, background: C.rose, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
      <span style={{ color: C.white, fontSize: 13, fontWeight: 700, fontFamily: 'Georgia, serif' }}>A</span>
    </div>
    {[{ icon: '▦', label: 'dashboard' }, { icon: '☰', label: 'agenda' }, { icon: '$', label: 'financeiro' }, { icon: '↩', label: 'retorno' }].map((item, i) => (
      <div key={item.label} style={{ width: 32, height: 32, borderRadius: 7, background: i === active ? C.rose : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: i === active ? C.white : 'rgba(255,255,255,0.25)' }}>
        {item.icon}
      </div>
    ))}
  </div>
);

/* ── KPI Card ──────────────────────────────── */
const KpiCard: React.FC<{ label: string; value: string; color: string; frame: number; delay: number }> = ({ label, value, color, frame, delay }) => (
  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', boxShadow: '0 2px 10px rgba(26,21,18,0.05)', flex: 1, ...fadeUp(frame, delay, delay + 16) }}>
    <div style={{ fontSize: 9, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint, marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 20, fontFamily: 'Georgia, serif', fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
  </div>
);

/* ── Bar ───────────────────────────────────── */
const Bar: React.FC<{ pct: number; active?: boolean; frame: number; delay: number }> = ({ pct, active, frame, delay }) => {
  const h = interpolate(frame, [delay, delay + 18], [0, pct], { extrapolateRight: 'clamp', easing: ease });
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: 48 }}>
      <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: `${h}%`, background: active ? C.rose : `rgba(189,123,101,0.25)` }} />
    </div>
  );
};

/* ═══════════════ PHASE 0 — Dashboard ════════════════════════ */
const PhaseDashboard: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
    <div style={{ ...fadeUp(frame, 0, 14) }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.rose, marginBottom: 3, fontFamily: 'sans-serif' }}>Dashboard</div>
      <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', fontWeight: 500, color: C.ink }}>Visão Geral — Abril 2026</div>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <KpiCard label="Receita" value="R$ 12.4k" color={C.rose} frame={frame} delay={10} />
      <KpiCard label="Consultas" value="48" color={C.blue} frame={frame} delay={16} />
      <KpiCard label="Satisfação" value="94%" color={C.green} frame={frame} delay={22} />
    </div>
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px', ...fadeUp(frame, 24, 40) }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint, marginBottom: 8, fontFamily: 'sans-serif' }}>Receita — 7 dias</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
        {[42, 58, 35, 70, 55, 88, 64].map((h, i) => <Bar key={i} pct={h} active={i === 5} frame={frame} delay={28 + i * 3} />)}
      </div>
    </div>
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px', ...fadeUp(frame, 38, 54) }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint, marginBottom: 8, fontFamily: 'sans-serif' }}>Próximos Agendamentos</div>
      {[
        { name: 'Ana Costa', proc: 'Limpeza de Pele', time: '09:30', color: C.rose },
        { name: 'Beatriz Lima', proc: 'Microagulhamento', time: '11:00', color: C.blue },
        { name: 'Carla Mendes', proc: 'Drenagem Linfática', time: '14:30', color: C.green },
      ].map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none', ...fadeIn(frame, 42 + i * 6, 56 + i * 6) }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${a.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: a.color, flexShrink: 0, fontFamily: 'Georgia, serif' }}>{a.name[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: C.ink, fontFamily: 'sans-serif' }}>{a.name}</div>
            <div style={{ fontSize: 9, color: C.faint, fontFamily: 'sans-serif' }}>{a.proc}</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: a.color, fontFamily: 'sans-serif' }}>{a.time}</div>
        </div>
      ))}
    </div>
  </div>
);

/* ═══════════════ PHASE 1 — Agenda ═══════════════════════════ */
const PhaseAgenda: React.FC<{ frame: number }> = ({ frame }) => {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const hours = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00'];
  const slots: Record<string, { label: string; color: string }> = {
    '0-0': { label: 'Ana Costa', color: C.rose },
    '1-2': { label: 'Beatriz L.', color: C.blue },
    '2-2': { label: 'Carla M.', color: C.green },
    '3-4': { label: 'Diana S.', color: C.purple },
    '4-1': { label: 'Eloísa R.', color: C.rose },
    '5-3': { label: 'Flávia T.', color: C.blue },
  };
  return (
    <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
      <div style={{ ...fadeUp(frame, 0, 14) }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.rose, marginBottom: 3, fontFamily: 'sans-serif' }}>Agenda</div>
        <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', fontWeight: 500, color: C.ink }}>Semana de 31 Mar — 04 Abr</div>
      </div>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, overflow: 'hidden', flex: 1, ...fadeUp(frame, 8, 24) }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(5,1fr)', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ padding: 6, borderRight: `1px solid ${C.border}` }} />
          {days.map((d, i) => (
            <div key={d} style={{ padding: '6px 4px', textAlign: 'center', borderLeft: `1px solid ${C.border}`, background: i === 2 ? `${C.rose}10` : 'transparent' }}>
              <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: i === 2 ? C.rose : C.faint, fontFamily: 'sans-serif' }}>{d}</div>
              <div style={{ fontSize: 14, fontFamily: 'Georgia, serif', fontWeight: i === 2 ? 700 : 400, color: i === 2 ? C.rose : C.ink }}>{i + 1}</div>
            </div>
          ))}
        </div>
        {/* Rows */}
        {hours.map((h, row) => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '52px repeat(5,1fr)', borderBottom: row < hours.length - 1 ? `1px solid ${C.border}` : 'none', minHeight: 28 }}>
            <div style={{ padding: '5px 7px', fontSize: 8, color: C.faint, borderRight: `1px solid ${C.border}`, fontFamily: 'sans-serif' }}>{h}</div>
            {[0, 1, 2, 3, 4].map(col => {
              const slot = slots[`${row}-${col}`];
              return (
                <div key={col} style={{ borderLeft: `1px solid ${C.border}`, padding: '3px 4px', background: col === 2 ? `${C.rose}04` : 'transparent' }}>
                  {slot && (
                    <div style={{ background: `${slot.color}18`, border: `1px solid ${slot.color}40`, borderRadius: 4, padding: '2px 5px', fontSize: 8, fontWeight: 500, color: slot.color, fontFamily: 'sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...fadeIn(frame, 16 + row * 5 + col * 2, 28 + row * 5) }}>
                      {slot.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════ PHASE 2 — Financeiro ═══════════════════════ */
const PhaseFinanceiro: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
    <div style={{ ...fadeUp(frame, 0, 14) }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.rose, marginBottom: 3, fontFamily: 'sans-serif' }}>Financeiro</div>
      <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', fontWeight: 500, color: C.ink }}>Fluxo de Caixa — Março</div>
    </div>
    {/* KPIs financeiros */}
    <div style={{ display: 'flex', gap: 8 }}>
      <KpiCard label="Receita" value="R$ 42.8k" color={C.green} frame={frame} delay={10} />
      <KpiCard label="Despesas" value="R$ 12.1k" color={C.red} frame={frame} delay={16} />
      <KpiCard label="Lucro" value="R$ 30.7k" color={C.blue} frame={frame} delay={22} />
    </div>
    {/* Gráfico receita vs despesa */}
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px', ...fadeUp(frame, 26, 42) }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint, marginBottom: 8, fontFamily: 'sans-serif' }}>Receita vs Despesa (semana)</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 48 }}>
        {[
          [72, 28], [65, 32], [80, 25], [55, 40], [90, 20], [78, 30], [85, 22],
        ].map(([rec, desp], i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'stretch', height: 48, justifyContent: 'flex-end' }}>
            <div style={{ borderRadius: '2px 2px 0 0', height: `${interpolate(frame, [30 + i * 3, 46 + i * 3], [0, rec], { extrapolateRight: 'clamp', easing: ease })}%`, background: `rgba(43,158,94,0.55)` }} />
            <div style={{ borderRadius: '2px 2px 0 0', height: `${interpolate(frame, [30 + i * 3, 46 + i * 3], [0, desp], { extrapolateRight: 'clamp', easing: ease })}%`, background: `rgba(192,57,43,0.40)` }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(43,158,94,0.55)' }} /><span style={{ fontSize: 8, color: C.faint, fontFamily: 'sans-serif' }}>Receita</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(192,57,43,0.40)' }} /><span style={{ fontSize: 8, color: C.faint, fontFamily: 'sans-serif' }}>Despesa</span></div>
      </div>
    </div>
    {/* Comissões */}
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px', ...fadeUp(frame, 42, 58) }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint, marginBottom: 8, fontFamily: 'sans-serif' }}>Comissões por Profissional</div>
      {[
        { name: 'Dra. Ana Silva', pct: 88, value: 'R$ 8.4k' },
        { name: 'Beatriz Gomes', pct: 72, value: 'R$ 6.9k' },
        { name: 'Carla Ferreira', pct: 55, value: 'R$ 5.2k' },
      ].map((p, i) => (
        <div key={p.name} style={{ marginBottom: i < 2 ? 8 : 0, ...fadeIn(frame, 46 + i * 5, 60 + i * 5) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 9, fontFamily: 'sans-serif', color: C.ink, fontWeight: 500 }}>{p.name}</span>
            <span style={{ fontSize: 9, fontFamily: 'sans-serif', color: C.green, fontWeight: 600 }}>{p.value}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${C.rose}, ${C.green})`, width: `${interpolate(frame, [50 + i * 4, 65 + i * 4], [0, p.pct], { extrapolateRight: 'clamp', easing: ease })}%` }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ═══════════════ PHASE 3 — Retorno Automático ════════════════ */
const PhaseRetorno: React.FC<{ frame: number }> = ({ frame }) => {
  const sentAt = interpolate(frame, [60, 62], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
      <div style={{ ...fadeUp(frame, 0, 14) }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.rose, marginBottom: 3, fontFamily: 'sans-serif' }}>Retorno Automático</div>
        <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', fontWeight: 500, color: C.ink }}>Clientes Inativas — IA</div>
      </div>
      {/* Lista de inativas */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px', ...fadeUp(frame, 10, 26) }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint, marginBottom: 8, fontFamily: 'sans-serif' }}>Clientes sem retorno há +45 dias</div>
        {[
          { name: 'Mariana Torres', days: 67, proc: 'Microagulhamento' },
          { name: 'Juliana Alves', days: 58, proc: 'Limpeza de Pele' },
          { name: 'Patrícia Sousa', days: 51, proc: 'Peeling Químico' },
        ].map((c, i) => (
          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none', ...fadeIn(frame, 14 + i * 6, 28 + i * 6) }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${C.rose}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.rose, flexShrink: 0, fontFamily: 'Georgia, serif' }}>{c.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: C.ink, fontFamily: 'sans-serif' }}>{c.name}</div>
              <div style={{ fontSize: 9, color: C.faint, fontFamily: 'sans-serif' }}>{c.proc}</div>
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: C.red, background: C.redBg, padding: '2px 6px', borderRadius: 10, fontFamily: 'sans-serif' }}>{c.days}d</div>
          </div>
        ))}
      </div>
      {/* Sugestão IA */}
      <div style={{ background: `${C.purple}0a`, border: `1px solid ${C.purple}30`, borderRadius: 9, padding: '12px', ...fadeUp(frame, 36, 52) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>✦</div>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.purple, fontFamily: 'sans-serif' }}>Sugestão da IA</span>
        </div>
        <p style={{ fontSize: 10, color: C.muted, lineHeight: 1.6, fontFamily: 'sans-serif', margin: 0 }}>
          "Oi Mariana! 🌸 Faz um tempinho que não te vemos por aqui. Que tal renovar sua pele com nosso Microagulhamento? Temos horários essa semana!"
        </p>
      </div>
      {/* Botão + status enviado */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', ...fadeUp(frame, 52, 64) }}>
        <div style={{ background: C.rose, borderRadius: 7, padding: '8px 16px', fontSize: 10, fontWeight: 600, color: C.white, fontFamily: 'sans-serif', cursor: 'pointer' }}>
          Enviar via WhatsApp
        </div>
        {sentAt > 0.5 && (
          <div style={{ background: C.greenBg, border: `1px solid ${C.green}40`, borderRadius: 7, padding: '6px 12px', fontSize: 9, fontWeight: 600, color: C.green, fontFamily: 'sans-serif', ...fadeIn(frame, 62, 72) }}>
            ✓ Enviado para 3 clientes
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════ COMPOSIÇÃO PRINCIPAL ═══════════════════════ */
export interface AuraDemoProps {
  tabIndex?: number;
}

export const AuraDemoComposition: React.FC<AuraDemoProps> = ({ tabIndex = 0 }) => {
  const frame = useCurrentFrame();

  const paths = [
    'aura-system/dashboard',
    'aura-system/agenda',
    'aura-system/financeiro',
    'aura-system/retorno',
  ];

  return (
    <AbsoluteFill style={{ background: C.cream, display: 'flex', flexDirection: 'column' }}>
      <BrowserBar path={paths[tabIndex]} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar active={tabIndex} />
        {tabIndex === 0 && <PhaseDashboard frame={frame} />}
        {tabIndex === 1 && <PhaseAgenda frame={frame} />}
        {tabIndex === 2 && <PhaseFinanceiro frame={frame} />}
        {tabIndex === 3 && <PhaseRetorno frame={frame} />}
      </div>
      <div style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 9, fontFamily: 'Georgia, serif', color: C.rose, letterSpacing: '0.18em', opacity: 0.5 }}>
        AURA SYSTEM
      </div>
    </AbsoluteFill>
  );
};
