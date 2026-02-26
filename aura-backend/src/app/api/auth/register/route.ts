import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { slugify } from "@/lib/utils";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  companyName: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres").optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password, companyName } = validation.data;

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email já está cadastrado" },
        { status: 409 }
      );
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar empresa se fornecido
    let companyId: string | undefined;
    if (companyName) {
      const company = await prisma.company.create({
        data: {
          name: companyName,
          slug: slugify(companyName) + "-" + Date.now().toString(36),
        },
      });
      companyId = company.id;
    }

    // Criar usuário no Prisma
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: companyId ? "ADMIN" : "ESTHETICIAN",
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    console.log("✅ Usuário criado com sucesso:", user.email);

    return NextResponse.json(
      {
        message: "Conta criada com sucesso!",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Erro no registro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

