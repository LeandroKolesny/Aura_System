// POST /api/procedures/import
// Importação em massa de procedimentos via CSV
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
  // Aceita "150", "150.00", "150,00" (formato brasileiro)
  const normalized = value.replace(',', '.');
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
      return NextResponse.json({ error: "Arquivo CSV não enviado" }, { status: 400 });
    }

    const rows = await parseImportFile(file as File);

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV vazio ou sem dados além do cabeçalho" }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_ROWS} procedimentos por importação` },
        { status: 400 }
      );
    }

    const firstRow = rows[0];
    const missingCols = ["nome", "preco"].filter(col => !(col in firstRow));
    if (missingCols.length > 0) {
      return NextResponse.json(
        { error: `Colunas obrigatórias ausentes: ${missingCols.join(", ")}. Baixe o template para ver o formato correto.` },
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

      const precoRaw = row["preco"]?.trim();
      const price = parseDecimal(precoRaw);
      if (price === null) {
        result.errors.push({ row: rowNum, name, reason: `Preço inválido: "${precoRaw}". Use formato numérico (ex: 150 ou 150,00).` });
        continue;
      }

      const duracaoRaw = row["duracaominutos"]?.trim() || row["duracao"]?.trim() || "60";
      const durationMinutes = parseInt(duracaoRaw, 10);
      if (isNaN(durationMinutes) || durationMinutes <= 0) {
        result.errors.push({ row: rowNum, name, reason: `Duração inválida: "${duracaoRaw}". Use número inteiro de minutos.` });
        continue;
      }

      const custoRaw = row["custo"]?.trim();
      const cost = custoRaw ? parseDecimal(custoRaw) : 0;
      if (cost === null) {
        result.errors.push({ row: rowNum, name, reason: `Custo inválido: "${custoRaw}". Use formato numérico.` });
        continue;
      }

      const description = row["descricao"]?.trim() || undefined;

      try {
        const existing = await prisma.procedure.findFirst({
          where: { name, companyId: user.companyId! },
          select: { id: true },
        });

        if (existing) {
          await prisma.procedure.update({
            where: { id: existing.id },
            data: { price, cost: cost ?? 0, durationMinutes, description },
          });
          result.updated++;
        } else {
          await prisma.procedure.create({
            data: {
              name,
              price,
              cost: cost ?? 0,
              durationMinutes,
              description,
              companyId: user.companyId!,
            },
          });
          result.imported++;
        }
      } catch {
        result.errors.push({ row: rowNum, name, reason: "Erro ao salvar no banco de dados" });
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: "Erro interno ao processar o arquivo" }, { status: 500 });
  }
}
