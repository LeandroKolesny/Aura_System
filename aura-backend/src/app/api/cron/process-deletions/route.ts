import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Validates the cron request using the Authorization: Bearer <CRON_SECRET> header.
 * Uses timingSafeEqual to prevent timing-based secret enumeration attacks.
 */
function validateCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[CRON] CRON_SECRET environment variable is not set")
    return false
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!token) return false

  try {
    const provided = Buffer.from(token)
    const expected = Buffer.from(cronSecret)
    if (provided.length !== expected.length) return false
    return timingSafeEqual(provided, expected)
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!validateCronSecret(request)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const due = await prisma.deletionRequest.findMany({
      where: { status: "PENDING", scheduledFor: { lte: new Date() } },
      select: { id: true, userId: true },
    })

    let processed = 0
    for (const req of due) {
      try {
        // Anonimizar usuário — LGPD art. 16: manter dados necessários para obrigação legal
        await prisma.user.update({
          where: { id: req.userId },
          data: {
            name: "Usuário Removido",
            email: `deleted_${req.userId}@aura.removed`,
            password: "",
            isActive: false,
            emailVerified: null,
            verificationToken: null,
            resetPasswordToken: null,
          },
        })
        await prisma.deletionRequest.update({
          where: { id: req.id },
          data: { status: "PROCESSED", processedAt: new Date() },
        })
        processed++
      } catch (err) {
        console.error(`[CRON] Erro ao processar deletionRequest ${req.id}:`, err)
        // Continue processing remaining records
      }
    }

    return NextResponse.json({ processed, total: due.length })
  } catch (error) {
    console.error("[CRON] Erro no process-deletions:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
