import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const updateLeadSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).optional(),
  notes: z.string().optional().nullable(),
  lastContact: z.string().datetime().optional().nullable(),
  nextFollowUp: z.string().datetime().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

// GET - Buscar lead por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, avatar: true, email: true } },
        company: { select: { id: true, name: true } },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Erro ao buscar lead:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PATCH - Atualizar lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateLeadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const existingLead = await prisma.lead.findUnique({ where: { id } });
    if (!existingLead) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    // Preparar dados para update
    const updateData: Record<string, unknown> = { ...validation.data };
    if (updateData.lastContact) {
      updateData.lastContact = new Date(updateData.lastContact as string);
    }
    if (updateData.nextFollowUp) {
      updateData.nextFollowUp = new Date(updateData.nextFollowUp as string);
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Registrar mudança de status
    if (validation.data.status && validation.data.status !== existingLead.status) {
      await prisma.activity.create({
        data: {
          type: "LEAD_STATUS_CHANGED",
          title: `Status alterado para ${validation.data.status}`,
          description: `De ${existingLead.status} para ${validation.data.status}`,
          userId: user.id,
        },
      });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Erro ao atualizar lead:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE - Excluir lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await prisma.lead.delete({ where: { id } });

    return NextResponse.json({ message: "Lead excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir lead:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

