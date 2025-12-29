import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

// GET - Listar fotos
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const groupId = searchParams.get("groupId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = { companyId: user.companyId };
    if (patientId) where.patientId = patientId;
    if (groupId) where.groupId = groupId;

    const photos = await prisma.photoRecord.findMany({
      where,
      take: limit,
      orderBy: { date: "desc" },
      include: {
        patient: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Erro ao listar fotos:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar foto
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const writeError = await checkWriteAccess(user);
    if (writeError) return writeError;

    const body = await request.json();
    const { patientId, url, type, procedure, groupId, date } = body;

    if (!patientId || !url || !type || !procedure) {
      return NextResponse.json(
        { error: "Campos obrigatórios: patientId, url, type, procedure" },
        { status: 400 }
      );
    }

    const photo = await prisma.photoRecord.create({
      data: {
        patientId,
        url,
        type: type.toUpperCase(),
        procedure,
        groupId: groupId || `group_${Date.now()}`,
        date: date ? new Date(date) : new Date(),
        companyId: user.companyId!,
      },
      include: {
        patient: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar foto:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE - Remover foto
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const writeError = await checkWriteAccess(user);
    if (writeError) return writeError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    await prisma.photoRecord.delete({
      where: { id, companyId: user.companyId! },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar foto:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

