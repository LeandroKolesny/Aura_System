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

    // Criar usuário no Supabase Auth
    const supabase = await createAdminClient();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error("Erro ao criar usuário no Supabase:", authError);
      return NextResponse.json(
        { error: "Erro ao criar conta" },
        { status: 500 }
      );
    }

    // Hash da senha para o Prisma (backup)
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
        id: authData.user.id,
        email,
        name,
        password: hashedPassword,
        role: companyId ? "ADMIN" : "ESTHETICIAN",
        companyId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "Conta criada com sucesso!",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro no registro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

