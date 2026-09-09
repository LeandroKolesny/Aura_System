// Aura System - API de Agendamentos
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";
import { validateAppointmentTime, type BusinessHours, type UnavailabilityRule } from "@/lib/businessHours";
import {
  createAppointmentSchema,
  listAppointmentsQuerySchema,
} from "@/lib/validations/appointment";
import { pushAppointmentToCalendar } from "@/lib/calendarSync";

// Tipo do client dentro de uma transação — extraído do próprio `prisma`
// exportado (que é um client estendido, não o PrismaClient cru) em vez de
// `Prisma.TransactionClient`, que não bate estruturalmente com o tipo real
// que $transaction injeta quando o client tem extensões (@/lib/prisma usa
// $extends para converter campos Decimal em number).
type PrismaOrTx = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Sentinel lançado dentro da transação quando a re-checagem encontra conflito
class ScheduleConflictError extends Error {
  conflictingAppointment?: { id: string; date: Date; durationMinutes: number; patient: { name: string } };
  constructor(conflictingAppointment?: { id: string; date: Date; durationMinutes: number; patient: { name: string } }) {
    super("Conflito de horário");
    this.conflictingAppointment = conflictingAppointment;
  }
}

// Cache headers helper para GET requests
function createCachedResponse(data: unknown, cacheSeconds: number = 15) {
  const response = NextResponse.json(data);
  response.headers.set(
    "Cache-Control",
    `private, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`
  );
  return response;
}

/**
 * Verifica conflito de horário para um profissional
 * LÓGICA DE NEGÓCIO CRÍTICA - EXECUTADA NO SERVIDOR
 */
async function checkScheduleConflict(
  client: PrismaOrTx,
  companyId: string,
  professionalId: string,
  date: Date,
  durationMinutes: number,
  excludeAppointmentId?: string
): Promise<{ hasConflict: boolean; conflictingAppointment?: { id: string; date: Date; durationMinutes: number; patient: { name: string } } }> {
  const startTime = date.getTime();
  const endTime = startTime + durationMinutes * 60000;

  // Buscar agendamentos do profissional no mesmo dia
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const existingAppointments = await client.appointment.findMany({
    where: {
      companyId,
      professionalId,
      date: { gte: dayStart, lte: dayEnd },
      status: { in: ["SCHEDULED", "CONFIRMED", "PENDING_APPROVAL"] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: {
      id: true,
      date: true,
      durationMinutes: true,
      patient: { select: { name: true } },
    },
  });

  // Verificar sobreposição
  for (const appt of existingAppointments) {
    const existingStart = new Date(appt.date).getTime();
    const existingEnd = existingStart + appt.durationMinutes * 60000;

    // Conflito: novo começa antes do existente terminar E novo termina depois do existente começar
    if (startTime < existingEnd && endTime > existingStart) {
      return { hasConflict: true, conflictingAppointment: appt };
    }
  }

  return { hasConflict: false };
}

// GET - Listar agendamentos
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryValidation = listAppointmentsQuerySchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      professionalId: searchParams.get("professionalId"),
      patientId: searchParams.get("patientId"),
      status: searchParams.get("status"),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: queryValidation.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit, startDate, endDate, professionalId, patientId, status } = queryValidation.data;
    const skip = (page - 1) * limit;

    // Construir filtros
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const where: Prisma.AppointmentWhereInput = {
      companyId: user.companyId,
      ...(startDate || endDate ? { date: dateFilter } : {}),
    };
    if (professionalId) where.professionalId = professionalId;
    if (patientId) where.patientId = patientId;
    if (status && status !== "all") where.status = status;

    // Para pacientes: buscar TODOS os agendamentos (para mostrar slots ocupados)
    // mas anonimizar dados de outros pacientes
    let currentPatientId: string | null = null;
    if (user.role === "PATIENT") {
      const patientRecord = await prisma.patient.findFirst({
        where: { email: user.email, companyId: user.companyId },
        select: { id: true },
      });
      currentPatientId = patientRecord?.id || null;
      // NÃO filtra por patientId - queremos ver todos para mostrar ocupados
    }

    const [allAppointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "asc" },
        // Usar select para trazer apenas campos necessários
        select: {
          id: true,
          date: true,
          durationMinutes: true,
          price: true,
          status: true,
          notes: true,
          paid: true,
          roomId: true,
          signatureUrl: true,
          signatureMetadata: true,
          companyId: true,
          patientId: true,
          professionalId: true,
          procedureId: true,
          patient: { select: { id: true, name: true, phone: true, email: true } },
          professional: { select: { id: true, name: true } },
          procedure: { select: { id: true, name: true, durationMinutes: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    // Para pacientes, anonimizar dados de outros pacientes
    let appointments: typeof allAppointments = allAppointments;
    if (user.role === "PATIENT" && currentPatientId) {
      appointments = allAppointments.map((appt) => {
        if (appt.patientId === currentPatientId) {
          // Próprio agendamento - retorna todos os dados
          return appt;
        } else {
          // Agendamento de outro paciente - anonimiza dados sensíveis
          // Mantém os campos obrigatórios mas oculta informações sensíveis
          return {
            ...appt,
            patient: { id: appt.patientId, name: "Ocupado", phone: "", email: "" },
            notes: "",
            signatureUrl: "",
            signatureMetadata: {},
          };
        }
      });
    }

    // Cache por 15 segundos (dados dinâmicos)
    return createCachedResponse({
      appointments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, 15);
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar agendamento
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // GUARD: Verificar se plano permite escrita (exceto para pacientes que podem agendar)
    if (user.role !== "PATIENT") {
      const writeError = await checkWriteAccess(user);
      if (writeError) return writeError;
    }

    // Roles que podem criar agendamentos diretamente (status SCHEDULED)
    const staffRoles = ["OWNER", "ADMIN", "RECEPTIONIST", "ESTHETICIAN"];
    // PATIENT pode criar agendamentos, mas ficam com status PENDING_APPROVAL
    const isPatient = user.role === "PATIENT";

    if (!staffRoles.includes(user.role) && !isPatient) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createAppointmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    let { patientId, professionalId, procedureId, date, durationMinutes, price, notes, roomId, subscriptionId } = validation.data;
    const appointmentDate = new Date(date);

    // Buscar configurações da empresa (business hours + indisponibilidades)
    const [company, unavailabilityRules] = await Promise.all([
      prisma.company.findUnique({
        where: { id: user.companyId },
        select: { businessHours: true },
      }),
      prisma.unavailabilityRule.findMany({
        where: { companyId: user.companyId },
      }),
    ]);

    // VALIDAÇÃO: Verificar horário de funcionamento e indisponibilidade
    const timeValidation = validateAppointmentTime(
      appointmentDate,
      professionalId,
      company?.businessHours as BusinessHours | null,
      unavailabilityRules as UnavailabilityRule[]
    );

    if (!timeValidation.valid) {
      return NextResponse.json(
        {
          error: "Horário indisponível",
          message: timeValidation.message,
          code: "INVALID_TIME",
        },
        { status: 400 }
      );
    }

    // VALIDAÇÃO CRÍTICA: Verificar conflito de horário (checagem rápida — a garantia real vem da transação abaixo)
    const { hasConflict, conflictingAppointment } = await checkScheduleConflict(
      prisma,
      user.companyId,
      professionalId,
      appointmentDate,
      durationMinutes
    );

    if (hasConflict) {
      return NextResponse.json(
        {
          error: "Conflito de horário",
          message: `Já existe um agendamento neste horário`,
          conflict: conflictingAppointment,
        },
        { status: 409 }
      );
    }

    // ── Clube de Assinaturas: verificar cobertura ──
    let subscriptionCoverage: {
      covered: boolean;
      subscriptionId: string | null;
      sessionsRemaining: number;
      warning?: string;
    } = { covered: false, subscriptionId: null, sessionsRemaining: 0 };

    // For patient role, resolve their patientId from their email
    let resolvedPatientId = patientId;
    if (isPatient) {
      const patientRecord = await prisma.patient.findFirst({
        where: { email: user.email, companyId: user.companyId! },
        select: { id: true },
      });
      if (patientRecord) resolvedPatientId = patientRecord.id;
    }

    // Verificar se paciente existe
    const patient = await prisma.patient.findFirst({
      where: { id: resolvedPatientId, companyId: user.companyId },
    });
    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }

    // Verificar se procedimento existe
    const procedure = await prisma.procedure.findFirst({
      where: { id: procedureId, companyId: user.companyId },
    });
    if (!procedure) {
      return NextResponse.json({ error: "Procedimento não encontrado" }, { status: 404 });
    }

    // ── Clube de Assinaturas: para PATIENT, deduction acontece na aprovação (PENDING_APPROVAL→SCHEDULED)
    // Se subscriptionId foi fornecido (paciente selecionou plano), definir price=0 mas NÃO deduzir agora
    if (isPatient && subscriptionId) {
      subscriptionCoverage = {
        covered: true,
        subscriptionId,
        sessionsRemaining: 0, // real count calculado na aprovação
      };
      price = 0;
    } else if (!isPatient) {
      // Para staff: manter comportamento original de verificação por assinatura ativa
      const activeSubscription = await prisma.patientSubscription.findFirst({
        where: { patientId: resolvedPatientId, companyId: user.companyId!, status: "ACTIVE" },
        include: { plan: { include: { items: true } } },
      });

      if (activeSubscription) {
        const planItem = activeSubscription.plan.items.find(
          (item) => item.procedureId === procedureId
        );

        if (planItem) {
          const sessionsUsed =
            (activeSubscription.sessionsUsedThisCycle as Record<string, number>)[procedureId] ?? 0;
          const sessionsRemaining = planItem.sessionsPerCycle - sessionsUsed;

          if (sessionsRemaining > 0) {
            subscriptionCoverage = {
              covered: true,
              subscriptionId: activeSubscription.id,
              sessionsRemaining: sessionsRemaining - 1,
            };
            price = 0;
          } else {
            subscriptionCoverage = {
              covered: false,
              subscriptionId: activeSubscription.id,
              sessionsRemaining: 0,
              warning: `Sessões do plano esgotadas para ${procedure.name} neste ciclo. Agendamento cobrado normalmente.`,
            };
          }
        }
      }
    }
    // ── fim verificação de assinatura ──

    // Criar agendamento
    // Pacientes criam com status PENDING_APPROVAL, staff cria com SCHEDULED
    const appointmentStatus = isPatient ? "PENDING_APPROVAL" : "SCHEDULED";

    // Transação serializável: re-checa o conflito e cria de forma atômica, para que
    // duas requisições simultâneas para o mesmo horário não criem os dois agendamentos.
    let appointment;
    try {
      appointment = await prisma.$transaction(async (tx) => {
        const recheck = await checkScheduleConflict(tx, user.companyId!, professionalId, appointmentDate, durationMinutes);
        if (recheck.hasConflict) {
          throw new ScheduleConflictError(recheck.conflictingAppointment);
        }
        return tx.appointment.create({
          data: {
            companyId: user.companyId!,
            patientId: resolvedPatientId,
            professionalId,
            procedureId,
            date: appointmentDate,
            durationMinutes,
            price,
            notes,
            roomId,
            subscriptionId: subscriptionId ?? null,
            status: appointmentStatus,
          },
          include: {
            patient: { select: { id: true, name: true } },
            professional: { select: { id: true, name: true } },
            procedure: { select: { id: true, name: true } },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      const isSerializationConflict = typeof err === "object" && err !== null && "code" in err && err.code === "P2034";
      if (err instanceof ScheduleConflictError || isSerializationConflict) {
        return NextResponse.json(
          {
            error: "Conflito de horário",
            message: "Já existe um agendamento neste horário",
            conflict: err instanceof ScheduleConflictError ? err.conflictingAppointment : undefined,
          },
          { status: 409 }
        );
      }
      throw err;
    }

    // Decrementar sessão da assinatura se coberta
    if (subscriptionCoverage.covered && subscriptionCoverage.subscriptionId) {
      const sub = await prisma.patientSubscription.findUnique({
        where: { id: subscriptionCoverage.subscriptionId },
        select: { sessionsUsedThisCycle: true },
      });
      if (sub) {
        const current = sub.sessionsUsedThisCycle as Record<string, number>;
        await prisma.patientSubscription.update({
          where: { id: subscriptionCoverage.subscriptionId },
          data: {
            sessionsUsedThisCycle: {
              ...current,
              [procedureId]: (current[procedureId] ?? 0) + 1,
            },
          },
        });
      }
    }

    // Log de atividade
    const activityTitle = isPatient
      ? `Agendamento solicitado por ${patient.name} (aguardando aprovação)`
      : `Agendamento criado para ${patient.name}`;

    await prisma.activity.create({
      data: {
        type: "APPOINTMENT_CREATED",
        title: activityTitle,
        userId: user.id,
        metadata: { appointmentId: appointment.id, status: appointmentStatus },
      },
    });

    // Sync to Google Calendar (fire-and-forget — never block the API response)
    pushAppointmentToCalendar(appointment.id).catch(console.error);

    return NextResponse.json({ appointment, subscriptionCoverage }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

