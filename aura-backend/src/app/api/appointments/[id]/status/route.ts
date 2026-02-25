// Aura System - API de Status do Agendamento
// LÓGICA CRÍTICA: Baixa de estoque ao completar atendimento
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { updateStatusSchema } from "@/lib/validations/appointment";
import { deleteCalendarEvent, pushAppointmentToCalendar } from "@/lib/calendarSync";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Deduz estoque dos insumos utilizados no procedimento
 * EXECUTADO NO SERVIDOR - Garante integridade dos dados
 */
async function deductStock(appointmentId: string, procedureId: string, companyId: string) {
  // Buscar insumos do procedimento
  const supplies = await prisma.procedureSupply.findMany({
    where: { procedureId },
    include: { inventoryItem: true },
  });

  for (const supply of supplies) {
    // Atualizar estoque
    await prisma.inventoryItem.update({
      where: { id: supply.inventoryItemId },
      data: {
        currentStock: {
          decrement: supply.quantityUsed,
        },
      },
    });

    // Registrar movimento de estoque
    await prisma.stockMovement.create({
      data: {
        inventoryItemId: supply.inventoryItemId,
        quantity: supply.quantityUsed,
        type: "OUT",
        reason: `Procedimento - Agendamento ${appointmentId}`,
      },
    });

    // Verificar se estoque ficou baixo e criar alerta
    const item = await prisma.inventoryItem.findUnique({
      where: { id: supply.inventoryItemId },
    });

    if (item && Number(item.currentStock) <= Number(item.minStock)) {
      await prisma.appNotification.create({
        data: {
          companyId,
          message: `Estoque baixo: ${item.name} (${item.currentStock} ${item.unit})`,
          type: "WARNING",
        },
      });
    }
  }
}

// PATCH - Atualizar status do agendamento
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const appointment = await prisma.appointment.findFirst({
      where: { id, companyId: user.companyId },
      include: { patient: true, procedure: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { status } = validation.data;
    const oldStatus = appointment.status;

    // Validar transições de status permitidas
    const validTransitions: Record<string, string[]> = {
      PENDING_APPROVAL: ["SCHEDULED", "CANCELED"],
      SCHEDULED: ["CONFIRMED", "CANCELED"],
      CONFIRMED: ["COMPLETED", "CANCELED"],
      COMPLETED: [], // Status final
      CANCELED: [], // Status final
    };

    if (!validTransitions[oldStatus]?.includes(status)) {
      return NextResponse.json(
        { error: `Transição de ${oldStatus} para ${status} não permitida` },
        { status: 400 }
      );
    }

    // Se completando atendimento, executar lógicas de negócio
    if (status === "COMPLETED" && !appointment.stockDeducted) {
      // 1. Baixar estoque
      await deductStock(id, appointment.procedureId, user.companyId);

      // 2. Atualizar última visita do paciente
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data: { lastVisit: new Date() },
      });

      // 3. Criar transação de DESPESA para custo dos insumos (se houver)
      const procedure = await prisma.procedure.findUnique({
        where: { id: appointment.procedureId },
      });

      if (procedure && Number(procedure.cost) > 0) {
        await prisma.transaction.create({
          data: {
            companyId: user.companyId,
            date: new Date(),
            description: `Custo Insumos: ${procedure.name} - ${appointment.patient.name}`,
            amount: procedure.cost,
            type: "EXPENSE",
            category: "Insumos",
            status: "PAID",
            appointmentId: id,
          },
        });
      }
    }

    // Atualizar status
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status,
        stockDeducted: status === "COMPLETED" ? true : appointment.stockDeducted,
      },
      include: {
        patient: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
        procedure: { select: { id: true, name: true } },
      },
    });

    // Log de atividade
    const activityType = status === "COMPLETED" ? "APPOINTMENT_COMPLETED" :
                        status === "CONFIRMED" ? "APPOINTMENT_CONFIRMED" :
                        status === "CANCELED" ? "APPOINTMENT_CANCELED" : "APPOINTMENT_CONFIRMED";

    await prisma.activity.create({
      data: {
        type: activityType,
        title: `Agendamento ${status.toLowerCase()}: ${appointment.patient.name}`,
        userId: user.id,
        metadata: { appointmentId: id, oldStatus, newStatus: status },
      },
    });

    // Sync status change to Google Calendar (fire-and-forget)
    if (status === "CANCELED") {
      deleteCalendarEvent(id).catch(console.error);
    } else {
      pushAppointmentToCalendar(id).catch(console.error);
    }

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

