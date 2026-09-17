-- محرك جدولة أقساط قروض تلقائي (BACKLOG.md § وحدة 8 — "جدولة أقساط القروض يدوية بالكامل").
-- الحقلان دول لازم يتحددوا مع بعض وقت إنشاء القرض عشان يفعّلوا زرار "توليد جدول الأقساط" —
-- لو فاضيين (قروض قديمة)، الجدولة تفضل يدوية بالكامل زي ما كانت دايمًا.
CREATE TYPE "LoanAmortizationMethod" AS ENUM ('EqualInstallment', 'EqualPrincipal');

ALTER TABLE "Loan" ADD COLUMN "numberOfInstallments" INTEGER,
ADD COLUMN "amortizationMethod" "LoanAmortizationMethod";
