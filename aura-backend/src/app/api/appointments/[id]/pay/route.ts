// Aura System - API de Pagamento de Agendamento
// Cria transações de RECEITA (valor) e DESPESA (custo insumos)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Processar pagamento do agendamento
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

    const allowedRoles = ["OWNER", "ADMIN", "RECEPTIONIST"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Buscar agendamento com procedure e supplies (insumos)
    const appointment = await prisma.appointment.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        patient: true,
        procedure: {
          include: {
            supplies: {
              include: {
                inventoryItem: true
              }
            }
          }
        },
        professional: true
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    if (appointment.paid) {
      return NextResponse.json({ error: "Agendamento já foi pago" }, { status: 400 });
    }

    const body = await request.json();
    const { paymentMethod } = body;

    // Calcular custo dos insumos DINAMICAMENTE a partir dos supplies
    let calculatedCost = 0;
    if (appointment.procedure.supplies && appointment.procedure.supplies.length > 0) {
      calculatedCost = appointment.procedure.supplies.reduce((total, supply) => {
        const costPerUnit = Number(supply.inventoryItem.costPerUnit) || 0;
        const quantityUsed = Number(supply.quantityUsed) || 0;
        return total + (costPerUnit * quantityUsed);
      }, 0);
    }

    // Usar o custo calculado ou o custo salvo no procedimento (o que for maior)
    const procedureCost = Math.max(calculatedCost, Number(appointment.procedure.cost) || 0);

    // 1. Criar transação de RECEITA (valor do procedimento)
    const incomeTransaction = await prisma.transaction.create({
      data: {
        companyId: user.companyId,
        date: new Date(),
        description: `Atendimento: ${appointment.procedure.name} - ${appointment.patient.name}`,
        amount: appointment.price,
        type: "INCOME",
        category: "Procedimentos",
        status: "PAID",
        appointmentId: id,
        patientId: appointment.patientId,
        professionalId: appointment.professionalId,
      },
    });

    // 2. Criar transação de DESPESA para custo dos insumos (se houver)
    let expenseTransaction = null;

    if (procedureCost > 0) {
      expenseTransaction = await prisma.transaction.create({
        data: {
          companyId: user.companyId,
          date: new Date(),
          description: `Custo Insumos: ${appointment.procedure.name} - ${appointment.patient.name}`,
          amount: procedureCost,
          type: "EXPENSE",
          category: "Insumos",
          status: "PAID",
          appointmentId: id,
        },
      });
    }

    // 3. Marcar agendamento como pago e concluído
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        paid: true,
        status: "COMPLETED",
        stockDeducted: true,
      },
      include: {
        patient: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
        procedure: { select: { id: true, name: true, price: true, cost: true } },
      },
    });

    // 4. Baixar estoque dos insumos
    const supplies = await prisma.procedureSupply.findMany({
      where: { procedureId: appointment.procedureId },
    });

    const updatedInventory = [];
    for (const supply of supplies) {
      const updatedItem = await prisma.inventoryItem.update({
        where: { id: supply.inventoryItemId },
        data: { currentStock: { decrement: supply.quantityUsed } },
      });
      updatedInventory.push(updatedItem);

      await prisma.stockMovement.create({
        data: {
          inventoryItemId: supply.inventoryItemId,
          quantity: supply.quantityUsed,
          type: "OUT",
          reason: `Pagamento - ${appointment.procedure.name}`,
        },
      });
    }

    // 5. Atualizar última visita do paciente
    await prisma.patient.update({
      where: { id: appointment.patientId },
      data: { lastVisit: new Date() },
    });

    // Log de atividade
    await prisma.activity.create({
      data: {
        type: "PAYMENT_RECEIVED",
        title: `Pagamento: ${appointment.procedure.name} - ${appointment.patient.name}`,
        userId: user.id,
        metadata: { 
          appointmentId: id, 
          amount: appointment.price,
          cost: procedureCost,
          profit: Number(appointment.price) - procedureCost,
          paymentMethod 
        },
      },
    });

    return NextResponse.json({
      success: true,
      appointment: updated,
      transactions: {
        income: incomeTransaction,
        expense: expenseTransaction
      },
      inventory: updatedInventory, // Estoque atualizado para sincronizar frontend
      summary: {
        revenue: Number(appointment.price),
        cost: procedureCost,
        profit: Number(appointment.price) - procedureCost
      }
    });
  } catch (error) {
    console.error("Erro ao processar pagamento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

