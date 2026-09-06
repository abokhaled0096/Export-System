-- Optimistic Locking على DealScenario — راجع STATUS.md § Optimistic Locking و CLAUDE.md.
-- بديل "آخر واحد يحفظ بيكسب من غير تحذير" لو اتنين فتحوا نفس السيناريو وعدّلوا في نفس اللحظة.
ALTER TABLE "DealScenario" ADD COLUMN "lockVersion" INTEGER NOT NULL DEFAULT 0;
