import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Validates the cron request using the Authorization: Bearer <CRON_SECRET> header.
 * Uses timingSafeEqual to prevent timing-based secret enumeration attacks.
 * Vercel Cron Jobs send this header automatically when CRON_SECRET is set.
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
 * GET /api/cron/check-subscriptions
 *
 * Cron job que roda diariamente para:
 * 1. Encontrar empresas com assinatura expirada
 * 2. Salvar o plano atual em lastPlan
 * 3. Mover para plano BASIC
 * 4. Atualizar status para OVERDUE
 *
 * Authentication: Authorization: Bearer <CRON_SECRET>
 * (Vercel Cron Jobs send this header automatically)
 */
export async function GET(request: NextRequest) {
  try {
    if (!validateCronSecret(request)) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
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
