import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

// مسار عمل حرج حقيقي: انتقال حالة CAPA محكوم بجدول WorkflowDefinition على مستوى القاعدة
// (مش تعديل حر لأي حالة) — نفس فئة "مسار حرج" المذكورة في BACKLOG.md (زي acceptQuote).
const ROOT_CAUSE = "E2E اختبار انتقال CAPA";

test.afterEach(() => {
  // بيتشغّل كـsubprocess بـtsx — الـspec نفسه ميقدرش يستورد src/lib/prisma مباشرة (Prisma Client
  // المولَّد ESM، وPlaywright بيحمّل ملفات التستات بسياق مش متوافق — راجع e2e/global-setup.ts).
  execFileSync(process.execPath, [require.resolve("tsx/cli"), path.join(__dirname, "..", "scripts", "delete-test-capas.ts"), ROOT_CAUSE], {
    stdio: "inherit",
    cwd: path.join(__dirname, "..", ".."),
  });
});

test("CAPA: إنشاء وانتقال Open→InProgress→VerificationPending فعليًا", async ({ page }) => {
  await page.goto("/capa");

  await page.getByLabel("السبب الجذري").fill(ROOT_CAUSE);
  await page.getByLabel("الإجراء التصحيحي").fill("إجراء E2E");
  await page.getByRole("button", { name: "+ إجراء تصحيحي" }).click();

  await expect(page.getByText(ROOT_CAUSE)).toBeVisible();
  await page.getByText(ROOT_CAUSE).click();

  await expect(page.getByText("مفتوح", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "→ قيد التنفيذ" }).click();
  await expect(page.getByText("قيد التنفيذ", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "→ بانتظار التحقق" }).click();
  await expect(page.getByText("بانتظار التحقق", { exact: true })).toBeVisible();

  // مفيش زرار "→ مفتوح" (رجوع للخلف) — الانتقالات المسموحة أحادية الاتجاه، مفروضة على مستوى القاعدة.
  await expect(page.getByRole("button", { name: "→ مفتوح" })).toHaveCount(0);
});
