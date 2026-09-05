import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SAAS_COMPANY_NAME } from "@/lib/constants";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${SAAS_COMPANY_NAME} - Gestão Inteligente`,
  description: "Sistema de gestão empresarial com IA integrada",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

