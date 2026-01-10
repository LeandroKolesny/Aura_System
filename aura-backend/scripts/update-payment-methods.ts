import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updatePaymentMethods() {
  try {
    const defaultPaymentMethods = ["Dinheiro", "Pix", "Cartão de Crédito", "Cartão de Débito"];

    // Atualizar empresas que não têm formas de pagamento configuradas
    const result = await prisma.company.updateMany({
      where: {
        OR: [
          { paymentMethods: { equals: [] } },
          { paymentMethods: { isEmpty: true } }
        ]
      },
      data: {
        paymentMethods: defaultPaymentMethods
      }
    });

    console.log(`✅ ${result.count} empresa(s) atualizada(s) com formas de pagamento padrão!`);
    console.log('   Métodos adicionados:', defaultPaymentMethods.join(', '));

  } catch (error) {
    console.error('❌ Erro ao atualizar formas de pagamento:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePaymentMethods();
