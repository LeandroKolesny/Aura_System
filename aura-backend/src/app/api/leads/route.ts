import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const createLeadSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido").optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).optional(),
  notes: z.string().optional().nullable(),
  lastContact: z.string().datetime().optional().nullable(),
  nextFollowUp: z.string().datetime().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

// GET - Listar leads
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where = {
      companyId: user.companyId,
      ...(status && { status: status as any }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, name: true, avatar: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erro ao listar leads:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar lead
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createLeadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Preparar dados para create
    const createData: Record<string, unknown> = {
      ...validation.data,
      companyId: user.companyId,
    };
    if (createData.lastContact) {
      createData.lastContact = new Date(createData.lastContact as string);
    }
    if (createData.nextFollowUp) {
      createData.nextFollowUp = new Date(createData.nextFollowUp as string);
    }

    const lead = await prisma.lead.create({
      data: createData as Parameters<typeof prisma.lead.create>[0]['data'],
      include: {
        assignedTo: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Criar atividade de criação
    await prisma.activity.create({
      data: {
        type: "LEAD_CREATED",
        title: `Lead "${lead.name}" criado`,
        userId: user.id,
      },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar lead:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

