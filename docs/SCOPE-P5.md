# نطاق وحدة 5 — الامتثال والجمارك (ECCDC): تقسيم صريح على 3 شرايح — الوحدة قفلت بالكامل

**الحالة: ✅ 9 من 9 كيانات مبنية فعليًا على Supabase الحقيقي (30 أغسطس 2026) — الوحدة قفلت بالكامل.**
- **الشريحة الأولى** — `ComplianceCase → Requirement → Gate` + `HSClassification` + `Certificate`، مع إنفاذ حقيقي على مستوى القاعدة لقاعدتي "بوابة الاستثناء محتاجة موافقة" و"بوابة العبور محتاجة متطلبات مستوفاة".
- **الشريحة الثانية** — `Registration` + `OriginProof`، مع إنفاذ حقيقي على مستوى القاعدة لقاعدة PEM المنقّحة (`revisedRulesWordingVerified`) — الفجوة اللي كانت موثّقة كـ"غير منفَّذة" في §4 تحت اتقفلت.
- **الشريحة التالتة (أخيرة)** — `RejectionCase` + `LCRequirement` — كيانات توثيق بيانات (CRUD) بلا Trigger جديد، مفيش قيد عمل حرج مذكور في `docs/ERD.md` §8 بيتعلق بيهم.

**لماذا هذا الملف:** نفس منطق `SCOPE-P1.md`/`SCOPE-P2.md` — وحدة 5 في `docs/ERD.md` §8 فيها 9 كيانات، أكبر من أي شريحة أولى معقولة اتبنت قبل كده في جلسة واحدة (وحدة 2 نفسها اتبنت على 3 شرائح متتالية). الملف ده بيوثّق القطع الفعلي اللي اتنفّذ، مش خطة مستقبلية.

**القاعدة العامة للقطع:** الشريحة الأولى = أقل نموذج بيانات يخلي "فتح ملف امتثال لسيناريو صفقة معتمد → تسجيل متطلبات → تصنيف جمركي → شهادات → بوابات قرار حقيقية بإنفاذ على مستوى القاعدة" شغّال حقيقي. أي حاجة بتحتاج بنية تحتية من وحدة تانية لسه مبنيّة (Supplier/Facility من وحدة 7، Shipment من وحدة 6، Attachment/Storage) بتتأجل.

---

## 1. الكيانات المبنية فعليًا (9 من 9 — الوحدة كاملة)

- **الشريحة الأولى**: `ComplianceCase`, `Requirement`, `Gate`, `HSClassification`, `Certificate`
- **الشريحة الثانية** (30 أغسطس 2026): `Registration`, `OriginProof` — + حقل معماري جديد `Gate.requiresOriginProofVerification Boolean @default(false)` (مش من الـERD الأصلي، راجع §4 تحت).
- **الشريحة التالتة** (30 أغسطس 2026): `RejectionCase`, `LCRequirement`.

كل الحقول زي ما هي موثّقة في `docs/ERD.md` §8، ما عدا الاستثناءات تحت.

### تفاصيل الشريحة الثانية

- **`Registration`**: `supplierId`/`facilityId` اتشالوا وقت البناء (نفس سبب `Certificate` — وحدة 7 لسه مبنيّتش). `productId` بس فعليًا، عرض بمطابقة `productId = kase.productId` (نفس نمط `Certificate`). **[تحديث 1 سبتمبر]**: `supplierId`/`facilityId` اتضافوا فعليًا (backfill، وحدة 7 مقفولة بالكامل دلوقتي) — selects اختيارية org-wide في `RegistrationForm.tsx`، راجع `STATUS.md`.
- **`OriginProof`**: `shipmentId` اتشال وقت البناء (وحدة 6 لسه مبنيّتش)، `evidenceIds` اتشال (Attachment/Storage مؤجَّلين، لسه مؤجّل). `dealId` بس فعليًا — ربط مباشر بـ`ComplianceCase` عبر `dealId = kase.dealId` (أدق من مطابقة `Certificate` الاستنتاجية). `status` enum قرار تفسيري (الـERD ما حدّدش قيم صراحةً): `Draft, Issued, Verified, Rejected, Expired`. **[تحديث 1 سبتمبر]**: `shipmentId` اتضاف فعليًا (backfill، وحدة 6 مقفولة بالكامل دلوقتي) — select اختياري في `OriginProofForm.tsx` باستخدام `kase.shipments` الموجودة أصلًا، راجع `STATUS.md`.
- **`Gate.requiresOriginProofVerification`**: حقل جديد، بيتحدّد وقت إنشاء البوابة (checkbox)، بيمثّل "دي البوابة المسؤولة عن الشحن/الإبحار" — أدق من قاعدة عامة تفحص كل بوابات الحالة (كانت هتمنع بوابات مالهاش علاقة بالشحن، زي اعتماد التصنيف الجمركي، من العبور غلط).

### تفاصيل الشريحة التالتة (بلا Trigger جديد — راجع §4)

- **`RejectionCase`**: `shipmentId` اتشال (وحدة 6 لسه مبنيّتش)، `capaId` اتشال (`CAPA` كيان مشترك لسه مش مبني، ومفيش استخدام فعلي بلاه). `status` enum قرار تفسيري (نفس روح `OriginProofStatus`): `Open, UnderInvestigation, CAPARequired, Resolved, Closed, Disputed`. `complianceCaseId` إلزامي، عرض مباشر بـ`complianceCaseId = kase.id`.
- **`LCRequirement`**: `requiredDocuments` بـ`String[]` بدل `jsonb` (نفس قرار `Gate.blockingRequirementIds`/`Certificate.marketsCovered` — قايمة نصية بسيطة، مفيهاش بنية متداخلة تستاهل jsonb). مفيش `status` — الـERD مش بيذكر واحد لهذا الكيان أصلًا (توثيق شروط، مش Workflow object). `dealId` إلزامي، عرض مباشر بـ`dealId = kase.dealId` (نفس نمط `OriginProof`).

## 3. تبسيطات هندسية موثّقة (قرار واعي، مش تسيّب)

1. **`ComplianceCase.readinessScore`/`riskScore` اتشالوا خالص** — نفس قرار `DealScenario.dealScore`/`costConfidenceScore` في `docs/SCOPE-P2.md` §3 ("لا تُعطِ درجة موزونة بلا تبرير"، ERD §3). بترجع لما `ScoreSnapshot` (بند مؤجَّل مشترك، `BACKLOG.md`) يتبني.
2. **`ComplianceCase.supplierId`/`shipmentId` اتشالوا وقت البناء** — `Supplier` (وحدة 7) و`Shipment` (وحدة 6) مكنوش موجودين وقتها. **[تحديث 1 سبتمبر]**: `supplierId` اتضاف فعليًا (backfill، وحدة 7 مقفولة بالكامل دلوقتي) — select اختياري org-wide في `OpenComplianceCaseForm.tsx`؛ `shipmentId` لسه مش عمود مستقل (العلاقة موجودة عكسيًا عبر `Shipment.complianceCaseId` من وحدة 6). راجع `STATUS.md`.
3. **`Certificate.supplierId`/`facilityId`/`attachmentId` اتشالوا وقت البناء** — نفس السبب (وحدة 7 + Storage/Signed URLs لسه مؤجّلين من `SCOPE-P2.md` §2 نفسه). `companyId`/`productId` بس فعليًا في v1. **[تحديث 1 سبتمبر]**: `supplierId`/`facilityId` اتضافوا فعليًا (backfill) — `attachmentId` لسه مؤجَّل (Storage). راجع `STATUS.md`.
4. **`Requirement.evidenceId`/`sourceId` اتشالوا** — `Attachment`/`Source` نفس القصة.
5. **`HSClassification.sourceId` اتشال** — نفس سبب `Rate`/`Source` المؤجَّلين من وحدة 2.
6. **`Gate.blockingRequirementIds` كـ `String[]` (نص خام مش `uuid[]`)** — نفس نمط `Company.classification`/`Market.mainPorts` الموجود بالفعل في المشروع، بيسمح بفحص `= ANY(...)` مباشر جوه الـTrigger بلا نوع Postgres إضافي.
7. **`Requirement.complianceCaseId` أو (`productId`+`marketId`)** — إلزامي أحدهما مش الاتنين، يتفحص في الـServer Action (Zod `.refine()`)، بلا CHECK constraint على مستوى القاعدة — منطق شرطي، مش قيد مالي/أمني حرج يستاهل Trigger.

## 4. الإنفاذ الإلزامي المُنفَّذ فعليًا (غير قابل للتفاوض، من CLAUDE.md)

الأول والتاني Trigger في `prisma/migrations/20260830230500_compliance_rls/migration.sql`، الثالث في `prisma/migrations/20260830240500_compliance_registration_origin_proof_rls/migration.sql`:

1. **`Gate.status = 'Waived'` محتاج `Approval` معتمد فعليًا** (`gate_waiver_requires_approval`) — نفس نمط `enforce_quote_walk_away_price` بالظبط، بيعيد استخدام جدول `Approval` الموجود (`subjectType = 'Gate.waiver'`).
2. **`Gate.status = 'Passed'`/`'PassedWithConditions'` محتاج كل `Requirement` في `blockingRequirementIds` تكون `Met`/`NotApplicable`** (`gate_pass_requires_met_requirements`) — نفس "بوابة الموافقات الشكلية" اللي كل RLS Tester في المشروع مصمّم يكشفها.
3. **`Gate.status = 'Passed'`/`'PassedWithConditions'` على بوابة بعلامة `requiresOriginProofVerification=true` محتاج كل `OriginProof` لنفس الصفقة بـ`usesRevisedPemRules=true` تكون `revisedRulesWordingVerified=true`** (`enforce_gate_origin_proof_verified`) — قاعدة PEM المنقّحة (مصر، سارية فعليًا من يناير 2026)، اتقفلت في الشريحة الثانية (30 أغسطس 2026). مُتحقَّق منها حيًا في المتصفح: بوابة شحن اترفضت فعليًا برسالة واضحة، عدّت بعد التحقق، وبوابة عادية في نفس الحالة عدّت بلا تأثر.

⚠️ **`Shipment.aciDeadlineMet`** (موثّق في `docs/ERD.md` §8 كإنفاذ إلزامي منفصل) **لسه مش مُنفَّذ** — محتاج وحدة 6 (`Shipment`) تتبنى الأول.

**الشريحة التالتة (`RejectionCase`/`LCRequirement`) — مفيش Trigger رابع.** لا الكيانين دول مذكورين في `docs/ERD.md` كقيد عمل حرج يستدعي إنفاذ على مستوى القاعدة (بعكس `revisedRulesWordingVerified`/`aciDeadlineMet` فوق) — توثيق بيانات بس، RLS org-isolation عادية (`prisma/migrations/20260830250500_compliance_rejection_lc_rls`).

## 5. معيار "الشريحة الأولى مكتملة" (Acceptance)

1. فتح `ComplianceCase` من سيناريو صفقة معتمد (`productId`/`marketId` بتتشتق من الصفقة، مش إدخال مستخدم).
2. تسجيل `Requirement` — سواء مرتبط بالحالة، أو بحث مبكر (`productId`+`marketId` بلا حالة، قبل وجود صفقة أصلًا).
3. إنشاء `Gate` بمتطلبات حاجبة، ومحاولة `Passed` — **يُرفض فعليًا على مستوى القاعدة** لو فيه متطلب مش `Met`.
4. تحديث حالة المتطلب لـ`Met`، إعادة محاولة `Passed` — تنجح.
5. طلب تجاوز (`Waiver`) على بوابة تانية بلا موافقة — **يُرفض فعليًا على مستوى القاعدة**. اعتماد الطلب من `/approvals` (نفس الشاشة الموجودة، امتدت لتدعم النوع الجديد) — `Waived` تنجح بعدها.
6. `HSClassification`/`Certificate` بيتسجّلوا ويظهروا في شاشة تفاصيل الحالة.

## 5ب. معيار "الشريحة الثانية مكتملة" (Acceptance) — ✅ مُتحقَّق منه حيًا 30 أغسطس 2026

1. `Registration`/`OriginProof` بيتسجّلوا من شاشة تفاصيل الحالة ويظهروا في قسمين جداد ("التسجيلات"، "إثبات المنشأ").
2. `OriginProof` بـ`usesRevisedPemRules=true`+`revisedRulesWordingVerified=false` + `Gate` بعلامة `requiresOriginProofVerification=true` لنفس الصفقة → محاولة `Passed` **تُرفض فعليًا على مستوى القاعدة** برسالة عربي واضحة (بلا تسريب تفاصيل Prisma/Postgres داخلية).
3. تحديث `OriginProof.revisedRulesWordingVerified=true`، إعادة محاولة `Passed` على نفس البوابة — تنجح.
4. بوابة تانية في نفس الحالة بلا علامة `requiresOriginProofVerification` — تعدّي `Passed` عادي بلا أي تأثر بحالة `OriginProof`.
5. `npx tsx prisma/rls-test.ts` — 19/19 فحوصات ناجحة (3 فحوصات جداد لهذه الشريحة).

## 5ج. معيار "الشريحة التالتة مكتملة" (Acceptance) — ✅ مُتحقَّق منه حيًا 30 أغسطس 2026

1. `RejectionCase`/`LCRequirement` بيتسجّلوا من شاشة تفاصيل الحالة ويظهروا في قسمين جداد ("حالات الرفض"، "متطلبات خطاب الاعتماد").
2. `RejectionCase` بـ`rejectionType`/`severity`/`financialExposure` — سُجِّل وظهر بالبيانات الصحيحة (Badge خطورة، حالة "مفتوحة" افتراضيًا).
3. `LCRequirement` بمبلغ/بنك/تاريخ انتهاء/مستندات مطلوبة (نص مفصول بفاصلة → `String[]`) — سُجِّل وظهر بالبيانات الصحيحة.
4. `npx tsx prisma/rls-test.ts` — **21/21** فحوصات ناجحة (فحصان جداد: عزل RLS بين orgA/orgB لكل من `RejectionCase`/`LCRequirement`، بلا Trigger يتفحص لأنه مفيش).

## 6. الوحدة قفلت بالكامل (9/9)

كل الـ9 كيانات في `docs/ERD.md` §8 مبنية دلوقتي عبر 3 شرايح متتالية (30 أغسطس 2026). القيدان الإلزاميان الوحيدان المذكوران صراحةً في الـERD (`revisedRulesWordingVerified`/PEM، `Shipment.aciDeadlineMet`/ACI) — الأول مُنفَّذ بالكامل (§4 فوق)، والتاني معلَّق على بناء وحدة 6 (`Shipment`) — بند مفتوح موثّق في `BACKLOG.md`، مش نسيان.
