# WhatsApp Automático — Plano de Integração
> Decisões de arquitetura definidas em Março 2026 | Implementar futuramente

---

## Objetivo

Permitir que o Aura System envie mensagens automáticas de WhatsApp para os pacientes das clínicas — inicialmente para **NPS pós-atendimento**, expandindo depois para lembretes, reativação e marketing.

---

## Decisões de Arquitetura

### Modelo escolhido: BSP intermediário (Opção B)

**Fluxo:**
```
Aura System → Zenvia (ou Twilio) → Meta (API Oficial) → WhatsApp do paciente
```

- Todas as mensagens saem de **um número do Aura System** (não da clínica)
- A clínica não precisa fazer nada — só ativar a funcionalidade no painel
- É o mesmo modelo que o Trinks e outros SaaS do mercado usam

**Motivo de não usar Evolution API / Z-API / WPPConnect:**
- APIs não oficiais — WhatsApp bane números que as utilizam
- Em um SaaS com muitas clínicas, um ban derruba todas as clínicas ao mesmo tempo
- Inaceitável para um produto de produção

**Motivo de não usar API direta da Meta por clínica (Opção C):**
- Clínica teria que criar conta Meta Business, aguardar validação, configurar número
- Fricção de onboarding inaceitável para o usuário final

---

## Provedor Recomendado

**Zenvia** (brasileiro, suporte em PT-BR) ou **Twilio** (global, mais robusto)

**Custo estimado por mensagem:**
- Zenvia: ~R$ 0,12–0,18 por mensagem
- Meta cobra adicionalmente: gratuito até 1.000/mês (mensagens de utilidade), ~R$ 0,08 acima disso

**Modelo de monetização para o Aura:**
- Curto prazo: incluído no plano Premium (absorver custo)
- Médio prazo: sistema de créditos — clínica compra créditos dentro do Aura

---

## Controle Anti-Ban

### O que o BSP (Zenvia/Twilio) controla automaticamente
- Rate limiting e fila de envio (nunca dispara tudo de uma vez)
- Reputação consolidada com a Meta (conta BSP já tem histórico positivo)
- Templates pré-aprovados pela Meta

### Sistema de tiers da Meta (automático)
```
Tier 1 → 1.000 mensagens únicas/dia    (começa aqui)
Tier 2 → 10.000/dia                    (sobe com bom histórico)
Tier 3 → 100.000/dia
Tier 4 → Ilimitado
```
O tier sobe automaticamente conforme o histórico de envios sem reclamações.

### O que o Aura precisa implementar no código
- **Opt-out obrigatório**: paciente responde "SAIR" ou "PARAR" → nunca mais recebe mensagens
- **Frequência máxima**: 1 NPS por atendimento fechado, máximo 1 mensagem/semana por paciente
- **Janela de envio**: apenas entre 9h–20h (horário de Brasília)
- **Delay pós-atendimento**: enviar 2–4h após fechamento do atendimento (não imediatamente)
- **Blacklist de pacientes**: controle de quem optou por não receber mensagens

---

## Templates a criar (aprovar na Meta)

### 1. NPS pós-atendimento
```
Oi {{nome_paciente}}! 👋

A {{nome_clinica}} quer saber como foi seu atendimento hoje.

De 0 a 10, qual nota você daria?

0️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🔟

Responda com o número. Para parar de receber mensagens, responda SAIR.
```

### 2. Lembrete de agendamento (futuro)
```
Oi {{nome_paciente}}! 👋

Lembrete: você tem um agendamento amanhã ({{data}}) às {{hora}} na {{nome_clinica}}.

Confirme respondendo SIM ou cancele respondendo NÃO.
```

### 3. Reativação (futuro)
```
Oi {{nome_paciente}}! Sentimos sua falta na {{nome_clinica}} 💆‍♀️

Faz {{dias}} dias desde seu último atendimento. Que tal agendar?

👉 {{link_agendamento}}
```

---

## Funcionalidades a implementar no Aura

### Fase 1 — NPS automático
- [ ] Integração com Zenvia/Twilio (configurar conta e API key)
- [ ] Trigger: quando atendimento é marcado como "Concluído" → agenda envio com delay de 3h
- [ ] Template NPS aprovado na Meta
- [ ] Processamento de respostas (0–10 → salvar nota no banco)
- [ ] Tela de resultados NPS no painel (média, distribuição, comentários)
- [ ] Sistema de opt-out (banco de dados de números bloqueados)
- [ ] Configuração por clínica: ativar/desativar, personalizar horário de envio

### Fase 2 — Lembretes de agendamento
- [ ] Template de lembrete aprovado
- [ ] Configuração de antecedência (24h, 2h antes)
- [ ] Confirmação/cancelamento via resposta WhatsApp

### Fase 3 — Marketing e reativação
- [ ] Template de reativação
- [ ] Configuração de régua: X dias sem visita → disparo automático
- [ ] Sistema de créditos para clínicas (monetização)

---

## Estrutura de banco de dados necessária (Prisma)

```prisma
model WhatsappOptOut {
  id          String   @id @default(cuid())
  phone       String   @unique
  companyId   String
  createdAt   DateTime @default(now())
}

model NpsResponse {
  id             String      @id @default(cuid())
  appointmentId  String      @unique
  patientId      String
  companyId      String
  score          Int         // 0-10
  sentAt         DateTime
  respondedAt    DateTime?
  createdAt      DateTime    @default(now())
}

model WhatsappMessage {
  id          String   @id @default(cuid())
  companyId   String
  patientId   String
  type        String   // 'nps' | 'reminder' | 'reactivation'
  status      String   // 'queued' | 'sent' | 'delivered' | 'failed'
  sentAt      DateTime?
  createdAt   DateTime @default(now())
}
```

---

## Estimativa de custo para o Aura

Exemplo com 100 clínicas, cada uma com 100 atendimentos/mês:
- 10.000 mensagens NPS/mês
- Custo Zenvia: ~R$ 1.200–1.800/mês
- Se cobrar R$ 29/mês por módulo WhatsApp: R$ 2.900 de receita → margem positiva

---

## Referências
- [Zenvia WhatsApp API](https://zenvia.com)
- [Twilio WhatsApp Business](https://twilio.com/whatsapp)
- [Meta Business Solution Providers](https://business.facebook.com/business/m/whatsapp/get-started)
- [WhatsApp Business Policy](https://business.whatsapp.com/policy)
