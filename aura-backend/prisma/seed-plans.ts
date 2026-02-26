// Script para inserir os planos padrão no banco
// Nomes padronizados: FREE, BASIC, STARTER, PROFESSIONAL, PREMIUM, ENTERPRISE
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPlans() {
  console.log("🌱 Inserindo planos padrão...");

  const plans = [
    {
      name: "FREE",
      displayName: "Trial Grátis",
      price: 0,
      maxProfessionals: 1,
      maxPatients: 50,
      modules: ["online_booking", "financial", "inventory", "reports"],
      features: [
        "Trial de 15 dias",
        "Agenda online",
        "Financeiro básico",
        "Controle de estoque",
        "Relatórios básicos",
      ],
      isActive: true,
    },
    {
      name: "BASIC",
      displayName: "Bloqueado",
      price: 0,
      maxProfessionals: 0,
      maxPatients: 0,
      modules: [], // Sem acesso (bloqueado)
      features: [
        "Plano expirado",
        "Acesso somente leitura",
        "Dados preservados",
      ],
      isActive: true,
    },
    {
      name: "STARTER",
      displayName: "Starter",
      price: 97,
      maxProfessionals: 2,
      maxPatients: 200,
      modules: ["online_booking", "financial", "support", "inventory", "reports", "photos"],
      features: [
        "Agenda ilimitada",
        "Confirmação automática",
        "Financeiro completo",
        "Controle de estoque",
        "Relatórios avançados",
        "Fotos de evolução",
        "Suporte via chat",
        "Até 2 profissionais",
        "Até 200 pacientes",
      ],
      isActive: true,
    },
    {
      name: "PROFESSIONAL",
      displayName: "Profissional",
      price: 197,
      maxProfessionals: 5,
      maxPatients: 500,
      modules: ["online_booking", "financial", "support", "inventory", "reports", "photos", "ai_features", "multi_user"],
      features: [
        "Tudo do Starter",
        "Marketing com IA",
        "Múltiplos profissionais",
        "Suporte prioritário",
        "Até 5 profissionais",
        "Até 500 pacientes",
      ],
      isActive: true,
    },
    {
      name: "PREMIUM",
      displayName: "Premium",
      price: 397,
      maxProfessionals: 10,
      maxPatients: -1, // Ilimitado
      modules: ["online_booking", "financial", "support", "inventory", "reports", "photos", "ai_features", "multi_user"],
      features: [
        "Tudo do Profissional",
        "Pacientes ilimitados",
        "Até 10 profissionais",
        "Suporte VIP",
      ],
      isActive: true,
    },
    {
      name: "ENTERPRISE",
      displayName: "Enterprise",
      price: 0, // Preço negociado individualmente
      maxProfessionals: -1, // Ilimitado
      maxPatients: -1, // Ilimitado
      modules: ["online_booking", "financial", "support", "inventory", "reports", "photos", "ai_features", "multi_user", "crm"],
      features: [
        "Todos os módulos",
        "Profissionais ilimitados",
        "Pacientes ilimitados",
        "CRM completo",
        "Gerente de conta dedicado",
        "Treinamento da equipe",
        "Preço sob consulta",
      ],
      isActive: true,
    },
  ];

  for (const plan of plans) {
    const result = await prisma.saasPlan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        price: plan.price,
        maxProfessionals: plan.maxProfessionals,
        maxPatients: plan.maxPatients,
        modules: plan.modules,
        features: plan.features,
        isActive: plan.isActive,
      },
      create: {
        name: plan.name,
        displayName: plan.displayName,
        price: plan.price,
        maxProfessionals: plan.maxProfessionals,
        maxPatients: plan.maxPatients,
        modules: plan.modules,
        features: plan.features,
        isActive: plan.isActive,
      },
    });
    console.log(`✅ Plano ${result.name} criado/atualizado`);
  }

  console.log("🎉 Planos inseridos com sucesso!");
}

seedPlans()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
