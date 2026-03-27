import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (user.role !== "OWNER") return NextResponse.json({ error: "Acesso restrito" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"))

  const logs = await prisma.activity.findMany({
    where: { type: "USER_LOGIN" },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      title: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      retainUntil: true,
      metadata: true,
      userId: true,
    },
  })

  return NextResponse.json({ data: logs, page, limit })
}
