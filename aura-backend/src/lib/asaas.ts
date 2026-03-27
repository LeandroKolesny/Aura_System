// aura-backend/src/lib/asaas.ts
// Cliente para a API REST do Asaas (PIX + boleto + recorrência)

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

function getAsaasBaseUrl(): string {
  if (process.env.ASAAS_BASE_URL) return process.env.ASAAS_BASE_URL;
  const isSandbox = process.env.ASAAS_SANDBOX?.trim() === 'true';
  if (isSandbox || process.env.NODE_ENV !== 'production') {
    return 'https://sandbox.asaas.com/api/v3';
  }
  return 'https://api.asaas.com/api/v3';
}

async function asaasRequest<T>(
  method: string,
  path: string,
  body?: object
): Promise<T> {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY not configured');
  }

  const ASAAS_BASE_URL = getAsaasBaseUrl();
  const url = `${ASAAS_BASE_URL}${path}`;
  console.log(`[Asaas] SANDBOX=${process.env.ASAAS_SANDBOX} BASE=${ASAAS_BASE_URL} → ${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Asaas] Erro ${res.status} em ${method} ${url}: ${text}`);
    throw new Error(`Asaas API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  status: string;
  value: number;
  nextDueDate: string;
}

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCodeUrl: string | null;
  billingType: string;
}

export interface AsaasCustomerListResponse {
  data: AsaasCustomer[];
  totalCount: number;
}

export interface AsaasPaymentListResponse {
  data: AsaasPayment[];
}

/** Busca cliente Asaas pelo email. Retorna null se não encontrar. */
export async function findCustomerByEmail(email: string): Promise<AsaasCustomer | null> {
  const result = await asaasRequest<AsaasCustomerListResponse>(
    'GET',
    `/customers?email=${encodeURIComponent(email)}&limit=1`
  );
  return result.data[0] ?? null;
}

/** Cria cliente no Asaas */
export async function createCustomer(data: {
  name: string;
  email: string;
  cpfCnpj?: string;
}): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>('POST', '/customers', data);
}

/** Cria assinatura mensal no Asaas */
export async function createSubscription(data: {
  customer: string;
  billingType: 'BOLETO' | 'PIX' | 'UNDEFINED';
  value: number;
  nextDueDate: string; // 'YYYY-MM-DD'
  description: string;
  externalReference?: string; // planEnum salvo para resolução no webhook
}): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>('POST', '/subscriptions', {
    ...data,
    cycle: 'MONTHLY',
  });
}

/** Busca o primeiro pagamento da assinatura (para obter link de pagamento) */
export async function getSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
  const result = await asaasRequest<AsaasPaymentListResponse>(
    'GET',
    `/subscriptions/${subscriptionId}/payments?limit=1`
  );
  return result.data;
}

/** Cancela assinatura no Asaas */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await asaasRequest<unknown>('DELETE', `/subscriptions/${subscriptionId}`);
}
