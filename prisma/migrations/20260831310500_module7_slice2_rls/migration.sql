-- تفعيل RLS على Batch/Inspection/QualityRelease/Lot (نفس نمط باقي الوحدات) + أول Trigger
-- لسلسلة الإنتاج/الجودة: enforce_lot_quality_release — بيترجم المخطط في docs/ERD.md §10
-- (QualityRelease ==>|يفرج عن| Lot) لقيد قاعدة بيانات حقيقي: ممنوع أي Lot يتعلّم
-- qualityStatus='Released' من غير QualityRelease معتمد فعليًا (lotId مطابق، أو batchId مطابق
-- لو لسه الـQualityRelease اتعمل قبل ما يتحدد lotId). نفس فلسفة enforce_gate_origin_proof_verified
-- (فحص وجود صف مرتبط بحالة معيّنة)، بس هنا الفحص إيجابي (لازم يوجد) مش سلبي.

ALTER TABLE "Batch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY batch_org_isolation ON "Batch"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Inspection" ENABLE ROW LEVEL SECURITY;
CREATE POLICY inspection_org_isolation ON "Inspection"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "QualityRelease" ENABLE ROW LEVEL SECURITY;
CREATE POLICY quality_release_org_isolation ON "QualityRelease"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Lot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY lot_org_isolation ON "Lot"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ============ Trigger: منع Lot.qualityStatus='Released' بلا QualityRelease معتمد ============
CREATE OR REPLACE FUNCTION public.enforce_lot_quality_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released BOOLEAN;
BEGIN
  IF NEW."qualityStatus" != 'Released' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "QualityRelease"
    WHERE ("lotId" = NEW.id OR ("lotId" IS NULL AND "batchId" = NEW."batchId"))
      AND "status" IN ('Released', 'PartialRelease', 'ConditionalRelease')
  ) INTO v_released;

  IF NOT v_released THEN
    RAISE EXCEPTION 'مينفعش تعلّم الدفعة (Lot) كـ"مُفرَج عنها جودة" (Released) من غير QualityRelease معتمد بحالة Released/PartialRelease/ConditionalRelease لنفس الدفعة أو نفس دفعة الإنتاج'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_lot_quality_release() FROM PUBLIC;

CREATE TRIGGER lot_quality_release_check
  BEFORE INSERT OR UPDATE ON "Lot"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lot_quality_release();
