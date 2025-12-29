// Aura System - Validação de Horário de Funcionamento
// REGRA DE NEGÓCIO CRÍTICA - Executada no servidor

interface DayHours {
  isOpen: boolean;
  start: string; // HH:mm
  end: string;   // HH:mm
}

interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

interface UnavailabilityRule {
  id: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  dates: string[];
  professionalIds: string[];
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

