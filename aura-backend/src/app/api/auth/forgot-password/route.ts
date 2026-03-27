import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

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
      select: { id: true, name: true, isActive: true },
    });

    // Resposta genérica para não revelar se o email existe
    const genericMessage = "Se o email estiver cadastrado, você receberá as instruções de recuperação.";

    if (!user || !user.isActive) {
      return NextResponse.json({ message: genericMessage });
    }

    const token = randomBytes(32).toString("hex");
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 2); // 2 horas

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpiry: expiry,
      },
    });

    // Fire-and-forget — não bloqueia a resposta se RESEND_API_KEY não estiver configurada
    sendPasswordResetEmail(email, user.name || "Usuário", token).catch((err) =>
      console.error("Erro ao enviar email de reset:", err)
    );

    return NextResponse.json({ message: genericMessage });
  } catch (error) {
    console.error("Erro no forgot-password:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
