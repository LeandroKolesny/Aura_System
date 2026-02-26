# Landing Page Redesign — Design Document
**Data:** 2026-02-26

## Contexto

A landing page atual já tem boa base (Cormorant Garamond, DM Sans, fundo cream `#fdfaf7`, animações scroll). O redesign foca nos três gaps identificados: hero sem destaque, ausência de color blocking entre seções, e falta de profundidade visual (sombras, border-radius, mockup).

---

## O Que Muda

### 1. Hero Section

**Layout:** duas colunas no desktop (copy esquerda, mockup direita). Mobile: stack vertical, mockup some.

**Fundo:** gradiente radial — `rgba(189,123,101,0.09)` no canto superior esquerdo dissolvendo em `#fdfaf7` até 60% da largura. Cria entrada da marca sem bloco sólido.

**Headline:** ~64–72px desktop. Uma palavra em itálico (recurso tipográfico premium).
Exemplo: *"Gerencie sua clínica"* + **"com elegância."**

**CTAs:** dois botões com `border-radius: 8px`.
- Primário: rose gold sólido `#bd7b65`
- Secundário: outline `border: 1px solid #d8cec8`

**Mockup simulado:** componente React puro (sem imagens externas). Janela de browser estilizada com:
- Barra de topo com 3 pontinhos + título "Aura System"
- 3 KPI cards (Receita, Consultas, Satisfação)
- Mini gráfico de barras (receita 7 dias)
- Lista de próximos agendamentos (3 itens fictícios)

Inclinado `rotate(-1.5deg)`, sombra `0 32px 64px rgba(26,21,18,0.12)`.

---

### 2. Color Blocking (mapa de seções)

| Seção | Fundo |
|-------|-------|
| Hero | gradiente rosé → cream |
| Pilares / Benefícios | `#ffffff` |
| Demo / Tabs | `#fdfaf7` cream |
| Depoimentos | `rgba(189,123,101,0.06)` rosé suave |
| Preços | `#ffffff` |
| FAQ | `#fdfaf7` cream |
| CTA final + Rodapé | `#1a1512` escuro |

**Transições:** seções coloridas/escuras usam `clip-path` ou `border-radius` no topo para evitar corte reto entre seções.

---

### 3. Cards, Sombras e Border-Radius

**Todos os cards** (funcionalidades, depoimentos, planos):
```css
border-radius: 12px;
box-shadow: 0 10px 30px rgba(26,21,18,0.05);
border: 1px solid #efe8e2;
```

**Hover dos cards:**
```css
box-shadow: 0 20px 40px rgba(26,21,18,0.09);
transform: translateY(-3px);
transition: all 0.3s ease;
```

**Botões:** `border-radius: 8px` (vs. `1px` atual).

---

### 4. Seção Escura (CTA Final + Rodapé)

Fundo `#1a1512`. Texto cream. Botão rose gold destaca com máximo contraste.
Headline em Cormorant Garamond grande (italic) sobre fundo escuro = efeito editorial premium.

---

## O Que NÃO Muda

- Paleta de cores (rose gold `#bd7b65`, cream `#fdfaf7`, ink `#1a1512`)
- Tipografia (Cormorant Garamond + DM Sans)
- Conteúdo textual de todas as seções
- Animações `.reveal` no scroll (já existentes)
- Estrutura de navegação e seções (mesma ordem)

---

## Critérios de Sucesso

- Hero visualmente distinguível do restante da página
- Pelo menos 4 "ambientes" visuais diferentes percebidos no scroll
- Mockup renderizando sem erros em desktop e escondido em mobile
- Cards com sombra e hover flutuante em todas as seções
- CTA final escuro com botão rose gold destacado
