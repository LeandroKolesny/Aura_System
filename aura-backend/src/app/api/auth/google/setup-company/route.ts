import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { slugify } from "@/lib/utils";

// POST /api/auth/google/setup-company
// Creates a company for a Google OAuth user who registered without one.
export async function POST(request: NextRequest) {
  try {
    // Auth guard
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Role guard: only ADMIN may set up a company
    if (authUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado: apenas administradores podem criar uma empresa" },
        { status: 403 }
      );
    }

    // Conflict guard: user already linked to a company
    if (authUser.companyId) {
      return NextResponse.json(
        { error: "Usuário já possui uma empresa cadastrada" },
        { status: 409 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const { companyName, state, phone } = body as {
      companyName?: string;
      state?: string;
      phone?: string;
    };

    if (!companyName || typeof companyName !== "string" || companyName.trim().length < 2) {
      return NextResponse.json(
        { error: "Nome da empresa é obrigatório e deve ter pelo menos 2 caracteres" },
        { status: 400 }
      );
    }

    const trimmedName = companyName.trim();

    // --- Slug generation (same pattern as /api/auth/register) ---
    const baseSlug = slugify(trimmedName);
    let finalSlug = baseSlug;

    let existingCompany = await prisma.company.findUnique({
      where: { slug: finalSlug },
    });

    if (existingCompany) {
      // Priority 1: append state suffix (e.g. minha-clinica-SP)
      if (state) {
        const stateSlug = `${baseSlug}-${state.toUpperCase()}`;
        const existingWithState = await prisma.company.findUnique({
          where: { slug: stateSlug },
        });

        if (!existingWithState) {
          finalSlug = stateSlug;
          existingCompany = null;
        }
      }

      // Priority 2: numeric suffix (e.g. minha-clinica-2, minha-clinica-3, ...)
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

    // --- Create company ---
    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 15);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const company = await (prisma.company.create as any)({
      data: {
        name: trimmedName,
        slug: finalSlug,
        state: state?.toUpperCase(),
        plan: "FREE",
        subscriptionStatus: "TRIAL",
        subscriptionExpiresAt: trialExpiresAt,
        onboardingCompleted: false,
        paymentMethods: ["money", "pix", "credit_card", "debit_card"],
        businessHours: {
          monday:    { isOpen: true,  start: "08:00", end: "18:00" },
          tuesday:   { isOpen: true,  start: "08:00", end: "18:00" },
          wednesday: { isOpen: true,  start: "08:00", end: "18:00" },
          thursday:  { isOpen: true,  start: "08:00", end: "18:00" },
          friday:    { isOpen: true,  start: "08:00", end: "18:00" },
          saturday:  { isOpen: true,  start: "09:00", end: "13:00" },
          sunday:    { isOpen: false, start: "00:00", end: "00:00" },
        },
      },
    });

    // --- Link company to user (and optionally update phone) ---
    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        companyId: company.id,
        ...(phone ? { phone } : {}),
      },
    });

    return NextResponse.json({ success: true, company }, { status: 201 });
  } catch (error) {
    console.error("Erro em setup-company:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
