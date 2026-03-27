import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { slugify } from "@/lib/utils";
import { sendVerificationEmail, TERMS_VERSION, TERMS_TEXT_HASH } from "@/lib/email";
import { checkRateLimit, getClientIP } from "@/lib/rateLimiter";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  companyName: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres").optional(),
  state: z.string().length(2, "Estado deve ter 2 caracteres (ex: SP, RJ)").optional(),
  acceptedTerms: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: máx 5 registros por IP a cada 15 minutos
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit(clientIP, "register");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas de cadastro. Aguarde alguns minutos." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password, companyName, state, acceptedTerms, marketingConsent } = validation.data;

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

    // Gerar token de verificação de email
    const verificationToken = randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24);

    // Criar usuário no Prisma
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: companyId ? "ADMIN" : "ESTHETICIAN",
        companyId,
        isActive: true,
        verificationToken,
        verificationTokenExpiry,
        acceptedTermsAt: acceptedTerms ? new Date() : null,
        acceptedTermsVersion: acceptedTerms ? TERMS_VERSION : null,
        acceptedTermsIp: acceptedTerms ? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown") : null,
        acceptedTermsAgent: acceptedTerms ? (request.headers.get("user-agent") ?? "unknown") : null,
        acceptedTermsHash: acceptedTerms ? TERMS_TEXT_HASH : null,
        marketingConsent: marketingConsent ?? false,
        marketingConsentAt: marketingConsent ? new Date() : null,
        marketingConsentIp: marketingConsent ? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown") : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Enviar email de verificação (fire-and-forget — não bloqueia registro)
    sendVerificationEmail(email, name, verificationToken).catch((err) =>
      console.error("Erro ao enviar email de verificação:", err)
    );

    console.log("✅ Usuário criado com sucesso:", user.email);

    return NextResponse.json(
      {
        message: "Conta criada com sucesso! Verifique seu email para ativar o acesso.",
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

