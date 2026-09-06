-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN     "idempotencyKey" UUID;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "idempotencyKey" UUID;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "idempotencyKey" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_orgId_idempotencyKey_key" ON "BankTransaction"("orgId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orgId_idempotencyKey_key" ON "Invoice"("orgId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orgId_idempotencyKey_key" ON "Payment"("orgId", "idempotencyKey");

