# نطاق وحدة 6 — اللوجستيات (ELCTIS): 17 من 17 — إقفال كامل

**الحالة: ✅ 17 من 17 كيان مبنية فعليًا على Supabase الحقيقي (31 أغسطس 2026) — الوحدة قفلت بالكامل.**
- **الشريحة الأولى** — `Shipment → ShipmentParty/Booking/Container/Milestone` + Trigger رابع على `Gate` (`enforce_gate_aci_deadline_met`).
- **الشريحة الثانية** — التتبع التشغيلي: `ShipmentEvent`, `LogisticsException`, `FreeTimeRecord`, `ActualLogisticsCost`. بلا Trigger جديد.
- **الشريحة الثالثة** — `TemperatureLog`, `TransportTrip`, `Claim`. بلا Trigger جديد.
- **الشريحة الرابعة** — تسعير الشحن: `ServiceProvider`, `Route`, `FreightQuote`, `FreightQuoteLine`. بلا Trigger جديد. المستخدم قرر إقفال الوحدة بالكامل قبل الانتقال لوحدة 7 ("طالما بدأنا حاجة نكملها للآخر")، فبنينا البنية دي رغم غياب بيانات مزوّدين حقيقية وقت الكتابة — جاهزة للاستخدام الفعلي أول ما تتوفر.
- **الشريحة الخامسة والأخيرة** (31 أغسطس 2026) — `ShipmentLot`: جدول وسيط N:N بين `Shipment` و`Lot` (وحدة 7)، كان معلَّق رسميًا لحد ما `Lot` يتبنى في وحدة 7 (الشريحة الثانية). دلوقتي `Lot` موجود، فاتبنى `ShipmentLot` وقفلت الوحدة بالكامل. بلا Trigger جديد — راجع §5.

**لماذا هذا الملف:** نفس منطق `SCOPE-P2.md`/`SCOPE-P5.md` — وحدة 6 في `docs/ERD.md` §9 فيها 17 كيان، أكبر من أي شريحة أولى معقولة. الملف ده بيوثّق القطع الفعلي اللي اتنفّذ، مش خطة مستقبلية.

**القاعدة العامة للقطع:** الشريحة الأولى = أقل نموذج بيانات يخلي "إنشاء شحنة لصفقة/ملف امتثال → تتبّع أطراف/حجز/حاويات → معالم زمنية → قفل فجوة `aciDeadlineMet` في Gate (وحدة 5)" شغّال حقيقي. الشرايح التالية وسّعت الوحدة تدريجيًا، و`ShipmentLot` كان محتاج `Lot` من وحدة 7 (اتبنى فعليًا في الشريحة الثانية من وحدة 7، `docs/SCOPE-P7.md`) — بمجرد ما اتبنى، اتفتحت الشريحة الخامسة وقفلت الوحدة بالكامل.

---

## 1. الكيانات المبنية فعليًا (17 من 17 — كاملة)

**الشريحة الأولى**: `Shipment`, `ShipmentParty`, `Booking`, `Container`, `Milestone`.
**الشريحة الثانية** (30 أغسطس 2026): `ShipmentEvent`, `LogisticsException`, `FreeTimeRecord`, `ActualLogisticsCost`.
**الشريحة الثالثة** (30 أغسطس 2026): `TemperatureLog`, `TransportTrip`, `Claim`.
**الشريحة الرابعة** (30 أغسطس 2026): `ServiceProvider`, `Route`, `FreightQuote`, `FreightQuoteLine`.
**الشريحة الخامسة والأخيرة** (31 أغسطس 2026): `ShipmentLot`.

كل الحقول زي ما هي موثّقة في `docs/ERD.md` §9، ما عدا الاستثناءات تحت.

### تفاصيل الشريحة الرابعة (تسعير الشحن)

**كيانات بيانات أساسية (Master Data) مستقلة** — عكس كل الكيانات في الشرايح التلاتة السابقة، دي مش تابعة لشحنة بعينها (زي `Product`/`Market`)، فاتبنيت كصفحات مستقلة (`/logistics/providers`, `/logistics/routes`, `/logistics/quotes`) مش أقسام جوه `/logistics/[id]`.

- **`ServiceProvider`**: `performanceScore` (⚙️) اتشال — نفس قرار باقي الـscores في الوحدة (لا تُعطِ درجة موزونة بلا تبرير). `onTimePerformance`/`invoiceAccuracy` بيتسجّلوا يدويًا.
- **`Route`**: `reliabilityScore`/`riskScore` اتشالوا لنفس السبب.
- **`FreightQuote`**: `originCharges`/`mainFreight`/`destinationCharges`/`insurance` — البنود الإجمالية الأربعة للعرض السريع فقط (زي ما الـERD بيوضّح صراحة)، التفصيل الفعلي في `FreightQuoteLine`. **`totalLogisticsCost`/`logisticsScore` (⚙️) اتشالوا كأعمدة مخزَّنة** — `totalLogisticsCost` بيتحسب وقت العرض من مجموع `FreightQuoteLine.amount` (نفس نمط `Container.weightUtilization`)، و`logisticsScore` اتشال زي باقي الـscores.
- **`FreightQuoteLine`**: `chargeCode` نص حر (أمثلة زي THC/BunkerSurcharge بلا enum مغلق، زي ما الـERD بيقول).
- **`Booking.providerId`/`freightQuoteId` استرجعوا** — كانوا اتشالوا في الشريحة الأولى لغياب الكيانين، دلوقتي اختياريين ومربوطين فعليًا (`BookingForm` بيعرض الـselects بس لو فيه مزوّدين/عروض مسجَّلة).

### تفاصيل الشريحة الثانية

- **`ShipmentEvent`**: `eventType` نص حر — الـERD مش بيحدد enum ثابت له (سجل أحداث مفتوح، عكس `LogisticsException`). `reliability` (نسبة ثقة 0-100) نفس نمط `HSClassification.confidenceScore`.
- **`LogisticsException`**: كل الحقول زي الـERD بالظبط (23 قيمة enum لـ`exceptionType`، 5 لـ`severity`، 4 لـ`status`).
- **`FreeTimeRecord`**: `containerId` اختياري (شحنات LCL بلا حاوية مخصَّصة). `tierRates` كـ`Json?` (بنية متداخلة فعلية، عكس القوائم النصية البسيطة زي `Gate.blockingRequirementIds`).
- **`ActualLogisticsCost`**: `fxRateId` اختياري → `ExchangeRate` (نفس نمط `CostItem.fxRateId`).

### تفاصيل الشريحة الثالثة

- **`TemperatureLog`**: `containerId` اختياري (شحنات LCL). `source` نص حر — الـERD مش بيحدد enum له.
- **`TransportTrip`**: `status` enum قرار تفسيري (الـERD ما حدّدش قيم صراحةً، نفس روح `OriginProofStatus`/`RejectionCaseStatus`): `Scheduled, InProgress, Completed, Delayed, Cancelled`. **`driverPhone` 🔒 معلَّم بيانات شخصية في الـERD** — عمود `Bytes?` مشفّر عموديًا من أول migration، **بلا واجهة إدخال في هذه الشريحة**، نفس نمط `Company.bankAccountName`/`bankIBAN`/`bankSWIFT` بالظبط (آلية التشفير الفعلية pgcrypto/Supabase Vault قرار منفصل قبل أي إدخال حقيقي). `driverName` عادي (نص، مش بنفس درجة حساسية رقم الهاتف).
- **`Claim`**: كل الحقول زي الـERD بالظبط (11 قيمة enum لـ`claimType`، 10 لـ`status`). `claimDeadline` معلَّم ⚠️ في الـERD بس بلا نص إنفاذ مقرون بيه (عكس `aciSubmittedAt`/`revisedRulesWordingVerified`) — فمفيش Trigger، توثيق بيانات بس.

## 2. تبسيطات هندسية موثّقة (قرار واعي، مش تسيّب)

1. **`Shipment.readinessScore`/`riskScore` اتشالوا خالص** — نفس قرار `ComplianceCase` (`SCOPE-P5.md` §3 نقطة 1، "لا تُعطِ درجة موزونة بلا تبرير"). بترجعوا لما `ScoreSnapshot` (بند مؤجَّل مشترك) يتبني.
2. **`Shipment.aciDeadlineMet` مش DB generated column** — عمود `Boolean` عادي بيتحسب في `createShipment`/`updateShipmentAci` (`src/app/logistics/actions.ts`) من `aciSubmittedAt <= etd - interval '48 hours'`، نفس قرار `DealScenario.quantitySaleable` (`SCOPE-P2.md`، PG17.6 معقّد مع منطق زمني نسبي). الـTrigger على `Gate` بيقرا القيمة المخزَّنة مباشرة.
3. **`Booking.providerId`/`freightQuoteId` استرجعوا في الشريحة الرابعة** — كانوا اتشالوا هنا مؤقتًا (`ServiceProvider`/`FreightQuote` مؤجَّلين وقتها)، دلوقتي موجودين ومربوطين (راجع §1 "تفاصيل الشريحة الرابعة").
4. **`Container.weightUtilization`/`volumeUtilization`/`isOverweight` (⚙️) بيتحسبوا وقت العرض في الصفحة (`src/app/logistics/[id]/page.tsx`)، مش أعمدة مخزَّنة** — نفس نمط `FreeTimeRecord.chargeDays`/`ActualLogisticsCost.variance` تحت.
5. **`FreeTimeRecord.chargeDays` (⚙️) بيتحسب وقت العرض** من `startDate`/`endDate`/`freeDays` (`Math.max(0, days - freeDays)`) — مش عمود مخزَّن.
6. **`ActualLogisticsCost.variance` (⚙️) بيتحسب وقت العرض** (`actualAmount - expectedAmount`) — مش عمود مخزَّن.
7. **`ShipmentLot` اتبنى في الشريحة الخامسة (31 أغسطس)** — كان معلَّق رسميًا محتاج `Lot` من وحدة 7؛ بمجرد ما `Lot` اتبنى (وحدة 7 الشريحة الثانية)، اتفتح وقفلت وحدة 6 بالكامل. جدول وسيط بسيط (`shipmentId`→`Shipment`, `lotId`→`Lot`, `quantity`, `cartons`, `netWeight`, `grossWeight`) — بيسمح بالشحن الجزئي وSplit Container. بلا Trigger — الـERD مش بيحدد قيد عمل حرج صريح عليه، نفس فلسفة `ShipmentEvent`/`ActualLogisticsCost`/`RejectionCase`.
8. **`ServiceProvider`/`Route`/`FreightQuote`/`FreightQuoteLine` (الشريحة الرابعة)** — اتبنوا رغم غياب بيانات مزوّدين حقيقية وقت الكتابة (نفس سبب تأجيل `Competitor` في وحدة 1 أصلًا)، لأن المستخدم قرر إقفال الوحدة بالكامل. البنية جاهزة للاستخدام الفعلي أول ما تتوفر بيانات حقيقية.
9. **`TransportTrip.driverPhone` (⚙️ 🔒) مشفّر عموديًا بلا واجهة إدخال** — راجع "تفاصيل الشريحة الثالثة" فوق.
10. **الـ10 معالم الثابتة (`DEFAULT_MILESTONES` في `src/lib/logisticsLabels.ts`)** — Cargo Ready, Booking Confirmed, Empty Container Pickup, Loading Completed, VGM Submitted, Customs Cleared (Export), Gate-In, Vessel Departed, Destination Arrival, Delivered — بتتقترح تلقائيًا وقت إنشاء أي شحنة (`createShipment`)، بدل الـ32 معلم اليدوي في المواصفة الأصلية (نفس منطق `docs/ERD.md` §9 ملاحظة `Milestone`).

## 3. الإنفاذ الإلزامي المُنفَّذ فعليًا (غير قابل للتفاوض، من CLAUDE.md)

**Trigger رابع على `Gate`** (مع الثلاثة الموجودين من وحدة 5)، في `prisma/migrations/20260830260500_shipment_rls/migration.sql`:

- حقل جديد `Gate.requiresAciVerification Boolean @default(false)` (مش من الـERD الأصلي، نفس نمط `requiresOriginProofVerification`) — بيحدَّد وقت إنشاء بوابة الشحن/الإبحار.
- **`enforce_gate_aci_deadline_met`**: `Gate.status = 'Passed'`/`'PassedWithConditions'` على بوابة بعلامة `requiresAciVerification=true` محتاج مفيش `Shipment` بنفس `complianceCaseId` عنده `aciStatus != 'NotRequired'` و`aciDeadlineMet = false` — يقفل فجوة `Shipment.aciDeadlineMet` اللي كانت موثّقة كـ"لسه مش مُنفَّذة" في `SCOPE-P5.md` §4. القاعدة القانونية سارية فعليًا (CargoX/Nafeza ACI — بحري إلزامي من 2021، جوي إلزامي من يناير 2026).

**فلسفة الفحص** (نفس نمط `enforce_gate_origin_proof_verified`): بيفحص عدم وجود شحنة "غير متحقّقة" مرتبطة، مش بيشترط وجود شحنة "متحقّقة" أصلًا — لو مفيش شحنات مرتبطة خالص، البوابة بتعدّي بلا فحص إضافي (نفس المنطق المُتّبع مع `OriginProof`).

## 4. معيار "الشريحة الأولى مكتملة" (Acceptance)

1. إنشاء `Shipment` من صفحة ملف امتثال (`productId` بيتشتق من الصفقة، مش إدخال مستخدم) — بـ10 معالم تلقائية.
2. إضافة `ShipmentParty`/`Booking`/`Container` — واستغلال الوزن (`weightUtilization`) بيتحسب صح في العرض، وبيتلوّن أحمر لو تجاوز `maxPayload`.
3. تحديث حالة `Milestone` (Completed تلقائيًا بتاريخ اليوم لو مفيش `actualDate` مُدخل).
4. تحديث بيانات ACI (`acidNumber`/`aciStatus`/`aciSubmittedAt`) — `aciDeadlineMet` بيتحسب صح حسب `etd`.
5. إنشاء `Gate` بعلامة "تحقق مهلة ACI"، ومحاولة `Passed` قبل ما `aciDeadlineMet=true` — **يُرفض فعليًا على مستوى القاعدة**.
6. تحديث `aciSubmittedAt` ليحقق مهلة الـ48 ساعة، إعادة محاولة `Passed` — تنجح.

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (30 أغسطس 2026): فتح ملف امتثال لصفقة "Muster Import GmbH" معتمدة → إنشاء شحنة جوية (Cairo Airport ← Frankfurt Airport، ETD 2026-09-15) → 10 معالم ظهرت تلقائيًا → إضافة طرف (Buyer) وحاوية (netWeight=1200 > maxPayload=1000 → **120% تجاوز الوزن** ظهر صح بالأحمر) → تحديث معلم "Cargo Ready" لـCompleted → تحديث ACI لـSubmitted بتاريخ يفشل مهلة الـ48 ساعة → إنشاء بوابة "تحقق ACI" → محاولة Passed **ترفض فعليًا** برسالة عربي نضيفة → تحديث `aciSubmittedAt` ليحقق المهلة → إعادة المحاولة تنجح (البوابة "عدّت"). بيانات الاختبار اتنضّفت بالكامل.

## 5. معيار "الشريحة الثانية مكتملة" (Acceptance)

1. تسجيل `ShipmentEvent` على شحنة موجودة — يظهر في العرض بترتيب زمني عكسي.
2. تسجيل `LogisticsException` بخطورة عالية، وتحديث حالته لـ`Resolved` عبر فورم منفصل.
3. تسجيل `FreeTimeRecord` مرتبط بحاوية موجودة — `chargeDays` بيتحسب صح في العرض (`(endDate-startDate) - freeDays`)، وبيتلوّن أحمر لو موجب.
4. تسجيل `ActualLogisticsCost` — `variance` بيتحسب صح في العرض (`actualAmount - expectedAmount`)، أحمر لو تجاوز وأخضر لو وفّر.

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (30 أغسطس 2026): فتح ملف امتثال جديد لنفس الصفقة → إنشاء شحنة بحرية (Alexandria Port ← Rotterdam Port) → إضافة حاوية → تسجيل حدث "غادرت ميناء الإسكندرية" (ظهر بترتيب صح) → تسجيل استثناء "ازدحام الميناء" بخطورة عالية وتعرّض مالي 2500 وتأثير جدول 3 أيام → تحديث حالته لـ"تم الحل" → تسجيل `FreeTimeRecord` مرتبط بالحاوية (7 أيام سماح، 10 أيام فعلية → **3 أيام غرامة** ظهرت صح بالأحمر) → تسجيل `ActualLogisticsCost` (متوقع 1000، فعلي 1150 → **+150.00 USD فرق** ظهر صح بالأحمر). بيانات الاختبار اتنضّفت بالكامل.

## 6. معيار "الشريحة الثالثة مكتملة" (Acceptance)

1. تسجيل `TemperatureLog` مرتبط بحاوية بدرجة حرارة خارج النطاق (`isExcursion=true`) — يظهر بالأحمر مع Badge "تجاوز" في العرض.
2. تسجيل `TransportTrip` — بلا أي حقل لرقم هاتف السائق في الفورم (العمود موجود بالـschema بس مشفّر ومقفول).
3. تسجيل `Claim` بنوع `TemperatureDamage`، وتحديث حالته لـ`Settled` مع مبلغ تسوية.

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (30 أغسطس 2026): فتح ملف امتثال جديد لنفس الصفقة → إنشاء شحنة بحرية → إضافة حاوية → تسجيل قراءة حرارة -8°م بعلامة تجاوز (ظهرت بالأحمر + Badge "تجاوز") → تسجيل رحلة نقل بري (ناقل، رقم مركبة، اسم سائق — بلا حقل هاتف) → تسجيل مطالبة "تلف حراري" بمبلغ 3000 USD وآخر موعد → تحديث حالتها لـ"تمت التسوية" بمبلغ تسوية 2500 (ظهر Badge أخضر). ⚠️ أثناء التحقق، ظهر نفس gotcha #25 (سيرفر الـdev شايل نسخة قديمة من الـclient بعد `prisma generate` — الشحنة اتعملت فعليًا بس صفحة التفاصيل رمت خطأ لحد ما اتعمل `preview_stop`/`preview_start`). بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(35/35)/`next build` نضاف.

## 7. معيار "الشريحة الرابعة (تسعير الشحن) مكتملة" (Acceptance)

1. إنشاء `ServiceProvider` من `/logistics/providers`.
2. إنشاء `Route` من `/logistics/routes` (بوسائل نقل متعددة عبر checkboxes).
3. إنشاء `FreightQuote` من `/logistics/quotes` بربط `routeId`/`providerId` — الفورم بيختفي لو مفيش خطوط/مزوّدين مسجَّلين لسه.
4. إضافة `FreightQuoteLine` (سطرين على الأقل) — **`totalLogisticsCost` بيتحسب صح في `/logistics/quotes/[id]` والقائمة معًا** (مجموع السطرين).
5. اختيار `providerId` في `BookingForm` (من `/logistics/[id]`) — الحقل بيظهر بس لو فيه مزوّدين مسجَّلين، وبيتسجّل صح على `Booking`.

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (30 أغسطس 2026): إنشاء "Med Shipping Line" (ServiceProvider) → إنشاء خط "Alexandria Port ← Rotterdam Port" (Route، 18 يوم، بحري) → إنشاء `FreightQuote` بربطهم (mainFreight=1200 USD) → إضافة بندين (THC=150، BunkerSurcharge=80) → **الإجمالي المحسوب ظهر 230.00 USD صح** في صفحة التفاصيل وقائمة العروض معًا → فتح شحنة موجودة → اختيار "Med Shipping Line" في فورم الحجز → **الحجز اتسجّل وظهر "مزوّد الخدمة: Med Shipping Line" في جدول الحجوزات صح**. بيانات الاختبار اتنضّفت بالكامل (بالاسم/الميناء، مش الـID، تجنّبًا لأي فوات). `tsc --noEmit`/`test:rls`(39/39)/`next build` (بـ`NODE_OPTIONS=8192`، gotcha #27) نضاف للشرايح الأربعة كلها.

## 8. معيار "الشريحة الخامسة والأخيرة (`ShipmentLot`) مكتملة" (Acceptance)

1. `Lot` (وحدة 7) موجود بحالة `qualityStatus=Released`.
2. فتح شحنة موجودة (`/logistics/[id]`) → قسم "توزيع الدفعات (Lots)" جديد.
3. ربط الـ`Lot` بالشحنة بكمية/كراتين/أوزان — يظهر صح في الجدول.

**✅ مُختبر حيًا end-to-end بالكامل في المتصفح** (31 أغسطس 2026): فتح ملف امتثال جديد لصفقة "Muster Import GmbH" → إنشاء شحنة بحرية (Alexandria Port ← Rotterdam Port) → بناء سلسلة وحدة 7 كاملة (مورّد → منشأة → طلب توريد → عرض مورّد → أمر شراء → دفعة إنتاج → إفراج جودة → `Lot` بحالة Released) → فتح الشحنة → ربط الـ`Lot` بكمية 300 → **ظهر صح في جدول "توزيع الدفعات"**. بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(53/53)/`next build` (بـ`NODE_OPTIONS=8192`) نضاف.

**وحدة 6 قفلت بالكامل — 17 من 17 كيان.** ثاني وحدة تقفل بالكامل بعد وحدة 5 (9/9) — راجع `STATUS.md`.

## 8. ملفات جديدة

**الشريحة الأولى**:
- `src/lib/logisticsLabels.ts` — تسميات عربية موحّدة + `DEFAULT_MILESTONES`.
- `src/app/logistics/actions.ts` — `createShipment`, `updateShipmentAci`, `addShipmentParty`, `createBooking`, `addContainer`, `updateMilestone`.
- `src/app/logistics/ShipmentCreateForm.tsx` — فورم إنشاء شحنة (مُستخدَم من `compliance/[id]/page.tsx` مباشرة، مفيش صفحة `/logistics/new` منفصلة — نفس نمط `createComplianceCase`).
- `src/app/logistics/page.tsx` — قائمة الشحنات + فلترة بالحالة.
- `src/app/logistics/[id]/page.tsx` + `ShipmentAciForm.tsx`/`ShipmentPartyForm.tsx`/`BookingForm.tsx`/`ContainerForm.tsx`/`MilestoneStatusForm.tsx` — شاشة تفاصيل الشحنة.
- تعديلات على `src/app/compliance/[id]/page.tsx`/`GateForm.tsx`/`actions.ts` — قسم "الشحنات" جديد + checkbox `requiresAciVerification` + رسالة خطأ نضيفة في `decideGate`.
- صلاحيات جديدة (`Shipment.Create/View/Edit`, `Booking.Create`, `Container.Create`, `Milestone.Edit`) في `prisma/seed.ts` — أول استخدام فعلي لدور `LogisticsOfficer` (كان موجود بلا صلاحيات).

**الشريحة الثانية**:
- إضافات في `src/app/logistics/actions.ts`: `addShipmentEvent`, `createLogisticsException`, `updateLogisticsExceptionStatus`, `createFreeTimeRecord`, `createActualLogisticsCost`.
- `src/app/logistics/[id]/ShipmentEventForm.tsx`, `LogisticsExceptionForm.tsx`, `LogisticsExceptionStatusForm.tsx`, `FreeTimeRecordForm.tsx`, `ActualLogisticsCostForm.tsx` — 4 أقسام جديدة في `src/app/logistics/[id]/page.tsx` ("الأحداث"، "الاستثناءات اللوجستية"، "أيام السماح والغرامات"، "التكلفة الفعلية").
- إضافات في `src/lib/logisticsLabels.ts`: تسميات الأربعة كيانات الجديدة.
- صلاحيات جديدة (`ShipmentEvent.Create`, `LogisticsException.Create/Edit`, `FreeTimeRecord.Create`, `ActualLogisticsCost.Create`) في `prisma/seed.ts`.

**الشريحة الثالثة**:
- إضافات في `src/app/logistics/actions.ts`: `addTemperatureLog`, `createTransportTrip`, `createClaim`, `updateClaimStatus`.
- `src/app/logistics/[id]/TemperatureLogForm.tsx`, `TransportTripForm.tsx`, `ClaimForm.tsx`, `ClaimStatusForm.tsx` — 3 أقسام جديدة في `src/app/logistics/[id]/page.tsx` ("سجل درجة الحرارة"، "رحلات النقل البري"، "المطالبات").
- إضافات في `src/lib/logisticsLabels.ts`: تسميات `TransportTripStatus`/`ClaimType`/`ClaimStatus`.
- صلاحيات جديدة (`TemperatureLog.Create`, `TransportTrip.Create`, `Claim.Create/Edit`) في `prisma/seed.ts`.

**الشريحة الرابعة والأخيرة**:
- `src/app/logistics/providers/actions.ts`+`ServiceProviderForm.tsx`+`page.tsx` — `/logistics/providers`.
- `src/app/logistics/routes/actions.ts`+`RouteForm.tsx`+`page.tsx` — `/logistics/routes`.
- `src/app/logistics/quotes/actions.ts`+`FreightQuoteForm.tsx`+`page.tsx` — `/logistics/quotes` (قائمة + إنشاء).
- `src/app/logistics/quotes/[id]/page.tsx`+`FreightQuoteLineForm.tsx` — تفاصيل عرض السعر + بنود التكلفة + `totalLogisticsCost` المحسوب.
- تعديلات على `src/app/logistics/[id]/BookingForm.tsx`/`page.tsx`/`actions.ts` — select اختياري لـ`providerId`/`freightQuoteId` في فورم الحجز.
- تعديل `src/app/logistics/page.tsx` — 3 أزرار روابط ("مزوّدو الخدمة"، "خطوط الشحن"، "عروض الأسعار").
- إضافات في `src/lib/logisticsLabels.ts`: تسميات `ServiceProviderType/Status`, `RouteClassification`, `FreightQuoteStatus`, `FreightQuoteLineCategory`.
- صلاحيات جديدة (`ServiceProvider.Create/View`, `Route.Create/View`, `FreightQuote.Create/View`, `FreightQuoteLine.Create`) في `prisma/seed.ts`.

## 9. تحسين إضافي بعد الشريحة الثالثة — مؤشرات تحذير (30 أغسطس 2026)

البيانات التشغيلية اللي اتبنت في الشريحتين التانية والتالتة (استثناءات لوجستية، تجاوزات حرارة) كانت موجودة بس بلا أي إشارة تنبيه ظاهرة — لازم تفتح كل شحنة لوحدها عشان تعرف لو فيها مشكلة. اتحلّت بمؤشرين:

- **عمود "تنبيهات" جديد في `/logistics`** (`src/app/logistics/page.tsx`) — Badge أحمر "استثناء حرج" لو فيه `LogisticsException` مفتوح (`Open`/`InProgress`) بخطورة `High`/`Critical`، و"تجاوز حراري" لو فيه `TemperatureLog.isExcursion=true` مسجَّل.
- **Badge عدد في `Nav.tsx`/`NavMobileMenu.tsx` جنب رابط "اللوجستيات"** — نفس نمط `pendingApprovalsCount` الموجود لرابط "الموافقات"، بيحسب عدد الشحنات الفريدة (distinct) اللي عندها استثناء حرج مفتوح أو تجاوز حراري، ومحسوب بس لو المستخدم أصلًا عنده صلاحية `Shipment.View` (تجنّبًا لاستعلام إضافي بلا داعي على كل صفحة).

**✅ مُختبر حيًا**: شحنة تجريبية بـ`LogisticsException` بخطورة `Critical` → Badge "استثناء حرج" ظهر صح في عمود التنبيهات بـ`/logistics` + Badge "1" ظهر جنب رابط "اللوجستيات" في الـNav (تحقّق من نسخة الموبايل). بيانات الاختبار اتنضّفت بالكامل. `tsc --noEmit`/`test:rls`(35/35)/`next build` نضاف.
