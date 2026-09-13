// PATCH /api/subscriptions/patients/[id]/activate
// Admin activates a PENDING subscription and confirms its linked pending_approval appointment
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    // Rota administrativa: ativa a assinatura PENDING de QUALQUER paciente da
    // empresa. checkWriteAccess acima só valida se o plano da empresa permite
    // escrita (modo somente leitura) — não valida QUEM está chamando. Sem esta
    // checagem de role, um PATIENT autenticado (inclusive um paciente diferente
    // do dono da assinatura, desde que da mesma empresa) conseguia se
    // auto-ativar ou ativar a assinatura de outro paciente, pulando a aprovação
    // manual da clínica.
    const allowedRoles = ["OWNER", "ADMIN", "RECEPTIONIST"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const subscription = await prisma.patientSubscription.findFirst({
      where: { id, companyId: user.companyId! },
    });
    if (!subscription) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }
    if (subscription.status !== "PENDING") {
      return NextResponse.json({ error: "Assinatura não está pendente" }, { status: 400 });
    }

    const updated = await prisma.patientSubscription.update({
      where: { id },
      data: { status: "ACTIVE", startDate: new Date() },
      include: {
        patient: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    // NÃO auto-aprovar agendamentos: o admin aprova cada agendamento separadamente

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Erro ao ativar assinatura:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
