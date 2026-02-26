// Aura System - Authentication Helper
// Sistema de autenticação seguro com JWT
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "./prisma";
import { hasPermission, Resource, Action, canAccessCompany } from "./rbac";

// JWT Secret - deve ser configurado em variáveis de ambiente
const JWT_SECRET = process.env.JWT_SECRET || "aura-system-jwt-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d"; // Token expira em 7 dias

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  companyId: string | null;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  companyId: string | null;
  iat?: number;
  exp?: number;
}

// Cache simples para evitar múltiplas queries no mesmo request
const userCache = new Map<string, { user: AuthUser; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minuto

/**
 * Gera um token JWT assinado para o usuário
 */
export function generateJWT(user: { id: string; email: string; role: string; companyId: string | null }): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifica e decodifica um token JWT
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    // Token inválido ou expirado
    return null;
  }
}

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

    // Verificar e decodificar JWT
    const payload = verifyJWT(token);

    if (!payload || !payload.userId) {
      userCache.delete(token);
      return null;
    }

    // Buscar usuário no banco para garantir dados atualizados
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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
      userCache.delete(token);
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
 * Gera um token de sessão para o usuário (usa JWT internamente)
 * @deprecated Use generateJWT diretamente
 */
export function generateSessionToken(userId: string): string {
  // Mantido para compatibilidade - usa JWT agora
  return generateJWT({ id: userId, email: "", role: "", companyId: null });
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

/**
 * Verifica autenticacao e retorna resultado estruturado
 * Usado por APIs que precisam verificar auth de forma simples
 */
export async function verifyAuth(request: NextRequest): Promise<{ success: boolean; user: AuthUser | null }> {
  const user = await getAuthUser(request);
  return {
    success: user !== null,
    user,
  };
}

