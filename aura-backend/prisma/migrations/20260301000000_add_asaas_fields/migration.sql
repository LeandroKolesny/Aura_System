-- AlterTable: add asaasCustomerId and asaasSubscriptionId to companies
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "asaasCustomerId" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "asaasSubscriptionId" TEXT;
