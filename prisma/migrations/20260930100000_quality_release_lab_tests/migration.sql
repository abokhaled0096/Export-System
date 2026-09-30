-- enforce_quality_release_lab_tests — ممنوع **إفراج كامل** (QualityRelease.status='Released')
-- عن دفعة إنتاج فيها فحص معملي فاشل، أو فحص نتيجته الفعلية بره حدوده المسجَّلة.
--
-- ليه Trigger مش تحقق واجهة (CLAUDE.md، قواعد غير قابلة للتفاوض):
-- ده قيد عمل حرج بنفس خطورة "سعر تحت walk-away" — دفعة فيها تجاوز حد متبقيات مبيدات
-- (MRL) لو اتفرج عنها كاملة بتتحوّل لشحنة، والشحنة بترفض على الحدود الأوروبية (RASFF)
-- بعد ما تكون التكلفة اتصرفت كلها. الواجهة بتمنع، لكن الـSeed والسكريبتات وأي استدعاء
-- مباشر لـPrisma كان بيعدّي.
--
-- ليه بنمنع كمان الفحص اللي نتيجته بره الحدود ومتسجّل **«ناجح»**:
-- اتكشف بتجربة فعلية (30 سبتمبر) إن الحدود والنتيجة والحُكم كانوا حقول مستقلة تمامًا بلا
-- أي فحص متقاطع — سجّلت Chlorpyrifos نتيجة 0.12 والحد الأقصى 0.05 وحُكم «ناجح»، والسيستم
-- قبلها بشارة خضراء. لو منعنا الفاشل بس، التحايل على القيد بقى تغيير قيمة واحدة في dropdown.
-- التناقض نفسه هو اللي بيمنع.
--
-- المخرج المشروع لما يكون فيه سبب فني حقيقي (إعادة فحص، عدم تأكد القياس، حدود سوق مختلفة):
-- **إفراج مشروط** (ConditionalRelease) — قرار موثَّق باسمه في AuditLog، مش إفراج كامل صامت.
--
-- ⚠️ نفس المنطق مكرَّر في TypeScript في src/lib/labTestVerdict.ts
-- (`labTestsBlockingFullRelease`) علشان الواجهة تعرض السبب قبل المحاولة — أي تعديل هنا
-- لازم يتعدّل هناك، وعنده اختبار في prisma/statements-test.ts.

CREATE OR REPLACE FUNCTION public.enforce_quality_release_lab_tests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed INTEGER;
  v_out_of_limits INTEGER;
BEGIN
  IF NEW."status" != 'Released' THEN
    RETURN NEW;
  END IF;

  SELECT
    count(*) FILTER (WHERE "passFail" = 'Fail'),
    count(*) FILTER (
      WHERE "actualResult" IS NOT NULL
        AND (
          ("minLimit" IS NOT NULL AND "actualResult" < "minLimit")
          OR ("maxLimit" IS NOT NULL AND "actualResult" > "maxLimit")
        )
    )
  INTO v_failed, v_out_of_limits
  FROM "LabTest"
  WHERE "batchId" = NEW."batchId";

  IF v_failed > 0 THEN
    RAISE EXCEPTION 'مينفعش إفراج كامل (Released) عن دفعة فيها % فحص معملي فاشل — استخدم إفراج مشروط (ConditionalRelease) أو احتجاز (Held)', v_failed
      USING ERRCODE = '23514';
  END IF;

  IF v_out_of_limits > 0 THEN
    RAISE EXCEPTION 'مينفعش إفراج كامل (Released) عن دفعة فيها % فحص معملي نتيجته بره الحدود المسجَّلة — صحّح الحدود أو الحُكم، أو استخدم إفراج مشروط (ConditionalRelease)', v_out_of_limits
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_quality_release_lab_tests() FROM PUBLIC;

DROP TRIGGER IF EXISTS quality_release_lab_tests_check ON "QualityRelease";
CREATE TRIGGER quality_release_lab_tests_check
  BEFORE INSERT OR UPDATE ON "QualityRelease"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quality_release_lab_tests();
