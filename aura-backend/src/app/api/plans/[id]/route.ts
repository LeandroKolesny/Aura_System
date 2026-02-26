import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// PATCH /api/plans/[id] - Atualizar plano (OWNER only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    if (authResult.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o Owner pode atualizar planos" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, price, features, active, stripePaymentLink } = body;

    // Verificar se plano existe
    const existing = await prisma.saasPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Plano nao encontrado" },
        { status: 404 }
      );
    }

    const plan = await prisma.saasPlan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price }),
        ...(features !== undefined && { features }),
        ...(active !== undefined && { isActive: active }),
        ...(stripePaymentLink !== undefined && { stripeProductId: stripePaymentLink || null }),
      },
    });

    return NextResponse.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        price: Number(plan.price),
        features: plan.features,
        active: plan.isActive,
        stripePaymentLink: plan.stripeProductId || "",
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar plano:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/plans/[id] - Excluir plano (OWNER only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    if (authResult.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o Owner pode excluir planos" },
        { status: 403 }
      );
    }

    // Verificar se plano existe
    const existing = await prisma.saasPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Plano nao encontrado" },
        { status: 404 }
      );
    }

    await prisma.saasPlan.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir plano:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
