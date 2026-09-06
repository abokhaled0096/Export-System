-- بيانات الكيان اللي هيتعمل بعد الموافقة (زي Quote تحت walkAwayPrice) — راجع
-- src/app/approvals/actions.ts و Approval.payload في prisma/schema.prisma.
ALTER TABLE "Approval" ADD COLUMN     "payload" JSONB;
