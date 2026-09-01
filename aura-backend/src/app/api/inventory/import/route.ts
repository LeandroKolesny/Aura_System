// POST /api/inventory/import
// Importação em massa de itens de estoque via CSV ou XLSX
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";
import { parseImportFile } from "@/lib/csvParser";

const ALLOWED_ROLES = ["OWNER", "ADMIN"];
const MAX_ROWS = 500;

interface ImportError {
  row: number;
  name: string;
  reason: string;
}

interface ImportResult {
  imported: number;
  updated: number;
  errors: ImportError[];
}

function parseDecimal(value: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) || num < 0 ? null : num;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    const rows = await parseImportFile(file as File);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Arquivo vazio ou sem dados além do cabeçalho" }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_ROWS} itens por importação` },
        { status: 400 }
      );
    }

    const missing = ["nome", "unidade", "custo"].filter((c) => !(c in rows[0]));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Colunas obrigatórias ausentes: ${missing.join(", ")}. Baixe o template para ver o formato correto.` },
        { status: 400 }
      );
    }

    const result: ImportResult = { imported: 0, updated: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name = row["nome"]?.trim();
      if (!name) {
        result.errors.push({ row: rowNum, name: "(vazio)", reason: "Nome é obrigatório" });
        continue;
      }

      const unit = row["unidade"]?.trim();
      if (!unit) {
        result.errors.push({ row: rowNum, name, reason: "Unidade é obrigatória (ex: un, ml, g, cx)" });
        continue;
      }

      const custoRaw = row["custo"]?.trim();
      const costPerUnit = parseDecimal(custoRaw);
      if (costPerUnit === null) {
        result.errors.push({ row: rowNum, name, reason: `Custo inválido: "${custoRaw}". Use formato numérico (ex: 12,50).` });
        continue;
      }

      const estoqueRaw = row["estoque"]?.trim() || row["estoqueatual"]?.trim() || "0";
      const currentStock = parseDecimal(estoqueRaw);
      if (currentStock === null) {
        result.errors.push({ row: rowNum, name, reason: `Estoque inválido: "${estoqueRaw}". Use número (ex: 10).` });
        continue;
      }

      const estoqueMinRaw = row["estoqueminimo"]?.trim() || row["minimo"]?.trim() || "5";
      const minStock = parseDecimal(estoqueMinRaw) ?? 5;

      try {
        const existing = await prisma.inventoryItem.findFirst({
          where: { name, companyId: user.companyId! },
          select: { id: true },
        });

        if (existing) {
          await prisma.inventoryItem.update({
            where: { id: existing.id },
            data: { unit, costPerUnit, currentStock, minStock },
          });
          result.updated++;
        } else {
          await prisma.inventoryItem.create({
            data: { name, unit, costPerUnit, currentStock, minStock, companyId: user.companyId! },
          });
          result.imported++;
        }
      } catch {
        result.errors.push({ row: rowNum, name, reason: "Erro ao salvar no banco de dados" });
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: "Erro inesperado ao processar o arquivo" }, { status: 500 });
  }
}
