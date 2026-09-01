// Aura System - API Pública de Booking (sem autenticação)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIP } from "@/lib/rateLimiter";

// Sentinel lançado dentro da transação quando a re-checagem encontra conflito
class ScheduleConflictError extends Error {
  constructor() {
    super("Horário não disponível");
  }
}

const bookingSchema = z.object({
  companyId: z.string().cuid("companyId inválido"),
  procedureId: z.string().cuid("procedureId inválido"),
  professionalId: z.string().cuid("professionalId inválido"),
  date: z.string().datetime("Data inválida"),
  patientInfo: z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
    email: z.string().email("E-mail inválido"),
    phone: z.string().min(8, "Celular deve ter pelo menos 8 dígitos").max(20, "Celular muito longo"),
    password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").max(100, "Senha muito longa").optional(),
  }),
});

// POST - Criar agendamento público
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 bookings por IP a cada 15 minutos
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit(clientIP, "public_booking");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Muitas solicitações. Tente novamente em alguns minutos." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validation = bookingSchema.safeParse(body);

    if (!validation.success) {
      const fieldLabels: Record<string, string> = {
        "patientInfo.name": "Nome",
        "patientInfo.email": "E-mail",
        "patientInfo.phone": "Celular",
        "patientInfo.password": "Senha",
        date: "Data/hora",
        procedureId: "Procedimento",
        companyId: "Empresa",
        professionalId: "Profissional",
      };
      const messages = validation.error.errors.map((e) => {
        const path = e.path.join(".");
        const label = fieldLabels[path] ?? String(e.path[e.path.length - 1] ?? path);
        return `${label}: ${e.message}`;
      });
      const message = [...new Set(messages)].join(" | ");
      return NextResponse.json(
        { error: message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { companyId, procedureId, professionalId, date, patientInfo } = validation.data;
    const { name, email, phone, password } = patientInfo;

    // Verificar se empresa existe e tem booking online ativo
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, onlineBookingConfig: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

    // Verificar se procedimento existe
    const procedure = await prisma.procedure.findFirst({
      where: { id: procedureId, companyId },
    });

    if (!procedure) {
      return NextResponse.json({ error: "Procedimento não encontrado" }, { status: 404 });
    }

    // Verificar se profissional existe
    const professional = await prisma.user.findFirst({
      where: { id: professionalId, companyId },
    });

    if (!professional) {
      return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
    }

    const appointmentDate = new Date(date);

    // Verificar conflito de horário
    const dayStart = new Date(appointmentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(appointmentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        companyId,
        professionalId,
        date: { gte: dayStart, lte: dayEnd },
        status: { in: ["SCHEDULED", "CONFIRMED", "PENDING_APPROVAL"] },
      },
    });

    const startTime = appointmentDate.getTime();
    const endTime = startTime + procedure.durationMinutes * 60000;

    for (const appt of existingAppointments) {
      const existingStart = new Date(appt.date).getTime();
      const existingEnd = existingStart + appt.durationMinutes * 60000;
      if (startTime < existingEnd && endTime > existingStart) {
        return NextResponse.json(
          { error: "Horário não disponível", code: "CONFLICT" },
          { status: 409 }
        );
      }
    }

    // Criar user PATIENT apenas se senha fornecida e não existe conta para este email+empresa
    if (password) {
      const existingUser = await prisma.user.findFirst({
        where: { email, companyId },
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(password, 12);
        await prisma.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            role: "PATIENT",
            companyId,
            isActive: true,
            emailVerified: new Date(),
          },
        });
      }
    }

    // Transação serializável: re-checa o conflito, busca/cria paciente e cria o
    // agendamento de forma atômica — duas requisições simultâneas pro mesmo
    // horário não conseguem as duas passar.
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const conflicting = await tx.appointment.findMany({
          where: {
            companyId,
            professionalId,
            date: { gte: dayStart, lte: dayEnd },
            status: { in: ["SCHEDULED", "CONFIRMED", "PENDING_APPROVAL"] },
          },
        });
        for (const appt of conflicting) {
          const existingStart = new Date(appt.date).getTime();
          const existingEnd = existingStart + appt.durationMinutes * 60000;
          if (startTime < existingEnd && endTime > existingStart) {
            throw new ScheduleConflictError();
          }
        }

        let patient = await tx.patient.findFirst({ where: { email, companyId } });
        if (!patient) {
          patient = await tx.patient.create({ data: { name, email, phone, companyId } });
        }

        const appointment = await tx.appointment.create({
          data: {
            companyId,
            patientId: patient.id,
            professionalId,
            procedureId,
            date: appointmentDate,
            durationMinutes: procedure.durationMinutes,
            price: Number(procedure.price),
            status: "PENDING_APPROVAL",
            notes: `Agendamento online - ${phone}`,
          },
          include: {
            patient: { select: { id: true, name: true } },
            professional: { select: { id: true, name: true } },
            procedure: { select: { id: true, name: true } },
          },
        });

        return { appointment, patient };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      const isSerializationConflict = typeof err === "object" && err !== null && "code" in err && err.code === "P2034";
      if (err instanceof ScheduleConflictError || isSerializationConflict) {
        return NextResponse.json(
          { error: "Horário não disponível", code: "CONFLICT" },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json(
      {
        success: true,
        appointment: result.appointment,
        patient: result.patient,
        message: "Agendamento solicitado com sucesso!",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar agendamento público:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
