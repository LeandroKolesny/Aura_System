import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const companyCount = await prisma.company.count();
  const userCount = await prisma.user.count();
  const patientCount = await prisma.patient.count();
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, slug: true, createdAt: true },
  });
  console.log("companies:", companyCount, "users:", userCount, "patients:", patientCount);
  console.log(JSON.stringify(companies, null, 2));
  const existingAdmin = await prisma.user.findUnique({ where: { email: "admin@aura.com" } });
  console.log("admin@aura.com exists:", !!existingAdmin);
}

main().finally(() => prisma.$disconnect());
