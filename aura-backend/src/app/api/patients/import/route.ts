// POST /api/patients/import
// Importação em massa de pacientes via CSV
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";
import { parseImportFile } from "@/lib/csvParser";

const ALLOWED_ROLES = ["OWNER", "ADMIN", "RECEPTIONIST"];
const MAX_ROWS = 1000;

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

function parseDate(value: string): Date | null {
  if (!value) return null;
  // Aceita DD/MM/YYYY, YYYY-MM-DD
  const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const d = new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T12:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(value);
  return isNaN(iso.getTime()) ? null : iso;
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
        { error: `Máximo de ${MAX_ROWS} pacientes por importação` },
        { status: 400 }
      );
    }

    // Verifica se coluna obrigatória existe no cabeçalho
    const firstRow = rows[0];
    if (!("nome" in firstRow)) {
      return NextResponse.json(
        { error: "Coluna obrigatória 'nome' não encontrada no CSV. Baixe o template para ver o formato correto." },
        { status: 400 }
      );
    }

    const result: ImportResult = { imported: 0, updated: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2: linha 1 = cabeçalho, +1 para humano

      const name = row["nome"]?.trim();
      if (!name) {
        result.errors.push({ row: rowNum, name: "(vazio)", reason: "Nome é obrigatório" });
        continue;
      }

      const email = row["email"]?.trim() || "";
      const phone = row["telefone"]?.trim() || row["celular"]?.trim() || "";
      const birthDateRaw = row["datanascimento"]?.trim() || row["data_nascimento"]?.trim() || "";
      const notes = row["notas"]?.trim() || row["observacoes"]?.trim() || "";
      const cpf = row["cpf"]?.trim() || "";

      const birthDate = birthDateRaw ? parseDate(birthDateRaw) : null;
      if (birthDateRaw && !birthDate) {
        result.errors.push({ row: rowNum, name, reason: `Data de nascimento inválida: "${birthDateRaw}". Use DD/MM/YYYY.` });
        continue;
      }

      try {
        if (email) {
          // Upsert por email + companyId
          const existing = await prisma.patient.findFirst({
            where: { email, companyId: user.companyId! },
            select: { id: true },
          });

          if (existing) {
            await prisma.patient.update({
              where: { id: existing.id },
              data: {
                name,
                phone: phone || undefined,
                birthDate: birthDate ?? undefined,
                ...(notes && { anamnesisSummary: notes }),
                ...(cpf && { cpf }),
              },
            });
            result.updated++;
          } else {
            await prisma.patient.create({
              data: {
                name,
                email,
                phone,
                companyId: user.companyId!,
                birthDate: birthDate ?? undefined,
                ...(notes && { anamnesisSummary: notes }),
                ...(cpf && { cpf }),
              },
            });
            result.imported++;
          }
        } else {
          // Sem email: sempre cria (não há como dedupluciar)
          await prisma.patient.create({
            data: {
              name,
              email: `importado_${Date.now()}_${i}@sem-email.local`,
              phone,
              companyId: user.companyId!,
              birthDate: birthDate ?? undefined,
              ...(notes && { anamnesisSummary: notes }),
              ...(cpf && { cpf }),
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
