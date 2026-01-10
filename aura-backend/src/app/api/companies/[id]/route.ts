// Aura System - API de Update de Empresa
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Buscar empresa por ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Verificar permissão (OWNER pode ver qualquer empresa, outros só a própria)
    if (authUser.role !== "OWNER" && authUser.companyId !== id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const company = await prisma.company.findUnique({
      where: { id },
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
        layoutConfig: true,
        paymentMethods: true,
        targetFemale: true,
        targetMale: true,
        targetKids: true,
        website: true,
        facebook: true,
        instagram: true,
        onboardingCompleted: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

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
    const cleanedCompany = {
      ...company,
      paymentMethods: company.paymentMethods ? normalizePaymentMethods(company.paymentMethods) : [],
    };

    return NextResponse.json({ company: cleanedCompany });
  } catch (error) {
    console.error("Erro ao buscar empresa:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PUT - Atualizar empresa
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Verificar permissão (OWNER ou ADMIN da própria empresa)
    if (authUser.role !== "OWNER" && authUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    if (authUser.role !== "OWNER" && authUser.companyId !== id) {
      return NextResponse.json({ error: "Sem permissão para esta empresa" }, { status: 403 });
    }

    // Verificar se empresa existe
    const existingCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!existingCompany) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

    const body = await request.json();

    // Campos permitidos para atualização
    const allowedFields = [
      "name",
      "logo",
      "address",
      "city",
      "state",
      "cnpj",
      "presentation",
      "phones",
      "businessHours",
      "onlineBookingConfig",
      "layoutConfig",
      "paymentMethods",
      "targetFemale",
      "targetMale",
      "targetKids",
      "website",
      "facebook",
      "instagram",
      "onboardingCompleted",
    ];

    // Filtrar apenas campos permitidos
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Tratar campos de targetAudience
        if (field === "targetFemale" || field === "targetMale" || field === "targetKids") {
          updateData[field] = Boolean(body[field]);
        }
        // Tratar campos de socialMedia (mapear para campos do banco)
        else if (body.socialMedia && (field === "website" || field === "facebook" || field === "instagram")) {
          // Será tratado abaixo
        }
        // Deduplicar paymentMethods se for um array
        else if (field === "paymentMethods" && Array.isArray(body[field])) {
          updateData[field] = [...new Set(body[field])];
        }
        else {
          updateData[field] = body[field];
        }
      }
    }

    // Mapear targetAudience para campos do banco
    if (body.targetAudience) {
      updateData.targetFemale = Boolean(body.targetAudience.female);
      updateData.targetMale = Boolean(body.targetAudience.male);
      updateData.targetKids = Boolean(body.targetAudience.kids);
    }

    // Mapear socialMedia para campos do banco
    if (body.socialMedia) {
      if (body.socialMedia.website !== undefined) updateData.website = body.socialMedia.website;
      if (body.socialMedia.facebook !== undefined) updateData.facebook = body.socialMedia.facebook;
      if (body.socialMedia.instagram !== undefined) updateData.instagram = body.socialMedia.instagram;
    }

    // Atualizar empresa
    const updatedCompany = await prisma.company.update({
      where: { id },
      data: updateData,
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
        layoutConfig: true,
        paymentMethods: true,
        targetFemale: true,
        targetMale: true,
        targetKids: true,
        website: true,
        facebook: true,
        instagram: true,
        onboardingCompleted: true,
      },
    });

    console.log(`✅ Empresa ${id} atualizada:`, Object.keys(updateData));

    return NextResponse.json({
      success: true,
      company: updatedCompany,
    });
  } catch (error) {
    console.error("Erro ao atualizar empresa:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
