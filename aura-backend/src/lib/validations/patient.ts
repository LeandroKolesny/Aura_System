// Aura System - Validações de Pacientes
import { z } from "zod";

// Regex para validação de CPF (formato: 000.000.000-00)
const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

// Regex para validação de telefone brasileiro
const phoneRegex = /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/;

/**
 * Valida CPF brasileiro (algoritmo completo)
 */
function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validação dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

// Schema para criar paciente
export const createPatientSchema = z.object({
  name: z
    .string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras"),
  
  email: z
    .string()
    .email("E-mail inválido")
    .max(100, "E-mail deve ter no máximo 100 caracteres"),
  
  phone: z
    .string()
    .min(10, "Telefone deve ter pelo menos 10 dígitos")
    .max(20, "Telefone inválido"),
  
  birthDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      return !isNaN(date.getTime()) && date < new Date();
    }, "Data de nascimento inválida"),
  
  cpf: z
    .string()
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      return isValidCPF(val);
    }, "CPF inválido"),
  
  status: z.enum(["ACTIVE", "INACTIVE", "LEAD"]).optional().default("ACTIVE"),
  
  anamnesisSummary: z.string().optional().nullable(),
});

// Schema para atualizar paciente
export const updatePatientSchema = createPatientSchema.partial();

// Schema para assinar consentimento
export const signConsentSchema = z.object({
  signatureUrl: z.string().min(1, "Assinatura é obrigatória"),
  metadata: z.object({
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    documentVersion: z.string().optional(),
  }).optional(),
});

// Schema para filtros de listagem
export const listPatientsQuerySchema = z.object({
  page: z.preprocess((val) => (val === null || val === '' ? undefined : val), z.coerce.number().min(1).default(1)),
  limit: z.preprocess((val) => (val === null || val === '' ? undefined : val), z.coerce.number().min(1).max(100).default(20)),
  search: z.preprocess((val) => (val === null || val === '' ? undefined : val), z.string().optional()),
  status: z.preprocess((val) => (val === null || val === '' ? undefined : val), z.enum(["ACTIVE", "INACTIVE", "LEAD", "all"]).optional()),
  sortBy: z.preprocess((val) => (val === null || val === '' ? undefined : val), z.enum(["name", "createdAt", "lastVisit"]).optional().default("name")),
  sortOrder: z.preprocess((val) => (val === null || val === '' ? undefined : val), z.enum(["asc", "desc"]).optional().default("asc")),
});

// Tipos exportados
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type SignConsentInput = z.infer<typeof signConsentSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

