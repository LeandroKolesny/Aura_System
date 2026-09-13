import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// Normaliza pra maiúsculas e valida contra o enum aceito pelo Prisma —
// aceita tanto 'info' (usado pelo frontend) quanto 'INFO'.
const alertTypeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(["INFO", "WARNING", "ERROR", "SUCCESS"]));

const alertStatusSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(["ACTIVE", "INACTIVE"]));

const createAlertSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório"),
  message: z.string().trim().min(1, "Mensagem é obrigatória"),
  type: alertTypeSchema.optional().default("INFO"),
  target: z.string().trim().min(1, "Destinatário inválido").optional().default("all"),
});

const updateAlertSchema = z.object({
  id: z.string().trim().min(1, "ID é obrigatório"),
  status: alertStatusSchema.optional(),
});

// GET - Listar alertas do sistema
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    // OWNER vê o histórico completo dos alertas que ele mesmo enviou
    // (globais e direcionados a uma clínica específica). Clínicas só veem
    // os alertas globais ('all') ou os direcionados à própria empresa —
    // filtrar OWNER pelo companyId (sempre null) fazia o próprio criador do
    // alerta nunca ver, no histórico, os alertas que ele mandou pra uma
    // única clínica (target = companyId, nunca 'all' nem null).
    const where: Prisma.SystemAlertWhereInput =
      user.role === "OWNER"
        ? {}
        : { OR: [{ target: "all" }, { target: user.companyId ?? "" }] };

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
    const validation = createAlertSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { title, message, type, target } = validation.data;

    const alert = await prisma.systemAlert.create({
      data: {
        title,
        message,
        type,
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
    const validation = updateAlertSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { id, status } = validation.data;

    const alert = await prisma.systemAlert.update({
      where: { id },
      data: { status: status ?? "INACTIVE" },
    });

    return NextResponse.json({ alert });
  } catch (error) {
    console.error("Erro ao atualizar alerta:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
