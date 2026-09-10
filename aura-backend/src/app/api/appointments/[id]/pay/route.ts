// Aura System - API de Pagamento de Agendamento
// Cria transações de RECEITA (valor) e DESPESA (custo insumos)
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

    // Agendamento cancelado é estado final: não pode ser pago, concluído nem ter estoque deduzido.
    // Espelha a máquina de estados de PATCH /status (CANCELED sem transições permitidas).
    if (appointment.status === "CANCELED") {
      return NextResponse.json(
        { error: "Agendamento cancelado não pode ser pago." },
        { status: 409 }
      );
    }

    // Se o atendimento já foi concluído via PATCH /status, o estoque e a despesa de insumos
    // já foram lançados. Evita dedução/lançamento em duplicidade ao registrar o pagamento.
    const stockAlreadyDeducted = appointment.stockDeducted === true;

    const body = await request.json();
    const { paymentMethod, installments: installmentCount = 1 } = body;
    const numInstallments = Math.max(1, Math.min(12, Number(installmentCount) || 1));

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

    // 1. Criar transações de RECEITA (uma por parcela)
    // O price do agendamento já reflete o valor correto:
    //   - primeira consulta do plano: price = plan.price
    //   - consultas subsequentes do plano: price = 0
    //   - agendamentos avulsos: price = valor do procedimento
    const installmentGroupId = numInstallments > 1 ? randomUUID() : null;

    // Divisão de parcelas em centavos inteiros: arredonda a parcela base para baixo
    // e joga o resíduo (centavos que sobram) na ÚLTIMA parcela — convenção comum de
    // mercado (a última parcela "fecha a conta"). Garante que sum(parcelas) === price
    // exatamente, sem perda nem excesso de centavos.
    const totalCents = Math.round(Number(appointment.price) * 100);
    const baseCents = Math.floor(totalCents / numInstallments);
    const remainderCents = totalCents - baseCents * numInstallments;
    const installmentAmountForIndex = (index: number): number => {
      const cents = index === numInstallments ? baseCents + remainderCents : baseCents;
      return cents / 100;
    };
    const now = new Date();

    const incomeTransactions = [];
    for (let i = 1; i <= numInstallments; i++) {
      const dueDate = new Date(now);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      const tx = await prisma.transaction.create({
        data: {
          companyId: user.companyId,
          date: now,
          description: numInstallments > 1
            ? `Atendimento (${i}/${numInstallments}): ${appointment.procedure.name} - ${appointment.patient.name}`
            : `Atendimento: ${appointment.procedure.name} - ${appointment.patient.name}`,
          amount: installmentAmountForIndex(i),
          type: "INCOME",
          category: "Procedimentos",
          status: i === 1 ? "PAID" : "PENDING",
          paymentMethod,
          appointmentId: id,
          patientId: appointment.patientId,
          professionalId: appointment.professionalId,
          installments: numInstallments,
          installmentIndex: i,
          installmentGroupId,
          dueDate,
        },
      });
      incomeTransactions.push(tx);
    }
    const incomeTransaction = incomeTransactions[0] ?? null;

    // 3. Criar transação de DESPESA para custo dos insumos (se houver)
    let expenseTransaction = null;

    if (procedureCost > 0 && !stockAlreadyDeducted) {
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

    // 4. Baixar estoque dos insumos (apenas se ainda não foi deduzido via PATCH /status)
    const updatedInventory = [];
    if (!stockAlreadyDeducted) {
      const supplies = await prisma.procedureSupply.findMany({
        where: { procedureId: appointment.procedureId },
      });

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
        expense: expenseTransaction,
        installments: incomeTransactions,
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

