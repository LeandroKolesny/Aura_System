import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import prisma from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { hasModuleAccess } from "@/lib/planPermissions"
import {
  createInstance,
  getQRCode,
  getInstanceStatus,
  deleteInstance,
} from "@/lib/whatsapp"

// Texto exibido ao usuário no momento do aceite — hash SHA-256 grava a prova do conteúdo
const TERMS_TEXT =
  "Use um número dedicado exclusivo para esta função. " +
  "Não utilize seu número pessoal ou comercial principal. " +
  "O Aura System não se responsabiliza por eventual bloqueio do WhatsApp neste número."

const TERMS_HASH = createHash("sha256").update(TERMS_TEXT).digest("hex")

async function getCompanyAndCheckModule(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, subscriptionStatus: true, subscriptionExpiresAt: true },
  })
  if (!company) return { company: null, allowed: false }
  const allowed = await hasModuleAccess(company as never, "whatsapp_notifications")
  return { company, allowed }
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: "Sem empresa" }, { status: 403 })

  const { allowed } = await getCompanyAndCheckModule(user.companyId)
  if (!allowed) {
    return NextResponse.json(
      { error: "Módulo não disponível no seu plano", code: "MODULE_NOT_AVAILABLE" },
      { status: 403 }
    )
  }

  const instance = await prisma.whatsappInstance.findUnique({
    where: { companyId: user.companyId },
  })

  if (!instance) {
    return NextResponse.json({ status: "DISCONNECTED", termsAccepted: false })
  }

  const liveStatus = await getInstanceStatus(user.companyId)
  if (liveStatus !== instance.status) {
    await prisma.whatsappInstance.update({
      where: { companyId: user.companyId },
      data: { status: liveStatus },
    })
  }

  let qrCode: string | null = null
  if (liveStatus === "CONNECTING" || liveStatus === "DISCONNECTED") {
    qrCode = await getQRCode(user.companyId)
  }

  return NextResponse.json({
    status: liveStatus,
    phoneNumber: instance.phoneNumber,
    termsAccepted: instance.termsAccepted,
    qrCode,
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: "Sem empresa" }, { status: 403 })

  const { allowed } = await getCompanyAndCheckModule(user.companyId)
  if (!allowed) {
    return NextResponse.json(
      { error: "Módulo não disponível no seu plano", code: "MODULE_NOT_AVAILABLE" },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  if (!body.acceptTerms) {
    return NextResponse.json(
      { error: "Você deve aceitar os termos antes de conectar" },
      { status: 403 }
    )
  }

  const { instanceName } = await createInstance(user.companyId)

  const acceptedAt = new Date()
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  const userAgent = request.headers.get("user-agent") ?? "unknown"

  const termsData = {
    termsAccepted: true,
    termsAcceptedAt: acceptedAt,
    termsAcceptedByUserId: user.id,
    termsAcceptedByEmail: user.email,
    termsAcceptedIp: ip,
    termsAcceptedAgent: userAgent,
    termsTextHash: TERMS_HASH,
  }

  await prisma.whatsappInstance.upsert({
    where: { companyId: user.companyId },
    create: {
      companyId: user.companyId,
      instanceName,
      status: "CONNECTING",
      ...termsData,
    },
    update: {
      status: "CONNECTING",
      ...termsData,
    },
  })

  const qrCode = await getQRCode(user.companyId)
  return NextResponse.json({ qrCode, status: "CONNECTING" })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: "Sem empresa" }, { status: 403 })

  const { allowed } = await getCompanyAndCheckModule(user.companyId)
  if (!allowed) {
    return NextResponse.json(
      { error: "Módulo não disponível no seu plano", code: "MODULE_NOT_AVAILABLE" },
      { status: 403 }
    )
  }

  await deleteInstance(user.companyId).catch(console.error)
  await prisma.whatsappInstance.delete({
    where: { companyId: user.companyId },
  }).catch(() => null)

  return NextResponse.json({ success: true })
}
