// اختبار دخان يدوي — يتأكد إن نطاق P1 كامل شغّال فعليًا على قاعدة بيانات حقيقية،
// مش بس إن الـschema بيتولّد. يُشغَّل بـ: npx tsx prisma/smoke-test.ts
// (اختبار تطويري مؤقت — هيتشال لما يبقى فيه Test Suite حقيقي بـVitest/Playwright)
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const org = await prisma.organization.create({
    data: { name: "أبوهيبة للتصدير", legalName: "Abu Heiba Export Co." },
  });
  console.log("✓ Organization:", org.id);

  const role = await prisma.role.create({
    data: { orgId: org.id, name: "SalesRep", isSystemRole: true },
  });
  console.log("✓ Role:", role.id);

  const user = await prisma.user.create({
    data: {
      id: crypto.randomUUID(), // مؤقتًا — في الإنتاج ده بيساوي auth.users.id من Supabase
      orgId: org.id,
      fullName: "مسؤول مبيعات تجريبي",
      email: "sales@test.local",
      roleId: role.id,
    },
  });
  console.log("✓ User:", user.id, "role uuidv7-ordered id:", org.id.startsWith("0"));

  const product = await prisma.product.create({
    data: {
      orgId: org.id,
      nameAr: "فراولة مجمدة",
      nameEn: "Frozen Strawberry",
      hsCode: "0811.10",
      category: "Frozen Fruits",
      originCountry: "Egypt",
      availableMonths: [3, 4, 5],
      status: "Verified",
    },
  });
  console.log("✓ Product:", product.id);

  const market = await prisma.market.create({
    data: {
      orgId: org.id,
      countryNameAr: "ألمانيا",
      countryNameEn: "Germany",
      countryCode: "DE",
      continent: "Europe",
      currency: "EUR",
      mainPorts: ["Hamburg"],
    },
  });
  console.log("✓ Market:", market.id);

  const pma = await prisma.productMarketAnalysis.create({
    data: {
      orgId: org.id,
      productId: product.id,
      marketId: market.id,
      year: 2026,
      opportunityScore: 78,
      riskScore: 30,
      recommendation: "Start",
    },
  });
  console.log("✓ ProductMarketAnalysis:", pma.id);

  const company = await prisma.company.create({
    data: {
      orgId: org.id,
      legalName: "Muster Import GmbH",
      country: "Germany",
      classification: ["Importer"],
      ownerId: user.id,
    },
  });
  console.log("✓ Company:", company.id);

  const opportunity = await prisma.opportunity.create({
    data: {
      orgId: org.id,
      companyId: company.id,
      productId: product.id,
      marketId: market.id,
      ownerId: user.id,
      stage: "NewLead",
      currency: "EUR",
      indicativeIncoterm: "FOB",
    },
  });
  console.log("✓ Opportunity:", opportunity.id, "stage:", opportunity.stage);

  await prisma.auditLog.create({
    data: {
      orgId: org.id,
      userId: user.id,
      action: "opportunity.created",
      entityType: "Opportunity",
      entityId: opportunity.id,
      afterValue: { stage: "NewLead" },
    },
  });
  console.log("✓ AuditLog entry written");

  // تأكيد الربط الكامل: هات الفرصة برجوع للشركة والمنتج والسوق والمالك سطر واحد
  const full = await prisma.opportunity.findUniqueOrThrow({
    where: { id: opportunity.id },
    include: { company: true, product: true, market: true, owner: true },
  });
  console.log(
    "✓ سلسلة كاملة:",
    full.company.legalName,
    "→",
    full.product.nameAr,
    "→",
    full.market.countryNameAr,
    "(مالك:",
    full.owner?.fullName + ")"
  );

  // تنظيف — الاختبار ده مؤقت وما ينفعش يسيب بيانات وهمية دائمة
  await prisma.opportunity.delete({ where: { id: opportunity.id } });
  await prisma.company.delete({ where: { id: company.id } });
  await prisma.productMarketAnalysis.delete({ where: { id: pma.id } });
  await prisma.market.delete({ where: { id: market.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.auditLog.deleteMany({ where: { orgId: org.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.role.delete({ where: { id: role.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  console.log("✓ تنظيف البيانات التجريبية");
}

main()
  .then(() => console.log("\n✅ P1 smoke test: كل السلسلة شغالة فعليًا على قاعدة بيانات حقيقية"))
  .catch((e) => {
    console.error("❌ فشل الاختبار:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
