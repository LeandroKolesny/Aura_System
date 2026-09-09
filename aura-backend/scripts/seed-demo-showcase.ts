// Script ADITIVO (não apaga nada) para criar uma clínica de demonstração
// usada exclusivamente para gravar o vídeo de "Controle total na palma da mão"
// na landing page. Dados 100% fictícios.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function getDate(daysOffset: number, hour: number = 10, minute: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  console.log("🎬 Criando clínica de demonstração para o vídeo da landing page...");

  const company = await prisma.company.create({
    data: {
      name: "Espaço Renove Estética",
      slug: "espaco-renove-demo",
      plan: "PREMIUM",
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      businessHours: {
        monday: { isOpen: true, start: "08:00", end: "19:00" },
        tuesday: { isOpen: true, start: "08:00", end: "19:00" },
        wednesday: { isOpen: true, start: "08:00", end: "19:00" },
        thursday: { isOpen: true, start: "08:00", end: "19:00" },
        friday: { isOpen: true, start: "08:00", end: "19:00" },
        saturday: { isOpen: true, start: "09:00", end: "14:00" },
        sunday: { isOpen: false, start: "00:00", end: "00:00" },
      },
      onboardingCompleted: true,
    },
  });
  console.log("✅ Empresa demo criada:", company.name, company.id);

  const admin = await prisma.user.create({
    data: {
      email: "ana@renove-demo.com",
      password: await bcrypt.hash("Demo2026!", 12),
      name: "Dra. Ana Rocha",
      role: "ADMIN",
      companyId: company.id,
      isActive: true,
      emailVerified: new Date(),
      phone: "(11) 98800-1000",
      commissionRate: 40,
    },
  });

  const esthetician1 = await prisma.user.create({
    data: {
      email: "bruna@renove-demo.com",
      password: await bcrypt.hash("Demo2026!", 12),
      name: "Bruna Tavares",
      role: "ESTHETICIAN",
      companyId: company.id,
      isActive: true,
      emailVerified: new Date(),
      phone: "(11) 98800-2000",
      commissionRate: 30,
    },
  });

  const esthetician2 = await prisma.user.create({
    data: {
      email: "diego@renove-demo.com",
      password: await bcrypt.hash("Demo2026!", 12),
      name: "Diego Nakamura",
      role: "ESTHETICIAN",
      companyId: company.id,
      isActive: true,
      emailVerified: new Date(),
      phone: "(11) 98800-3000",
      commissionRate: 35,
    },
  });

  const receptionist = await prisma.user.create({
    data: {
      email: "recepcao@renove-demo.com",
      password: await bcrypt.hash("Demo2026!", 12),
      name: "Larissa Nunes",
      role: "RECEPTIONIST",
      companyId: company.id,
      isActive: true,
      emailVerified: new Date(),
      phone: "(11) 98800-4000",
    },
  });
  console.log("✅ Equipe criada (1 admin, 2 esteticistas, 1 recepção)");

  const botox = await prisma.inventoryItem.create({
    data: { companyId: company.id, name: "Toxina Botulínica 100U", unit: "unidade", currentStock: 40, minStock: 10, costPerUnit: 460.0 },
  });
  const acidoHialuronico = await prisma.inventoryItem.create({
    data: { companyId: company.id, name: "Ácido Hialurônico 1ml", unit: "seringa", currentStock: 25, minStock: 5, costPerUnit: 390.0 },
  });
  const kitLimpeza = await prisma.inventoryItem.create({
    data: { companyId: company.id, name: "Kit Limpeza de Pele", unit: "kit", currentStock: 80, minStock: 15, costPerUnit: 48.0 },
  });
  const acidoPeeling = await prisma.inventoryItem.create({
    data: { companyId: company.id, name: "Ácido para Peeling", unit: "frasco", currentStock: 20, minStock: 5, costPerUnit: 95.0 },
  });
  console.log("✅ Estoque criado");

  const procBotox = await prisma.procedure.create({
    data: {
      companyId: company.id, name: "Aplicação de Botox", description: "Toxina botulínica para rugas e linhas de expressão",
      price: 1200.0, cost: 460.0, durationMinutes: 45, isActive: true,
      supplies: { create: [{ inventoryItemId: botox.id, quantityUsed: 1 }] },
    },
  });
  const procPreenchimento = await prisma.procedure.create({
    data: {
      companyId: company.id, name: "Preenchimento Labial", description: "Preenchimento com ácido hialurônico nos lábios",
      price: 1800.0, cost: 390.0, durationMinutes: 60, isActive: true,
      supplies: { create: [{ inventoryItemId: acidoHialuronico.id, quantityUsed: 1 }] },
    },
  });
  const procLimpeza = await prisma.procedure.create({
    data: {
      companyId: company.id, name: "Limpeza de Pele Profunda", description: "Limpeza completa com extração e hidratação",
      price: 250.0, cost: 48.0, durationMinutes: 90, isActive: true,
      supplies: { create: [{ inventoryItemId: kitLimpeza.id, quantityUsed: 1 }] },
    },
  });
  const procPeeling = await prisma.procedure.create({
    data: {
      companyId: company.id, name: "Peeling Químico", description: "Renovação celular e uniformização da pele",
      price: 350.0, cost: 95.0, durationMinutes: 40, isActive: true,
      supplies: { create: [{ inventoryItemId: acidoPeeling.id, quantityUsed: 1 }] },
    },
  });
  const procDrenagem = await prisma.procedure.create({
    data: {
      companyId: company.id, name: "Drenagem Linfática", description: "Massagem terapêutica para redução de inchaço",
      price: 180.0, cost: 0, durationMinutes: 50, isActive: true,
    },
  });
  console.log("✅ Procedimentos criados");

  const nomesPacientes = [
    "Marina Souza", "Isabela Cardoso", "Larissa Freitas", "Camila Duarte", "Gabriela Prado",
    "Bianca Moreira", "Rafaela Teixeira", "Vitória Barros", "Aline Correia", "Débora Ramos",
    "Priscila Andrade", "Yasmin Lopes",
  ];
  const pacientes = await Promise.all(
    nomesPacientes.map((nome, i) =>
      prisma.patient.create({
        data: {
          companyId: company.id,
          name: nome,
          email: `${nome.toLowerCase().replace(/\s+/g, ".")}@exemplo-demo.com`,
          phone: `(11) 9${7000 + i}-${1000 + i * 111}`,
          birthDate: new Date(1985 + i, i % 12, (i % 27) + 1),
          status: "ACTIVE",
        },
      })
    )
  );
  console.log("✅", pacientes.length, "pacientes criados");

  const profissionais = [admin, esthetician1, esthetician2];
  const procedimentos = [procBotox, procPreenchimento, procLimpeza, procPeeling, procDrenagem];
  const precoDe = (p: typeof procBotox) => Number(p.price);
  const duracaoDe = (p: typeof procBotox) => p.durationMinutes;

  // Agendamentos passados (últimos 10 dias) - COMPLETED
  const pastAppointments = [];
  for (let i = 1; i <= 12; i++) {
    const diasAtras = Math.floor(Math.random() * 10) + 1;
    const hora = 8 + Math.floor(Math.random() * 9);
    const paciente = pacientes[Math.floor(Math.random() * pacientes.length)];
    const proc = procedimentos[Math.floor(Math.random() * procedimentos.length)];
    const prof = profissionais[Math.floor(Math.random() * profissionais.length)];
    pastAppointments.push({
      companyId: company.id, patientId: paciente.id, procedureId: proc.id, professionalId: prof.id,
      date: getDate(-diasAtras, hora), durationMinutes: duracaoDe(proc), price: precoDe(proc),
      status: "COMPLETED" as const,
    });
  }
  await prisma.appointment.createMany({ data: pastAppointments });

  // Agenda de HOJE bem cheia (pra aparecer bonito no vídeo)
  const horariosHoje = [8, 9, 10, 11, 13, 14, 15, 16, 17];
  const todayAppointments = horariosHoje.map((hora, i) => {
    const proc = procedimentos[i % procedimentos.length];
    const prof = profissionais[i % profissionais.length];
    const paciente = pacientes[i % pacientes.length];
    return {
      companyId: company.id, patientId: paciente.id, procedureId: proc.id, professionalId: prof.id,
      date: getDate(0, hora), durationMinutes: duracaoDe(proc), price: precoDe(proc),
      status: (hora < 12 ? "COMPLETED" : i % 4 === 0 ? "SCHEDULED" : "CONFIRMED") as "COMPLETED" | "SCHEDULED" | "CONFIRMED",
    };
  });
  await prisma.appointment.createMany({ data: todayAppointments });

  // Próximos 6 dias com agenda variada
  const futureAppointments = [];
  for (let dia = 1; dia <= 6; dia++) {
    const qtdNoDia = 3 + (dia % 3);
    for (let j = 0; j < qtdNoDia; j++) {
      const hora = 9 + j * 2;
      const proc = procedimentos[(dia + j) % procedimentos.length];
      const prof = profissionais[(dia + j) % profissionais.length];
      const paciente = pacientes[(dia + j) % pacientes.length];
      futureAppointments.push({
        companyId: company.id, patientId: paciente.id, procedureId: proc.id, professionalId: prof.id,
        date: getDate(dia, hora), durationMinutes: duracaoDe(proc), price: precoDe(proc),
        status: "SCHEDULED" as const,
      });
    }
  }
  await prisma.appointment.createMany({ data: futureAppointments });

  // Alguns cancelados, pra realismo
  await prisma.appointment.createMany({
    data: [
      { companyId: company.id, patientId: pacientes[3].id, procedureId: procBotox.id, professionalId: esthetician1.id, date: getDate(-4, 10), durationMinutes: 45, price: 1200.0, status: "CANCELED" },
      { companyId: company.id, patientId: pacientes[7].id, procedureId: procPreenchimento.id, professionalId: esthetician2.id, date: getDate(-6, 14), durationMinutes: 60, price: 1800.0, status: "CANCELED" },
    ],
  });
  console.log("✅ Agenda criada (passado, hoje cheio, próximos 6 dias)");

  // Transações de receita (últimos 20 dias)
  const incomeTransactions = [];
  for (let i = 1; i <= 20; i++) {
    const proc = procedimentos[i % procedimentos.length];
    const pagamento = ["PIX", "Cartão Crédito", "Cartão Débito", "Dinheiro"][i % 4];
    incomeTransactions.push({
      companyId: company.id,
      date: getDate(-i, 10),
      description: `Procedimento: ${proc.name}`,
      amount: precoDe(proc),
      type: "INCOME" as const,
      category: "Procedimentos",
      status: "PAID" as const,
      paymentMethod: pagamento,
    });
  }
  await prisma.transaction.createMany({ data: incomeTransactions });

  const despesas = [
    { desc: "Aluguel do espaço", valor: 4200, cat: "Aluguel", dias: -1 },
    { desc: "Conta de luz", valor: 520, cat: "Utilidades", dias: -5 },
    { desc: "Conta de água", valor: 140, cat: "Utilidades", dias: -5 },
    { desc: "Internet e telefone", valor: 300, cat: "Utilidades", dias: -10 },
    { desc: "Material de escritório", valor: 180, cat: "Materiais", dias: -7 },
    { desc: "Compra de insumos", valor: 5200, cat: "Insumos", dias: -15 },
    { desc: "Marketing Instagram/Google", valor: 650, cat: "Marketing", dias: -3 },
  ];
  await prisma.transaction.createMany({
    data: despesas.map((d) => ({
      companyId: company.id, date: getDate(d.dias), description: d.desc, amount: d.valor,
      type: "EXPENSE" as const, category: d.cat, status: "PAID" as const, paymentMethod: "Transferência",
    })),
  });
  console.log("✅ Transações criadas");

  console.log("\n🎉 Clínica demo pronta para gravação!");
  console.log("   Login ADMIN: ana@renove-demo.com / Demo2026!");
  console.log("   URL: https://aura-system-mu.vercel.app/login");
  console.log("   receptionist criada (não usada no login demo):", receptionist.email);
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
