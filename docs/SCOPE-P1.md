# نطاق P1 — الأساس: تقسيم صريح P1 مقابل Phase 2

**الحالة:** جاهز كمرجع نطاق لبدء الكود.
**تاريخ:** 2026-08-25
**لماذا هذا الملف:** المواصفات السبع الأصلية أكبر من أي MVP معقول (نمط رصدته المراجعة العكسية في كل وحدة من السبع)، والتقرير المعماري النهائي يعتبر تحديد P1 مقابل Phase 2 **شرطًا قبل كتابة أي كود لأي وحدة**، لا رفاهية. هذا الملف يغطي فقط الوحدات الثلاث الفعلية في P1 حسب `STATUS.md` (المصادقة/الأدوار، المنتج، السوق، العملاء الأساسية) — تقسيم P2-P7 يُكتب كل واحد لما دوره ييجي، مش كله دفعة واحدة، لتجنّب تخطيط تفصيلي لوحدات بعيدة شهور عن التنفيذ الفعلي.

**القاعدة العامة للقطع:** P1 = أقل نموذج بيانات يخلي "منتج → سوق → تحليل → عميل → فرصة" شغّال حقيقي على قاعدة بيانات حقيقية بأدوار حقيقية. أي حقل/كيان بيخدم محرك ذكاء (تسجيل، توصيات موزونة، تتبع تفصيلي) بيتأجل لحد ما يبقى فيه بيانات كفاية يتدرّب عليها أصلًا (نفس منطق تأجيل Route Learning في REVIEW-2026-08 §4).

---

## 0. المصادقة والأدوار (بنية تحتية مشتركة، مش وحدة)

### P1
- `User` — `fullName`, `email`, `role` enum كامل (SalesRep, SalesManager, Finance, ComplianceOfficer, ProcurementOfficer, QualityManager, LogisticsOfficer, CompanyOwner, Admin)، `isActive`.
- Supabase Auth (بريد/كلمة مرور فقط).
- `Organization` — صف واحد مزروع، بلا واجهة إدارة (حسب القرار المعماري الحالي).
- RLS فعلي (`orgId = current_org()` + شرط الدور) على كل جدول من أول Migration لهذه الوحدات الثلاث تحديدًا — **مش Policy فاضي**، RLS Tester سيناريو واحد على الأقل لكل جدول.
- `AuditLog` (Insert-only) شغّال على Create/Update لكل الجداول أدناه.

### Phase 2
- `mfaEnabled` + فحص claim `aal` فعليًا — مطلوب من أول عملية حساسة ماليًا/بنكيًا، يعني بيصير P1 حقيقي بمجرد ما P2 (التسعير) تبدأ، مش دلوقتي.
- `ApprovalPolicy`/`Approval` الفعلي (محرك موافقات قابل للتعديل) — لا معنى له بدون Deal/Quote (P2).
- Signed URLs قصيرة الصلاحية للمرفقات — تُبنى مع أول رفع ملف حقيقي (على الأرجح مع `Attachment` في P2/P3)، لا حاجة لها إن كان P1 بلا مرفقات.

---

## 1. المنتج (من مشروع 1)

### P1 — حقول `Product`
`nameAr`, `nameEn`, `hsCode`, `category`, `originCountry`, `harvestSeason`, `availableMonths`, `storageTempC`, `shelfLifeDays`, `requiresRefrigeration`, `status` enum(Draft, Verified, NeedsReview).

### P1 — وظائف
إضافة/تعديل/أرشفة (لا حذف فعلي)، بحث، تصفية، عرض جدول وبطاقات، طباعة أساسية.

### Phase 2
- `scientificName`, `tradeName`, HS Codes بديلة (متعددة)، تفصيل مناطق/محافظات الإنتاج، مواسم الزراعة/الحصاد/التصنيع منفصلة.
- `egsCode` (كتالوج GS1/EGS) — مطلوب فعليًا فقط لما الفاتورة الإلكترونية (P3، وحدة المستندات) تبدأ، لا قبلها.
- حالة التحقق الخماسية (موثقة/موثقة جزئيًا/غير متحقق/قديمة/متعارضة) — enum ثلاثي بسيط (Draft/Verified/NeedsReview) كافٍ لـP1.
- صور المنتج/التعبئة، شهادات الجودة المرتبطة، Data Quality Score.

---

## 2. السوق (من مشروع 1)

### P1 — حقول `Market`
`countryNameAr`, `countryNameEn`, `countryCode`, `continent`, `currency`, `mainPorts`, `tradeAgreement`, `politicalRiskScore`, `logisticsRiskScore`, `lastReviewedAt`.

### P1 — حقول `ProductMarketAnalysis`
`productId`, `marketId`, `year`, `opportunityScore`, `riskScore`, `confidenceLevel`, `recommendation` enum(Start, Study, Monitor, Avoid) — بلا محرك أوزان قابل للتعديل، الدرجة تُدخل/تُحدَّث يدويًا في P1.

### Phase 2
- ~~`Competitor` (مستوى دولة أو شركة) — يحتاج بيانات منافسين حقيقية أولًا، مفيش قيمة لجدول فاضي.~~ **اتحل 6 سبتمبر 2026 بقرار مختلف عن الافتراض الأصلي**: بدل انتظار بيانات منافسين يدوية، النظام نفسه بيبحث ويجيبها ببحث آلي حقيقي (OpenAI Responses API + `web_search`، نفس نمط `ProductMarketAnalysis`) — مسار AI + مسار إدخال يدوي، كل صف موسوم بمصدره. تفاصيل كاملة في `BACKLOG.md` § خلصان و`STATUS.md`.
- `MonthlyOpportunity` (تقويم الفرص الشهري) والحساب الموزون الكامل خلفه.
- `EntryPlan` وربطه بـ`Task` — خطة دخول سوق منظمة تنتظر وجود صفقات فعلية تتعلم منها.
- Market Gap Detector (محرك مقارنة أسواق بأوزان قابلة للتعديل) — يحتاج `ScoreSnapshot` (ERD v3 §3) شغّال، أنسب بعد P2.
- `ScoreSnapshot` لتفسير `opportunityScore`/`riskScore` — P1 بيسجلها كرقم بسيط بلا تفصيل مكوّنات؛ التفسير الكامل بيتفعّل مع محرك الأوزان في Phase 2.

---

## 3. العملاء الأساسية (من مشروع 3)

### P1 — حقول `Company`
`legalName`, `tradeName`, `country`, `city`, `classification`, `status` enum كامل (Lead...Blacklisted)، `ownerId`. حقول بنكية (`bankAccountName` 🔒, `bankIBAN` 🔒, `bankSWIFT` 🔒) تُنشأ كأعمدة مشفّرة من أول Migration (قاعدة أمان غير قابلة للتفاوض) لكن **بلا واجهة إدخال في P1** — تُفعَّل مع أول تحصيل فعلي.

### P1 — حقول `Contact`
`companyId`, `name`, `title`, `email`, `phone` 🔒, `decisionRole`.

### P1 — حقول `Opportunity`
`companyId`, `contactId`, `productId`, `marketId`, `stage` (مجموعة فرعية: NewLead, Contacted, Qualified, QuoteSent, Won, Lost — لا كل الـ20 مرحلة)، `expectedValue`, `currency`, `probabilityOfClose`, `expectedCloseDate`, `ownerId`, `nextAction`, `nextActionDate`. حقول التسليم الأولية (`indicativeQuantity`/`indicativeIncoterm`/`indicativePaymentTerms`، ERD v3) — P1 كمان، رخيصة ومطلوبة عشان التحويل لـDeal في P2 يبقى له بيانات.

### P1 — وظائف
CRUD كامل على الثلاثة، ربط فرصة بمنتج/سوق موجودين فعليًا، لوحة قيادة بسيطة (عدد الفرص لكل مرحلة).

### Phase 2
- `customerFitScore`/`customerTrustScore` الكاملين بالأوزان الثمانية + `ScoreSnapshot` — تُبنى مع أول دفعة عملاء حقيقية كفاية للتفريق.
- `Communication` (سجل تواصل)، `RFQAnalysis` (تحليل نص تلقائي) — كانوا مؤجَّلين لغياب قناة استيراد بريد/واتساب فعلية. **[تحديث 1 سبتمبر]**: اتبنوا فعليًا كـ**تسجيل يدوي** (بلا قناة استيراد تلقائية — دي لسه مؤجَّلة، `extractedFields`/`completenessScore` بلا واجهة إدخال) — راجع `STATUS.md`، أول Detail Page لـ`Opportunity`.
- `CustomerSample` — كان معتمد على `Batch`/`Lot` من وحدة الموردين (P5، دلوقتي P7 بالترقيم الحالي). **[تحديث 1 سبتمبر]**: `Batch`/`Lot` مبنيين بالكامل (وحدة 7 مقفولة) — `CustomerSample` اتبنى فعليًا، `batchId` select اختياري org-wide.
- `RedFlag`, `Negotiation`/`NegotiationRound` — كانوا معتمدين على `Quote` من P2. **[تحديث 1 سبتمبر]**: `Quote` مبني بالكامل — الاتنين اتبنوا فعليًا (`RedFlag` في `/companies/[id]`، `Negotiation`+`NegotiationRound` في `/opportunities/[id]`).

---

## 4. معيار "P1 مكتمل" (Acceptance)

P1 يُعتبر جاهزًا لو تحقق:

1. مستخدم بدور `Admin` يقدر يسجّل دخول، ومستخدم بدور `SalesRep` يشوف بس الفرص المرتبطة بيه (RLS حقيقي، مُختبَر بسيناريو RLS Tester واحد على الأقل).
2. إضافة منتج، سوق، شركة، جهة اتصال، وفرصة — تربط ببعضها فعليًا (FKs حقيقية لا نص حر).
3. `ProductMarketAnalysis` واحد على الأقل مسجّل بدرجة وتوصية.
4. `AuditLog` بيسجّل كل عملية Create/Update على الجداول الخمسة دي — تحقق فعلي إن الجدول Insert-only (محاولة UPDATE عليه تفشل).
5. لا حذف فعلي لأي سجل — الأرشفة (`deletedAt`) بس.

---

## 5. الخطوة الجاية

بعد اعتماد هذا النطاق: Monorepo scaffold → Prisma schema لهذه الجداول تحديدًا (لا الـ92 كيان دفعة واحدة) → RLS على نفس الجداول → أول Migration. تقسيم P2 (التسعير) يُكتب في ملف مماثل لما P1 يقرب من الاكتمال، مش قبلها.
