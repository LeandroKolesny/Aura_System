import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseTransactions() {
  try {
    // Buscar todas as transações
    const transactions = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      take: 20,
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        status: true,
        appointmentId: true,
        date: true,
      }
    });

    console.log('\n📊 Últimas 20 transações:\n');
    console.log('ID | Tipo | Valor | Descrição | AppointmentId');
    console.log('-'.repeat(100));

    transactions.forEach(t => {
      console.log(`${t.id.slice(0, 8)}... | ${t.type.padEnd(8)} | R$ ${Number(t.amount).toFixed(2).padStart(10)} | ${t.description.slice(0, 40).padEnd(40)} | ${t.appointmentId || 'N/A'}`);
    });

    // Contar por tipo
    const countByType = await prisma.transaction.groupBy({
      by: ['type'],
      _count: { id: true }
    });

    console.log('\n📈 Contagem por tipo:');
    countByType.forEach(c => {
      console.log(`   ${c.type}: ${c._count.id} transações`);
    });

    // Verificar se há transações de procedimentos sem INCOME
    const appointmentsWithOnlyExpense = await prisma.transaction.groupBy({
      by: ['appointmentId'],
      where: {
        appointmentId: { not: null },
        type: 'EXPENSE'
      },
      _count: { id: true }
    });

    const appointmentsWithIncome = await prisma.transaction.groupBy({
      by: ['appointmentId'],
      where: {
        appointmentId: { not: null },
        type: 'INCOME'
      },
      _count: { id: true }
    });

    const expenseAppIds = appointmentsWithOnlyExpense.map(a => a.appointmentId);
    const incomeAppIds = appointmentsWithIncome.map(a => a.appointmentId);

    const onlyExpense = expenseAppIds.filter(id => !incomeAppIds.includes(id));

    console.log(`\n⚠️ Agendamentos com APENAS expense (sem income): ${onlyExpense.length}`);
    if (onlyExpense.length > 0) {
      console.log('   IDs:', onlyExpense.slice(0, 5).join(', '), onlyExpense.length > 5 ? '...' : '');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseTransactions();
