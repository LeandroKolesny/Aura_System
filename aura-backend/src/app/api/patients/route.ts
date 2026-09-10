// Aura System - API de Pacientes
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess, checkPatientLimit } from "@/lib/apiGuards";
import {
  createPatientSchema,
  listPatientsQuerySchema,
} from "@/lib/validations/patient";

// Cache helper
function createCachedResponse<T>(data: T, cacheSeconds: number = 30) {
  const response = NextResponse.json(data);
  response.headers.set(
    "Cache-Control",
    `private, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`
  );
  return response;
}

// GET - Listar pacientes da empresa
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // SECURITY (LGPD): Pacientes não podem listar todos os pacientes da clínica.
    // O portal do paciente usa endpoints próprios para acessar seus próprios dados.
    if (user.role === 'PATIENT') {
      return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const queryValidation = listPatientsQuerySchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      search: searchParams.get("search"),
      status: searchParams.get("status"),
      sortBy: searchParams.get("sortBy"),
      sortOrder: searchParams.get("sortOrder"),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: queryValidation.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit, search, status, sortBy, sortOrder } = queryValidation.data;
    const skip = (page - 1) * limit;

    // Construir filtros
    const where: Prisma.PatientWhereInput = {
      companyId: user.companyId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { cpf: { contains: search } },
      ];
    }

    if (status && status !== "all") {
      where.status = status;
    }

    // Buscar pacientes
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          companyId: true, // IMPORTANTE: Necessário para filtro no frontend
          name: true,
          email: true,
          phone: true,
          birthDate: true,
          cpf: true,
          status: true,
          lastVisit: true,
          consentSignedAt: true,
          consentSignatureUrl: true,
          consentMetadata: true,
          consentCorrectionCount: true,
          lastConsentCorrectionAt: true,
          lastConsentCorrectionReason: true,
          anamnesisLinkSent: true,
          // Campos consumidos pela aba Marketing (pages/Marketing.tsx):
          // lastMarketingMessageSentAt controla o "já enviado" e marketingOptOut
          // exclui pacientes que recusaram contato promocional (LGPD).
          lastMarketingMessageSentAt: true,
          marketingOptOut: true,
          createdAt: true,
        },
      }),
      prisma.patient.count({ where }),
    ]);

    // Cache por 30 segundos
    return createCachedResponse({
      patients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 30);
  } catch (error) {
    console.error("Erro ao listar pacientes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar novo paciente
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // GUARD: Verificar se plano permite escrita
    const writeError = await checkWriteAccess(user);
    if (writeError) return writeError;

    // GUARD: Verificar limite de pacientes do plano
    const limitError = await checkPatientLimit(user);
    if (limitError) return limitError;

    // Verificar permissão (ADMIN, RECEPTIONIST, ESTHETICIAN podem criar)
    const allowedRoles = ["OWNER", "ADMIN", "RECEPTIONIST", "ESTHETICIAN"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createPatientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verificar se email já existe na empresa
    const existingPatient = await prisma.patient.findFirst({
      where: {
        email: validation.data.email,
        companyId: user.companyId,
      },
    });

    if (existingPatient) {
      return NextResponse.json(
        { error: "Já existe um paciente com este e-mail" },
        { status: 409 }
      );
    }

    // Criar paciente
    const patient = await prisma.patient.create({
      data: {
        ...validation.data,
        birthDate: validation.data.birthDate ? new Date(validation.data.birthDate) : null,
        companyId: user.companyId,
      },
    });

    // Log de atividade
    await prisma.activity.create({
      data: {
        type: "PATIENT_CREATED",
        title: `Paciente "${patient.name}" cadastrado`,
        userId: user.id,
        metadata: { patientId: patient.id },
      },
    });

    return NextResponse.json({ patient }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar paciente:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

