import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { checkRateLimit, resetRateLimit, getClientIP } from "@/lib/rateLimiter";
import { logLogin, logLoginFailure } from "@/lib/auditLog";
import { generateJWT } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export async function POST(request: NextRequest) {
  try {
    // RATE LIMITING - Proteção contra força bruta (distribuído via Upstash Redis)
    const clientIP = getClientIP(request);
    const rateLimitResult = await checkRateLimit(clientIP, "login");

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Muitas tentativas de login",
          message: `Tente novamente em ${Math.ceil(rateLimitResult.retryAfter! / 60)} minutos`,
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfter),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // Buscar usuário no banco de dados
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        avatar: true,
        role: true,
        isActive: true,
        tokenVersion: true,
        emailVerified: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            subscriptionStatus: true,
            subscriptionExpiresAt: true,
            businessHours: true,
            onboardingCompleted: true,
          },
        },
      },
    });

    // Sempre executar bcrypt.compare para equalizar timing (previne user enumeration via timing attack)
    // Hash dummy usado quando o usuário não existe — custo idêntico ao hash real
    const DUMMY_HASH = "$2b$12$invalidhashfortimingequaliza";
    const isValidPassword = await bcrypt.compare(password, user?.password || DUMMY_HASH);

    if (!user) {
      // Log de tentativa falha
      logLoginFailure(email, "Usuário não encontrado", request);
      return NextResponse.json(
        { error: "Email ou senha incorretos" },
        { status: 401 }
      );
    }

    if (!isValidPassword) {
      // Log de tentativa falha
      logLoginFailure(email, "Senha incorreta", request);
      return NextResponse.json(
        { error: "Email ou senha incorretos" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      logLoginFailure(email, "Conta desativada", request);
      return NextResponse.json(
        { error: "Conta desativada. Entre em contato com o suporte." },
        { status: 403 }
      );
    }

    // Verificar se email foi confirmado (exceto OWNER e PATIENT — pacientes são criados via portal da clínica)
    if (user.role !== "OWNER" && user.role !== "PATIENT" && !user.emailVerified) {
      logLoginFailure(email, "Email não verificado", request);
      return NextResponse.json(
        {
          error: "Email não verificado",
          message: "Verifique seu email antes de entrar. Não recebeu? Solicite o reenvio.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    // Verificar modo de manutencao (exceto para OWNER)
    if (user.role !== "OWNER") {
      const systemSettings = await prisma.systemSettings.findUnique({
        where: { id: "global" },
      });

      if (systemSettings?.maintenanceMode) {
        logLoginFailure(email, "Sistema em manutencao", request);
        return NextResponse.json(
          {
            error: "Sistema em manutencao",
            maintenance: true,
            message: systemSettings.maintenanceMessage || "Sistema em manutencao. Retorne mais tarde."
          },
          { status: 503 }
        );
      }
    }

    // Login bem-sucedido - resetar rate limit (fire-and-forget, não bloqueia resposta)
    resetRateLimit(clientIP, "login").catch(() => {});

    // Log de auditoria - Login bem-sucedido
    logLogin(user.id, email, request);

    // Gerar token JWT assinado criptograficamente
    const token = generateJWT({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.company?.id || null,
      tokenVersion: user.tokenVersion,
    });

    // Remover senha da resposta
    const { password: _, ...userWithoutPassword } = user;

    // Para pacientes, buscar o patientId correspondente
    let patientId = null;
    if (user.role === "PATIENT") {
      const patientRecord = await prisma.patient.findFirst({
        where: {
          email: user.email,
          companyId: user.company?.id,
        },
        select: { id: true },
      });
      patientId = patientRecord?.id || null;
    }

    const response = NextResponse.json({
      message: "Login realizado com sucesso!",
      user: {
        ...userWithoutPassword,
        patientId, // Incluir patientId para pacientes
      },
      token,
    });

    // Setar cookie de sessão — sameSite: 'none' é necessário para requests cross-origin
    // (frontend aura-system-mu.vercel.app e backend aura-backend-api.vercel.app são domínios diferentes)
    response.cookies.set("aura_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Erro no login:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

