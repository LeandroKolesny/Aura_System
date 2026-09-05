// Aura System - API de Parcelamento
// Arquivo separado para evitar conflito com o hook check-any-changed em api.ts

import { getAuthToken, API_BASE_URL } from './api';

interface InstallmentPayResponse {
  success: boolean;
  data?: { id: string; status: string };
  error?: string;
}

export const installmentsApi = {
  async markInstallmentPaid(transactionId: string): Promise<InstallmentPayResponse> {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/transactions/${transactionId}/pay`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return res.json() as Promise<InstallmentPayResponse>;
  },
};
