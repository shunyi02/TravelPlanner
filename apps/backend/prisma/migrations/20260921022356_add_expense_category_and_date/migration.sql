-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Other',
ADD COLUMN     "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows with their original createdAt instead of the
-- migration-time default above, so old expenses don't all jump to "now".
UPDATE "Expense" SET "expenseDate" = "createdAt";
