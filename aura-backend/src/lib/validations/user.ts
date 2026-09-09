// Aura System - Validações de Usuários/Profissionais
import { z } from "zod";

// Schema para atualizar um profissional/usuário da equipe.
// Todos os campos são opcionais (update parcial). O frontend envia role/
// contractType já em UPPERCASE (mesmo formato do enum do Prisma), mas
// remunerationType em português minúsculo ('fixo'/'comissao'/'misto') —
// os mesmos aliases que a rota de criação (POST /api/users) já mapeia.
// Nunca assumir só .toUpperCase(): sem esse alias, "comissao" vira
// "COMISSAO", que não bate com nenhum valor do enum, e a validação falha
// silenciosamente pro usuário (é exatamente o bug que gerou este comentário).
const roleValues = ["ADMIN", "OWNER", "RECEPTIONIST", "ESTHETICIAN", "PATIENT"] as const;
const contractValues = ["CLT", "PJ", "FREELANCER"] as const;
const remunerationValues = ["FIXED", "COMMISSION", "MIXED"] as const;

const remunerationAliases: Record<string, (typeof remunerationValues)[number]> = {
  fixed: "FIXED", fixo: "FIXED",
  commission: "COMMISSION", comissao: "COMMISSION",
  mixed: "MIXED", misto: "MIXED",
};

function upperEnum<T extends readonly string[]>(values: T) {
  return z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(values as unknown as [string, ...string[]]));
}

const remunerationTypeSchema = z
  .string()
  .transform((v) => remunerationAliases[v.toLowerCase()] ?? v.toUpperCase())
  .pipe(z.enum(remunerationValues));

export const updateUserSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100).optional(),
  email: z.string().email("E-mail inválido").max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  role: upperEnum(roleValues).optional(),
  title: z.string().max(100).optional().nullable(),
  contractType: upperEnum(contractValues).optional(),
  remunerationType: remunerationTypeSchema.optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional().nullable(),
  fixedSalary: z.coerce.number().min(0).optional().nullable(),
  businessHours: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
