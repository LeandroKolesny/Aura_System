import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET - Listar alertas do sistema
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    // Buscar alertas para 'all' ou específicos para a empresa do usuário
    const where: any = {
      OR: [
        { target: "all" },
        { target: user.companyId },
      ],
    };

    if (activeOnly) {
      where.status = "ACTIVE";
    }

    const alerts = await prisma.systemAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Erro ao listar alertas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar alerta (apenas OWNER)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (user.role !== "OWNER") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const { title, message, type = "INFO", target = "all" } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "Título e mensagem são obrigatórios" },
        { status: 400 }
      );
    }

    const alert = await prisma.systemAlert.create({
      data: {
        title,
        message,
        type: type.toUpperCase(),
        target,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar alerta:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PATCH - Atualizar status do alerta (apenas OWNER)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (user.role !== "OWNER") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const alert = await prisma.systemAlert.update({
      where: { id },
      data: { status: status?.toUpperCase() || "INACTIVE" },
    });

    return NextResponse.json({ alert });
  } catch (error) {
    console.error("Erro ao atualizar alerta:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

