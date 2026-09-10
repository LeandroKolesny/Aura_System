// Aura System - API de Update de Empresa
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { cpf, cnpj as cnpjValidator } from "cpf-cnpj-validator";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { businessHoursSchema } from "@/lib/validations/businessHours";
import {
  onlineBookingConfigSchema,
  publicLayoutConfigSchema,
} from "@/lib/validations/onlineBooking";

// Logo é enviado pelo frontend (handleLogoUpload em Settings.tsx) como data URL
// base64 da imagem — não como URL hospedada. O schema antigo exigia
// `.url().max(500)`, o que rejeitava qualquer upload real (400 "Dados inválidos").
// Aceita agora URL http(s) OU data URL de imagem, mesmo padrão de photos/route.ts.
const DATA_URL_IMAGE_REGEX = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/;
const isValidLogo = (v: string): boolean =>
  v === "" ||
  v.startsWith("https://") ||
  v.startsWith("http://") ||
  DATA_URL_IMAGE_REGEX.test(v);

// CNPJ/CPF: até então o schema aceitava qualquer string (`z.string().max(20)`) —
// a validação de dígito verificador só existia no frontend (utils/maskUtils.ts),
// então uma chamada direta à API gravava documento inválido. O campo aceita CPF
// (pessoa física) OU CNPJ, espelhando `validateCpfCnpj` do frontend. `null`/vazio
// continua válido (documento é opcional).
const isValidCpfOrCnpj = (v: string): boolean => {
  const trimmed = v.trim();
  if (trimmed === "") return true;
  // Remove só a máscara oficial (. - /) e espaços — NÃO todos os não-dígitos,
  // porque o CNPJ no novo formato da RFB (NT 49/2024) pode conter letras.
  const bare = trimmed.replace(/[.\-/\s]/g, "");
  if (bare.length === 11) return cpf.isValid(v);
  if (bare.length === 14) return cnpjValidator.isValid(v);
  return false;
};

const updateCompanySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logo: z
    .string()
    .max(8_000_000)
    .refine(isValidLogo, { message: "Logo deve ser uma URL http(s) ou data URL de imagem" })
    .nullable()
    .optional(),
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().length(2).nullable().optional(),
  cnpj: z
    .string()
    .max(20)
    .refine(isValidCpfOrCnpj, { message: "CNPJ/CPF inválido" })
    .nullable()
    .optional(),
  presentation: z.string().max(1000).nullable().optional(),
  phones: z.array(z.string().max(20)).max(5).optional(),
  website: z.string().url().max(200).nullable().optional(),
  facebook: z.string().url().max(200).nullable().optional(),
  instagram: z.string().url().max(200).nullable().optional(),
  targetFemale: z.boolean().optional(),
  targetMale: z.boolean().optional(),
  targetKids: z.boolean().optional(),
  onboardingCompleted: z.boolean().optional(),
  paymentMethods: z.array(z.string().max(30)).max(10).optional(),
  // Horário de funcionamento: os 7 dias, formato HH:mm e abertura < fechamento
  // por dia aberto (schema compartilhado em @/lib/validations/businessHours).
  businessHours: businessHoursSchema.optional(),
  // Regras de horário da Agenda Online (slotInterval, minAdvanceTime,
  // maxBookingPeriod, cancellationNotice, cancellationPolicy) e aparência da
  // página pública (cores hex, fontFamily, baseFontSize). Schemas estruturados
  // em @/lib/validations/onlineBooking — antes eram z.record(z.unknown()) (sem
  // validação nenhuma de conteúdo).
  onlineBookingConfig: onlineBookingConfigSchema.optional(),
  layoutConfig: publicLayoutConfigSchema.optional(),
  // Alias para socialMedia enviado pelo frontend
  socialMedia: z.object({
    website: z.string().url().max(200).nullable().optional(),
    facebook: z.string().url().max(200).nullable().optional(),
    instagram: z.string().url().max(200).nullable().optional(),
  }).optional(),
  targetAudience: z.object({
    female: z.boolean().optional(),
    male: z.boolean().optional(),
    kids: z.boolean().optional(),
  }).optional(),
  // Timestamp da última campanha de retenção/upsell (Customer Success SaaS) enviada
  // para esta empresa. Existe no Prisma (Company.lastMarketingSentAt DateTime?) e é
  // o que SaaSMarketing.handleSendWhatsApp persiste via updateCompany. Sem este campo
  // aqui o schema .strict() rejeitava o PUT com 400 e a mensagem nunca era enviada.
  lastMarketingSentAt: z.string().datetime().nullable().optional(),
}).strict();

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

    const rawBody = await request.json();
    const validation = updateCompanySchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Construir updateData tipado a partir dos campos validados pelo Zod
    const updateData: Prisma.CompanyUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.logo !== undefined && { logo: data.logo }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.cnpj !== undefined && { cnpj: data.cnpj }),
      ...(data.presentation !== undefined && { presentation: data.presentation }),
      ...(data.phones !== undefined && { phones: data.phones }),
      ...(data.businessHours !== undefined && { businessHours: data.businessHours }),
      // NOTA: o PUT substitui `onlineBookingConfig`/`layoutConfig` por completo
      // (replace total do JSON) — NÃO há merge com o valor salvo. O frontend
      // (AccessLink.tsx) reenvia o objeto inteiro a cada save. Comportamento
      // caracterizado por teste em companies-id.test.ts.
      ...(data.onlineBookingConfig !== undefined && { onlineBookingConfig: data.onlineBookingConfig as unknown as Prisma.InputJsonValue }),
      ...(data.layoutConfig !== undefined && { layoutConfig: data.layoutConfig as unknown as Prisma.InputJsonValue }),
      ...(data.paymentMethods !== undefined && { paymentMethods: [...new Set(data.paymentMethods)] }),
      ...(data.targetFemale !== undefined && { targetFemale: data.targetFemale }),
      ...(data.targetMale !== undefined && { targetMale: data.targetMale }),
      ...(data.targetKids !== undefined && { targetKids: data.targetKids }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.facebook !== undefined && { facebook: data.facebook }),
      ...(data.instagram !== undefined && { instagram: data.instagram }),
      ...(data.onboardingCompleted !== undefined && { onboardingCompleted: data.onboardingCompleted }),
      ...(data.lastMarketingSentAt !== undefined && {
        lastMarketingSentAt: data.lastMarketingSentAt ? new Date(data.lastMarketingSentAt) : null,
      }),
    };

    // Mapear targetAudience (alias do frontend)
    if (data.targetAudience) {
      if (data.targetAudience.female !== undefined) updateData.targetFemale = data.targetAudience.female;
      if (data.targetAudience.male !== undefined) updateData.targetMale = data.targetAudience.male;
      if (data.targetAudience.kids !== undefined) updateData.targetKids = data.targetAudience.kids;
    }

    // Mapear socialMedia (alias do frontend)
    if (data.socialMedia) {
      if (data.socialMedia.website !== undefined) updateData.website = data.socialMedia.website;
      if (data.socialMedia.facebook !== undefined) updateData.facebook = data.socialMedia.facebook;
      if (data.socialMedia.instagram !== undefined) updateData.instagram = data.socialMedia.instagram;
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
