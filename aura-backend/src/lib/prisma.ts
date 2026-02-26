import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configuração otimizada para Vercel/Serverless
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["error", "warn"]
      : ["error"],
  });

// Em development, reutilizar conexão para evitar hot-reload criar muitas conexões
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Função helper para queries com timeout
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

// Desconectar em serverless após request (Vercel)
export async function disconnectPrisma() {
  if (process.env.NODE_ENV === "production") {
    await prisma.$disconnect();
  }
}

export default prisma;

