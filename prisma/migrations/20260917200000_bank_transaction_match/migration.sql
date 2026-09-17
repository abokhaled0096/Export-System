-- مضاهاة بنكية جزئية/متعددة (BACKLOG.md § وحدة 8 — "المضاهاة البنكية حركة↔دفعة واحدة بس").
-- نفس نمط PaymentAllocation بالحرف. مستقلة عن BankTransaction.paymentId (المضاهاة السريعة
-- 1:1 بكامل المبلغ، لسه شغّالة زي ما هي بلا أي تغيير) — الاتنين ممنوع يشتغلوا مع بعض على
-- نفس الحركة عشان الفرق في المطابقة البنكية ميتحسبش مرتين.
CREATE TABLE "BankTransactionMatch" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "orgId" UUID NOT NULL,
  "bankTransactionId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "allocatedAmount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankTransactionMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankTransactionMatch_bankTransactionId_paymentId_key"
  ON "BankTransactionMatch"("bankTransactionId", "paymentId");
CREATE INDEX "BankTransactionMatch_orgId_idx" ON "BankTransactionMatch"("orgId");
CREATE INDEX "BankTransactionMatch_paymentId_idx" ON "BankTransactionMatch"("paymentId");

ALTER TABLE "BankTransactionMatch" ADD CONSTRAINT "BankTransactionMatch_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankTransactionMatch" ADD CONSTRAINT "BankTransactionMatch_bankTransactionId_fkey"
  FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankTransactionMatch" ADD CONSTRAINT "BankTransactionMatch_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BankTransactionMatch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY banktransactionmatch_org_isolation ON "BankTransactionMatch"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ============ اتساق المضاهاة الجزئية: نفس الحساب/العملة، مبلغ موجب، ومفيش تجاوز ============
CREATE OR REPLACE FUNCTION public.enforce_bank_transaction_match_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_txn_account  UUID;
  v_txn_currency CHAR(3);
  v_txn_amount   DECIMAL;
  v_txn_payment  UUID;
  v_pay_account  UUID;
  v_pay_currency CHAR(3);
  v_pay_number   TEXT;
  v_total_matched DECIMAL;
BEGIN
  IF NEW."allocatedAmount" <= 0 THEN
    RAISE EXCEPTION 'مبلغ المضاهاة لازم يكون أكبر من صفر' USING ERRCODE = '23514';
  END IF;

  SELECT "bankAccountId", "currency", "amount", "paymentId"
    INTO v_txn_account, v_txn_currency, v_txn_amount, v_txn_payment
    FROM "BankTransaction" WHERE id = NEW."bankTransactionId";

  IF v_txn_payment IS NOT NULL THEN
    RAISE EXCEPTION 'الحركة دي متضاهية بالفعل بالمسار السريع (paymentId) — شيل المضاهاة دي الأول لو عايز تستخدم المضاهاة الجزئية'
      USING ERRCODE = '23514';
  END IF;

  SELECT "bankAccountId", "currency", "paymentNumber"
    INTO v_pay_account, v_pay_currency, v_pay_number
    FROM "Payment" WHERE id = NEW."paymentId";

  IF v_pay_account IS DISTINCT FROM v_txn_account THEN
    RAISE EXCEPTION 'الدفعة % من حساب بنكي تاني — مينفعش تتضاهى بحركة على حساب مختلف', v_pay_number
      USING ERRCODE = '23514';
  END IF;

  IF v_pay_currency IS DISTINCT FROM v_txn_currency THEN
    RAISE EXCEPTION 'عملة الدفعة % مختلفة عن عملة الحركة', v_pay_number
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM("allocatedAmount"), 0) INTO v_total_matched
    FROM "BankTransactionMatch"
    WHERE "bankTransactionId" = NEW."bankTransactionId" AND id != NEW.id;
  v_total_matched := v_total_matched + NEW."allocatedAmount";

  IF v_total_matched > v_txn_amount THEN
    RAISE EXCEPTION 'إجمالي المضاهاة الجزئية (%) هيتجاوز مبلغ الحركة (%)', v_total_matched, v_txn_amount
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_bank_transaction_match_consistency() FROM PUBLIC;

CREATE TRIGGER bank_transaction_match_consistency_check
  BEFORE INSERT OR UPDATE ON "BankTransactionMatch"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_bank_transaction_match_consistency();

-- الاتجاه التاني: ممنوع تفعيل المسار السريع (paymentId) على حركة عندها مضاهاة جزئية بالفعل.
CREATE OR REPLACE FUNCTION public.enforce_bank_transaction_no_mixed_matching()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_match_count INT;
BEGIN
  IF NEW."paymentId" IS NOT NULL THEN
    SELECT COUNT(*) INTO v_match_count FROM "BankTransactionMatch" WHERE "bankTransactionId" = NEW.id;
    IF v_match_count > 0 THEN
      RAISE EXCEPTION 'الحركة دي عندها مضاهاة جزئية بالفعل — شيلها الأول لو عايز تستخدم المسار السريع (paymentId)'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_bank_transaction_no_mixed_matching() FROM PUBLIC;

CREATE TRIGGER bank_transaction_no_mixed_matching_check
  BEFORE UPDATE ON "BankTransaction"
  FOR EACH ROW
  WHEN (NEW."paymentId" IS DISTINCT FROM OLD."paymentId")
  EXECUTE FUNCTION public.enforce_bank_transaction_no_mixed_matching();
