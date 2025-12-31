// API King Dashboard - Estatísticas Globais do Sistema
import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/kingGuard";
import { queryGlobalStats } from "@/lib/queries";

export async function GET(request: NextRequest) {
  console.log("👑 [King Dashboard] Iniciando requisição...");

  // Guard: Apenas OWNER pode acessar
  const { authorized, response, user } = await requireOwner(request);

  if (!authorized) {
    console.log("❌ [King Dashboard] Não autorizado");
    return response;
  }

  console.log("✅ [King Dashboard] Usuário autorizado:", user?.email);

  try {
    console.log("📊 [King Dashboard] Buscando stats globais...");
    const stats = await queryGlobalStats();
    console.log("📊 [King Dashboard] Stats encontrados:", JSON.stringify(stats, null, 2));

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("❌ [King Dashboard] Erro ao buscar stats globais:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}
