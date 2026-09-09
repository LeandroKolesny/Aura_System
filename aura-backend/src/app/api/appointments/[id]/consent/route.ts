// Aura System - API de Consentimento do Agendamento/Procedimento
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const signAppointmentConsentSchema = z.object({
  signatureUrl: z.string().min(1, "Assinatura é obrigatória"),
  metadata: z.object({
    documentVersion: z.string().optional(),
  }).optional(),
});

// POST - Assinar consentimento de um agendamento específico
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id, companyId: user.companyId },
      include: { patient: { select: { id: true, name: true, email: true } } },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    // Paciente só pode assinar o próprio agendamento; equipe pode assinar em nome do paciente.
    const staffRoles = ["OWNER", "ADMIN", "RECEPTIONIST", "ESTHETICIAN"];
    const isOwnAppointment = user.role === "PATIENT" && appointment.patient.email === user.email;
    if (!staffRoles.includes(user.role) && !isOwnAppointment) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const validation = signAppointmentConsentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for") ||
                      request.headers.get("x-real-ip") ||
                      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const signatureMetadata = {
      signedAt: new Date().toISOString(),
      ipAddress,
      userAgent,
      documentVersion: validation.data.metadata?.documentVersion || "v1.0-appt-consent",
      signedBy: user.id,
    };

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        signatureUrl: validation.data.signatureUrl,
        signatureMetadata,
      },
    });

    await prisma.activity.create({
      data: {
        type: "CONSENT_SIGNED",
        title: `Consentimento do procedimento assinado - ${appointment.patient.name}`,
        userId: user.id,
        ipAddress,
        userAgent,
        metadata: { appointmentId: id, patientId: appointment.patient.id },
      },
    });

    return NextResponse.json({
      success: true,
      signatureUrl: updated.signatureUrl,
      signatureMetadata: updated.signatureMetadata,
    });
  } catch (error) {
    console.error("Erro ao assinar consentimento do agendamento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
