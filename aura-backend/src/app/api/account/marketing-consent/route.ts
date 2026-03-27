import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const data = await prisma.user.findUnique({
      where: { id: user.id },
      select: { marketingConsent: true, marketingConsentAt: true },
    })
    return NextResponse.json({ data })
  } catch (error) {
    console.error("Erro ao buscar consentimento de marketing:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const consent = Boolean(body.consent)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip") ?? "unknown"

    await prisma.user.update({
      where: { id: user.id },
      data: {
        marketingConsent: consent,
        marketingConsentAt: new Date(),
        marketingConsentIp: ip,
      },
    })

    return NextResponse.json({ success: true, consent })
  } catch (error) {
    console.error("Erro ao atualizar consentimento de marketing:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
