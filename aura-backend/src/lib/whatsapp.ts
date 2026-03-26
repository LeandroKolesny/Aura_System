// aura-backend/src/lib/whatsapp.ts
// Cliente para Evolution API — gerencia instâncias e envio de mensagens WhatsApp

type InstanceStatus = "CONNECTED" | "DISCONNECTED" | "CONNECTING"

function getBaseUrl(): string {
  return (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "")
}

function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: process.env.EVOLUTION_API_KEY || "",
  }
}

/** Nome da instância no Evolution API para uma empresa */
export function getInstanceName(companyId: string): string {
  return `aura-${companyId}`
}

/** Cria (ou recria) uma instância no Evolution API */
export async function createInstance(companyId: string): Promise<{ instanceName: string }> {
  const instanceName = getInstanceName(companyId)
  const res = await fetch(`${getBaseUrl()}/instance/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  })
  const data = await res.json()
  return { instanceName: data.instance?.instanceName ?? instanceName }
}

/** Obtém o QR code em base64 para escanear */
export async function getQRCode(companyId: string): Promise<string | null> {
  try {
    const instanceName = getInstanceName(companyId)
    const res = await fetch(`${getBaseUrl()}/instance/connect/${instanceName}`, {
      headers: getHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.base64 ?? null
  } catch {
    return null
  }
}

/** Consulta o status atual da conexão */
export async function getInstanceStatus(companyId: string): Promise<InstanceStatus> {
  try {
    const instanceName = getInstanceName(companyId)
    const res = await fetch(`${getBaseUrl()}/instance/connectionState/${instanceName}`, {
      headers: getHeaders(),
    })
    if (!res.ok) return "DISCONNECTED"
    const data = await res.json()
    const state: string = data.instance?.state ?? "close"
    if (state === "open") return "CONNECTED"
    if (state === "connecting") return "CONNECTING"
    return "DISCONNECTED"
  } catch {
    return "DISCONNECTED"
  }
}

/** Deleta a instância no Evolution API */
export async function deleteInstance(companyId: string): Promise<void> {
  const instanceName = getInstanceName(companyId)
  await fetch(`${getBaseUrl()}/instance/delete/${instanceName}`, {
    method: "DELETE",
    headers: getHeaders(),
  }).catch(console.error)
}

/** Envia mensagem de texto — fire-and-forget, nunca lança erro */
export async function sendTextMessage(
  companyId: string,
  phone: string,
  text: string
): Promise<void> {
  try {
    const instanceName = getInstanceName(companyId)
    const normalized = phone.replace(/\D/g, "")
    const number = normalized.startsWith("55") ? normalized : `55${normalized}`

    const res = await fetch(`${getBaseUrl()}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        number,
        text,
        delay: 1500,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn("[WhatsApp] Falha ao enviar mensagem:", err)
    }
  } catch (err) {
    console.warn("[WhatsApp] Erro de rede ao enviar mensagem:", err)
  }
}
