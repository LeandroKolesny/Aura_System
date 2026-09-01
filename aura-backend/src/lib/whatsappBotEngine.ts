// aura-backend/src/lib/whatsappBotEngine.ts
// Motor de conversa do chatbot de agendamento via WhatsApp.
// Fluxo guiado por botões/listas (mais confiável que texto livre):
// START -> ESCOLHENDO_PROCEDIMENTO -> ESCOLHENDO_DATA -> ESCOLHENDO_HORA -> CONFIRMANDO -> CONCLUIDO
// Duas respostas inválidas seguidas em qualquer etapa -> HUMANO (bot para de responder).

import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import type { BusinessHours } from "./businessHours"
import { computeAvailableDates, computeAvailableTimes } from "./whatsappBotSlots"
import { getGreeting, formatBusinessHours } from "./whatsappBotFormat"
import { EvolutionProvider, type WhatsAppProvider } from "./whatsappProvider"

const MAX_INVALID_ATTEMPTS = 2
const DAYS_AHEAD = 7
const PROFESSIONAL_ROLES = ["ESTHETICIAN", "ADMIN"] as const

interface ConversationContext {
  procedureId?: string
  date?: string
  time?: string
  invalidAttempts?: number
}

interface IncomingMessage {
  companyId: string
  from: string
  text: string | null
  buttonId: string | null
}

interface HandleDeps {
  provider?: WhatsAppProvider
  now?: Date
}

function hasOverlap(existing: { date: Date; durationMinutes: number }[], start: Date, end: Date): boolean {
  return existing.some(appt => {
    const apptStart = appt.date.getTime()
    const apptEnd = apptStart + appt.durationMinutes * 60000
    return start.getTime() < apptEnd && end.getTime() > apptStart
  })
}

function dayRange(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number)
  return { start: new Date(y, m - 1, d, 0, 0, 0, 0), end: new Date(y, m - 1, d, 23, 59, 59, 999) }
}

async function getBusinessHours(companyId: string): Promise<BusinessHours | null> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { businessHours: true } })
  return (company?.businessHours as unknown as BusinessHours | null) ?? null
}

async function sendProcedureList(companyId: string, phone: string, provider: WhatsAppProvider): Promise<boolean> {
  const procedures = await prisma.procedure.findMany({ where: { companyId, isActive: true } })
  if (procedures.length === 0) {
    await provider.sendText(companyId, phone, "No momento não temos procedimentos disponíveis para agendamento. Um atendente vai te chamar em breve.")
    return false
  }
  await provider.sendList(
    companyId, phone, "Olá! 👋 Qual procedimento você gostaria de agendar?",
    procedures.map(p => ({ id: `proc_${p.id}`, label: p.name }))
  )
  return true
}

async function sendMenuOptions(companyId: string, phone: string, provider: WhatsAppProvider, text: string): Promise<void> {
  await provider.sendButtons(companyId, phone, text, [
    { id: "menu_book", label: "Agendar Agora" },
    { id: "menu_info", label: "Ver Procedimentos" },
  ])
}

async function sendWelcomeMenu(companyId: string, phone: string, provider: WhatsAppProvider, now: Date): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, businessHours: true } })
  const greeting = getGreeting(now)
  const name = company?.name ?? "nossa clínica"
  const hoursText = formatBusinessHours((company?.businessHours as unknown as BusinessHours) ?? null)
  const message = `${greeting}! Somos da ${name}. Nosso horário de atendimento é: ${hoursText}\n\nO que você gostaria de fazer?`
  await sendMenuOptions(companyId, phone, provider, message)
}

async function goToHuman(companyId: string, phone: string, provider: WhatsAppProvider, convId: string): Promise<void> {
  await provider.sendText(companyId, phone, "Não consegui entender sua resposta. Vou chamar um atendente humano para te ajudar. 🙋")
  await prisma.whatsAppConversation.update({ where: { id: convId }, data: { state: "HUMANO" } })
}

export async function handleIncomingMessage(message: IncomingMessage, deps: HandleDeps = {}): Promise<void> {
  const provider = deps.provider ?? new EvolutionProvider()
  const now = deps.now ?? new Date()
  const { companyId, from, buttonId } = message

  let conv = await prisma.whatsAppConversation.findUnique({
    where: { companyId_patientPhone: { companyId, patientPhone: from } },
  })

  if (!conv) {
    conv = await prisma.whatsAppConversation.create({
      data: { companyId, patientPhone: from, state: "START", context: {} },
    })
  }

  const state = conv.state as string
  const context = (conv.context as ConversationContext) ?? {}
  const convId = conv.id as string

  if (state === "HUMANO") {
    return // atendente humano assumiu; bot fica em silêncio
  }

  if (state === "START" || state === "CONCLUIDO") {
    await sendWelcomeMenu(companyId, from, provider, now)
    await prisma.whatsAppConversation.update({
      where: { id: convId },
      data: { state: "MENU_INICIAL", context: {} },
    })
    return
  }

  if (state === "MENU_INICIAL") {
    if (buttonId === "menu_book") {
      const ok = await sendProcedureList(companyId, from, provider)
      await prisma.whatsAppConversation.update({
        where: { id: convId },
        data: ok ? { state: "ESCOLHENDO_PROCEDIMENTO", context: { invalidAttempts: 0 } } : { state: "HUMANO" },
      })
      return
    }

    if (buttonId === "menu_info") {
      const procedures = await prisma.procedure.findMany({ where: { companyId, isActive: true } })
      if (procedures.length === 0) {
        await provider.sendText(companyId, from, "No momento não temos procedimentos disponíveis para agendamento. Um atendente vai te chamar em breve.")
        await prisma.whatsAppConversation.update({ where: { id: convId }, data: { state: "HUMANO" } })
        return
      }
      const infoText = procedures
        .map(p => `• ${p.name} — R$ ${Number(p.price).toFixed(2)} (${p.durationMinutes} min)`)
        .join("\n")
      await provider.sendText(companyId, from, `Esses são nossos procedimentos:\n\n${infoText}`)
      await sendProcedureList(companyId, from, provider)
      await prisma.whatsAppConversation.update({
        where: { id: convId },
        data: { state: "ESCOLHENDO_PROCEDIMENTO", context: { invalidAttempts: 0 } },
      })
      return
    }

    const attempts = (context.invalidAttempts ?? 0) + 1
    if (attempts >= MAX_INVALID_ATTEMPTS) {
      await goToHuman(companyId, from, provider, convId)
      return
    }
    await sendMenuOptions(companyId, from, provider, "Não entendi. Escolha uma das opções abaixo:")
    await prisma.whatsAppConversation.update({
      where: { id: convId },
      data: { state: "MENU_INICIAL", context: { ...context, invalidAttempts: attempts } },
    })
    return
  }

  if (state === "ESCOLHENDO_PROCEDIMENTO") {
    const procedureId = buttonId?.startsWith("proc_") ? buttonId.slice("proc_".length) : null
    const procedure = procedureId
      ? await prisma.procedure.findFirst({ where: { id: procedureId, companyId, isActive: true } })
      : null

    if (!procedure) {
      const attempts = (context.invalidAttempts ?? 0) + 1
      if (attempts >= MAX_INVALID_ATTEMPTS) {
        await goToHuman(companyId, from, provider, convId)
        return
      }
      await sendProcedureList(companyId, from, provider)
      await prisma.whatsAppConversation.update({
        where: { id: convId },
        data: { state: "ESCOLHENDO_PROCEDIMENTO", context: { ...context, invalidAttempts: attempts } },
      })
      return
    }

    const businessHours = await getBusinessHours(companyId)
    const dates = computeAvailableDates(businessHours, now, DAYS_AHEAD)
    if (dates.length === 0) {
      await provider.sendText(companyId, from, "Não encontrei horários disponíveis nos próximos dias. Um atendente vai te chamar.")
      await prisma.whatsAppConversation.update({ where: { id: convId }, data: { state: "HUMANO" } })
      return
    }
    await provider.sendList(
      companyId, from, `Ótima escolha: ${procedure.name}. Qual dia funciona melhor pra você?`,
      dates.map(d => ({ id: `date_${d}`, label: d.split("-").reverse().slice(0, 2).join("/") }))
    )
    await prisma.whatsAppConversation.update({
      where: { id: convId },
      data: { state: "ESCOLHENDO_DATA", context: { procedureId: procedure.id, invalidAttempts: 0 } },
    })
    return
  }

  if (state === "ESCOLHENDO_DATA") {
    const dateStr = buttonId?.startsWith("date_") ? buttonId.slice("date_".length) : null
    if (!dateStr) {
      const attempts = (context.invalidAttempts ?? 0) + 1
      if (attempts >= MAX_INVALID_ATTEMPTS) {
        await goToHuman(companyId, from, provider, convId)
        return
      }
      await prisma.whatsAppConversation.update({
        where: { id: convId },
        data: { context: { ...context, invalidAttempts: attempts } },
      })
      return
    }

    const procedure = await prisma.procedure.findFirst({ where: { id: context.procedureId, companyId } })
    if (!procedure) {
      await goToHuman(companyId, from, provider, convId)
      return
    }

    const businessHours = await getBusinessHours(companyId)
    const professionals = await prisma.user.findMany({
      where: { companyId, role: { in: [...PROFESSIONAL_ROLES] }, isActive: true },
    })
    const { start, end } = dayRange(dateStr)
    const dayAppointments = await prisma.appointment.findMany({
      where: { companyId, date: { gte: start, lte: end }, status: { in: ["SCHEDULED", "CONFIRMED", "PENDING_APPROVAL"] } },
    })

    const times = computeAvailableTimes({
      businessHours,
      dateStr,
      durationMinutes: procedure.durationMinutes,
      existingAppointments: dayAppointments.map(a => ({ date: a.date as Date, durationMinutes: a.durationMinutes as number })),
      professionalCount: professionals.length,
      now,
    })

    if (times.length === 0) {
      await provider.sendText(companyId, from, "Não há horários livres nesse dia. Vou te passar pra um atendente escolher com você.")
      await prisma.whatsAppConversation.update({ where: { id: convId }, data: { state: "HUMANO" } })
      return
    }

    await provider.sendList(
      companyId, from, "Qual horário fica melhor?",
      times.map(t => ({ id: `time_${t}`, label: t }))
    )
    await prisma.whatsAppConversation.update({
      where: { id: convId },
      data: { state: "ESCOLHENDO_HORA", context: { ...context, date: dateStr, invalidAttempts: 0 } },
    })
    return
  }

  if (state === "ESCOLHENDO_HORA") {
    const time = buttonId?.startsWith("time_") ? buttonId.slice("time_".length) : null
    if (!time) {
      const attempts = (context.invalidAttempts ?? 0) + 1
      if (attempts >= MAX_INVALID_ATTEMPTS) {
        await goToHuman(companyId, from, provider, convId)
        return
      }
      await prisma.whatsAppConversation.update({
        where: { id: convId },
        data: { context: { ...context, invalidAttempts: attempts } },
      })
      return
    }

    const procedure = await prisma.procedure.findFirst({ where: { id: context.procedureId, companyId } })
    if (!procedure) {
      await goToHuman(companyId, from, provider, convId)
      return
    }

    await provider.sendButtons(
      companyId, from,
      `Confirmar agendamento de ${procedure.name} em ${context.date?.split("-").reverse().slice(0, 2).join("/")} às ${time}?`,
      [{ id: "confirm", label: "Confirmar" }, { id: "cancel", label: "Cancelar" }]
    )
    await prisma.whatsAppConversation.update({
      where: { id: convId },
      data: { state: "CONFIRMANDO", context: { ...context, time, invalidAttempts: 0 } },
    })
    return
  }

  if (state === "CONFIRMANDO") {
    if (buttonId === "cancel") {
      await provider.sendText(companyId, from, "Sem problemas! Se quiser agendar depois, é só chamar. 😊")
      await prisma.whatsAppConversation.update({ where: { id: convId }, data: { state: "START", context: {} } })
      return
    }

    if (buttonId !== "confirm") {
      const attempts = (context.invalidAttempts ?? 0) + 1
      if (attempts >= MAX_INVALID_ATTEMPTS) {
        await goToHuman(companyId, from, provider, convId)
        return
      }
      await prisma.whatsAppConversation.update({
        where: { id: convId },
        data: { context: { ...context, invalidAttempts: attempts } },
      })
      return
    }

    const procedure = await prisma.procedure.findFirst({ where: { id: context.procedureId, companyId } })
    if (!procedure || !context.date || !context.time) {
      await goToHuman(companyId, from, provider, convId)
      return
    }

    const [h, m] = context.time.split(":").map(Number)
    const [y, mo, d] = context.date.split("-").map(Number)
    const appointmentDate = new Date(y, mo - 1, d, h, m, 0, 0)
    const appointmentEnd = new Date(appointmentDate.getTime() + procedure.durationMinutes * 60000)

    const { start, end } = dayRange(context.date)

    // Transação serializável: se duas conversas confirmarem o mesmo horário ao mesmo
    // tempo, o Postgres rejeita uma delas com erro de conflito (P2034) em vez de
    // deixar as duas criarem o agendamento.
    let slotTaken = false
    try {
      await prisma.$transaction(async (tx) => {
        const professionals = await tx.user.findMany({
          where: { companyId, role: { in: [...PROFESSIONAL_ROLES] }, isActive: true },
        })
        const dayAppointments = await tx.appointment.findMany({
          where: { companyId, date: { gte: start, lte: end }, status: { in: ["SCHEDULED", "CONFIRMED", "PENDING_APPROVAL"] } },
        })

        const freeProfessional = professionals.find(prof => {
          const profAppointments = dayAppointments
            .filter(a => a.professionalId === prof.id)
            .map(a => ({ date: a.date as Date, durationMinutes: a.durationMinutes as number }))
          return !hasOverlap(profAppointments, appointmentDate, appointmentEnd)
        })

        if (!freeProfessional) {
          slotTaken = true
          return
        }

        let patient = await tx.patient.findFirst({ where: { phone: from, companyId } })
        if (!patient) {
          patient = await tx.patient.create({ data: { name: `Paciente ${from}`, email: `${from}@whatsapp.aura`, phone: from, companyId } })
        }

        await tx.appointment.create({
          data: {
            companyId,
            patientId: patient.id,
            professionalId: freeProfessional.id,
            procedureId: procedure.id,
            date: appointmentDate,
            durationMinutes: procedure.durationMinutes,
            price: Number(procedure.price),
            status: "PENDING_APPROVAL",
            notes: "Agendado via chatbot WhatsApp",
          },
        })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (err) {
      const isSerializationConflict = typeof err === "object" && err !== null && "code" in err && err.code === "P2034"
      if (!isSerializationConflict) throw err
      slotTaken = true
    }

    if (slotTaken) {
      await provider.sendText(companyId, from, "Esse horário não está mais disponível. Vamos escolher outro?")
      await prisma.whatsAppConversation.update({
        where: { id: convId },
        data: { state: "ESCOLHENDO_HORA", context: { ...context, time: undefined } },
      })
      return
    }

    await provider.sendText(companyId, from, "Agendamento solicitado com sucesso! ✅ Você vai receber a confirmação em breve.")
    await prisma.whatsAppConversation.update({ where: { id: convId }, data: { state: "CONCLUIDO" } })
  }
}
