// aura-backend/src/lib/whatsappBotFormat.ts
// Formatação de texto pro chatbot de WhatsApp: saudação por horário e resumo do expediente.

import type { BusinessHours } from "./businessHours"

const DAY_ORDER: (keyof BusinessHours)[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]

const DAY_LABEL: Record<keyof BusinessHours, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
}

/** Saudação de acordo com o horário em Brasília (UTC-3, sem horário de verão). */
export function getGreeting(now: Date): string {
  const brtHour = (now.getUTCHours() - 3 + 24) % 24
  if (brtHour < 12) return "Bom dia"
  if (brtHour < 18) return "Boa tarde"
  return "Boa noite"
}

/** Resume o expediente semanal agrupando dias consecutivos com o mesmo horário. */
export function formatBusinessHours(hours: BusinessHours | null): string {
  const fallback = "Consulte nossos horários com a equipe."
  if (!hours) return fallback

  const groups: { days: (keyof BusinessHours)[]; start: string; end: string }[] = []
  for (const day of DAY_ORDER) {
    const config = hours[day]
    if (!config?.isOpen) continue
    const last = groups[groups.length - 1]
    const prevDay = DAY_ORDER[DAY_ORDER.indexOf(day) - 1]
    if (last && prevDay && last.days[last.days.length - 1] === prevDay && last.start === config.start && last.end === config.end) {
      last.days.push(day)
    } else {
      groups.push({ days: [day], start: config.start, end: config.end })
    }
  }

  if (groups.length === 0) return fallback

  return groups
    .map(g => {
      const label = g.days.length > 1
        ? `${DAY_LABEL[g.days[0]]} a ${DAY_LABEL[g.days[g.days.length - 1]].toLowerCase()}`
        : DAY_LABEL[g.days[0]]
      return `${label}: ${g.start} às ${g.end}`
    })
    .join(" | ")
}
