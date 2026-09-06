-- CreateEnum
CREATE TYPE "BankTransactionType" AS ENUM ('Deposit', 'Withdrawal', 'TransferIn', 'TransferOut', 'Charge', 'Interest');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('InProgress', 'Reconciled', 'Discrepancy');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('Active', 'Settled', 'Defaulted');

-- CreateEnum
CREATE TYPE "LoanInstallmentStatus" AS ENUM ('Pending', 'Paid');

-- CreateEnum
CREATE TYPE "CashFlowCategory" AS ENUM ('OpeningCash', 'CustomerCollections', 'SupplierPayments', 'Payroll', 'Freight', 'Customs', 'Taxes', 'LoanService', 'Capex', 'ClosingCash');

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "bankAccountId" UUID NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "transactionType" "BankTransactionType" NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "paymentId" UUID,
    "reconciliationId" UUID,
    "journalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "bankAccountId" UUID NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "statementBalance" DECIMAL(14,2) NOT NULL,
    "bookBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'InProgress',
    "notes" TEXT,
    "reconciledBy" UUID,
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "lenderName" TEXT NOT NULL,
    "bankAccountId" UUID NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "outstandingPrincipal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "interestRatePct" DECIMAL(6,3),
    "startDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "collateral" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'Active',
    "disbursedAt" TIMESTAMP(3),
    "journalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "loanId" UUID NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalPortion" DECIMAL(14,2) NOT NULL,
    "interestPortion" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "LoanInstallmentStatus" NOT NULL DEFAULT 'Pending',
    "paymentId" UUID,
    "journalEntryId" UUID,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlowForecastLine" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "category" "CashFlowCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlowForecastLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankTransaction_orgId_idx" ON "BankTransaction"("orgId");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_idx" ON "BankTransaction"("bankAccountId");

-- CreateIndex
CREATE INDEX "BankTransaction_reconciliationId_idx" ON "BankTransaction"("reconciliationId");

-- CreateIndex
CREATE INDEX "BankTransaction_paymentId_idx" ON "BankTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "BankReconciliation_orgId_idx" ON "BankReconciliation"("orgId");

-- CreateIndex
CREATE INDEX "BankReconciliation_bankAccountId_idx" ON "BankReconciliation"("bankAccountId");

-- CreateIndex
CREATE INDEX "Loan_orgId_idx" ON "Loan"("orgId");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "LoanInstallment_orgId_idx" ON "LoanInstallment"("orgId");

-- CreateIndex
CREATE INDEX "LoanInstallment_loanId_idx" ON "LoanInstallment"("loanId");

-- CreateIndex
CREATE INDEX "CashFlowForecastLine_orgId_idx" ON "CashFlowForecastLine"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CashFlowForecastLine_orgId_weekStartDate_category_currency_key" ON "CashFlowForecastLine"("orgId", "weekStartDate", "category", "currency");

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_reconciledBy_fkey" FOREIGN KEY ("reconciledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowForecastLine" ADD CONSTRAINT "CashFlowForecastLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ============ RLS: عزل org لكل جدول جديد ============
ALTER TABLE "BankTransaction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY banktransaction_org_isolation ON "BankTransaction" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "BankReconciliation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY bankreconciliation_org_isolation ON "BankReconciliation" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Loan" ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_org_isolation ON "Loan" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "LoanInstallment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY loaninstallment_org_isolation ON "LoanInstallment" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "CashFlowForecastLine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY cashflowforecastline_org_isolation ON "CashFlowForecastLine" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());


-- ============ اتجاه الحركة البنكية: مصدر الحقيقة الوحيد ============
-- docs/ERD.md §11.3 بيسيب `amount` بلا إشارة ولا اتجاه محسوم — سحب بيتخزن موجب ولا سالب؟
-- الغموض ده = أرصدة غلط. القاعدة هنا: amount موجب دايمًا، والاتجاه بيتشتق من النوع.
-- الدالة دي هي المرجع الوحيد، وبتُستخدم في حساب bookBalance والرصيد الجاري.
CREATE OR REPLACE FUNCTION public.bank_transaction_signed_amount(
  p_type "BankTransactionType",
  p_amount DECIMAL
)
RETURNS DECIMAL
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_type IN ('Deposit', 'TransferIn', 'Interest') THEN p_amount
    ELSE -p_amount
  END;
$fn$;


-- ============ 1. اتساق الحركة البنكية + صحة المضاهاة ============
CREATE OR REPLACE FUNCTION public.enforce_bank_transaction_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_account_currency CHAR(3);
  v_payment_account  UUID;
  v_payment_currency CHAR(3);
  v_payment_amount   DECIMAL;
  v_payment_number   TEXT;
BEGIN
  IF NEW."amount" <= 0 THEN
    RAISE EXCEPTION 'مبلغ الحركة البنكية لازم يكون أكبر من صفر — الاتجاه بيتحدد من نوع الحركة مش من إشارة المبلغ'
      USING ERRCODE = '23514';
  END IF;

  SELECT "currency" INTO v_account_currency FROM "BankAccount" WHERE id = NEW."bankAccountId";
  IF v_account_currency IS DISTINCT FROM NEW."currency" THEN
    RAISE EXCEPTION 'عملة الحركة (%) مختلفة عن عملة الحساب البنكي (%) — الحساب بعملة واحدة بس',
      NEW."currency", COALESCE(v_account_currency, 'غير موجود')
      USING ERRCODE = '23514';
  END IF;

  -- المضاهاة بدفعة: لازم تكون نفس الحساب ونفس العملة ونفس المبلغ، وإلا المطابقة بلا معنى.
  IF NEW."paymentId" IS NOT NULL THEN
    SELECT "bankAccountId", "currency", "amount", "paymentNumber"
      INTO v_payment_account, v_payment_currency, v_payment_amount, v_payment_number
      FROM "Payment" WHERE id = NEW."paymentId";

    IF v_payment_account IS DISTINCT FROM NEW."bankAccountId" THEN
      RAISE EXCEPTION 'الدفعة % من حساب بنكي تاني — مينفعش تتضاهى بحركة على الحساب ده', v_payment_number
        USING ERRCODE = '23514';
    END IF;

    IF v_payment_currency IS DISTINCT FROM NEW."currency" THEN
      RAISE EXCEPTION 'عملة الدفعة % مختلفة عن عملة الحركة', v_payment_number
        USING ERRCODE = '23514';
    END IF;

    IF v_payment_amount IS DISTINCT FROM NEW."amount" THEN
      RAISE EXCEPTION 'مبلغ الحركة (%) مش مطابق لمبلغ الدفعة % (%) — المضاهاة الجزئية مش مدعومة لسه',
        NEW."amount", v_payment_number, v_payment_amount
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_bank_transaction_consistency() FROM PUBLIC;

CREATE TRIGGER bank_transaction_consistency_check
  BEFORE INSERT OR UPDATE ON "BankTransaction"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_bank_transaction_consistency();


-- ============ 2. نطاق المطابقة: نفس الحساب + المطابقة المقفولة مقفولة فعلًا ============
CREATE OR REPLACE FUNCTION public.enforce_bank_transaction_reconciliation_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_rec_account UUID;
  v_rec_status  TEXT;
  v_old_status  TEXT;
BEGIN
  -- ممنوع لمس حركة مربوطة بمطابقة مقفولة (نفس فلسفة immutability القيد المرحّل).
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD."reconciliationId" IS NOT NULL THEN
    SELECT "status"::text INTO v_old_status FROM "BankReconciliation" WHERE id = OLD."reconciliationId";
    IF v_old_status = 'Reconciled' THEN
      RAISE EXCEPTION 'الحركة دي جزء من مطابقة بنكية مقفولة — مينفعش تتعدّل ولا تتشال (المطابقة المقفولة سجل نهائي)'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW."reconciliationId" IS NOT NULL THEN
    SELECT "bankAccountId", "status"::text INTO v_rec_account, v_rec_status
      FROM "BankReconciliation" WHERE id = NEW."reconciliationId";

    IF v_rec_account IS DISTINCT FROM NEW."bankAccountId" THEN
      RAISE EXCEPTION 'مينفعش تربط حركة بمطابقة بنكية بتاعة حساب تاني'
        USING ERRCODE = '23514';
    END IF;

    IF v_rec_status = 'Reconciled' THEN
      RAISE EXCEPTION 'المطابقة البنكية مقفولة — مينفعش تضيف ليها حركات جديدة'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_bank_transaction_reconciliation_scope() FROM PUBLIC;

CREATE TRIGGER bank_transaction_reconciliation_scope_check
  BEFORE INSERT OR UPDATE OR DELETE ON "BankTransaction"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_bank_transaction_reconciliation_scope();


-- ============ 3. صيانة bookBalance تلقائيًا ============
-- ⚠️ انحراف واعٍ عن docs/ERD.md §11.3 اللي بيحط bookBalance كحقل يدوي. الرصيد الدفتري
-- مشتق بالكامل (رصيد افتتاحي + الحركات لغاية statementDate)، وأي رقم مالي مشتق بيتكتب
-- بإيد بينحرف. نفس علاج Invoice.amountPaid في الشريحة اللي فاتت.
CREATE OR REPLACE FUNCTION public.compute_book_balance(p_account UUID, p_as_of TIMESTAMP)
RETURNS DECIMAL
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE((SELECT "openingBalance" FROM "BankAccount" WHERE id = p_account), 0)
       + COALESCE((
           SELECT SUM(public.bank_transaction_signed_amount(t."transactionType", t."amount"))
           FROM "BankTransaction" t
           WHERE t."bankAccountId" = p_account
             AND t."transactionDate" <= p_as_of
         ), 0);
$fn$;

CREATE OR REPLACE FUNCTION public.sync_reconciliation_book_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  NEW."bookBalance" := public.compute_book_balance(NEW."bankAccountId", NEW."statementDate");
  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.sync_reconciliation_book_balance() FROM PUBLIC;

-- ⚠️ الترتيب مهم: Postgres بينفّذ تريجرز BEFORE بترتيب الاسم أبجديًا، و"reconciliation_book_balance_sync"
-- بييجي قبل "reconciliation_closure_check" — يعني bookBalance بيتحسب الأول وبعدين الإقفال بيتحقق منه.
CREATE TRIGGER reconciliation_book_balance_sync
  BEFORE INSERT OR UPDATE ON "BankReconciliation"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_reconciliation_book_balance();

-- أي تغيير في الحركات بيخلّي bookBalance بتاع المطابقات المفتوحة قديم — فبيتحدّث فورًا.
-- (المقفولة مش بتتلمس: هي سجل نهائي، والتريجر رقم 2 بيمنع تغيير حركاتها أصلًا.)
CREATE OR REPLACE FUNCTION public.refresh_open_reconciliations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_account UUID;
BEGIN
  v_account := COALESCE(NEW."bankAccountId", OLD."bankAccountId");

  UPDATE "BankReconciliation"
     SET "bookBalance" = public.compute_book_balance(v_account, "statementDate")
   WHERE "bankAccountId" = v_account
     AND "status" <> 'Reconciled';

  RETURN NULL;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.refresh_open_reconciliations() FROM PUBLIC;

CREATE TRIGGER bank_transaction_refresh_reconciliations
  AFTER INSERT OR UPDATE OR DELETE ON "BankTransaction"
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_open_reconciliations();


-- ============ 4. إقفال المطابقة: الغرض الكامل للكيان، مفروض على مستوى القاعدة ============
-- docs/ERD.md §11.3 بيسيب status=Reconciled بلا أي تحقق إن المطابقة فعلًا بتطابق.
CREATE OR REPLACE FUNCTION public.enforce_reconciliation_closure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."status" = 'Reconciled' THEN
    RAISE EXCEPTION 'المطابقة البنكية بتاريخ % مقفولة — سجل نهائي مايتعدّلش (افتح مطابقة جديدة لو فيه تصحيح)',
      to_char(OLD."statementDate", 'YYYY-MM-DD')
      USING ERRCODE = '23514';
  END IF;

  IF NEW."status" = 'Reconciled' THEN
    IF NEW."bookBalance" IS DISTINCT FROM NEW."statementBalance" THEN
      RAISE EXCEPTION 'مينفعش إقفال المطابقة والفرق لسه % — رصيد الكشف % مقابل الرصيد الدفتري %',
        (NEW."statementBalance" - NEW."bookBalance"), NEW."statementBalance", NEW."bookBalance"
        USING ERRCODE = '23514';
    END IF;

    IF NEW."reconciledBy" IS NULL OR NEW."reconciledAt" IS NULL THEN
      RAISE EXCEPTION 'المطابقة المقفولة لازم تسجّل مين طابقها وإمتى (أثر تدقيق إلزامي)'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_reconciliation_closure() FROM PUBLIC;

CREATE TRIGGER reconciliation_closure_check
  BEFORE INSERT OR UPDATE ON "BankReconciliation"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_reconciliation_closure();


-- ============ 5. أقساط القرض مايتجاوزوش أصله ============
CREATE OR REPLACE FUNCTION public.enforce_loan_installments_within_principal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_principal DECIMAL;
  v_scheduled DECIMAL;
BEGIN
  IF NEW."principalPortion" < 0 OR NEW."interestPortion" < 0 THEN
    RAISE EXCEPTION 'مبالغ القسط مينفعش تكون سالبة' USING ERRCODE = '23514';
  END IF;

  SELECT "principal" INTO v_principal FROM "Loan" WHERE id = NEW."loanId";

  SELECT COALESCE(SUM("principalPortion"), 0) INTO v_scheduled
    FROM "LoanInstallment"
   WHERE "loanId" = NEW."loanId"
     AND id <> NEW.id;

  IF v_scheduled + NEW."principalPortion" > v_principal THEN
    RAISE EXCEPTION 'مجموع أصل الأقساط (%) بيتجاوز أصل القرض (%)', v_scheduled + NEW."principalPortion", v_principal
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_loan_installments_within_principal() FROM PUBLIC;

CREATE TRIGGER loan_installments_within_principal_check
  BEFORE INSERT OR UPDATE ON "LoanInstallment"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_loan_installments_within_principal();


-- ============ 6. صيانة outstandingPrincipal + الإقفال التلقائي ============
CREATE OR REPLACE FUNCTION public.sync_loan_outstanding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_loan      UUID;
  v_principal DECIMAL;
  v_paid      DECIMAL;
  v_status    TEXT;
BEGIN
  v_loan := COALESCE(NEW."loanId", OLD."loanId");

  SELECT "principal", "status"::text INTO v_principal, v_status FROM "Loan" WHERE id = v_loan;

  SELECT COALESCE(SUM("principalPortion"), 0) INTO v_paid
    FROM "LoanInstallment"
   WHERE "loanId" = v_loan AND "status" = 'Paid';

  UPDATE "Loan"
     SET "outstandingPrincipal" = v_principal - v_paid,
         -- القرض بيتقفل تلقائيًا لما الأصل يتسدّد بالكامل — والمتعثّر بيفضل متعثّر.
         "status" = CASE
                      WHEN v_principal - v_paid <= 0 AND v_status = 'Active' THEN 'Settled'::"LoanStatus"
                      ELSE "status"
                    END
   WHERE id = v_loan;

  RETURN NULL;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.sync_loan_outstanding() FROM PUBLIC;

CREATE TRIGGER loan_installment_sync_outstanding
  AFTER INSERT OR UPDATE OR DELETE ON "LoanInstallment"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_loan_outstanding();


-- ============ 7. سلامة سطر التدفّق النقدي ============
-- OpeningCash/ClosingCash أرصدة مش تدفّقات — لو اتخزنوا كصفوف، أي SUM بيدّي ازدواج حساب.
-- وweekStartDate لازم يوم إتنين وإلا الأسابيع بتتداخل وشبكة الـ13 أسبوع كلها بتبوظ.
CREATE OR REPLACE FUNCTION public.enforce_cash_flow_line_sanity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW."category" IN ('OpeningCash', 'ClosingCash') THEN
    RAISE EXCEPTION 'الرصيد الافتتاحي/الختامي بيتحسب من الأرصدة والتدفّقات — مينفعش يتكتب كسطر توقّع'
      USING ERRCODE = '23514';
  END IF;

  IF EXTRACT(ISODOW FROM NEW."weekStartDate") <> 1 THEN
    RAISE EXCEPTION 'بداية الأسبوع لازم تكون يوم إتنين — التاريخ % مش إتنين',
      to_char(NEW."weekStartDate", 'YYYY-MM-DD')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_cash_flow_line_sanity() FROM PUBLIC;

CREATE TRIGGER cash_flow_line_sanity_check
  BEFORE INSERT OR UPDATE ON "CashFlowForecastLine"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_cash_flow_line_sanity();
