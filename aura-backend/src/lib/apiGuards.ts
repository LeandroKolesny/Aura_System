// Aura System - Guards de API
// Funções para validação de acesso em rotas

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  SystemModule,
  hasModuleAccess,
  isReadOnlyMode,
  canCreatePatient,
  canCreateProfessional,
  getPlanErrorMessage,
} from "@/lib/planPermissions";

interface AuthUser {
  id: string;
  companyId: string | null;
  role: string;
}

interface CompanyData {
  plan: any;
  subscriptionStatus: any;
  subscriptionExpiresAt: Date | null;
}

/**
 * Verifica se usuário tem acesso a um módulo específico
 * Retorna NextResponse de erro ou null se permitido
 */
export async function checkModuleAccess(
  user: AuthUser,
  module: SystemModule
): Promise<NextResponse | null> {
  if (!user.companyId) {
    return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      plan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  if (!hasModuleAccess(company, module)) {
    return NextResponse.json(
      {
        error: "Acesso negado",
        message: getPlanErrorMessage(company, module),
        code: "MODULE_NOT_AVAILABLE",
      },
      { status: 403 }
    );
  }

  return null; // Acesso permitido
}

/**
 * Verifica se empresa está em modo somente leitura
 * Retorna NextResponse de erro ou null se pode escrever
 */
export async function checkWriteAccess(user: AuthUser): Promise<NextResponse | null> {
  if (!user.companyId) {
    return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      plan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  if (isReadOnlyMode(company)) {
    return NextResponse.json(
      {
        error: "Modo somente leitura",
        message: getPlanErrorMessage(company),
        code: "READ_ONLY_MODE",
      },
      { status: 403 }
    );
  }

  return null; // Pode escrever
}

/**
 * Verifica se pode criar novo paciente (limite do plano)
 */
export async function checkPatientLimit(user: AuthUser): Promise<NextResponse | null> {
  if (!user.companyId) {
    return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
  }

  const [company, patientCount] = await Promise.all([
    prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        plan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    }),
    prisma.patient.count({ where: { companyId: user.companyId } }),
  ]);

  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  if (!canCreatePatient(company, patientCount)) {
    return NextResponse.json(
      {
        error: "Limite atingido",
        message: "Você atingiu o limite de pacientes do seu plano. Faça upgrade para cadastrar mais.",
        code: "PATIENT_LIMIT_REACHED",
        currentCount: patientCount,
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Verifica se pode criar novo profissional (limite do plano)
 */
export async function checkProfessionalLimit(user: AuthUser): Promise<NextResponse | null> {
  if (!user.companyId) {
    return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
  }

  const [company, professionalCount] = await Promise.all([
    prisma.company.findUnique({
      where: { id: user.companyId },
      select: { plan: true, subscriptionStatus: true, subscriptionExpiresAt: true },
    }),
    prisma.user.count({
      where: { companyId: user.companyId, role: "ESTHETICIAN" },
    }),
  ]);

  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  if (!canCreateProfessional(company, professionalCount)) {
    return NextResponse.json(
      {
        error: "Limite atingido",
        message: "Você atingiu o limite de profissionais do seu plano.",
        code: "PROFESSIONAL_LIMIT_REACHED",
      },
      { status: 403 }
    );
  }

  return null;
}

