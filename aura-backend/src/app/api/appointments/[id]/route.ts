// Aura System - API de Agendamento Individual
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { updateAppointmentSchema } from "@/lib/validations/appointment";
import { pushAppointmentToCalendar, deleteCalendarEvent } from "@/lib/calendarSync";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Buscar agendamento por ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id, companyId: user.companyId! },
      include: {
        patient: true,
        professional: { select: { id: true, name: true, email: true, phone: true } },
        procedure: true,
        transactions: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("Erro ao buscar agendamento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PUT - Atualizar agendamento
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const allowedRoles = ["OWNER", "ADMIN", "RECEPTIONIST", "ESTHETICIAN"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const existing = await prisma.appointment.findFirst({
      where: { id, companyId: user.companyId! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    // Não permitir alterar agendamentos completados ou cancelados
    if (["COMPLETED", "CANCELED"].includes(existing.status)) {
      return NextResponse.json(
        { error: "Não é possível alterar agendamentos finalizados" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateAppointmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { date, durationMinutes, professionalId, ...rest } = validation.data;

    // Se mudar data ou duração ou profissional, verificar conflito
    if (date || durationMinutes || professionalId) {
      const newDate = date ? new Date(date) : existing.date;
      const newDuration = durationMinutes || existing.durationMinutes;
      const newProfessional = professionalId || existing.professionalId;

      // Verificar conflito
      const dayStart = new Date(newDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(newDate);
      dayEnd.setHours(23, 59, 59, 999);

      const conflicts = await prisma.appointment.findMany({
        where: {
          companyId: user.companyId!,
          professionalId: newProfessional,
          date: { gte: dayStart, lte: dayEnd },
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          id: { not: id },
        },
      });

      const startTime = newDate.getTime();
      const endTime = startTime + newDuration * 60000;

      for (const appt of conflicts) {
        const existingStart = new Date(appt.date).getTime();
        const existingEnd = existingStart + appt.durationMinutes * 60000;
        if (startTime < existingEnd && endTime > existingStart) {
          return NextResponse.json({ error: "Conflito de horário" }, { status: 409 });
        }
      }
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        ...rest,
        ...(date && { date: new Date(date) }),
        ...(durationMinutes && { durationMinutes }),
        ...(professionalId && { professionalId }),
      },
      include: {
        patient: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
        procedure: { select: { id: true, name: true } },
      },
    });

    // Sync updated appointment to Google Calendar (fire-and-forget)
    pushAppointmentToCalendar(appointment.id).catch(console.error);

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("Erro ao atualizar agendamento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE - Cancelar agendamento
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id, companyId: user.companyId! },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    await prisma.appointment.update({
      where: { id },
      data: { status: "CANCELED" },
    });

    // Remove from Google Calendar (fire-and-forget)
    deleteCalendarEvent(id).catch(console.error);

    await prisma.activity.create({
      data: {
        type: "APPOINTMENT_CANCELED",
        title: `Agendamento cancelado`,
        userId: user.id,
        metadata: { appointmentId: id },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

