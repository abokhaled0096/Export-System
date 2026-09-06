-- تصليب دفتر الأستاذ (وحدة 8، الشريحة الأولى) — سد 5 ثغرات سلامة بيانات اتلقطت في مراجعة نقدية
-- بعد النشر الأول (1 سبتمبر). القاعدة المحاسبية الحاكمة: القيد المرحّل لا يُعدَّل أبدًا — التصحيح
-- الشرعي الوحيد قيد عكسي (Reversal). راجع docs/ERD.md §11.1 وSTATUS.md.

-- ============ 1. immutability للقيد المرحّل — Posted لا يُعدَّل إلا لـReversed، وReversed نهائي ============
CREATE OR REPLACE FUNCTION public.enforce_journal_entry_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD."status" = 'Reversed' THEN
    RAISE EXCEPTION 'القيد % معكوس (Reversed) — سجل نهائي لا يُعدَّل', OLD."entryNumber"
      USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'Posted' THEN
    IF NEW."status" = 'Draft' THEN
      RAISE EXCEPTION 'مينفعش إرجاع قيد مرحّل (%) لمسودة — القيد المرحّل لا يُعدَّل، التصحيح بقيد عكسي (Reversal) بس', OLD."entryNumber"
        USING ERRCODE = '23514';
    END IF;
    IF NEW."status" NOT IN ('Posted', 'Reversed')
       OR NEW."entryDate" IS DISTINCT FROM OLD."entryDate"
       OR NEW."periodId" IS DISTINCT FROM OLD."periodId"
       OR NEW."entryNumber" IS DISTINCT FROM OLD."entryNumber"
       OR NEW."sourceType" IS DISTINCT FROM OLD."sourceType"
       OR NEW."preparedBy" IS DISTINCT FROM OLD."preparedBy"
       OR NEW."reversalOfId" IS DISTINCT FROM OLD."reversalOfId" THEN
      RAISE EXCEPTION 'القيد % مرحّل (Posted) — لا يُعدَّل، التصحيح بقيد عكسي (Reversal) بس', OLD."entryNumber"
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_journal_entry_immutability() FROM PUBLIC;

CREATE TRIGGER journal_entry_immutability_check
  BEFORE UPDATE ON "JournalEntry"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_journal_entry_immutability();

-- حذف قيد غير-مسودة مرفوض
CREATE OR REPLACE FUNCTION public.enforce_journal_entry_no_delete_posted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD."status" != 'Draft' THEN
    RAISE EXCEPTION 'مينفعش حذف قيد % حالته % — المسودات (Draft) بس القابلة للحذف', OLD."entryNumber", OLD."status"
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_journal_entry_no_delete_posted() FROM PUBLIC;

CREATE TRIGGER journal_entry_no_delete_posted_check
  BEFORE DELETE ON "JournalEntry"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_journal_entry_no_delete_posted();

-- ============ 2. immutability لبنود القيد — أي لمسة لبنود قيد مش Draft مرفوضة ============
CREATE OR REPLACE FUNCTION public.enforce_journal_line_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id UUID;
  v_entry_status TEXT;
  v_entry_number TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entry_id := OLD."journalEntryId";
  ELSE
    v_entry_id := NEW."journalEntryId";
  END IF;
  SELECT "status", "entryNumber" INTO v_entry_status, v_entry_number FROM "JournalEntry" WHERE id = v_entry_id;

  IF v_entry_status IS DISTINCT FROM 'Draft' THEN
    RAISE EXCEPTION 'بنود القيد % لا تُعدَّل — القيد حالته % (المسودات بس قابلة للتعديل، التصحيح بقيد عكسي)', v_entry_number, v_entry_status
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_journal_line_immutability() FROM PUBLIC;

CREATE TRIGGER journal_line_immutability_check
  BEFORE INSERT OR UPDATE OR DELETE ON "JournalLine"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_journal_line_immutability();

-- ============ 3. توسيع قفل الفترة — INSERT بس كان ناقص: UPDATE/DELETE كمان ============
DROP TRIGGER IF EXISTS journal_line_period_lock_check ON "JournalLine";

CREATE OR REPLACE FUNCTION public.enforce_accounting_period_not_hard_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id UUID;
  v_period_status TEXT;
  v_period_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entry_id := OLD."journalEntryId";
  ELSE
    v_entry_id := NEW."journalEntryId";
  END IF;
  SELECT ap."status", ap."periodName" INTO v_period_status, v_period_name
    FROM "JournalEntry" je
    JOIN "AccountingPeriod" ap ON ap.id = je."periodId"
    WHERE je.id = v_entry_id;

  IF v_period_status = 'HardClosed' THEN
    RAISE EXCEPTION 'الفترة المحاسبية "%" مقفولة نهائيًا (HardClosed) — بنودها لا تُمَس، افتح قيد تسوية في فترة مفتوحة لاحقة', v_period_name
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER journal_line_period_lock_check
  BEFORE INSERT OR UPDATE OR DELETE ON "JournalLine"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_accounting_period_not_hard_closed();

-- ============ 4. توسيع فحص الترحيل — توازن + عملة موحّدة + الفترة لسه مش مقفولة نهائيًا ============
CREATE OR REPLACE FUNCTION public.enforce_journal_entry_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
  v_currency_count INTEGER;
  v_period_status TEXT;
  v_period_name TEXT;
BEGIN
  IF NEW."status" = 'Posted' AND (OLD."status" IS DISTINCT FROM 'Posted') THEN
    SELECT ap."status", ap."periodName" INTO v_period_status, v_period_name
      FROM "AccountingPeriod" ap WHERE ap.id = NEW."periodId";
    IF v_period_status = 'HardClosed' THEN
      RAISE EXCEPTION 'مينفعش ترحيل القيد % — فترته "%" اتقفلت نهائيًا (HardClosed)، افتح قيد تسوية في فترة مفتوحة', NEW."entryNumber", v_period_name
        USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0), COUNT(DISTINCT "currency")
      INTO v_total_debit, v_total_credit, v_currency_count
      FROM "JournalLine"
      WHERE "journalEntryId" = NEW.id;

    IF v_currency_count > 1 THEN
      RAISE EXCEPTION 'القيد % فيه أكتر من عملة — القيود متعددة العملات مش مدعومة لسه (محتاجة محرك تحويل بسعر صرف فعلي)، كل البنود لازم تكون بعملة واحدة', NEW."entryNumber"
        USING ERRCODE = '23514';
    END IF;

    IF v_total_debit != v_total_credit THEN
      RAISE EXCEPTION 'القيد غير متوازن — إجمالي المدين (%) لازم يساوي إجمالي الدائن (%) قبل الترحيل', v_total_debit, v_total_credit
        USING ERRCODE = '23514';
    END IF;

    IF v_total_debit = 0 THEN
      RAISE EXCEPTION 'مينفعش ترحيل قيد بلا بنود — لازم يكون فيه بنود مدين/دائن فعلية'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============ 5. entryDate لازم يقع جوه نطاق الفترة ============
CREATE OR REPLACE FUNCTION public.enforce_entry_date_within_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_period_name TEXT;
BEGIN
  SELECT "startDate"::date, "endDate"::date, "periodName" INTO v_start, v_end, v_period_name
    FROM "AccountingPeriod" WHERE id = NEW."periodId";

  IF NEW."entryDate"::date < v_start OR NEW."entryDate"::date > v_end THEN
    RAISE EXCEPTION 'تاريخ القيد (%) برّه نطاق الفترة "%" (% إلى %)', NEW."entryDate"::date, v_period_name, v_start, v_end
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_entry_date_within_period() FROM PUBLIC;

CREATE TRIGGER journal_entry_date_within_period_check
  BEFORE INSERT OR UPDATE ON "JournalEntry"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_entry_date_within_period();
