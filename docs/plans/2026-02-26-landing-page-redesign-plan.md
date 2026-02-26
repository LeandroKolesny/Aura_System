# Landing Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aplicar color blocking, mockup simulado do dashboard, bordas orgânicas e CTA final escuro na landing page do Aura System.

**Architecture:** Todas as mudanças ficam em `pages/LandingPage.tsx` (monolito inline com styles em `LP_STYLES`). Um sub-componente `DashboardMockup` é criado inline no mesmo arquivo. Nenhum novo arquivo é necessário.

**Tech Stack:** React, TypeScript, Tailwind CSS (usado só para layout), inline styles (padrão do arquivo existente).

---

### Mapa de seções atual vs novo

| Seção | Linha atual | Fundo atual | Fundo novo |
|-------|------------|-------------|------------|
| Hero | 229 | cream `#fdfaf7` | gradient `135deg, rgba(189,123,101,0.09) → #fdfaf7` |
| Dores/Soluções | 362 | white | white ✅ sem mudança |
| 4 Pilares | 427 | cream | cream ✅ sem mudança |
| Demo | 486 | white | white ✅ sem mudança |
| Antes vs Depois | 601 | cream | rosé `rgba(189,123,101,0.06)` |
| Planos | 671 | white | white ✅ sem mudança |
| Tecnologia | 744 | cream | cream ✅ sem mudança |
| FAQ | 789 | white | white ✅ sem mudança |
| **CTA Final** | — | *(não existe)* | dark `#1a1512` *(novo)* |
| Footer | 830 | dark ✅ | dark ✅ sem mudança |

---

### Task 1: Hero — Gradiente de fundo

**Files:**
- Modify: `pages/LandingPage.tsx:230`

**Step 1: Localizar o `<section>` do Hero (linha 230)**

É a linha:
```tsx
<section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
```

**Step 2: Adicionar gradient ao background da section**

Trocar por:
```tsx
<section
  className="relative min-h-screen flex items-center pt-16 overflow-hidden"
  style={{ background: 'linear-gradient(135deg, rgba(189,123,101,0.09) 0%, #fdfaf7 55%)' }}
>
```

**Step 3: Verificar visualmente no browser (npm run dev)**

O topo da página deve ter um leve toque rosé no canto superior esquerdo dissolvendo para cream.

**Step 4: Commit**
```bash
git add pages/LandingPage.tsx
git commit -m "feat(landing): hero gradient rosé → cream"
```

---

### Task 2: Hero — Substituir foto por DashboardMockup

**Files:**
- Modify: `pages/LandingPage.tsx` — adicionar componente inline + substituir `<img>` do hero

**Step 1: Criar o componente `DashboardMockup` logo antes do componente `LandingPage` (por volta da linha 105)**

```tsx
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
```

**Step 2: Substituir a coluna direita do Hero (linhas 303–357)**

A coluna `lg:col-span-7` do hero tem um `<img>` com a foto do Unsplash e dois floating cards. Substituir o conteúdo da div externa por:

```tsx
{/* Right: Dashboard Mockup */}
<div className="lg:col-span-7 relative reveal rd2 hidden lg:block">
  <DashboardMockup />
</div>
```

> **Nota:** `hidden lg:block` — o mockup some no mobile para não travar o layout.

**Step 3: Verificar no browser**

O mockup deve aparecer inclinado (-1.5deg) com sombra profunda à direita do copy no hero.

**Step 4: Commit**
```bash
git add pages/LandingPage.tsx
git commit -m "feat(landing): add simulated dashboard mockup to hero"
```

---

### Task 3: Seção "Antes vs Depois" — Fundo rosé suave

**Files:**
- Modify: `pages/LandingPage.tsx:602`

**Step 1: Localizar a seção (linha 602)**

```tsx
<section className="py-28" style={{ background: S.cream, borderTop: `1px solid ${S.borderLight}` }}>
```

**Step 2: Trocar o background**

```tsx
<section className="py-28" style={{ background: 'rgba(189,123,101,0.055)', borderTop: `1px solid rgba(189,123,101,0.12)` }}>
```

**Step 3: Verificar visualmente**

A seção deve ter um leve toque rosé — diferente do cream e do white, mas sem ser pesado.

**Step 4: Commit**
```bash
git add pages/LandingPage.tsx
git commit -m "feat(landing): antes/depois section with brand rosé tint"
```

---

### Task 4: Adicionar seção CTA Final escura (antes do footer)

**Files:**
- Modify: `pages/LandingPage.tsx:830` — inserir seção antes do `<footer>`

**Step 1: Inserir nova seção logo antes do `<footer>` (linha 830)**

```tsx
{/* ═══════════════ CTA FINAL ═══════════════ */}
<section style={{ background: '#1a1512', padding: '5rem 1.5rem' }}>
  <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
    <span className="sec-label" style={{ color: 'rgba(189,123,101,0.8)' }}>Comece hoje</span>
    <h2
      className="reveal"
      style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2.2rem,5vw,3.8rem)', fontWeight: 400, color: '#fdfaf7', lineHeight: 1.15, marginBottom: '1.25rem' }}
    >
      Sua clínica merece uma{' '}
      <em style={{ color: '#bd7b65', fontStyle: 'italic' }}>gestão à altura.</em>
    </h2>
    <p
      className="reveal rd1"
      style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', fontWeight: 300, color: '#6b5e54', lineHeight: 1.8, maxWidth: '44ch', margin: '0 auto 2.5rem' }}
    >
      7 dias grátis, sem cartão. Configure em minutos e veja a diferença no primeiro dia.
    </p>
    <div className="reveal rd2" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
      <Link to="/login" className="lp-btn-solid" style={{ borderRadius: '8px', fontSize: '0.75rem', padding: '0.95rem 2.25rem' }}>
        Testar 7 Dias Grátis <ArrowRight className="w-3.5 h-3.5" />
      </Link>
      <button
        onClick={() => scrollToSection('plans')}
        className="lp-btn-outline"
        style={{ borderRadius: '8px', borderColor: 'rgba(255,255,255,0.12)', color: '#a89890', fontSize: '0.75rem', padding: '0.95rem 2.25rem' }}
      >
        Ver Planos
      </button>
    </div>
  </div>
</section>
```

**Step 3: Verificar**

Uma seção escura com headline grande em itálico + rose gold + dois CTAs deve aparecer logo antes do footer.

**Step 4: Commit**
```bash
git add pages/LandingPage.tsx
git commit -m "feat(landing): add dark CTA final section before footer"
```

---

### Task 5: Cards com border-radius 12px e soft shadows

**Files:**
- Modify: `pages/LandingPage.tsx` — LP_STYLES + inline styles

**Step 1: Atualizar `LP_STYLES` — botões de `1px` para `8px`**

Nos blocos `.lp-btn-solid` e `.lp-btn-outline`, trocar:
```css
border-radius: 1px;
```
por:
```css
border-radius: 8px;
```

**Step 2: Cards de Dores/Soluções (linhas 388 e 405)**

Trocar `borderRadius: '1px'` por `borderRadius: '12px'` e adicionar shadow:
```tsx
// Card problema
style={{ background: '#fdf5f4', border: '1px solid #f0ddd9', padding: '2.25rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(26,21,18,0.05)', transition: 'all 0.3s ease' }}

// Card solução
style={{ background: '#f3fbf6', border: '1px solid #c8ead8', padding: '2.25rem', borderRadius: '12px', boxShadow: '0 10px 30px rgba(26,21,18,0.05)', transition: 'all 0.3s ease' }}
```

**Step 3: Cards de Planos (linha 692)**

Trocar `borderRadius: '1px'` por `borderRadius: '12px'`:
```tsx
borderRadius: '12px',
```

**Step 4: Cards de Tecnologia (linha 768)**

O container externo tem `borderRadius: '1px'` — trocar por `borderRadius: '12px'`.
Os cards internos não têm border-radius individual, ok manter assim.

**Step 5: Ícones das seções com border-radius**

Nas linhas ~390, ~408, ~462, ~779 onde há `borderRadius: '1px'` em ícones/badges:
Trocar por `borderRadius: '8px'`.

**Step 6: Floating cards do Hero (notificação e receita, linhas 319 e 343)**

Trocar `borderRadius: '1px'` por `borderRadius: '10px'`.
*(Só se ainda existirem — se o mockup substituiu a foto, esses cards também foram removidos na Task 2)*

**Step 7: Verificar visualmente — todos os cards devem ter cantos suaves**

**Step 8: Commit**
```bash
git add pages/LandingPage.tsx
git commit -m "feat(landing): soft border-radius 12px and shadows on all cards"
```

---

### Task 6: Deploy

**Step 1: Build local para checar erros TypeScript**
```bash
npm run build
```
Expected: sem erros de tipo.

**Step 2: Deploy para produção**
```bash
vercel --prod --yes
```

**Step 3: Verificar no browser (aura-system-mu.vercel.app)**

Checklist visual:
- [ ] Hero tem gradiente rosé no canto superior esquerdo
- [ ] Mockup do dashboard aparece no desktop, some no mobile
- [ ] Seção "Antes vs Depois" tem fundo rosé suave
- [ ] Seção CTA escura aparece antes do footer
- [ ] Todos os botões têm cantos arredondados (8px)
- [ ] Cards de Dores, Planos e Tecnologia têm border-radius 12px e sombra suave

**Step 4: Commit final se necessário**
```bash
git add pages/LandingPage.tsx
git commit -m "feat(landing): landing page redesign complete"
```
