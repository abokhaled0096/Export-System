-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "createdBy" UUID;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ فصل المهام: منشئ المورّد ≠ معتمِد أول دفعة له ============
-- المثال الحرفي من docs/ERD.md §12: "منشئ Supplier لازم يكون مختلف عن معتمِد أول Payment له".
-- كان مؤجَّل في BACKLOG.md لأن Supplier مكانش عنده createdBy أصلًا — العمود ده هو اللي بيسدّ
-- الدَين ده. البيانات القديمة (قبل العمود ده) بتفضل createdBy = NULL عمدًا (مفيش تلفيق منشئ
-- وهمي)، فالقاعدة مبتتفعّلش عليها تلقائيًا — نفس فلسفة enforce_segregation_of_duty_payment.
--
-- ⚠️ القاعدة مش مفروضة افتراضيًا — بتتفعّل بس لو فيه صف SegregationOfDutyRule فعّال بـ
-- action1='Supplier.Create' و action2='Payment.Approve'، نفس تصميم القاعدة الأصلية على Payment.
CREATE OR REPLACE FUNCTION public.enforce_segregation_of_duty_supplier_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_rule_active BOOLEAN;
  v_supplier_created_by UUID;
BEGIN
  IF NEW."approvedBy" IS NULL OR NEW."supplierId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."approvedBy" IS NOT DISTINCT FROM NEW."approvedBy" THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "SegregationOfDutyRule"
     WHERE "orgId" = NEW."orgId"
       AND "action1" = 'Supplier.Create'
       AND "action2" = 'Payment.Approve'
       AND "mustBeDifferentUser" = true
       AND "isActive" = true
  ) INTO v_rule_active;

  IF NOT v_rule_active THEN
    RETURN NEW;
  END IF;

  SELECT "createdBy" INTO v_supplier_created_by FROM "Supplier" WHERE "id" = NEW."supplierId";

  IF v_supplier_created_by IS NOT NULL AND v_supplier_created_by = NEW."approvedBy" THEN
    RAISE EXCEPTION 'فصل المهام مفعّل — منشئ المورّد لازم يكون شخص مختلف عن معتمِد الدفعة % ليه', NEW."paymentNumber"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_segregation_of_duty_supplier_payment() FROM PUBLIC;

CREATE TRIGGER payment_supplier_segregation_of_duty_check
  BEFORE INSERT OR UPDATE ON "Payment"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_segregation_of_duty_supplier_payment();
