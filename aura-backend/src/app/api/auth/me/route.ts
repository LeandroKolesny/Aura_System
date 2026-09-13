import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isActive: true,
        phone: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            plan: true,
            state: true,
            subscriptionStatus: true,
            subscriptionExpiresAt: true,
            onboardingCompleted: true,
            businessHours: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Para pacientes, resolver o patientId correspondente (mesma lógica de
    // POST /api/auth/login). Sem isso, o frontend perde user.patientId a cada
    // restauração de sessão via cookie (F5 na página) — quebrando a UI que usa
    // esse campo para saber quais agendamentos são do próprio paciente (ver
    // currentPatientId em pages/Schedule.tsx e getNextAppointment em
    // apps/PatientPortalApp.tsx).
    let patientId: string | null | undefined = undefined;
    if (user.role === "PATIENT") {
      const patientRecord = await prisma.patient.findFirst({
        where: { email: user.email, companyId: user.company?.id },
        select: { id: true },
      });
      patientId = patientRecord?.id || null;
    }

    // Include the session token in the response so the frontend can store it
    // for subsequent Bearer auth requests. The token is read from the httpOnly
    // cookie (never from a URL parameter) — this is the secure retrieval path.
    const sessionToken = request.cookies.get("aura_session")?.value ?? null;

    return NextResponse.json({
      user: patientId !== undefined ? { ...user, patientId } : user,
      token: sessionToken,
    });
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

