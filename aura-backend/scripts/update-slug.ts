import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateSlug() {
  try {
    // Atualizar o slug de 'leandro-mjuk0fe2' para 'leandro'
    const updated = await prisma.company.updateMany({
      where: {
        slug: 'leandro-mjuk0fe2'
      },
      data: {
        slug: 'leandro'
      }
    });

    if (updated.count > 0) {
      console.log('✅ Slug atualizado com sucesso! leandro-mjuk0fe2 → leandro');
    } else {
      console.log('⚠️ Nenhuma empresa encontrada com slug "leandro-mjuk0fe2"');
    }
  } catch (error) {
    console.error('❌ Erro ao atualizar slug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSlug();
