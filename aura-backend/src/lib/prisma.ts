import { PrismaClient, Prisma } from "@prisma/client";

// Campos Decimal (price, amount, commissionRate, currentStock etc.) voltam do
// Prisma como instâncias de Prisma.Decimal, que serializam em JSON.stringify
// como STRING (ex: "45.00"). Sem essa conversão, todo `NextResponse.json()`
// devolve esses valores como texto pro frontend — e qualquer soma/comparação
// numérica feita com eles vira concatenação/comparação de string (foi a causa
// raiz do bug do card "Comissão Média" mostrando 151180%). Converter aqui,
// uma vez, evita ter que lembrar de fazer Number(...) em cada rota/consumidor.
export function convertDecimalsToNumbers<T>(value: T): T {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(convertDecimalsToNumbers) as unknown as T;
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      (value as Record<string, unknown>)[key] = convertDecimalsToNumbers(
        (value as Record<string, unknown>)[key]
      );
    }
    return value;
  }
  return value;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["error", "warn"]
      : ["error"],
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ query, args }) {
          const result = await query(args);
          return convertDecimalsToNumbers(result);
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

// Configuração otimizada para Vercel/Serverless
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

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

