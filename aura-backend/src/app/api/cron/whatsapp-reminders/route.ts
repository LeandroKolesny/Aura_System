import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendTextMessage } from "@/lib/whatsapp"
import { buildReminderMessage, formatDate, formatTime } from "@/lib/whatsappMessages"

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  const token = auth?.replace("Bearer ", "")
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const startOfTomorrow = new Date(tomorrow)
  startOfTomorrow.setHours(0, 0, 0, 0)
  const endOfTomorrow = new Date(tomorrow)
  endOfTomorrow.setHours(23, 59, 59, 999)

  const appointments = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      date: { gte: startOfTomorrow, lte: endOfTomorrow },
    },
    include: {
      patient: { select: { name: true, phone: true } },
      professional: { select: { name: true } },
      procedure: { select: { name: true } },
      company: { select: { name: true } },
    },
  })

  let sent = 0
  let skipped = 0

  for (const appt of appointments) {
    if (!appt.patient.phone) { skipped++; continue }

    const waInstance = await prisma.whatsappInstance.findUnique({
      where: { companyId: appt.companyId },
    })
    if (waInstance?.status !== "CONNECTED") { skipped++; continue }

    const msg = buildReminderMessage({
      patientName: appt.patient.name,
      clinicName: appt.company.name,
      date: formatDate(appt.date),
      time: formatTime(appt.date),
      procedure: appt.procedure.name,
      professional: appt.professional?.name ?? "",
    })

    await sendTextMessage(appt.companyId, appt.patient.phone, msg)
    sent++

    await new Promise((r) => setTimeout(r, 2000))
  }

  console.log(`[Cron WhatsApp] Lembretes: ${sent} enviados, ${skipped} ignorados`)
  return NextResponse.json({ sent, skipped })
}
