// Aura System - Validação de Horário de Funcionamento
// REGRA DE NEGÓCIO CRÍTICA - Executada no servidor

interface DayHours {
  isOpen: boolean;
  start: string; // HH:mm
  end: string;   // HH:mm
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface UnavailabilityRule {
  id: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  dates: string[];
  professionalIds: string[];
}

const WEEK_DAYS: (keyof BusinessHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * `true` somente quando o valor é um objeto com os 7 dias da semana, cada um
 * com `isOpen`. `null`, `undefined`, `{}` ou objeto parcial → `false`.
 * Serve para decidir se um horário individual do profissional é utilizável.
 */
export function isCompleteBusinessHours(value: unknown): value is BusinessHours {
  if (!value || typeof value !== "object") return false;
  return WEEK_DAYS.every((day) => {
    const dayConfig = (value as Record<string, unknown>)[day];
    return (
      !!dayConfig &&
      typeof dayConfig === "object" &&
      "isOpen" in (dayConfig as Record<string, unknown>)
    );
  });
}

/**
 * Resolve qual configuração de horário de funcionamento vale para um agendamento.
 *
 * Precedência (regra de negócio):
 *  1. Horário INDIVIDUAL do profissional — quando os 7 dias estão configurados,
 *     ele tem prioridade sobre o horário da empresa (permite um profissional
 *     atender numa janela mais restrita/ampla que a da clínica).
 *  2. Sem horário individual válido (`null`/`{}`/parcial), cai no horário da
 *     EMPRESA (fallback).
 *  3. Sem nenhum dos dois, retorna o horário da empresa como veio (pode ser
 *     `null`, e aí `isWithinBusinessHours` libera qualquer horário).
 */
export function resolveEffectiveBusinessHours(
  professionalBusinessHours: unknown,
  companyBusinessHours: BusinessHours | null
): BusinessHours | null {
  if (isCompleteBusinessHours(professionalBusinessHours)) {
    return professionalBusinessHours;
  }
  return companyBusinessHours;
}

const DAY_MAP: Record<number, keyof BusinessHours> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

/**
 * Converte string "HH:mm" para minutos desde meia-noite
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Verifica se um horário está dentro do horário de funcionamento
 */
export function isWithinBusinessHours(
  date: Date,
  businessHours: BusinessHours | null
): { valid: boolean; message?: string } {
  // Se não tem businessHours configurado, permitir qualquer horário
  if (!businessHours) {
    return { valid: true };
  }

  const dayOfWeek = date.getDay();
  const dayName = DAY_MAP[dayOfWeek];
  const dayConfig = businessHours[dayName];

  // Verificar se o dia está aberto
  if (!dayConfig || !dayConfig.isOpen) {
    return {
      valid: false,
      message: `A clínica não funciona neste dia da semana (${getDayNamePt(dayName)})`,
    };
  }

  // Verificar horário
  const appointmentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = timeToMinutes(dayConfig.start);
  const endMinutes = timeToMinutes(dayConfig.end);

  if (appointmentMinutes < startMinutes) {
    return {
      valid: false,
      message: `Horário antes da abertura. A clínica abre às ${dayConfig.start}`,
    };
  }

  if (appointmentMinutes >= endMinutes) {
    return {
      valid: false,
      message: `Horário após o fechamento. A clínica fecha às ${dayConfig.end}`,
    };
  }

  return { valid: true };
}

/**
 * Verifica se um profissional está indisponível em uma data/hora
 */
export function checkUnavailability(
  date: Date,
  professionalId: string,
  rules: UnavailabilityRule[]
): { blocked: boolean; reason?: string } {
  // TODO(fuso): `toISOString()` converte para UTC. Se o servidor roda em UTC
  // (Vercel) e o agendamento é um horário local do Brasil (UTC-3) perto da
  // meia-noite, a data pode "pular" para o dia seguinte e não bater com
  // `rule.dates` (strings YYYY-MM-DD sem fuso escolhidas no <input type="date">).
  // Reescrever isto exige alinhar como `appointmentDate` chega aqui — fora do
  // escopo atual. Ver businessHours.test.ts ("fuso horário / meia-noite").
  const dateStr = date.toISOString().split("T")[0];
  const timeMinutes = date.getHours() * 60 + date.getMinutes();

  for (const rule of rules) {
    // Verificar se a data está na regra
    if (!rule.dates.includes(dateStr)) continue;

    // Verificar se o profissional está afetado
    if (rule.professionalIds.length > 0 && !rule.professionalIds.includes(professionalId)) {
      continue;
    }

    // Verificar horário
    const ruleStart = timeToMinutes(rule.startTime);
    const ruleEnd = timeToMinutes(rule.endTime);

    if (timeMinutes >= ruleStart && timeMinutes < ruleEnd) {
      return {
        blocked: true,
        reason: rule.description || "Profissional indisponível neste horário",
      };
    }
  }

  return { blocked: false };
}

/**
 * Retorna nome do dia em português
 */
function getDayNamePt(day: keyof BusinessHours): string {
  const names: Record<keyof BusinessHours, string> = {
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
    sunday: "Domingo",
  };
  return names[day];
}

/**
 * Valida agendamento completo (business hours + indisponibilidade)
 */
export function validateAppointmentTime(
  date: Date,
  professionalId: string,
  businessHours: BusinessHours | null,
  unavailabilityRules: UnavailabilityRule[]
): { valid: boolean; message?: string } {
  // 1. Verificar horário de funcionamento
  const hoursCheck = isWithinBusinessHours(date, businessHours);
  if (!hoursCheck.valid) {
    return hoursCheck;
  }

  // 2. Verificar indisponibilidade do profissional
  const unavailCheck = checkUnavailability(date, professionalId, unavailabilityRules);
  if (unavailCheck.blocked) {
    return { valid: false, message: unavailCheck.reason };
  }

  return { valid: true };
}

