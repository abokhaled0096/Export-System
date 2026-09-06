# وحدة 4 — المستندات والمواصفات: نطاق التنفيذ

## 1. الشريحة الأولى — `ProductSpecification` (1 سبتمبر 2026)

المستخدم طلب أحدد أفضل خطوة جاية بعد إقفال وحدة 5/6/7 بالكامل. رتّبت البدائل: `QuoteLine` (وحدة 2) مؤجَّل بقرار واعٍ صريح في `docs/SCOPE-P2.md` §7 ("يُبنى لما فرصة حقيقية بمنتجات متعددة تحتاجه فعليًا، مش قبلها")؛ باقي وحدة 3 (العملاء) كيانات متفرقة بلا دَين تقني فعلي بيستدعيها؛ **`ProductSpecification`** (وحدة 4) هو الأنسب — `SourcingRequest.specificationId` و`PurchaseOrder.specificationId` اتشالوا صراحةً في وحدة 7 لأن الكيان ده مكنش موجود (تعليقات "اتشال" موثّقة في `prisma/schema.prisma`)، فبناؤه بيقفل دَين تقني حقيقي وموجود بالفعل.

## 2. الكيان المبني فعليًا

من `docs/ERD.md` §7 (سطر 257): `ProductSpecification` — `productId`→Product, `version` (Int، افتراضي 1), `status` enum(`Draft, InternalReview, CustomerReview, CustomerApproved, QualityApproved, Superseded, Expired`), `physicalParams`/`chemicalParams`/`microbiologicalParams`/`packagingSpec`/`labelSpec` (كل واحد `Json?`)، `storageConditions`, `shelfLifeDays`, `approvedBy`→User (nullable), `reviewDate`.

## 3. تبسيطات هندسية موثّقة

1. **الحقول الـ5 jsonb (`physicalParams`...`labelSpec`) بلا واجهة إدخال** — نفس معاملة `Farm.pesticideProgram`/`CargoReadiness.handoverPayload`/`PurchaseOrder.deliverySchedule` (كلهم موجودين في الـSchema بلا فورم بسيط مناسب لبيانات jsonb حرة). تفضل أعمدة nullable لاستخدام مستقبلي.
2. **`approvedBy` بلا واجهة إدخال وقت الإنشاء** — نفس معاملة `LabTest.verifiedBy`/`QualityRelease.releasedBy`، القيمة بتتحدد لاحقًا لو فيه تدفّق اعتماد (مؤجَّل، مفيش UI تعديل لأي كيان في المشروع لحد دلوقتي أصلًا).
3. **بلا Trigger جديد** — الـERD مش بيحدد قيد عمل حرج صريح (⚠️) على `ProductSpecification` نفسها.
4. **Backfill مُتحكَّم فيه: `PurchaseOrder.specificationId` بس** — رغم إن `SourcingRequest.specificationId` عنده نفس تعليق "اتشال"، اتعمد الاقتصار على `PurchaseOrder` بس في الشريحة دي لأن `SourcingRequest` محتاج تعديل صفحة في وحدة تانية (`deals/[id]/scenarios/[scenarioId]`) خارج نطاق شريحة أولى مركّزة. مسجّل في `BACKLOG.md` كخطوة جاية واضحة الآن إن الكيان موجود. (تصحيح: `QualityRelease` معندهاش تعليق "اتشال" فعلي — كان استشهاد خاطئ في مراجعة سابقة؛ `NCR.capaId` بس هو اللي بيستشهد بـ`specificationId` كمثال مماثل.)

## 4. هيكل الـUI

- **`/products/[id]/page.tsx`** (صفحة جديدة بالكامل — **أول Detail Page لـ`Product`**، كان list-only لحد دلوقتي): معلومات أساسية للمنتج + قسم "المواصفات" (فورم + جدول: نسخة/ظروف تخزين/مدة صلاحية/تاريخ مراجعة/حالة).
- **`/products/page.tsx`**: اسم المنتج في الجدول بقى رابط لصفحة التفاصيل الجديدة (كان نص عادي بلا رابط).
- **Backfill UI**: select اختياري جديد "المواصفة" في فورم إنشاء `PurchaseOrder` (`src/app/sourcing/[id]/PurchaseOrderForm.tsx`) — بيظهر بس لو فيه مواصفات مسجّلة لمنتج طلب التوريد، معروضة كـ"نسخة N — الحالة".
- **بلا صفحات/روابط Nav جديدة إضافية** — المواصفات قسم متداخل في صفحة منتج موجودة، مش قسم مستقل.

## 5. ملفات جديدة

- `prisma/schema.prisma`: موديل `ProductSpecification` + enum `ProductSpecificationStatus` (نهاية الملف) + حقل `PurchaseOrder.specificationId` (nullable) + علاقة عكسية `Product.specifications`/`User.productSpecificationsApproved`.
- `src/lib/specificationLabels.ts` (جديد بالكامل) — تسميات `ProductSpecificationStatus` (أول ملف تسميات لوحدة 4).
- `src/app/products/[id]/page.tsx`+`ProductSpecificationForm.tsx` (جداد بالكامل).
- `src/app/products/actions.ts`: `createProductSpecification` جديدة.
- `src/app/sourcing/[id]/page.tsx`+`PurchaseOrderForm.tsx`: query `specifications` جديد + select اختياري.
- `src/app/sourcing/actions.ts` (`createPurchaseOrder`) + `src/app/approvals/actions.ts` (`approveRequest`, `PurchaseOrderOverridePayload`): `specificationId` اتمرّر في **الثلاث** مسارات الممكنة لإنشاء `PurchaseOrder` — الإنشاء المباشر، `Approval.payload` (فرع تجاوز السعر)، واعتماد الموافقة الاستثنائية لاحقًا. لازم الثلاثة يتزامنوا وإلا الحقل هيتفقد لو الأمر عدّى من مسار الموافقة.
- صلاحيات جديدة (`Product.View` + `ProductSpecification.Create` لـ`ProcurementOfficer` **و**`QualityManager` — تقسيم عمل زي وحدة 7: `ProcurementOfficer` بيربط المواصفة بأمر شراء، `QualityManager` هيعتمدها لاحقًا) في `prisma/seed.ts`.

## 6. معيار "الشريحة مكتملة" (Acceptance)

1. فتح `/products` → اسم منتج بقى رابط.
2. فتح `/products/[id]` → إضافة `ProductSpecification` — تظهر في الجدول.
3. فتح `/sourcing/[id]` (لنفس المنتج) → select "المواصفة" ظاهر في فورم أمر الشراء.
4. إنشاء `PurchaseOrder` مربوط بالمواصفة (تحت سقف `maximumPurchasePrice`) — `specificationId` يتسجّل صح.

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (1 سبتمبر 2026): فتح `/products` → التأكد إن "فراولة مجمدة" بقى رابط → فتح `/products/[id]` → إضافة مواصفة (نسخة 1، "-18°C"، Draft) ظهرت صح → إنشاء مورّد جديد → فتح سيناريو صفقة على نفس المنتج → فتح طلب توريد → التأكد إن select "المواصفة" ظهر وعرض "نسخة 1 — مسودة" صح → إنشاء عرض مورّد (150 USD) → إنشاء `PurchaseOrder` (500×150 USD، تحت سقف 200 USD) مربوط بالمواصفة → **فحص مباشر على القاعدة** أكّد إن `PurchaseOrder.specificationId` اتسجّل صح ومرتبط بنفس المنتج (الجدول في `/purchase-orders/[id]` مالوش عمود لعرض المواصفة، فالتحقق كان بفحص DB مباشر — نفس أسلوب التحقق من `LabTest.supplierSampleId` في وحدة 7 الشريحة الخامسة). بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(68/68)/`next build` (بـ`NODE_OPTIONS=8192`) نضاف.

---

## الشريحة الثانية — `Document` (1 سبتمبر 2026)

المستخدم طلب أحدد أفضل خطوة جاية بعد `ProductSpecification`. `Document` هو الأنسب — بيقفل فجوة حقيقية موجودة بالفعل (عرض السعر PDF في وحدة 2 بيتولّد لحظيًا بـ`puppeteer` من `Quote` من غير أي سجل `Document` رسمي يوثّقه — `src/app/deals/[id]/quotes/[quoteId]/pdf/route.ts` بيرندر ويستريم بلا حفظ)، وفيه قيد قانوني حقيقي (⚠️ الفاتورة التجارية B2B مش صالحة في مصر من غير `etaUuid` معتمد).

## 7. الكيان المبني فعليًا

من `docs/ERD.md` §7 (سطر 258): `documentType`, `documentNumber` (فريد)، `version`, `language`, `status`, `content` (jsonb)، `fileUrl`, `confidentiality`, `completenessScore`, `etaUuid`, `etaStatus`, `etaSubmittedAt`, `expiryDate`.

## 8. تبسيطات هندسية موثّقة

1. **`packageId`→DocumentPackage و`templateId`→Template اتشالوا من الـSchema بالكامل** — الكيانين مش مبنيين لسه.
2. **`companyId`/`shipmentId`/`specificationId`/`approvalId` أعمدة nullable بلا واجهة اختيار في الفورم** — الكيانات دي موجودة فعليًا، بس بلا فورم اختيار دلوقتي (نفس نمط `NCR.batchId`/`lotId`). راجع `BACKLOG.md`.
3. **`content` (jsonb) بلا واجهة إدخال** — نفس معاملة `Farm.pesticideProgram`. **`fileUrl` — [تحديث 1 سبتمبر]**: اتفعّل بالكامل — بنية Supabase Storage حقيقية اتبنت (`src/lib/storage.ts`)، `fileUrl` بيخزّن storage path، التحميل عبر Signed URL قصير الصلاحية (`/api/documents/[id]/file`). راجع `STATUS.md`.
4. **`completenessScore` بلا واجهة إدخال** — نفس معاملة `CargoReadiness.readinessScore`/`Route.reliabilityScore`.
5. **`confidentiality` نص حر** — الـERD مش بيحدد enum قيم.
6. **`documentNumber` إدخال يدوي + `@unique`** — الـERD بيحدده "فريد" بلا صيغة توليد تلقائي محددة (على عكس `PO-{year}-{seq}`).
7. **`etaStatus`/`etaUuid`/`etaSubmittedAt` بلا تكامل حقيقي مع بوابة ETA المصرية** — نفس فلسفة `Shipment.aciStatus`/`aciDeadlineMet` (وحدة 6) بالحرف: حقول تتحدَّد يدويًا (مفيش API credentials لبوابة ETA)، مع **Trigger حقيقي على مستوى القاعدة**.
8. **⚠️ Trigger إلزامي `enforce_document_eta_validated`** — مقتبس حرفيًا من `enforce_gate_aci_deadline_met` (`SECURITY DEFINER`, `BEFORE INSERT OR UPDATE`, `RAISE EXCEPTION ... USING ERRCODE = '23514'`). بيمنع `Document.status` يوصل `Issued`/`Sent` لـ`documentType=CommercialInvoice` من غير `etaStatus=Validated`. **بلا مسار موافقة استثنائية** (عكس `enforce_purchase_order_max_price`) — قيد صلب، مش سقف قابل للتجاوز.

## 9. هيكل الـUI

- **قسم جديد "المستندات" في `/deals/[id]/page.tsx`** — أنسب مكان موجود فعليًا (الصفحة أصلًا بتستضيف `Quote`/PDF/`SendQuoteEmailButton`، وأغلب قيم `documentType` مرتبطة بصفقة). فورم + جدول بنفس أسلوب الصفحة (`Card`/`CardContent`).
- **`src/app/deals/[id]/DocumentForm.tsx`** (جديد) — `documentType`, `documentNumber`, `version`, `language`, `status`, `confidentiality`, `expiryDate`, `etaUuid`, `etaStatus`, `etaSubmittedAt`.
- **بلا صفحات/روابط Nav جديدة** — قسم متداخل في صفحة موجودة بالفعل.

## 10. معيار "الشريحة مكتملة" (Acceptance)

1. فتح `/deals/[id]` → قسم "المستندات" ظاهر.
2. إنشاء `Document` بنوع `Quotation` — يظهر في الجدول.
3. إنشاء `Document` بنوع `CommercialInvoice` بحالة `Sent` و`etaStatus=NotApplicable` — **يترفض على مستوى القاعدة**.
4. نفس المستند بـ`etaStatus=Validated` — ينجح.

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (1 سبتمبر 2026): فتح `/deals/[id]` (Muster Import GmbH) → إنشاء `Document` (نوع "عرض سعر"، DOC-2026-0001) ظهر صح → محاولة إنشاء "فاتورة تجارية" (INV-2026-0001) بحالة "اترسل" و`etaStatus` "غير منطبق" **اترفضت فعليًا** برسالة "مينفعش تصدر/ترسل فاتورة تجارية من غير etaUuid معتمد من بوابة الضرائب المصرية (ETA)" (اتأكدت من `preview_logs`: `Code: 23514`) → نفس المستند بـ`etaStatus=معتمد` **نجح** وظهر في الجدول. بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(71/71، شامل فحصي Trigger رفض+نجاح جداد)/`next build` (بـ`NODE_OPTIONS=8192`) نضاف.

## 11. ملفات جديدة (الشريحة الثانية)

- `src/lib/documentLabels.ts` (جديد بالكامل).
- إضافة `createDocument` في `src/app/deals/actions.ts` (نفس نمط `createQuote`/`markDealLost`، بلا فرع موافقة استثنائية) + `src/app/deals/[id]/DocumentForm.tsx`.
- صلاحيات جديدة (`Document.Create` لـ`SalesRep`/`SalesManager`، نفس مكان `Quote.Create`) في `prisma/seed.ts`.

## 12. متبقي من وحدة 4 (4 كيان) — **[تحديث 1 سبتمبر] اتقفل بالكامل، راجع "الشريحة الثالثة والأخيرة" في الآخر**

`DocumentVersion`, `Template`, `DocumentPackage`, `Clause`. راجع `docs/ERD.md` §7 للتفاصيل الكاملة.

---

## Backfill صغير — `SourcingRequest.specificationId` (1 سبتمبر 2026)

آخر بند من دَين `specificationId` (اتشال وقت ما `ProductSpecification` مكنش موجود). `PurchaseOrder.specificationId` اتعمل في الشريحة الأولى؛ ده الجزء المتبقي. اخترته على البدائل التانية (بنية تخزين الملفات محتاجة إجراء يدوي من المستخدم في Supabase Dashboard، وباقي كيانات وحدة 4 مضاربة بلا دَين تقني فعلي).

**بلا Trigger جديد.** إضافة `specificationId String? @db.Uuid` + علاقة اختيارية لـ`ProductSpecification` على `SourcingRequest`، وعلاقة عكسية `sourcingRequests` على `ProductSpecification`. select اختياري جديد "المواصفة" في `OpenSourcingRequestForm.tsx` (أول `Select` في الملف ده، كان كله `Input` بلا أي dropdown) — بيظهر بس لو المنتج المرتبط بالصفقة عنده مواصفات مسجّلة، بيتعبّى من query جديد في `deals/[id]/scenarios/[scenarioId]/page.tsx` (`deal.productId` → `productSpecification.findMany`).

**✅ مُختبر حيًا end-to-end بالكامل**: منتج بلا مواصفات → select "المواصفة" مش ظاهر (صح) → إضافة مواصفة (نسخة 1) من `/products/[id]` → رجوع لصفحة السيناريو → select "المواصفة" ظهر وعرض "نسخة 1 — مسودة" صح → فتح طلب توريد مربوط بالمواصفة → **فحص مباشر على القاعدة** أكّد `SourcingRequest.specificationId` اتسجّل صح ومرتبط بنفس المنتج. بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(71/71، بلا فحص جديد — FK اختياري بلا سلوك جديد يستأهل اختبار مستقل)/`next build` نضاف.

**متبقي من دَين `specificationId`**: لا شيء — الثلاثة مواضع كلهم اتقفلوا (`PurchaseOrder`، `SourcingRequest`، و`QualityRelease` اتأكد إنها معندهاش دَين فعلي أصلًا).

---

## الشريحة الثالثة والأخيرة — `DocumentVersion`, `Template`, `DocumentPackage`, `Clause` (1 سبتمبر 2026) — وحدة 4 قفلت بالكامل 6/6

بعد ما اتقفل كل دَين "اتشال بسبب وحدة لسه مش موجودة" في المشروع كله، اخترت إقفال باقي وحدة 4 على 3 بدائل تانية بلا دَين إجباري (`QuoteLine` مؤجَّل بقرار موثّق مسبقًا §7 من `docs/SCOPE-P2.md`؛ باقي وحدة 3 ووحدة 1 بلا محفّز واضح) — نفس فلسفة "طالما بدأنا حاجة نكملها للآخر" اللي اتبعت مع وحدة 6.

**بلا Trigger جديد** — مفيش قيد عمل حرج صريح (⚠️) على أي من الأربعة في `docs/ERD.md` §7.

### تبسيطات هندسية موثّقة

- **`DocumentVersion`**: `changedFields`/`previousValues`/`newValues`/`contentSnapshot` (كلهم jsonb) و`approvalId`/`supersededById` (self-relation) اتشالوا من الفورم — nullable، بلا واجهة إدخال (نفس نمط `Document.content`/`approvalId`). `createdBy` بيتحدَّد تلقائيًا بالمستخدم الحالي وقت الإنشاء (نفس نمط `CAPA.ownerId`).
- **`Template`**: كيان مشترك مستقل (زي `CAPA`) — بلا مالك طبيعي واحد. `documentType`/`language` بيستخدموا نفس enums `Document` الموجودين (`DocumentType`/`DocumentLanguage`). `market`/`customerId` FK اختياريين لـ`Market`/`Company` الموجودين. `bodySchema` (jsonb) اتشال من الفورم. `usageCount` بلا آلية تتبّع فعلية (مفيش تدفّق "توليد مستند من قالب" لسه) — بيفضل 0 افتراضيًا.
- **`DocumentPackage`**: مرتبطة بصفقة (`dealId` إلزامي). `shipmentId` اختياري **بلا واجهة اختيار** — نفس نمط `Document.shipmentId` بالحرف. `completenessScore` بلا واجهة إدخال — نفس `Document.completenessScore` (عمود لمحرك حساب مستقبلي).
- **`Clause`**: كيان مشترك مستقل (زي `CAPA`) — مكتبة بنود قانونية بلا مالك طبيعي واحد. `riskLevel` enum تفسيري جديد (الـERD ما حددش قيم صراحةً) نفس روح `RejectionSeverity`.

### هيكل الـUI

- **`/templates`** و**`/clauses`**: صفحتان مستقلتان جداد (list + create)، نفس هيكل `/capa` بالحرف — `requirePermission` مع رسالة رفض ودّية، `parsePage`/`PAGE_SIZE`/`Pagination`، جدول + فورم.
- **`/deals/[id]`**: قسمان جداد بعد "المستندات" — "حزم المستندات" (`DocumentPackageForm.tsx`) و"سجل إصدارات المستندات" (`DocumentVersionForm.tsx`، بيظهر بس لو فيه مستندات على الصفقة — select "المستند" إلزامي).
- روابط Nav جديدة "القوالب"/"البنود".

### ملفات جديدة

`src/app/templates/{page,TemplateForm,actions}.tsx`, `src/app/clauses/{page,ClauseForm,actions}.tsx`, `src/app/deals/[id]/{DocumentPackageForm,DocumentVersionForm}.tsx`, `createDocumentPackage`/`createDocumentVersion` في `src/app/deals/actions.ts`, `src/lib/{templateLabels,clauseLabels,documentPackageLabels}.ts`.

### معيار "الشريحة مكتملة" (Acceptance)

**✅ مُختبر حيًا end-to-end بالكامل**: `Template` مع سوق+عميل مختارين من `/templates` → `Clause` مع "يحتاج موافقة"✓ من `/clauses` → مستند جديد على صفقة "Muster Import GmbH" الحقيقية → `DocumentPackage` على نفس الصفقة → قسم "سجل إصدارات المستندات" ظهر (select "المستند" معبّى) → `DocumentVersion` مربوط بالمستند → **فحص مباشر على القاعدة** أكّد الأربعة كيانات، خصوصًا `DocumentVersion.createdBy` التلقائي. بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(76/76، فحصان جداد لعزل RLS للأربعة كيانات)/`next build` نضاف.

**وحدة 4 قفلت بالكامل — رابع وحدة تقفل 100% بعد وحدة 5، 6، 7.**
