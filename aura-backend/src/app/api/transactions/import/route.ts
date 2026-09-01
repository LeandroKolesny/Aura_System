// POST /api/transactions/import
// Importação em massa de receitas e despesas via CSV ou XLSX
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";
import { parseImportFile } from "@/lib/csvParser";

const ALLOWED_ROLES = ["OWNER", "ADMIN"];
const MAX_ROWS = 1000;

const VALID_TYPES = ["receita", "despesa", "income", "expense"];
const VALID_STATUSES = ["pago", "pendente", "paid", "pending"];

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

function parseDate(value: string): Date | null {
  if (!value) return null;
  const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    // T12:00:00Z: meio-dia UTC garante que a data permanece correta em qualquer fuso (inclusive UTC-3)
    const d = new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T12:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(value);
  return isNaN(iso.getTime()) ? null : iso;
}

function normalizeType(raw: string): "INCOME" | "EXPENSE" | null {
  const v = raw.trim().toLowerCase();
  if (v === "receita" || v === "income") return "INCOME";
  if (v === "despesa" || v === "expense") return "EXPENSE";
  return null;
}

function normalizeStatus(raw: string): "PAID" | "PENDING" {
  const v = raw.trim().toLowerCase();
  if (v === "pago" || v === "paid") return "PAID";
  return "PENDING";
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
        { error: `Máximo de ${MAX_ROWS} lançamentos por importação` },
        { status: 400 }
      );
    }

    const firstRow = rows[0];
    const missing = ["descricao", "valor", "tipo"].filter((c) => !(c in firstRow));
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

      const description = row["descricao"]?.trim();
      if (!description) {
        result.errors.push({ row: rowNum, name: "(vazio)", reason: "Descrição é obrigatória" });
        continue;
      }

      const valorRaw = row["valor"]?.trim();
      const amount = parseDecimal(valorRaw);
      if (amount === null) {
        result.errors.push({ row: rowNum, name: description, reason: `Valor inválido: "${valorRaw}". Use formato numérico (ex: 150 ou 150,00).` });
        continue;
      }

      const tipoRaw = row["tipo"]?.trim();
      const type = normalizeType(tipoRaw);
      if (!type) {
        result.errors.push({ row: rowNum, name: description, reason: `Tipo inválido: "${tipoRaw}". Use "receita" ou "despesa".` });
        continue;
      }

      const dateRaw = row["data"]?.trim() || row["date"]?.trim();
      const date = dateRaw ? parseDate(dateRaw) : new Date();
      if (dateRaw && !date) {
        result.errors.push({ row: rowNum, name: description, reason: `Data inválida: "${dateRaw}". Use DD/MM/AAAA.` });
        continue;
      }

      const statusRaw = row["status"]?.trim() || "pending";
      const status = normalizeStatus(statusRaw);

      const category = row["categoria"]?.trim() || (type === "INCOME" ? "Receita" : "Despesa");
      const paymentMethod = row["formapagamento"]?.trim() || row["pagamento"]?.trim() || undefined;

      try {
        await prisma.transaction.create({
          data: {
            description,
            amount,
            type,
            status,
            category,
            date: date ?? new Date(),
            paymentMethod: paymentMethod || null,
            companyId: user.companyId!,
          },
        });
        result.imported++;
      } catch {
        result.errors.push({ row: rowNum, name: description, reason: "Erro ao salvar no banco de dados" });
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: "Erro inesperado ao processar o arquivo" }, { status: 500 });
  }
}
