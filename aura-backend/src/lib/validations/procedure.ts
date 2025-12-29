// Aura System - Validações de Procedimentos
import { z } from "zod";

// Schema para supply (insumo do procedimento)
const supplySchema = z.object({
  inventoryItemId: z.string().min(1, "Item de estoque é obrigatório"),
  quantityUsed: z.number().positive("Quantidade deve ser positiva"),
});

// Schema para criar procedimento
export const createProcedureSchema = z.object({
  name: z
    .string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional().nullable(),
  imageUrl: z.string().url("URL inválida").optional().nullable(),
  price: z.number().min(0, "Preço não pode ser negativo"),
  cost: z.number().min(0, "Custo não pode ser negativo").optional().default(0),
  durationMinutes: z.number().min(15, "Duração mínima é 15 minutos").max(480, "Duração máxima é 8 horas"),
  isActive: z.boolean().optional().default(true),
  maintenanceRequired: z.boolean().optional().default(false),
  maintenanceIntervalDays: z.number().min(1).optional().nullable(),
  supplies: z.array(supplySchema).optional().default([]),
});

// Schema para atualizar procedimento
export const updateProcedureSchema = createProcedureSchema.partial();

// Helper para preprocessar valores nulos de query string
const nullToUndefined = (val: unknown) => (val === null || val === '' ? undefined : val);

// Schema para filtros
export const listProceduresQuerySchema = z.object({
  page: z.preprocess(nullToUndefined, z.coerce.number().min(1).default(1)),
  limit: z.preprocess(nullToUndefined, z.coerce.number().min(1).max(100).default(50)),
  search: z.preprocess(nullToUndefined, z.string().optional()),
  isActive: z.preprocess(nullToUndefined, z.enum(["true", "false", "all"]).optional().default("true")),
});

// Tipos exportados
export type CreateProcedureInput = z.infer<typeof createProcedureSchema>;
export type UpdateProcedureInput = z.infer<typeof updateProcedureSchema>;
export type ListProceduresQuery = z.infer<typeof listProceduresQuerySchema>;

