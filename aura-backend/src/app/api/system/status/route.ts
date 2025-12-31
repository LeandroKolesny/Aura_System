import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/system/status - Endpoint PUBLICO para verificar status do sistema
export async function GET(request: NextRequest) {
  try {
    // Buscar ou criar configuracoes do sistema
    let settings = await prisma.systemSettings.findUnique({
      where: { id: "global" },
    });

    // Se nao existir, criar com valores padrao
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          id: "global",
          maintenanceMode: false,
        },
      });
    }

    return NextResponse.json({
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      maintenanceStartedAt: settings.maintenanceStartedAt,
    });
  } catch (error) {
    console.error("Erro ao buscar status do sistema:", error);
    return NextResponse.json(
      { maintenanceMode: false },
      { status: 200 }
    );
  }
}
