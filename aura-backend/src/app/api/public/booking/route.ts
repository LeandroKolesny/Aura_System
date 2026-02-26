// Aura System - API Pública de Booking (sem autenticação)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST - Criar agendamento público
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      companyId, 
      procedureId, 
      professionalId, 
      date, 
      patientInfo 
    } = body;

    // Validações básicas
    if (!companyId || !procedureId || !professionalId || !date || !patientInfo) {
      return NextResponse.json(
        { error: "Dados obrigatórios faltando" },
        { status: 400 }
      );
    }

    const { name, email, phone, password } = patientInfo;
    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: "Dados do paciente incompletos" },
        { status: 400 }
      );
    }

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

    // Buscar ou criar paciente
    let patient = await prisma.patient.findFirst({
      where: { email, companyId },
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name,
          email,
          phone,
          companyId,
        },
      });
    }

    // Criar user para o paciente se password fornecido
    if (password) {
      const existingUser = await prisma.user.findFirst({
        where: { email, companyId },
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            role: "PATIENT",
            companyId,
          },
        });
      }
    }

    // Criar agendamento com status PENDING_APPROVAL
    const appointment = await prisma.appointment.create({
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

    return NextResponse.json(
      { 
        success: true, 
        appointment,
        patient,
        message: "Agendamento solicitado com sucesso!" 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar agendamento público:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

