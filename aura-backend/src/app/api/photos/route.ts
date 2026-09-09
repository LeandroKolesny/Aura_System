import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

// Aceita tanto uma URL http(s) hospedada quanto uma data URL base64 de imagem
// (o modal de upload no frontend ainda não envia pra um storage externo —
// a foto é lida localmente e convertida em base64 antes de ser enviada).
const DATA_URL_IMAGE_REGEX = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/;

const createPhotoSchema = z.object({
  patientId: z.string().cuid(),
  url: z.string().max(8_000_000).refine(
    (u) => u.startsWith('https://') || u.startsWith('http://') || DATA_URL_IMAGE_REGEX.test(u),
    { message: "URL deve ser http(s) ou uma data URL de imagem válida (png, jpeg, gif ou webp)" }
  ),
  type: z.enum(["BEFORE", "AFTER"]),
  procedure: z.string().min(1).max(100),
  groupId: z.string().max(100).optional(),
  date: z.string().datetime().optional(),
});

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
    const rawLimit = parseInt(searchParams.get("limit") || "50");
    const limit = Math.min(Math.max(rawLimit, 1), 100); // cap 1–100

    const where: Prisma.PhotoRecordWhereInput = { companyId: user.companyId! };
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

    const rawBody = await request.json();
    const validation = createPhotoSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { patientId, url, type, procedure, groupId, date } = validation.data;

    const photo = await prisma.photoRecord.create({
      data: {
        patientId,
        url,
        type,
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
