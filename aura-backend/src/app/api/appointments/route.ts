// Aura System - API de Agendamentos
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";
import { validateAppointmentTime } from "@/lib/businessHours";
import {
  createAppointmentSchema,
  listAppointmentsQuerySchema,
} from "@/lib/validations/appointment";

// Cache headers helper para GET requests
function createCachedResponse(data: any, cacheSeconds: number = 15) {
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
  companyId: string,
  professionalId: string,
  date: Date,
  durationMinutes: number,
  excludeAppointmentId?: string
): Promise<{ hasConflict: boolean; conflictingAppointment?: any }> {
  const startTime = date.getTime();
  const endTime = startTime + durationMinutes * 60000;

  // Buscar agendamentos do profissional no mesmo dia
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      companyId,
      professionalId,
      date: { gte: dayStart, lte: dayEnd },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
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
    const where: any = { companyId: user.companyId };

    if (startDate) where.date = { ...where.date, gte: new Date(startDate) };
    if (endDate) where.date = { ...where.date, lte: new Date(endDate) };
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

    let { patientId, professionalId, procedureId, date, durationMinutes, price, notes, roomId } = validation.data;
    const appointmentDate = new Date(date);

    // Se for paciente, garantir que só pode agendar para si mesmo
    if (isPatient) {
      const patientRecord = await prisma.patient.findFirst({
        where: { email: user.email, companyId: user.companyId },
      });

      if (!patientRecord) {
        return NextResponse.json(
          { error: "Paciente não encontrado para este usuário" },
          { status: 404 }
        );
      }

      // Sobrescreve o patientId com o próprio ID do paciente logado
      patientId = patientRecord.id;
    }

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
      company?.businessHours as any,
      unavailabilityRules as any
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

    // VALIDAÇÃO CRÍTICA: Verificar conflito de horário
    const { hasConflict, conflictingAppointment } = await checkScheduleConflict(
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

    // Verificar se paciente existe
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, companyId: user.companyId },
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

    // Criar agendamento
    // Pacientes criam com status PENDING_APPROVAL, staff cria com SCHEDULED
    const appointmentStatus = isPatient ? "PENDING_APPROVAL" : "SCHEDULED";

    const appointment = await prisma.appointment.create({
      data: {
        companyId: user.companyId,
        patientId,
        professionalId,
        procedureId,
        date: appointmentDate,
        durationMinutes,
        price,
        notes,
        roomId,
        status: appointmentStatus,
      },
      include: {
        patient: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
        procedure: { select: { id: true, name: true } },
      },
    });

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

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

