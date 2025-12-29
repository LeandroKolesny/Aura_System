// Aura System - Validações de Estoque
import { z } from "zod";

// Schema para criar item de estoque
export const createInventoryItemSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  unit: z.string().min(1, "Unidade é obrigatória").max(10, "Unidade deve ter no máximo 10 caracteres"),
  currentStock: z.number().min(0, "Estoque não pode ser negativo"),
  minStock: z.number().min(0, "Estoque mínimo não pode ser negativo").default(5),
  costPerUnit: z.number().min(0, "Custo não pode ser negativo"),
});

// Schema para atualizar item de estoque
export const updateInventoryItemSchema = createInventoryItemSchema.partial();

// Schema para ajuste de estoque
export const stockAdjustmentSchema = z.object({
  quantity: z.number().refine((val) => val !== 0, "Quantidade não pode ser zero"),
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "LOSS"]),
  reason: z.string().min(3, "Motivo é obrigatório").max(200, "Motivo deve ter no máximo 200 caracteres"),
});

// Helper para preprocessar valores nulos de query string
const nullToUndefined = (val: unknown) => (val === null || val === '' ? undefined : val);

// Schema para filtros
export const listInventoryQuerySchema = z.object({
  page: z.preprocess(nullToUndefined, z.coerce.number().min(1).default(1)),
  limit: z.preprocess(nullToUndefined, z.coerce.number().min(1).max(100).default(50)),
  search: z.preprocess(nullToUndefined, z.string().optional()),
  lowStock: z.preprocess(nullToUndefined, z.enum(["true", "false"]).optional()),
  isActive: z.preprocess(nullToUndefined, z.enum(["true", "false", "all"]).optional().default("true")),
});

// Tipos exportados
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;

