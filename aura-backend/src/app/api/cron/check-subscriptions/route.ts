import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Proteger endpoint com secret (Vercel Cron envia este header automaticamente)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/check-subscriptions
 *
 * Cron job que roda diariamente para:
 * 1. Encontrar empresas com assinatura expirada
 * 2. Salvar o plano atual em lastPlan
 * 3. Mover para plano BASIC
 * 4. Atualizar status para OVERDUE
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autorização (Vercel Cron ou chamada manual com secret)
    const authHeader = request.headers.get("authorization");
    const cronSecret = request.nextUrl.searchParams.get("secret");

    // Em produção, exigir autenticação
    if (process.env.NODE_ENV === "production" && CRON_SECRET) {
      const isValidCron = authHeader === `Bearer ${CRON_SECRET}`;
      const isValidManual = cronSecret === CRON_SECRET;

      if (!isValidCron && !isValidManual) {
        return NextResponse.json(
          { error: "Não autorizado" },
          { status: 401 }
        );
      }
    }

    const now = new Date();

    // Buscar empresas com assinatura expirada que ainda não foram movidas para BASIC
    const expiredCompanies = await prisma.company.findMany({
      where: {
        subscriptionExpiresAt: {
          lt: now, // Expirou (menor que agora)
        },
        plan: {
          not: "BASIC", // Ainda não foi movido para BASIC
        },
        // Não processar empresas já canceladas manualmente
        subscriptionStatus: {
          notIn: ["CANCELED"],
        },
      },
      select: {
        id: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    if (expiredCompanies.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhuma assinatura expirada encontrada",
        processed: 0,
        timestamp: now.toISOString(),
      });
    }

    // Processar cada empresa expirada
    const results = await Promise.all(
      expiredCompanies.map(async (company) => {
        try {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              lastPlan: company.plan, // Salvar plano anterior
              plan: "BASIC",          // Mover para BASIC (bloqueado)
              subscriptionStatus: "OVERDUE", // Marcar como inadimplente
            },
          });

          return {
            id: company.id,
            name: company.name,
            previousPlan: company.plan,
            expiredAt: company.subscriptionExpiresAt,
            status: "updated",
          };
        } catch (error) {
          console.error(`Erro ao processar empresa ${company.id}:`, error);
          return {
            id: company.id,
            name: company.name,
            status: "error",
            error: error instanceof Error ? error.message : "Erro desconhecido",
          };
        }
      })
    );

    const successCount = results.filter((r) => r.status === "updated").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    console.log(`[CRON] Check-subscriptions: ${successCount} atualizadas, ${errorCount} erros`);

    return NextResponse.json({
      success: true,
      message: `Processadas ${successCount} empresas com assinatura expirada`,
      processed: successCount,
      errors: errorCount,
      details: results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Erro no check-subscriptions:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
