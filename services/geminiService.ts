import { GoogleGenAI } from "@google/genai";

// Lazy initialization to prevent app crash when API_KEY is not set
let ai: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI | null => {
  if (ai) return ai;

  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key not configured. AI features will be disabled.");
    return null;
  }

  ai = new GoogleGenAI({ apiKey });
  return ai;
};

export const summarizeAnamnesis = async (notes: string): Promise<string> => {
  try {
    const aiInstance = getAI();
    if (!aiInstance) {
      return "Funcionalidade de IA não disponível. Configure a API Key do Gemini.";
    }

    // Using gemini-2.0-flash for Basic Text Tasks
    const model = 'gemini-2.0-flash';
    const prompt = `
      Você é um assistente médico especialista em estética.
      Analise as seguintes anotações de anamnese de um paciente e crie um resumo clínico conciso e profissional.
      Destaque alergias, procedimentos anteriores e queixas principais.
      Use linguagem técnica adequada.

      Anotações:
      ${notes}
    `;

    const response = await aiInstance.models.generateContent({
      model,
      contents: prompt,
    });

    // Accessing .text property directly as per GenerateContentResponse definition
    return response.text || "Não foi possível gerar o resumo.";
  } catch (error) {
    console.error("Erro ao chamar Gemini:", error);
    return "Erro ao processar a solicitação de IA.";
  }
};

export const generateFollowUpMessage = async (patientName: string, procedure: string, clinicName: string): Promise<string> => {
  try {
    const aiInstance = getAI();
    if (!aiInstance) {
      return "Funcionalidade de IA não disponível. Configure a API Key do Gemini.";
    }

    // Using gemini-2.0-flash for text generation
    const model = 'gemini-2.0-flash';
    const prompt = `
      Aja como um sistema de automação. Gere APENAS o texto de uma mensagem de WhatsApp para pós-venda estético.

      Dados:
      - Paciente: ${patientName}
      - Procedimento: ${procedure}
      - Clínica: ${clinicName}

      Instruções Obrigatórias:
      1. A mensagem deve ser atenciosa, perguntar como está a recuperação e lembrar de evitar sol (se aplicável).
      2. Tom de voz: Premium, acolhedor e profissional.
      3. NÃO use formatação Markdown (não use asteriscos ** para negrito).
      4. NÃO inclua textos introdutórios como "Aqui está uma sugestão" ou "Com certeza".
      5. NÃO use linhas separadoras (---).
      6. Comece a resposta diretamente com "Olá ${patientName},"
      7. Assine com o nome da clínica ("${clinicName}").
      8. **REGRA CRÍTICA:** NUNCA ofereça "avaliação gratuita", "retorno grátis", "cortesia" ou qualquer serviço sem custo. Se sugerir um retorno, use termos como "agendar um acompanhamento" ou "marcar uma revisão".
    `;

    const response = await aiInstance.models.generateContent({
      model,
      contents: prompt,
    });

    let text = response.text || "Erro ao gerar mensagem.";

    // Limpeza extra via código para garantir que não haja "lixo" na mensagem
    text = text
      .replace(/\*\*/g, '') // Remove negrito (Markdown)
      .replace(/^Com certeza[\s\S]*?:/i, '') // Remove frases de confirmação comuns
      .replace(/^Aqui está[\s\S]*?:/i, '') // Remove frases de introdução
      .replace(/---/g, '') // Remove linhas separadoras
      .trim(); // Remove espaços extras no início e fim

    return text;
  } catch (error) {
    console.error("Erro ao chamar Gemini:", error);
    return "Erro ao gerar mensagem.";
  }
};

export const generateReturnMessage = async (patientName: string, lastProcedure: string, daysAgo: number, clinicName: string): Promise<string> => {
  try {
    const aiInstance = getAI();
    if (!aiInstance) {
      return `Olá ${patientName}, já faz ${daysAgo} dias desde o seu ${lastProcedure}. Que tal agendar uma manutenção? - ${clinicName}`;
    }

    const model = 'gemini-2.0-flash';
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
      2. **CRUCIAL:** Mencione explicitamente que já se passaram ${daysAgo} dias (ou converta para meses se fizer sentido) desde o procedimento "${lastProcedure}" e relacione isso à necessidade de manutenção ou perda do efeito.
      3. Mostre que a clínica se importa com a durabilidade dos resultados.
      4. NÃO use formatação Markdown.
      5. NÃO inclua textos introdutórios.
      6. Termine com uma pergunta convidativa (Call to Action) para agendar.
      7. Comece com "Olá ${patientName},"
      8. **REGRA DE OURO (PROIBIDO):** JAMAIS ofereça "avaliação gratuita", "consulta grátis" ou use a palavra "grátis/cortesia".
      9. **DIRECIONAMENTO:** Sempre convide para "agendar uma avaliação especializada", "consultar nossos valores atuais", "verificar disponibilidade" ou "fazer um agendamento". O tom deve valorizar o serviço médico/estético.
    `;

    const response = await aiInstance.models.generateContent({
      model,
      contents: prompt,
    });

    let text = response.text || "Erro ao gerar mensagem.";

    text = text
      .replace(/\*\*/g, '')
      .replace(/^Com certeza[\s\S]*?:/i, '')
      .replace(/^Aqui está[\s\S]*?:/i, '')
      .replace(/---/g, '')
      .trim();

    return text;
  } catch (error) {
    console.error("Erro ao chamar Gemini:", error);
    return "Erro ao gerar mensagem de retorno.";
  }
};

export const generateRetentionMessage = async (clinicName: string, daysCount: number, planName: string, scenario: 'overdue' | 'expiring' | 'upsell' | 'winback'): Promise<string> => {
  try {
    const aiInstance = getAI();
    if (!aiInstance) {
      return `Olá equipe ${clinicName}, entre em contato conosco sobre o plano ${planName}. - Aura System`;
    }

    const model = 'gemini-2.0-flash';
    let promptContext = "";

    switch (scenario) {
        case 'overdue':
            promptContext = `
              SITUAÇÃO CRÍTICA: O cliente está com o pagamento da assinatura do plano "${planName}" VENCIDO há ${daysCount} dias.
              OBJETIVO: Realizar uma cobrança amigável e profissional.
              TOM: Parceiro, mas firme. Lembrar que a regularização é importante para manter o acesso ao sistema Aura.
              Evite termos agressivos, foque em "evitar interrupção do serviço".
            `;
            break;
        case 'expiring':
            promptContext = `
              SITUAÇÃO: A assinatura do plano "${planName}" vence em ${daysCount} dias.
              OBJETIVO: Lembrete preventivo de renovação.
              TOM: Prestativo e Customer Success. Perguntar se já receberam o boleto ou precisam de ajuda para renovar.
            `;
            break;
        case 'winback':
            promptContext = `
              SITUAÇÃO: Cliente antigo que cancelou ou teve o plano "${planName}" encerrado.
              OBJETIVO: Tentar recuperar o cliente (Win-back).
              TOM: Saudade, novidades. Mencionar que o sistema tem novas funcionalidades de IA e convidá-los a reativar.
            `;
            break;
        case 'upsell':
        default:
            promptContext = `
              SITUAÇÃO: Cliente está no plano básico.
              OBJETIVO: Oferecer upgrade para o plano "${planName}" (ou superior).
              TOM: Focado em crescimento. Mencionar como o plano superior pode ajudar a clínica a faturar mais.
            `;
            break;
    }

    const prompt = `
      Aja como um Gerente de Contas (Customer Success) do software "Aura System". 
      Gere APENAS o texto de uma mensagem curta e direta de WhatsApp para o dono da clínica.
      
      Dados:
      - Clínica Cliente: ${clinicName}
      - Plano Referência: ${planName}
      
      ${promptContext}
      
      Instruções Obrigatórias:
      1. NÃO use formatação Markdown.
      2. NÃO inclua textos introdutórios ou aspas.
      3. Comece com "Olá equipe ${clinicName}," ou "Olá gestão da ${clinicName},".
      4. Seja breve (máximo 3 frases).
      5. Termine com uma pergunta ou link para ação.
    `;

    const response = await aiInstance.models.generateContent({
      model,
      contents: prompt,
    });

    let text = response.text || "Erro ao gerar mensagem.";

    text = text
      .replace(/\*\*/g, '')
      .replace(/^Com certeza[\s\S]*?:/i, '')
      .replace(/^Aqui está[\s\S]*?:/i, '')
      .replace(/---/g, '')
      .replace(/^"/, '')
      .replace(/"$/, '')
      .trim();

    return text;
  } catch (error) {
    console.error("Erro ao chamar Gemini:", error);
    return "Erro ao gerar mensagem de retenção.";
  }
};
