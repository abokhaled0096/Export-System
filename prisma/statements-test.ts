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
import { postInvoiceIssued, postPaymentCleared, postPaymentAllocated } from "../src/lib/accounting";
import { Prisma } from "../src/generated/prisma/client";
import { getDashboardData } from "../src/lib/dashboard";
import { countShipmentsNeedingAttention } from "../src/lib/logisticsAttention";
import { weekKey } from "../src/lib/treasuryLabels";
import { formatDate, toDateInputValue, businessYear } from "../src/lib/format";
import { amountToArabicWords } from "../src/lib/numberToArabicWords";
import { currencySchema, optionalCurrencySchema } from "../src/lib/currencySchema";

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

/**
 * دورة تحصيل كاملة بالحسابات القياسية (GL_ACCOUNTS): إصدار فاتورة → تحصيل دفعة →
 * تخصيصها على الفاتورة. الشرط النهائي: **الذمم المدينة وحساب الدفعات المعلَّقة الاتنين
 * يرجعوا صفر**، لأن العميل دفع كل حاجة.
 */
async function runCollectionCycle(
  orgId: string,
  periodId: string,
  preparedBy: string,
  opts: { direction: "Inbound" | "Outbound"; allocateRatio: number; label: string }
) {
  const { direction, allocateRatio, label } = opts;
  const isIn = direction === "Inbound";
  // الحسابات القياسية اللي محرك الترحيل بيدوّر عليها بالكود
  // ⚠️ 1010 (النقدية) موجود بالفعل من سيناريو القوائم المالية فوق — بنعيد استخدامه
  // بـupsert وما بنحذفوش في التنظيف، وإلا هنمسح قيود السيناريو التاني معاه.
  const std: Record<string, string> = {};
  const created: string[] = [];
  for (const [code, nameAr, type, nb] of [
    ["1010", "النقدية وما يعادلها", "Asset", "Debit"],
    ["1020", "حسابات مدينة — عملاء", "Asset", "Debit"],
    ["1035", "دفعات معلَّقة غير مخصَّصة", "Asset", "Debit"],
    ["2010", "حسابات دائنة — موردين", "Liability", "Credit"],
    ["2030", "ض.ق.م — مبيعات", "Liability", "Credit"],
    ["1040", "ض.ق.م — مشتريات", "Asset", "Debit"],
    ["4010", "إيرادات المبيعات", "Revenue", "Credit"],
    ["5010", "تكلفة المبيعات", "COGS", "Debit"],
    ["7020", "فروق العملة", "Revenue", "Credit"],
  ] as const) {
    const a = await prisma.chartOfAccount.upsert({
      where: { orgId_accountCode: { orgId, accountCode: code } },
      create: { orgId, accountCode: code, nameAr, nameEn: nameAr, accountType: type as never, normalBalance: nb as never },
      update: {},
    });
    std[code] = a.id;
    if (code !== "1010") created.push(a.id);
  }

  const issueDate = new Date("2026-08-20T00:00:00Z");
  const D = (n: string) => new Prisma.Decimal(n);

  const invoice = await prisma.invoice.create({
    data: {
      orgId, invoiceNumber: `CYCLE-INV-${label}`, invoiceType: "PurchaseInvoice", currency: "EGP",
      subtotal: D("0"), taxAmount: D("0"), totalAmount: D("0"),
      issueDate, dueDate: new Date("2026-09-20T00:00:00Z"),
    },
  });
  await prisma.invoiceLine.create({
    data: {
      orgId, invoiceId: invoice.id, lineNumber: 1, description: "بضاعة", quantity: D("100"),
      unit: "kg", unitPrice: D("150"), taxRatePct: D("14"), lineTotal: D("0"), lineTax: D("0"),
    },
  });
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });

  const je = await prisma.$transaction(async (tx) =>
    postInvoiceIssued(tx as never, {
      id: inv.id, orgId, invoiceNumber: inv.invoiceNumber,
      invoiceType: isIn ? "SalesInvoice" : "PurchaseInvoice", currency: inv.currency,
      subtotal: inv.subtotal, taxAmount: inv.taxAmount, totalAmount: inv.totalAmount,
      issueDate: inv.issueDate, dealId: null, supplierId: null,
    }, preparedBy)
  );
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: "Issued", journalEntryId: je } });

  const bankAccount = await prisma.bankAccount.create({
    data: { orgId, accountName: "حساب الدورة", bankName: "بنك الاختبار", currency: "EGP" },
  });
  const payment = await prisma.payment.create({
    data: {
      orgId, paymentNumber: `CYCLE-PAY-${label}`, direction, amount: inv.totalAmount,
      currency: "EGP", paymentDate: issueDate, createdBy: preparedBy, bankAccountId: bankAccount.id,
    },
  });
  const payJe = await prisma.$transaction(async (tx) =>
    postPaymentCleared(tx as never, {
      id: payment.id, orgId, paymentNumber: payment.paymentNumber, direction,
      amount: payment.amount, currency: payment.currency, paymentDate: payment.paymentDate, supplierId: null,
    }, preparedBy)
  );
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "Cleared", journalEntryId: payJe } });

  const allocAmount = inv.totalAmount.mul(allocateRatio).toDecimalPlaces(2);
  const allocJe = await prisma.$transaction(async (tx) =>
    postPaymentAllocated(tx as never, {
      orgId, paymentId: payment.id, invoiceId: inv.id,
      allocatedAmount: allocAmount, allocationDate: issueDate,
    }, preparedBy)
  );

  check(`[${label}] قيد التخصيص اترحّل`, String(allocJe !== null), "true");

  // الأرصدة النهائية من دفتر الأستاذ نفسه
  const bal = async (accountId: string) => {
    const g = await prisma.journalLine.aggregate({
      where: { accountId, journalEntry: { status: { in: ["Posted", "Reversed"] } } },
      _sum: { functionalDebit: true, functionalCredit: true },
    });
    return new Prisma.Decimal(g._sum.functionalDebit ?? 0).sub(g._sum.functionalCredit ?? 0);
  };
  // المتبقّي المتوقَّع على الذمة = الإجمالي − المخصَّص. الذمم المدينة رصيدها مدين،
  // والدائنة دائن — فبناخد القيمة المطلقة للمقارنة.
  const arApCode = isIn ? "1020" : "2010";
  const expectedRemaining = inv.totalAmount.sub(allocAmount).toFixed(2);
  check(`[${label}] رصيد ${isIn ? "الذمم المدينة" : "الذمم الدائنة"}`, (await bal(std[arApCode])).abs().toFixed(2), expectedRemaining);
  // الخاصية الحقيقية لحساب الدفعات المعلَّقة: رصيده = **الجزء غير المخصَّص من الدفعة**.
  // بيتصفّى لما تتخصّص الدفعة بالكامل، وبيفضل بالباقي لو التخصيص جزئي — وده الصح، مش عيب.
  const expectedClearing = payment.amount.sub(allocAmount);
  check(
    `[${label}] الدفعات المعلَّقة = الجزء غير المخصَّص`,
    (await bal(std["1035"])).toFixed(2),
    (isIn ? expectedClearing.neg() : expectedClearing).toFixed(2)
  );

  // تنظيف حسابات الدورة عشان ما تلخبطش فحوصات الميزانية اللي بعدها
  await prisma.$executeRawUnsafe(`ALTER TABLE "JournalLine" DISABLE TRIGGER USER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "JournalEntry" DISABLE TRIGGER USER`);
  try {
    await prisma.paymentAllocation.deleteMany({ where: { orgId } });
    await prisma.payment.deleteMany({ where: { orgId } });
    await prisma.invoice.deleteMany({ where: { orgId } });
    await prisma.bankAccount.deleteMany({ where: { orgId } });
    // بنحذف بنود القيود بتاعت الدورة دي بس (بالقيود نفسها) عشان ما نلمسش 1010
    await prisma.journalLine.deleteMany({ where: { orgId, journalEntryId: { in: [je, payJe, allocJe].filter(Boolean) as string[] } } });
    await prisma.journalEntry.deleteMany({ where: { orgId, id: { in: [je, payJe, allocJe].filter(Boolean) as string[] } } });
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE "JournalLine" ENABLE TRIGGER USER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "JournalEntry" ENABLE TRIGGER USER`);
  }
  await prisma.chartOfAccount.deleteMany({ where: { id: { in: created } } });
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

    // ---------- التحقق من العملة ----------
    // `length(3)` القديمة كانت بتقبل أي ٣ حروف. العملة بتتقارن حرفيًا في تخصيص الدفعات
    // على الفواتير وفي اختيار حساب النقدية — قيمة غلط بتعدّي وبعدين الفاتورة مابتتخصّصش
    // عليها دفعة ومحدش يعرف السبب.
    // ---------- دورة تحصيل كاملة بنفس العملة الوظيفية ----------
    // ⚠️ اختبار تراجُع لعيب حقيقي اتكشف بدورة بيع فعلية (30 سبتمبر): postPaymentAllocated
    // كانت بتخرج بـ`return null` لما عملة الفاتورة = العملة الوظيفية، فالقيد اللي بيصفّي
    // الذمة مكانش بيترحّل خالص. النتيجة: الفاتورة "مدفوعة" في شاشة الفواتير بينما دفتر
    // الأستاذ شايف الذمة قايمة وحساب الدفعات المعلَّقة بالسالب — للأبد.
    console.log("\n— دورة تحصيل كاملة (نفس العملة الوظيفية) —");
    // تحصيل كامل (الحالة اللي كشفت العيب)
    await runCollectionCycle(org.id, period.id, preparer.id, { direction: "Inbound", allocateRatio: 1, label: "تحصيل كامل" });
    // تحصيل جزئي — الذمة لازم تفضل بالباقي بالظبط مش صفر
    await runCollectionCycle(org.id, period.id, preparer.id, { direction: "Inbound", allocateRatio: 0.4, label: "تحصيل جزئي" });
    // الاتجاه المعاكس (مشتريات/سداد) — نفس الدالة، والفرع التاني منها
    await runCollectionCycle(org.id, period.id, preparer.id, { direction: "Outbound", allocateRatio: 1, label: "سداد مورّد" });

    // ---------- سنة العمل والترقيم ----------
    // ⚠️ عيب حقيقي اتكشف بتجربة دورة الإهلاك (30 سبتمبر): قيد الإهلاك بيترحّل على
    // `period.endDate` = 23:59:59 بتوقيت UTC، و`getFullYear()` بتوقيت القاهرة (+3) بتقرا
    // دي على إنها 2027-01-01 — فالقيد طلع JE-2027-00001 وهو في دفاتر 2026، ومضمون يتكرر
    // كل سنة. سنة القيد دلوقتي بتيجي من الفترة المحاسبية نفسها، وباقي الترقيم من businessYear.
    console.log("\n— سنة العمل والترقيم —");
    check("آخر ثانية في 2026 بتوقيت UTC = 2027 بتوقيت القاهرة", String(businessYear(new Date("2026-12-31T23:59:59Z"))), "2027");
    check("منتصف ليل 1 يناير بتوقيت القاهرة = السنة الجديدة", String(businessYear(new Date("2026-12-31T22:00:00Z"))), "2027");
    check("الظهر في 31 ديسمبر = 2026", String(businessYear(new Date("2026-12-31T12:00:00Z"))), "2026");
    check("تاريخ نصي جاي من فورم بيتقرا صح", String(businessYear("2026-06-15")), "2026");

    console.log("\n— التحقق من العملة —");
    const okCur = (v: string) => String(currencySchema.safeParse(v).success);
    check("XXX اترفضت", okCur("XXX"), "false");
    check("EURO اترفضت", okCur("EURO"), "false");
    check("عملة بالعربي اترفضت", okCur("يور"), "false");
    check("EUR اتقبلت", okCur("EUR"), "true");
    check("'  eur ' اتقبلت واتحوّلت", String(currencySchema.safeParse("  eur ").data), "EUR");
    check("الاختيارية بتقبل الفراغ", String(optionalCurrencySchema.safeParse("").success), "true");
    check("الاختيارية بترفض XXX", String(optionalCurrencySchema.safeParse("XXX").success), "false");

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

    // ⚠️ اللوحة وشارة التنقّل لازم يستخدموا **نفس** الدالة. قبل كده كان كل واحد بيحسب
    // "الشحنات المحتاجة انتباه" بطريقته: الشارة بتجمع الاستثناءات + التجاوزات الحرارية،
    // واللوحة بتعدّ الاستثناءات بس. النتيجة: شارة حمراء فيها 1 واللوحة بتقول "مفيش حاجة
    // مستنّية" في نفس اللحظة (اتكشف بتسجيل تجاوز حراري، 30 سبتمبر).
    const attention = await countShipmentsNeedingAttention(client as never, org.id);
    const dashAttention = dash.actions.find((a) => a.href === "/logistics")?.count ?? 0;
    check("اللوحة والشارة بيستخدموا نفس العدّاد", String(dashAttention), String(attention));

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
