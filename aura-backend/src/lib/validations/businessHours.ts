// Aura System - Schema Zod compartilhado de Horário de Funcionamento
//
// Usado tanto pelo horário da empresa (PUT /api/companies/[id]) quanto pelo
// horário específico do profissional (PUT /api/users/[id]). Antes cada rota
// tinha sua própria validação: a de empresa só checava o formato `HH:mm` (nunca
// a ordem abertura < fechamento) e a de usuário era `z.record(z.unknown())`
// (aceitava qualquer coisa). Este schema unifica as duas e adiciona a regra
// `start < end` para dias abertos — o mesmo tipo de checagem que
// POST /api/unavailability já fazia (`startTime >= endTime → 400`).

import { z } from "zod";

const TIME_REGEX = /^\d{2}:\d{2}$/;

/** Converte "HH:mm" para minutos desde a meia-noite. */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Um dia da semana: aberto/fechado + janela de atendimento.
 * Quando `isOpen` é true, exige `start` estritamente antes de `end`
 * (comparação em minutos). Dia fechado ignora a ordem dos horários.
 */
export const dayHoursSchema = z
  .object({
    isOpen: z.boolean(),
    start: z.string().regex(TIME_REGEX, "Formato de hora inválido (use HH:mm)"),
    end: z.string().regex(TIME_REGEX, "Formato de hora inválido (use HH:mm)"),
  })
  .refine(
    (day) => !day.isOpen || timeToMinutes(day.start) < timeToMinutes(day.end),
    { message: "O horário de abertura deve ser menor que o de fechamento" }
  );

/** Objeto completo com os 7 dias da semana. Não é `.partial()` — todos obrigatórios. */
export const businessHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});

export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;
