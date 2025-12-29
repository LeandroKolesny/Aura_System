// Aura System - Validações de Transações
import { z } from "zod";

// Schema para criar transação (receita/despesa)
export const createTransactionSchema = z.object({
  date: z.string().refine((val) => !isNaN(new Date(val).getTime()), "Data inválida"),
  description: z
    .string()
    .min(3, "Descrição deve ter pelo menos 3 caracteres")
    .max(200, "Descrição deve ter no máximo 200 caracteres"),
  amount: z.number().positive("Valor deve ser positivo"),
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1, "Categoria é obrigatória"),
  status: z.enum(["PAID", "PENDING"]).optional().default("PENDING"),
  paymentMethod: z.string().optional().nullable(),
  patientId: z.string().optional().nullable(),
  appointmentId: z.string().optional().nullable(),
  professionalId: z.string().optional().nullable(),
});

// Schema para processar pagamento de agendamento
export const processPaymentSchema = z.object({
  appointmentId: z.string().min(1, "ID do agendamento é obrigatório"),
  paymentMethod: z.string().min(1, "Método de pagamento é obrigatório"),
  amount: z.number().positive("Valor deve ser positivo").optional(), // Se não informado, usa o preço do agendamento
  discount: z.number().min(0).optional().default(0),
});

// Schema para atualizar transação
export const updateTransactionSchema = z.object({
  description: z.string().min(3).max(200).optional(),
  amount: z.number().positive().optional(),
  category: z.string().optional(),
  status: z.enum(["PAID", "PENDING", "REFUNDED"]).optional(),
  paymentMethod: z.string().optional().nullable(),
});

// Helper para preprocessar valores nulos de query string
const nullToUndefined = (val: unknown) => (val === null || val === '' ? undefined : val);

// Schema para filtros de listagem
export const listTransactionsQuerySchema = z.object({
  page: z.preprocess(nullToUndefined, z.coerce.number().min(1).default(1)),
  limit: z.preprocess(nullToUndefined, z.coerce.number().min(1).max(100).default(50)),
  startDate: z.preprocess(nullToUndefined, z.string().optional()),
  endDate: z.preprocess(nullToUndefined, z.string().optional()),
  type: z.preprocess(nullToUndefined, z.enum(["INCOME", "EXPENSE", "all"]).optional()),
  status: z.preprocess(nullToUndefined, z.enum(["PAID", "PENDING", "OVERDUE", "REFUNDED", "all"]).optional()),
  category: z.preprocess(nullToUndefined, z.string().optional()),
  patientId: z.preprocess(nullToUndefined, z.string().optional()),
});

// Tipos exportados
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

