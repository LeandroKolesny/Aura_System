import { NextResponse } from "next/server";

export async function POST() {
  try {
    const response = NextResponse.json({
      message: "Logout realizado com sucesso!",
    });

    // Limpar cookie de sessão — sameSite: 'none' é necessário para requests cross-origin
    // (frontend e backend estão em domínios diferentes no Vercel)
    response.cookies.set("aura_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Erro no logout:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

