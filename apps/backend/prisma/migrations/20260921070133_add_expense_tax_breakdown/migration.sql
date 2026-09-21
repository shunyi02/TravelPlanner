-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "servicePct" DECIMAL(5,2),
ADD COLUMN     "subtotal" DECIMAL(12,2),
ADD COLUMN     "taxPct" DECIMAL(5,2);
