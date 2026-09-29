/**
 * تحقق فعلي من قائمة الدخل والميزانية العمومية على قاعدة بيانات حقيقية بسيناريو معروف
 * النتيجة سلفًا — نفس فلسفة prisma/rls-test.ts: الحساب المالي ما ينفعش يتأكد بقراءة الكود،
 * لازم يتحط عليه أرقام ويتقارن الناتج بحساب يدوي.
 *
 * السيناريو: رأس مال 100,000 نقدًا · مبيعات 60,000 على الحساب · تكلفة مبيعات 35,000 على
 * الحساب · مصروفات 5,000 نقدًا. النتيجة المتوقعة يدويًا: صافي ربح 20,000، وأصول 155,000
 * تساوي خصوم 35,000 + حقوق ملكية 120,000.
 *
 * التشغيل: npm run test:statements — بينشئ منظمة خاصة بيه وبينضّفها بالكامل في finally.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { computeIncomeStatement, computeBalanceSheet } from "../src/lib/financialStatements";
import { getDashboardData } from "../src/lib/dashboard";
import { weekKey } from "../src/lib/treasuryLabels";
import { formatDate, toDateInputValue } from "../src/lib/format";
import { amountToArabicWords } from "../src/lib/numberToArabicWords";

type Client = Parameters<typeof computeIncomeStatement>[0];

let pass = 0;
let fail = 0;
function check(label: string, actual: string, expected: string) {
  if (actual === expected) {
    pass++;
    console.log(`✓ ${label} = ${actual}`);
  } else {
    fail++;
    console.log(`❌ ${label} = ${actual} (المتوقع ${expected})`);
  }
}

(async () => {
  const org = await prisma.organization.create({
    data: { name: "Statements Scratch", legalName: "Statements Scratch", functionalCurrency: "EGP" },
  });

  try {
    const period = await prisma.accountingPeriod.create({
      data: { orgId: org.id, periodName: "2026-Q3", startDate: new Date("2026-07-01"), endDate: new Date("2026-09-30") },
    });

    const acc = async (code: string, nameAr: string, accountType: string, normalBalance: string) =>
      prisma.chartOfAccount.create({
        data: { orgId: org.id, accountCode: code, nameAr, nameEn: nameAr, accountType: accountType as never, normalBalance: normalBalance as never },
      });

    const cash = await acc("1010", "النقدية", "Asset", "Debit");
    const ar = await acc("1200", "ذمم مدينة", "Asset", "Debit");
    const ap = await acc("2100", "ذمم دائنة", "Liability", "Credit");
    const capital = await acc("3100", "رأس المال", "Equity", "Credit");
    const revenue = await acc("4100", "إيراد التصدير", "Revenue", "Credit");
    const cogs = await acc("5100", "تكلفة المبيعات", "COGS", "Debit");
    const expense = await acc("6100", "مصروفات إدارية", "Expense", "Debit");

    // قيد بسيط مرحَّل — functionalDebit/Credit بيتحسبوا بالـTrigger (العملة = العملة الوظيفية).
    const role = await prisma.role.create({ data: { orgId: org.id, name: "Finance" } });
    const preparer = await prisma.user.create({
      data: { id: crypto.randomUUID(), orgId: org.id, fullName: "محاسب الفحص", email: "stmt@test.local", roleId: role.id },
    });

    const post = async (desc: string, lines: { accountId: string; debit?: number; credit?: number }[]) => {
      const entry = await prisma.journalEntry.create({
        data: {
          organization: { connect: { id: org.id } },
          entryNumber: `JE-${desc}-${Math.random().toString(36).slice(2, 8)}`,
          entryDate: new Date("2026-08-15"),
          period: { connect: { id: period.id } },
          sourceType: "Manual",
          preparedByUser: { connect: { id: preparer.id } },
          description: desc,
          status: "Draft",
          lines: {
            create: lines.map((l) => ({
              orgId: org.id,
              accountId: l.accountId,
              debit: l.debit ?? 0,
              credit: l.credit ?? 0,
              currency: "EGP",
            })),
          },
        },
      });
      await prisma.journalEntry.update({ where: { id: entry.id }, data: { status: "Posted" } });
    };

    // 1) رأس مال 100,000 نقدًا
    await post("capital", [
      { accountId: cash.id, debit: 100000 },
      { accountId: capital.id, credit: 100000 },
    ]);
    // 2) مبيعات 60,000 على الحساب
    await post("sale", [
      { accountId: ar.id, debit: 60000 },
      { accountId: revenue.id, credit: 60000 },
    ]);
    // 3) تكلفة مبيعات 35,000 على الحساب
    await post("cogs", [
      { accountId: cogs.id, debit: 35000 },
      { accountId: ap.id, credit: 35000 },
    ]);
    // 4) مصروفات إدارية 5,000 نقدًا
    await post("opex", [
      { accountId: expense.id, debit: 5000 },
      { accountId: cash.id, credit: 5000 },
    ]);

    const client = prisma as unknown as Client;

    console.log("\n— قائمة الدخل —");
    const is = await computeIncomeStatement(client, org.id, { periodId: period.id });
    check("الإيرادات", is.totalRevenue.toFixed(2), "60000.00");
    check("تكلفة المبيعات", is.totalCogs.toFixed(2), "35000.00");
    check("مجمل الربح", is.grossProfit.toFixed(2), "25000.00");
    check("المصروفات", is.totalExpenses.toFixed(2), "5000.00");
    check("صافي الربح", is.netProfit.toFixed(2), "20000.00");
    check("هامش مجمل الربح", is.grossMarginPct!.toFixed(2), "41.67");
    check("هامش صافي الربح", is.netMarginPct!.toFixed(2), "33.33");

    // نفس الأرقام بلا فلتر فترة خالص — المسار ده كان بيبني `{ entryDate: {} }` ويعلّق
    // الصفحة على "جاري التحميل" بلا أي خطأ ظاهر (اتكشف على الإنتاج، 29 سبتمبر).
    const isAll = await computeIncomeStatement(client, org.id, {});
    check("صافي الربح بلا فلتر فترة", isAll.netProfit.toFixed(2), "20000.00");

    // مدى تواريخ مفتوح من ناحية واحدة
    const isFrom = await computeIncomeStatement(client, org.id, { from: new Date("2026-08-01") });
    check("صافي الربح من 2026-08-01", isFrom.netProfit.toFixed(2), "20000.00");
    const isBefore = await computeIncomeStatement(client, org.id, { to: new Date("2026-08-01") });
    check("صافي الربح لحد 2026-08-01", isBefore.netProfit.toFixed(2), "0.00");

    console.log("\n— الميزانية العمومية —");
    const bs = await computeBalanceSheet(client, org.id, new Date("2026-09-30"));
    // نقدية 100,000 − 5,000 = 95,000 · ذمم مدينة 60,000 → أصول 155,000
    check("الأصول", bs.totalAssets.toFixed(2), "155000.00");
    check("الخصوم", bs.totalLiabilities.toFixed(2), "35000.00");
    check("حقوق الملكية المُرحَّلة", bs.totalEquityPosted.toFixed(2), "100000.00");
    check("أرباح غير مقفولة", bs.retainedEarnings.toFixed(2), "20000.00");
    check("إجمالي حقوق الملكية", bs.totalEquity.toFixed(2), "120000.00");
    check("الخصوم + حقوق الملكية", bs.totalLiabilitiesAndEquity.toFixed(2), "155000.00");
    check("الفرق", bs.difference.toFixed(2), "0.00");
    check("متزنة؟", String(bs.isBalanced), "true");

    // الميزانية قبل أي حركة لازم تبقى أصفار متزنة
    const before = await computeBalanceSheet(client, org.id, new Date("2026-01-01"));
    check("ميزانية قبل النشاط متزنة", String(before.isBalanced), "true");
    check("أصول قبل النشاط", before.totalAssets.toFixed(2), "0.00");

    // ---------- لوحة القيادة ----------
    // التجميع الشهري بيحصل في JS فوق نتيجة findMany (مش date_trunc في SQL) — الفحص ده
    // بيتأكد إن البَكَتة بالشهر واتجاه الحساب الدائن مظبوطين على أرقام حقيقية.
    // ---------- عقد صيغ التواريخ ----------
    // العيب اللي حصل فعلًا (٢٩ سبتمبر): codemod حوّل `weekKey` لصيغة عرض، وناتجها بيتبعت
    // كقيمة فورم وبيتقري بـ`new Date()` — "29/09/2026" = Invalid Date وتاريخ باظ في القاعدة.
    // الفحوص دي بتقفل الباب على تكرار نفس الغلط: قيمة تتقري آليًا ≠ نص يتعرض للمستخدم.
    console.log("\n— عقد صيغ التواريخ —");
    const sampleMonday = new Date("2026-09-28T00:00:00Z");
    check("weekKey بيفضل ISO (قيمة فورم)", weekKey(sampleMonday), "2026-09-28");
    check("new Date(weekKey(...)) تاريخ صالح", String(!Number.isNaN(new Date(weekKey(sampleMonday)).getTime())), "true");
    check("formatDate للعرض dd/mm/yyyy", formatDate(sampleMonday), "28/09/2026");
    check("toDateInputValue لـ<input type=date>", toDateInputValue(sampleMonday), "2026-09-28");
    // تاريخ متأخر بتوقيت UTC بيقع في اليوم اللي بعده بتوقيت القاهرة
    check("formatDate بيحترم توقيت القاهرة", formatDate(new Date("2026-09-29T22:30:00Z")), "30/09/2026");

    // ---------- التفقيط ----------
    // الفاتورة التجارية وخطاب الاعتماد لازم فيهم الإجمالي كتابةً، والبنك بيقارنه بالأرقام.
    // الصرف العربي فيه مثنّى وجمع قلّة — سهل جدًا يطلع غلط من غير فحص.
    console.log("\n— التفقيط بالعربي —");
    const w = (n: number | string, c: string) => amountToArabicWords(n, c);
    check("صفر", w(0, "EGP"), "فقط صفر جنيه مصري لا غير");
    check("مفرد", w(1, "EGP"), "فقط واحد جنيه مصري لا غير");
    check("المثنّى (ألفان)", w(2000, "EGP"), "فقط ألفان جنيه مصري لا غير");
    check("جمع القلّة (ثلاثة آلاف)", w(3000, "EGP"), "فقط ثلاثة آلاف جنيه مصري لا غير");
    check("ما فوق العشرة مفرد", w(11000, "EGP"), "فقط أحد عشر ألف جنيه مصري لا غير");
    check("العطف بالعشرات", w(45, "EGP"), "فقط خمسة وأربعون جنيه مصري لا غير");
    check("المئات", w(200, "EGP"), "فقط مائتان جنيه مصري لا غير");
    check("إجمالي فاتورة حقيقي", w("3216.15", "EUR"), "فقط ثلاثة آلاف ومائتان وستة عشر يورو وخمسة عشر سنت لا غير");
    check("الكسور بتتقرّب", w("0.155", "EGP"), "فقط صفر جنيه مصري وستة عشر قرش لا غير");
    check("عملة مش معروفة بترجع بالرمز", w(5, "XYZ"), "فقط خمسة XYZ لا غير");

    console.log("\n— لوحة القيادة —");
    const dash = await getDashboardData(client as never, org.id);
    check("العملة الوظيفية", dash.currency, "EGP");
    check("عدد شهور الرسم البياني", String(dash.monthlyRevenue.length), "6");
    const augRevenue = dash.monthlyRevenue.find((m) => m.month === "أغسطس");
    check("إيراد أغسطس في الرسم الشهري", String(augRevenue?.revenue ?? "مفقود"), "60000");
    check(
      "باقي الشهور صفر",
      String(dash.monthlyRevenue.filter((m) => m.month !== "أغسطس").every((m) => m.revenue === 0)),
      "true"
    );
    check("مفيش مستحق على العملاء (مفيش فواتير مبيعات)", dash.outstandingReceivables.toFixed(2), "0.00");

    console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass}/${pass + fail} فحوصات ناجحة`);
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE "JournalLine" DISABLE TRIGGER USER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "JournalEntry" DISABLE TRIGGER USER`);
    try {
      await prisma.journalLine.deleteMany({ where: { orgId: org.id } });
      await prisma.journalEntry.deleteMany({ where: { orgId: org.id } });
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "JournalLine" ENABLE TRIGGER USER`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "JournalEntry" ENABLE TRIGGER USER`);
    }
    await prisma.accountingPeriod.deleteMany({ where: { orgId: org.id } });
    await prisma.chartOfAccount.deleteMany({ where: { orgId: org.id } });
    await prisma.user.deleteMany({ where: { orgId: org.id } });
    await prisma.role.deleteMany({ where: { orgId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    console.log("✓ اتنضّفت بيانات الفحص");
    await prisma.$disconnect();
    if (fail > 0) process.exit(1);
  }
})();
