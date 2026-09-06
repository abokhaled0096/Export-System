-- ============ SalesOrder / SalesOrderLine — شريحة ثانية من P2 (ERD §5، 🆕v4) ============
-- "Won" وحدها مش التزام تجاري حقيقي — الالتزام الفعلي يبدأ من هنا بدليل PO فعلي.
-- راجع docs/SCOPE-P2.md للتفاصيل والتأجيلات (poDocumentId، QuoteLine متعدد المنتجات).

CREATE TYPE "SalesOrderStatus" AS ENUM ('Draft', 'Confirmed', 'InProduction', 'PartiallyDelivered', 'Delivered', 'Invoiced', 'Closed', 'Cancelled');

CREATE TABLE "SalesOrder" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "soNumber" TEXT NOT NULL,
    "poNumber" TEXT,
    "poDate" TIMESTAMP(3),
    "currency" CHAR(3) NOT NULL,
    "totalValue" DECIMAL(14,2) NOT NULL,
    "incoterm" "Incoterm" NOT NULL,
    "paymentTerms" TEXT,
    "deliveryWindowStart" TIMESTAMP(3),
    "deliveryWindowEnd" TIMESTAMP(3),
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesOrderLine" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "salesOrderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesOrder_soNumber_key" ON "SalesOrder"("soNumber");
CREATE INDEX "SalesOrder_orgId_idx" ON "SalesOrder"("orgId");
CREATE INDEX "SalesOrder_dealId_idx" ON "SalesOrder"("dealId");
CREATE INDEX "SalesOrderLine_orgId_idx" ON "SalesOrderLine"("orgId");
CREATE INDEX "SalesOrderLine_salesOrderId_idx" ON "SalesOrderLine"("salesOrderId");

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============ إنفاذ إلزامي: أي status غير Draft لازم يكون معاه poNumber+poDate فعليًا ============
-- CHECK constraint على مستوى القاعدة (نفس روح walkAwayPrice)، مش تحقق واجهة بس.
ALTER TABLE "SalesOrder" ADD CONSTRAINT "salesorder_confirmed_requires_po"
  CHECK (status = 'Draft' OR ("poNumber" IS NOT NULL AND "poDate" IS NOT NULL));
