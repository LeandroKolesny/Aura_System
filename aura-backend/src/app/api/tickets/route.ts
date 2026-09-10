import { NextRequest, NextResponse } from "next/server";
import { Prisma, TicketStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

// GET - Listar tickets
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Prisma.TicketWhereInput = {};
    
    // OWNER vê todos, outros só da própria empresa
    if (user.role !== "OWNER" && user.companyId) {
      where.companyId = user.companyId;
    }
    if (status) where.status = status.toUpperCase() as TicketStatus;

    const tickets = await prisma.ticket.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Erro ao listar tickets:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar ticket
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const writeError = await checkWriteAccess(user);
    if (writeError) return writeError;

    const body = await request.json();
    const { subject, message } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { error: "Assunto e mensagem são obrigatórios" },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject,
        companyId: user.companyId!,
        messages: {
          create: {
            content: message,
            senderId: user.id,
            senderName: user.name || 'Usuário',
            isAdmin: false,
          },
        },
      },
      include: {
        company: { select: { id: true, name: true } },
        messages: true,
      },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar ticket:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PATCH - Atualizar ticket (responder ou fechar)
//
// NOTA: não chama checkWriteAccess() de propósito — quem responde aqui pode
// ser o OWNER (suporte do próprio SaaS), que não tem o mesmo vínculo de
// plano/assinatura da empresa dona do ticket. Bloquear respostas pelo status
// de assinatura da empresa cliente impediria dar suporte justo quando ela
// mais precisa (ex: empresa com pagamento atrasado pedindo ajuda). POST
// (abrir ticket) continua exigindo checkWriteAccess normalmente.
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { ticketId, message, status } = body;

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId obrigatório" }, { status: 400 });
    }

    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, companyId: true, status: true },
    });

    if (!existingTicket) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    // SECURITY: só o OWNER (suporte do SaaS) pode agir sobre chamados de
    // qualquer empresa — equipe de uma clínica só pode responder/fechar os
    // próprios chamados. 404 (não 403) para não vazar a existência do
    // chamado de outra empresa.
    if (user.role !== "OWNER" && existingTicket.companyId !== user.companyId) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    // Chamado encerrado não aceita novas mensagens (mudança de status, ex:
    // reabrir, continua permitida).
    if (message && existingTicket.status === "CLOSED") {
      return NextResponse.json(
        { error: "Este chamado está encerrado." },
        { status: 400 }
      );
    }

    // Se tem mensagem, adicionar resposta
    if (message) {
      await prisma.ticketMessage.create({
        data: {
          ticketId,
          content: message,
          senderId: user.id,
          senderName: user.name || 'Usuário',
          isAdmin: user.role === "OWNER",
        },
      });
    }

    // Se tem status, atualizar
    if (status) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: status.toUpperCase() },
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        company: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Erro ao atualizar ticket:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

