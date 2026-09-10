// Aura System - API de IA (Gemini)
// Endpoint seguro para geração de mensagens com IA
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { checkModuleAccess } from "@/lib/apiGuards";
import { GoogleGenAI } from "@google/genai";
import { SAAS_COMPANY_NAME } from "@/lib/constants";

// Lazy initialization
let ai: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI | null => {
  if (ai) return ai;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not configured");
    return null;
  }

  ai = new GoogleGenAI({ apiKey });
  return ai;
};

// Sanitiza inputs para evitar prompt injection
const sanitizeInput = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>]/g, '')          // Remove HTML tags
    .replace(/\n|\r/g, ' ')        // Remove quebras de linha que podem escapar o prompt
    .replace(/```/g, '')           // Remove code blocks
    .replace(/---/g, '')           // Remove separadores
    .slice(0, 200)                 // Limita tamanho para evitar prompt overflow
    .trim();
};

// Limpar texto de formatação markdown
const cleanText = (text: string): string => {
  return text
    .replace(/\*\*/g, '')
    .replace(/^Com certeza[\s\S]*?:/i, '')
    .replace(/^Aqui está[\s\S]*?:/i, '')
    .replace(/---/g, '')
    .replace(/^"/, '')
    .replace(/"$/, '')
    .trim();
};

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // RBAC: paciente nunca gera mensagens de IA (o portal do paciente não usa
    // esta rota). Só equipe da clínica / OWNER.
    if (authUser.role === "PATIENT") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ error: "Tipo e dados são obrigatórios" }, { status: 400 });
    }

    // A geração de retenção B2B (Customer Success SaaS) é exclusiva do OWNER da
    // plataforma — clínicas não disparam campanha de churn/upsell para si mesmas.
    if (type === "retention" && authUser.role !== "OWNER") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Gate de plano: recursos de IA exigem o módulo "ai_features" OU "crm"
    // habilitado no plano contratado. O OWNER da plataforma não tem companyId
    // e passa direto (não está sujeito a plano de clínica).
    if (authUser.role !== "OWNER") {
      const aiBlocked = await checkModuleAccess(authUser, "ai_features");
      if (aiBlocked) {
        const crmBlocked = await checkModuleAccess(authUser, "crm");
        if (crmBlocked) return crmBlocked;
      }
    }

    const aiInstance = getAI();

    let message: string;
    const model = 'gemini-2.0-flash';

    // Gerar mensagem baseada no tipo
    switch (type) {
      case 'return': {
        // Mensagem de retorno para cliente inativo
        const patientName = sanitizeInput(data.patientName);
        const lastProcedure = sanitizeInput(data.lastProcedure);
        const daysAgo = Number(data.daysAgo) || 0;
        const clinicName = sanitizeInput(data.clinicName);

        if (!aiInstance) {
          message = `Olá ${patientName}, já faz ${daysAgo} dias desde o seu ${lastProcedure}. Que tal agendar uma manutenção? - ${clinicName}`;
        } else {
          const prompt = `
            Aja como um especialista em marketing para clínicas de estética. Gere APENAS o texto de uma mensagem de WhatsApp para convidar um cliente a retornar.

            Dados:
            - Paciente: ${patientName}
            - Último Procedimento: ${lastProcedure}
            - Tempo desde a visita: ${daysAgo} dias
            - Clínica: ${clinicName}

            Objetivo: Convidar o paciente para uma nova visita de manutenção ou novo ciclo de tratamento.

            Instruções Obrigatórias:
            1. A mensagem deve ser curta, persuasiva e elegante (Premium).
            2. Mencione explicitamente que já se passaram ${daysAgo} dias desde o procedimento "${lastProcedure}".
            3. NÃO use formatação Markdown.
            4. NÃO inclua textos introdutórios.
            5. Comece com "Olá ${patientName},"
            6. JAMAIS ofereça "avaliação gratuita" ou use a palavra "grátis".
          `;

          const response = await aiInstance.models.generateContent({ model, contents: prompt });
          message = cleanText(response.text || "Erro ao gerar mensagem.");
        }
        break;
      }

      case 'birthday': {
        // Mensagem de aniversário
        const patientName = sanitizeInput(data.patientName);
        const age = Number(data.age) || 0;
        const clinicName = sanitizeInput(data.clinicName);
        const isToday = Boolean(data.isToday);

        if (!aiInstance) {
          message = isToday
            ? `Olá ${patientName}! Hoje é seu dia especial! Nós da ${clinicName} desejamos um feliz aniversário cheio de alegria e realizações!`
            : `Olá ${patientName}! Seu aniversário está chegando e nós da ${clinicName} queremos celebrar com você!`;
        } else {
          const prompt = `
            Aja como um especialista em marketing de relacionamento para clínicas de estética premium. Gere APENAS o texto de uma mensagem de WhatsApp de aniversário.

            Dados:
            - Paciente: ${patientName}
            - Idade que está completando: ${age} anos
            - Clínica: ${clinicName}
            - ${isToday ? 'HOJE é o aniversário!' : 'O aniversário está próximo'}

            Instruções Obrigatórias:
            1. A mensagem deve ser CALOROSA, ELEGANTE e PERSONALIZADA.
            2. ${isToday ? 'Parabenize efusivamente pelo dia especial.' : 'Antecipe os votos de feliz aniversário.'}
            3. NÃO use formatação Markdown.
            4. Comece com "Olá ${patientName}!" ou "Querida ${patientName},".
            5. Use emojis com moderação (1-3 no máximo: 🎂🎉💕).
            6. Seja breve (3-4 frases no máximo).
          `;

          const response = await aiInstance.models.generateContent({ model, contents: prompt });
          message = cleanText(response.text || "Erro ao gerar mensagem.");
        }
        break;
      }

      case 'followup': {
        // Mensagem de follow-up pós procedimento
        const patientName = sanitizeInput(data.patientName);
        const procedure = sanitizeInput(data.procedure);
        const clinicName = sanitizeInput(data.clinicName);

        if (!aiInstance) {
          message = `Olá ${patientName}, como está sua recuperação após o ${procedure}? Qualquer dúvida estamos à disposição! - ${clinicName}`;
        } else {
          const prompt = `
            Gere APENAS o texto de uma mensagem de WhatsApp para pós-venda estético.

            Dados:
            - Paciente: ${patientName}
            - Procedimento: ${procedure}
            - Clínica: ${clinicName}

            Instruções:
            1. Pergunte como está a recuperação.
            2. Tom Premium, acolhedor e profissional.
            3. NÃO use formatação Markdown.
            4. Comece com "Olá ${patientName},"
            5. NUNCA ofereça serviço gratuito.
          `;

          const response = await aiInstance.models.generateContent({ model, contents: prompt });
          message = cleanText(response.text || "Erro ao gerar mensagem.");
        }
        break;
      }

      case 'retention': {
        // Mensagem de retenção B2B (SaaS)
        const clinicName = sanitizeInput(data.clinicName);
        const daysCount = Number(data.daysCount) || 0;
        const planName = sanitizeInput(data.planName);
        const scenario = sanitizeInput(data.scenario);

        if (!aiInstance) {
          message = `Olá equipe ${clinicName}, entre em contato conosco sobre o plano ${planName}. - ${SAAS_COMPANY_NAME}`;
        } else {
          let promptContext = "";
          switch (scenario) {
            case 'overdue':
              promptContext = `SITUAÇÃO CRÍTICA: Pagamento VENCIDO há ${daysCount} dias. OBJETIVO: Cobrança amigável.`;
              break;
            case 'expiring':
              promptContext = `SITUAÇÃO: Assinatura vence em ${daysCount} dias. OBJETIVO: Lembrete de renovação.`;
              break;
            case 'winback':
              promptContext = `SITUAÇÃO: Cliente antigo que cancelou. OBJETIVO: Recuperar o cliente.`;
              break;
            default:
              promptContext = `SITUAÇÃO: Cliente no plano básico. OBJETIVO: Oferecer upgrade.`;
          }

          const prompt = `
            Aja como um Gerente de Contas do software "${SAAS_COMPANY_NAME}".
            Gere APENAS o texto de uma mensagem curta de WhatsApp.

            Dados:
            - Clínica: ${clinicName}
            - Plano: ${planName}

            ${promptContext}

            Instruções:
            1. NÃO use Markdown.
            2. Comece com "Olá equipe ${clinicName},".
            3. Seja breve (máximo 3 frases).
          `;

          const response = await aiInstance.models.generateContent({ model, contents: prompt });
          message = cleanText(response.text || "Erro ao gerar mensagem.");
        }
        break;
      }

      case 'anamnesis': {
        // Resumo de anamnese
        const notes = sanitizeInput(data.notes);

        if (!aiInstance) {
          message = "Funcionalidade de IA não disponível. Configure a API Key do Gemini.";
        } else {
          const prompt = `
            Você é um assistente médico especialista em estética.
            Analise as seguintes anotações de anamnese e crie um resumo clínico conciso.
            Destaque alergias, procedimentos anteriores e queixas principais.

            Anotações:
            ${notes}
          `;

          const response = await aiInstance.models.generateContent({ model, contents: prompt });
          message = response.text || "Não foi possível gerar o resumo.";
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Tipo de mensagem não suportado" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message });

  } catch (error) {
    console.error("Erro na API de IA:", error);
    return NextResponse.json({ error: "Erro ao gerar mensagem" }, { status: 500 });
  }
}
