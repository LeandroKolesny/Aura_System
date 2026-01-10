// Script para criar dados fake para testar a página de Marketing
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados de Marketing...');

  // Buscar a primeira empresa ativa (que não seja do OWNER)
  const company = await prisma.company.findFirst({
    where: {
      isActive: true,
      users: {
        some: {
          role: { in: ['ADMIN', 'ESTHETICIAN'] }
        }
      }
    },
    include: {
      users: true,
      procedures: true
    }
  });

  if (!company) {
    console.error('❌ Nenhuma empresa encontrada. Crie uma empresa primeiro.');
    return;
  }

  console.log(`📍 Usando empresa: ${company.name} (${company.id})`);

  // Buscar um profissional
  let professional = company.users.find(u => u.role === 'ESTHETICIAN' || u.role === 'ADMIN');
  if (!professional) {
    console.error('❌ Nenhum profissional encontrado na empresa.');
    return;
  }
  console.log(`👤 Usando profissional: ${professional.name}`);

  // Buscar ou criar um procedimento
  let procedure = company.procedures[0];
  if (!procedure) {
    procedure = await prisma.procedure.create({
      data: {
        companyId: company.id,
        name: 'Limpeza de Pele',
        description: 'Limpeza de pele profunda com extração',
        price: 150,
        cost: 30,
        durationMinutes: 60,
        isActive: true,
        maintenanceRequired: true,
        maintenanceIntervalDays: 30
      }
    });
    console.log(`✅ Procedimento criado: ${procedure.name}`);
  } else {
    console.log(`📋 Usando procedimento existente: ${procedure.name}`);
  }

  // Criar mais procedimentos se necessário
  const procedureNames = [
    { name: 'Botox', price: 800, cost: 200, maintenance: true, days: 120 },
    { name: 'Preenchimento Labial', price: 1200, cost: 400, maintenance: true, days: 180 },
    { name: 'Peeling Químico', price: 350, cost: 80, maintenance: true, days: 45 },
    { name: 'Microagulhamento', price: 450, cost: 100, maintenance: true, days: 30 },
  ];

  for (const proc of procedureNames) {
    const exists = await prisma.procedure.findFirst({
      where: { companyId: company.id, name: proc.name }
    });
    if (!exists) {
      await prisma.procedure.create({
        data: {
          companyId: company.id,
          name: proc.name,
          price: proc.price,
          cost: proc.cost,
          durationMinutes: 60,
          isActive: true,
          maintenanceRequired: proc.maintenance,
          maintenanceIntervalDays: proc.days
        }
      });
      console.log(`✅ Procedimento criado: ${proc.name}`);
    }
  }

  // Buscar todos os procedimentos
  const allProcedures = await prisma.procedure.findMany({
    where: { companyId: company.id, isActive: true }
  });

  // Gerar datas de aniversário (algumas próximas, algumas hoje, algumas futuras)
  const today = new Date();
  const getBirthDate = (daysFromNow: number, yearsAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setFullYear(date.getFullYear() - yearsAgo);
    return date;
  };

  // Nomes de pacientes fake com datas de nascimento
  const fakePatients = [
    { name: 'Maria Silva', email: 'maria.silva@email.com', phone: '51999001001', birthDate: getBirthDate(0, 32) }, // Hoje!
    { name: 'Ana Santos', email: 'ana.santos@email.com', phone: '51999002002', birthDate: getBirthDate(2, 28) }, // Em 2 dias
    { name: 'Juliana Costa', email: 'juliana.costa@email.com', phone: '51999003003', birthDate: getBirthDate(5, 35) }, // Em 5 dias
    { name: 'Fernanda Lima', email: 'fernanda.lima@email.com', phone: '51999004004', birthDate: getBirthDate(7, 41) }, // Em 7 dias
    { name: 'Camila Oliveira', email: 'camila.oliveira@email.com', phone: '51999005005', birthDate: getBirthDate(15, 29) }, // Em 15 dias
    { name: 'Patricia Souza', email: 'patricia.souza@email.com', phone: '51999006006', birthDate: getBirthDate(25, 38) }, // Em 25 dias
    { name: 'Renata Pereira', email: 'renata.pereira@email.com', phone: '51999007007', birthDate: getBirthDate(1, 45) }, // Amanhã
    { name: 'Beatriz Almeida', email: 'beatriz.almeida@email.com', phone: '51999008008', birthDate: getBirthDate(3, 33) }, // Em 3 dias
    { name: 'Carolina Ferreira', email: 'carolina.ferreira@email.com', phone: '51999009009', birthDate: getBirthDate(10, 27) }, // Em 10 dias
    { name: 'Daniela Rodrigues', email: 'daniela.rodrigues@email.com', phone: '51999010010', birthDate: getBirthDate(20, 36) }, // Em 20 dias
  ];

  console.log('\n👥 Criando pacientes e agendamentos...');

  for (let i = 0; i < fakePatients.length; i++) {
    const fp = fakePatients[i];

    // Verificar se já existe
    let patient = await prisma.patient.findFirst({
      where: { email: fp.email, companyId: company.id }
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          companyId: company.id,
          name: fp.name,
          email: fp.email,
          phone: fp.phone,
          birthDate: fp.birthDate,
          status: 'ACTIVE'
        }
      });
      console.log(`  ✅ Paciente criado: ${patient.name} (aniversário: ${fp.birthDate.toLocaleDateString('pt-BR')})`);
    } else {
      // Atualizar birthDate se não existir
      if (!patient.birthDate && fp.birthDate) {
        await prisma.patient.update({
          where: { id: patient.id },
          data: { birthDate: fp.birthDate }
        });
        console.log(`  📌 Paciente existente (birthDate atualizado): ${patient.name}`);
      } else {
        console.log(`  📌 Paciente existente: ${patient.name}`);
      }
    }

    // Criar agendamentos concluídos com datas antigas (para aparecer no Marketing)
    // Variando entre 30 e 180 dias atrás
    const daysAgo = 30 + Math.floor(Math.random() * 150); // 30-180 dias
    const appointmentDate = new Date();
    appointmentDate.setDate(appointmentDate.getDate() - daysAgo);

    // Escolher um procedimento aleatório
    const randomProcedure = allProcedures[Math.floor(Math.random() * allProcedures.length)];

    // Verificar se já existe agendamento para esse paciente
    const existingAppt = await prisma.appointment.findFirst({
      where: { patientId: patient.id, status: 'COMPLETED' }
    });

    if (!existingAppt) {
      const appointment = await prisma.appointment.create({
        data: {
          companyId: company.id,
          patientId: patient.id,
          professionalId: professional.id,
          procedureId: randomProcedure.id,
          date: appointmentDate,
          durationMinutes: randomProcedure.durationMinutes,
          price: randomProcedure.price,
          status: 'COMPLETED',
          paid: true
        }
      });
      console.log(`    📅 Agendamento criado: ${randomProcedure.name} (${daysAgo} dias atrás)`);
    }
  }

  console.log('\n✅ Seed de Marketing concluído!');
  console.log(`   - ${fakePatients.length} pacientes processados`);
  console.log(`   - Agendamentos com datas de 30-180 dias atrás`);
  console.log('\n🔄 Acesse a página de Marketing para ver as oportunidades de recuperação.');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
