// Aura System - Validações de Usuários/Profissionais
import { z } from "zod";
import { businessHoursSchema } from "./businessHours";

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
  // Horário específico do profissional (sobrescreve o da empresa). Antes era
  // `z.record(z.unknown())` — aceitava qualquer estrutura, tipos errados e dias
  // faltando. Agora usa o MESMO schema estruturado do horário da empresa
  // (7 dias, formato HH:mm, abertura < fechamento). `null` = limpar o campo;
  // `{}` = "sem horário individual" (o profissional herda o da empresa).
  businessHours: z
    .union([businessHoursSchema, z.null(), z.object({}).strict()])
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Schema para CRIAR um profissional (POST /api/users). name/email obrigatórios;
// os campos de enum (role/contractType/remunerationType) continuam sendo
// mapeados manualmente na rota via os mesmos maps de alias, então aqui só
// aceitamos string e deixamos o mapeamento pra rota — o essencial deste
// schema é travar os campos numéricos (commissionRate 0-100, fixedSalary >= 0),
// que antes passavam direto por parseFloat sem nenhum limite.
export const createUserSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  email: z.string().email("E-mail inválido").max(100),
  phone: z.string().max(20).optional().nullable(),
  role: z.string().optional(),
  title: z.string().max(100).optional().nullable(),
  contractType: z.string().optional().nullable(),
  remunerationType: z.string().optional().nullable(),
  commissionRate: z.coerce
    .number({ message: "Taxa de comissão inválida" })
    .min(0, "A taxa de comissão não pode ser negativa")
    .max(100, "A taxa de comissão não pode passar de 100%")
    .optional()
    .nullable(),
  fixedSalary: z.coerce
    .number({ message: "Salário fixo inválido" })
    .min(0, "O salário fixo não pode ser negativo")
    .optional()
    .nullable(),
  businessHours: z.record(z.string(), z.unknown()).optional().nullable(),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres").optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

