import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// Política de retenção: 90 dias após cancelamento (mínimo fiscal brasileiro)
const RETENTION_DAYS = 90

function validateCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[CRON] CRON_SECRET environment variable is not set")
    return false
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!token) return false

  try {
    const provided = Buffer.from(token)
    const expected = Buffer.from(cronSecret)
    if (provided.length !== expected.length) return false
    return timingSafeEqual(provided, expected)
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!validateCronSecret(request)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

    // Empresas canceladas há mais de 90 dias
    const companies = await prisma.company.findMany({
      where: {
        subscriptionStatus: "CANCELED",
        subscriptionExpiresAt: { lte: cutoff },
      },
      select: { id: true, name: true },
    })

    let processed = 0
    for (const company of companies) {
      try {
        // Anonimizar dados pessoais de pacientes
        // email e phone são String não-nullable no modelo — usar placeholder
        await prisma.patient.updateMany({
          where: { companyId: company.id },
          data: {
            name: "Paciente Removido",
            email: `removed_${company.id}@aura.removed`,
            phone: "00000000000",
            cpf: null,
            birthDate: null,
          },
        })

        // Desativar usuários da empresa
        await prisma.user.updateMany({
          where: { companyId: company.id },
          data: { isActive: false },
        })

        // Marcar empresa como processada com nome anonimizado
        await prisma.company.update({
          where: { id: company.id },
          data: { name: `Empresa Removida (${company.id.slice(-6)})` },
        })

        processed++
        console.log(`[Retention] Empresa ${company.id} anonimizada`)
      } catch (err) {
        console.error(`[Retention] Erro ao processar empresa ${company.id}:`, err)
        // Continue processing remaining companies
      }
    }

    return NextResponse.json({ processed, total: companies.length })
  } catch (error) {
    console.error("[Retention] Erro no cron de retenção de dados:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
