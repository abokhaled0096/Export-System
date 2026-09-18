-- إصلاح عيب اتكشف بمراجعة ذاتية: enforce_bank_transaction_match_consistency (migration
-- 20260917200000) كان بيتأكد إن مجموع المضاهاة الجزئية مش هيتجاوز مبلغ *الحركة البنكية*
-- بس — بلا أي تحقق مقابل من ناحية *الدفعة* (Payment.amount). PaymentAllocation (المسار
-- المكافئ للفواتير) بيتأكد من الاتجاهين الاتنين (migration 20260901280000). النتيجة: دفعة
-- واحدة كانت تقدر تتضاهى جزئيًا مع أكتر من حركة بنكية مختلفة وتتجاوز قيمتها الحقيقية، لأن كل
-- إدخال كان بيتفحص لوحده مقابل حركته بس.

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
  v_pay_amount   DECIMAL;
  v_total_matched       DECIMAL;
  v_total_matched_by_pay DECIMAL;
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

  SELECT "bankAccountId", "currency", "paymentNumber", "amount"
    INTO v_pay_account, v_pay_currency, v_pay_number, v_pay_amount
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

  -- الاتجاه المقابل: مجموع المضاهاة الجزئية لهذه *الدفعة* عبر كل الحركات البنكية اللي اتضاهت
  -- بيها مينفعش يتجاوز مبلغ الدفعة نفسها — وإلا دفعة واحدة تقدر "تتصرف" أكتر من قيمتها الحقيقية
  -- عبر أكتر من حركة بنكية مختلفة.
  SELECT COALESCE(SUM("allocatedAmount"), 0) INTO v_total_matched_by_pay
    FROM "BankTransactionMatch"
    WHERE "paymentId" = NEW."paymentId" AND id != NEW.id;
  v_total_matched_by_pay := v_total_matched_by_pay + NEW."allocatedAmount";

  IF v_total_matched_by_pay > v_pay_amount THEN
    RAISE EXCEPTION 'إجمالي المضاهاة الجزئية للدفعة % (%) هيتجاوز مبلغ الدفعة نفسها (%)', v_pay_number, v_total_matched_by_pay, v_pay_amount
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;
