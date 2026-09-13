// Aura System - Clube de Assinaturas: Cancelamento de Assinatura
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - Cancela assinatura do paciente
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    // Rota administrativa: cancela a assinatura de QUALQUER paciente da
    // empresa. checkWriteAccess acima só valida se o plano da empresa permite
    // escrita (modo somente leitura) — não valida QUEM está chamando, e o
    // findFirst abaixo só restringe por companyId, nunca pelo dono da
    // assinatura. Sem esta checagem de role, um PATIENT autenticado conseguia
    // cancelar a assinatura de QUALQUER OUTRO paciente da mesma empresa.
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

    if (subscription.status === "CANCELED") {
      return NextResponse.json({ error: "Assinatura já está cancelada" }, { status: 409 });
    }

    // Restaurar preço normal nos appointments linkados (caso seja PENDING → cancelamento de solicitação)
    if (subscription.status === "PENDING") {
      const linkedAppointments = await prisma.appointment.findMany({
        where: {
          subscriptionId: id,
          companyId: user.companyId!,
          status: "PENDING_APPROVAL",
        },
        include: {
          procedure: { select: { price: true } },
        },
      });

      for (const appt of linkedAppointments) {
        if (appt.procedure) {
          await prisma.appointment.update({
            where: { id: appt.id },
            data: { price: Number(appt.procedure.price) },
          });
        }
      }
    }

    const updated = await prisma.patientSubscription.update({
      where: { id },
      data: { status: "CANCELED" },
      include: {
        patient: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Erro ao cancelar assinatura:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
