// Aura System - API de Checkout (Processamento de Pagamento)
// LÓGICA CRÍTICA: Processamento seguro de pagamentos
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { processPaymentSchema } from "@/lib/validations/transaction";

// POST - Processar pagamento de atendimento
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const allowedRoles = ["OWNER", "ADMIN", "RECEPTIONIST"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão para processar pagamentos" }, { status: 403 });
    }

    const body = await request.json();
    const validation = processPaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { appointmentId, paymentMethod, amount, discount } = validation.data;

    // Buscar agendamento
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, companyId: user.companyId },
      include: {
        patient: true,
        procedure: true,
        professional: true,
        transactions: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    // Verificar se já foi pago
    if (appointment.paid) {
      return NextResponse.json({ error: "Este atendimento já foi pago" }, { status: 400 });
    }

    // Verificar se agendamento está em status válido para pagamento
    if (!["CONFIRMED", "COMPLETED"].includes(appointment.status)) {
      return NextResponse.json(
        { error: "Agendamento deve estar confirmado ou concluído para receber pagamento" },
        { status: 400 }
      );
    }

    // Calcular valor final
    const finalAmount = (amount || Number(appointment.price)) - (discount || 0);

    if (finalAmount <= 0) {
      return NextResponse.json({ error: "Valor final deve ser positivo" }, { status: 400 });
    }

    // Criar transação e atualizar agendamento em uma transação do banco
    const result = await prisma.$transaction(async (tx) => {
      // Criar transação financeira
      const transaction = await tx.transaction.create({
        data: {
          companyId: user.companyId!,
          date: new Date(),
          description: `Atendimento: ${appointment.procedure.name} - ${appointment.patient.name}`,
          amount: finalAmount,
          type: "INCOME",
          category: "Procedimentos",
          status: "PAID",
          paymentMethod,
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          professionalId: appointment.professionalId,
        },
      });

      // Marcar agendamento como pago
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: { paid: true },
      });

      // Se ainda não estava completado, completar agora
      if (appointment.status !== "COMPLETED") {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: { status: "COMPLETED" },
        });
      }

      return { transaction, appointment: updatedAppointment };
    });

    // Log de atividade
    await prisma.activity.create({
      data: {
        type: "PAYMENT_RECEIVED",
        title: `Pagamento recebido: R$ ${finalAmount.toFixed(2)} - ${appointment.patient.name}`,
        userId: user.id,
        metadata: {
          transactionId: result.transaction.id,
          appointmentId,
          amount: finalAmount,
          paymentMethod,
        },
      },
    });

    // Calcular comissão do profissional (se aplicável)
    const professional = await prisma.user.findUnique({
      where: { id: appointment.professionalId },
    });

    let commission = null;
    if (professional?.commissionRate && Number(professional.commissionRate) > 0) {
      commission = {
        professionalId: professional.id,
        professionalName: professional.name,
        rate: Number(professional.commissionRate),
        amount: finalAmount * (Number(professional.commissionRate) / 100),
      };
    }

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      commission,
      message: "Pagamento processado com sucesso",
    });
  } catch (error) {
    console.error("Erro ao processar pagamento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

