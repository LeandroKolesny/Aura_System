// Aura System - API de Consentimento do Paciente
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { signConsentSchema } from "@/lib/validations/patient";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Assinar (ou corrigir) o consentimento geral (LGPD) do paciente.
// Nunca sobrescreve sem deixar rastro: cada assinatura (a primeira e toda
// correção) vira uma linha em PatientConsentSignatureHistory, preservando a
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

    // SECURITY: só a equipe da clínica assina/corrige o consentimento geral
    // em nome do paciente (a assinatura acontece na ficha, com o paciente
    // fisicamente presente) — nunca outro paciente da mesma empresa.
    const allowedRoles = ["OWNER", "ADMIN", "RECEPTIONIST", "ESTHETICIAN"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Verificar se paciente existe e pertence à empresa
    const patient = await prisma.patient.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const validation = signConsentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // É uma correção se já existe uma assinatura salva — nesse caso o motivo é obrigatório.
    const isCorrection = !!patient.consentSignatureUrl;
    if (isCorrection && !validation.data.correctionReason) {
      return NextResponse.json(
        { error: "Descreva o motivo da correção da assinatura." },
        { status: 400 }
      );
    }

    // Assinaturas feitas antes deste recurso existir nunca ganharam uma linha
    // no histórico — se for corrigir uma dessas agora, faz um "backfill":
    // registra a versão antiga (que está pra ser sobrescrita) antes de
    // registrar a nova, senão ela se perde pra sempre sem deixar rastro.
    const existingHistoryCount = isCorrection
      ? await prisma.patientConsentSignatureHistory.count({ where: { patientId: id } })
      : 0;
    const needsBackfill = isCorrection && existingHistoryCount === 0;

    // Capturar metadados de segurança
    const ipAddress = request.headers.get("x-forwarded-for") ||
                      request.headers.get("x-real-ip") ||
                      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const signedAt = new Date();

    const consentMetadata = {
      signedAt: signedAt.toISOString(),
      ipAddress,
      userAgent,
      documentVersion: validation.data.metadata?.documentVersion || "1.0",
      signedBy: user.id,
    };

    const oldMetadata = patient.consentMetadata as { ipAddress?: string; userAgent?: string; documentVersion?: string; signedBy?: string } | null;

    const transactionOps = [
      ...(needsBackfill
        ? [
            prisma.patientConsentSignatureHistory.create({
              data: {
                patientId: id,
                signatureUrl: patient.consentSignatureUrl!,
                signedAt: patient.consentSignedAt ?? signedAt,
                ipAddress: oldMetadata?.ipAddress ?? "unknown",
                userAgent: oldMetadata?.userAgent ?? "unknown",
                documentVersion: oldMetadata?.documentVersion ?? "1.0",
                signedByUserId: oldMetadata?.signedBy ?? user.id,
                correctionReason: null,
              },
            }),
          ]
        : []),
      // Preserva a versão anterior (ou a primeira assinatura) na trilha de auditoria.
      prisma.patientConsentSignatureHistory.create({
        data: {
          patientId: id,
          signatureUrl: validation.data.signatureUrl,
          signedAt,
          ipAddress,
          userAgent,
          documentVersion: consentMetadata.documentVersion,
          signedByUserId: user.id,
          correctionReason: isCorrection ? validation.data.correctionReason : null,
        },
      }),
      prisma.patient.update({
        where: { id },
        data: {
          consentSignedAt: signedAt,
          consentSignatureUrl: validation.data.signatureUrl,
          consentMetadata,
          ...(isCorrection
            ? {
                consentCorrectionCount: { increment: 1 },
                lastConsentCorrectionAt: signedAt,
                lastConsentCorrectionReason: validation.data.correctionReason,
              }
            : {}),
        },
      }),
    ];

    const transactionResults = await prisma.$transaction(transactionOps);
    const updatedPatient = transactionResults[transactionResults.length - 1] as Awaited<ReturnType<typeof prisma.patient.update>>;

    // Log de atividade (auditoria)
    await prisma.activity.create({
      data: {
        type: isCorrection ? "CONSENT_CORRECTED" : "CONSENT_SIGNED",
        title: isCorrection
          ? `Assinatura do consentimento corrigida - ${patient.name}`
          : `Consentimento assinado por "${patient.name}"`,
        userId: user.id,
        ipAddress,
        userAgent,
        metadata: {
          patientId: patient.id,
          documentVersion: consentMetadata.documentVersion,
          ...(isCorrection ? { correctionReason: validation.data.correctionReason } : {}),
        },
      },
    });

    return NextResponse.json({
      success: true,
      consentSignedAt: updatedPatient.consentSignedAt,
      consentSignatureUrl: updatedPatient.consentSignatureUrl,
      consentCorrectionCount: updatedPatient.consentCorrectionCount,
      lastConsentCorrectionAt: updatedPatient.lastConsentCorrectionAt,
      lastConsentCorrectionReason: updatedPatient.lastConsentCorrectionReason,
      message: "Consentimento assinado com sucesso"
    });
  } catch (error) {
    console.error("Erro ao assinar consentimento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// GET - Verificar status do consentimento
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id, companyId: user.companyId },
      select: {
        id: true,
        name: true,
        consentSignedAt: true,
        consentMetadata: true,
      },
    });

    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      hasConsent: !!patient.consentSignedAt,
      signedAt: patient.consentSignedAt,
      metadata: patient.consentMetadata,
    });
  } catch (error) {
    console.error("Erro ao verificar consentimento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
