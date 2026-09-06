-- تفعيل RLS على Supplier/Facility/SourcingRequest/SupplierQuote/PurchaseOrder (نفس نمط باقي
-- الوحدات) + أول Trigger إلزامي لوحدة 7: enforce_purchase_order_max_price — نفس نمط
-- enforce_quote_walk_away_price بالظبط بس عكسي (سقف مش أرضية). راجع docs/ERD.md §10 سطر 350-352:
-- "PurchaseOrder.unitPrice > SourcingRequest.maximumPurchasePrice يجب أن يُرفض على مستوى القاعدة
-- عبر ApprovalPolicy + Trigger، وليس فقط اعتماد على تحقق الواجهة — أول RLS/Trigger test لهذه الوحدة".

ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_org_isolation ON "Supplier"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Facility" ENABLE ROW LEVEL SECURITY;
CREATE POLICY facility_org_isolation ON "Facility"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "SourcingRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY sourcing_request_org_isolation ON "SourcingRequest"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "SupplierQuote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_quote_org_isolation ON "SupplierQuote"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_order_org_isolation ON "PurchaseOrder"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ============ Trigger: منع PurchaseOrder.unitPrice > SourcingRequest.maximumPurchasePrice ============
CREATE OR REPLACE FUNCTION public.enforce_purchase_order_max_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_price NUMERIC;
  v_approved BOOLEAN;
BEGIN
  SELECT "maximumPurchasePrice" INTO v_max_price FROM "SourcingRequest" WHERE id = NEW."sourcingRequestId";

  IF v_max_price IS NULL OR NEW."unitPrice" <= v_max_price THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "Approval"
    WHERE "subjectType" = 'PurchaseOrder.unitPrice_override'
      AND "subjectId" = NEW.id
      AND "decision" = 'Approved'
  ) INTO v_approved;

  IF NOT v_approved THEN
    RAISE EXCEPTION 'سعر الوحدة (%) أعلى من الحد الأقصى المسموح (maximumPurchasePrice = %) — لازم موافقة استثنائية معتمدة (Approval.subjectType = ''PurchaseOrder.unitPrice_override'') قبل الحفظ', NEW."unitPrice", v_max_price
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_purchase_order_max_price() FROM PUBLIC;

CREATE TRIGGER purchase_order_max_price_check
  BEFORE INSERT OR UPDATE ON "PurchaseOrder"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_purchase_order_max_price();
