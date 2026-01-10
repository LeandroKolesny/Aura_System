import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    // Se não for OWNER, só pode ver a própria empresa
    if (authUser.role !== "OWNER") {
      const company = await prisma.company.findUnique({
        where: { id: authUser.companyId! },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          address: true,
          city: true,
          state: true,
          cnpj: true,
          presentation: true,
          phones: true,
          plan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          businessHours: true,
          onlineBookingConfig: true,
          paymentMethods: true,
          targetFemale: true,
          targetMale: true,
          targetKids: true,
          website: true,
          facebook: true,
          instagram: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Normalizar e deduplicar paymentMethods (converter labels para IDs)
      const labelToId: Record<string, string> = {
        'Dinheiro': 'money', 'dinheiro': 'money',
        'Pix': 'pix', 'PIX': 'pix',
        'Cartão de Crédito': 'credit_card', 'cartão de crédito': 'credit_card',
        'Cartão de Débito': 'debit_card', 'cartão de débito': 'debit_card',
        'Cheque': 'check', 'cheque': 'check',
        'Transferência Bancária': 'bank_transfer', 'transferência bancária': 'bank_transfer',
        'Depósito': 'deposit', 'depósito': 'deposit',
      };
      const normalizePaymentMethods = (methods: string[]) => {
        const normalized = methods.map(m => labelToId[m] || m);
        return [...new Set(normalized)];
      };
      const cleanedCompany = company ? {
        ...company,
        paymentMethods: company.paymentMethods ? normalizePaymentMethods(company.paymentMethods) : [],
      } : null;
      return NextResponse.json({ companies: cleanedCompany ? [cleanedCompany] : [] });
    }

    // OWNER pode ver todas as empresas
    const companies = await prisma.company.findMany({
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        address: true,
        city: true,
        state: true,
        cnpj: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            patients: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("Erro ao listar empresas:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

