import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  // Verificar transações com appointmentId
  const transactions = await prisma.transaction.findMany({
    where: { appointmentId: { not: null } },
    take: 10,
    orderBy: { date: 'desc' },
    include: {
      appointment: {
        include: {
          procedure: true
        }
      }
    }
  });

  console.log('\n📊 Transações com appointmentId:\n');
  for (const t of transactions) {
    const procCost = t.appointment?.procedure?.cost;
    console.log(`${t.type.padEnd(8)} | R$ ${Number(t.amount).toFixed(2).padStart(10)} | AppID: ${t.appointmentId?.slice(0,8)}... | Procedure.cost: ${procCost ? `R$ ${Number(procCost).toFixed(2)}` : 'null'}`);
  }

  // Verificar se há pares INCOME/EXPENSE por appointmentId
  console.log('\n\n📊 Agrupamento por appointmentId:\n');
  const grouped: Record<string, any[]> = {};
  transactions.forEach(t => {
    if (t.appointmentId) {
      if (!grouped[t.appointmentId]) grouped[t.appointmentId] = [];
      grouped[t.appointmentId].push(t);
    }
  });

  for (const [appId, txs] of Object.entries(grouped)) {
    const types = txs.map(t => t.type).join(', ');
    console.log(`AppID ${appId.slice(0,8)}... | Tipos: ${types}`);
  }

  await prisma.$disconnect();
}

check();
