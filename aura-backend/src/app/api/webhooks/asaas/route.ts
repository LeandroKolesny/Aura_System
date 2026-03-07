import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Mapa: valor do pagamento → plan enum
const VALUE_TO_PLAN: Record<number, string> = {
  97: 'STARTER',
  197: 'PROFESSIONAL',
  397: 'PREMIUM',
};

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    customer: string;
    subscription?: string;
    status: string;
    value: number;
    dueDate: string;
  };
  subscription?: {
    id: string;
    customer: string;
    status: string;
  };
}

export async function POST(request: NextRequest) {
  // Validar token de autenticação do Asaas
  const webhookToken = request.headers.get('asaas-access-token');
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

  if (expectedToken && webhookToken !== expectedToken) {
    console.warn('[Asaas Webhook] Token inválido — requisição rejeitada');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: AsaasWebhookPayload;

  try {
    payload = await request.json() as AsaasWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event, payment, subscription } = payload;

  // Encontrar empresa pelo asaasCustomerId
  const customerId = payment?.customer ?? subscription?.customer;
  if (!customerId) {
    return NextResponse.json({ ok: true }); // ignorar eventos sem customer
  }

  const company = await prisma.company.findFirst({
    where: { asaasCustomerId: customerId },
  });

  if (!company) {
    // Pode ser evento de teste do Asaas — retornar 200 mesmo assim
    return NextResponse.json({ ok: true });
  }

  if (event === 'PAYMENT_CONFIRMED' && payment) {
    // Descobrir qual plano pelo valor do pagamento
    const plan = VALUE_TO_PLAN[payment.value] ?? 'STARTER';

    // Calcular nova data de expiração (+1 mês)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await prisma.company.update({
      where: { id: company.id },
      data: {
        plan: plan as any,
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: expiresAt,
      },
    });

    console.log(`[Asaas Webhook] Pagamento confirmado — empresa ${company.id} → plano ${plan}`);
  }

  if (event === 'PAYMENT_OVERDUE' && payment) {
    await prisma.company.update({
      where: { id: company.id },
      data: { subscriptionStatus: 'OVERDUE' },
    });

    console.log(`[Asaas Webhook] Pagamento vencido — empresa ${company.id}`);
  }

  if (event === 'SUBSCRIPTION_INACTIVATED' || event === 'PAYMENT_DELETED') {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        subscriptionStatus: 'CANCELED',
        asaasSubscriptionId: null,
      },
    });

    console.log(`[Asaas Webhook] Assinatura cancelada — empresa ${company.id}`);
  }

  return NextResponse.json({ ok: true });
}
