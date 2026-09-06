# نطاق وحدة 7 — التوريد والإنتاج والجودة (ESPPQC): 4 شرايح (17 من 23)

**الحالة: 🟡 4 شرايح مبنية فعليًا على Supabase الحقيقي (31 أغسطس 2026) — 17 كيان من 23.**
- **الشريحة الأولى**: `Supplier`, `Facility`, `SourcingRequest`, `SupplierQuote`, `PurchaseOrder` — الحلقة الأساسية "مورّد → طلب توريد → عرض → أمر شراء".
- **الشريحة الثانية**: `Batch`, `Inspection`, `QualityRelease`, `Lot` — الإنتاج/الجودة الأساسية "أمر شراء → دفعة إنتاج → فحص → إفراج جودة → Lot جاهز".
- **الشريحة الثالثة**: `ProductionPlan`, `Inventory`, `NCR`, `LabTest` — تخطيط الإنتاج/المخزون/الجودة التكميلية.
- **الشريحة الرابعة**: `Farm`, `BatchRawMaterialLine`, `SupplierRFQ`, `BatchMarketEligibility` — تتبّع زراعي (أساس Mock Recall) + RFQ + أهلية أسواق.

**لماذا هذا الملف:** نفس منطق `SCOPE-P2.md`/`SCOPE-P5.md`/`SCOPE-P6.md` — وحدة 7 في `docs/ERD.md` §10 فيها 23 كيان، أكبر وحدة في المنظومة كلها. الملف ده بيوثّق القطع الفعلي اللي اتنفّذ، مش خطة مستقبلية.

**القاعدة العامة للقطع:** كل شريحة = أقل نموذج بيانات يخلي حلقة تشغيلية كاملة شغّالة حقيقي، بما فيها قيد عمل حرج على مستوى القاعدة لو موجود (الشرايح الثالثة/الرابعة بلا Trigger عمدًا — مفيش قيد عمل حرج صريح في الـERD على أي من كياناتهم).

**مؤجَّل بالكامل (6 كيان)**: `SupplierAudit`, `SupplyContract` (بقية شريحة التوريد)، `PackagingMaterial`, `SupplierSample`, `CargoReadiness`, `SupplierPerformance` (`overallScore` درجة موزونة بلا صيغة — نفس قرار باقي الـscores) — شرايح تالية.

---

## الشريحة الأولى — مورّد → طلب توريد → أمر شراء

## 1. الكيانات المبنية فعليًا (5 من 23)

`Supplier`, `Facility`, `SourcingRequest`, `SupplierQuote`, `PurchaseOrder` — كل الحقول زي ما هي موثّقة في `docs/ERD.md` §10، ما عدا الاستثناءات تحت.

- **`Supplier`**: `legalName`, `tradeName`, `country`, `governorate`, `city`, `taxId`, `commercialRegNo`, `supplierType` (`String[]`، مش enum مغلق — نفس نمط `Company.classification`)، `status` enum (13 قيمة)، `bankVerifiedAt`.
- **`Facility`**: `supplierId` → `Supplier`، `facilityType` enum (11 قيمة)، `name`, `address`, `capacityDaily`, `productionLines`, `shifts`, `hasTraceabilitySystem`, `lastAuditAt`, `status`.
- **`SourcingRequest`**: `dealId` → `Deal`، `productId`/`marketId` بيتشتقوا من الصفقة (مش إدخال مستخدم، نفس نمط `ComplianceCase`/`Shipment`)، `rawQuantityRequired`, `saleableQuantityRequired`, `maximumPurchasePrice` ⚠️، `targetPurchasePrice`, `currency`, `requiredCargoReadyDate`, `status` enum (11 قيمة).
- **`SupplierQuote`**: `sourcingRequestId` → `SourcingRequest`، `supplierId` → `Supplier`، `unitPrice`, `priceUnit`, `currency`, `fxRateId` → `ExchangeRate`، `packagingIncluded`, `transportIncluded`, `paymentTerms`, `leadTimeDays`, `availableQuantity`, `minimumOrder`, `expectedYield`, `totalEffectiveCost`, `validUntil`.
- **`PurchaseOrder`**: `sourcingRequestId` → `SourcingRequest`، `supplierId` → `Supplier`، `facilityId` → `Facility` (اختياري)، `poNumber` (فريد، `PO-{year}-{seq}` بنفس نمط `SO-{year}-{seq}`)، `version`, `quantity`, `unitPrice`, `currency`, `fxRateId`, `deliverySchedule` (`Json?`)، `paymentTerms`, `penalties`, `status` enum (13 قيمة)، `approvalId` → `Approval`.

## 2. تبسيطات هندسية موثّقة (قرار واعي، مش تسيّب)

1. **`Supplier.qualificationScore`/`riskScore` اتشالوا خالص** — نفس قرار كل الـscores الموزونة في المشروع ("لا تُعطِ درجة موزونة بلا تبرير"). بترجعوا لما `ScoreSnapshot` (بند مؤجَّل مشترك) يتبني.
2. **`Facility.status` قرار تفسيري** — الـERD مش بيحدد قيم صراحةً (نفس روح `TransportTripStatus`/`OriginProofStatus`): `Active, UnderReview, Suspended, Closed`.
3. **`Supplier.bankAccountName`/`bankIBAN` 🔒 مشفّرين بلا واجهة إدخال** — عمودين `Bytes?`، نفس نمط `Company.bankAccountName`/`bankIBAN`/`bankSWIFT` و`TransportTrip.driverPhone` بالظبط (آلية التشفير الفعلية pgcrypto/Supabase Vault قرار منفصل قبل أي إدخال حقيقي).
4. **`SourcingRequest.specificationId`/`PurchaseOrder.specificationId` اتشالوا** — `ProductSpecification` (وحدة 4) لسه مش موجودة.
5. **`SupplierQuote.effectiveCostPerSaleableKg` (⚙️) بيتحسب وقت العرض** في `src/app/sourcing/[id]/page.tsx` (`totalEffectiveCost / (availableQuantity * expectedYield)`) — مش عمود مخزَّن، نفس نمط `Container.weightUtilization`/`FreeTimeRecord.chargeDays`.
6. **`SupplierQuote.selectionScore` اتشال** — نفس سبب باقي الـscores.
7. **`SourcingRequest.dealId` مش `scenarioId`** — عكس `ComplianceCase` اللي مربوط بسيناريو مُحدَّد، طلب التوريد مربوط بالصفقة كلها (الـERD مش بيربطه بسيناريو بعينه)، فبيظهر في صفحة أي سيناريو تابع لنفس الصفقة.

## 3. الإنفاذ الإلزامي المُنفَّذ فعليًا (أول Trigger لوحدة 7، غير قابل للتفاوض من CLAUDE.md)

**`enforce_purchase_order_max_price`** (`BEFORE INSERT OR UPDATE ON "PurchaseOrder"`)، في `prisma/migrations/20260830300500_module7_rls/migration.sql` — نفس نمط `enforce_quote_walk_away_price` بالظبط، بس بمقارنة عكسية:

- لو `NEW.unitPrice > SourcingRequest.maximumPurchasePrice`، لازم يكون فيه `Approval` معتمد فعليًا (`subjectType = 'PurchaseOrder.unitPrice_override'`, `subjectId = NEW.id`, `decision = 'Approved'`) — غير كده `RAISE EXCEPTION ... USING ERRCODE = '23514'`.

**تدفّق الموافقة الاستثنائية** (`src/app/sourcing/actions.ts` — `createPurchaseOrder`): نفس نمط `createQuote`/`approveRequest` بالظبط —
1. لو `unitPrice > maximumPurchasePrice`، بيتحجز `subjectId` مسبقًا (`SELECT uuidv7()`) وبيتعمل `Approval` بـ`payload` فيه كل بيانات الـPurchaseOrder المطلوب إنشاؤه، وبيرجّع المستخدم لصفحة طلب التوريد.
2. الـ`PurchaseOrder` الفعلي بيتعمل بس بعد الاعتماد، في `approveRequest` (`src/app/approvals/actions.ts`، فرع جديد `PurchaseOrder.unitPrice_override`)، بنفس الـid المحجوز — فالـTrigger بيلاقي `Approval` معتمد بنفس `subjectId` وقت الـINSERT الفعلي.
3. `src/app/approvals/page.tsx` بيعرض تفاصيل طلبات الـPO override (سعر مطلوب/حد أقصى مسموح) — نفس نمط عرض `QuoteOverridePayload`/`GateWaiverPayload`.
4. اعتماد الطلب محتاج **MFA (aal2)** — نفس قيد `Quote`/`Gate.waiver`، مفروض عبر `requireAal2` في `approveRequest` بلا كود إضافي خاص بـ`PurchaseOrder` (الفحص عام لكل أنواع الموافقات).

## 4. معيار "الشريحة الأولى مكتملة" (Acceptance)

1. إنشاء `Supplier` من `/suppliers` — `supplierType` عبر checkbox-grid (13 قيمة).
2. إنشاء `Facility` تابعة له من `/suppliers/[id]`.
3. فتح `SourcingRequest` من صفحة سيناريو صفقة معتمدة (`productId`/`marketId` بيتشتقوا من الصفقة) بـ`maximumPurchasePrice` محدَّد.
4. إضافة `SupplierQuote` بسعر تحت السقف — ينجح عادي، `effectiveCostPerSaleableKg` بيتحسب صح في العرض.
5. محاولة إنشاء `PurchaseOrder` بسعر **فوق** `maximumPurchasePrice` — **يُرفض فعليًا على مستوى القاعدة**، وبيتحوّل تلقائيًا لطلب موافقة استثنائية معلَّق في `/approvals`.
6. محاولة اعتماد الطلب من `/approvals` بلا MFA مفعّل — **يُمنع** برسالة واضحة ورابط تفعيل.
7. بعد تفعيل MFA، اعتماد الطلب ينجح — `PurchaseOrder` الفعلي بيتعمل بنفس الـid المحجوز، برقم `PO-{year}-{seq}` مُولَّد، و`SourcingRequest.status` بيتحدّث لـ`POIssued`.

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (31 أغسطس 2026): إنشاء "مورد الاختبار الحي" (مصر) → إضافة "منشأة الاختبار" (مزرعة) → فتح طلب توريد من سيناريو "Current (v1)" لصفقة "Muster Import GmbH" (`maximumPurchasePrice=100 USD`) → إضافة عرض مورّد بسعر 90 USD (نجح عادي) → محاولة أمر شراء بسعر 150 USD **رُفضت فعليًا على مستوى القاعدة** وتحوّلت لطلب موافقة معلّق في `/approvals` → محاولة الاعتماد بلا MFA **اتمنعت** فعليًا مع رسالة ورابط `/mfa/challenge` → تفعيل MFA (TOTP) على حساب "مدير النظام" → الاعتماد نجح → `PurchaseOrder` (`PO-2026-0001`) اتعمل فعليًا بسعر 150 USD (فوق السقف) بنفس الـid المحجوز، و`SourcingRequest.status` اتحدّث لـ"تم إصدار أمر الشراء". بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(46/46)/`next build` (بـ`NODE_OPTIONS=8192`) نضاف.

**🐛 باگ اكتُشف وانصلح أثناء التحقق الحي**: صفحة `/account/mfa` (`src/app/account/mfa/EnrollmentFlow.tsx`) كانت بتحقن `qr_code` الراجع من Supabase (data URI زي `data:image/svg+xml;utf-8,<svg>...` مُعَدّ للاستخدام كـ`<img src>`) عبر `dangerouslySetInnerHTML` بدل `<img>` عادي — النتيجة: نص الـdata URI الخام كان بيظهر كـtext قبل الصورة، والصورة نفسها كانت من غير أبعاد مضبوطة. الإصلاح: استبدال الـ`div`/`dangerouslySetInnerHTML` بعنصر `<img src={enrollment.qrCode}>` مباشر — نفس الطريقة القياسية لعرض QR codes من Supabase MFA enrollment.

## 5. ملفات جديدة

- `src/lib/procurementLabels.ts` — تسميات عربية موحّدة لكل enum جديد (`Supplier`/`Facility`/`SourcingRequest`/`PurchaseOrder`).
- `src/app/suppliers/actions.ts`+`SupplierForm.tsx`+`page.tsx` — `/suppliers` (قائمة + إنشاء).
- `src/app/suppliers/[id]/page.tsx`+`FacilityForm.tsx` — تفاصيل المورد + قسم `Facility` متداخل.
- `src/app/sourcing/actions.ts` — `createSourcingRequest`, `createSupplierQuote`, `createPurchaseOrder` (منطق تحقّق السقف وحجز الموافقة).
- `src/app/sourcing/page.tsx` — قائمة `SourcingRequest` + فلترة بالحالة.
- `src/app/sourcing/[id]/page.tsx`+`SupplierQuoteForm.tsx`+`PurchaseOrderForm.tsx` — تفاصيل طلب التوريد.
- `src/app/deals/[id]/scenarios/[scenarioId]/OpenSourcingRequestForm.tsx` — زرار "فتح طلب توريد" في صفحة سيناريو الصفقة (نفس نمط `OpenComplianceCaseForm` بالظبط)، وتعديل `page.tsx` لعرض قسم "التوريد" (يعرض الفورم لو مفيش طلبات، أو روابط للطلبات الموجودة).
- تعديلات على `src/app/approvals/actions.ts`/`page.tsx` — فرع `PurchaseOrder.unitPrice_override` الكامل (إنشاء، اعتماد، عرض).
- تعديل `src/components/Nav.tsx` — رابط "الموردين" جديد (`/suppliers`) في قائمة الروابط العامة، نفس نمط "اللوجستيات".
- صلاحيات جديدة (`Supplier.Create/View`, `Facility.Create`, `SourcingRequest.Create/View`, `SupplierQuote.Create`, `PurchaseOrder.Create`) في `prisma/seed.ts` — أول استخدام فعلي لدور `ProcurementOfficer` (كان موجود بلا صلاحيات، نفس نمط `LogisticsOfficer`).
- إصلاح `src/app/account/mfa/EnrollmentFlow.tsx` — راجع §4 "باگ اكتُشف وانصلح" فوق.

---

## الشريحة الثانية — الإنتاج/الجودة الأساسية (أمر شراء → دفعة إنتاج → فحص → إفراج جودة → Lot)

## 6. الكيانات المبنية فعليًا (4 من 18 المتبقيين وقتها)

`Batch`, `Inspection`, `QualityRelease`, `Lot` — كل الحقول زي ما هي موثّقة في `docs/ERD.md` §10، ما عدا الاستثناءات تحت.

- **`Batch`**: `purchaseOrderId` → `PurchaseOrder`، `facilityId` → `Facility`، `supplierId` → `Supplier` (بيتشتق من الـPurchaseOrder، مش إدخال مستخدم)، `batchCode` (فريد)، `productionDate`, `expiryDate`, `quantityInput`, `quantityOutput`, `qualityStatus` enum(Pending/Released/Held/Rejected — من الـERD حرفيًا)، `status` enum قرار تفسيري (`Planned, InProduction, Completed, OnHold, Cancelled`، نفس روح `TransportTripStatus`).
- **`Inspection`**: `stage` enum (8 قيم من الـERD)، `batchId` → `Batch`، `facilityId` → `Facility` (بيتشتق من الدفعة)، `inspectorId` → `User` (المستخدم الحالي)، `inspectionDate`, `samplingMethod`, `sampleSize`, `result` enum(Pass/ConditionalPass/Fail).
- **`QualityRelease`**: `batchId` → `Batch`، `lotId` → `Lot` (nullable)، `inspectionResults` (`Json?`)، `releasedQuantity`, `rejectedQuantity`, `releaseDate`, `releasedBy` → `User`، `status` enum(Released/PartialRelease/ConditionalRelease/Held/Rejected — من الـERD حرفيًا).
- **`Lot`**: `batchId` → `Batch`، `lotCode` (فريد)، `packingDate`, `packagingVersion`, `labelVersion`, `quantity`, `cartons`, `pallets`, `netWeight`, `grossWeight`, `qualityStatus` enum (نفس `Batch`)، `status` enum قرار تفسيري (`Draft, Ready, Allocated, Shipped, Consumed, Cancelled`).

## 7. تبسيطات هندسية موثّقة

1. **`BatchRawMaterialLine` مؤجَّل** — المصدر الفعلي للخام، محتاج `Farm`/`Inventory` غير مبنيين لسه.
2. **`Batch.yieldRate`/`wasteQuantity` (⚙️) بيتحسبوا وقت العرض** (`quantityOutput/quantityInput`, `quantityInput-quantityOutput`) في `src/app/purchase-orders/[id]/page.tsx` و`src/app/batches/[id]/page.tsx` — مش أعمدة مخزَّنة، نفس نمط `Container.weightUtilization`.
3. **`Inspection.evidenceIds` اتشال** — مفيش نظام مرفقات/تخزين فعلي (وحدة 4 لسه مش مبنية)، نفس سبب تأجيل حقول مرفقات مشابهة في `Gate`.
4. **`QualityRelease.specificationId` اتشال** (نفس سبب `SourcingRequest`/`PurchaseOrder` — وحدة 4 مش مبنية). **`QualityRelease.deviationApprovalId` اتشال** — مفيش تدفّق "طلب تجاوز جودة" فعلي مبني لسه (عكس `PurchaseOrder.unitPrice_override` اللي ليه تدفّق كامل)؛ هيتضاف لما نبني تدفّق الموافقة الاستثنائية بتاعه.
5. **`Lot` هو الكيان اللي `ShipmentLot` (وحدة 6) كان محتاجه** — بمجرد ما اتبنى هنا، `ShipmentLot` اتبنى فعليًا في وحدة 6 (نفس اليوم، 31 أغسطس)، وقفلت وحدة 6 بالكامل لـ17/17. راجع `docs/SCOPE-P6.md` §8.

## 8. الإنفاذ الإلزامي المُنفَّذ فعليًا (أول Trigger لسلسلة الإنتاج/الجودة)

**`enforce_lot_quality_release`** (`BEFORE INSERT OR UPDATE ON "Lot"`)، في `prisma/migrations/20260831310500_module7_slice2_rls/migration.sql` — بيترجم المخطط في `docs/ERD.md` §10 (`QualityRelease ==>|يفرج عن| Lot`) لقيد قاعدة بيانات حقيقي:

- لو `NEW.qualityStatus = 'Released'`، لازم يكون فيه `QualityRelease` بـ`(lotId = NEW.id OR (lotId IS NULL AND batchId = NEW."batchId"))` وحالته `IN ('Released', 'PartialRelease', 'ConditionalRelease')` — غير كده `RAISE EXCEPTION ... USING ERRCODE = '23514'`.
- نفس فلسفة `enforce_gate_origin_proof_verified` (فحص وجود صف مرتبط بحالة معيّنة)، بس هنا الفحص إيجابي (لازم يوجد) مش سلبي.
- **بلا تدفّق موافقة استثنائية** (عكس `PurchaseOrder`/`Quote`) — القيد هنا "لازم يوجد صف مرتبط"، مش "قيمة رقمية تتجاوز حد"، فمفيش حاجة لـ`Approval`/MFA؛ المستخدم لازم يعمل `QualityRelease` قبل ما يقدر يعلّم الـLot كـ`Released`. رسالة خطأ عربي نضيفة في `createLot` (`src/app/batches/actions.ts`) — نفس نمط `decideGate`/`createPurchaseOrder` (فحص substring من رسالة الـTrigger، مش `e.message` خام).

## 9. معيار "الشريحة الثانية مكتملة" (Acceptance)

1. فتح `/purchase-orders/[id]` (صفحة تفاصيل جديدة لـ`PurchaseOrder`، كان لسه بس صف في جدول) → إضافة `Batch` (`supplierId` بيتشتق من الأمر).
2. فتح `/batches/[id]` → `yieldRate`/`wasteQuantity` بيتحسبوا صح.
3. تسجيل `Inspection` (نتيجة Pass).
4. محاولة إنشاء `Lot` بـ`qualityStatus=Released` بلا `QualityRelease` — **يُرفض فعليًا على مستوى القاعدة** برسالة عربي نضيفة.
5. تسجيل `QualityRelease` (status=Released) لنفس الدفعة.
6. إعادة محاولة إنشاء `Lot` بـ`qualityStatus=Released` — **تنجح**.

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (31 أغسطس 2026): إنشاء "مورد الإنتاج الحي" (مصر) → "منشأة الإنتاج" → فتح طلب توريد من سيناريو "Current (v1)" لصفقة "Muster Import GmbH" (`maximumPurchasePrice=200 USD`) → عرض مورّد 150 USD → أمر شراء `PO-2026-0001` بسعر 150 USD (تحت السقف، بلا موافقة استثنائية) → فتح `/purchase-orders/[id]` → إضافة `Batch` (`quantityInput=500`, `quantityOutput=450`) → **`yieldRate` ظهر 90.0% و`wasteQuantity` ظهر 50.000 صح** → فتح `/batches/[id]` → تسجيل `Inspection` (مرحلة "تأهيل مبدئي"، نتيجة "ناجح") → محاولة `Lot` بحالة "مُفرَج عنها" **رُفضت فعليًا على مستوى القاعدة** برسالة "مينفعش تسجّل الدفعة (Lot) كـ'مُفرَج عنها جودة'..." → تسجيل `QualityRelease` (status=Released) → إعادة محاولة `Lot` **نجحت فعليًا** (`LOT-001` ظهر بحالة "مُفرَج عنها"). بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(52/52)/`next build` (بـ`NODE_OPTIONS=8192`) نضاف.

⚠️ **ملاحظة تشغيلية أثناء التحقق (مش باگ)**: ظهرت أخطاء `P2028` عابرة ("Unable to start a transaction in the given time") مرتين أثناء التنقل بين الصفحات — تزاحم اتصالات مؤقت على الـpool، مش خطأ منطقي في الكود (البيانات نفسها اتسجّلت صح في القاعدة رغم ظهور صفحة الخطأ، اتأكد بإعادة التحميل). نفس السلوك المعروف من `BACKLOG.md` (P2028: كل `getScopedPrisma()` query بيفتح transaction لوحده).

## 10. ملفات جديدة (الشريحة الثانية)

- إضافات في `src/lib/procurementLabels.ts`: تسميات `BatchQualityStatus`/`BatchStatus`/`InspectionStage`/`InspectionResult`/`QualityReleaseStatus`/`LotStatus`.
- `src/app/purchase-orders/actions.ts`+`[id]/page.tsx`+`[id]/BatchForm.tsx` — أول صفحة تفاصيل مستقلة لـ`PurchaseOrder` (`createBatch`).
- `src/app/batches/actions.ts`+`[id]/page.tsx`+`[id]/InspectionForm.tsx`+`[id]/QualityReleaseForm.tsx`+`[id]/LotForm.tsx` — تفاصيل الدفعة بـ3 أقسام متداخلة فلات (`createInspection`, `createQualityRelease`, `createLot`).
- تعديل `src/app/sourcing/[id]/page.tsx` — صف جدول `PurchaseOrder` بقى `Link` لـ`/purchase-orders/[id]`.
- **بلا تعديل على `Nav.tsx`** — `/purchase-orders`/`/batches` بيتوصلهم من `/sourcing`، نفس مبدأ عدم إضافة روابط لكيانات متداخلة.
- صلاحيات جديدة (`PurchaseOrder.View`, `Batch.Create/View` لـ`ProcurementOfficer`) في `prisma/seed.ts` — **أول استخدام فعلي لدور `QualityManager`** (`Batch.View`, `Inspection.Create`, `QualityRelease.Create`, `Lot.Create/View`) — آخر دور متبقي بلا استخدام في `SYSTEM_ROLES`.

---

## الشريحة الثالثة — تخطيط الإنتاج/المخزون/الجودة التكميلية

## 11. الكيانات المبنية فعليًا (4 من 10 المتبقيين وقتها)

`ProductionPlan`, `Inventory`, `NCR`, `LabTest` — كل الحقول زي ما هي موثّقة في `docs/ERD.md` §10، ما عدا الاستثناءات تحت.

- **`ProductionPlan`**: `purchaseOrderId` → `PurchaseOrder`، `facilityId` → `Facility`، `process` enum (15 قيمة: Sorting...Palletizing)، `rawQuantity`, `targetYield`, `startDate`, `endDate`, `packagingDate`, `cargoReadyDate`, `status` enum (10 قيمة من الـERD حرفيًا). لا شيء اتشال.
- **`Inventory`**: `productId` → `Product`، `batchId`/`lotId` → `Batch`/`Lot` (اختياريين)، `inventoryType` enum(RawMaterial/WIP/FinishedGoods/PackagingMaterial)، `quantity`, `unit`, `location`, `status` enum (10 قيمة)، `reservedForDealId` → `Deal` (اختياري)، `expiryDate`, `unitCost`, `currency`. لا شيء اتشال.
- **`NCR`**: `supplierId` → `Supplier`، `facilityId` → `Facility`، `batchId`/`lotId` (اختياريين)، `ncrType` enum (16 قيمة)، `severity` enum(Observation/Minor/Major/Critical)، `quantityAffected`, `financialExposure`, `currency`, `immediateContainment`, `status` enum(Open/Investigation/ActionInProgress/Closed).
- **`LabTest`**: `inspectionId` → `Inspection` (اختياري)، `batchId` → `Batch`، `testType` enum (11 قيمة)، `parameter`, `unit`, `minLimit`, `maxLimit`, `actualResult`, `method`, `laboratory`, `isAccredited`, `testDate`, `resultDate`, `passFail` enum(Pass/Fail)، `certificateNumber`, `verifiedBy` → `User`.

## 12. تبسيطات هندسية موثّقة

1. **`NCR.capaId` اتشال** — `CAPA` تابع وحدة 3 غير مبني، نفس سبب تأجيل `specificationId` (وحدة 4 غير مبنية).
2. **`LabTest.supplierSampleId` اتشال** — `SupplierSample` (كيان تاني في وحدة 7) لسه مش مبني، هيتضاف لو `SupplierSample` اتبنى لاحقًا.
3. **`NCR.batchId`/`lotId` بلا واجهة إدخال هذه الشريحة** — الحقلين موجودين في الـschema (nullable) بس مش معروضين في الفورم، لأن `supplierId`/`facilityId` هما الربط الأساسي (نفس منطق `RejectionCase` على `ComplianceCase`)، هيتضافوا لو ظهر احتياج فعلي لربط مخالفة بدفعة/Lot بعينه من الواجهة.
4. **بلا Trigger جديد** — الـERD مش بيحدد قيد عمل حرج صريح (⚠️) على أي من الأربعة، نفس فلسفة `RejectionCase`/`ShipmentEvent`/`ShipmentLot` — RLS org-isolation بس، Migration واحد (foundation+RLS معًا، بلا حاجة لفصل Trigger).

## 13. معيار "الشريحة الثالثة مكتملة" (Acceptance)

1. فتح `/purchase-orders/[id]` → إضافة `ProductionPlan` — يظهر في قسم "خطط الإنتاج" الجديد.
2. فتح `/batches/[id]` → إضافة `LabTest` — يظهر في قسم "الفحوصات المعملية" الجديد (بين "الفحوصات" و"الإفراج عن الجودة").
3. فتح `/suppliers/[id]` → إضافة `NCR` — يظهر في قسم "مخالفات عدم المطابقة (NCR)" الجديد (الفورم بيظهر بس لو فيه منشآت مسجَّلة).
4. فتح `/inventory` (صفحة مستقلة جديدة) → إضافة سجل مخزون مرتبط بمنتج (+دفعة/Lot اختياريين) — يظهر في القائمة.

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (31 أغسطس 2026): إنشاء "مورد الإنتاج الثالث" + منشأته → تسجيل `NCR` ("عيب في الخام"، خطورة "ملاحظة") في `/suppliers/[id]` **ظهر صح** → فتح طلب توريد جديد (`maximumPurchasePrice=200`) → عرض مورّد 150 USD → أمر شراء `PO-2026-0001` (تحت السقف) → فتح `/purchase-orders/[id]` → إضافة `ProductionPlan` (معالجة "فرز") **ظهرت صح** في قسم "خطط الإنتاج" → إضافة `Batch` → فتح `/batches/[id]` → تسجيل `LabTest` (نوع "فيزيائي"، نتيجة "ناجح") **ظهر صح** في قسم "الفحوصات المعملية" → فتح `/inventory` → إضافة سجل مخزون (منتج "فراولة مجمدة"، نوع "خام"، كمية 500) **ظهر صح** في القائمة. رابط "المخزون" جديد في الـNav اتأكد ظهوره. بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(57/57)/`next build` (بـ`NODE_OPTIONS=8192`) نضاف.

## 14. ملفات جديدة (الشريحة الثالثة)

- إضافات في `src/lib/procurementLabels.ts`: تسميات `ProductionProcess`/`ProductionPlanStatus`/`InventoryType`/`InventoryStatus`/`NCRType`/`NCRSeverity`/`NCRStatus`/`LabTestType`/`LabTestPassFail`.
- إضافة `createProductionPlan` في `src/app/purchase-orders/actions.ts` + `src/app/purchase-orders/[id]/ProductionPlanForm.tsx` — قسم "خطط الإنتاج" في `src/app/purchase-orders/[id]/page.tsx`.
- إضافة `createLabTest` في `src/app/batches/actions.ts` + `src/app/batches/[id]/LabTestForm.tsx` — قسم "الفحوصات المعملية" في `src/app/batches/[id]/page.tsx`.
- إضافة `createNCR` في `src/app/suppliers/actions.ts` + `src/app/suppliers/[id]/NCRForm.tsx` — قسم "مخالفات عدم المطابقة (NCR)" في `src/app/suppliers/[id]/page.tsx`.
- `src/app/inventory/actions.ts`+`InventoryForm.tsx`+`page.tsx` (جديدة بالكامل) — صفحة مستقلة `/inventory` (قائمة + إنشاء).
- تعديل `src/components/Nav.tsx` — رابط "المخزون" جديد (`/inventory`).
- صلاحيات جديدة (`ProductionPlan.Create/View`, `Inventory.Create/View` لـ`ProcurementOfficer`؛ `LabTest.Create`, `NCR.Create` لـ`QualityManager`) في `prisma/seed.ts`.

---

## الشريحة الرابعة — تتبّع زراعي + RFQ + أهلية أسواق

## 15. الكيانات المبنية فعليًا (4 من 10 المتبقيين وقتها)

`Farm`, `BatchRawMaterialLine`, `SupplierRFQ`, `BatchMarketEligibility` — كل الحقول زي ما هي موثّقة في `docs/ERD.md` §10، ما عدا الاستثناءات تحت.

- **`Farm`**: `supplierId` → `Supplier`، `farmerName`, `location`, `areaFeddan`, `crop`, `variety`, `plantingDate`, `expectedHarvestStart`, `expectedHarvestEnd`, `actualHarvestDate`, `expectedQuantity`, `actualQuantity`, `pesticideProgram` (`Json?`)، `plotCodes` (`String[]`)، `riskLevel` enum قرار تفسيري (`Low, Medium, High`).
- **`BatchRawMaterialLine`**: `batchId` → `Batch`، `sourceType` enum(Farm/IncomingInventory)، `farmId`/`inventoryId` (nullable، حسب النوع)، `quantity`.
- **`SupplierRFQ`**: `sourcingRequestId` → `SourcingRequest`، `supplierId` → `Supplier`، `rfqNumber`, `sentAt`, `responseDeadline`, `respondedAt`, `status` enum قرار تفسيري (`Draft, Sent, Responded, Expired, Cancelled`).
- **`BatchMarketEligibility`**: `batchId` → `Batch`، `marketId` → `Market`، `status` enum(Eligible/Conditional/NotEligible/NotAssessed)، `reason`, `assessedAt`, `assessedBy` → `User` (المستخدم الحالي تلقائيًا).

## 16. تبسيطات هندسية موثّقة

1. **`BatchRawMaterialLine` تحقق تطبيقي بدل قيد DB** — Zod refine بيتأكد إن `sourceType=Farm` يستلزم `farmId`، و`sourceType=IncomingInventory` يستلزم `inventoryId`. مش قيد عمل حرج بالمعنى المُلزم (الـERD مش بيحدده كـ⚠️)، فاتحقق تطبيقيًا بس مش Trigger.
2. **بلا Trigger جديد** — نفس فلسفة الشريحة التالتة، مفيش قيد عمل حرج صريح على أي من الأربعة.
3. **`Farm.riskLevel` قرار تفسيري** — الـERD مش بيحدد قيم صراحةً، نفس روح `TransportTripStatus`/`FacilityStatus`.

## 17. معيار "الشريحة الرابعة مكتملة" (Acceptance)

1. فتح `/suppliers/[id]` → إضافة `Farm` — يظهر في قسم "المزارع" الجديد.
2. فتح `/sourcing/[id]` → إضافة `SupplierRFQ` — يظهر في قسم "طلبات عروض الأسعار (RFQ)" الجديد، **قبل** قسم "عروض الموردين".
3. فتح `/batches/[id]` → إضافة `BatchRawMaterialLine` (نوع Farm) — يظهر في قسم "مصدر الخام" الجديد (أول قسم في الصفحة، قبل "الفحوصات").
4. فتح `/batches/[id]` → إضافة `BatchMarketEligibility` — يظهر في قسم "الأهلية للأسواق" الجديد (آخر قسم في الصفحة).

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (31 أغسطس 2026): إنشاء "مورد المزرعة الرابعة" → إضافة "مزارع أحمد" (محصول فراولة) ظهر صح في `/suppliers/[id]` → فتح طلب توريد جديد (`maximumPurchasePrice=200`) → إضافة `SupplierRFQ` ظهر صح **قبل** قسم عروض الموردين → عرض مورّد 150 USD → إضافة منشأة للمورد → أمر شراء `PO-2026-0001` (تحت السقف) → فتح `/purchase-orders/[id]` → إضافة `Batch` → فتح `/batches/[id]` → إضافة `BatchRawMaterialLine` (نوع مزرعة، مربوط بـ"مزارع أحمد") ظهر صح في أول قسم بالصفحة → إضافة `BatchMarketEligibility` (سوق ألمانيا، حالة "مؤهّلة") ظهر صح في آخر قسم بالصفحة. بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(61/61)/`next build` (بـ`NODE_OPTIONS=8192`) نضاف.

## 18. ملفات جديدة (الشريحة الرابعة)

- إضافات في `src/lib/procurementLabels.ts`: تسميات `FarmRiskLevel`/`BatchRawMaterialSourceType`/`SupplierRFQStatus`/`BatchMarketEligibilityStatus`.
- إضافة `createFarm` في `src/app/suppliers/actions.ts` + `src/app/suppliers/[id]/FarmForm.tsx` — قسم "المزارع" في `src/app/suppliers/[id]/page.tsx`.
- إضافة `createSupplierRFQ` في `src/app/sourcing/actions.ts` + `src/app/sourcing/[id]/SupplierRFQForm.tsx` — قسم "طلبات عروض الأسعار (RFQ)" في `src/app/sourcing/[id]/page.tsx` (**قبل** قسم `SupplierQuote`).
- إضافة `createBatchRawMaterialLine`+`createBatchMarketEligibility` في `src/app/batches/actions.ts` + `src/app/batches/[id]/BatchRawMaterialLineForm.tsx`+`BatchMarketEligibilityForm.tsx` — قسمين جديدين في `src/app/batches/[id]/page.tsx`.
- **بلا صفحات/روابط Nav جديدة** — الأربعة كلهم أقسام متداخلة في صفحات موجودة بالفعل.
- صلاحيات جديدة (`Farm.Create/View`, `SupplierRFQ.Create` لـ`ProcurementOfficer`؛ `BatchRawMaterialLine.Create`, `BatchMarketEligibility.Create` لـ`QualityManager`) في `prisma/seed.ts`.

---

## مراجعة شاملة بعد الشريحة الرابعة — عيوب حقيقية اتلقطت واتحلّت (31 أغسطس 2026)

طلب المستخدم مراجعة كل اللي اتبنى في وحدة 7 (الشرايح الأربعة) للقعيوب الحقيقية بدون اختراع busywork، وحلّها. مفيش تعديل Schema في المراجعة دي — كل الإصلاحات كود تطبيقي بس.

## 19. العيوب اللي اتلقطت واتحلّت

1. **`Batch.qualityStatus` مكنش بيتحدّث بعد إفراج جودة فعلي** (باگ حقيقي، مُشاهَد ومُتكرر): إنشاء `QualityRelease` بحالة `Released` مكنش بيغيّر `Batch.qualityStatus` من `Pending`، فصفحة الدفعة كانت بتفضل عارضة "قيد الانتظار" للأبد. **الحل**: `createQualityRelease` في `src/app/batches/actions.ts` بقى بيحدّث `Batch.qualityStatus` جوه نفس الـtransaction، بخريطة تحويل (`Released`/`PartialRelease`/`ConditionalRelease` → `Released`، `Held` → `Held`، `Rejected` → `Rejected` — التحويل الجزئي/المشروط لـ`Released` مقصود لأن enum الدفعة معندوش تفصيل جزئي). **✅ مُختبر حيًا**: بعد تسجيل إفراج جودة بحالة "مُفرَج عنه"، الـBadge أعلى `/batches/[id]` اتغيّر فورًا من "قيد الانتظار" لـ"مُفرَج عنها".
2. **مفيش تحقق يمنع `Batch.quantityOutput` يتجاوز `quantityInput`** — كان بيسمح بنسبة استخلاص فوق 100% وهدر سالب في الحقول المحسوبة (⚙️). **الحل**: `.refine()` جديد في `BatchSchema` (`src/app/purchase-orders/actions.ts`) + رسالة خطأ على `quantityOutput` في `BatchForm.tsx`. **✅ مُختبر حيًا**: محاولة تسجيل دفعة بـ`quantityInput=500`/`quantityOutput=600` اترفضت برسالة "الكمية المخرجة مينفعش تتجاوز الكمية المدخلة"؛ دفعة صحيحة (500/450) اتسجّلت عادي.
3. **رسالة خطأ `BatchRawMaterialLineSchema` كانت دايمًا بتتعلّق بـ`farmId`** حتى لو الحقل الناقص الفعلي `inventoryId` (نتيجة استخدام `.refine()` بمسار واحد ثابت). **الحل**: تحويل لـ`.superRefine()` بحيث الرسالة بتتعلّق بالحقل الصح حسب `sourceType` الفعلي، + تصحيح مكان عرضها في `BatchRawMaterialLineForm.tsx` (تحت كل select بدل مكان واحد ثابت تحت الفورم).
4. **`/suppliers` و`/inventory` كانوا بيحمّلوا كل الصفوف من غير Pagination ولا بحث** — مخالف لنمط باقي صفحات القوائم في المشروع (`/companies`, `/products`, `/sourcing`...). **الحل**: نفس نمط `PAGE_SIZE`/`parsePage`/`<Pagination>`/`<ListSearch>` المستخدم في باقي الصفحات، مع `where` قابل للبحث (`legalName`/`tradeName` للموردين، `product.nameAr` للمخزون). **✅ مُختبر حيًا**: صفحة `/suppliers` بعد التنظيف عرضت "0 مورّد مسجّل" وصندوق البحث ظاهر وشغّال.
5. **صفحات التفاصيل الأربعة `/suppliers/[id]`, `/sourcing/[id]`, `/purchase-orders/[id]`, `/batches/[id]` كانت من غير أي فحص صلاحية** — أي مستخدم عنده Session صالح كان يقدر يفتحها بغض النظر عن دوره، رغم إن صفحات القوائم المقابلة كلها بتفحص الصلاحية. **الحل**: نفس نمط `requireCurrentUser()` + `try { requirePermission(...) } catch { رسالة رفض }` المستخدم في صفحات القوائم، مُضاف للأربعة. **ملاحظة نطاق**: نفس الفجوة موجودة في صفحات تفاصيل تانية في التطبيق كله (`compliance/[id]`, `logistics/[id]`, `deals/[id]`) كنمط قديم سابق على وحدة 7 — اتصلح هنا للأربعة بتوع وحدة 7 بس، مش حملة على مستوى التطبيق كله (خارج نطاق الطلب). **✅ مُختبر حيًا**: الأربعة صفحات فُتحت بنجاح كـAdmin بعد الإضافة، تأكيد إن الفحص مش بيمنع وصول شرعي.
6. **تكرار حرفي لثلاث دوال حسابية (⚙️)** بين `purchase-orders/[id]/page.tsx`, `batches/[id]/page.tsx`, `sourcing/[id]/page.tsx` (`yieldRate`, `wasteQuantity`, `effectiveCostPerSaleableKg`). **الحل**: استُخلصوا لملف مشترك جديد `src/lib/procurementCompute.ts`، مع إضافة حارس `input > 0` مكنش موجود في نسختين من التلات (كان بيسيب `Infinity`/`NaN` صامتة لو `quantityInput=0`، لأن فحص truthy على كائن `Prisma.Decimal` بيرجع `true` دايمًا حتى لو بيمثّل صفر).

## 20. ما اتلقطش عمدًا (قرار نطاق، مش تقصير)

- **فجوة الصلاحية في صفحات تفاصيل خارج وحدة 7** (بند 5 فوق) — نمط قديم سابق على وحدة 7، موجود في وحدات تانية، خارج نطاق "راجع وحدة 7".
- **قيد الـForeign Key عبر-المنظمات على مستوى Postgres** — موثّق ومقبول مسبقًا في `STATUS.md` (قسم "تدقيق شامل بعد P2")، مش عيب جديد في وحدة 7.

## 21. التحقق

`tsc --noEmit` نضاف (مرتين، بعد كل مجموعة تعديلات) → `prisma/rls-test.ts` نضاف 61/61 (بلا تغيير — مفيش Schema اتلمس) → `next build` نضاف. **تحقق حي كامل في المتصفح**: سلسلة كاملة Supplier → Facility → SourcingRequest → SupplierQuote → PurchaseOrder → Batch (رفض 600/500، قبول 450/450) → QualityRelease (Released) → تأكيد تحديث الـBadge حيًا. بيانات الاختبار اتنضّفت بالكامل بسكريبت `prisma/_cleanup_module7_review.ts` مؤقت (اتمسح بعد الاستخدام).

---

## الشريحة الخامسة والأخيرة — إقفال وحدة 7 بالكامل (23/23) (1 سبتمبر 2026)

المستخدم طلب أحدد أفضل خطوة جاية وأكمل. اخترت إقفال وحدة 7 (أكبر وحدة في الـERD، وصلت 17 من 23) بدل `QuoteLine` أو باقي وحدة 3 — أقرب نقطة لإقفال كامل. الـ6 كيانات المتبقية بُنيت في شريحة واحدة: `SupplierAudit`, `SupplyContract`, `PackagingMaterial`, `SupplierSample`, `CargoReadiness`, `SupplierPerformance`.

## 22. الكيانات المبنية فعليًا (آخر 6 من 23)

كل الحقول موثّقة زي `docs/ERD.md` §10، ما عدا الاستثناءات تحت:

- **`SupplierAudit`**: `supplierId`→Supplier, `facilityId`→Facility (nullable), `auditDate`, `auditor`, `totalScore`, `criticalFindings`/`majorFindings`/`minorFindings`, `decision` enum(Approved/ConditionalApproval/Rejected), `followUpDate`.
- **`SupplyContract`**: `supplierId`→Supplier, `contractType` enum(6 قيم من الـERD)، `startDate`/`endDate`، `priceAdjustmentMechanism`/`forceMajeureClause`/`penaltyTerms`، `status` enum(5 قيم). `documentId`→Document اتشال (`Document` وحدة 4 غير مبنية).
- **`PackagingMaterial`**: `supplierId`→Supplier, `materialType` enum(10 قيم)، `specification`/`dimensions`/`artworkVersion`/`artworkApproved`، كميات الطلب/الاستلام/القبول، `unitCost`/`currency`، `status` **enum قرار تفسيري** (`Requested,Ordered,PartiallyReceived,Received,Accepted,Rejected` — الـERD مش بيحدد قيم صراحةً).
- **`SupplierSample`**: `supplierId`→Supplier, `productId`→Product, `batchId`→Batch nullable, `purpose` enum(7 قيم)، `quantity`/`cost`/`currency`، `result` enum(4 قيم من الـERD)، `status` **enum قرار تفسيري** (`Requested,Sent,Received,Evaluated,Closed`).
- **`CargoReadiness`**: `shipmentId`→Shipment (وحدة 6)، `purchaseOrderId`→PurchaseOrder، `readinessScore`، `status` enum(10 قيم من الـERD)، `readyDate`/`pickupLocation`. `blockingIssues` text[] و`handoverPayload` jsonb اتسابوا كأعمدة nullable بلا واجهة إدخال (نفس معاملة `Farm.pesticideProgram`).
- **`SupplierPerformance`**: `supplierId`→Supplier, `periodStart`/`periodEnd`, 5 مؤشرات نسبة مئوية (`qualityPassRate`/`rejectionRate`/`onTimeDeliveryRate`/`yieldAccuracy`/`priceAccuracy`)، `overallScore`، `classification` enum(7 قيم من الـERD، nullable).

**Backfill إضافي على كيان قديم**: `LabTest.supplierSampleId` (nullable، كان اتشال في الشريحة التالتة لعدم وجود `SupplierSample` وقتها) اتضاف دلوقتي + علاقة عكسية `SupplierSample.labTests`.

**بلا Trigger جديد** — مفيش قيد عمل حرج صريح (⚠️) على أي من الـ6 كيانات في الـERD.

## 23. تحسين تنظيم `/suppliers/[id]` — مكوّن `Tabs` جديد

5 من الـ6 كيانات مرتبطة بـ`Supplier` مباشرة، وده كان هيوصل الصفحة لـ8 أقسام مسطّحة فوق الـ3 الموجودين (المنشآت/المزارع/NCR). سألت المستخدم عن الأنسب، واختار "الأفضل والأكثر تطورًا" — بُني مكوّن `Tabs` جديد (`src/components/ui/tabs.tsx`، مبني على `@base-ui/react/tabs` بنفس أسلوب `select.tsx` الموجود) يقسّم الصفحة لـ3 تابات منطقية:

1. **"نظرة عامة"**: المنشآت + المزارع (موجودين، بلا تغيير في المحتوى).
2. **"الجودة والتدقيق"**: NCR (موجود) + `SupplierAudit` (جديد) + `SupplierSample` (جديد).
3. **"تجاري وأداء"**: `SupplyContract` (جديد) + `PackagingMaterial` (جديد) + `SupplierPerformance` (جديد).

`CargoReadiness` مش مرتبط مباشرة بـ`Supplier` — قسم جديد "جاهزية الشحن (Cargo Readiness)" في `/purchase-orders/[id]` بدل كده، لأنه بيربط `PurchaseOrder` بـ`Shipment` (وحدة 6). **ملاحظة معمارية**: `Shipment` معندوش علاقة مباشرة بـ`Supplier`/`PurchaseOrder` (بيتربط بـ`Deal`/`Product` بس)، فـselect الشحنة في الفورم بيعرض شحنات المنظمة كلها (نفس نمط `/logistics`)، بلا فلترة بالمورّد أو أمر الشراء.

## 24. معيار "الشريحة الخامسة مكتملة" (Acceptance)

1. فتح `/suppliers/[id]` — التابات التلاتة ظاهرة وسويتشينج شغّال.
2. إضافة `SupplierAudit`/`SupplierSample` في تاب "الجودة والتدقيق" — يظهروا صح.
3. إضافة `SupplyContract`/`PackagingMaterial`/`SupplierPerformance` في تاب "تجاري وأداء" — يظهروا صح.
4. فتح `/purchase-orders/[id]` — قسم "جاهزية الشحن" ظاهر (فورم + جدول فاضي لو مفيش شحنات).
5. فتح `/batches/[id]` — قسم "الفحوصات المعملية" فيه select جديد "عينة المورّد المرتبطة".

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (1 سبتمبر 2026): إنشاء "مورد شريحة الإقفال" + منشأته → تسجيل `SupplierAudit` (قرار "معتمد") ظهر صح في تاب "الجودة والتدقيق" → تسجيل `SupplierSample` (منتج "فراولة مجمدة") ظهر صح → تسجيل `SupplyContract`/`PackagingMaterial`/`SupplierPerformance` (بعد تصحيح إدخال تاريخ الفترة عبر `form_input` — أول محاولة كتابة يدوية في حقل `date` مسحت بيانات مجاورة، مش باگ كود) ظهروا صح في تاب "تجاري وأداء" → بناء سلسلة SourcingRequest→SupplierQuote→PurchaseOrder→Batch → فتح `/batches/[id]` → تسجيل `LabTest` مربوط بـ`supplierSampleId` **اتأكد بفحص مباشر على القاعدة** إن الحقل اتسجّل صح (الجدول في الواجهة مالوش عمود لعرضه). **`CargoReadiness`**: القسم في `/purchase-orders/[id]` ظهر صح بحالة فاضية (0 شحنات في المنظمة) — بناء شحنة حقيقية محتاج سلسلة امتثال كاملة (ComplianceCase→Gates→معتمد للشحن) خارج نطاق التحقق ده؛ الإنشاء+عزل RLS مُتحقّق منهم بشكل مباشر عبر `prisma/rls-test.ts` (قسم 24). بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(67/67)/`next build` (بـ`NODE_OPTIONS=8192`) نضاف.

⚠️ أثناء التحقق الحي ظهرت أخطاء P2028 عابرة متكررة (Transaction API timeout/connection terminated) على صفحات `/sourcing/[id]`/`/purchase-orders/[id]`/`/batches/[id]` — نفس الـgotcha الموثّق مسبقًا (تزاحم اتصالات على الـpooler). البيانات اتسجّلت صح فعليًا في كل مرة (اتأكد بإعادة تحميل الصفحة)، مش عيب منطقي في الكود المُضاف.

## 25. ملفات جديدة (الشريحة الخامسة)

- `src/components/ui/tabs.tsx` (جديد بالكامل) — Tabs/TabsList/TabsTab/TabsPanel.
- إضافات في `src/lib/procurementLabels.ts`: تسميات `SupplierAuditDecision`/`SupplyContractType`/`SupplyContractStatus`/`PackagingMaterialType`/`PackagingMaterialStatus`/`SupplierSamplePurpose`/`SupplierSampleResult`/`SupplierSampleStatus`/`CargoReadinessStatus`/`SupplierPerformanceClassification`.
- إضافة `createSupplierAudit`/`createSupplyContract`/`createPackagingMaterial`/`createSupplierSample`/`createSupplierPerformance` في `src/app/suppliers/actions.ts` + 5 فورمات جديدة (`SupplierAuditForm.tsx`, `SupplyContractForm.tsx`, `PackagingMaterialForm.tsx`, `SupplierSampleForm.tsx`, `SupplierPerformanceForm.tsx`) — `src/app/suppliers/[id]/page.tsx` أُعيد تنظيمه لـ3 تابات.
- إضافة `createCargoReadiness` في `src/app/purchase-orders/actions.ts` + `CargoReadinessForm.tsx` — قسم جديد في `src/app/purchase-orders/[id]/page.tsx`.
- تعديل `src/app/batches/actions.ts`/`LabTestForm.tsx`/`src/app/batches/[id]/page.tsx` — إضافة `supplierSampleId` (اختياري) لفورم الفحص المعملي.
- **بلا صفحات/روابط Nav جديدة** — الستة كلهم أقسام متداخلة في صفحات موجودة بالفعل.
- صلاحيات جديدة (`QualityManager.Create`: `SupplierAudit`, `SupplierSample`؛ `ProcurementOfficer.Create`: `SupplyContract`, `PackagingMaterial`, `SupplierPerformance`, `CargoReadiness`) في `prisma/seed.ts`.

**🎉 وحدة 7 (ESPPQC) قفلت بالكامل — 23/23 كيان. ثالث وحدة تقفل 100% بعد وحدة 5 ووحدة 6.**
