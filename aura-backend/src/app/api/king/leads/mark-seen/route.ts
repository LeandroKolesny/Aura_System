import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/kingGuard";
import prisma from "@/lib/prisma";

// PATCH - Marcar todos os leads como vistos pelo owner
export async function PATCH(request: NextRequest) {
  const result = await requireOwner(request);
  if (!result.authorized) return result.response;

  try {
    await prisma.company.updateMany({
      where: { seenByOwner: false },
      data: { seenByOwner: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao marcar leads como vistos:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}
