-- بوليصة الشحن (Bill of Lading) وشهادة الفحص قبل الشحن (Certificate of Inspection — طرف ثالث
-- زي SGS/Bureau Veritas بيفحص شحنة معيّنة قبل التحميل، مختلفة عن Inspection/QualityRelease
-- الداخلية في وحدة الجودة، ومختلفة عن Certificate العامة (اعتمادات شركة/منشأة زي HACCP، مش
-- مستند خاص بشحنة واحدة) — طلب صريح من المستخدم ضمن مستندات التصدير القياسية.
-- Document عنده shipmentId اختياري بالفعل، مناسب تمامًا للنوعين دول بلا أي عمود إضافي.
ALTER TYPE "DocumentType" ADD VALUE 'BillOfLading';
ALTER TYPE "DocumentType" ADD VALUE 'InspectionCertificate';
