// GET /api/subscriptions/patients/[id]/history
// Returns appointments linked to a specific subscription
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!user.companyId) return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });

    const subscription = await prisma.patientSubscription.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        patient: { select: { id: true, email: true } },
        plan: { select: { name: true } },
      },
    });
    if (!subscription) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    // PATIENT role can only see their own subscription
    if (user.role === "PATIENT") {
      const patient = await prisma.patient.findFirst({
        where: { email: user.email, companyId: user.companyId },
        select: { id: true },
      });
      if (!patient || subscription.patientId !== patient.id) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    const appointments = await prisma.appointment.findMany({
      where: { subscriptionId: id },
      include: {
        procedure: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
        photos: { select: { id: true, url: true, type: true, takenAt: true } },
      },
      orderBy: { date: "desc" },
    });

    const result = appointments.map((apt) => ({
      id: apt.id,
      date: apt.date,
      status: apt.status,
      procedureName: apt.procedure.name,
      professionalName: apt.professional.name,
      photos: apt.photos,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
