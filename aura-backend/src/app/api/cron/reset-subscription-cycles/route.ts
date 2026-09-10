import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildCycleResetData } from "@/lib/subscriptionCycle";

/**
 * Valida o cron via header `Authorization: Bearer <CRON_SECRET>`.
 * Usa timingSafeEqual para evitar enumeração do segredo por timing.
 * O Vercel Cron envia esse header automaticamente quando CRON_SECRET existe.
 */
function validateCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[CRON] CRON_SECRET environment variable is not set");
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return false;

  try {
    const provided = Buffer.from(token);
    const expected = Buffer.from(cronSecret);
    if (provided.length !== expected.length) return false;
    return timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

/**
 * GET /api/cron/reset-subscription-cycles
 *
 * Cron diário que renova o ciclo das assinaturas do Clube de Assinaturas.
 *
 * Motivação: o reset de `sessionsUsedThisCycle` só acontecia no webhook do Asaas
 * (SUBSCRIPTION_PAYMENT_RECEIVED). Assinaturas inscritas manualmente pela clínica
 * pela aba "Inscrever Paciente" não têm `asaasSubscriptionId` e nunca recebiam
 * esse evento — a partir do 2º ciclo o paciente ficava "sem sessão" para sempre.
 *
 * Regra: para toda PatientSubscription ACTIVE cuja `nextBillingDate` já passou,
 * zera `sessionsUsedThisCycle` (para os items ATUAIS do plano), grava
 * `lastCycleReset = now` e avança `nextBillingDate` em 1 mês.
 *
 * Por que `nextBillingDate <= now` é suficiente como gatilho: a coluna é
 * NOT NULL no schema e é sempre preenchida na inscrição (campo obrigatório
 * "Próxima cobrança" no EnrollModal) e pelo webhook do Asaas — é a fonte de
 * verdade da data de virada de ciclo. Assinaturas integradas ao Asaas também
 * passam por aqui como rede de segurança: o reset é idempotente por data (só
 * ocorre depois do vencimento) e o webhook já teria empurrado `nextBillingDate`
 * para o futuro ao confirmar o pagamento.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> (enviado automaticamente pelo Vercel Cron).
 */
export async function GET(request: NextRequest) {
  try {
    if (!validateCronSecret(request)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const now = new Date();

    const dueSubscriptions = await prisma.patientSubscription.findMany({
      where: {
        status: "ACTIVE",
        nextBillingDate: { lte: now },
      },
      include: {
        plan: { include: { items: true } },
      },
    });

    if (dueSubscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhuma assinatura para renovar",
        processed: 0,
        timestamp: now.toISOString(),
      });
    }

    let processed = 0;
    let errors = 0;

    for (const subscription of dueSubscriptions) {
      try {
        await prisma.patientSubscription.update({
          where: { id: subscription.id },
          data: buildCycleResetData(subscription.plan.items, now),
        });
        processed++;
      } catch (err) {
        errors++;
        console.error(`[CRON] Erro ao renovar ciclo da assinatura ${subscription.id}:`, err);
        // Continua processando as demais assinaturas.
      }
    }

    console.log(`[CRON] reset-subscription-cycles: ${processed} renovadas, ${errors} erros`);

    return NextResponse.json({
      success: true,
      message: `Renovadas ${processed} assinatura(s)`,
      processed,
      errors,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Erro no reset-subscription-cycles:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
