// aura-backend/src/app/api/webhooks/whatsapp/route.ts
// Recebe eventos do Evolution API (mensagens do paciente) e repassa pro motor
// de conversa do chatbot de agendamento.
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { handleIncomingMessage } from "@/lib/whatsappBotEngine"
import { EvolutionProvider } from "@/lib/whatsappProvider"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Detecta um evento `connection.update` do Evolution API que sinaliza queda de
 * conexão. O Evolution manda o estado da sessão em `data.state` (mesmo
 * vocabulário de `getInstanceStatus` em lib/whatsapp.ts: 'open' / 'connecting' /
 * 'close') e, dependendo da versão, também em `data.connection` ou `data.status`.
 * O `instance` pode vir como string ou como objeto `{ instanceName }`.
 *
 * Retorna `{ instanceName, disconnected }` para eventos `connection.update`, ou
 * `null` para qualquer outro evento. Somos conservadores: só tratamos como
 * queda quando o estado é explicitamente de desconexão
 * ('close' / 'closed' / 'disconnected'); 'connecting' / 'open' / estado ausente
 * não mudam nada no banco.
 */
function parseConnectionUpdate(
  payload: unknown
): { instanceName: string; disconnected: boolean } | null {
  if (!isRecord(payload)) return null

  const eventName = typeof payload.event === "string" ? payload.event.toLowerCase() : ""
  if (eventName !== "connection.update" && eventName !== "connection_update") return null

  const instanceName =
    typeof payload.instance === "string"
      ? payload.instance
      : isRecord(payload.instance) && typeof payload.instance.instanceName === "string"
        ? payload.instance.instanceName
        : null
  if (!instanceName) return null

  const data = isRecord(payload.data) ? payload.data : {}
  const rawState =
    (typeof data.state === "string" && data.state) ||
    (typeof data.connection === "string" && data.connection) ||
    (typeof data.status === "string" && data.status) ||
    ""
  const state = rawState.toLowerCase()
  const disconnected = state === "close" || state === "closed" || state === "disconnected"

  return { instanceName, disconnected }
}

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
    // connection.update: quando o Evolution sinaliza que a sessão caiu, marca a
    // instância como DISCONNECTED no banco. Sem isso, o status só era
    // ressincronizado ao reabrir a aba de Configurações — no intervalo, as
    // confirmações automáticas "achavam" que o envio ainda estava disponível.
    const connUpdate = parseConnectionUpdate(payload)
    if (connUpdate) {
      if (connUpdate.disconnected) {
        // updateMany (não update): idempotente e não estoura P2025 quando o
        // instanceName não casa com nenhuma empresa. Casado por instanceName,
        // que é @unique no schema.
        await prisma.whatsappInstance
          .updateMany({
            where: { instanceName: connUpdate.instanceName },
            data: { status: "DISCONNECTED" },
          })
          .catch((err) => {
            console.error("[WhatsApp Webhook] Falha ao marcar instância DISCONNECTED:", err)
          })
      }
      return NextResponse.json({ ok: true })
    }

    const provider = new EvolutionProvider()
    const inbound = provider.parseInboundWebhook(payload)
    if (!inbound) {
      return NextResponse.json({ ok: true }) // evento irrelevante (ex: eco do próprio bot)
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
