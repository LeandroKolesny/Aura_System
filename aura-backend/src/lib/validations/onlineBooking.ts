// Aura System - Schemas Zod compartilhados da "Agenda Online"
//
// Antes, em PUT /api/companies/[id], os campos `onlineBookingConfig` e
// `layoutConfig` eram `z.record(z.unknown())` — zero validação de conteúdo:
// string onde deveria ser number, cor fora do padrão hexadecimal, números
// negativos, `minAdvanceTime` maior que `maxBookingPeriod` — tudo passava e ia
// parar no banco, quebrando a página pública (`pages/PublicBooking.tsx`).
//
// Estes schemas endurecem os dois objetos e ficam aqui para serem reaproveitados
// pela rota pública GET /api/public/company/[slug], que devolve os mesmos campos.

import { z } from "zod";

// Cor hexadecimal #RGB ou #RRGGBB — mesmo formato produzido pelo
// <input type="color"> em AccessLink.tsx.
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const hexColor = z
  .string()
  .regex(HEX_COLOR_REGEX, "Cor deve estar no formato hexadecimal (#RGB ou #RRGGBB)");

// 1 dia = 1440 minutos. `minAdvanceTime`/`cancellationNotice` estão em MINUTOS;
// `maxBookingPeriod` está em DIAS — unidades diferentes no mesmo objeto.
const MINUTES_PER_DAY = 60 * 24;

/**
 * Regras de horário do agendamento online (accordion "Configurações de Horários
 * dos Clientes" em AccessLink.tsx).
 *
 * Todos os campos são opcionais (`.partial()`) porque a tela pode enviar só
 * parte do objeto. O `.refine()` garante coerência de unidades entre
 * `minAdvanceTime` (minutos) e `maxBookingPeriod` (dias).
 */
export const onlineBookingConfigSchema = z
  .object({
    // minutos entre slots ofertados (a UI usa 10/15/30/60)
    slotInterval: z.number().int().positive(),
    // minutos de antecedência mínima para o cliente conseguir agendar
    minAdvanceTime: z.number().int().min(0),
    // dias à frente que o cliente pode agendar (> 0)
    maxBookingPeriod: z.number().int().positive(),
    // minutos de antecedência mínima para o cliente cancelar
    cancellationNotice: z.number().int().min(0),
    // texto livre exibido ao cliente
    cancellationPolicy: z.string().max(1000),
  })
  .partial()
  .refine(
    (cfg) => {
      if (cfg.minAdvanceTime === undefined || cfg.maxBookingPeriod === undefined) {
        return true;
      }
      // Converte a antecedência mínima (minutos) para dias e exige que ela caiba
      // dentro da janela máxima de agendamento (dias). Se não couber, nenhum
      // horário seria ofertável na página pública.
      const minAdvanceInDays = cfg.minAdvanceTime / MINUTES_PER_DAY;
      return minAdvanceInDays <= cfg.maxBookingPeriod;
    },
    {
      message:
        "A antecedência mínima (minAdvanceTime), convertida para dias, não pode exceder maxBookingPeriod",
      path: ["minAdvanceTime"],
    }
  );

/**
 * Aparência da página pública de agendamento (accordion "Configurar Layout de
 * Acesso Público" em AccessLink.tsx). Todos os campos são opcionais — a tela
 * reenvia o objeto inteiro a cada save, mas chamadas parciais continuam válidas.
 */
export const publicLayoutConfigSchema = z.object({
  backgroundColor: hexColor.optional(),
  primaryColor: hexColor.optional(),
  textColor: hexColor.optional(),
  cardBackgroundColor: hexColor.optional(),
  cardTextColor: hexColor.optional(),
  headerBackgroundColor: hexColor.optional(),
  headerTextColor: hexColor.optional(),
  fontFamily: z.enum(["inter", "serif", "system"]).optional(),
  baseFontSize: z.enum(["sm", "md", "lg"]).optional(),
});

export type OnlineBookingConfigInput = z.infer<typeof onlineBookingConfigSchema>;
export type PublicLayoutConfigInput = z.infer<typeof publicLayoutConfigSchema>;
