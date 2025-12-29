// Aura System - API de Consentimento do Paciente
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { signConsentSchema } from "@/lib/validations/patient";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Assinar consentimento
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

    // Capturar metadados de segurança
    const ipAddress = request.headers.get("x-forwarded-for") || 
                      request.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const consentMetadata = {
      signedAt: new Date().toISOString(),
      ipAddress,
      userAgent,
      documentVersion: validation.data.metadata?.documentVersion || "1.0",
      signedBy: user.id,
    };

    // Atualizar paciente com assinatura
    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        consentSignedAt: new Date(),
        consentSignatureUrl: validation.data.signatureUrl,
        consentMetadata,
      },
    });

    // Log de atividade (auditoria)
    await prisma.activity.create({
      data: {
        type: "CONSENT_SIGNED",
        title: `Consentimento assinado por "${patient.name}"`,
        userId: user.id,
        ipAddress,
        userAgent,
        metadata: { 
          patientId: patient.id,
          documentVersion: consentMetadata.documentVersion,
        },
      },
    });

    return NextResponse.json({ 
      success: true, 
      consentSignedAt: updatedPatient.consentSignedAt,
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

