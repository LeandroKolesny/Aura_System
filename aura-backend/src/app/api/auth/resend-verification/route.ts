import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email("Email inválido"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = schema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true },
    });

    // Resposta genérica para não revelar se o email existe
    if (!user || user.emailVerified) {
      return NextResponse.json({
        message: "Se o email estiver cadastrado e não verificado, você receberá um novo link.",
      });
    }

    const token = randomBytes(32).toString("hex");
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: token,
        verificationTokenExpiry: expiry,
      },
    });

    // Fire-and-forget — não bloqueia a resposta se RESEND_API_KEY não estiver configurada
    sendVerificationEmail(email, user.name || "Usuário", token).catch((err) =>
      console.error("Erro ao reenviar verificação:", err)
    );

    return NextResponse.json({
      message: "Se o email estiver cadastrado e não verificado, você receberá um novo link.",
    });
  } catch (error) {
    console.error("Erro ao reenviar verificação:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
