// API King Companies - Todas as empresas do sistema
import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/kingGuard";
import { queryCompanies } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const { authorized, response } = await requireOwner(request);
  if (!authorized) return response;

  try {
    const { searchParams } = new URL(request.url);

    const result = await queryCompanies({
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "100"),
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Erro ao listar empresas:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno" },
      { status: 500 }
    );
  }
}
