-- ============ محرك فروق العملة (FX Gain/Loss) — إضافة اختيارية بالكامل ============
-- الميزة اتفعّل بس لو Organization.functionalCurrency اتحطّت صراحةً. لو فاضية (NULL، الحالة
-- الافتراضية لكل المنظمات الحالية والجديدة)، السلوك القديم فاضل زي ما هو بالحرف: كل قيد لازم
-- يكون بعملة واحدة، بلا أي حساب فروق عملة — صفر تغيير سلوك، وكل الـ184 اختبار RLS الحالي
-- بيفضل ينجح بلا أي تعديل. راجع BACKLOG.md § وحدة 8 و STATUS.md للسياق الكامل.

-- ============ 1. الأعمدة الجديدة (IF NOT EXISTS — الملف ده resumable لو فشل نص تنفيذ) ============
ALTER TABLE "JournalLine" ADD COLUMN IF NOT EXISTS "functionalCredit" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "JournalLine" ADD COLUMN IF NOT EXISTS "functionalDebit" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "functionalCurrency" CHAR(3);

-- Backfill: كل البنود الموجودة (Organization.functionalCurrency كانت مفيهاش عمود أصلًا، يعني
-- "بلا تحويل عملة" ضمنيًا) — القيمة الوظيفية = القيمة الخام بالحرف، نفس منطق الفرع الأول في
-- الـTrigger تحت. session_replication_role=replica بيعطّل كل التريجرز مؤقتًا (شامل immutability
-- الـPosted) لسطر الـUPDATE ده بس — مقبول هنا لأن القيمة الجديدة مُشتقّة حتميًا من debit/credit
-- الثابتين نفسهم (مفيش تغيير في الجوهر المالي للقيد)، عكس تعديل مبلغ حقيقي بعد الترحيل.
SET session_replication_role = replica;
UPDATE "JournalLine" SET "functionalDebit" = "debit", "functionalCredit" = "credit";
SET session_replication_role = DEFAULT;

-- ============ 2. حسابان جداد في شجرة الحسابات لكل منظمة موجودة بالفعل ============
-- "1035" دفعات معلَّقة غير مخصَّصة: بيتحصّل/بيتسدّد فيه Cash Dr/Cr وقت تحصيل الدفعة نفسها
-- (postPaymentCleared)، وبيتصفّى بند بند وقت التخصيص الفعلي لفاتورة (createPaymentAllocation) —
-- ده اللي بيفصل "استلام الفلوس" عن "مطابقتها لفاتورة معيّنة"، وهو الفصل اللازم عشان فرق العملة
-- المحقَّق يتحسب صح لكل فاتورة على حدة (سعر صرف إصدارها) مش على مستوى الدفعة الإجمالي.
-- "7020" أرباح وخسائر فروق العملة: بند غير تشغيلي (بلا parentCode، نفس نمط 7010 التخلص من
-- الأصول) — دائن = ربح، مدين = خسارة (نفس اتفاقية ASSET_DISPOSAL_GAIN_LOSS بالحرف).
INSERT INTO "ChartOfAccount" ("id", "orgId", "accountCode", "nameAr", "nameEn", "accountType", "normalBalance", "isActive", "createdAt", "updatedAt")
SELECT uuidv7(), o.id, '1035', 'دفعات معلَّقة غير مخصَّصة', 'Unapplied Payments Clearing', 'Asset', 'Debit', true, now(), now()
FROM "Organization" o
WHERE NOT EXISTS (SELECT 1 FROM "ChartOfAccount" c WHERE c."orgId" = o.id AND c."accountCode" = '1035');

INSERT INTO "ChartOfAccount" ("id", "orgId", "accountCode", "nameAr", "nameEn", "accountType", "normalBalance", "isActive", "createdAt", "updatedAt")
SELECT uuidv7(), o.id, '7020', 'أرباح وخسائر فروق العملة', 'FX Gain/Loss', 'Expense', 'Debit', true, now(), now()
FROM "Organization" o
WHERE NOT EXISTS (SELECT 1 FROM "ChartOfAccount" c WHERE c."orgId" = o.id AND c."accountCode" = '7020');

-- ============ 3. حساب القيمة الوظيفية تلقائيًا لكل بند (BEFORE INSERT/UPDATE) ============
CREATE OR REPLACE FUNCTION public.compute_journal_line_functional_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_functional_currency CHAR(3);
  v_base CHAR(3);
  v_quote CHAR(3);
  v_rate NUMERIC;
BEGIN
  SELECT "functionalCurrency" INTO v_functional_currency FROM "Organization" WHERE id = NEW."orgId";

  -- المنظمة لسه ما فعّلتش محاسبة العملة الوظيفية، أو البند أصلًا بعملة المنظمة نفسها — القيمة
  -- الوظيفية = القيمة الخام بالحرف، بلا أي حاجة لسعر صرف.
  IF v_functional_currency IS NULL OR NEW."currency" = v_functional_currency THEN
    NEW."functionalDebit" := NEW."debit";
    NEW."functionalCredit" := NEW."credit";
    RETURN NEW;
  END IF;

  IF NEW."fxRateId" IS NULL THEN
    RAISE EXCEPTION 'بند بعملة % مختلفة عن عملة المنظمة الوظيفية (%) — لازم يتحدَّد سعر صرف (fxRateId) عشان يُترجَم لقيمته الوظيفية', NEW."currency", v_functional_currency
      USING ERRCODE = '23514';
  END IF;

  SELECT "baseCurrency", "quoteCurrency", "rate" INTO v_base, v_quote, v_rate FROM "ExchangeRate" WHERE id = NEW."fxRateId";
  IF v_base IS NULL THEN
    RAISE EXCEPTION 'سعر الصرف المحدَّد (fxRateId) غير موجود' USING ERRCODE = '23514';
  END IF;
  IF v_base != NEW."currency" OR v_quote != v_functional_currency THEN
    RAISE EXCEPTION 'سعر الصرف لازم يكون من % لـ% بالظبط (عملة البند ← عملة المنظمة الوظيفية)، مش العكس', NEW."currency", v_functional_currency
      USING ERRCODE = '23514';
  END IF;

  NEW."functionalDebit" := NEW."debit" * v_rate;
  NEW."functionalCredit" := NEW."credit" * v_rate;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_journal_line_functional_amounts() FROM PUBLIC;

DROP TRIGGER IF EXISTS journal_line_compute_functional_amounts ON "JournalLine";
CREATE TRIGGER journal_line_compute_functional_amounts
  BEFORE INSERT OR UPDATE ON "JournalLine"
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_journal_line_functional_amounts();

-- ============ 4. توسيع فحص التوازن — بالقيمة الوظيفية لو العملة الوظيفية مفعّلة ============
-- نفس الدالة enforce_journal_entry_balanced (Trigger موجود بالفعل على JournalEntry من
-- 20260901270000_harden_gl_triggers) — CREATE OR REPLACE بس، مفيش تريجر جديد لازم.
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
  v_functional_currency CHAR(3);
BEGIN
  IF NEW."status" = 'Posted' AND (OLD."status" IS DISTINCT FROM 'Posted') THEN
    SELECT ap."status", ap."periodName" INTO v_period_status, v_period_name
      FROM "AccountingPeriod" ap WHERE ap.id = NEW."periodId";
    IF v_period_status = 'HardClosed' THEN
      RAISE EXCEPTION 'مينفعش ترحيل القيد % — فترته "%" اتقفلت نهائيًا (HardClosed)، افتح قيد تسوية في فترة مفتوحة', NEW."entryNumber", v_period_name
        USING ERRCODE = '23514';
    END IF;

    SELECT "functionalCurrency" INTO v_functional_currency FROM "Organization" WHERE id = NEW."orgId";

    IF v_functional_currency IS NULL THEN
      -- السلوك القديم بالحرف: عملة واحدة بس مسموحة، والتوازن على القيمة الخام.
      SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0), COUNT(DISTINCT "currency")
        INTO v_total_debit, v_total_credit, v_currency_count
        FROM "JournalLine"
        WHERE "journalEntryId" = NEW.id;

      IF v_currency_count > 1 THEN
        RAISE EXCEPTION 'القيد % فيه أكتر من عملة — القيود متعددة العملات مش مدعومة إلا لو فعّلت عملة وظيفية للمنظمة (Organization.functionalCurrency)', NEW."entryNumber"
          USING ERRCODE = '23514';
      END IF;
    ELSE
      -- عملة وظيفية مفعّلة: القيود ممكن تحتوي بنود بعملات مختلفة، والتوازن بيتفحص على القيمة
      -- الوظيفية (اللي اتحسبت لكل بند بـcompute_journal_line_functional_amounts وقت الإدخال).
      SELECT COALESCE(SUM("functionalDebit"), 0), COALESCE(SUM("functionalCredit"), 0)
        INTO v_total_debit, v_total_credit
        FROM "JournalLine"
        WHERE "journalEntryId" = NEW.id;
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
