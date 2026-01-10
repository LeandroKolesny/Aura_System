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
  state: z.string().length(2, "Estado deve ter 2 caracteres (ex: SP, RJ)").optional(),
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

    const { name, email, password, companyName, state } = validation.data;

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
      // Data de expiração do trial (15 dias)
      const trialExpiresAt = new Date();
      trialExpiresAt.setDate(trialExpiresAt.getDate() + 15);

      // Gerar slug único baseado no nome da empresa
      const baseSlug = slugify(companyName);
      let finalSlug = baseSlug;

      // Verificar se já existe uma empresa com esse slug
      let existingCompany = await prisma.company.findUnique({
        where: { slug: finalSlug },
      });

      // Se existir conflito, tentar resolver
      if (existingCompany) {
        // Prioridade 1: Usar estado como sufixo (ex: leandro-SP, leandro-RS)
        if (state) {
          const stateSlug = `${baseSlug}-${state.toUpperCase()}`;
          const existingWithState = await prisma.company.findUnique({
            where: { slug: stateSlug },
          });

          if (!existingWithState) {
            finalSlug = stateSlug;
            existingCompany = null; // Resolvido com estado
          }
        }

        // Prioridade 2: Se não tem estado ou slug com estado já existe, usar sufixo numérico
        if (existingCompany) {
          let counter = 1;
          while (existingCompany) {
            counter++;
            finalSlug = `${baseSlug}-${counter}`;
            existingCompany = await prisma.company.findUnique({
              where: { slug: finalSlug },
            });
          }
        }
      }

      const company = await prisma.company.create({
        data: {
          name: companyName,
          slug: finalSlug,
          state: state?.toUpperCase(),
          plan: "FREE",
          subscriptionStatus: "TRIAL",
          subscriptionExpiresAt: trialExpiresAt,
          onboardingCompleted: false,
          paymentMethods: ["money", "pix", "credit_card", "debit_card"],
          businessHours: {
            monday: { isOpen: true, start: "08:00", end: "18:00" },
            tuesday: { isOpen: true, start: "08:00", end: "18:00" },
            wednesday: { isOpen: true, start: "08:00", end: "18:00" },
            thursday: { isOpen: true, start: "08:00", end: "18:00" },
            friday: { isOpen: true, start: "08:00", end: "18:00" },
            saturday: { isOpen: true, start: "09:00", end: "13:00" },
            sunday: { isOpen: false, start: "00:00", end: "00:00" },
          },
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

