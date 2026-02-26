import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseExpenses() {
  try {
    // Buscar transações de EXPENSE
    const expenses = await prisma.transaction.findMany({
      where: { type: 'EXPENSE' },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        description: true,
        amount: true,
        category: true,
        appointmentId: true,
        date: true,
      }
    });

    console.log('\n📊 Transações de EXPENSE:\n');
    console.log('Descrição | Valor | Categoria | AppointmentId');
    console.log('-'.repeat(100));

    expenses.forEach(t => {
      console.log(`${t.description.slice(0, 35).padEnd(35)} | R$ ${Number(t.amount).toFixed(2).padStart(8)} | ${(t.category || 'N/A').padEnd(15)} | ${t.appointmentId || 'null'}`);
    });

    // Verificar procedimentos e seus custos
    console.log('\n\n📦 Procedimentos e custos:\n');
    const procedures = await prisma.procedure.findMany({
      include: {
        supplies: {
          include: {
            inventoryItem: true
          }
        }
      }
    });

    procedures.forEach(p => {
      const suppliesCost = p.supplies.reduce((acc, s) => {
        return acc + (Number(s.inventoryItem.costPerUnit) * Number(s.quantityUsed));
      }, 0);
      console.log(`${p.name}: Preço R$ ${Number(p.price).toFixed(2)} | Custo definido: R$ ${Number(p.cost).toFixed(2)} | Custo insumos: R$ ${suppliesCost.toFixed(2)} | Insumos: ${p.supplies.length}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseExpenses();
