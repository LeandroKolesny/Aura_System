// Guard para rotas exclusivas do OWNER (King)
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "./auth";

export async function requireOwner(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
      user: null,
    };
  }

  if (user.role !== "OWNER") {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Acesso restrito ao Owner" }, { status: 403 }),
      user: null,
    };
  }

  return {
    authorized: true,
    response: null,
    user,
  };
}
