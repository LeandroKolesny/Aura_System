import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const incomes = await prisma.transaction.findMany({
    where: { type: 'INCOME' },
    orderBy: { date: 'desc' },
    include: {
      appointment: {
        include: {
          procedure: true
        }
      }
    }
  });

  console.log('\n📊 TODAS as transações INCOME:\n');
  console.log('Descrição'.padEnd(45) + '| AppointmentId | Procedure.cost');
  console.log('-'.repeat(100));

  for (const t of incomes) {
    const desc = t.description.slice(0, 42).padEnd(45);
    const appId = t.appointmentId ? t.appointmentId.slice(0, 8) + '...' : 'NULL';
    const procCost = t.appointment?.procedure?.cost
      ? `R$ ${Number(t.appointment.procedure.cost).toFixed(2)}`
      : 'N/A';
    console.log(`${desc}| ${appId.padEnd(14)}| ${procCost}`);
  }

  await prisma.$disconnect();
}

check();
