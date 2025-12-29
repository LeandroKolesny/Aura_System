// Aura System - Authentication Helper
// Sistema de autenticação seguro com validação de tokens
import { NextRequest, NextResponse } from "next/server";
import prisma from "./prisma";
import { hasPermission, Resource, Action, canAccessCompany } from "./rbac";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  companyId: string | null;
}

// Cache simples para evitar múltiplas queries no mesmo request
const userCache = new Map<string, { user: AuthUser; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minuto

/**
 * Extrai e valida o usuário autenticado da requisição
 * Suporta token via cookie ou header Authorization
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Tentar obter token do cookie
    let token = request.cookies.get("aura_session")?.value;

    // Se não houver cookie, tentar header Authorization
    if (!token) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return null;
    }

    // Verificar cache
    const cached = userCache.get(token);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.user;
    }

    // Decodificar token (formato: base64 de "userId:timestamp")
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [userId, timestamp] = decoded.split(":");

    if (!userId) {
      return null;
    }

    // Validar timestamp (token expira em 24 horas)
    if (timestamp) {
      const tokenTime = parseInt(timestamp);
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas
      if (Date.now() - tokenTime > maxAge) {
        userCache.delete(token);
        return null;
      }
    }

    // Buscar usuário no banco
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };

    // Salvar no cache
    userCache.set(token, { user: authUser, timestamp: Date.now() });

    return authUser;
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
}

/**
 * Verifica se o usuário tem permissão de admin
 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === "ADMIN" || user.role === "OWNER";
}

/**
 * Verifica se o usuário tem acesso à empresa
 */
export function hasCompanyAccess(user: AuthUser, companyId: string): boolean {
  return canAccessCompany(user, companyId);
}

/**
 * Middleware de autorização - verifica permissão e retorna erro se não autorizado
 */
export function requirePermission(
  user: AuthUser | null,
  resource: Resource,
  action: Action
): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!hasPermission(user, resource, action)) {
    return NextResponse.json(
      { error: "Sem permissão para esta ação" },
      { status: 403 }
    );
  }

  return null; // Permissão concedida
}

/**
 * Gera um token de sessão para o usuário
 */
export function generateSessionToken(userId: string): string {
  const timestamp = Date.now();
  return Buffer.from(`${userId}:${timestamp}`).toString("base64");
}

/**
 * Limpa o cache de um usuário (usar após logout ou atualização de permissões)
 */
export function clearUserCache(token?: string): void {
  if (token) {
    userCache.delete(token);
  } else {
    userCache.clear();
  }
}

