// Aura System - API Pública para buscar empresa pelo slug
// Endpoint sem autenticação para página de booking
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET - Buscar dados públicos da empresa pelo slug
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: "Slug não informado" },
        { status: 400 }
      );
    }

    // Buscar empresa pelo slug
    const company = await prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        address: true,
        city: true,
        state: true,
        presentation: true,
        phones: true,
        businessHours: true,
        onlineBookingConfig: true,
        layoutConfig: true,
        targetFemale: true,
        targetMale: true,
        targetKids: true,
        website: true,
        instagram: true,
        facebook: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Empresa não encontrada" },
        { status: 404 }
      );
    }

    // Buscar procedimentos ativos da empresa
    const procedures = await prisma.procedure.findMany({
      where: {
        companyId: company.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        price: true,
        durationMinutes: true,
      },
      orderBy: { name: "asc" },
    });

    // Buscar profissionais ativos (exceto OWNER e PATIENT)
    const professionals = await prisma.user.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        role: {
          in: ["ADMIN", "ESTHETICIAN"],
        },
      },
      select: {
        id: true,
        name: true,
        title: true,
        avatar: true,
      },
      orderBy: { name: "asc" },
    });

    // Buscar agendamentos futuros (para verificar disponibilidade)
    const now = new Date();
    const appointments = await prisma.appointment.findMany({
      where: {
        companyId: company.id,
        date: { gte: now },
        status: {
          in: ["SCHEDULED", "CONFIRMED", "PENDING_APPROVAL"],
        },
      },
      select: {
        id: true,
        date: true,
        durationMinutes: true,
        professionalId: true,
        roomId: true,
        status: true,
      },
    });

    // Buscar regras de indisponibilidade
    const unavailabilityRules = await prisma.unavailabilityRule.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        description: true,
        startTime: true,
        endTime: true,
        dates: true,
        professionalIds: true,
      },
    });

    return NextResponse.json({
      success: true,
      company,
      procedures: procedures.map((p) => ({
        ...p,
        price: Number(p.price),
      })),
      professionals,
      appointments: appointments.map((a) => ({
        ...a,
        status: a.status.toLowerCase(),
      })),
      unavailabilityRules,
    });
  } catch (error) {
    console.error("Erro ao buscar empresa pública:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
