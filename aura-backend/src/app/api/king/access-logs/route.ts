import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireOwner } from "@/lib/kingGuard"

export async function GET(request: NextRequest) {
  const guard = await requireOwner(request)
  if (!guard.authorized) return guard.response

  const { searchParams } = new URL(request.url)
  const pageRaw = parseInt(searchParams.get("page") ?? "1")
  const limitRaw = parseInt(searchParams.get("limit") ?? "50")
  const page = Math.max(1, isNaN(pageRaw) ? 1 : pageRaw)
  const limit = Math.min(100, Math.max(1, isNaN(limitRaw) ? 50 : limitRaw))

  const where = { type: "USER_LOGIN" as const }

  const [logs, total] = await Promise.all([
    prisma.activity.findMany({
      where,
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
    }),
    prisma.activity.count({ where }),
  ])

  return NextResponse.json({ data: logs, page, limit, total })
}
