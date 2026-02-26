import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({
    where: { users: { some: { email: 'basico@aura.system' } } },
    select: { name: true, onboardingCompleted: true }
  });
  console.log('Empresa:', company?.name);
  console.log('onboardingCompleted:', company?.onboardingCompleted);
}

main().finally(() => prisma.$disconnect());
