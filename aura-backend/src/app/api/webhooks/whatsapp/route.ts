// aura-backend/src/app/api/webhooks/whatsapp/route.ts
// Recebe eventos do Evolution API (mensagens do paciente) e repassa pro motor
// de conversa do chatbot de agendamento.
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { handleIncomingMessage } from "@/lib/whatsappBotEngine"
import { EvolutionProvider } from "@/lib/whatsappProvider"

export async function POST(request: NextRequest) {
  const webhookSecret = request.headers.get("x-webhook-secret")
  const expectedSecret = process.env.EVOLUTION_WEBHOOK_SECRET

  if (!expectedSecret || webhookSecret !== expectedSecret) {
    console.warn("[WhatsApp Webhook] Secret inválido — requisição rejeitada")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const provider = new EvolutionProvider()
    const inbound = provider.parseInboundWebhook(payload)
    if (!inbound) {
      return NextResponse.json({ ok: true }) // evento irrelevante (ex: connection.update, eco do próprio bot)
    }

    const instance = await prisma.whatsappInstance.findUnique({
      where: { instanceName: inbound.instanceName },
      select: { companyId: true, chatbotEnabled: true },
    })
    if (!instance) {
      return NextResponse.json({ ok: true }) // instância não vinculada a nenhuma empresa ativa
    }
    if (!instance.chatbotEnabled) {
      return NextResponse.json({ ok: true }) // empresa recebe WhatsApp normal, sem o bot ativo
    }

    await handleIncomingMessage({
      companyId: instance.companyId,
      from: inbound.from,
      text: inbound.text,
      buttonId: inbound.buttonId,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[WhatsApp Webhook] Erro ao processar mensagem:", error)
    // Sempre 200 pro Evolution API não ficar reenviando/retentando o mesmo evento
    return NextResponse.json({ ok: true })
  }
}
