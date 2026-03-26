interface MessageParams {
  patientName: string
  clinicName: string
  date: string
  time: string
  procedure: string
  professional: string
}

export function buildConfirmationMessage(p: MessageParams): string {
  return `Olá ${p.patientName}! 👋\n\nAqui é o sistema de confirmações da *${p.clinicName}*.\n\n✅ Seu agendamento foi *confirmado*:\n📅 *${p.date}* às *${p.time}*\n💆 Procedimento: *${p.procedure}*\n👩‍⚕️ Profissional: *${p.professional}*\n\nPor favor, *salve este número* nos seus contatos para receber seus próximos lembretes! 😊`
}

export function buildReminderMessage(p: MessageParams): string {
  return `Olá ${p.patientName}! 🌟\n\nLembrete da *${p.clinicName}*:\n\nVocê tem um agendamento *amanhã*:\n📅 *${p.date}* às *${p.time}*\n💆 *${p.procedure}*\n\nTe esperamos! 😊`
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
}
