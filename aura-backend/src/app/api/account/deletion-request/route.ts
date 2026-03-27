import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const req = await prisma.deletionRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true, status: true, scheduledFor: true, reason: true, createdAt: true },
  })

  return NextResponse.json({ data: req ?? null })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const existing = await prisma.deletionRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
  })
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um pedido de exclusão pendente", code: "ALREADY_PENDING" },
      { status: 409 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const scheduledFor = new Date()
  scheduledFor.setDate(scheduledFor.getDate() + 30)

  const req = await prisma.deletionRequest.create({
    data: {
      userId: user.id,
      reason: typeof body.reason === 'string' ? body.reason : null,
      scheduledFor,
    },
    select: { id: true, status: true, scheduledFor: true, reason: true },
  })

  return NextResponse.json({ data: req }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  await prisma.deletionRequest.updateMany({
    where: { userId: user.id, status: "PENDING" },
    data: { status: "CANCELED" },
  })

  return NextResponse.json({ success: true })
}
