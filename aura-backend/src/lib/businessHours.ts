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

// ---------------------------------------------------------------------------
// Fuso horário da clínica (Bug A da auditoria)
// ---------------------------------------------------------------------------
// O `Date` que chega aqui representa um instante UTC (`isoDate.toISOString()`,
// gerado no navegador do cliente a partir da hora LOCAL dele — Brasil,
// America/Sao_Paulo, UTC-3). O servidor (Vercel) roda em Node sem `TZ`
// configurada, ou seja, em UTC. `.getHours()`/`.getDay()` num `Date` sempre
// leem a hora no fuso do PROCESSO que executa o código — nunca a hora local
// de quem criou o valor. Se lermos com `.getHours()` cru, um agendamento às
// 17h locais (dentro do expediente) chega representando 20h UTC e é rejeitado
// por engano.
//
// Decisão: em vez de instalar uma lib de fuso horário (ex.: `date-fns-tz`)
// para um único deslocamento fixo, aplicamos um offset explícito e comentado
// de -3h (UTC-3), convertendo o instante UTC para a hora de parede de
// America/Sao_Paulo manualmente. Isso é suficiente porque:
//   1. Todas as clínicas do sistema são brasileiras (regra de negócio atual);
//   2. O Brasil não observa horário de verão desde 2019 — não há transição a
//      tratar, então um offset fixo é sempre correto (limitação documentada:
//      se o produto expandir para fusos múltiplos ou o Brasil reintroduzir o
//      horário de verão, isto precisa virar uma tabela de fusos ou uma lib
//      como `date-fns-tz`, e o offset abaixo precisa ser parametrizado por
//      clínica).
// Usamos `getUTC*` sobre o Date deslocado para ler os componentes de data/hora
// sem depender do fuso do processo (`TZ`) que executa o código.
const CLINIC_UTC_OFFSET_HOURS = -3; // America/Sao_Paulo, sem horário de verão desde 2019
const CLINIC_UTC_OFFSET_MS = CLINIC_UTC_OFFSET_HOURS * 60 * 60 * 1000;

interface ClinicLocalParts {
  dayOfWeek: number; // 0 (domingo) a 6 (sábado), igual a Date#getDay()
  minutesSinceMidnight: number;
}

/**
 * Converte um instante UTC para dia da semana + minutos desde a meia-noite no
 * horário local da clínica (America/Sao_Paulo, offset fixo -3h), sem depender
 * do fuso horário do processo que executa o código.
 */
function toClinicLocalParts(date: Date): ClinicLocalParts {
  const shifted = new Date(date.getTime() + CLINIC_UTC_OFFSET_MS);
  return {
    dayOfWeek: shifted.getUTCDay(),
    minutesSinceMidnight: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function buildDurationExceedsClosingMessage(durationMinutes: number, closeTime: string): string {
  return `Esse horário não é possível: o procedimento dura ${durationMinutes} min e a clínica encerra às ${closeTime}. Escolha um horário mais cedo.`;
}

/**
 * Verifica se um horário está dentro do horário de funcionamento.
 *
 * Quando `durationMinutes` é informado (Passo 3 da auditoria: a checagem de
 * início sozinha não bastava), também valida que o TÉRMINO do procedimento
 * (início + duração) cabe antes do fechamento do dia — evita oferecer/aceitar
 * um horário que começa dentro do expediente mas termina depois da clínica
 * fechar.
 */
export function isWithinBusinessHours(
  date: Date,
  businessHours: BusinessHours | null,
  durationMinutes?: number
): { valid: boolean; message?: string } {
  // Se não tem businessHours configurado, permitir qualquer horário
  if (!businessHours) {
    return { valid: true };
  }

  const { dayOfWeek, minutesSinceMidnight: appointmentMinutes } = toClinicLocalParts(date);
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

  if (durationMinutes && appointmentMinutes + durationMinutes > endMinutes) {
    return {
      valid: false,
      message: buildDurationExceedsClosingMessage(durationMinutes, dayConfig.end),
    };
  }

  return { valid: true };
}

/**
 * Verifica somente se o TÉRMINO do procedimento (início + duração) ultrapassa
 * o fechamento do dia. Não valida abertura/dia fechado — isso é
 * responsabilidade de `isWithinBusinessHours`/`validateAppointmentTime`, hoje
 * chamadas só em POST /api/appointments (rota autenticada).
 *
 * Serve como rede de segurança mínima nas rotas PÚBLICAS de agendamento
 * (`/api/public/booking`, `/api/public/subscriptions/book`), que hoje não têm
 * NENHUMA validação de horário de funcionamento — adicionar a validação de
 * abertura/fechamento completa nelas é uma mudança maior e separada (fora do
 * escopo desta tarefa; documentado em docs/test-audit/cliente-agendamento-publico.md).
 * Esta função cobre especificamente o cenário "aba aberta há tempo, grade
 * desatualizada": mesmo que o frontend tenha oferecido o horário, o backend
 * rejeita se o procedimento terminaria depois do fechamento.
 */
export function checkDurationFitsBeforeClosing(
  date: Date,
  durationMinutes: number,
  businessHours: BusinessHours | null
): { valid: boolean; message?: string } {
  if (!businessHours || !durationMinutes) {
    return { valid: true };
  }

  const { dayOfWeek, minutesSinceMidnight: appointmentMinutes } = toClinicLocalParts(date);
  const dayName = DAY_MAP[dayOfWeek];
  const dayConfig = businessHours[dayName];

  if (!dayConfig || !dayConfig.isOpen) {
    // Dia fechado é responsabilidade de outra checagem; não é o papel desta função.
    return { valid: true };
  }

  const endMinutes = timeToMinutes(dayConfig.end);
  if (appointmentMinutes + durationMinutes > endMinutes) {
    return {
      valid: false,
      message: buildDurationExceedsClosingMessage(durationMinutes, dayConfig.end),
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
  unavailabilityRules: UnavailabilityRule[],
  durationMinutes?: number
): { valid: boolean; message?: string } {
  // 1. Verificar horário de funcionamento (incluindo se o término do
  // procedimento cabe antes do fechamento, quando durationMinutes é passado)
  const hoursCheck = isWithinBusinessHours(date, businessHours, durationMinutes);
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

