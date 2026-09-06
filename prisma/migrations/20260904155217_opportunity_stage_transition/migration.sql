-- تفعيل تدفّق انتقال مرحلة حقيقي لـOpportunity.stage — كان مؤجَّل عمدًا من البناء الأصلي
-- (30 أغسطس) لغياب أي مسار تعديل، وده أول مسار حقيقي (updateOpportunityStageAction).
-- ⚠️ القيد ده كان موثّق صراحةً في docs/ERD.md §6 (سطر 247) وBACKLOG.md كـ"قابل للتلاعب
-- بلا Trigger" — دلوقتي بقى قابل للانتهاك عمليًا (فيه UI فعلي)، فلازم يتمنع على مستوى القاعدة.
CREATE OR REPLACE FUNCTION public.enforce_opportunity_rfq_before_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW."stage" = 'QuoteSent' AND (TG_OP = 'INSERT' OR OLD."stage" IS DISTINCT FROM 'QuoteSent') THEN
    IF NOT EXISTS (SELECT 1 FROM "RFQAnalysis" WHERE "opportunityId" = NEW."id") THEN
      RAISE EXCEPTION 'مينفعش الوصول لمرحلة "تم إرسال عرض" بلا تحليل RFQ واحد على الأقل مسجَّل للفرصة'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_opportunity_rfq_before_quote() FROM PUBLIC;

CREATE TRIGGER opportunity_rfq_before_quote_check
  BEFORE INSERT OR UPDATE ON "Opportunity"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_opportunity_rfq_before_quote();
