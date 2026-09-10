import { NextRequest, NextResponse } from 'next/server';
import { Plan } from '@prisma/client';
import prisma from '@/lib/prisma';
import { resolvePlanFromPayment } from '@/lib/billingUtils';
import { buildCycleResetData } from '@/lib/subscriptionCycle';

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    customer: string;
    subscription?: string;
    status: string;
    value: number;
    dueDate: string;
    externalReference?: string | null;
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

  if (!expectedToken || webhookToken !== expectedToken) {
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
    // Preferir externalReference (planEnum salvo no checkout) — fallback para valor
    const plan = resolvePlanFromPayment(payment);

    // Calcular nova data de expiração (+1 mês)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await prisma.company.update({
      where: { id: company.id },
      data: {
        plan: plan as Plan,
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
    // O checkout cancela a assinatura Asaas anterior ao trocar de plano — isso
    // dispara um SUBSCRIPTION_INACTIVATED da assinatura ANTIGA. Se o evento é de
    // uma assinatura que não é mais a atual da empresa, ignorar: cancelar aqui
    // apagaria a assinatura nova recém-criada e marcaria a empresa como CANCELED
    // por engano. Só cancelamos quando o evento é da assinatura vigente (ou
    // quando o evento não traz id de assinatura para comparar).
    const eventSubscriptionId = subscription?.id ?? payment?.subscription ?? null;

    if (
      eventSubscriptionId &&
      company.asaasSubscriptionId &&
      eventSubscriptionId !== company.asaasSubscriptionId
    ) {
      console.log(
        `[Asaas Webhook] Ignorando cancelamento de assinatura antiga ${eventSubscriptionId} — atual é ${company.asaasSubscriptionId} (empresa ${company.id})`
      );
    } else {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          subscriptionStatus: 'CANCELED',
          asaasSubscriptionId: null,
        },
      });

      console.log(`[Asaas Webhook] Assinatura cancelada — empresa ${company.id}`);
    }
  }

  // Pagamento de assinatura de clube — reinicia sessões do ciclo
  if (event === 'SUBSCRIPTION_PAYMENT_RECEIVED' && payment?.subscription) {
    await handleSubscriptionClubPayment(payment.subscription);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Ao receber pagamento de assinatura de clube, zera sessões utilizadas no ciclo
 * e atualiza a próxima data de cobrança.
 */
async function handleSubscriptionClubPayment(asaasSubscriptionId: string) {
  const subscription = await prisma.patientSubscription.findFirst({
    where: { asaasSubscriptionId, status: 'ACTIVE' },
    include: {
      plan: { include: { items: true } },
    },
  });

  if (!subscription) return;

  // Reset do ciclo (sessões zeradas p/ os items ATUAIS do plano + próxima
  // cobrança +1 mês). Mesma regra do cron diário — ver @/lib/subscriptionCycle.
  await prisma.patientSubscription.update({
    where: { id: subscription.id },
    data: buildCycleResetData(subscription.plan.items),
  });

  console.log(`[Asaas Webhook] Sessões reiniciadas — assinatura ${subscription.id}`);
}
