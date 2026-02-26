// Aura System - API para criar despesas de insumos retroativamente
// Este endpoint encontra agendamentos pagos sem transação de despesa e cria as despesas
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// POST - Criar/Corrigir despesas de insumos para agendamentos já pagos
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // Apenas ADMIN pode executar
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Verificar se é para forçar recriação
    const body = await request.json().catch(() => ({}));
    const forceRecreate = body.forceRecreate === true;

    // 1. Buscar todos os agendamentos pagos da empresa
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

    // 2. Para cada agendamento, verificar/corrigir transação de despesa
    const results = {
      total: paidAppointments.length,
      created: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      details: [] as any[],
    };

    for (const appointment of paidAppointments) {
      // Calcular custo dos insumos a partir dos supplies
      let supplyCost = 0;
      const supplyDetails: string[] = [];

      if (appointment.procedure.supplies && appointment.procedure.supplies.length > 0) {
        for (const supply of appointment.procedure.supplies) {
          const costPerUnit = Number(supply.inventoryItem.costPerUnit) || 0;
          const quantityUsed = Number(supply.quantityUsed) || 0;
          const itemCost = costPerUnit * quantityUsed;
          supplyCost += itemCost;
          supplyDetails.push(`${supply.inventoryItem.name}: ${quantityUsed} x R$${costPerUnit.toFixed(2)} = R$${itemCost.toFixed(2)}`);
        }
      }

      // Se não tem insumos cadastrados, pular (não usar procedure.cost pois pode estar errado)
      if (supplyCost === 0) {
        results.skipped++;
        results.details.push({
          appointmentId: appointment.id,
          procedure: appointment.procedure.name,
          patient: appointment.patient.name,
          status: "skipped",
          reason: "Procedimento sem insumos cadastrados",
        });
        continue;
      }

      // Verificar se já existe transação de despesa para este agendamento
      const existingExpense = await prisma.transaction.findFirst({
        where: {
          appointmentId: appointment.id,
          type: "EXPENSE",
        },
      });

      const correctDescription = `Custo Insumos: ${appointment.procedure.name} - ${appointment.patient.name}`;

      if (existingExpense) {
        // Verificar se o valor está correto
        const existingAmount = Number(existingExpense.amount);
        const isAmountWrong = Math.abs(existingAmount - supplyCost) > 0.01;
        const isDescriptionWrong = !existingExpense.description.includes(appointment.patient.name);

        if (forceRecreate || isAmountWrong || isDescriptionWrong) {
          // Deletar e recriar com valores corretos
          await prisma.transaction.delete({ where: { id: existingExpense.id } });
          results.deleted++;

          const newExpense = await prisma.transaction.create({
            data: {
              companyId: user.companyId,
              date: appointment.date,
              description: correctDescription,
              amount: supplyCost,
              type: "EXPENSE",
              category: "Insumos",
              status: "PAID",
              appointmentId: appointment.id,
            },
          });

          results.updated++;
          results.details.push({
            appointmentId: appointment.id,
            procedure: appointment.procedure.name,
            patient: appointment.patient.name,
            date: appointment.date,
            oldCost: existingAmount,
            newCost: supplyCost,
            supplies: supplyDetails,
            transactionId: newExpense.id,
            status: "updated",
            reason: isAmountWrong ? "Valor incorreto" : "Descrição incorreta",
          });
        } else {
          results.skipped++;
        }
        continue;
      }

      // Criar nova transação de despesa
      const expenseTransaction = await prisma.transaction.create({
        data: {
          companyId: user.companyId,
          date: appointment.date,
          description: correctDescription,
          amount: supplyCost,
          type: "EXPENSE",
          category: "Insumos",
          status: "PAID",
          appointmentId: appointment.id,
        },
      });

      results.created++;
      results.details.push({
        appointmentId: appointment.id,
        procedure: appointment.procedure.name,
        patient: appointment.patient.name,
        date: appointment.date,
        cost: supplyCost,
        supplies: supplyDetails,
        transactionId: expenseTransaction.id,
        status: "created",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Processamento concluído. ${results.created} criadas, ${results.updated} corrigidas, ${results.skipped} ignoradas.`,
      results,
    });
  } catch (error) {
    console.error("Erro ao criar despesas retroativas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// GET - Visualizar agendamentos com despesas faltantes ou incorretas
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // Buscar agendamentos pagos
    const paidAppointments = await prisma.appointment.findMany({
      where: {
        companyId: user.companyId,
        paid: true,
      },
      include: {
        patient: { select: { name: true } },
        procedure: {
          include: {
            supplies: {
              include: {
                inventoryItem: { select: { name: true, costPerUnit: true } },
              },
            },
          },
        },
      },
    });

    // Verificar quais têm problemas (faltando ou valor errado)
    const problemExpenses = [];

    for (const appointment of paidAppointments) {
      // Calcular custo correto dos insumos
      let correctSupplyCost = 0;
      if (appointment.procedure.supplies && appointment.procedure.supplies.length > 0) {
        correctSupplyCost = appointment.procedure.supplies.reduce((total, supply) => {
          return total + (Number(supply.inventoryItem.costPerUnit) * Number(supply.quantityUsed));
        }, 0);
      }

      // Se não tem insumos, pular
      if (correctSupplyCost === 0) {
        continue;
      }

      const existingExpense = await prisma.transaction.findFirst({
        where: {
          appointmentId: appointment.id,
          type: "EXPENSE",
        },
      });

      let problem = null;

      if (!existingExpense) {
        problem = "missing";
      } else {
        const existingAmount = Number(existingExpense.amount);
        const isAmountWrong = Math.abs(existingAmount - correctSupplyCost) > 0.01;
        const isDescriptionWrong = !existingExpense.description.includes(appointment.patient.name);

        if (isAmountWrong) {
          problem = "wrong_amount";
        } else if (isDescriptionWrong) {
          problem = "wrong_description";
        }
      }

      if (problem) {
        problemExpenses.push({
          appointmentId: appointment.id,
          date: appointment.date,
          patient: appointment.patient.name,
          procedure: appointment.procedure.name,
          price: Number(appointment.price),
          correctSupplyCost,
          currentExpenseAmount: existingExpense ? Number(existingExpense.amount) : null,
          problem,
          supplies: appointment.procedure.supplies.map((s) => ({
            name: s.inventoryItem.name,
            quantity: Number(s.quantityUsed),
            unitCost: Number(s.inventoryItem.costPerUnit),
            totalCost: Number(s.quantityUsed) * Number(s.inventoryItem.costPerUnit),
          })),
        });
      }
    }

    return NextResponse.json({
      total: paidAppointments.length,
      missingExpenses: problemExpenses.length,
      appointments: problemExpenses,
    });
  } catch (error) {
    console.error("Erro ao buscar agendamentos:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
