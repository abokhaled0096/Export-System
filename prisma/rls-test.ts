// RLS Tester — سيناريو حقيقي يتأكد إن العزل بين المنظمات شغّال فعليًا على مستوى
// القاعدة، مش بس إن التطبيق بيفلتر صح. ده البند اللي REVIEW-2026-08 وCLAUDE.md
// طالبين بيه كبوابة CI. يُشغَّل بـ: npx tsx prisma/rls-test.ts
//
// المنطق: بننشئ منظمة ومستخدم مؤقتين (Org B)، وننتحل شخصية كل مستخدم عبر
// نفس آلية src/lib/scoped-prisma.ts (SET LOCAL ROLE + request.jwt.claims)،
// ونتأكد إن كل مستخدم بيشوف بيانات منظمته بس — قراءة وكتابة.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

type Check = { name: string; pass: boolean; detail?: string };
const checks: Check[] = [];

function record(name: string, pass: boolean, detail?: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
}

/** يشتغل بنفس آلية getScopedPrisma() بالظبط — نسخة مستقلة عشان الاختبار ده منفصل عن كود التطبيق.
 * aal اختياري — لازم "aal2" لأي عملية بتلمس Approval.decision='Approved' مباشرة (راجع Trigger
 * enforce_approval_decision_requires_aal2، migration 20260918210000). */
async function asUser<T>(userId: string, fn: (tx: typeof prisma) => Promise<T>, aal?: string): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated", aal: aal ?? null });
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE authenticated`);
    await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
    return fn(tx as typeof prisma);
  });
}

async function main() {
  // ---------- تجهيز: منظمتين، مستخدم لكل واحدة، ومنتج لكل واحدة ----------
  const orgA = await prisma.organization.create({
    data: { name: "RLS Test Org A", legalName: "RLS Test Org A" },
  });
  const orgB = await prisma.organization.create({
    data: { name: "RLS Test Org B", legalName: "RLS Test Org B" },
  });

  const roleA = await prisma.role.create({
    data: { orgId: orgA.id, name: "SalesRep", isSystemRole: true },
  });
  const roleB = await prisma.role.create({
    data: { orgId: orgB.id, name: "SalesRep", isSystemRole: true },
  });

  const userA = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      orgId: orgA.id,
      fullName: "Test User A",
      email: `rls-test-a-${Date.now()}@test.local`,
      roleId: roleA.id,
    },
  });
  const userB = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      orgId: orgB.id,
      fullName: "Test User B",
      email: `rls-test-b-${Date.now()}@test.local`,
      roleId: roleB.id,
    },
  });

  const productA = await prisma.product.create({
    data: {
      orgId: orgA.id,
      nameAr: "منتج أ",
      nameEn: "Product A",
      hsCode: "0000.00",
      category: "Test",
      originCountry: "Egypt",
    },
  });
  const productB = await prisma.product.create({
    data: {
      orgId: orgB.id,
      nameAr: "منتج ب",
      nameEn: "Product B",
      hsCode: "0000.00",
      category: "Test",
      originCountry: "Egypt",
    },
  });

  try {
    // ---------- 1) القراءة: userA لازم يشوف منتج A بس ----------
    const asA = await asUser(userA.id, (tx) => tx.product.findMany({ where: { orgId: { in: [orgA.id, orgB.id] } } }));
    record(
      "userA بيشوف منتج A بس (مش منتج B)",
      asA.length === 1 && asA[0].id === productA.id,
      `رجّع ${asA.length} سجل`
    );

    // ---------- 2) القراءة: userB لازم يشوف منتج B بس ----------
    const asB = await asUser(userB.id, (tx) => tx.product.findMany({ where: { orgId: { in: [orgA.id, orgB.id] } } }));
    record(
      "userB بيشوف منتج B بس (مش منتج A)",
      asB.length === 1 && asB[0].id === productB.id,
      `رجّع ${asB.length} سجل`
    );

    // ---------- 3) الكتابة الممنوعة: userB يحاول يعمل INSERT بـ orgId بتاع A ----------
    let blockedCrossOrgInsert = false;
    try {
      await asUser(userB.id, (tx) =>
        tx.product.create({
          data: {
            orgId: orgA.id, // ⚠️ محاولة كتابة في منظمة تانية غير بتاعته
            nameAr: "اختراق",
            nameEn: "Breach Attempt",
            hsCode: "0000.00",
            category: "Test",
            originCountry: "Egypt",
          },
        })
      );
    } catch {
      blockedCrossOrgInsert = true;
    }
    record("userB اتمنع من INSERT بـ orgId بتاع منظمة تانية (WITH CHECK)", blockedCrossOrgInsert);

    // ---------- 4) AuditLog: ممنوع UPDATE/DELETE حتى لمستخدم "authenticated" ----------
    const logEntry = await prisma.auditLog.create({
      data: { orgId: orgA.id, action: "test.action", entityType: "Product", entityId: productA.id },
    });

    let blockedAuditUpdate = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.auditLog.update({ where: { id: logEntry.id }, data: { action: "tampered" } })
      );
    } catch {
      blockedAuditUpdate = true;
    }
    record("AuditLog: UPDATE ممنوع حتى لصاحب المنظمة نفسها", blockedAuditUpdate);

    let blockedAuditDelete = false;
    try {
      await asUser(userA.id, (tx) => tx.auditLog.delete({ where: { id: logEntry.id } }));
    } catch {
      blockedAuditDelete = true;
    }
    record("AuditLog: DELETE ممنوع حتى لصاحب المنظمة نفسها", blockedAuditDelete);

    // ---------- 5) Role: userA لازم يشوف دور منظمته بس ----------
    const rolesAsA = await asUser(userA.id, (tx) =>
      tx.role.findMany({ where: { id: { in: [roleA.id, roleB.id] } } })
    );
    record(
      "userA بيشوف Role بتاع منظمته بس (مش منظمة B)",
      rolesAsA.length === 1 && rolesAsA[0].id === roleA.id,
      `رجّع ${rolesAsA.length} سجل`
    );

    // ---------- 6) P2: تجهيز صفقة/سيناريو كاملين على orgA لاختبار walkAwayPrice ----------
    const marketA = await prisma.market.create({
      data: {
        orgId: orgA.id,
        countryNameAr: "سوق أ",
        countryNameEn: "Market A",
        countryCode: "XX",
        continent: "Test",
        currency: "USD",
        mainPorts: [],
      },
    });
    const companyA = await prisma.company.create({
      data: { orgId: orgA.id, legalName: "RLS Test Company A", country: "Testland", classification: ["Importer"] },
    });
    const opportunityA = await prisma.opportunity.create({
      data: {
        orgId: orgA.id,
        companyId: companyA.id,
        productId: productA.id,
        marketId: marketA.id,
        stage: "NewLead",
      },
    });
    const dealA = await prisma.deal.create({
      data: {
        orgId: orgA.id,
        opportunityId: opportunityA.id,
        productId: productA.id,
        marketId: marketA.id,
        customerId: companyA.id,
        dealObjective: "MaximizeProfit",
      },
    });
    const fxRateA = await prisma.exchangeRate.create({
      data: { orgId: orgA.id, baseCurrency: "USD", quoteCurrency: "USD", rate: 1, rateDate: new Date(), rateType: "Spot" },
    });
    const scenarioA = await prisma.dealScenario.create({
      data: {
        orgId: orgA.id,
        dealId: dealA.id,
        version: 1,
        scenarioName: "Current",
        quantityRaw: 1000,
        quantitySaleable: 1000,
        incoterm: "FOB",
        currency: "USD",
        fxRateId: fxRateA.id,
        walkAwayPrice: 100,
      },
    });

    // ---------- 7) Trigger: Quote.unitPrice تحت walkAwayPrice لازم يترفض على مستوى القاعدة ----------
    let blockedBelowWalkAway = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.quote.create({
          data: {
            orgId: orgA.id,
            dealId: dealA.id,
            scenarioId: scenarioA.id,
            version: 1,
            customerId: companyA.id,
            currency: "USD",
            incoterm: "FOB",
            unitPrice: 50, // ⚠️ أقل من walkAwayPrice=100 وبلا Approval معتمد
            priceUnit: "kg",
          },
        })
      );
    } catch {
      blockedBelowWalkAway = true;
    }
    record("Quote بسعر تحت walkAwayPrice اتمنع فعليًا على مستوى القاعدة (Trigger)", blockedBelowWalkAway);

    // ---------- 8) نفس الـQuote بسعر فوق walkAwayPrice لازم ينجح ----------
    let quoteAboveWalkAwaySucceeded = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.quote.create({
          data: {
            orgId: orgA.id,
            dealId: dealA.id,
            scenarioId: scenarioA.id,
            version: 2,
            customerId: companyA.id,
            currency: "USD",
            incoterm: "FOB",
            unitPrice: 150, // فوق walkAwayPrice=100
            priceUnit: "kg",
          },
        })
      );
      quoteAboveWalkAwaySucceeded = true;
    } catch {
      quoteAboveWalkAwaySucceeded = false;
    }
    record("Quote بسعر فوق walkAwayPrice نجح عادي", quoteAboveWalkAwaySucceeded);

    // ---------- 8ب) QuoteBundle: تجميع عروض مستقلة لنفس العميل، ورفض عميل مختلف (5 سبتمبر) ----------
    const bundleCompanyA = await prisma.company.create({
      data: { orgId: orgA.id, legalName: "RLS Bundle Company A", country: "Testland", classification: ["Importer"] },
    });
    const bundleCompanyOther = await prisma.company.create({
      data: { orgId: orgA.id, legalName: "RLS Bundle Company Other", country: "Testland", classification: ["Importer"] },
    });
    const bundleQuote1 = await asUser(userA.id, (tx) =>
      tx.quote.create({
        data: { orgId: orgA.id, dealId: dealA.id, scenarioId: scenarioA.id, version: 3, customerId: bundleCompanyA.id, currency: "USD", incoterm: "FOB", unitPrice: 150, priceUnit: "kg" },
      })
    );
    const bundleQuote2 = await asUser(userA.id, (tx) =>
      tx.quote.create({
        data: { orgId: orgA.id, dealId: dealA.id, scenarioId: scenarioA.id, version: 4, customerId: bundleCompanyA.id, currency: "USD", incoterm: "FOB", unitPrice: 160, priceUnit: "kg" },
      })
    );
    const otherCustomerQuote = await asUser(userA.id, (tx) =>
      tx.quote.create({
        data: { orgId: orgA.id, dealId: dealA.id, scenarioId: scenarioA.id, version: 5, customerId: bundleCompanyOther.id, currency: "USD", incoterm: "FOB", unitPrice: 170, priceUnit: "kg" },
      })
    );
    const quoteBundleA = await asUser(userA.id, (tx) => tx.quoteBundle.create({ data: { orgId: orgA.id, customerId: bundleCompanyA.id, createdBy: userA.id } }));

    let crossCustomerBundlingRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.quote.update({ where: { id: otherCustomerQuote.id }, data: { bundleId: quoteBundleA.id } }));
    } catch {
      crossCustomerBundlingRejected = true;
    }
    record("إضافة عرض سعر لعميل مختلف عن عميل الحزمة اتمنعت فعليًا على مستوى القاعدة (Trigger)", crossCustomerBundlingRejected);

    let sameCustomerBundlingSucceeded = false;
    try {
      await asUser(userA.id, (tx) => tx.quote.update({ where: { id: bundleQuote1.id }, data: { bundleId: quoteBundleA.id } }));
      await asUser(userA.id, (tx) => tx.quote.update({ where: { id: bundleQuote2.id }, data: { bundleId: quoteBundleA.id } }));
      sameCustomerBundlingSucceeded = true;
    } catch {
      sameCustomerBundlingSucceeded = false;
    }
    record("تجميع عرضين مستقلين لنفس العميل في حزمة واحدة نجح فعليًا", sameCustomerBundlingSucceeded);

    const bundlesAsB = await asUser(userB.id, (tx) => tx.quoteBundle.findMany({ where: { id: quoteBundleA.id } }));
    record("userB مايشوفش QuoteBundle بتاع orgA (عزل RLS)", bundlesAsB.length === 0);

    // ---------- 9) عزل orgId على Deal: userB ميشوفش صفقة orgA ----------
    const dealsAsB = await asUser(userB.id, (tx) => tx.deal.findMany({ where: { id: dealA.id } }));
    record("userB مايشوفش Deal بتاع orgA (عزل RLS)", dealsAsB.length === 0);

    // ---------- 10) RiskItem: عزل RLS بين منظمتين ----------
    const riskItemA = await asUser(userA.id, (tx) =>
      tx.riskItem.create({
        data: {
          orgId: orgA.id,
          scenarioId: scenarioA.id,
          riskType: "FX",
          probability: 0.3,
          financialImpact: 1000,
          expectedCost: 300,
        },
      })
    );
    const riskItemsAsB = await asUser(userB.id, (tx) => tx.riskItem.findMany({ where: { id: riskItemA.id } }));
    record("userB مايشوفش RiskItem بتاع orgA (عزل RLS)", riskItemsAsB.length === 0);

    // ---------- 10ب) Competitor: عزل RLS بين منظمتين (6 سبتمبر) ----------
    const competitorA = await asUser(userA.id, (tx) =>
      tx.competitor.create({
        data: {
          orgId: orgA.id,
          productId: productA.id,
          marketId: marketA.id,
          countryName: "RLS Test Competitor Country",
          strengthMonths: [1, 2, 3],
          weaknessMonths: [7, 8],
          currency: "USD",
        },
      })
    );
    const competitorsAsB = await asUser(userB.id, (tx) => tx.competitor.findMany({ where: { id: competitorA.id } }));
    record("userB مايشوفش Competitor بتاع orgA (عزل RLS)", competitorsAsB.length === 0);

    // ---------- 11) SalesOrder: CHECK constraint بيمنع status != Draft بلا poNumber/poDate ----------
    const salesOrderDraft = await asUser(userA.id, (tx) =>
      tx.salesOrder.create({
        data: {
          orgId: orgA.id,
          dealId: dealA.id,
          customerId: companyA.id,
          soNumber: `SO-TEST-${Date.now()}`,
          currency: "USD",
          totalValue: 15000,
          incoterm: "FOB",
        },
      })
    );

    let blockedConfirmedWithoutPo = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.salesOrder.update({ where: { id: salesOrderDraft.id }, data: { status: "Confirmed" } })
      );
    } catch {
      blockedConfirmedWithoutPo = true;
    }
    record(
      "SalesOrder.status=Confirmed بلا poNumber/poDate اتمنع فعليًا على مستوى القاعدة (CHECK)",
      blockedConfirmedWithoutPo
    );

    let confirmedWithPoSucceeded = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.salesOrder.update({
          where: { id: salesOrderDraft.id },
          data: { status: "Confirmed", poNumber: "PO-12345", poDate: new Date() },
        })
      );
      confirmedWithPoSucceeded = true;
    } catch {
      confirmedWithPoSucceeded = false;
    }
    record("SalesOrder.status=Confirmed مع poNumber/poDate نجح عادي", confirmedWithPoSucceeded);

    const salesOrdersAsB = await asUser(userB.id, (tx) =>
      tx.salesOrder.findMany({ where: { id: salesOrderDraft.id } })
    );
    record("userB مايشوفش SalesOrder بتاع orgA (عزل RLS)", salesOrdersAsB.length === 0);

    // ---------- 12) وحدة 5 (الامتثال): ملف امتثال + متطلب حاجب + بوابتين ----------
    const complianceCaseA = await asUser(userA.id, (tx) =>
      tx.complianceCase.create({
        data: { orgId: orgA.id, dealId: dealA.id, productId: productA.id, marketId: marketA.id, operationType: "CommercialExport" },
      })
    );
    const requirementA = await asUser(userA.id, (tx) =>
      tx.requirement.create({
        data: { orgId: orgA.id, complianceCaseId: complianceCaseA.id, category: "Customs", name: "RLS test requirement", status: "NotMet" },
      })
    );
    const gateA = await asUser(userA.id, (tx) =>
      tx.gate.create({
        data: { orgId: orgA.id, complianceCaseId: complianceCaseA.id, gateNumber: 1, gateName: "RLS Test Gate", blockingRequirementIds: [requirementA.id] },
      })
    );

    let blockedGatePassWithUnmetRequirement = false;
    try {
      await asUser(userA.id, (tx) => tx.gate.update({ where: { id: gateA.id }, data: { status: "Passed" } }));
    } catch {
      blockedGatePassWithUnmetRequirement = true;
    }
    record("Gate.status=Passed اتمنع فعليًا على مستوى القاعدة (متطلب حاجب NotMet)", blockedGatePassWithUnmetRequirement);

    const gateWaiveA = await asUser(userA.id, (tx) =>
      tx.gate.create({ data: { orgId: orgA.id, complianceCaseId: complianceCaseA.id, gateNumber: 2, gateName: "RLS Test Gate 2" } })
    );
    let blockedGateWaiveWithoutApproval = false;
    try {
      await asUser(userA.id, (tx) => tx.gate.update({ where: { id: gateWaiveA.id }, data: { status: "Waived" } }));
    } catch {
      blockedGateWaiveWithoutApproval = true;
    }
    record("Gate.status=Waived اتمنع فعليًا على مستوى القاعدة (بلا Approval معتمد)", blockedGateWaiveWithoutApproval);

    const complianceCasesAsB = await asUser(userB.id, (tx) => tx.complianceCase.findMany({ where: { id: complianceCaseA.id } }));
    record("userB مايشوفش ComplianceCase بتاع orgA (عزل RLS)", complianceCasesAsB.length === 0);

    // ---------- 13) وحدة 5 (الشريحة الثانية): Gate.requiresOriginProofVerification + OriginProof (قواعد PEM) ----------
    const unverifiedProofA = await asUser(userA.id, (tx) =>
      tx.originProof.create({
        data: { orgId: orgA.id, dealId: dealA.id, proofType: "EUR1", usesRevisedPemRules: true, revisedRulesWordingVerified: false },
      })
    );
    const shippingGateA = await asUser(userA.id, (tx) =>
      tx.gate.create({
        data: { orgId: orgA.id, complianceCaseId: complianceCaseA.id, gateNumber: 3, gateName: "RLS Test Shipping Gate", requiresOriginProofVerification: true },
      })
    );
    let blockedShippingGateUnverifiedProof = false;
    try {
      await asUser(userA.id, (tx) => tx.gate.update({ where: { id: shippingGateA.id }, data: { status: "Passed" } }));
    } catch {
      blockedShippingGateUnverifiedProof = true;
    }
    record("Gate.requiresOriginProofVerification اتمنع فعليًا على مستوى القاعدة (OriginProof غير متحقّق — قواعد PEM)", blockedShippingGateUnverifiedProof);

    await asUser(userA.id, (tx) => tx.originProof.update({ where: { id: unverifiedProofA.id }, data: { revisedRulesWordingVerified: true } }));
    let shippingGatePassedAfterVerify = true;
    try {
      await asUser(userA.id, (tx) => tx.gate.update({ where: { id: shippingGateA.id }, data: { status: "Passed" } }));
    } catch {
      shippingGatePassedAfterVerify = false;
    }
    record("Gate.requiresOriginProofVerification عدّت بعد ما OriginProof بقى متحقّق منه", shippingGatePassedAfterVerify);

    const originProofsAsB = await asUser(userB.id, (tx) => tx.originProof.findMany({ where: { id: unverifiedProofA.id } }));
    record("userB مايشوفش OriginProof بتاع orgA (عزل RLS)", originProofsAsB.length === 0);

    // ---------- 14) وحدة 5 (الشريحة التالتة): RejectionCase + LCRequirement — RLS بس، بلا Trigger ----------
    const rejectionCaseA = await asUser(userA.id, (tx) =>
      tx.rejectionCase.create({
        data: { orgId: orgA.id, complianceCaseId: complianceCaseA.id, rejectionType: "CustomsHold", authority: "RLS Test Customs", severity: "High" },
      })
    );
    const rejectionCasesAsB = await asUser(userB.id, (tx) => tx.rejectionCase.findMany({ where: { id: rejectionCaseA.id } }));
    record("userB مايشوفش RejectionCase بتاع orgA (عزل RLS)", rejectionCasesAsB.length === 0);

    const lcRequirementA = await asUser(userA.id, (tx) =>
      tx.lCRequirement.create({
        data: { orgId: orgA.id, dealId: dealA.id, lcNumber: "LC-RLS-TEST", issuingBank: "RLS Test Bank", amount: 1000, currency: "USD", expiryDate: new Date() },
      })
    );
    const lcRequirementsAsB = await asUser(userB.id, (tx) => tx.lCRequirement.findMany({ where: { id: lcRequirementA.id } }));
    record("userB مايشوفش LCRequirement بتاع orgA (عزل RLS)", lcRequirementsAsB.length === 0);

    // ---------- 15) وحدة 6 (اللوجستيات، الشريحة الأولى): Shipment + Gate.requiresAciVerification ----------
    const shipmentA = await asUser(userA.id, (tx) =>
      tx.shipment.create({
        data: {
          orgId: orgA.id,
          dealId: dealA.id,
          productId: productA.id,
          complianceCaseId: complianceCaseA.id,
          shipmentType: "Commercial",
          transportMode: "Air",
          incoterm: "FOB",
          originPort: "Cairo",
          destinationPort: "Frankfurt",
          aciStatus: "Submitted",
          aciDeadlineMet: false,
        },
      })
    );
    const shipmentPartyA = await asUser(userA.id, (tx) =>
      tx.shipmentParty.create({ data: { orgId: orgA.id, shipmentId: shipmentA.id, partyRole: "Buyer", companyId: companyA.id } })
    );
    const bookingA = await asUser(userA.id, (tx) =>
      tx.booking.create({ data: { orgId: orgA.id, shipmentId: shipmentA.id, bookingNumber: "BK-RLS-TEST" } })
    );
    const containerA = await asUser(userA.id, (tx) =>
      tx.container.create({ data: { orgId: orgA.id, shipmentId: shipmentA.id, containerType: "GP40" } })
    );
    const milestoneA = await asUser(userA.id, (tx) =>
      tx.milestone.create({ data: { orgId: orgA.id, shipmentId: shipmentA.id, milestoneName: "Cargo Ready", sequence: 1 } })
    );

    const aciGateA = await asUser(userA.id, (tx) =>
      tx.gate.create({
        data: { orgId: orgA.id, complianceCaseId: complianceCaseA.id, gateNumber: 4, gateName: "RLS Test ACI Gate", requiresAciVerification: true },
      })
    );
    let blockedAciGateUnmetDeadline = false;
    try {
      await asUser(userA.id, (tx) => tx.gate.update({ where: { id: aciGateA.id }, data: { status: "Passed" } }));
    } catch {
      blockedAciGateUnmetDeadline = true;
    }
    record("Gate.requiresAciVerification اتمنع فعليًا على مستوى القاعدة (aciDeadlineMet=false)", blockedAciGateUnmetDeadline);

    await asUser(userA.id, (tx) => tx.shipment.update({ where: { id: shipmentA.id }, data: { aciDeadlineMet: true } }));
    let aciGatePassedAfterDeadlineMet = true;
    try {
      await asUser(userA.id, (tx) => tx.gate.update({ where: { id: aciGateA.id }, data: { status: "Passed" } }));
    } catch {
      aciGatePassedAfterDeadlineMet = false;
    }
    record("Gate.requiresAciVerification عدّت بعد ما aciDeadlineMet بقى true", aciGatePassedAfterDeadlineMet);

    const shipmentsAsB = await asUser(userB.id, (tx) => tx.shipment.findMany({ where: { id: shipmentA.id } }));
    record("userB مايشوفش Shipment بتاع orgA (عزل RLS)", shipmentsAsB.length === 0);
    const shipmentPartiesAsB = await asUser(userB.id, (tx) => tx.shipmentParty.findMany({ where: { id: shipmentPartyA.id } }));
    record("userB مايشوفش ShipmentParty بتاع orgA (عزل RLS)", shipmentPartiesAsB.length === 0);
    const bookingsAsB = await asUser(userB.id, (tx) => tx.booking.findMany({ where: { id: bookingA.id } }));
    record("userB مايشوفش Booking بتاع orgA (عزل RLS)", bookingsAsB.length === 0);
    const containersAsB = await asUser(userB.id, (tx) => tx.container.findMany({ where: { id: containerA.id } }));
    record("userB مايشوفش Container بتاع orgA (عزل RLS)", containersAsB.length === 0);
    const milestonesAsB = await asUser(userB.id, (tx) => tx.milestone.findMany({ where: { id: milestoneA.id } }));
    record("userB مايشوفش Milestone بتاع orgA (عزل RLS)", milestonesAsB.length === 0);

    // ---------- 16) وحدة 6 (الشريحة الثانية): التتبع التشغيلي — RLS بس، بلا Trigger ----------
    const shipmentEventA = await asUser(userA.id, (tx) =>
      tx.shipmentEvent.create({
        data: { orgId: orgA.id, shipmentId: shipmentA.id, eventType: "RLS Test Event", occurredAt: new Date(), source: "Manual" },
      })
    );
    const shipmentEventsAsB = await asUser(userB.id, (tx) => tx.shipmentEvent.findMany({ where: { id: shipmentEventA.id } }));
    record("userB مايشوفش ShipmentEvent بتاع orgA (عزل RLS)", shipmentEventsAsB.length === 0);

    const logisticsExceptionA = await asUser(userA.id, (tx) =>
      tx.logisticsException.create({
        data: { orgId: orgA.id, shipmentId: shipmentA.id, exceptionType: "CustomsHold", severity: "High", detectedAt: new Date() },
      })
    );
    const logisticsExceptionsAsB = await asUser(userB.id, (tx) => tx.logisticsException.findMany({ where: { id: logisticsExceptionA.id } }));
    record("userB مايشوفش LogisticsException بتاع orgA (عزل RLS)", logisticsExceptionsAsB.length === 0);

    const freeTimeRecordA = await asUser(userA.id, (tx) =>
      tx.freeTimeRecord.create({
        data: { orgId: orgA.id, shipmentId: shipmentA.id, containerId: containerA.id, chargeType: "Demurrage", location: "Destination" },
      })
    );
    const freeTimeRecordsAsB = await asUser(userB.id, (tx) => tx.freeTimeRecord.findMany({ where: { id: freeTimeRecordA.id } }));
    record("userB مايشوفش FreeTimeRecord بتاع orgA (عزل RLS)", freeTimeRecordsAsB.length === 0);

    const actualLogisticsCostA = await asUser(userA.id, (tx) =>
      tx.actualLogisticsCost.create({
        data: { orgId: orgA.id, shipmentId: shipmentA.id, costType: "THC", expectedAmount: 100, actualAmount: 120 },
      })
    );
    const actualLogisticsCostsAsB = await asUser(userB.id, (tx) => tx.actualLogisticsCost.findMany({ where: { id: actualLogisticsCostA.id } }));
    record("userB مايشوفش ActualLogisticsCost بتاع orgA (عزل RLS)", actualLogisticsCostsAsB.length === 0);

    // ---------- 17) وحدة 6 (الشريحة الثالثة): TemperatureLog/TransportTrip/Claim — RLS بس، بلا Trigger ----------
    const temperatureLogA = await asUser(userA.id, (tx) =>
      tx.temperatureLog.create({
        data: { orgId: orgA.id, shipmentId: shipmentA.id, containerId: containerA.id, recordedAt: new Date(), temperatureC: -18 },
      })
    );
    const temperatureLogsAsB = await asUser(userB.id, (tx) => tx.temperatureLog.findMany({ where: { id: temperatureLogA.id } }));
    record("userB مايشوفش TemperatureLog بتاع orgA (عزل RLS)", temperatureLogsAsB.length === 0);

    const transportTripA = await asUser(userA.id, (tx) =>
      tx.transportTrip.create({ data: { orgId: orgA.id, shipmentId: shipmentA.id, carrier: "RLS Test Carrier" } })
    );
    const transportTripsAsB = await asUser(userB.id, (tx) => tx.transportTrip.findMany({ where: { id: transportTripA.id } }));
    record("userB مايشوفش TransportTrip بتاع orgA (عزل RLS)", transportTripsAsB.length === 0);

    const claimA = await asUser(userA.id, (tx) => tx.claim.create({ data: { orgId: orgA.id, shipmentId: shipmentA.id, claimType: "CargoDamage" } }));
    const claimsAsB = await asUser(userB.id, (tx) => tx.claim.findMany({ where: { id: claimA.id } }));
    record("userB مايشوفش Claim بتاع orgA (عزل RLS)", claimsAsB.length === 0);

    // ---------- 18) وحدة 6 (الشريحة الرابعة والأخيرة): تسعير الشحن — RLS بس، بلا Trigger ----------
    const serviceProviderA = await asUser(userA.id, (tx) =>
      tx.serviceProvider.create({ data: { orgId: orgA.id, providerType: "ShippingLine", name: "RLS Test Line" } })
    );
    const providersAsB = await asUser(userB.id, (tx) => tx.serviceProvider.findMany({ where: { id: serviceProviderA.id } }));
    record("userB مايشوفش ServiceProvider بتاع orgA (عزل RLS)", providersAsB.length === 0);

    const routeA = await asUser(userA.id, (tx) =>
      tx.route.create({ data: { orgId: orgA.id, originPort: "RLS Origin", destinationPort: "RLS Destination" } })
    );
    const routesAsB = await asUser(userB.id, (tx) => tx.route.findMany({ where: { id: routeA.id } }));
    record("userB مايشوفش Route بتاع orgA (عزل RLS)", routesAsB.length === 0);

    const freightQuoteA = await asUser(userA.id, (tx) =>
      tx.freightQuote.create({ data: { orgId: orgA.id, routeId: routeA.id, providerId: serviceProviderA.id } })
    );
    const freightQuotesAsB = await asUser(userB.id, (tx) => tx.freightQuote.findMany({ where: { id: freightQuoteA.id } }));
    record("userB مايشوفش FreightQuote بتاع orgA (عزل RLS)", freightQuotesAsB.length === 0);

    const freightQuoteLineA = await asUser(userA.id, (tx) =>
      tx.freightQuoteLine.create({ data: { orgId: orgA.id, freightQuoteId: freightQuoteA.id, chargeCode: "THC", category: "Origin", amount: 100 } })
    );
    const freightQuoteLinesAsB = await asUser(userB.id, (tx) => tx.freightQuoteLine.findMany({ where: { id: freightQuoteLineA.id } }));
    record("userB مايشوفش FreightQuoteLine بتاع orgA (عزل RLS)", freightQuoteLinesAsB.length === 0);

    // ---------- 19) وحدة 7 (التوريد، الشريحة الأولى): Supplier/Facility/SourcingRequest/SupplierQuote/PurchaseOrder ----------
    const supplierA = await asUser(userA.id, (tx) =>
      tx.supplier.create({ data: { orgId: orgA.id, legalName: "RLS Test Supplier", supplierType: ["RawMaterial"] } })
    );
    const facilityA = await asUser(userA.id, (tx) =>
      tx.facility.create({ data: { orgId: orgA.id, supplierId: supplierA.id, facilityType: "PackingHouse", name: "RLS Test Facility" } })
    );
    const sourcingRequestA = await asUser(userA.id, (tx) =>
      tx.sourcingRequest.create({
        data: { orgId: orgA.id, dealId: dealA.id, productId: productA.id, marketId: marketA.id, maximumPurchasePrice: 100, currency: "USD" },
      })
    );
    const supplierQuoteA = await asUser(userA.id, (tx) =>
      tx.supplierQuote.create({
        data: { orgId: orgA.id, sourcingRequestId: sourcingRequestA.id, supplierId: supplierA.id, unitPrice: 90, currency: "USD" },
      })
    );

    // Trigger: PurchaseOrder.unitPrice فوق SourcingRequest.maximumPurchasePrice لازم يترفض بلا Approval معتمد
    let blockedAbovePriceCeiling = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.purchaseOrder.create({
          data: {
            orgId: orgA.id,
            sourcingRequestId: sourcingRequestA.id,
            supplierId: supplierA.id,
            poNumber: `PO-RLS-TEST-${Date.now()}`,
            quantity: 100,
            unitPrice: 150, // ⚠️ فوق maximumPurchasePrice=100 وبلا Approval معتمد
            currency: "USD",
          },
        })
      );
    } catch {
      blockedAbovePriceCeiling = true;
    }
    record("PurchaseOrder بسعر فوق maximumPurchasePrice اتمنع فعليًا على مستوى القاعدة (Trigger)", blockedAbovePriceCeiling);

    // نفس PurchaseOrder، بس عبر Approval معتمد بـsubjectId محجوز مقدّمًا (نفس نمط walkAwayPrice) — لازم ينجح
    let purchaseOrderAboveCeilingViaApprovalSucceeded = false;
    let purchaseOrderOverrideA: { id: string } | null = null;
    try {
      await asUser(
        userA.id,
        async (tx) => {
          const [{ id: reservedPoId }] = await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7() AS id`;
          await tx.approval.create({
            data: {
              orgId: orgA.id,
              subjectType: "PurchaseOrder.unitPrice_override",
              subjectId: reservedPoId,
              requestedBy: userA.id,
              decidedBy: userA.id,
              decision: "Approved",
              decidedAt: new Date(),
            },
          });
          purchaseOrderOverrideA = await tx.purchaseOrder.create({
            data: {
              id: reservedPoId,
              orgId: orgA.id,
              sourcingRequestId: sourcingRequestA.id,
              supplierId: supplierA.id,
              poNumber: `PO-RLS-TEST-APPROVED-${Date.now()}`,
              quantity: 100,
              unitPrice: 150,
              currency: "USD",
            },
          });
        },
        // اعتماد Approval محتاج aal2 دلوقتي (Trigger enforce_approval_decision_requires_aal2) —
        // نفس افتراض requireAal2() اللي approvals/actions.ts بيتحقق منه قبل ما يعمل هذا الـupdate فعليًا.
        "aal2"
      );
      purchaseOrderAboveCeilingViaApprovalSucceeded = true;
    } catch {
      purchaseOrderAboveCeilingViaApprovalSucceeded = false;
    }
    record("PurchaseOrder بسعر فوق maximumPurchasePrice نجح عبر Approval معتمد (subjectId محجوز)", purchaseOrderAboveCeilingViaApprovalSucceeded);

    const suppliersAsB = await asUser(userB.id, (tx) => tx.supplier.findMany({ where: { id: supplierA.id } }));
    record("userB مايشوفش Supplier بتاع orgA (عزل RLS)", suppliersAsB.length === 0);
    const facilitiesAsB = await asUser(userB.id, (tx) => tx.facility.findMany({ where: { id: facilityA.id } }));
    record("userB مايشوفش Facility بتاع orgA (عزل RLS)", facilitiesAsB.length === 0);
    const sourcingRequestsAsB = await asUser(userB.id, (tx) => tx.sourcingRequest.findMany({ where: { id: sourcingRequestA.id } }));
    record("userB مايشوفش SourcingRequest بتاع orgA (عزل RLS)", sourcingRequestsAsB.length === 0);
    const supplierQuotesAsB = await asUser(userB.id, (tx) => tx.supplierQuote.findMany({ where: { id: supplierQuoteA.id } }));
    record("userB مايشوفش SupplierQuote بتاع orgA (عزل RLS)", supplierQuotesAsB.length === 0);
    if (purchaseOrderOverrideA) {
      const purchaseOrdersAsB = await asUser(userB.id, (tx) => tx.purchaseOrder.findMany({ where: { id: (purchaseOrderOverrideA as { id: string }).id } }));
      record("userB مايشوفش PurchaseOrder بتاع orgA (عزل RLS)", purchaseOrdersAsB.length === 0);
    }

    // ---------- 20) وحدة 7 (الإنتاج/الجودة، الشريحة الثانية): Batch/Inspection/QualityRelease/Lot ----------
    const batchA = await asUser(userA.id, (tx) =>
      tx.batch.create({
        data: {
          orgId: orgA.id,
          purchaseOrderId: (purchaseOrderOverrideA as { id: string }).id,
          facilityId: facilityA.id,
          supplierId: supplierA.id,
          batchCode: `BATCH-RLS-TEST-${Date.now()}`,
          quantityInput: 1000,
          quantityOutput: 900,
        },
      })
    );
    const inspectionA = await asUser(userA.id, (tx) =>
      tx.inspection.create({
        data: { orgId: orgA.id, stage: "IncomingRawMaterial", batchId: batchA.id, facilityId: facilityA.id, inspectorId: userA.id, result: "Pass" },
      })
    );

    // Trigger: Lot.qualityStatus='Released' بلا QualityRelease معتمد لازم يترفض
    let blockedLotReleasedWithoutQualityRelease = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.lot.create({
          data: { orgId: orgA.id, batchId: batchA.id, lotCode: `LOT-RLS-TEST-${Date.now()}`, qualityStatus: "Released" },
        })
      );
    } catch {
      blockedLotReleasedWithoutQualityRelease = true;
    }
    record("Lot بحالة Released بلا QualityRelease معتمد اتمنع فعليًا على مستوى القاعدة (Trigger)", blockedLotReleasedWithoutQualityRelease);

    // نفس Lot، بس بعد ما يتعمل QualityRelease معتمد لنفس الدفعة — لازم ينجح
    const qualityReleaseA = await asUser(userA.id, (tx) =>
      tx.qualityRelease.create({
        data: { orgId: orgA.id, batchId: batchA.id, releasedBy: userA.id, releasedQuantity: 900, status: "Released" },
      })
    );
    let lotReleasedAfterQualityReleaseSucceeded = false;
    let lotA: { id: string } | null = null;
    try {
      lotA = await asUser(userA.id, (tx) =>
        tx.lot.create({
          data: { orgId: orgA.id, batchId: batchA.id, lotCode: `LOT-RLS-TEST-APPROVED-${Date.now()}`, qualityStatus: "Released" },
        })
      );
      lotReleasedAfterQualityReleaseSucceeded = true;
    } catch {
      lotReleasedAfterQualityReleaseSucceeded = false;
    }
    record("Lot بحالة Released نجح بعد QualityRelease معتمد لنفس الدفعة", lotReleasedAfterQualityReleaseSucceeded);

    const batchesAsB = await asUser(userB.id, (tx) => tx.batch.findMany({ where: { id: batchA.id } }));
    record("userB مايشوفش Batch بتاع orgA (عزل RLS)", batchesAsB.length === 0);
    const inspectionsAsB = await asUser(userB.id, (tx) => tx.inspection.findMany({ where: { id: inspectionA.id } }));
    record("userB مايشوفش Inspection بتاع orgA (عزل RLS)", inspectionsAsB.length === 0);
    const qualityReleasesAsB = await asUser(userB.id, (tx) => tx.qualityRelease.findMany({ where: { id: qualityReleaseA.id } }));
    record("userB مايشوفش QualityRelease بتاع orgA (عزل RLS)", qualityReleasesAsB.length === 0);
    if (lotA) {
      const lotsAsB = await asUser(userB.id, (tx) => tx.lot.findMany({ where: { id: (lotA as { id: string }).id } }));
      record("userB مايشوفش Lot بتاع orgA (عزل RLS)", lotsAsB.length === 0);
    }

    // ---------- 21) وحدة 6 (إقفال أخير): ShipmentLot — جدول وسيط N:N بين Shipment وLot ----------
    if (lotA) {
      const shipmentLotA = await asUser(userA.id, (tx) =>
        tx.shipmentLot.create({
          data: { orgId: orgA.id, shipmentId: shipmentA.id, lotId: (lotA as { id: string }).id, quantity: 100 },
        })
      );
      const shipmentLotsAsB = await asUser(userB.id, (tx) => tx.shipmentLot.findMany({ where: { id: shipmentLotA.id } }));
      record("userB مايشوفش ShipmentLot بتاع orgA (عزل RLS)", shipmentLotsAsB.length === 0);
    }

    // ---------- 22) وحدة 7 (الشريحة التالتة): ProductionPlan/Inventory/NCR/LabTest ----------
    const productionPlanA = await asUser(userA.id, (tx) =>
      tx.productionPlan.create({
        data: {
          orgId: orgA.id,
          purchaseOrderId: (purchaseOrderOverrideA as { id: string }).id,
          facilityId: facilityA.id,
          process: "Freezing",
          rawQuantity: 500,
        },
      })
    );
    const productionPlansAsB = await asUser(userB.id, (tx) => tx.productionPlan.findMany({ where: { id: productionPlanA.id } }));
    record("userB مايشوفش ProductionPlan بتاع orgA (عزل RLS)", productionPlansAsB.length === 0);

    const inventoryA = await asUser(userA.id, (tx) =>
      tx.inventory.create({
        data: { orgId: orgA.id, productId: productA.id, batchId: batchA.id, inventoryType: "FinishedGoods", quantity: 100 },
      })
    );
    const inventoryAsB = await asUser(userB.id, (tx) => tx.inventory.findMany({ where: { id: inventoryA.id } }));
    record("userB مايشوفش Inventory بتاع orgA (عزل RLS)", inventoryAsB.length === 0);

    const ncrA = await asUser(userA.id, (tx) =>
      tx.nCR.create({
        data: { orgId: orgA.id, supplierId: supplierA.id, facilityId: facilityA.id, ncrType: "WeightDeviation", severity: "Minor" },
      })
    );
    const ncrsAsB = await asUser(userB.id, (tx) => tx.nCR.findMany({ where: { id: ncrA.id } }));
    record("userB مايشوفش NCR بتاع orgA (عزل RLS)", ncrsAsB.length === 0);

    const labTestA = await asUser(userA.id, (tx) =>
      tx.labTest.create({
        data: { orgId: orgA.id, batchId: batchA.id, testType: "Moisture", passFail: "Pass" },
      })
    );
    const labTestsAsB = await asUser(userB.id, (tx) => tx.labTest.findMany({ where: { id: labTestA.id } }));
    record("userB مايشوفش LabTest بتاع orgA (عزل RLS)", labTestsAsB.length === 0);

    // ---------- 23) وحدة 7 (الشريحة الرابعة): Farm/BatchRawMaterialLine/SupplierRFQ/BatchMarketEligibility ----------
    const farmA = await asUser(userA.id, (tx) => tx.farm.create({ data: { orgId: orgA.id, supplierId: supplierA.id, crop: "فراولة" } }));
    const farmsAsB = await asUser(userB.id, (tx) => tx.farm.findMany({ where: { id: farmA.id } }));
    record("userB مايشوفش Farm بتاع orgA (عزل RLS)", farmsAsB.length === 0);

    const batchRawMaterialLineA = await asUser(userA.id, (tx) =>
      tx.batchRawMaterialLine.create({ data: { orgId: orgA.id, batchId: batchA.id, sourceType: "Farm", farmId: farmA.id, quantity: 100 } })
    );
    const batchRawMaterialLinesAsB = await asUser(userB.id, (tx) => tx.batchRawMaterialLine.findMany({ where: { id: batchRawMaterialLineA.id } }));
    record("userB مايشوفش BatchRawMaterialLine بتاع orgA (عزل RLS)", batchRawMaterialLinesAsB.length === 0);

    const supplierRFQA = await asUser(userA.id, (tx) =>
      tx.supplierRFQ.create({ data: { orgId: orgA.id, sourcingRequestId: sourcingRequestA.id, supplierId: supplierA.id } })
    );
    const supplierRFQsAsB = await asUser(userB.id, (tx) => tx.supplierRFQ.findMany({ where: { id: supplierRFQA.id } }));
    record("userB مايشوفش SupplierRFQ بتاع orgA (عزل RLS)", supplierRFQsAsB.length === 0);

    const batchMarketEligibilityA = await asUser(userA.id, (tx) =>
      tx.batchMarketEligibility.create({ data: { orgId: orgA.id, batchId: batchA.id, marketId: marketA.id, assessedBy: userA.id } })
    );
    const batchMarketEligibilitiesAsB = await asUser(userB.id, (tx) => tx.batchMarketEligibility.findMany({ where: { id: batchMarketEligibilityA.id } }));
    record("userB مايشوفش BatchMarketEligibility بتاع orgA (عزل RLS)", batchMarketEligibilitiesAsB.length === 0);

    // ---------- 24) وحدة 7 (الشريحة الخامسة والأخيرة، إقفال 23/23): SupplierAudit/SupplyContract/PackagingMaterial/SupplierSample/CargoReadiness/SupplierPerformance ----------
    const supplierAuditA = await asUser(userA.id, (tx) =>
      tx.supplierAudit.create({ data: { orgId: orgA.id, supplierId: supplierA.id, facilityId: facilityA.id, decision: "Approved" } })
    );
    const supplierAuditsAsB = await asUser(userB.id, (tx) => tx.supplierAudit.findMany({ where: { id: supplierAuditA.id } }));
    record("userB مايشوفش SupplierAudit بتاع orgA (عزل RLS)", supplierAuditsAsB.length === 0);

    const supplyContractA = await asUser(userA.id, (tx) =>
      tx.supplyContract.create({ data: { orgId: orgA.id, supplierId: supplierA.id, contractType: "Framework" } })
    );
    const supplyContractsAsB = await asUser(userB.id, (tx) => tx.supplyContract.findMany({ where: { id: supplyContractA.id } }));
    record("userB مايشوفش SupplyContract بتاع orgA (عزل RLS)", supplyContractsAsB.length === 0);

    const packagingMaterialA = await asUser(userA.id, (tx) =>
      tx.packagingMaterial.create({ data: { orgId: orgA.id, supplierId: supplierA.id, materialType: "Carton" } })
    );
    const packagingMaterialsAsB = await asUser(userB.id, (tx) => tx.packagingMaterial.findMany({ where: { id: packagingMaterialA.id } }));
    record("userB مايشوفش PackagingMaterial بتاع orgA (عزل RLS)", packagingMaterialsAsB.length === 0);

    const supplierSampleA = await asUser(userA.id, (tx) =>
      tx.supplierSample.create({ data: { orgId: orgA.id, supplierId: supplierA.id, productId: productA.id, purpose: "Qualification" } })
    );
    const supplierSamplesAsB = await asUser(userB.id, (tx) => tx.supplierSample.findMany({ where: { id: supplierSampleA.id } }));
    record("userB مايشوفش SupplierSample بتاع orgA (عزل RLS)", supplierSamplesAsB.length === 0);

    const cargoReadinessA = await asUser(userA.id, (tx) =>
      tx.cargoReadiness.create({ data: { orgId: orgA.id, shipmentId: shipmentA.id, purchaseOrderId: (purchaseOrderOverrideA as { id: string }).id } })
    );
    const cargoReadinessAsB = await asUser(userB.id, (tx) => tx.cargoReadiness.findMany({ where: { id: cargoReadinessA.id } }));
    record("userB مايشوفش CargoReadiness بتاع orgA (عزل RLS)", cargoReadinessAsB.length === 0);

    const supplierPerformanceA = await asUser(userA.id, (tx) =>
      tx.supplierPerformance.create({
        data: { orgId: orgA.id, supplierId: supplierA.id, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-03-31") },
      })
    );
    const supplierPerformancesAsB = await asUser(userB.id, (tx) => tx.supplierPerformance.findMany({ where: { id: supplierPerformanceA.id } }));
    record("userB مايشوفش SupplierPerformance بتاع orgA (عزل RLS)", supplierPerformancesAsB.length === 0);

    // ---------- 25) وحدة 4 (الشريحة الأولى): ProductSpecification ----------
    const productSpecificationA = await asUser(userA.id, (tx) =>
      tx.productSpecification.create({ data: { orgId: orgA.id, productId: productA.id } })
    );
    const productSpecificationsAsB = await asUser(userB.id, (tx) => tx.productSpecification.findMany({ where: { id: productSpecificationA.id } }));
    record("userB مايشوفش ProductSpecification بتاع orgA (عزل RLS)", productSpecificationsAsB.length === 0);

    // ---------- 26) وحدة 4 (الشريحة الثانية): Document + Trigger enforce_document_eta_validated ----------
    let documentEtaRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.document.create({
          data: { orgId: orgA.id, dealId: dealA.id, documentType: "CommercialInvoice", documentNumber: "DOC-RLS-REJECT", status: "Sent", etaStatus: "NotApplicable" },
        })
      );
    } catch (e) {
      documentEtaRejected = e instanceof Error && e.message.includes("etaUuid");
    }
    record("فاتورة تجارية بحالة Sent بلا etaStatus=Validated اتمنعت فعليًا على مستوى القاعدة (Trigger)", documentEtaRejected);

    const documentA = await asUser(userA.id, (tx) =>
      tx.document.create({
        data: { orgId: orgA.id, dealId: dealA.id, documentType: "CommercialInvoice", documentNumber: "DOC-RLS-OK", status: "Sent", etaStatus: "Validated" },
      })
    );
    record("فاتورة تجارية بحالة Sent مع etaStatus=Validated نجحت", !!documentA);

    const documentsAsB = await asUser(userB.id, (tx) => tx.document.findMany({ where: { id: documentA.id } }));
    record("userB مايشوفش Document بتاع orgA (عزل RLS)", documentsAsB.length === 0);

    // ---------- 27) كيان مشترك: CAPA + backfill NCR.capaId/RejectionCase.capaId ----------
    const capaA = await asUser(userA.id, (tx) => tx.cAPA.create({ data: { orgId: orgA.id, ownerId: userA.id, rootCause: "RLS test" } }));
    const capasAsB = await asUser(userB.id, (tx) => tx.cAPA.findMany({ where: { id: capaA.id } }));
    record("userB مايشوفش CAPA بتاع orgA (عزل RLS)", capasAsB.length === 0);

    // ---------- 28) وحدة 4 — إقفال أخير: DocumentVersion, Template, DocumentPackage, Clause ----------
    const documentVersionA = await asUser(userA.id, (tx) =>
      tx.documentVersion.create({ data: { orgId: orgA.id, documentId: documentA.id, versionNumber: 2, createdBy: userA.id } })
    );
    const documentVersionsAsB = await asUser(userB.id, (tx) => tx.documentVersion.findMany({ where: { id: documentVersionA.id } }));
    record("userB مايشوفش DocumentVersion بتاع orgA (عزل RLS)", documentVersionsAsB.length === 0);

    const templateA = await asUser(userA.id, (tx) => tx.template.create({ data: { orgId: orgA.id, documentType: "Quotation" } }));
    const templatesAsB = await asUser(userB.id, (tx) => tx.template.findMany({ where: { id: templateA.id } }));
    record("userB مايشوفش Template بتاع orgA (عزل RLS)", templatesAsB.length === 0);

    const documentPackageA = await asUser(userA.id, (tx) => tx.documentPackage.create({ data: { orgId: orgA.id, dealId: dealA.id, packageType: "QuotationPack" } }));
    const documentPackagesAsB = await asUser(userB.id, (tx) => tx.documentPackage.findMany({ where: { id: documentPackageA.id } }));
    record("userB مايشوفش DocumentPackage بتاع orgA (عزل RLS)", documentPackagesAsB.length === 0);

    const clauseA = await asUser(userA.id, (tx) => tx.clause.create({ data: { orgId: orgA.id, title: "RLS test", category: "Payment" } }));
    const clausesAsB = await asUser(userB.id, (tx) => tx.clause.findMany({ where: { id: clauseA.id } }));
    record("userB مايشوفش Clause بتاع orgA (عزل RLS)", clausesAsB.length === 0);

    // ---------- 29) وحدة 3 — شريحة أولى: Communication, RFQAnalysis, CustomerSample, Negotiation+NegotiationRound, RedFlag ----------
    const communicationA = await asUser(userA.id, (tx) =>
      tx.communication.create({ data: { orgId: orgA.id, companyId: companyA.id, opportunityId: opportunityA.id, channel: "Email", direction: "Outbound", occurredAt: new Date() } })
    );
    const communicationsAsB = await asUser(userB.id, (tx) => tx.communication.findMany({ where: { id: communicationA.id } }));
    record("userB مايشوفش Communication بتاع orgA (عزل RLS)", communicationsAsB.length === 0);

    const rfqAnalysisA = await asUser(userA.id, (tx) => tx.rFQAnalysis.create({ data: { orgId: orgA.id, opportunityId: opportunityA.id } }));
    const rfqAnalysesAsB = await asUser(userB.id, (tx) => tx.rFQAnalysis.findMany({ where: { id: rfqAnalysisA.id } }));
    record("userB مايشوفش RFQAnalysis بتاع orgA (عزل RLS)", rfqAnalysesAsB.length === 0);

    const customerSampleA = await asUser(userA.id, (tx) => tx.customerSample.create({ data: { orgId: orgA.id, opportunityId: opportunityA.id, productId: productA.id } }));
    const customerSamplesAsB = await asUser(userB.id, (tx) => tx.customerSample.findMany({ where: { id: customerSampleA.id } }));
    record("userB مايشوفش CustomerSample بتاع orgA (عزل RLS)", customerSamplesAsB.length === 0);

    const negotiationA = await asUser(userA.id, (tx) => tx.negotiation.create({ data: { orgId: orgA.id, opportunityId: opportunityA.id } }));
    const negotiationsAsB = await asUser(userB.id, (tx) => tx.negotiation.findMany({ where: { id: negotiationA.id } }));
    record("userB مايشوفش Negotiation بتاع orgA (عزل RLS)", negotiationsAsB.length === 0);

    const negotiationRoundA = await asUser(userA.id, (tx) => tx.negotiationRound.create({ data: { orgId: orgA.id, negotiationId: negotiationA.id, roundNumber: 1 } }));
    const negotiationRoundsAsB = await asUser(userB.id, (tx) => tx.negotiationRound.findMany({ where: { id: negotiationRoundA.id } }));
    record("userB مايشوفش NegotiationRound بتاع orgA (عزل RLS)", negotiationRoundsAsB.length === 0);

    const redFlagA = await asUser(userA.id, (tx) => tx.redFlag.create({ data: { orgId: orgA.id, companyId: companyA.id, flagType: "RLS test", raisedBy: userA.id } }));
    const redFlagsAsB = await asUser(userB.id, (tx) => tx.redFlag.findMany({ where: { id: redFlagA.id } }));
    record("userB مايشوفش RedFlag بتاع orgA (عزل RLS)", redFlagsAsB.length === 0);

    // ---------- 30) وحدة 3 — إقفال أخير: LeadAssignmentRule, SalesTarget, CommissionPlan+CommissionEntry, CustomerServiceCase ----------
    const leadAssignmentRuleA = await asUser(userA.id, (tx) => tx.leadAssignmentRule.create({ data: { orgId: orgA.id, assignToUserId: userA.id } }));
    const leadAssignmentRulesAsB = await asUser(userB.id, (tx) => tx.leadAssignmentRule.findMany({ where: { id: leadAssignmentRuleA.id } }));
    record("userB مايشوفش LeadAssignmentRule بتاع orgA (عزل RLS)", leadAssignmentRulesAsB.length === 0);

    const salesTargetA = await asUser(userA.id, (tx) => tx.salesTarget.create({ data: { orgId: orgA.id, userId: userA.id, period: "RLS-test", targetType: "Revenue", targetValue: 1000 } }));
    const salesTargetsAsB = await asUser(userB.id, (tx) => tx.salesTarget.findMany({ where: { id: salesTargetA.id } }));
    record("userB مايشوفش SalesTarget بتاع orgA (عزل RLS)", salesTargetsAsB.length === 0);

    const commissionPlanA = await asUser(userA.id, (tx) => tx.commissionPlan.create({ data: { orgId: orgA.id, name: "RLS test", basis: "RevenuePercent", triggerEvent: "OnWon" } }));
    const commissionPlansAsB = await asUser(userB.id, (tx) => tx.commissionPlan.findMany({ where: { id: commissionPlanA.id } }));
    record("userB مايشوفش CommissionPlan بتاع orgA (عزل RLS)", commissionPlansAsB.length === 0);

    const commissionEntryA = await asUser(userA.id, (tx) =>
      tx.commissionEntry.create({ data: { orgId: orgA.id, planId: commissionPlanA.id, userId: userA.id, amount: 100 } })
    );
    const commissionEntriesAsB = await asUser(userB.id, (tx) => tx.commissionEntry.findMany({ where: { id: commissionEntryA.id } }));
    record("userB مايشوفش CommissionEntry بتاع orgA (عزل RLS)", commissionEntriesAsB.length === 0);

    const customerServiceCaseA = await asUser(userA.id, (tx) =>
      tx.customerServiceCase.create({ data: { orgId: orgA.id, companyId: companyA.id, caseType: "Complaint", ownerId: userA.id } })
    );
    const customerServiceCasesAsB = await asUser(userB.id, (tx) => tx.customerServiceCase.findMany({ where: { id: customerServiceCaseA.id } }));
    record("userB مايشوفش CustomerServiceCase بتاع orgA (عزل RLS)", customerServiceCasesAsB.length === 0);

    // ---------- 31) وحدة 8 — الشريحة الأولى: دفتر الأستاذ الأساسي (GL) ----------
    const cashAccountA = await asUser(userA.id, (tx) =>
      tx.chartOfAccount.create({ data: { orgId: orgA.id, accountCode: "RLS-1010", nameAr: "نقدية اختبار", nameEn: "Test Cash", accountType: "Asset", normalBalance: "Debit" } })
    );
    const revenueAccountA = await asUser(userA.id, (tx) =>
      tx.chartOfAccount.create({ data: { orgId: orgA.id, accountCode: "RLS-4010", nameAr: "إيراد اختبار", nameEn: "Test Revenue", accountType: "Revenue", normalBalance: "Credit" } })
    );
    const chartOfAccountsAsB = await asUser(userB.id, (tx) => tx.chartOfAccount.findMany({ where: { id: cashAccountA.id } }));
    record("userB مايشوفش ChartOfAccount بتاع orgA (عزل RLS)", chartOfAccountsAsB.length === 0);

    const openPeriodA = await asUser(userA.id, (tx) =>
      tx.accountingPeriod.create({ data: { orgId: orgA.id, periodName: "RLS-Open", startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31") } })
    );
    const periodsAsB = await asUser(userB.id, (tx) => tx.accountingPeriod.findMany({ where: { id: openPeriodA.id } }));
    record("userB مايشوفش AccountingPeriod بتاع orgA (عزل RLS)", periodsAsB.length === 0);

    // تاريخ جوه نطاق الفترة (2026-01-01 → 2026-01-31) — الـTrigger enforce_entry_date_within_period
    // بيرفض أي تاريخ برّه النطاق، فكل القيود التحتية لازم تستخدم التاريخ ده.
    const inPeriodDate = new Date("2026-01-15");

    // قيد متوازن — لازم يترحّل بنجاح
    const balancedEntryA = await asUser(userA.id, (tx) =>
      tx.journalEntry.create({ data: { orgId: orgA.id, entryNumber: "JE-RLS-BAL", entryDate: inPeriodDate, periodId: openPeriodA.id, preparedBy: userA.id } })
    );
    await asUser(userA.id, (tx) =>
      tx.journalLine.createMany({
        data: [
          { orgId: orgA.id, journalEntryId: balancedEntryA.id, accountId: cashAccountA.id, debit: 100, credit: 0, currency: "USD" },
          { orgId: orgA.id, journalEntryId: balancedEntryA.id, accountId: revenueAccountA.id, debit: 0, credit: 100, currency: "USD" },
        ],
      })
    );
    let balancedPosted = false;
    try {
      await asUser(userA.id, (tx) => tx.journalEntry.update({ where: { id: balancedEntryA.id }, data: { status: "Posted" } }));
      balancedPosted = true;
    } catch {
      balancedPosted = false;
    }
    record("قيد متوازن (100 مدين = 100 دائن) اترحّل بنجاح (Draft→Posted)", balancedPosted);

    // قيد غير متوازن — لازم يترفض على مستوى القاعدة وقت الترحيل
    const unbalancedEntryA = await asUser(userA.id, (tx) =>
      tx.journalEntry.create({ data: { orgId: orgA.id, entryNumber: "JE-RLS-UNBAL", entryDate: inPeriodDate, periodId: openPeriodA.id, preparedBy: userA.id } })
    );
    await asUser(userA.id, (tx) =>
      tx.journalLine.createMany({
        data: [
          { orgId: orgA.id, journalEntryId: unbalancedEntryA.id, accountId: cashAccountA.id, debit: 100, credit: 0, currency: "USD" },
          { orgId: orgA.id, journalEntryId: unbalancedEntryA.id, accountId: revenueAccountA.id, debit: 0, credit: 50, currency: "USD" },
        ],
      })
    );
    let unbalancedRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.journalEntry.update({ where: { id: unbalancedEntryA.id }, data: { status: "Posted" } }));
    } catch (e) {
      unbalancedRejected = e instanceof Error && e.message.includes("غير متوازن");
    }
    record("قيد غير متوازن (100 مدين ≠ 50 دائن) اتمنع من الترحيل فعليًا على مستوى القاعدة (Trigger)", unbalancedRejected);

    // فترة مقفولة نهائيًا — لازم تمنع أي بند جديد
    const hardClosedPeriodA = await asUser(userA.id, (tx) =>
      tx.accountingPeriod.create({
        data: { orgId: orgA.id, periodName: "RLS-HardClosed", startDate: new Date("2025-01-01"), endDate: new Date("2025-01-31"), status: "HardClosed", closedBy: userA.id, closedAt: new Date() },
      })
    );
    const hardClosedEntryA = await asUser(userA.id, (tx) =>
      tx.journalEntry.create({ data: { orgId: orgA.id, entryNumber: "JE-RLS-CLOSED", entryDate: new Date("2025-01-15"), periodId: hardClosedPeriodA.id, preparedBy: userA.id } })
    );
    let hardClosedRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.journalLine.create({ data: { orgId: orgA.id, journalEntryId: hardClosedEntryA.id, accountId: cashAccountA.id, debit: 10, credit: 0, currency: "USD" } })
      );
    } catch (e) {
      hardClosedRejected = e instanceof Error && e.message.includes("مقفولة نهائيًا");
    }
    record("بند جديد لفترة مقفولة نهائيًا (HardClosed) اتمنع فعليًا على مستوى القاعدة (Trigger)", hardClosedRejected);

    // ---------- 32) وحدة 8 — تصليب دفتر الأستاذ: 5 ثغرات سلامة بيانات اتقفلت (1 سبتمبر) ----------
    // balancedEntryA فوق مرحّل (Posted) — كل الفحوصات دي عليه.

    // (أ) إضافة بند لقيد مرحّل — لازم ترفض (immutability)
    let addLineToPostedRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.journalLine.create({ data: { orgId: orgA.id, journalEntryId: balancedEntryA.id, accountId: cashAccountA.id, debit: 5, credit: 0, currency: "USD" } })
      );
    } catch (e) {
      addLineToPostedRejected = e instanceof Error && e.message.includes("لا تُعدَّل");
    }
    record("إضافة بند لقيد مرحّل (Posted) اتمنعت فعليًا على مستوى القاعدة (immutability)", addLineToPostedRejected);

    // (ب) حذف بند من قيد مرحّل — لازم يرفض
    let deleteLineFromPostedRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.journalLine.deleteMany({ where: { journalEntryId: balancedEntryA.id } }));
    } catch (e) {
      deleteLineFromPostedRejected = e instanceof Error && e.message.includes("لا تُعدَّل");
    }
    record("حذف بند من قيد مرحّل اتمنع فعليًا على مستوى القاعدة (immutability)", deleteLineFromPostedRejected);

    // (ج) إرجاع قيد مرحّل لمسودة — لازم يرفض
    let postedToDraftRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.journalEntry.update({ where: { id: balancedEntryA.id }, data: { status: "Draft" } }));
    } catch (e) {
      postedToDraftRejected = e instanceof Error && e.message.includes("لمسودة");
    }
    record("إرجاع قيد مرحّل لمسودة (Posted→Draft) اتمنع فعليًا على مستوى القاعدة", postedToDraftRejected);

    // (د) تعديل تاريخ قيد مرحّل — لازم يرفض
    let editPostedDateRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.journalEntry.update({ where: { id: balancedEntryA.id }, data: { entryDate: new Date("2026-01-20") } }));
    } catch (e) {
      editPostedDateRejected = e instanceof Error && e.message.includes("مرحّل");
    }
    record("تعديل تاريخ قيد مرحّل اتمنع فعليًا على مستوى القاعدة (immutability)", editPostedDateRejected);

    // (هـ) حذف قيد مرحّل — لازم يرفض
    let deletePostedEntryRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.journalEntry.delete({ where: { id: balancedEntryA.id } }));
    } catch (e) {
      deletePostedEntryRejected = e instanceof Error && e.message.includes("مينفعش حذف قيد");
    }
    record("حذف قيد مرحّل اتمنع فعليًا على مستوى القاعدة (المسودات بس تتحذف)", deletePostedEntryRejected);

    // (و) قيد بعملتين مختلفتين — لازم يرفض الترحيل
    const multiCurrencyEntryA = await asUser(userA.id, (tx) =>
      tx.journalEntry.create({ data: { orgId: orgA.id, entryNumber: "JE-RLS-MULTICUR", entryDate: inPeriodDate, periodId: openPeriodA.id, preparedBy: userA.id } })
    );
    await asUser(userA.id, (tx) =>
      tx.journalLine.createMany({
        data: [
          { orgId: orgA.id, journalEntryId: multiCurrencyEntryA.id, accountId: cashAccountA.id, debit: 100, credit: 0, currency: "USD" },
          { orgId: orgA.id, journalEntryId: multiCurrencyEntryA.id, accountId: revenueAccountA.id, debit: 0, credit: 100, currency: "EGP" },
        ],
      })
    );
    let multiCurrencyRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.journalEntry.update({ where: { id: multiCurrencyEntryA.id }, data: { status: "Posted" } }));
    } catch (e) {
      multiCurrencyRejected = e instanceof Error && e.message.includes("أكتر من عملة");
    }
    record("قيد بعملتين مختلفتين (USD/EGP) اتمنع من الترحيل فعليًا على مستوى القاعدة (Trigger)", multiCurrencyRejected);

    // (ز) تاريخ قيد برّه نطاق الفترة — لازم يرفض
    let dateOutOfPeriodRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.journalEntry.create({ data: { orgId: orgA.id, entryNumber: "JE-RLS-BADDATE", entryDate: new Date("2026-06-15"), periodId: openPeriodA.id, preparedBy: userA.id } })
      );
    } catch (e) {
      dateOutOfPeriodRejected = e instanceof Error && e.message.includes("برّه نطاق الفترة");
    }
    record("تاريخ قيد برّه نطاق الفترة اتمنع فعليًا على مستوى القاعدة (Trigger)", dateOutOfPeriodRejected);

    // (ح) ترحيل قيد فترته اتقفلت نهائيًا بعد إنشائه — لازم يرفض
    const lateClosePeriodA = await asUser(userA.id, (tx) =>
      tx.accountingPeriod.create({ data: { orgId: orgA.id, periodName: "RLS-LateClose", startDate: new Date("2026-02-01"), endDate: new Date("2026-02-28") } })
    );
    const lateCloseEntryA = await asUser(userA.id, (tx) =>
      tx.journalEntry.create({ data: { orgId: orgA.id, entryNumber: "JE-RLS-LATECLOSE", entryDate: new Date("2026-02-10"), periodId: lateClosePeriodA.id, preparedBy: userA.id } })
    );
    await asUser(userA.id, (tx) =>
      tx.journalLine.createMany({
        data: [
          { orgId: orgA.id, journalEntryId: lateCloseEntryA.id, accountId: cashAccountA.id, debit: 50, credit: 0, currency: "USD" },
          { orgId: orgA.id, journalEntryId: lateCloseEntryA.id, accountId: revenueAccountA.id, debit: 0, credit: 50, currency: "USD" },
        ],
      })
    );
    await asUser(userA.id, (tx) => tx.accountingPeriod.update({ where: { id: lateClosePeriodA.id }, data: { status: "HardClosed" } }));
    let lateCloseRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.journalEntry.update({ where: { id: lateCloseEntryA.id }, data: { status: "Posted" } }));
    } catch (e) {
      lateCloseRejected = e instanceof Error && e.message.includes("اتقفلت نهائيًا");
    }
    record("ترحيل قيد فترته اتقفلت نهائيًا بعد إنشائه اتمنع فعليًا على مستوى القاعدة (Trigger)", lateCloseRejected);

    const costCenterA = await asUser(userA.id, (tx) => tx.costCenter.create({ data: { orgId: orgA.id, code: "RLS-CC", name: "RLS test", type: "Department" } }));
    const costCentersAsB = await asUser(userB.id, (tx) => tx.costCenter.findMany({ where: { id: costCenterA.id } }));
    record("userB مايشوفش CostCenter بتاع orgA (عزل RLS)", costCentersAsB.length === 0);

    const profitCenterA = await asUser(userA.id, (tx) => tx.profitCenter.create({ data: { orgId: orgA.id, code: "RLS-PC", name: "RLS test", scope: "Company" } }));
    const profitCentersAsB = await asUser(userB.id, (tx) => tx.profitCenter.findMany({ where: { id: profitCenterA.id } }));
    record("userB مايشوفش ProfitCenter بتاع orgA (عزل RLS)", profitCentersAsB.length === 0);

    // ---------- 33) وحدة 8 — الشريحة التانية: AR/AP. كل فحص هنا بيستهدف عيب متحدَّد في مواصفة الـERD ----------
    const bankAccountA = await asUser(userA.id, (tx) =>
      tx.bankAccount.create({ data: { orgId: orgA.id, accountName: "RLS-Bank", bankName: "RLS Bank", currency: "USD" } })
    );
    const bankAccountsAsB = await asUser(userB.id, (tx) => tx.bankAccount.findMany({ where: { id: bankAccountA.id } }));
    record("userB مايشوفش BankAccount بتاع orgA (عزل RLS)", bankAccountsAsB.length === 0);

    // (أ) إجمالي ≠ صافي + ضريبة — لازم يترفض (العيب 6: مفيش تحقق اتساق مبالغ في المواصفة)
    let inconsistentTotalRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.invoice.create({
          data: {
            orgId: orgA.id, invoiceNumber: "INV-RLS-BAD", invoiceType: "SalesInvoice", companyId: companyA.id,
            currency: "USD", subtotal: 100, taxAmount: 14, totalAmount: 999,
            issueDate: inPeriodDate, dueDate: new Date("2026-02-15"),
          },
        })
      );
    } catch (e) {
      inconsistentTotalRejected = e instanceof Error && e.message.includes("لازم يساوي الصافي");
    }
    record("فاتورة إجماليها ≠ صافي + ضريبة اتمنعت فعليًا على مستوى القاعدة (Trigger)", inconsistentTotalRejected);

    const invoiceA = await asUser(userA.id, (tx) =>
      tx.invoice.create({
        data: {
          orgId: orgA.id, invoiceNumber: "INV-RLS-0001", invoiceType: "SalesInvoice", companyId: companyA.id,
          currency: "USD", subtotal: 1000, taxAmount: 0, totalAmount: 1000,
          issueDate: inPeriodDate, dueDate: new Date("2026-02-15"),
        },
      })
    );
    const invoicesAsB = await asUser(userB.id, (tx) => tx.invoice.findMany({ where: { id: invoiceA.id } }));
    record("userB مايشوفش Invoice بتاع orgA (عزل RLS)", invoicesAsB.length === 0);

    // (ب) إصدار فاتورة مبيعات بلا مستند ETA معتمد — لازم يترفض
    // (العيب 10: القيد القانوني للفاتورة الإلكترونية مكانش ممتد للطبقة المحاسبية)
    let issueWithoutEtaRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.invoice.update({ where: { id: invoiceA.id }, data: { status: "Issued" } }));
    } catch (e) {
      issueWithoutEtaRejected = e instanceof Error && e.message.includes("بلا مستند قانوني مربوط");
    }
    record("إصدار فاتورة مبيعات بلا مستند ETA معتمد اتمنع فعليًا على مستوى القاعدة (قيد قانوني)", issueWithoutEtaRejected);

    // فاتورة مشتريات مالهاش قيد ETA — دي اللي هنكمل عليها فحوصات التخصيص
    const purchaseInvoiceA = await asUser(userA.id, (tx) =>
      tx.invoice.create({
        data: {
          orgId: orgA.id, invoiceNumber: "INV-RLS-0002", invoiceType: "PurchaseInvoice", supplierId: supplierA.id,
          currency: "USD", subtotal: 1000, taxAmount: 0, totalAmount: 1000,
          issueDate: inPeriodDate, dueDate: new Date("2026-02-15"), status: "Issued",
        },
      })
    );

    const paymentA = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-0001", direction: "Outbound", supplierId: supplierA.id,
          bankAccountId: bankAccountA.id, amount: 400, currency: "USD",
          paymentDate: inPeriodDate, status: "Cleared", createdBy: userA.id,
        },
      })
    );
    const paymentsAsB = await asUser(userB.id, (tx) => tx.payment.findMany({ where: { id: paymentA.id } }));
    record("userB مايشوفش Payment بتاع orgA (عزل RLS)", paymentsAsB.length === 0);

    // (ج) تخصيص أكبر من مبلغ الدفعة — لازم يترفض (العيب 3: مفيش أي منع للتخصيص الزائد)
    let overPaymentRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.paymentAllocation.create({ data: { orgId: orgA.id, paymentId: paymentA.id, invoiceId: purchaseInvoiceA.id, allocatedAmount: 900 } })
      );
    } catch (e) {
      overPaymentRejected = e instanceof Error && e.message.includes("بيتجاوز مبلغ الدفعة");
    }
    record("تخصيص أكبر من مبلغ الدفعة اتمنع فعليًا على مستوى القاعدة (Trigger)", overPaymentRejected);

    // (د) تخصيص بعملة مختلفة — لازم يترفض (العيب 7)
    const egpPaymentA = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-0002", direction: "Outbound", supplierId: supplierA.id,
          bankAccountId: bankAccountA.id, amount: 100, currency: "EGP",
          paymentDate: inPeriodDate, status: "Cleared", createdBy: userA.id,
        },
      })
    );
    let crossCurrencyAllocRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.paymentAllocation.create({ data: { orgId: orgA.id, paymentId: egpPaymentA.id, invoiceId: purchaseInvoiceA.id, allocatedAmount: 50 } })
      );
    } catch (e) {
      crossCurrencyAllocRejected = e instanceof Error && e.message.includes("التخصيص عابر العملات");
    }
    record("تخصيص دفعة EGP على فاتورة USD اتمنع فعليًا على مستوى القاعدة (Trigger)", crossCurrencyAllocRejected);

    // (هـ) تخصيص جزئي — الحالة والمبلغ المدفوع لازم يتحدّثوا تلقائيًا (العيب 4: انحراف الحالة المشتقّة)
    const allocationA = await asUser(userA.id, (tx) =>
      tx.paymentAllocation.create({ data: { orgId: orgA.id, paymentId: paymentA.id, invoiceId: purchaseInvoiceA.id, allocatedAmount: 400 } })
    );
    const afterPartial = await asUser(userA.id, (tx) => tx.invoice.findUniqueOrThrow({ where: { id: purchaseInvoiceA.id } }));
    record(
      "تخصيص جزئي حدّث amountPaid=400 وحوّل الحالة لـPartiallyPaid تلقائيًا (Trigger)",
      afterPartial.status === "PartiallyPaid" && afterPartial.amountPaid.equals(400)
    );

    // (و) تخصيص يتجاوز إجمالي الفاتورة — لازم يترفض
    const bigPaymentA = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-0003", direction: "Outbound", supplierId: supplierA.id,
          bankAccountId: bankAccountA.id, amount: 5000, currency: "USD",
          paymentDate: inPeriodDate, status: "Cleared", createdBy: userA.id,
        },
      })
    );
    let overInvoiceRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.paymentAllocation.create({ data: { orgId: orgA.id, paymentId: bigPaymentA.id, invoiceId: purchaseInvoiceA.id, allocatedAmount: 700 } })
      );
    } catch (e) {
      overInvoiceRejected = e instanceof Error && e.message.includes("بيتجاوز إجمالي الفاتورة");
    }
    record("تخصيص بيتجاوز إجمالي الفاتورة (400 مخصّص + 700 على فاتورة 1000) اتمنع فعليًا (Trigger)", overInvoiceRejected);

    // (ز) استكمال الدفع — الحالة لازم تبقى Paid تلقائيًا
    await asUser(userA.id, (tx) =>
      tx.paymentAllocation.create({ data: { orgId: orgA.id, paymentId: bigPaymentA.id, invoiceId: purchaseInvoiceA.id, allocatedAmount: 600 } })
    );
    const afterFull = await asUser(userA.id, (tx) => tx.invoice.findUniqueOrThrow({ where: { id: purchaseInvoiceA.id } }));
    record("استكمال التخصيص لـ1000 حوّل الحالة لـPaid تلقائيًا (Trigger)", afterFull.status === "Paid" && afterFull.amountPaid.equals(1000));

    // (ح) تعديل مبالغ فاتورة مدفوعة — لازم يترفض (التصحيح بإشعار دائن مش تعديل)
    let editPaidInvoiceRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.invoice.update({ where: { id: purchaseInvoiceA.id }, data: { subtotal: 50, totalAmount: 50 } }));
    } catch (e) {
      editPaidInvoiceRejected = e instanceof Error && e.message.includes("مايتغيّروش");
    }
    record("تعديل مبالغ فاتورة مدفوعة اتمنع فعليًا على مستوى القاعدة (Trigger)", editPaidInvoiceRejected);

    // (ط) دفعة معلّقة (Pending) مش بتقلّل رصيد الفاتورة — الدفعة المحصّلة بس هي اللي بتحسب
    const pendingInvoiceA = await asUser(userA.id, (tx) =>
      tx.invoice.create({
        data: {
          orgId: orgA.id, invoiceNumber: "INV-RLS-0003", invoiceType: "PurchaseInvoice", supplierId: supplierA.id,
          currency: "USD", subtotal: 500, taxAmount: 0, totalAmount: 500,
          issueDate: inPeriodDate, dueDate: new Date("2026-02-15"), status: "Issued",
        },
      })
    );
    const pendingPaymentA = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-0004", direction: "Outbound", supplierId: supplierA.id,
          bankAccountId: bankAccountA.id, amount: 500, currency: "USD",
          paymentDate: inPeriodDate, createdBy: userA.id,
        },
      })
    );
    const pendingAllocationA = await asUser(userA.id, (tx) =>
      tx.paymentAllocation.create({ data: { orgId: orgA.id, paymentId: pendingPaymentA.id, invoiceId: pendingInvoiceA.id, allocatedAmount: 500 } })
    );
    const afterPendingAlloc = await asUser(userA.id, (tx) => tx.invoice.findUniqueOrThrow({ where: { id: pendingInvoiceA.id } }));
    record("تخصيص من دفعة معلّقة (Pending) مقلّلش رصيد الفاتورة (المحصّلة بس هي اللي تتحسب)", afterPendingAlloc.amountPaid.isZero());

    // (ي) تحصيل الدفعة بيزامن الفاتورة تلقائيًا من غير أي تدخل من التطبيق
    await asUser(userA.id, (tx) => tx.payment.update({ where: { id: pendingPaymentA.id }, data: { status: "Cleared" } }));
    const afterClear = await asUser(userA.id, (tx) => tx.invoice.findUniqueOrThrow({ where: { id: pendingInvoiceA.id } }));
    record("تحويل الدفعة لـCleared زامن الفاتورة لـPaid تلقائيًا (Trigger على Payment)", afterClear.status === "Paid");

    // (ك) ارتداد الدفعة بيرجّع الفاتورة لحالتها تلقائيًا
    await asUser(userA.id, (tx) => tx.payment.update({ where: { id: pendingPaymentA.id }, data: { status: "Bounced" } }));
    const afterBounce = await asUser(userA.id, (tx) => tx.invoice.findUniqueOrThrow({ where: { id: pendingInvoiceA.id } }));
    record("ارتداد الدفعة رجّع الفاتورة لـIssued ورصيدها لصفر تلقائيًا (Trigger)", afterBounce.status === "Issued" && afterBounce.amountPaid.isZero());

    const allocationsAsB = await asUser(userB.id, (tx) => tx.paymentAllocation.findMany({ where: { id: allocationA.id } }));
    record("userB مايشوفش PaymentAllocation بتاع orgA (عزل RLS)", allocationsAsB.length === 0);
    void pendingAllocationA;

    // ---------- 34) وحدة 8 — الشريحة التالتة: الخزينة. كل فحص بيستهدف عيبًا متحدَّدًا في مواصفة §11.3 ----------

    // (أ) مبلغ حركة ≤ صفر يترفض (العيب 7: amount بلا إشارة ولا اتجاه محسوم)
    let negativeAmountRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.bankTransaction.create({
          data: {
            orgId: orgA.id, bankAccountId: bankAccountA.id, transactionDate: inPeriodDate,
            amount: -50, currency: "USD", transactionType: "Deposit",
          },
        })
      );
    } catch (e) {
      negativeAmountRejected = e instanceof Error && e.message.includes("أكبر من صفر");
    }
    record("حركة بنكية بمبلغ سالب اتمنعت فعليًا على مستوى القاعدة (Trigger)", negativeAmountRejected);

    // (ب) عملة الحركة مخالفة لعملة الحساب (العيب 8)
    let wrongCurrencyRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.bankTransaction.create({
          data: {
            orgId: orgA.id, bankAccountId: bankAccountA.id, transactionDate: inPeriodDate,
            amount: 100, currency: "EGP", transactionType: "Deposit",
          },
        })
      );
    } catch (e) {
      wrongCurrencyRejected = e instanceof Error && e.message.includes("مختلفة عن عملة الحساب");
    }
    record("حركة بنكية بعملة مخالفة لعملة الحساب اتمنعت فعليًا على مستوى القاعدة (Trigger)", wrongCurrencyRejected);

    const bankTxnA = await asUser(userA.id, (tx) =>
      tx.bankTransaction.create({
        data: {
          orgId: orgA.id, bankAccountId: bankAccountA.id, transactionDate: inPeriodDate,
          amount: 400, currency: "USD", transactionType: "Withdrawal", reference: "RLS-TXN-1",
        },
      })
    );
    const bankTxnsAsB = await asUser(userB.id, (tx) => tx.bankTransaction.findMany({ where: { id: bankTxnA.id } }));
    record("userB مايشوفش BankTransaction بتاع orgA (عزل RLS)", bankTxnsAsB.length === 0);

    // (ج) مضاهاة بدفعة من حساب بنكي تاني (العيب 1: الرابط اللي المواصفة أصلًا مفيهاش)
    const otherBankAccountA = await asUser(userA.id, (tx) =>
      tx.bankAccount.create({ data: { orgId: orgA.id, accountName: "RLS-Bank-2", bankName: "RLS Bank 2", currency: "USD" } })
    );
    const otherAccountPaymentA = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-0005", direction: "Outbound", supplierId: supplierA.id,
          bankAccountId: otherBankAccountA.id, amount: 400, currency: "USD",
          paymentDate: inPeriodDate, status: "Cleared", createdBy: userA.id,
        },
      })
    );
    let crossAccountMatchRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.bankTransaction.update({ where: { id: bankTxnA.id }, data: { paymentId: otherAccountPaymentA.id } }));
    } catch (e) {
      crossAccountMatchRejected = e instanceof Error && e.message.includes("من حساب بنكي تاني");
    }
    record("مضاهاة حركة بدفعة من حساب بنكي تاني اتمنعت فعليًا على مستوى القاعدة (Trigger)", crossAccountMatchRejected);

    // (د) مضاهاة بدفعة بمبلغ مختلف
    const wrongAmountPaymentA = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-0006", direction: "Outbound", supplierId: supplierA.id,
          bankAccountId: bankAccountA.id, amount: 999, currency: "USD",
          paymentDate: inPeriodDate, status: "Cleared", createdBy: userA.id,
        },
      })
    );
    let amountMismatchRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.bankTransaction.update({ where: { id: bankTxnA.id }, data: { paymentId: wrongAmountPaymentA.id } }));
    } catch (e) {
      amountMismatchRejected = e instanceof Error && e.message.includes("مش مطابق لمبلغ الدفعة");
    }
    record("مضاهاة حركة بدفعة بمبلغ مختلف اتمنعت فعليًا على مستوى القاعدة (Trigger)", amountMismatchRejected);

    // (هـ) bookBalance بيتحسب تلقائيًا (العيب 2: المواصفة بتحطه كحقل يدوي)
    // الحساب رصيده الافتتاحي 0 وعليه حركة سحب 400 → الرصيد الدفتري = -400.
    const reconciliationA = await asUser(userA.id, (tx) =>
      tx.bankReconciliation.create({
        data: {
          orgId: orgA.id, bankAccountId: bankAccountA.id,
          statementDate: new Date("2026-01-31"), statementBalance: -400,
        },
      })
    );
    record(
      "الرصيد الدفتري اتحسب تلقائيًا (-400 من حركة سحب) بلا أي إدخال يدوي (Trigger)",
      reconciliationA.bookBalance.equals(-400)
    );
    const reconciliationsAsB = await asUser(userB.id, (tx) => tx.bankReconciliation.findMany({ where: { id: reconciliationA.id } }));
    record("userB مايشوفش BankReconciliation بتاع orgA (عزل RLS)", reconciliationsAsB.length === 0);

    // (و) حركة جديدة بتحدّث الرصيد الدفتري للمطابقات المفتوحة تلقائيًا
    const extraTxnA = await asUser(userA.id, (tx) =>
      tx.bankTransaction.create({
        data: {
          orgId: orgA.id, bankAccountId: bankAccountA.id, transactionDate: new Date("2026-01-20"),
          amount: 100, currency: "USD", transactionType: "Charge", reference: "RLS-FEE",
        },
      })
    );
    const afterExtraTxn = await asUser(userA.id, (tx) => tx.bankReconciliation.findUniqueOrThrow({ where: { id: reconciliationA.id } }));
    record(
      "إضافة حركة حدّثت الرصيد الدفتري للمطابقة المفتوحة تلقائيًا (-500) — مش بيبقى قديم",
      afterExtraTxn.bookBalance.equals(-500)
    );

    // (ز) إقفال المطابقة والفرق ≠ صفر — لازم يترفض (العيب 3: الغرض الكامل للكيان غير مُنفَّذ)
    let unbalancedCloseRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.bankReconciliation.update({
          where: { id: reconciliationA.id },
          data: { status: "Reconciled", reconciledBy: userA.id, reconciledAt: new Date() },
        })
      );
    } catch (e) {
      unbalancedCloseRejected = e instanceof Error && e.message.includes("الفرق لسه");
    }
    record("إقفال مطابقة بنكية والفرق ≠ صفر اتمنع فعليًا على مستوى القاعدة (Trigger)", unbalancedCloseRejected);

    // (ح) إقفال بلا تسجيل مين طابق وإمتى — لازم يترفض (العيب 11: ثغرة تدقيق)
    await asUser(userA.id, (tx) =>
      tx.bankReconciliation.update({ where: { id: reconciliationA.id }, data: { statementBalance: -500 } })
    );
    let closeWithoutAuditRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.bankReconciliation.update({ where: { id: reconciliationA.id }, data: { status: "Reconciled" } }));
    } catch (e) {
      closeWithoutAuditRejected = e instanceof Error && e.message.includes("مين طابقها وإمتى");
    }
    record("إقفال مطابقة بلا تسجيل مين طابقها وإمتى اتمنع فعليًا على مستوى القاعدة (Trigger)", closeWithoutAuditRejected);

    // (ط) الإقفال الصحيح بينجح
    await asUser(userA.id, (tx) =>
      tx.bankReconciliation.update({
        where: { id: reconciliationA.id },
        data: { status: "Reconciled", reconciledBy: userA.id, reconciledAt: new Date() },
      })
    );
    const closedRec = await asUser(userA.id, (tx) => tx.bankReconciliation.findUniqueOrThrow({ where: { id: reconciliationA.id } }));
    record("إقفال المطابقة بعد تصفير الفرق نجح فعليًا", closedRec.status === "Reconciled");

    // (ي) تعديل مطابقة مقفولة — لازم يترفض (العيب 10: نفس فلسفة immutability القيد المرحّل)
    let editClosedRecRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.bankReconciliation.update({ where: { id: reconciliationA.id }, data: { statementBalance: 1 } }));
    } catch (e) {
      editClosedRecRejected = e instanceof Error && e.message.includes("مقفولة");
    }
    record("تعديل مطابقة بنكية مقفولة اتمنع فعليًا على مستوى القاعدة (immutability)", editClosedRecRejected);

    // (ك) القرض: أقساط أكبر من أصله (العيب 14)
    const loanA = await asUser(userA.id, (tx) =>
      tx.loan.create({
        data: {
          orgId: orgA.id, lenderName: "RLS Lender", bankAccountId: bankAccountA.id,
          principal: 1000, outstandingPrincipal: 1000, currency: "USD",
          startDate: inPeriodDate, maturityDate: new Date("2027-01-15"),
        },
      })
    );
    const loansAsB = await asUser(userB.id, (tx) => tx.loan.findMany({ where: { id: loanA.id } }));
    record("userB مايشوفش Loan بتاع orgA (عزل RLS)", loansAsB.length === 0);

    let overPrincipalRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.loanInstallment.create({ data: { orgId: orgA.id, loanId: loanA.id, dueDate: new Date("2026-02-15"), principalPortion: 1500 } })
      );
    } catch (e) {
      overPrincipalRejected = e instanceof Error && e.message.includes("بيتجاوز أصل القرض");
    }
    record("قسط بأصل أكبر من أصل القرض اتمنع فعليًا على مستوى القاعدة (Trigger)", overPrincipalRejected);

    // (ل) outstandingPrincipal بيقل تلقائيًا والقرض بيتقفل عند الصفر (العيب 6)
    const installment1A = await asUser(userA.id, (tx) =>
      tx.loanInstallment.create({ data: { orgId: orgA.id, loanId: loanA.id, dueDate: new Date("2026-02-15"), principalPortion: 600, interestPortion: 50 } })
    );
    const installment2A = await asUser(userA.id, (tx) =>
      tx.loanInstallment.create({ data: { orgId: orgA.id, loanId: loanA.id, dueDate: new Date("2026-03-15"), principalPortion: 400, interestPortion: 20 } })
    );
    const installmentsAsB = await asUser(userB.id, (tx) => tx.loanInstallment.findMany({ where: { id: installment1A.id } }));
    record("userB مايشوفش LoanInstallment بتاع orgA (عزل RLS)", installmentsAsB.length === 0);

    await asUser(userA.id, (tx) => tx.loanInstallment.update({ where: { id: installment1A.id }, data: { status: "Paid" } }));
    const afterFirstInstallment = await asUser(userA.id, (tx) => tx.loan.findUniqueOrThrow({ where: { id: loanA.id } }));
    record(
      "سداد قسط قلّل المتبقي من أصل القرض تلقائيًا (1000 → 400) والقرض لسه قائم (Trigger)",
      afterFirstInstallment.outstandingPrincipal.equals(400) && afterFirstInstallment.status === "Active"
    );

    await asUser(userA.id, (tx) => tx.loanInstallment.update({ where: { id: installment2A.id }, data: { status: "Paid" } }));
    const afterAllInstallments = await asUser(userA.id, (tx) => tx.loan.findUniqueOrThrow({ where: { id: loanA.id } }));
    record(
      "سداد آخر قسط صفّر المتبقي وحوّل القرض لـSettled تلقائيًا (Trigger)",
      afterAllInstallments.outstandingPrincipal.isZero() && afterAllInstallments.status === "Settled"
    );

    // (م) التدفّق النقدي: بداية أسبوع مش إتنين (العيب 18)
    let nonMondayRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.cashFlowForecastLine.create({
          data: { orgId: orgA.id, weekStartDate: new Date("2026-01-15"), category: "Payroll", amount: 100, currency: "USD" },
        })
      );
    } catch (e) {
      nonMondayRejected = e instanceof Error && e.message.includes("يوم إتنين");
    }
    record("سطر تدفّق نقدي ببداية أسبوع مش يوم إتنين اتمنع فعليًا على مستوى القاعدة (Trigger)", nonMondayRejected);

    // (ن) OpeningCash/ClosingCash كإدخال يدوي (العيب 16: دول أرصدة محسوبة مش تدفّقات)
    let openingCashRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.cashFlowForecastLine.create({
          data: { orgId: orgA.id, weekStartDate: new Date("2026-01-12"), category: "OpeningCash", amount: 100, currency: "USD" },
        })
      );
    } catch (e) {
      openingCashRejected = e instanceof Error && e.message.includes("بيتحسب من الأرصدة");
    }
    record("سطر رصيد افتتاحي كإدخال يدوي اتمنع فعليًا على مستوى القاعدة (Trigger)", openingCashRejected);

    // 2026-01-12 يوم إتنين فعلًا
    const cashFlowLineA = await asUser(userA.id, (tx) =>
      tx.cashFlowForecastLine.create({
        data: { orgId: orgA.id, weekStartDate: new Date("2026-01-12"), category: "Payroll", amount: 5000, currency: "USD" },
      })
    );
    const cashFlowLinesAsB = await asUser(userB.id, (tx) => tx.cashFlowForecastLine.findMany({ where: { id: cashFlowLineA.id } }));
    record("userB مايشوفش CashFlowForecastLine بتاع orgA (عزل RLS)", cashFlowLinesAsB.length === 0);

    void extraTxnA;

    // ---------- 35) وحدة 8 — الشريحة الرابعة والأخيرة: الموازنات والأصول والضرائب. كل فحص بيستهدف عيبًا متحدَّدًا في مواصفة §11.4 ----------

    const fixedAssetA = await asUser(userA.id, (tx) =>
      tx.fixedAsset.create({
        data: {
          orgId: orgA.id, assetCode: "RLS-FA-0001", nameAr: "أصل اختبار", nameEn: "RLS test asset",
          category: "Equipment", costCenterId: costCenterA.id, purchaseDate: inPeriodDate,
          purchaseValue: 60000, currency: "USD", usefulLifeMonths: 24,
        },
      })
    );
    const fixedAssetsAsB = await asUser(userB.id, (tx) => tx.fixedAsset.findMany({ where: { id: fixedAssetA.id } }));
    record("userB مايشوفش FixedAsset بتاع orgA (عزل RLS)", fixedAssetsAsB.length === 0);

    // (أ) إهلاك يتجاوز قيمة الأصل — لازم يترفض (العيب: مفيش قيد يمنع تجاوز الإهلاك للقيمة القابلة للإهلاك)
    let overDepreciationRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.depreciationEntry.create({ data: { orgId: orgA.id, assetId: fixedAssetA.id, period: "RLS-P1", amount: 70000, journalEntryId: balancedEntryA.id } })
      );
    } catch (e) {
      overDepreciationRejected = e instanceof Error && e.message.includes("بيتجاوز قيمة شراء الأصل");
    }
    record("إهلاك بمبلغ أكبر من قيمة شراء الأصل اتمنع فعليًا على مستوى القاعدة (Trigger)", overDepreciationRejected);

    // (ب) إهلاك صحيح — والـTrigger بيصون accumulatedDepreciation/netBookValue تلقائيًا
    const depreciationEntry1A = await asUser(userA.id, (tx) =>
      tx.depreciationEntry.create({ data: { orgId: orgA.id, assetId: fixedAssetA.id, period: "RLS-P1", amount: 30000, journalEntryId: balancedEntryA.id } })
    );
    const depreciationEntriesAsB = await asUser(userB.id, (tx) => tx.depreciationEntry.findMany({ where: { id: depreciationEntry1A.id } }));
    record("userB مايشوفش DepreciationEntry بتاع orgA (عزل RLS)", depreciationEntriesAsB.length === 0);

    const afterFirstDepreciation = await asUser(userA.id, (tx) => tx.fixedAsset.findUniqueOrThrow({ where: { id: fixedAssetA.id } }));
    record(
      "accumulatedDepreciation/netBookValue اتحدّثوا تلقائيًا (30000/30000) بلا أي إدخال يدوي (Trigger) — أهم رقمين مش موجودين في المواصفة",
      afterFirstDepreciation.accumulatedDepreciation.equals(30000) && afterFirstDepreciation.netBookValue.equals(30000)
    );

    // (ج) إهلاك تاني يخلي المجموع يتجاوز القيمة (30000 + 40000 > 60000) — لازم يترفض
    let cumulativeOverDepreciationRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.depreciationEntry.create({ data: { orgId: orgA.id, assetId: fixedAssetA.id, period: "RLS-P2", amount: 40000, journalEntryId: balancedEntryA.id } })
      );
    } catch (e) {
      cumulativeOverDepreciationRejected = e instanceof Error && e.message.includes("بيتجاوز قيمة شراء الأصل");
    }
    record("مجموع الإهلاك التراكمي المتجاوز لقيمة الأصل اتمنع فعليًا على مستوى القاعدة (Trigger)", cumulativeOverDepreciationRejected);

    // (د) التخلص من أصل بلا القيد المحاسبي المقابل — لازم يترفض (العيب: disposalValue بلا أي قيد)
    let disposalWithoutJournalRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.fixedAsset.update({ where: { id: fixedAssetA.id }, data: { status: "Disposed", disposalDate: inPeriodDate, disposalValue: 25000 } })
      );
    } catch (e) {
      disposalWithoutJournalRejected = e instanceof Error && e.message.includes("بلا تاريخ التخلص وحصيلته والقيد المحاسبي");
    }
    record("التخلص من أصل بلا تسجيل القيد المحاسبي المقابل اتمنع فعليًا على مستوى القاعدة (Trigger)", disposalWithoutJournalRejected);

    // (هـ) التخلص الصحيح بينجح، وبعده الأصل مايرجعش Active (نهائي)
    await asUser(userA.id, (tx) =>
      tx.fixedAsset.update({
        where: { id: fixedAssetA.id },
        data: { status: "Disposed", disposalDate: inPeriodDate, disposalValue: 25000, disposalJournalEntryId: balancedEntryA.id },
      })
    );
    let reactivationRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.fixedAsset.update({ where: { id: fixedAssetA.id }, data: { status: "Active" } }));
    } catch (e) {
      reactivationRejected = e instanceof Error && e.message.includes("مايرجعش");
    }
    record("الأصل المتباع مايرجعش لحالة Active فعليًا على مستوى القاعدة (immutability جزئية)", reactivationRejected);

    // (و) إهلاك لأصل متباع — لازم يترفض (الإهلاك للنشط بس)
    let depreciationForDisposedRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.depreciationEntry.create({ data: { orgId: orgA.id, assetId: fixedAssetA.id, period: "RLS-P3", amount: 1000, journalEntryId: balancedEntryA.id } })
      );
    } catch (e) {
      depreciationForDisposedRejected = e instanceof Error && e.message.includes("الإهلاك للأصول النشطة بس");
    }
    record("إهلاك أصل متباع اتمنع فعليًا على مستوى القاعدة (Trigger)", depreciationForDisposedRejected);

    // (ز) بند موازنة بمبلغ سالب/صفر — لازم يترفض
    let negativeBudgetRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.budget.create({ data: { orgId: orgA.id, periodId: openPeriodA.id, budgetType: "OPEX", costCenterId: costCenterA.id, amount: -500, currency: "USD" } })
      );
    } catch (e) {
      negativeBudgetRejected = e instanceof Error && e.message.includes("أكبر من صفر");
    }
    record("بند موازنة بمبلغ سالب اتمنع فعليًا على مستوى القاعدة (Trigger)", negativeBudgetRejected);

    const budgetA = await asUser(userA.id, (tx) =>
      tx.budget.create({ data: { orgId: orgA.id, periodId: openPeriodA.id, budgetType: "OPEX", costCenterId: costCenterA.id, amount: 5000, currency: "USD" } })
    );
    const budgetsAsB = await asUser(userB.id, (tx) => tx.budget.findMany({ where: { id: budgetA.id } }));
    record("userB مايشوفش Budget بتاع orgA (عزل RLS)", budgetsAsB.length === 0);

    // (ح) بند موازنة مكرر لنفس الفترة/النوع/مركز التكلفة/العملة — لازم يترفض (العيب: مفيش @@unique في المواصفة)
    let duplicateBudgetRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.budget.create({ data: { orgId: orgA.id, periodId: openPeriodA.id, budgetType: "OPEX", costCenterId: costCenterA.id, amount: 9999, currency: "USD" } })
      );
    } catch {
      duplicateBudgetRejected = true;
    }
    record("بند موازنة مكرر لنفس الفترة/النوع/مركز التكلفة اتمنع فعليًا على مستوى القاعدة (@@unique)", duplicateBudgetRejected);

    // (ط) filingStatus=Paid بلا دفعة مربوطة — لازم يترفض (العيب: نفس عيب LoanInstallment.status=Paid)
    let taxPaidWithoutPaymentRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.taxRecord.create({ data: { orgId: orgA.id, taxType: "WithholdingTax", periodId: openPeriodA.id, amount: 1000, currency: "USD", filingStatus: "Paid", filingDate: inPeriodDate } })
      );
    } catch (e) {
      taxPaidWithoutPaymentRejected = e instanceof Error && e.message.includes("بلا دفعة حقيقية");
    }
    record("إقرار ضريبي 'مدفوع' بلا دفعة حقيقية مربوطة اتمنع فعليًا على مستوى القاعدة (Trigger)", taxPaidWithoutPaymentRejected);

    // (ي) إقرار مُقدَّم بلا تاريخ تقديم — لازم يترفض
    let taxFiledWithoutDateRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.taxRecord.create({ data: { orgId: orgA.id, taxType: "PayrollTax", periodId: openPeriodA.id, amount: 500, currency: "USD", filingStatus: "Filed" } })
      );
    } catch (e) {
      taxFiledWithoutDateRejected = e instanceof Error && e.message.includes("تاريخ التقديم");
    }
    record("إقرار ضريبي مُقدَّم بلا تاريخ تقديم اتمنع فعليًا على مستوى القاعدة (Trigger)", taxFiledWithoutDateRejected);

    const taxRecordA = await asUser(userA.id, (tx) =>
      tx.taxRecord.create({ data: { orgId: orgA.id, taxType: "WithholdingTax", periodId: openPeriodA.id, amount: 1000, currency: "USD" } })
    );
    const taxRecordsAsB = await asUser(userB.id, (tx) => tx.taxRecord.findMany({ where: { id: taxRecordA.id } }));
    record("userB مايشوفش TaxRecord بتاع orgA (عزل RLS)", taxRecordsAsB.length === 0);

    // (ك) إقرار مكرر لنفس النوع/الفترة — لازم يترفض (العيب: مفيش @@unique في المواصفة)
    let duplicateTaxRecordRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.taxRecord.create({ data: { orgId: orgA.id, taxType: "WithholdingTax", periodId: openPeriodA.id, amount: 2000, currency: "USD" } })
      );
    } catch {
      duplicateTaxRecordRejected = true;
    }
    record("إقرار ضريبي مكرر لنفس النوع والفترة اتمنع فعليًا على مستوى القاعدة (@@unique)", duplicateTaxRecordRejected);

    // ---------- 36) وحدة 9 — الشريحة التانية: الحوكمة والإدارة. فصل المهام هو الوحيد اللي الـERD بيحتّم إنفاذه كـTrigger ----------

    // (أ) قبل تفعيل أي قاعدة — دفعة بنفس المنشئ والمعتمِد لازم تنجح (السلوك الحالي محفوظ)
    const sodPayment1A = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-SOD-1", direction: "Outbound", supplierId: supplierA.id,
          bankAccountId: bankAccountA.id, amount: 100, currency: "USD", paymentDate: inPeriodDate, createdBy: userA.id,
        },
      })
    );
    let sameUserBeforeRuleOk = false;
    try {
      await asUser(userA.id, (tx) => tx.payment.update({ where: { id: sodPayment1A.id }, data: { approvedBy: userA.id } }));
      sameUserBeforeRuleOk = true;
    } catch {
      sameUserBeforeRuleOk = false;
    }
    record("دفعة بنفس المنشئ والمعتمِد نجحت قبل تفعيل أي قاعدة فصل مهام (السلوك الافتراضي محفوظ)", sameUserBeforeRuleOk);

    // (ب) تفعيل قاعدة فصل مهام على Payment.Create/Payment.Approve
    const sodRuleA = await asUser(userA.id, (tx) =>
      tx.segregationOfDutyRule.create({ data: { orgId: orgA.id, action1: "Payment.Create", action2: "Payment.Approve", mustBeDifferentUser: true, isActive: true } })
    );
    const sodRulesAsB = await asUser(userB.id, (tx) => tx.segregationOfDutyRule.findMany({ where: { id: sodRuleA.id } }));
    record("userB مايشوفش SegregationOfDutyRule بتاع orgA (عزل RLS)", sodRulesAsB.length === 0);

    // (ج) بعد التفعيل — دفعة بنفس المنشئ والمعتمِد لازم تترفض فعليًا
    const sodPayment2A = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-SOD-2", direction: "Outbound", supplierId: supplierA.id,
          bankAccountId: bankAccountA.id, amount: 200, currency: "USD", paymentDate: inPeriodDate, createdBy: userA.id,
        },
      })
    );
    let sameUserAfterRuleRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.payment.update({ where: { id: sodPayment2A.id }, data: { approvedBy: userA.id } }));
    } catch (e) {
      sameUserAfterRuleRejected = e instanceof Error && e.message.includes("فصل المهام مفعّل");
    }
    record("دفعة بنفس المنشئ والمعتمِد بعد تفعيل قاعدة فصل المهام اتمنعت فعليًا على مستوى القاعدة (Trigger)", sameUserAfterRuleRejected);

    // (د) نفس الفترة، معتمِد مختلف — لازم تنجح رغم القاعدة مفعّلة
    let differentUserAfterRuleOk = false;
    try {
      await asUser(userA.id, (tx) => tx.payment.update({ where: { id: sodPayment2A.id }, data: { approvedBy: userB.id } }));
      differentUserAfterRuleOk = true;
    } catch {
      differentUserAfterRuleOk = false;
    }
    record("دفعة بمعتمِد مختلف عن المنشئ نجحت رغم قاعدة فصل المهام مفعّلة", differentUserAfterRuleOk);

    // (هـ) إيقاف القاعدة — نفس سيناريو (ج) لازم ينجح تاني
    await asUser(userA.id, (tx) => tx.segregationOfDutyRule.update({ where: { id: sodRuleA.id }, data: { isActive: false } }));
    const sodPayment3A = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-SOD-3", direction: "Outbound", supplierId: supplierA.id,
          bankAccountId: bankAccountA.id, amount: 300, currency: "USD", paymentDate: inPeriodDate, createdBy: userA.id,
        },
      })
    );
    let sameUserAfterDeactivationOk = false;
    try {
      await asUser(userA.id, (tx) => tx.payment.update({ where: { id: sodPayment3A.id }, data: { approvedBy: userA.id } }));
      sameUserAfterDeactivationOk = true;
    } catch {
      sameUserAfterDeactivationOk = false;
    }
    record("إيقاف القاعدة رجّع السلوك الافتراضي — دفعة بنفس المنشئ والمعتمِد نجحت تاني", sameUserAfterDeactivationOk);

    // (و) فصل مهام موسَّع: منشئ Supplier ≠ معتمِد أول Payment له (المثال الحرفي في docs/ERD.md §12)
    const sodSupplierA = await asUser(userA.id, (tx) =>
      tx.supplier.create({ data: { orgId: orgA.id, legalName: "SoD Supplier A", createdBy: userA.id } })
    );
    const sodSupplierRuleA = await asUser(userA.id, (tx) =>
      tx.segregationOfDutyRule.create({ data: { orgId: orgA.id, action1: "Supplier.Create", action2: "Payment.Approve", mustBeDifferentUser: true, isActive: true } })
    );
    const sodSupplierPaymentA = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-SOD-SUP-1", direction: "Outbound", supplierId: sodSupplierA.id,
          bankAccountId: bankAccountA.id, amount: 400, currency: "USD", paymentDate: inPeriodDate, createdBy: userB.id,
        },
      })
    );
    let supplierCreatorApprovalRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.payment.update({ where: { id: sodSupplierPaymentA.id }, data: { approvedBy: sodSupplierA.createdBy! } }));
    } catch (e) {
      supplierCreatorApprovalRejected = e instanceof Error && e.message.includes("فصل المهام مفعّل");
    }
    record("قاعدة فصل مهام Supplier.Create/Payment.Approve اتفعّلت — معتمِد الدفعة هو نفس منشئ المورّد اتمنع فعليًا", supplierCreatorApprovalRejected);

    let differentApproverForSupplierOk = false;
    try {
      await asUser(userA.id, (tx) => tx.payment.update({ where: { id: sodSupplierPaymentA.id }, data: { approvedBy: userB.id } }));
      differentApproverForSupplierOk = true;
    } catch {
      differentApproverForSupplierOk = false;
    }
    record("دفعة بمعتمِد مختلف عن منشئ المورّد نجحت رغم قاعدة فصل المهام الموسَّعة مفعّلة", differentApproverForSupplierOk);

    // مورّد قديم (createdBy = NULL) — القاعدة مبتتفعّلش عليه حتى لو نفس المستخدم منشئ ومعتمِد
    const sodSupplierLegacyA = await asUser(userA.id, (tx) => tx.supplier.create({ data: { orgId: orgA.id, legalName: "SoD Supplier Legacy (no createdBy)" } }));
    const sodLegacyPaymentA = await asUser(userA.id, (tx) =>
      tx.payment.create({
        data: {
          orgId: orgA.id, paymentNumber: "PAY-RLS-SOD-SUP-2", direction: "Outbound", supplierId: sodSupplierLegacyA.id,
          bankAccountId: bankAccountA.id, amount: 500, currency: "USD", paymentDate: inPeriodDate, createdBy: userA.id,
        },
      })
    );
    let legacySupplierNullCreatedByOk = false;
    try {
      await asUser(userA.id, (tx) => tx.payment.update({ where: { id: sodLegacyPaymentA.id }, data: { approvedBy: userA.id } }));
      legacySupplierNullCreatedByOk = true;
    } catch {
      legacySupplierNullCreatedByOk = false;
    }
    record("مورّد قديم بـcreatedBy=NULL — قاعدة فصل المهام الموسَّعة مبتتفعّلش عليه (مفيش تلفيق منشئ)", legacySupplierNullCreatedByOk);

    await asUser(userA.id, (tx) => tx.segregationOfDutyRule.update({ where: { id: sodSupplierRuleA.id }, data: { isActive: false } }));

    // (ز) باقي كيانات الشريحة — تسجيل + عزل RLS
    const decisionA = await asUser(userA.id, (tx) =>
      tx.decisionLogEntry.create({ data: { orgId: orgA.id, title: "RLS decision", decisionDate: inPeriodDate, decidedBy: userA.id } })
    );
    const decisionsAsB = await asUser(userB.id, (tx) => tx.decisionLogEntry.findMany({ where: { id: decisionA.id } }));
    record("userB مايشوفش DecisionLogEntry بتاع orgA (عزل RLS)", decisionsAsB.length === 0);

    const riskA = await asUser(userA.id, (tx) =>
      tx.riskRegisterItem.create({ data: { orgId: orgA.id, title: "RLS risk", category: "تشغيلي", probability: 50, financialImpact: 1000, currency: "USD", ownerId: userA.id } })
    );
    const risksAsB = await asUser(userB.id, (tx) => tx.riskRegisterItem.findMany({ where: { id: riskA.id } }));
    record("userB مايشوفش RiskRegisterItem بتاع orgA (عزل RLS)", risksAsB.length === 0);

    const kpiA = await asUser(userA.id, (tx) =>
      tx.kPI.create({ data: { orgId: orgA.id, name: "RLS kpi", category: "مبيعات", ownerId: userA.id, targetValue: 100, periodId: openPeriodA.id } })
    );
    const kpisAsB = await asUser(userB.id, (tx) => tx.kPI.findMany({ where: { id: kpiA.id } }));
    record("userB مايشوفش KPI بتاع orgA (عزل RLS)", kpisAsB.length === 0);

    const notificationA = await asUser(userA.id, (tx) =>
      tx.notification.create({ data: { orgId: orgA.id, userId: userA.id, notificationType: "test", title: "RLS notification" } })
    );
    const notificationsAsB = await asUser(userB.id, (tx) => tx.notification.findMany({ where: { id: notificationA.id } }));
    record("userB مايشوفش Notification بتاع orgA (عزل RLS)", notificationsAsB.length === 0);

    const changeRequestA = await asUser(userA.id, (tx) =>
      tx.masterDataChangeRequest.create({ data: { orgId: orgA.id, entityType: "Supplier", entityId: supplierA.id, proposedChanges: { creditLimit: 5000 }, requestedBy: userA.id } })
    );
    const changeRequestsAsB = await asUser(userB.id, (tx) => tx.masterDataChangeRequest.findMany({ where: { id: changeRequestA.id } }));
    record("userB مايشوفش MasterDataChangeRequest بتاع orgA (عزل RLS)", changeRequestsAsB.length === 0);

    // 8 سبتمبر: AiAnalysisBatch/AiAnalysisBatchItem — تشغيل تحليل AI على كل تركيبة (منتج × سوق) دفعة واحدة.
    const aiBatchA = await asUser(userA.id, (tx) =>
      tx.aiAnalysisBatch.create({ data: { orgId: orgA.id, kind: "MarketAnalysis", year: 2026, totalPairs: 1, createdBy: userA.id } })
    );
    const aiBatchItemA = await asUser(userA.id, (tx) =>
      tx.aiAnalysisBatchItem.create({ data: { orgId: orgA.id, batchId: aiBatchA.id, productId: productA.id, marketId: marketA.id } })
    );
    const aiBatchesAsB = await asUser(userB.id, (tx) => tx.aiAnalysisBatch.findMany({ where: { id: aiBatchA.id } }));
    record("userB مايشوفش AiAnalysisBatch بتاع orgA (عزل RLS)", aiBatchesAsB.length === 0);
    const aiBatchItemsAsB = await asUser(userB.id, (tx) => tx.aiAnalysisBatchItem.findMany({ where: { id: aiBatchItemA.id } }));
    record("userB مايشوفش AiAnalysisBatchItem بتاع orgA (عزل RLS)", aiBatchItemsAsB.length === 0);

    // ---------- 37) تدفّق Verify/Close لـCAPA — تفعيل حالة حقيقية بدل create-only ----------

    // (أ) status=Overdue مباشرة — لازم يترفض (حالة محسوبة مش قيمة تُكتب)
    let capaOverdueRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.cAPA.create({ data: { orgId: orgA.id, ownerId: userA.id, status: "Overdue" } }));
    } catch (e) {
      capaOverdueRejected = e instanceof Error && e.message.includes("حالة محسوبة");
    }
    record("تسجيل CAPA بـstatus=Overdue مباشرة اتمنع فعليًا على مستوى القاعدة (Trigger)", capaOverdueRejected);

    // (ب) status=Closed بلا verifiedBy — لازم يترفض
    let capaClosedWithoutVerificationRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.cAPA.create({ data: { orgId: orgA.id, ownerId: userA.id, status: "Closed" } }));
    } catch (e) {
      capaClosedWithoutVerificationRejected = e instanceof Error && e.message.includes("بلا تسجيل مين تحقق منها");
    }
    record("تسجيل CAPA بـstatus=Closed بلا verifiedBy اتمنع فعليًا على مستوى القاعدة (Trigger)", capaClosedWithoutVerificationRejected);

    // (ج) انتقال صحيح: Open → VerificationPending → Effective (مع verifiedBy)
    // بيستخدم capaA الموجودة بالفعل من القسم 27 (حالتها Open افتراضيًا).
    await asUser(userA.id, (tx) => tx.cAPA.update({ where: { id: capaA.id }, data: { status: "VerificationPending" } }));
    await asUser(userA.id, (tx) => tx.cAPA.update({ where: { id: capaA.id }, data: { status: "Effective", verifiedBy: userA.id } }));
    const afterVerification = await asUser(userA.id, (tx) => tx.cAPA.findUniqueOrThrow({ where: { id: capaA.id } }));
    record("انتقال Open→VerificationPending→Effective مع verifiedBy نجح فعليًا", afterVerification.status === "Effective" && afterVerification.verifiedBy === userA.id);

    await asUser(userA.id, (tx) => tx.cAPA.update({ where: { id: capaA.id }, data: { status: "Closed" } }));
    const afterClose = await asUser(userA.id, (tx) => tx.cAPA.findUniqueOrThrow({ where: { id: capaA.id } }));
    record("إقفال CAPA بعد التحقق منه (verifiedBy موجود بالفعل من الانتقال اللي فات) نجح", afterClose.status === "Closed");

    // ---------- 38) Backfill: CommissionEntry.journalEntryId — FK حقيقي بعد إقفال وحدة 8 ----------

    // (أ) status=Paid بلا journalEntryId — لازم يترفض
    let commissionPaidWithoutJournalRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.commissionEntry.update({ where: { id: commissionEntryA.id }, data: { status: "Paid" } }));
    } catch (e) {
      commissionPaidWithoutJournalRejected = e instanceof Error && e.message.includes("بلا قيد محاسبي فعلي");
    }
    record("تعليم عمولة 'مدفوعة' بلا journalEntryId اتمنع فعليًا على مستوى القاعدة (Trigger)", commissionPaidWithoutJournalRejected);

    // (ب) status=Paid مع journalEntryId حقيقي (نفس القيد المرحّل balancedEntryA) — لازم ينجح
    let commissionPaidWithJournalOk = false;
    try {
      await asUser(userA.id, (tx) => tx.commissionEntry.update({ where: { id: commissionEntryA.id }, data: { status: "Paid", journalEntryId: balancedEntryA.id } }));
      commissionPaidWithJournalOk = true;
    } catch {
      commissionPaidWithJournalOk = false;
    }
    record("تعليم عمولة 'مدفوعة' مع journalEntryId حقيقي نجح فعليًا", commissionPaidWithJournalOk);

    // ---------- 39) تفعيل تدفّق انتقال مرحلة حقيقي لـOpportunity.stage — Trigger كان مؤجَّل عمدًا لغياب أي مسار تعديل ----------

    // فرصة جديدة منفصلة عن opportunityA (اللي عندها RFQAnalysis بالفعل من القسم الأول) —
    // عشان نتأكد من مسار الرفض قبل ما نضيف تحليل RFQ.
    const opportunityForStageTest = await prisma.opportunity.create({
      data: { orgId: orgA.id, companyId: companyA.id, productId: productA.id, marketId: marketA.id, stage: "NewLead" },
    });

    // (أ) UPDATE مباشر لـQuoteSent بلا RFQAnalysis — لازم يترفض
    let stageJumpWithoutRfqRejected = false;
    try {
      await asUser(userA.id, (tx) => tx.opportunity.update({ where: { id: opportunityForStageTest.id }, data: { stage: "QuoteSent" } }));
    } catch (e) {
      stageJumpWithoutRfqRejected = e instanceof Error && e.message.includes("تحليل RFQ");
    }
    record("قفز Opportunity.stage لـQuoteSent بلا RFQAnalysis اتمنع فعليًا على مستوى القاعدة (Trigger)", stageJumpWithoutRfqRejected);

    // (ب) INSERT مباشر بـstage=QuoteSent بلا RFQAnalysis — لازم يترفض برضه (مش UPDATE بس)
    let insertWithQuoteSentRejected = false;
    try {
      await asUser(userA.id, (tx) =>
        tx.opportunity.create({ data: { orgId: orgA.id, companyId: companyA.id, productId: productA.id, marketId: marketA.id, stage: "QuoteSent" } })
      );
    } catch (e) {
      insertWithQuoteSentRejected = e instanceof Error && e.message.includes("تحليل RFQ");
    }
    record("إنشاء Opportunity جديدة بـstage=QuoteSent مباشرة بلا RFQAnalysis اتمنع فعليًا (Trigger)", insertWithQuoteSentRejected);

    // (ج) بعد إضافة RFQAnalysis، نفس الانتقال لازم ينجح
    await asUser(userA.id, (tx) => tx.rFQAnalysis.create({ data: { orgId: orgA.id, opportunityId: opportunityForStageTest.id } }));
    await asUser(userA.id, (tx) => tx.opportunity.update({ where: { id: opportunityForStageTest.id }, data: { stage: "QuoteSent" } }));
    const opportunityAfterStageMove = await asUser(userA.id, (tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opportunityForStageTest.id } }));
    record("انتقال Opportunity.stage لـQuoteSent بعد إضافة RFQAnalysis نجح فعليًا", opportunityAfterStageMove.stage === "QuoteSent");

    // ---------- 40) وحدة 1 — ProductMarketAnalysis: منع تكرار نفس التركيبة (Trigger + فهرس فريد جزئي) ----------
    const pmaFirst = await asUser(userA.id, (tx) =>
      tx.productMarketAnalysis.create({
        data: { orgId: orgA.id, productId: productA.id, marketId: marketA.id, year: 2026, opportunityScore: 50, riskScore: 50, recommendation: "Study", source: "Manual" },
      })
    );
    record("ProductMarketAnalysis أول تحليل لتركيبة جديدة نجح، supersededAt=null", pmaFirst.supersededAt === null);

    const pmaSecond = await asUser(userA.id, (tx) =>
      tx.productMarketAnalysis.create({
        data: { orgId: orgA.id, productId: productA.id, marketId: marketA.id, year: 2026, opportunityScore: 70, riskScore: 30, recommendation: "Start", source: "AI" },
      })
    );
    const pmaFirstAfter = await asUser(userA.id, (tx) => tx.productMarketAnalysis.findUniqueOrThrow({ where: { id: pmaFirst.id } }));
    record("تحليل تاني لنفس التركيبة (منتج×سوق×سنة) عمل supersede تلقائي للقديم بدل ما يترفض (Trigger)", pmaFirstAfter.supersededAt !== null && pmaSecond.supersededAt === null);

    // تركيبة بسنة مختلفة — لازم تنجح عادي بلا أي تأثير على تركيبة 2026 (الفهرس بيشمل year).
    const pmaDifferentYear = await asUser(userA.id, (tx) =>
      tx.productMarketAnalysis.create({
        data: { orgId: orgA.id, productId: productA.id, marketId: marketA.id, year: 2027, opportunityScore: 40, riskScore: 40, recommendation: "Monitor", source: "Manual" },
      })
    );
    const pmaSecondAfter = await asUser(userA.id, (tx) => tx.productMarketAnalysis.findUniqueOrThrow({ where: { id: pmaSecond.id } }));
    record("تحليل بسنة مختلفة (2027) ما أثّرش على النسخة النشطة بتاعة 2026", pmaDifferentYear.supersededAt === null && pmaSecondAfter.supersededAt === null);

    const activePmaCountForTriple = await asUser(userA.id, (tx) =>
      tx.productMarketAnalysis.count({ where: { orgId: orgA.id, productId: productA.id, marketId: marketA.id, year: 2026, supersededAt: null } })
    );
    record("نسخة نشطة واحدة بس فعليًا لتركيبة 2026 بعد كل التحديثات (فهرس فريد جزئي)", activePmaCountForTriple === 1);
  } finally {
    // ---------- تنظيف (ترتيب معكوس بسبب FKs: BatchRawMaterialLine/BatchMarketEligibility/SupplierRFQ/Farm → Batch/Farm/Inventory/Supplier/SourcingRequest/Market؛
    // ProductionPlan/Inventory/NCR/LabTest → Batch/PurchaseOrder/Facility/Supplier؛
    // ShipmentLot → Shipment/Lot؛ QualityRelease/Lot → Batch → PurchaseOrder/Facility/Supplier؛
    // Inspection → Batch؛ PurchaseOrder/SupplierQuote → SourcingRequest → Deal؛ Facility → Supplier؛
    // ⚠️ تريجرز الـimmutability بتمنع حذف/تعديل القيود المرحّلة عمدًا (ده المطلوب فعليًا) — فتنظيف
    // بيانات الاختبار لازم يعطّلهم مؤقتًا. ده الاستثناء الوحيد المسموح، وفي سكريبت الاختبار بس.
    // الحوكمة قبل Payment/AccountingPeriod لأنها بتشاور عليهم.
    await prisma.masterDataChangeRequest.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.notification.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.kPI.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.riskRegisterItem.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.decisionLogEntry.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.segregationOfDutyRule.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });

    // CommissionEntry قبل القيود: journalEntryId هو ON DELETE SET NULL، لكن الـTrigger
    // enforce_commission_entry_paid بيرفض أي UPDATE بيسيب status=Paid مع journalEntryId=NULL —
    // وده بالظبط اللي بيحصل لو JournalEntry اتحذف وCommissionEntry لسه Paid بيشاور عليه.
    // حذف CommissionEntry الأول بيتجنّب المشكلة من الأساس (نفس فلسفة DepreciationEntry تحت).
    await prisma.commissionEntry.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });

    // الموازنات/الأصول/الضرائب قبل القيود لأن DepreciationEntry.journalEntryId إلزامي (ON DELETE RESTRICT).
    await prisma.taxRecord.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.budget.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.depreciationEntry.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.fixedAsset.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });

    // الخزينة قبل AR/AP لأن BankTransaction/LoanInstallment بيشاوروا على Payment.
    // ⚠️ المطابقة المقفولة بتمنع حذف حركاتها عمدًا — تعطيل مؤقت للتنظيف، في سكريبت الاختبار بس.
    await prisma.$executeRawUnsafe(`ALTER TABLE "BankTransaction" DISABLE TRIGGER USER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "BankReconciliation" DISABLE TRIGGER USER`);
    try {
      await prisma.bankTransaction.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
      await prisma.bankReconciliation.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "BankTransaction" ENABLE TRIGGER USER`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "BankReconciliation" ENABLE TRIGGER USER`);
    }
    await prisma.cashFlowForecastLine.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.loanInstallment.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.loan.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });

    // AR/AP قبل القيود لأن Invoice/Payment بيشاوروا على JournalEntry، وقبل Document لأن Invoice بيشاور عليه.
    await prisma.paymentAllocation.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.payment.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.invoice.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.bankAccount.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.$executeRawUnsafe(`ALTER TABLE "JournalLine" DISABLE TRIGGER USER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "JournalEntry" DISABLE TRIGGER USER`);
    try {
      await prisma.journalLine.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
      await prisma.journalEntry.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "JournalLine" ENABLE TRIGGER USER`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "JournalEntry" ENABLE TRIGGER USER`);
    }
    await prisma.accountingPeriod.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.chartOfAccount.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.costCenter.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.profitCenter.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.customerServiceCase.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.commissionEntry.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.commissionPlan.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.salesTarget.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.leadAssignmentRule.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.negotiationRound.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.negotiation.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.customerSample.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.rFQAnalysis.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.communication.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.redFlag.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.documentVersion.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.template.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.clause.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.documentPackage.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.document.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.cAPA.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.productSpecification.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.batchRawMaterialLine.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.batchMarketEligibility.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.supplierRFQ.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.farm.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.supplierAudit.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.supplyContract.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.packagingMaterial.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.supplierSample.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.cargoReadiness.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.supplierPerformance.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.labTest.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.nCR.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.inventory.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.productionPlan.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.shipmentLot.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.qualityRelease.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.lot.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.inspection.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.batch.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.purchaseOrder.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.approval.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.supplierQuote.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.sourcingRequest.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.facility.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.supplier.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    // FreightQuoteLine → FreightQuote → Route/ServiceProvider؛ TemperatureLog/TransportTrip/Claim/ShipmentEvent/LogisticsException/FreeTimeRecord/ActualLogisticsCost/Milestone/Container/Booking/ShipmentParty → Shipment → ComplianceCase؛ Gate/Requirement/RejectionCase → ComplianceCase؛ OriginProof/Registration/LCRequirement مستقلين؛ SalesOrder/RiskItem → Quote → DealScenario → Deal → Opportunity/Company/Market) ----------
    await prisma.freightQuoteLine.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.freightQuote.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.route.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.serviceProvider.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.temperatureLog.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.transportTrip.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.claim.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.shipmentEvent.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.logisticsException.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.freeTimeRecord.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.actualLogisticsCost.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.milestone.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.container.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.booking.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.shipmentParty.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.shipment.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.gate.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.rejectionCase.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.lCRequirement.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.originProof.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.registration.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.requirement.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.complianceCase.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.riskItem.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.salesOrder.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.quoteBundle.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.quote.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.dealScenario.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.exchangeRate.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.deal.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.opportunity.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.company.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.competitor.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.productMarketAnalysis.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.aiAnalysisBatchItem.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.aiAnalysisBatch.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.market.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.auditLog.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.product.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.role.deleteMany({ where: { id: { in: [roleA.id, roleB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} فحوصات ناجحة`);
  if (failed.length > 0) {
    console.error("❌ فيه فحوصات RLS فشلت — راجع فوق");
    process.exit(1);
  }
  console.log("✅ RLS شغّال فعليًا على مستوى القاعدة، مش شكليًا");
}

main()
  .catch((e) => {
    console.error("❌ فشل اختبار RLS:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
