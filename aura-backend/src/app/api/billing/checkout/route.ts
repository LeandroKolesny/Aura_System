// aura-backend/src/app/api/billing/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  findCustomerByEmail,
  createCustomer,
  createSubscription,
  getSubscriptionPayments,
  cancelSubscription,
} from '@/lib/asaas';
import { SAAS_COMPANY_NAME } from '@/lib/constants';

// Mapa SaasPlan.name → Company.plan enum
const PLAN_NAME_MAP: Record<string, string> = {
  Starter: 'STARTER',
  Pro: 'PROFESSIONAL',
  Clinic: 'PREMIUM',
};

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });
    }

    const body = await request.json() as { planId: string };
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: 'planId obrigatório' }, { status: 400 });
    }

    // Buscar plano SaaS
    const saasPlan = await prisma.saasPlan.findUnique({
      where: { id: planId },
    });

    if (!saasPlan || !saasPlan.isActive) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
    }

    // Buscar empresa
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    // Buscar ou criar cliente no Asaas
    let asaasCustomerId = company.asaasCustomerId;

    if (!asaasCustomerId) {
      let customer = await findCustomerByEmail(user.email);

      if (!customer) {
        // Em sandbox, usa CPF de teste quando a empresa não tem CNPJ cadastrado
        const isSandbox = process.env.ASAAS_SANDBOX === 'true';
        const cpfCnpj = company.cnpj ?? (isSandbox ? '24971563792' : undefined);
        customer = await createCustomer({
          name: company.name,
          email: user.email,
          cpfCnpj,
        });
      }

      asaasCustomerId = customer.id;

      // Salvar customerId na empresa
      await prisma.company.update({
        where: { id: user.companyId },
        data: { asaasCustomerId },
      });
    }

    // Data de vencimento = hoje + 1 dia
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

    // planEnum é o valor que será salvo no externalReference do Asaas
    // para que o webhook identifique o plano sem depender do valor monetário
    const planEnum = PLAN_NAME_MAP[saasPlan.name] ?? 'STARTER';

    // TODO(produto): não há validação de downgrade contra os dados atuais da
    // empresa — trocar para um plano com maxProfessionals/maxPatients menor que
    // a contagem atual é aceito incondicionalmente. Definir se deve bloquear,
    // pedir confirmação, ou apenas avisar antes de aplicar a troca.

    // Ao trocar de plano com uma assinatura Asaas já ativa, cancelar a anterior
    // ANTES de criar a nova. Sem isso a assinatura antiga continua cobrando e um
    // pagamento confirmado dela reverte o plano no webhook (PAYMENT_CONFIRMED
    // resolve pelo externalReference/valor do pagamento antigo). Se o
    // cancelamento falhar (assinatura já removida no Asaas, indisponibilidade
    // temporária, etc.), seguimos em frente criando a nova — deixar o usuário
    // sem conseguir assinar por causa de um cleanup é pior que uma assinatura
    // órfã, que pode ser cancelada manualmente depois.
    if (company.asaasSubscriptionId) {
      try {
        await cancelSubscription(company.asaasSubscriptionId);
        console.log(`[Checkout] Assinatura anterior ${company.asaasSubscriptionId} cancelada (empresa ${company.id})`);
      } catch (cancelErr) {
        console.error(
          `[Checkout] Falha ao cancelar assinatura anterior ${company.asaasSubscriptionId} — seguindo com a nova:`,
          cancelErr instanceof Error ? cancelErr.message : cancelErr
        );
      }
    }

    // Criar assinatura — UNDEFINED permite que o cliente escolha PIX ou cartão no checkout
    const subscription = await createSubscription({
      customer: asaasCustomerId,
      billingType: 'UNDEFINED',
      value: Number(saasPlan.price),
      nextDueDate: nextDueDateStr,
      description: `${SAAS_COMPANY_NAME} — Plano ${saasPlan.displayName ?? saasPlan.name}`,
      externalReference: planEnum,
    });

    // Salvar subscriptionId na empresa
    await prisma.company.update({
      where: { id: user.companyId },
      data: { asaasSubscriptionId: subscription.id },
    });

    // Buscar link do primeiro pagamento
    const payments = await getSubscriptionPayments(subscription.id);
    const firstPayment = payments[0];

    const paymentUrl = firstPayment?.invoiceUrl
      ?? firstPayment?.pixQrCodeUrl
      ?? firstPayment?.bankSlipUrl
      ?? null;

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        paymentUrl,
        planName: PLAN_NAME_MAP[saasPlan.name] ?? saasPlan.name,
      },
    });
  } catch (err) {
    console.error('[Checkout] Erro:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Erro ao processar pagamento. Tente novamente.' }, { status: 500 });
  }
}
