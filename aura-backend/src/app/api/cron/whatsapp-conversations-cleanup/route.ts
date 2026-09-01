import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// Conversas de chatbot abandonadas em etapas intermediárias por mais de 30min
// voltam pro início — evita ficar "preso" numa etapa velha quando o paciente
// escrever de novo dias depois.
const STALE_MINUTES = 30

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

    const cutoff = new Date()
    cutoff.setMinutes(cutoff.getMinutes() - STALE_MINUTES)

    const result = await prisma.whatsAppConversation.updateMany({
      where: {
        // HUMANO: atendente assumiu, não mexe. CONCLUIDO/START: já não estão "em andamento".
        state: { notIn: ["HUMANO", "CONCLUIDO", "START"] },
        updatedAt: { lt: cutoff },
      },
      data: { state: "START", context: {} },
    })

    console.log(`[WhatsApp Cleanup] ${result.count} conversa(s) parada(s) resetada(s)`)
    return NextResponse.json({ reset: result.count })
  } catch (error) {
    console.error("[WhatsApp Cleanup] Erro ao limpar conversas paradas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
