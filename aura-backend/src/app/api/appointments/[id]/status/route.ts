// Aura System - API de Status do Agendamento
// LÓGICA CRÍTICA: Baixa de estoque ao completar atendimento
import { NextRequest, NextResponse } from "next/server";
import { Prisma, type AppointmentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { updateStatusSchema } from "@/lib/validations/appointment";
import { deleteCalendarEvent, pushAppointmentToCalendar } from "@/lib/calendarSync";
import { sendTextMessage } from "@/lib/whatsapp";
import { buildConfirmationMessage, formatDate, formatTime } from "@/lib/whatsappMessages";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: {
    patient: { select: { id: true; name: true } };
    professional: { select: { id: true; name: true } };
    procedure: { select: { id: true; name: true } };
  };
}>;

/**
 * Erro sinalizando que a conclusão do atendimento foi bloqueada porque algum
 * insumo ficaria com estoque negativo. Mapeado para HTTP 409 no handler.
 */
class InsufficientStockError extends Error {
  constructor(public readonly itemName: string) {
    super(`Estoque insuficiente para o insumo ${itemName}`);
    this.name = "InsufficientStockError";
  }
}

/**
 * Erro sinalizando que a assinatura já esgotou as sessões do procedimento neste
 * ciclo. Mapeado para HTTP 400 no handler. Lançado de dentro da $transaction que
 * deduz a sessão para que a checagem e o incremento sejam atômicos.
 */
class SessionLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`Limite de ${limit} sessão(ões) do plano já atingido`);
    this.name = "SessionLimitError";
  }
}

/**
 * Conclui o atendimento aplicando, numa ÚNICA transação atômica:
 *  - a dedução de estoque de TODOS os insumos do procedimento (decrement atômico)
 *  - o StockMovement (type OUT) de cada insumo
 *  - a atualização de lastVisit do paciente
 *  - a Transaction de DESPESA com o custo dos insumos (se houver)
 *  - o appointment.update({ status, stockDeducted: true })
 *
 * Ou tudo é aplicado, ou nada. Se qualquer passo falhar, a transação reverte e
 * um retry roda com segurança (stockDeducted continua false, status inalterado) —
 * sem risco de dupla dedução dos insumos já processados.
 *
 * DECISÃO (estoque negativo): bloqueamos a conclusão com 409 se algum insumo
 * ficaria negativo, consistente com POST /api/inventory/[id]/adjust (que já
 * bloqueia resultado < 0). A checagem roda ANTES de qualquer escrita; como tudo
 * está na $transaction, nada é deduzido e o status não muda quando o bloqueio
 * dispara.
 */
async function completeAppointmentWithStock(opts: {
  appointmentId: string;
  procedureId: string;
  patientId: string;
  patientName: string;
  companyId: string;
  newStatus: AppointmentStatus;
}): Promise<AppointmentWithRelations> {
  const { appointmentId, procedureId, patientId, patientName, companyId, newStatus } = opts;

  const supplies = await prisma.procedureSupply.findMany({
    where: { procedureId },
    include: { inventoryItem: true },
  });

  // Bloqueio de estoque negativo — antes de qualquer escrita.
  for (const supply of supplies) {
    const stock = Number(supply.inventoryItem?.currentStock ?? 0);
    if (stock - Number(supply.quantityUsed) < 0) {
      throw new InsufficientStockError(supply.inventoryItem?.name ?? supply.inventoryItemId);
    }
  }

  const procedure = await prisma.procedure.findUnique({ where: { id: procedureId } });

  const updated = await prisma.$transaction(async (tx) => {
    for (const supply of supplies) {
      // decrement é atômico no Prisma
      await tx.inventoryItem.update({
        where: { id: supply.inventoryItemId },
        data: { currentStock: { decrement: supply.quantityUsed } },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: supply.inventoryItemId,
          quantity: supply.quantityUsed,
          type: "OUT",
          reason: `Procedimento - Agendamento ${appointmentId}`,
        },
      });
    }

    await tx.patient.update({
      where: { id: patientId },
      data: { lastVisit: new Date() },
    });

    if (procedure && Number(procedure.cost) > 0) {
      await tx.transaction.create({
        data: {
          companyId,
          date: new Date(),
          description: `Custo Insumos: ${procedure.name} - ${patientName}`,
          amount: procedure.cost,
          type: "EXPENSE",
          category: "Insumos",
          status: "PAID",
          appointmentId,
        },
      });
    }

    return tx.appointment.update({
      where: { id: appointmentId },
      data: { status: newStatus, stockDeducted: true },
      include: {
        patient: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
        procedure: { select: { id: true, name: true } },
      },
    });
  });

  // Alertas de estoque baixo — pós-transação (não é crítico p/ consistência).
  for (const supply of supplies) {
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

  return updated;
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
      include: {
        patient: true,
        procedure: true,
        professional: { select: { id: true, name: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateStatusSchema.safeParse(body);

    if (!validation.success) {
      console.error("❌ [status] Validation failed:", JSON.stringify(validation.error.flatten()), "body received:", JSON.stringify(body));
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
      console.error(`❌ [status] Transição inválida: ${oldStatus} → ${status} | apptId=${id}`);
      return NextResponse.json(
        { error: `Transição de ${oldStatus} para ${status} não permitida` },
        { status: 400 }
      );
    }

    // Se completando atendimento, executar lógicas de negócio numa única transação.
    let updated: AppointmentWithRelations | undefined;
    if (status === "COMPLETED" && !appointment.stockDeducted) {
      try {
        updated = await completeAppointmentWithStock({
          appointmentId: id,
          procedureId: appointment.procedureId,
          patientId: appointment.patientId,
          patientName: appointment.patient.name,
          companyId: user.companyId,
          newStatus: status,
        });
      } catch (err) {
        if (err instanceof InsufficientStockError) {
          return NextResponse.json({ error: err.message }, { status: 409 });
        }
        throw err;
      }
    }

    // ── Clube de Assinaturas: deduzir sessão ao aprovar agendamento pendente ──
    // Na solicitação (POST /api/appointments) o paciente cria o agendamento com
    // price = 0 provisório e a dedução real é adiada para esta aprovação.
    //
    // A sessão só é DE FATO gratuita quando existe uma assinatura ACTIVE cujo
    // plano cobre o procedimento. Se, entre a solicitação e a aprovação, a
    // assinatura foi cancelada/pausada (findFirst filtra status: "ACTIVE" → null)
    // OU o procedimento saiu dos items do plano (planItem não encontrado), NÃO
    // deixamos o atendimento sair de graça: recalculamos para o preço cheio do
    // procedimento e gravamos esse valor no agendamento (priceOverride abaixo).
    let priceOverride: number | undefined;
    if (status === "SCHEDULED" && oldStatus === "PENDING_APPROVAL" && appointment.subscriptionId) {
      const sub = await prisma.patientSubscription.findFirst({
        where: { id: appointment.subscriptionId, companyId: user.companyId!, status: "ACTIVE" },
        include: { plan: { include: { items: true } } },
      });
      const planItem = sub?.plan.items.find((item) => item.procedureId === appointment.procedureId);

      if (sub && planItem) {
        // Race: duas aprovações concorrentes disputando a última sessão do ciclo
        // poderiam ambas passar pela checagem `used >= limite` antes de qualquer
        // update. Leitura + checagem + incremento do JSON `sessionsUsedThisCycle`
        // rodam numa $transaction Serializable — se duas rodarem juntas na mesma
        // assinatura o Postgres aborta uma (P2034), que cai no catch genérico
        // (500) sem furar o limite. (increment atômico não se aplica: o contador
        // vive numa coluna JSON por procedimento, não num Int.)
        try {
          await prisma.$transaction(
            async (tx) => {
              const fresh = await tx.patientSubscription.findFirst({
                where: { id: sub.id, companyId: user.companyId! },
                select: { sessionsUsedThisCycle: true },
              });
              const current = (fresh?.sessionsUsedThisCycle ?? {}) as Record<string, number>;
              const used = current[appointment.procedureId] ?? 0;
              if (used >= planItem.sessionsPerCycle) {
                throw new SessionLimitError(planItem.sessionsPerCycle);
              }
              await tx.patientSubscription.update({
                where: { id: sub.id },
                data: {
                  sessionsUsedThisCycle: {
                    ...current,
                    [appointment.procedureId]: used + 1,
                  },
                },
              });
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
          );
        } catch (err) {
          if (err instanceof SessionLimitError) {
            return NextResponse.json(
              { error: `Limite de ${err.limit} sessão(ões) do plano já atingido para este paciente.` },
              { status: 400 }
            );
          }
          throw err;
        }
      } else {
        // Assinatura não-ACTIVE ou procedimento fora do plano: cobra o preço
        // cheio do procedimento em vez de manter o 0 provisório.
        const fullPrice = Number(appointment.procedure?.price);
        if (Number.isFinite(fullPrice)) {
          priceOverride = fullPrice;
        }
      }
    }
    // ── fim deduction ──

    // Atualizar status (quando não passou pela transação de conclusão acima)
    if (!updated) {
      updated = await prisma.appointment.update({
        where: { id },
        data: {
          status,
          stockDeducted: status === "COMPLETED" ? true : appointment.stockDeducted,
          // priceOverride só é definido na aprovação de um agendamento com
          // assinatura que deixou de cobrir a sessão — evita atendimento grátis.
          ...(priceOverride !== undefined ? { price: priceOverride } : {}),
        },
        include: {
          patient: { select: { id: true, name: true } },
          professional: { select: { id: true, name: true } },
          procedure: { select: { id: true, name: true } },
        },
      });
    }

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

    // Disparar WhatsApp de confirmação (fire-and-forget)
    if (status === "CONFIRMED") {
      ;(async () => {
        try {
          const waInstance = await prisma.whatsappInstance.findUnique({
            where: { companyId: user.companyId! },
          })
          if (waInstance?.status !== "CONNECTED") return
          if (!appointment.patient.phone) return

          const company = await prisma.company.findUnique({
            where: { id: user.companyId! },
            select: { name: true },
          })

          const msg = buildConfirmationMessage({
            patientName: appointment.patient.name,
            clinicName: company?.name ?? "a clínica",
            date: formatDate(appointment.date),
            time: formatTime(appointment.date),
            procedure: appointment.procedure.name,
            professional: appointment.professional?.name ?? "",
          })

          await sendTextMessage(user.companyId!, appointment.patient.phone, msg)
        } catch (err) {
          console.error("[WhatsApp] Falha ao enviar confirmação:", err)
        }
      })()
    }

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
