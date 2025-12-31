// Script para inserir os planos padrão no banco
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPlans() {
  console.log("🌱 Inserindo planos padrão...");

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: 97,
      features: [
        "Agenda ilimitada",
        "Confirmação automática",
        "Financeiro básico",
        "Suporte via chat",
      ],
      isActive: true,
      stripeProductId: null,
    },
    {
      id: "pro",
      name: "Pro",
      price: 197,
      features: [
        "Tudo do Starter",
        "CRM completo",
        "Relatórios avançados",
        "Integração WhatsApp",
        "Suporte prioritário",
      ],
      isActive: true,
      stripeProductId: null,
    },
    {
      id: "clinic",
      name: "Clinic",
      price: 397,
      features: [
        "Tudo do Pro",
        "Multi-unidades",
        "API personalizada",
        "Gerente de conta dedicado",
        "Treinamento da equipe",
      ],
      isActive: true,
      stripeProductId: null,
    },
  ];

  for (const plan of plans) {
    const result = await prisma.saasPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        price: plan.price,
        features: plan.features,
        isActive: plan.isActive,
        stripeProductId: plan.stripeProductId,
      },
      create: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        features: plan.features,
        isActive: plan.isActive,
        stripeProductId: plan.stripeProductId,
      },
    });
    console.log("✅ Plano criado/atualizado:", result.name);
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
