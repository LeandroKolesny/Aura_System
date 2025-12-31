import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// POST /api/system/maintenance - Ativar/desativar modo manutencao (OWNER only)
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticacao
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: "Nao autorizado" },
        { status: 401 }
      );
    }

    // Verificar se e OWNER
    if (authResult.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o Owner pode alterar o modo de manutencao" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { enabled, message } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Campo 'enabled' e obrigatorio e deve ser boolean" },
        { status: 400 }
      );
    }

    // Atualizar ou criar configuracoes
    const settings = await prisma.systemSettings.upsert({
      where: { id: "global" },
      update: {
        maintenanceMode: enabled,
        maintenanceMessage: message || null,
        maintenanceStartedAt: enabled ? new Date() : null,
        maintenanceStartedBy: enabled ? authResult.user.id : null,
      },
      create: {
        id: "global",
        maintenanceMode: enabled,
        maintenanceMessage: message || null,
        maintenanceStartedAt: enabled ? new Date() : null,
        maintenanceStartedBy: enabled ? authResult.user.id : null,
      },
    });

    // Log da acao
    console.log(
      `[MAINTENANCE] ${enabled ? "ATIVADO" : "DESATIVADO"} por ${authResult.user.email} em ${new Date().toISOString()}`
    );

    return NextResponse.json({
      success: true,
      maintenanceMode: settings.maintenanceMode,
      message: enabled
        ? "Modo manutencao ATIVADO. Usuarios serao deslogados."
        : "Modo manutencao DESATIVADO. Sistema voltou ao normal.",
    });
  } catch (error) {
    console.error("Erro ao alterar modo manutencao:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// GET /api/system/maintenance - Obter status atual (OWNER only)
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticacao
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: "Nao autorizado" },
        { status: 401 }
      );
    }

    // Verificar se e OWNER
    if (authResult.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o Owner pode ver detalhes de manutencao" },
        { status: 403 }
      );
    }

    let settings = await prisma.systemSettings.findUnique({
      where: { id: "global" },
    });

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
      maintenanceStartedBy: settings.maintenanceStartedBy,
    });
  } catch (error) {
    console.error("Erro ao buscar status de manutencao:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
