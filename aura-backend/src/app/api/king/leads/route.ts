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
    // Buscar empresas FREE ou TRIAL (potenciais conversões)
    // Também incluir empresas que já estão no pipeline (salesStatus != NEW ou que foram perdidas)
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

    // Converter empresas para formato de Lead
    const leads = companies.map((c) => {
      const admin = c.users[0];

      return {
        id: c.id,
        clinicName: c.name,
        contactName: admin?.name || "Sem contato",
        phone: admin?.phone || "",
        email: admin?.email || "",
        status: salesStatusMap[c.salesStatus] || "new",
        value: 197, // Valor potencial médio (Professional)
        createdAt: c.createdAt.toISOString(),
        companyId: c.id,
        plan: c.plan,
        subscriptionStatus: c.subscriptionStatus,
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
    const { companyId, status, plan } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "companyId é obrigatório" },
        { status: 400 }
      );
    }

    const updateData: any = {};

    // Sempre atualizar o salesStatus
    if (status) {
      const prismaStatus = reverseSalesStatusMap[status.toLowerCase()];
      if (prismaStatus) {
        updateData.salesStatus = prismaStatus;
      }
    }

    // Se marcou como ganho, atualiza plano e status de assinatura
    if (status === "won" && plan) {
      updateData.plan = plan;
      updateData.subscriptionStatus = "ACTIVE";
    }
    // Se marcou como perdido, muda para BASIC + CANCELED
    else if (status === "lost") {
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
