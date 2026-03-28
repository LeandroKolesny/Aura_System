import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIP } from "@/lib/rateLimiter";
import { generateJWT } from "@/lib/auth";

const schema = z.object({
  companyId: z.string().cuid(),
  planId: z.string().cuid(),
  procedureId: z.string().cuid(),
  professionalId: z.string().cuid().nullable(),
  date: z.string().datetime(),
  patientInfo: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().min(8).max(20),
    password: z.string().min(8).max(100).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit(clientIP, "public_booking");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Muitas solicitações." }, { status: 429 });
    }

    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { companyId, planId, procedureId, professionalId, date, patientInfo } =
      validation.data;
    const { name, email, phone, password } = patientInfo;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, companyId, isActive: true },
      include: { items: true },
    });
    if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });

    const planItem = plan.items.find((i) => i.procedureId === procedureId);
    if (!planItem)
      return NextResponse.json(
        { error: "Procedimento não pertence a este plano" },
        { status: 400 }
      );

    const procedure = await prisma.procedure.findFirst({
      where: { id: procedureId, companyId },
    });
    if (!procedure)
      return NextResponse.json({ error: "Procedimento não encontrado" }, { status: 404 });

    if (professionalId) {
      const professional = await prisma.user.findFirst({
        where: { id: professionalId, companyId },
      });
      if (!professional)
        return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
    }

    // Find or create patient
    let patient = await prisma.user.findFirst({ where: { email, companyId } });
    if (!patient) {
      const hashedPassword = password
        ? await bcrypt.hash(password, 10)
        : await bcrypt.hash(Math.random().toString(36), 10);
      patient = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          role: "PATIENT",
          companyId,
          isActive: true,
          emailVerified: null,
        },
      });
    }

    // Resolve professionalId — use first active pro if not specified
    let resolvedProfessionalId = professionalId;
    if (!resolvedProfessionalId) {
      const fallbackPro = await prisma.user.findFirst({
        where: { companyId, isActive: true, role: { in: ["ADMIN", "ESTHETICIAN"] } },
        select: { id: true },
      });
      resolvedProfessionalId = fallbackPro?.id ?? patient.id;
    }

    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(date),
        durationMinutes: procedure.durationMinutes,
        status: "SCHEDULED",
        price: 0,
        patientId: patient.id,
        professionalId: resolvedProfessionalId,
        procedureId,
        companyId,
        notes: `Agendamento via Plano: ${plan.name}`,
      },
    });

    // Find or create PatientSubscription
    let subscription = await prisma.patientSubscription.findFirst({
      where: {
        patientId: patient.id,
        planId,
        companyId,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
    });

    if (!subscription) {
      const sessionsUsedThisCycle: Record<string, number> = {};
      for (const item of plan.items) {
        sessionsUsedThisCycle[item.procedureId] = 0;
      }
      subscription = await prisma.patientSubscription.create({
        data: {
          patientId: patient.id,
          planId,
          companyId,
          status: "ACTIVE",
          startDate: new Date(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          sessionsUsedThisCycle,
          lastCycleReset: new Date(),
        },
      });
    }

    const token = generateJWT({
      id: patient.id,
      email: patient.email,
      role: patient.role,
      companyId: patient.companyId,
    });

    return NextResponse.json(
      { success: true, appointmentId: appointment.id, patientToken: token },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar agendamento de plano:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
