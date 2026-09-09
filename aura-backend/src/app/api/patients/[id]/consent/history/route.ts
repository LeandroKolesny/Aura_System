// Aura System - Histórico completo do consentimento (LGPD) de um paciente
//
// Traz todas as versões já assinadas (a original + cada correção), com a
// imagem exata de cada uma e o motivo informado ao corrigir. Carregado sob
// demanda — não vem junto da listagem de pacientes.
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

    const allowedRoles = ["OWNER", "ADMIN", "RECEPTIONIST", "ESTHETICIAN"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }

    const history = await prisma.patientConsentSignatureHistory.findMany({
      where: { patientId: id },
      orderBy: { signedAt: "asc" },
      select: {
        id: true,
        signatureUrl: true,
        signedAt: true,
        documentVersion: true,
        correctionReason: true,
      },
    });

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("Erro ao buscar histórico de assinaturas do consentimento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
