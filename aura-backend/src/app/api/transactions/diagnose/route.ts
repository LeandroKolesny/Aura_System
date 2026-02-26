// Aura System - API de Diagnóstico de Transações
// Este endpoint mostra exatamente o que está no banco de dados
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET - Diagnóstico completo
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // 1. Buscar todos os agendamentos pagos com TODOS os detalhes
    const paidAppointments = await prisma.appointment.findMany({
      where: {
        companyId: user.companyId,
        paid: true,
      },
      include: {
        patient: true,
        procedure: {
          include: {
            supplies: {
              include: {
                inventoryItem: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 10, // Últimos 10
    });

    // 2. Para cada agendamento, buscar transações relacionadas
    const diagnostics = [];

    for (const appt of paidAppointments) {
      // Buscar todas as transações deste agendamento
      const transactions = await prisma.transaction.findMany({
        where: { appointmentId: appt.id },
      });

      // Calcular custo correto dos insumos
      let correctSupplyCost = 0;
      const suppliesDetail = [];

      if (appt.procedure.supplies && appt.procedure.supplies.length > 0) {
        for (const supply of appt.procedure.supplies) {
          const costPerUnit = Number(supply.inventoryItem.costPerUnit) || 0;
          const qty = Number(supply.quantityUsed) || 0;
          const itemCost = costPerUnit * qty;
          correctSupplyCost += itemCost;
          suppliesDetail.push({
            inventoryItemId: supply.inventoryItemId,
            itemName: supply.inventoryItem.name,
            costPerUnit,
            quantityUsed: qty,
            totalCost: itemCost,
          });
        }
      }

      const incomeTransaction = transactions.find(t => t.type === 'INCOME');
      const expenseTransaction = transactions.find(t => t.type === 'EXPENSE');

      diagnostics.push({
        appointment: {
          id: appt.id,
          date: appt.date,
          patientName: appt.patient.name,
          procedureName: appt.procedure.name,
          price: Number(appt.price),
          procedureCostField: Number(appt.procedure.cost), // O que está salvo no campo cost do procedimento
        },
        supplies: {
          count: appt.procedure.supplies.length,
          calculatedCost: correctSupplyCost,
          details: suppliesDetail,
        },
        transactions: {
          income: incomeTransaction ? {
            id: incomeTransaction.id,
            description: incomeTransaction.description,
            amount: Number(incomeTransaction.amount),
          } : null,
          expense: expenseTransaction ? {
            id: expenseTransaction.id,
            description: expenseTransaction.description,
            amount: Number(expenseTransaction.amount),
            isAmountCorrect: Math.abs(Number(expenseTransaction.amount) - correctSupplyCost) < 0.01,
            hasPatientName: expenseTransaction.description.includes(appt.patient.name),
          } : null,
        },
        analysis: {
          hasIncome: !!incomeTransaction,
          hasExpense: !!expenseTransaction,
          expenseAmountShouldBe: correctSupplyCost,
          currentExpenseAmount: expenseTransaction ? Number(expenseTransaction.amount) : 0,
          difference: expenseTransaction ? Number(expenseTransaction.amount) - correctSupplyCost : 0,
          needsFix: expenseTransaction
            ? (Math.abs(Number(expenseTransaction.amount) - correctSupplyCost) > 0.01 || !expenseTransaction.description.includes(appt.patient.name))
            : (correctSupplyCost > 0),
        },
      });
    }

    return NextResponse.json({
      companyId: user.companyId,
      totalAppointments: paidAppointments.length,
      diagnostics,
    });
  } catch (error) {
    console.error("Erro no diagnóstico:", error);
    return NextResponse.json({ error: "Erro interno", details: String(error) }, { status: 500 });
  }
}

// DELETE - Limpar todas as transações de despesa erradas e recriar
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // 1. Deletar TODAS as transações de despesa de insumos
    const deleted = await prisma.transaction.deleteMany({
      where: {
        companyId: user.companyId,
        type: "EXPENSE",
        category: "Insumos",
      },
    });

    // 2. Buscar todos os agendamentos pagos
    const paidAppointments = await prisma.appointment.findMany({
      where: {
        companyId: user.companyId,
        paid: true,
      },
      include: {
        patient: true,
        procedure: {
          include: {
            supplies: {
              include: {
                inventoryItem: true,
              },
            },
          },
        },
      },
    });

    // 3. Recriar transações de despesa com valores corretos
    const created = [];

    for (const appt of paidAppointments) {
      // Calcular custo correto dos insumos
      let supplyCost = 0;
      if (appt.procedure.supplies && appt.procedure.supplies.length > 0) {
        for (const supply of appt.procedure.supplies) {
          const costPerUnit = Number(supply.inventoryItem.costPerUnit) || 0;
          const qty = Number(supply.quantityUsed) || 0;
          supplyCost += costPerUnit * qty;
        }
      }

      // Se não tem custo de insumos, pular
      if (supplyCost === 0) {
        continue;
      }

      // Criar nova transação de despesa
      const expense = await prisma.transaction.create({
        data: {
          companyId: user.companyId,
          date: appt.date,
          description: `Custo Insumos: ${appt.procedure.name} - ${appt.patient.name}`,
          amount: supplyCost,
          type: "EXPENSE",
          category: "Insumos",
          status: "PAID",
          appointmentId: appt.id,
        },
      });

      created.push({
        appointmentId: appt.id,
        patient: appt.patient.name,
        procedure: appt.procedure.name,
        supplyCost,
        transactionId: expense.id,
      });
    }

    return NextResponse.json({
      success: true,
      deleted: deleted.count,
      created: created.length,
      details: created,
    });
  } catch (error) {
    console.error("Erro ao resetar despesas:", error);
    return NextResponse.json({ error: "Erro interno", details: String(error) }, { status: 500 });
  }
}
