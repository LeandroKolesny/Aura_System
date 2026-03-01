-- AlterTable: add asaasCustomerId and asaasSubscriptionId to companies
ALTER TABLE "companies" ADD COLUMN "asaasCustomerId" TEXT;
ALTER TABLE "companies" ADD COLUMN "asaasSubscriptionId" TEXT;
