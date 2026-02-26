// Aura System - Serviço de IA
// Chama o backend que tem acesso seguro à API do Gemini

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Função auxiliar para chamar a API de IA do backend
async function callAIEndpoint(type: string, data: Record<string, any>): Promise<string> {
  try {
    const token = localStorage.getItem('aura_token');

    const response = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ type, data })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erro na API de IA:', result.error);
      return result.error || 'Erro ao gerar mensagem';
    }

    return result.message || 'Erro ao gerar mensagem';
  } catch (error) {
    console.error('Erro ao chamar API de IA:', error);
    return 'Erro de conexão com o servidor';
  }
}

export const summarizeAnamnesis = async (notes: string): Promise<string> => {
  return callAIEndpoint('anamnesis', { notes });
};

export const generateFollowUpMessage = async (patientName: string, procedure: string, clinicName: string): Promise<string> => {
  return callAIEndpoint('followup', { patientName, procedure, clinicName });
};

export const generateReturnMessage = async (patientName: string, lastProcedure: string, daysAgo: number, clinicName: string): Promise<string> => {
  return callAIEndpoint('return', { patientName, lastProcedure, daysAgo, clinicName });
};

export const generateRetentionMessage = async (clinicName: string, daysCount: number, planName: string, scenario: 'overdue' | 'expiring' | 'upsell' | 'winback'): Promise<string> => {
  return callAIEndpoint('retention', { clinicName, daysCount, planName, scenario });
};

export const generateBirthdayMessage = async (patientName: string, age: number, clinicName: string, isToday: boolean = false): Promise<string> => {
  return callAIEndpoint('birthday', { patientName, age, clinicName, isToday });
};
