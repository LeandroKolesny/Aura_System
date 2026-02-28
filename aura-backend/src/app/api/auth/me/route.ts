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

    // Include the session token in the response so the frontend can store it
    // for subsequent Bearer auth requests. The token is read from the httpOnly
    // cookie (never from a URL parameter) — this is the secure retrieval path.
    const sessionToken = request.cookies.get("aura_session")?.value ?? null;

    return NextResponse.json({ user, token: sessionToken });
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

