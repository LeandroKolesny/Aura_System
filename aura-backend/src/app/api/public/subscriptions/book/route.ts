import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIP } from "@/lib/rateLimiter";
import { generateJWT } from "@/lib/auth";

const schema = z.object({
  companyId: z.string().cuid("ID de empresa inválido"),
  planId: z.string().cuid("ID de plano inválido"),
  procedureId: z.string().cuid("ID de procedimento inválido"),
  professionalId: z.string().cuid("ID de profissional inválido").nullable(),
  date: z.string().datetime("Data ou hora inválida"),
  patientInfo: z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
    email: z.string().email("E-mail inválido"),
    phone: z.string().min(8, "Celular deve ter pelo menos 8 dígitos").max(20, "Celular muito longo"),
    password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").max(100, "Senha muito longa").optional(),
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
      const fieldLabels: Record<string, string> = {
        "patientInfo.name": "Nome",
        "patientInfo.email": "E-mail",
        "patientInfo.phone": "Celular",
        "patientInfo.password": "Senha",
        date: "Data/hora",
        procedureId: "Procedimento",
        planId: "Plano",
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

    // Find or create Patient (para agendamento e assinatura)
    let patient = await prisma.patient.findFirst({ where: { email, companyId } });
    if (!patient) {
      patient = await prisma.patient.create({
        data: { name, email, phone, companyId },
      });
    }

    // Find or create User PATIENT (para login no portal — separado do Patient)
    let portalUser = await prisma.user.findFirst({ where: { email, companyId } });
    if (portalUser) {
      // Usuário já existe: se informou senha, verificar se bate com a cadastrada
      if (password) {
        const passwordMatches = await bcrypt.compare(password, portalUser.password);
        if (!passwordMatches) {
          return NextResponse.json(
            {
              error: "Este e-mail já possui uma conta. Use sua senha cadastrada para fazer login no portal.",
              code: "EMAIL_ALREADY_EXISTS",
            },
            { status: 409 }
          );
        }
      }
    } else {
      const hashedPassword = password
        ? await bcrypt.hash(password, 10)
        : await bcrypt.hash(Math.random().toString(36), 10);
      portalUser = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          role: "PATIENT",
          companyId,
          isActive: true,
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
      resolvedProfessionalId = fallbackPro?.id ?? portalUser.id;
    }

    // Find or create PatientSubscription — always PENDING until admin approves
    let subscription = await prisma.patientSubscription.findFirst({
      where: {
        patientId: patient.id,
        planId,
        companyId,
        status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    // Verificar limite de sessões se a assinatura já está ACTIVE
    if (subscription && subscription.status === "ACTIVE") {
      const used = (subscription.sessionsUsedThisCycle as Record<string, number>)[procedureId] ?? 0;
      if (used >= planItem.sessionsPerCycle) {
        return NextResponse.json(
          {
            error: `Você atingiu o limite de ${planItem.sessionsPerCycle} sessão(ões) para este plano. Para continuar agendando, contrate um novo plano.`,
            code: "SESSION_LIMIT_REACHED",
          },
          { status: 400 }
        );
      }
    }

    // Primeira assinatura do paciente para este plano → paga o valor do plano
    // Assinatura já existente → sessões subsequentes são gratuitas (já pagas)
    const isNewSubscription = !subscription;

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
          status: "PENDING",
          startDate: new Date(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          sessionsUsedThisCycle,
          lastCycleReset: new Date(),
        },
      });
    }

    const appointmentPrice = isNewSubscription ? plan.price : 0;

    // Appointment fica PENDING_APPROVAL para o admin aprovar
    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(date),
        durationMinutes: procedure.durationMinutes,
        status: "PENDING_APPROVAL",
        price: appointmentPrice,
        patientId: patient.id,
        professionalId: resolvedProfessionalId,
        procedureId,
        companyId,
        subscriptionId: subscription.id,
        notes: `Agendamento via Plano: ${plan.name}`,
      },
    });

    const token = generateJWT({
      id: portalUser.id,
      email: portalUser.email,
      role: portalUser.role,
      companyId: portalUser.companyId,
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
