// aura-backend/src/lib/whatsappProvider.ts
// Camada de abstração sobre o provedor de WhatsApp — permite trocar de
// Evolution API (não oficial) para a API oficial da Meta/BSP sem reescrever
// o motor de conversa do chatbot.

import { getInstanceName, sendTextMessage } from "./whatsapp"

export interface WhatsAppOption {
  id: string
  label: string
}

export interface InboundWhatsAppMessage {
  instanceName: string
  from: string
  text: string | null
  buttonId: string | null
}

export interface WhatsAppProvider {
  sendText(companyId: string, phone: string, text: string): Promise<void>
  sendButtons(companyId: string, phone: string, text: string, options: WhatsAppOption[]): Promise<void>
  sendList(companyId: string, phone: string, text: string, items: WhatsAppOption[]): Promise<void>
  parseInboundWebhook(payload: unknown): InboundWhatsAppMessage | null
}

function getBaseUrl(): string {
  return (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "")
}

function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: process.env.EVOLUTION_API_KEY || "",
  }
}

function normalizeNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("55") ? digits : `55${digits}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export class EvolutionProvider implements WhatsAppProvider {
  async sendText(companyId: string, phone: string, text: string): Promise<void> {
    await sendTextMessage(companyId, phone, text)
  }

  async sendButtons(companyId: string, phone: string, text: string, options: WhatsAppOption[]): Promise<void> {
    try {
      const instanceName = getInstanceName(companyId)
      await fetch(`${getBaseUrl()}/message/sendButtons/${instanceName}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          number: normalizeNumber(phone),
          title: text,
          buttons: options.map(o => ({ buttonId: o.id, buttonText: { displayText: o.label } })),
        }),
      })
    } catch (err) {
      console.error("[WhatsApp] Falha ao enviar botões:", err)
    }
  }

  async sendList(companyId: string, phone: string, text: string, items: WhatsAppOption[]): Promise<void> {
    try {
      const instanceName = getInstanceName(companyId)
      await fetch(`${getBaseUrl()}/message/sendList/${instanceName}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          number: normalizeNumber(phone),
          title: text,
          buttonText: "Ver opções",
          sections: [{ rows: items.map(i => ({ rowId: i.id, title: i.label })) }],
        }),
      })
    } catch (err) {
      console.error("[WhatsApp] Falha ao enviar lista:", err)
    }
  }

  parseInboundWebhook(payload: unknown): InboundWhatsAppMessage | null {
    if (!isRecord(payload)) return null
    const eventName = typeof payload.event === "string" ? payload.event.toLowerCase() : ""
    if (eventName !== "messages.upsert" && eventName !== "messages_upsert") return null

    const instanceName = typeof payload.instance === "string" ? payload.instance : null
    const data = payload.data
    if (!instanceName || !isRecord(data)) return null

    const key = data.key
    if (!isRecord(key) || key.fromMe === true) return null

    const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid : null
    if (!remoteJid) return null
    const from = remoteJid.split("@")[0]

    const message = data.message
    if (!isRecord(message)) return null

    const buttonsResponse = message.buttonsResponseMessage
    if (isRecord(buttonsResponse)) {
      return {
        instanceName,
        from,
        text: typeof buttonsResponse.selectedDisplayText === "string" ? buttonsResponse.selectedDisplayText : null,
        buttonId: typeof buttonsResponse.selectedButtonId === "string" ? buttonsResponse.selectedButtonId : null,
      }
    }

    const listResponse = message.listResponseMessage
    if (isRecord(listResponse)) {
      const singleSelectReply = listResponse.singleSelectReply
      const selectedRowId = isRecord(singleSelectReply) && typeof singleSelectReply.selectedRowId === "string"
        ? singleSelectReply.selectedRowId
        : null
      return {
        instanceName,
        from,
        text: typeof listResponse.title === "string" ? listResponse.title : null,
        buttonId: selectedRowId,
      }
    }

    if (typeof message.conversation === "string") {
      return { instanceName, from, text: message.conversation, buttonId: null }
    }

    return null
  }
}
