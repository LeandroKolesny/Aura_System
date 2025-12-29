import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId") || authUser.companyId;
    const role = searchParams.get("role");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {};
    
    // Se não for OWNER, só pode ver da própria empresa
    if (authUser.role !== "OWNER") {
      where.companyId = authUser.companyId;
    } else if (companyId) {
      where.companyId = companyId;
    }

    if (role) {
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        role: true,
        title: true,
        isActive: true,
        contractType: true,
        remunerationType: true,
        commissionRate: true,
        fixedSalary: true,
        businessHours: true,
        companyId: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST - Criar novo profissional
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!authUser.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // GUARD: Verificar se plano permite escrita
    const writeError = await checkWriteAccess(authUser);
    if (writeError) return writeError;

    // Apenas ADMIN e OWNER podem criar profissionais
    if (!["ADMIN", "OWNER"].includes(authUser.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      role = "ESTHETICIAN",
      title,
      contractType,
      remunerationType,
      commissionRate,
      fixedSalary,
      businessHours,
      password
    } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Nome e email são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email já cadastrado" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role,
        title,
        contractType,
        remunerationType,
        commissionRate: commissionRate ? parseFloat(commissionRate) : null,
        fixedSalary: fixedSalary ? parseFloat(fixedSalary) : null,
        businessHours,
        password: password || null, // Em produção, usar hash
        companyId: authUser.companyId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        title: true,
        isActive: true,
        contractType: true,
        remunerationType: true,
        commissionRate: true,
        fixedSalary: true,
        businessHours: true,
        companyId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
