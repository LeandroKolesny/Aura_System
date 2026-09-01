// API King Leads - Empresas FREE/TRIAL como leads para conversão
import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/kingGuard";
import prisma from "@/lib/prisma";

// Mapeamento de SalesStatus do Prisma para status do frontend
const salesStatusMap: Record<string, string> = {
  NEW: "new",
  CONTACTED: "contacted",
  DEMO: "demo",
  NEGOTIATION: "negotiation",
  WON: "won",
  LOST: "lost",
};

const reverseSalesStatusMap: Record<string, string> = {
  new: "NEW",
  contacted: "CONTACTED",
  demo: "DEMO",
  negotiation: "NEGOTIATION",
  won: "WON",
  lost: "LOST",
};

// GET - Listar empresas FREE/TRIAL como leads
export async function GET(request: NextRequest) {
  const result = await requireOwner(request);
  if (!result.authorized) return result.response;

  try {
    const companies = await prisma.company.findMany({
      where: {
        OR: [
          { plan: "FREE" },
          { subscriptionStatus: "TRIAL" },
          { salesStatus: { in: ["NEW", "CONTACTED", "DEMO", "NEGOTIATION", "WON", "LOST"] } },
        ],
      },
      include: {
        users: {
          where: { role: "ADMIN" },
          take: 1,
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const leads = companies.map((c) => {
      const admin = c.users[0];

      return {
        id: c.id,
        clinicName: c.name,
        contactName: admin?.name || "Sem contato",
        phone: admin?.phone || "",
        email: admin?.email || "",
        status: salesStatusMap[c.salesStatus] || "new",
        value: 197,
        createdAt: c.createdAt.toISOString(),
        companyId: c.id,
        plan: c.plan,
        subscriptionStatus: c.subscriptionStatus,
        seenByOwner: c.seenByOwner,
        movedAt: c.salesMovedAt?.toISOString() ?? null,
        demoAt: c.demoAt?.toISOString() ?? null,
        demoNotes: c.demoNotes ?? null,
        lostReason: c.lostReason ?? null,
        lostComment: c.lostComment ?? null,
      };
    });

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("Erro ao listar leads:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}

// PATCH - Atualizar status do lead (mover no pipeline)
export async function PATCH(request: NextRequest) {
  const result = await requireOwner(request);
  if (!result.authorized) return result.response;

  try {
    const body = await request.json();
    const { companyId, status, plan, demoAt, demoNotes, lostReason, lostComment } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "companyId é obrigatório" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      const prismaStatus = reverseSalesStatusMap[status.toLowerCase()];
      if (prismaStatus) {
        updateData.salesStatus = prismaStatus;
        updateData.salesMovedAt = new Date();
      }
    }

    if (demoAt !== undefined) updateData.demoAt = demoAt ? new Date(demoAt) : null;
    if (demoNotes !== undefined) updateData.demoNotes = demoNotes;
    if (lostReason !== undefined) updateData.lostReason = lostReason;
    if (lostComment !== undefined) updateData.lostComment = lostComment;

    if (status === "won" && plan) {
      updateData.plan = plan;
      updateData.subscriptionStatus = "ACTIVE";
    } else if (status === "lost") {
      updateData.plan = "BASIC";
      updateData.subscriptionStatus = "CANCELED";
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.company.update({
        where: { id: companyId },
        data: updateData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar lead:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}
