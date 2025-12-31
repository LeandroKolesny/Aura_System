import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configuração otimizada para Vercel/Serverless
// - pool timeout maior para evitar erros de conexão
// - connection limit otimizado para serverless
const prismaClientOptions = {
  log: process.env.NODE_ENV === "development"
    ? ["error", "warn"] as const  // Removido "query" para menos overhead
    : ["error"] as const,
  // Configurações de datasource são passadas via URL
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions);

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

