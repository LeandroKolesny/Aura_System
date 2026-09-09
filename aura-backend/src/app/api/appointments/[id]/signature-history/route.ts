// Aura System - Histórico completo de assinaturas de um agendamento
//
// Traz todas as versões já assinadas (a original + cada correção), com a
// imagem exata de cada uma e o motivo informado ao corrigir. Carregado sob
// demanda (não vem junto da listagem de agendamentos) porque cada imagem de
// assinatura pode pesar — só busca quando o usuário pede pra ver o histórico.
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

    const appointment = await prisma.appointment.findFirst({
      where: { id, companyId: user.companyId },
      include: { patient: { select: { email: true } } },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    const staffRoles = ["OWNER", "ADMIN", "RECEPTIONIST", "ESTHETICIAN"];
    const isOwnAppointment = user.role === "PATIENT" && appointment.patient.email === user.email;
    if (!staffRoles.includes(user.role) && !isOwnAppointment) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const history = await prisma.appointmentSignatureHistory.findMany({
      where: { appointmentId: id },
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
    console.error("Erro ao buscar histórico de assinaturas do agendamento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
