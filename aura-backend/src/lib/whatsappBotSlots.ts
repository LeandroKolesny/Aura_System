// aura-backend/src/lib/whatsappBotSlots.ts
// Cálculo puro de datas/horários disponíveis para o chatbot de WhatsApp.
// Sem acesso a banco — recebe os dados já carregados e devolve as opções.

import { isWithinBusinessHours, type BusinessHours } from "./businessHours"

const DAY_MAP: Record<number, keyof BusinessHours> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Lista as datas (YYYY-MM-DD), a partir de `from`, em que a clínica abre. */
export function computeAvailableDates(
  businessHours: BusinessHours | null,
  from: Date,
  daysAhead: number
): string[] {
  if (!businessHours) return []
  const result: string[] = []
  for (let i = 0; i < daysAhead; i++) {
    const day = new Date(from)
    day.setDate(day.getDate() + i)
    const dayName = DAY_MAP[day.getDay()]
    if (businessHours[dayName]?.isOpen) {
      result.push(toDateStr(day))
    }
  }
  return result
}

interface ExistingAppointment {
  date: Date
  durationMinutes: number
}

interface ComputeAvailableTimesParams {
  businessHours: BusinessHours | null
  dateStr: string // YYYY-MM-DD
  durationMinutes: number
  existingAppointments: ExistingAppointment[]
  professionalCount: number
  now: Date
  slotIntervalMinutes?: number
}

/** Lista os horários (HH:mm) livres num dia, considerando expediente, duração e ocupação. */
export function computeAvailableTimes(params: ComputeAvailableTimesParams): string[] {
  const {
    businessHours,
    dateStr,
    durationMinutes,
    existingAppointments,
    professionalCount,
    now,
    slotIntervalMinutes = 30,
  } = params

  if (!businessHours || professionalCount <= 0) return []

  const [year, month, day] = dateStr.split("-").map(Number)
  const dayName = DAY_MAP[new Date(year, month - 1, day).getDay()]
  const dayConfig = businessHours[dayName]
  if (!dayConfig?.isOpen) return []

  const [openH, openM] = dayConfig.start.split(":").map(Number)
  const [closeH, closeM] = dayConfig.end.split(":").map(Number)

  const result: string[] = []
  const candidate = new Date(year, month - 1, day, openH, openM, 0, 0)
  const dayClose = new Date(year, month - 1, day, closeH, closeM, 0, 0)

  while (candidate.getTime() + durationMinutes * 60000 <= dayClose.getTime()) {
    const { valid } = isWithinBusinessHours(candidate, businessHours)
    if (valid && candidate.getTime() >= now.getTime()) {
      const candidateStart = candidate.getTime()
      const candidateEnd = candidateStart + durationMinutes * 60000
      const overlapping = existingAppointments.filter(appt => {
        const apptStart = appt.date.getTime()
        const apptEnd = apptStart + appt.durationMinutes * 60000
        return candidateStart < apptEnd && candidateEnd > apptStart
      }).length
      if (overlapping < professionalCount) {
        const hh = String(candidate.getHours()).padStart(2, "0")
        const mm = String(candidate.getMinutes()).padStart(2, "0")
        result.push(`${hh}:${mm}`)
      }
    }
    candidate.setMinutes(candidate.getMinutes() + slotIntervalMinutes)
  }

  return result
}
