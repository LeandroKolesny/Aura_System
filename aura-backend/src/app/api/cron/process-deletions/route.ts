import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const due = await prisma.deletionRequest.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    select: { id: true, userId: true },
  })

  let processed = 0
  for (const req of due) {
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
  }

  return NextResponse.json({ processed, total: due.length })
}
