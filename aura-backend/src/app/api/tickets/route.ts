import { NextRequest, NextResponse } from "next/server";
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

    const where: any = {};
    
    // OWNER vê todos, outros só da própria empresa
    if (user.role !== "OWNER") {
      where.companyId = user.companyId;
    }
    if (status) where.status = status.toUpperCase();

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

