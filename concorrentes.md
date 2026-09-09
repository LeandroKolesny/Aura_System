# Pesquisa de Concorrentes — Aura System

_Levantamento feito em 05/09/2026. Preços e informações públicas encontradas via busca na web — sempre bom reconfirmar direto no site do concorrente antes de usar em material de venda, pois preços mudam com frequência._

## Tabela comparativa de preços

| Concorrente | Preço mensal | Perfil / características | Fonte |
|---|---|---|---|
| **Trinks** | R$ 76 (1-2 profissionais) → R$ 110 (3-4) → "sob consulta" acima disso | Foco em salão de beleza; ficha de anamnese genérica — falta campo de contraindicação por procedimento estético e histórico clínico estruturado | [negocios.trinks.com/planos](https://negocios.trinks.com/planos/) |
| **Belezzia** | A partir de R$ 199/mês | Posicionado pra clínica média/grande; anamnese ANVISA completa, controle de lote/validade, multi-unidade — é o mais completo da comparação, mas também o mais caro | [agendiva.com.br](https://agendiva.com.br/blog/trinks-vs-belezzia-vs-agendiva) |
| **Clinicorp** | Não divulgado publicamente ("sob consulta") | Foco forte em faturamento/vendas; tem "FaceDS" (diagnóstico facial por IA) e confirmação automática via WhatsApp, mas normalmente restrito ao plano Premium/Enterprise. Dois planos: Standard e Premium dentro do "Enterprise" | [clinicorp.com/planos](https://www.clinicorp.com/planos) |
| **Booksy** | Não divulgado no Brasil. Referência internacional: Essentials US$165/mês (2-10 profissionais), Standard US$245/mês (até 20) | Forte em marketplace/descoberta — cliente novo encontra o profissional pelo app. Marca mais forte em barbearia/grooming masculino do que em estética clínica | [capterra.com/booksy](https://www.capterra.com/p/142741/Booksy/) |
| **Mercado geral SMB** (referência de faixa) | R$ 0-20: só teste, muito limitado. R$ 20-50: básico, cobrança por profissional. **R$ 50-80: "melhor custo-benefício"** — mensalidade fixa, agendamento ilimitado. R$ 80-150: recursos avançados (SMS, relatórios). R$ 150+: redes/franquias | — | [spagenda.com](https://spagenda.com/artigo/quanto-custa-sistema-agendamento) |

## Onde o Aura System já está posicionado

Planos atuais (seed de produção): **Starter R$ 97 · Pro R$ 197 · Clinic R$ 397**.

Isso coloca o Aura já na faixa "melhor custo-benefício" do mercado (R$ 50-150), mas entregando desde o plano de entrada recursos que os concorrentes chineses... digo, concorrentes nacionais só liberam nos planos mais caros (ver abaixo).

## Padrões repetidos nos concorrentes = oportunidades de diferenciação

1. **WhatsApp automático / IA trancados em planos caros** — Clinicorp e Trinks só liberam confirmação automática via WhatsApp e recursos de IA nos tiers superiores. O Aura já oferece isso desde os planos mais baratos (conforme `PLAN_PERMISSIONS`).
2. **Ficha de anamnese genérica herdada de sistema de salão** — reclamação recorrente de quem faz procedimento estético de verdade (peeling, botox, preenchimento). Só a Belezzia (a mais cara) tem anamnese ANVISA completa. Um formulário de anamnese com campos de contraindicação por procedimento e histórico clínico estruturado, mesmo nos planos de entrada, é uma frase de venda direta contra Trinks e Clinicorp.
3. **Preço "sob consulta"** (Clinicorp, Trinks acima de 5 profissionais, Booksy no Brasil) — isso é fricção de venda. Preço transparente e público na landing page do Aura já é diferencial competitivo.
4. **Portal do paciente self-service** — nenhum concorrente pesquisado destaca isso como recurso principal. O Aura já tem essa funcionalidade; pode virar bandeira própria de marketing.
5. **Multi-unidade e API personalizada** só aparecem nos tiers mais caros dos concorrentes (Clinicorp Enterprise, Belezzia) — vale conferir se o plano Clinic do Aura já cobre isso pra usar como gancho de upsell.

## Próximos passos sugeridos

- Validar os preços exatos de Clinicorp e Booksy Brasil diretamente com um formulário de contato/demo (não divulgam publicamente).
- Revisar a ficha de anamnese/prontuário do Aura pra confirmar se já tem os campos estruturados citados acima — se sim, virar destaque na landing page; se não, é uma melhoria de produto com apelo comercial claro.
- Considerar uma página de comparação "Aura vs Trinks vs Clinicorp" na landing page (tática que a própria Agendiva usa com sucesso, segundo o artigo comparativo encontrado).
