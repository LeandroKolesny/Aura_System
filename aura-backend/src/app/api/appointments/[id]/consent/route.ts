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
  // Obrigatório apenas quando já existe uma assinatura anterior (correção) —
  // validado abaixo, depois de sabermos se é a primeira assinatura ou não.
  correctionReason: z.string().trim().min(3, "Descreva o motivo da correção (mínimo 3 caracteres)").optional(),
});

// POST - Assinar (ou corrigir) o consentimento de um agendamento específico.
// Nunca sobrescreve sem deixar rastro: cada assinatura (a primeira e toda
// correção) vira uma linha em AppointmentSignatureHistory, preservando a
// imagem exata assinada em cada versão.
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

    // É uma correção se já existe uma assinatura salva — nesse caso o motivo é obrigatório.
    const isCorrection = !!appointment.signatureUrl;
    if (isCorrection && !validation.data.correctionReason) {
      return NextResponse.json(
        { error: "Descreva o motivo da correção da assinatura." },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for") ||
                      request.headers.get("x-real-ip") ||
                      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const signedAt = new Date();

    const signatureMetadata = {
      signedAt: signedAt.toISOString(),
      ipAddress,
      userAgent,
      documentVersion: validation.data.metadata?.documentVersion || "v1.0-appt-consent",
      signedBy: user.id,
    };

    const [, updated] = await prisma.$transaction([
      // Preserva a versão anterior (ou a primeira assinatura) na trilha de auditoria.
      prisma.appointmentSignatureHistory.create({
        data: {
          appointmentId: id,
          signatureUrl: validation.data.signatureUrl,
          signedAt,
          ipAddress,
          userAgent,
          documentVersion: signatureMetadata.documentVersion,
          signedByUserId: user.id,
          correctionReason: isCorrection ? validation.data.correctionReason : null,
        },
      }),
      prisma.appointment.update({
        where: { id },
        data: {
          signatureUrl: validation.data.signatureUrl,
          signatureMetadata,
          ...(isCorrection
            ? {
                signatureCorrectionCount: { increment: 1 },
                lastSignatureCorrectionAt: signedAt,
                lastSignatureCorrectionReason: validation.data.correctionReason,
              }
            : {}),
        },
      }),
    ]);

    await prisma.activity.create({
      data: {
        type: isCorrection ? "CONSENT_CORRECTED" : "CONSENT_SIGNED",
        title: isCorrection
          ? `Assinatura do procedimento corrigida - ${appointment.patient.name}`
          : `Consentimento do procedimento assinado - ${appointment.patient.name}`,
        userId: user.id,
        ipAddress,
        userAgent,
        metadata: {
          appointmentId: id,
          patientId: appointment.patient.id,
          ...(isCorrection ? { correctionReason: validation.data.correctionReason } : {}),
        },
      },
    });

    return NextResponse.json({
      success: true,
      signatureUrl: updated.signatureUrl,
      signatureMetadata: updated.signatureMetadata,
      signatureCorrectionCount: updated.signatureCorrectionCount,
      lastSignatureCorrectionAt: updated.lastSignatureCorrectionAt,
      lastSignatureCorrectionReason: updated.lastSignatureCorrectionReason,
    });
  } catch (error) {
    console.error("Erro ao assinar consentimento do agendamento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
