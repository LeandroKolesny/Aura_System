// Aura System - Validações de Agendamentos
import { z } from "zod";

// Schema para criar agendamento
export const createAppointmentSchema = z.object({
  patientId: z.string().min(1, "Paciente é obrigatório"),
  professionalId: z.string().min(1, "Profissional é obrigatório"),
  procedureId: z.string().min(1, "Procedimento é obrigatório"),
  date: z
    .string()
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Data inválida")
    .refine((val) => {
      const date = new Date(val);
      const now = new Date();
      // Permitir agendamento com pelo menos 30 minutos de antecedência
      now.setMinutes(now.getMinutes() + 30);
      return date >= now;
    }, "Agendamento deve ser com pelo menos 30 minutos de antecedência"),
  durationMinutes: z.number().min(15, "Duração mínima é 15 minutos").max(480, "Duração máxima é 8 horas"),
  price: z.number().min(0, "Preço não pode ser negativo"),
  notes: z.string().max(500, "Notas devem ter no máximo 500 caracteres").optional().nullable(),
  roomId: z.number().optional().nullable(),
});

// Schema para agendamento público (booking online)
export const publicBookingSchema = z.object({
  procedureId: z.string().min(1, "Procedimento é obrigatório"),
  professionalId: z.string().min(1, "Profissional é obrigatório"),
  date: z.string().refine((val) => {
    const date = new Date(val);
    const now = new Date();
    now.setHours(now.getHours() + 2); // Mínimo 2 horas de antecedência para booking público
    return !isNaN(date.getTime()) && date >= now;
  }, "Data inválida ou muito próxima"),
  
  // Dados do paciente (para novos pacientes)
  patientName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  patientEmail: z.string().email("E-mail inválido"),
  patientPhone: z.string().min(10, "Telefone inválido"),
});

// Schema para atualizar agendamento
export const updateAppointmentSchema = z.object({
  date: z.string().optional(),
  durationMinutes: z.number().min(15).max(480).optional(),
  price: z.number().min(0).optional(),
  notes: z.string().max(500).optional().nullable(),
  roomId: z.number().optional().nullable(),
  professionalId: z.string().optional(),
});

// Schema para alterar status
export const updateStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELED", "PENDING_APPROVAL"]),
  cancelReason: z.string().max(200).optional(),
});

// Helper para preprocessar valores nulos de query string
const nullToUndefined = (val: unknown) => (val === null || val === '' ? undefined : val);

// Schema para filtros de listagem
export const listAppointmentsQuerySchema = z.object({
  page: z.preprocess(nullToUndefined, z.coerce.number().min(1).default(1)),
  limit: z.preprocess(nullToUndefined, z.coerce.number().min(1).max(100).default(50)),
  startDate: z.preprocess(nullToUndefined, z.string().optional()),
  endDate: z.preprocess(nullToUndefined, z.string().optional()),
  professionalId: z.preprocess(nullToUndefined, z.string().optional()),
  patientId: z.preprocess(nullToUndefined, z.string().optional()),
  status: z.preprocess(nullToUndefined, z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELED", "PENDING_APPROVAL", "all"]).optional()),
});

// Tipos exportados
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;

