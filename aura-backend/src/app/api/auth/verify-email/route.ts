import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = schema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 400 }
      );
    }

    const { token } = validation.data;

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() },
      },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Token inválido ou expirado" },
        { status: 400 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "Email já verificado" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return NextResponse.json({ message: "Email verificado com sucesso!" });
  } catch (error) {
    console.error("Erro na verificação de email:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
