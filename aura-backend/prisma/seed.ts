// Aura System - Seed de Dados Iniciais para Clínica de Estética
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Helper para gerar datas
function getDate(daysOffset: number, hour: number = 10, minute: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  console.log("🌱 Iniciando seed do banco de dados Aura...");

  // Limpar dados existentes (em ordem para respeitar foreign keys)
  console.log("🗑️ Limpando dados existentes...");
  await prisma.transaction.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.procedureSupply.deleteMany();
  await prisma.procedure.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // 1. Criar empresa de demonstração
  const company = await prisma.company.create({
    data: {
      name: "Clínica Aura Estética",
      slug: "clinica-aura",
      plan: "PREMIUM",
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      businessHours: {
        monday: { isOpen: true, start: "08:00", end: "18:00" },
        tuesday: { isOpen: true, start: "08:00", end: "18:00" },
        wednesday: { isOpen: true, start: "08:00", end: "18:00" },
        thursday: { isOpen: true, start: "08:00", end: "18:00" },
        friday: { isOpen: true, start: "08:00", end: "18:00" },
        saturday: { isOpen: true, start: "09:00", end: "13:00" },
        sunday: { isOpen: false, start: "00:00", end: "00:00" },
      },
      onboardingCompleted: true,
    },
  });
  console.log("✅ Empresa criada:", company.name);

  // 2. Criar usuário administrador
  const hashedPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.create({
    data: {
      email: "admin@aura.com",
      name: "Dra. Carolina Mendes",
      password: hashedPassword,
      role: "ADMIN",
      companyId: company.id,
      isActive: true,
      phone: "(11) 99999-0000",
      commissionRate: 40,
    },
  });
  console.log("✅ Admin criado:", admin.email);

  // 3. Criar esteticistas
  const esthetician1 = await prisma.user.create({
    data: {
      email: "joana@aura.com",
      password: await bcrypt.hash("joana123", 12),
      name: "Dra. Joana Silva",
      role: "ESTHETICIAN",
      companyId: company.id,
      isActive: true,
      phone: "(11) 99999-1111",
      commissionRate: 30,
    },
  });

  const esthetician2 = await prisma.user.create({
    data: {
      email: "marcos@aura.com",
      password: await bcrypt.hash("marcos123", 12),
      name: "Dr. Marcos Almeida",
      role: "ESTHETICIAN",
      companyId: company.id,
      isActive: true,
      phone: "(11) 99999-3333",
      commissionRate: 35,
    },
  });
  console.log("✅ Esteticistas criados");

  // 4. Criar recepcionista
  const receptionist = await prisma.user.create({
    data: {
      email: "recep@aura.com",
      password: await bcrypt.hash("recep123", 12),
      name: "Paula Recepção",
      role: "RECEPTIONIST",
      companyId: company.id,
      isActive: true,
      phone: "(11) 99999-2222",
    },
  });
  console.log("✅ Recepcionista criada:", receptionist.name);

  // 5. Criar itens de estoque
  const botox = await prisma.inventoryItem.create({
    data: {
      companyId: company.id,
      name: "Botox 100U",
      unit: "unidade",
      currentStock: 50,
      minStock: 10,
      costPerUnit: 450.0,
    },
  });

  const acidoHialuronico = await prisma.inventoryItem.create({
    data: {
      companyId: company.id,
      name: "Ácido Hialurônico 1ml",
      unit: "seringa",
      currentStock: 30,
      minStock: 5,
      costPerUnit: 380.0,
    },
  });

  const limpezaPele = await prisma.inventoryItem.create({
    data: {
      companyId: company.id,
      name: "Kit Limpeza de Pele",
      unit: "kit",
      currentStock: 100,
      minStock: 20,
      costPerUnit: 45.0,
    },
  });
  console.log("✅ Itens de estoque criados");

  // 6. Criar procedimentos
  const procBotox = await prisma.procedure.create({
    data: {
      companyId: company.id,
      name: "Aplicação de Botox",
      description: "Toxina botulínica para rugas e linhas de expressão",
      price: 1200.0,
      cost: 450.0,
      durationMinutes: 45,
      isActive: true,
      supplies: {
        create: [{ inventoryItemId: botox.id, quantityUsed: 1 }],
      },
    },
  });

  const procPreenchimento = await prisma.procedure.create({
    data: {
      companyId: company.id,
      name: "Preenchimento Labial",
      description: "Preenchimento com ácido hialurônico nos lábios",
      price: 1800.0,
      cost: 380.0,
      durationMinutes: 60,
      isActive: true,
      supplies: {
        create: [{ inventoryItemId: acidoHialuronico.id, quantityUsed: 1 }],
      },
    },
  });

  const procLimpeza = await prisma.procedure.create({
    data: {
      companyId: company.id,
      name: "Limpeza de Pele Profunda",
      description: "Limpeza completa com extração e hidratação",
      price: 250.0,
      cost: 45.0,
      durationMinutes: 90,
      isActive: true,
      supplies: {
        create: [{ inventoryItemId: limpezaPele.id, quantityUsed: 1 }],
      },
    },
  });
  console.log("✅ Procedimentos criados");

  // 7. Criar pacientes (10 pacientes)
  const pacientes = await Promise.all([
    prisma.patient.create({
      data: { companyId: company.id, name: "Maria Santos", email: "maria@email.com", phone: "(11) 98888-1111", birthDate: new Date("1985-05-15"), status: "ACTIVE" },
    }),
    prisma.patient.create({
      data: { companyId: company.id, name: "Ana Oliveira", email: "ana@email.com", phone: "(11) 98888-2222", birthDate: new Date("1990-08-20"), status: "ACTIVE" },
    }),
    prisma.patient.create({
      data: { companyId: company.id, name: "Carla Fernandes", email: "carla@email.com", phone: "(11) 98888-3333", birthDate: new Date("1988-12-10"), status: "ACTIVE" },
    }),
    prisma.patient.create({
      data: { companyId: company.id, name: "Juliana Costa", email: "juliana@email.com", phone: "(11) 98888-4444", birthDate: new Date("1992-03-22"), status: "ACTIVE" },
    }),
    prisma.patient.create({
      data: { companyId: company.id, name: "Fernanda Lima", email: "fernanda@email.com", phone: "(11) 98888-5555", birthDate: new Date("1987-07-18"), status: "ACTIVE" },
    }),
    prisma.patient.create({
      data: { companyId: company.id, name: "Patrícia Rocha", email: "patricia@email.com", phone: "(11) 98888-6666", birthDate: new Date("1995-11-30"), status: "ACTIVE" },
    }),
    prisma.patient.create({
      data: { companyId: company.id, name: "Beatriz Alves", email: "beatriz@email.com", phone: "(11) 98888-7777", birthDate: new Date("1983-01-05"), status: "ACTIVE" },
    }),
    prisma.patient.create({
      data: { companyId: company.id, name: "Luciana Martins", email: "luciana@email.com", phone: "(11) 98888-8888", birthDate: new Date("1991-09-12"), status: "ACTIVE" },
    }),
    prisma.patient.create({
      data: { companyId: company.id, name: "Renata Souza", email: "renata@email.com", phone: "(11) 98888-9999", birthDate: new Date("1989-04-25"), status: "ACTIVE" },
    }),
    prisma.patient.create({
      data: { companyId: company.id, name: "Camila Pereira", email: "camila@email.com", phone: "(11) 97777-0000", birthDate: new Date("1994-06-08"), status: "ACTIVE" },
    }),
  ]);
  console.log("✅ 10 Pacientes criados");

  // 8. Criar agendamentos variados (passados, hoje e futuros)
  const profissionais = [admin, esthetician1, esthetician2];
  const procedimentos = [procBotox, procPreenchimento, procLimpeza];

  // Agendamentos passados (últimos 15 dias) - COMPLETED - batch insert
  const pastAppointments = [];
  for (let i = 1; i <= 15; i++) {
    const diasAtras = Math.floor(Math.random() * 15) + 1;
    const hora = 8 + Math.floor(Math.random() * 9);
    const paciente = pacientes[Math.floor(Math.random() * pacientes.length)];
    const proc = procedimentos[Math.floor(Math.random() * procedimentos.length)];
    const prof = profissionais[Math.floor(Math.random() * profissionais.length)];

    pastAppointments.push({
      companyId: company.id,
      patientId: paciente.id,
      procedureId: proc.id,
      professionalId: prof.id,
      date: getDate(-diasAtras, hora),
      durationMinutes: proc.id === procLimpeza.id ? 90 : proc.id === procBotox.id ? 45 : 60,
      price: proc.id === procLimpeza.id ? 250 : proc.id === procBotox.id ? 1200 : 1800,
      status: "COMPLETED" as const,
    });
  }
  await prisma.appointment.createMany({ data: pastAppointments });

  // Agendamentos de hoje
  await prisma.appointment.create({
    data: {
      companyId: company.id, patientId: pacientes[0].id, procedureId: procBotox.id,
      professionalId: esthetician1.id, date: getDate(0, 9), durationMinutes: 45, price: 1200.0, status: "CONFIRMED",
    },
  });
  await prisma.appointment.create({
    data: {
      companyId: company.id, patientId: pacientes[1].id, procedureId: procLimpeza.id,
      professionalId: esthetician1.id, date: getDate(0, 10, 30), durationMinutes: 90, price: 250.0, status: "CONFIRMED",
    },
  });
  await prisma.appointment.create({
    data: {
      companyId: company.id, patientId: pacientes[2].id, procedureId: procPreenchimento.id,
      professionalId: esthetician2.id, date: getDate(0, 14), durationMinutes: 60, price: 1800.0, status: "SCHEDULED",
    },
  });
  await prisma.appointment.create({
    data: {
      companyId: company.id, patientId: pacientes[3].id, procedureId: procBotox.id,
      professionalId: admin.id, date: getDate(0, 15), durationMinutes: 45, price: 1200.0, status: "SCHEDULED",
    },
  });

  // Agendamentos futuros (próximos 5 dias) - batch
  const futureAppointments = [];
  for (let dia = 1; dia <= 5; dia++) {
    const hora = 9 + dia;
    const paciente = pacientes[dia % pacientes.length];
    const proc = procedimentos[dia % procedimentos.length];
    const prof = profissionais[dia % profissionais.length];

    futureAppointments.push({
      companyId: company.id,
      patientId: paciente.id,
      procedureId: proc.id,
      professionalId: prof.id,
      date: getDate(dia, hora),
      durationMinutes: proc.id === procLimpeza.id ? 90 : proc.id === procBotox.id ? 45 : 60,
      price: proc.id === procLimpeza.id ? 250 : proc.id === procBotox.id ? 1200 : 1800,
      status: "SCHEDULED" as const,
    });
  }
  await prisma.appointment.createMany({ data: futureAppointments });

  // Alguns cancelados
  await prisma.appointment.createMany({
    data: [
      { companyId: company.id, patientId: pacientes[5].id, procedureId: procBotox.id, professionalId: esthetician1.id, date: getDate(-5, 10), durationMinutes: 45, price: 1200.0, status: "CANCELED" },
      { companyId: company.id, patientId: pacientes[6].id, procedureId: procPreenchimento.id, professionalId: esthetician2.id, date: getDate(-10, 14), durationMinutes: 60, price: 1800.0, status: "CANCELED" },
    ]
  });
  console.log("✅ Agendamentos criados");

  // 9. Criar transações - batch insert
  const incomeTransactions = [];
  for (let i = 1; i <= 15; i++) {
    const proc = procedimentos[i % procedimentos.length];
    const valor = proc.id === procLimpeza.id ? 250 : proc.id === procBotox.id ? 1200 : 1800;
    const pagamento = ["PIX", "Cartão Crédito", "Cartão Débito", "Dinheiro"][i % 4];

    incomeTransactions.push({
      companyId: company.id,
      date: getDate(-i, 10),
      description: `Procedimento: ${proc.id === procLimpeza.id ? "Limpeza de Pele" : proc.id === procBotox.id ? "Botox" : "Preenchimento"}`,
      amount: valor,
      type: "INCOME" as const,
      category: "Procedimentos",
      status: "PAID" as const,
      paymentMethod: pagamento,
    });
  }
  await prisma.transaction.createMany({ data: incomeTransactions });

  // Despesas variadas - batch
  const despesas = [
    { desc: "Aluguel do espaço", valor: 3500, cat: "Aluguel", dias: -1 },
    { desc: "Conta de luz", valor: 450, cat: "Utilidades", dias: -5 },
    { desc: "Conta de água", valor: 120, cat: "Utilidades", dias: -5 },
    { desc: "Internet e telefone", valor: 280, cat: "Utilidades", dias: -10 },
    { desc: "Material de escritório", valor: 150, cat: "Materiais", dias: -7 },
    { desc: "Compra Botox (10un)", valor: 4500, cat: "Insumos", dias: -15 },
    { desc: "Marketing Instagram", valor: 500, cat: "Marketing", dias: -3 },
  ];

  await prisma.transaction.createMany({
    data: despesas.map(d => ({
      companyId: company.id,
      date: getDate(d.dias),
      description: d.desc,
      amount: d.valor,
      type: "EXPENSE" as const,
      category: d.cat,
      status: "PAID" as const,
      paymentMethod: "Transferência",
    }))
  });
  console.log("✅ Transações criadas");

  console.log("\n🎉 Seed concluído com sucesso!");
  console.log("\n📋 Credenciais de acesso:");
  console.log("   Admin:       admin@aura.com / admin123");
  console.log("   Esteticista: joana@aura.com / joana123");
  console.log("   Esteticista: marcos@aura.com / marcos123");
  console.log("   Recepção:    recep@aura.com / recep123");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

