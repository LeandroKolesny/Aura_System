// Aura System - API de Paciente Individual
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { updatePatientSchema } from "@/lib/validations/patient";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Buscar paciente por ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id,
        companyId: user.companyId,
      },
      include: {
        appointments: {
          orderBy: { date: "desc" },
          take: 10,
          include: {
            procedure: { select: { id: true, name: true } },
            professional: { select: { id: true, name: true } },
          },
        },
        photos: {
          orderBy: { date: "desc" },
          take: 20,
        },
        transactions: {
          orderBy: { date: "desc" },
          take: 10,
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ patient });
  } catch (error) {
    console.error("Erro ao buscar paciente:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PUT - Atualizar paciente
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // Verificar permissão
    const allowedRoles = ["OWNER", "ADMIN", "RECEPTIONIST", "ESTHETICIAN"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Verificar se paciente existe e pertence à empresa
    const existingPatient = await prisma.patient.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!existingPatient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const validation = updatePatientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Se email está sendo alterado, verificar duplicidade
    if (validation.data.email && validation.data.email !== existingPatient.email) {
      const duplicateEmail = await prisma.patient.findFirst({
        where: {
          email: validation.data.email,
          companyId: user.companyId,
          id: { not: id },
        },
      });

      if (duplicateEmail) {
        return NextResponse.json(
          { error: "Já existe um paciente com este e-mail" },
          { status: 409 }
        );
      }
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        ...validation.data,
        birthDate: validation.data.birthDate ? new Date(validation.data.birthDate) : undefined,
      },
    });

    // Log de atividade
    await prisma.activity.create({
      data: {
        type: "PATIENT_UPDATED",
        title: `Paciente "${patient.name}" atualizado`,
        userId: user.id,
        metadata: { patientId: patient.id, changes: Object.keys(validation.data) },
      },
    });

    return NextResponse.json({ patient });
  } catch (error) {
    console.error("Erro ao atualizar paciente:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE - Desativar paciente (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // Apenas ADMIN pode deletar
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }

    // Soft delete - apenas marca como inativo
    await prisma.patient.update({
      where: { id },
      data: { status: "INACTIVE" },
    });

    return NextResponse.json({ success: true, message: "Paciente desativado" });
  } catch (error) {
    console.error("Erro ao deletar paciente:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

