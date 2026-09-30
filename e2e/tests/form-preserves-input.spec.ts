import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

// React 19 بيعمل `form.reset()` تلقائيًا بعد أي `<form action={fn}>` — **حتى لو الحفظ فشل**.
// يعني رسالة «الحقل الفلاني مطلوب» كانت بتيجي ومعاها فورم اتمسح بالكامل. اتكشف بتجربة فورم
// هدف المبيعات (1 أكتوبر) وكان بيأثّر على ١٤٩ فورم. الإصلاح في src/components/ui/form.tsx.
//
// الاختبار ده لازم يكون e2e مش وحدة: السلوك ده بتاع React/DOM حقيقي (توقيت الـreset مقابل
// الـeffect)، ومايتقاسش من غير متصفح فعلي.
const PERIOD = "E2E-FORM-KEEP";

test.afterEach(() => {
  // subprocess بـtsx — نفس سبب capa-workflow.spec.ts (Prisma Client المولَّد ESM).
  execFileSync(process.execPath, [require.resolve("tsx/cli"), path.join(__dirname, "..", "scripts", "delete-test-sales-targets.ts"), PERIOD], {
    stdio: "inherit",
    cwd: path.join(__dirname, "..", ".."),
  });
});

test("الفورم بيحافظ على اللي المستخدم كتبه لما الحفظ يفشل، وبيتفضّى لما ينجح", async ({ page }) => {
  await page.goto("/sales-targets");
  await page.getByRole("button", { name: "+ هدف مبيعات" }).click();

  const period = page.getByPlaceholder("2026-Q4");
  const targetValue = page.getByLabel("القيمة المستهدفة");

  await period.fill(PERIOD);
  await page.getByLabel("من (لحساب الفعلي)").fill("2026-09-01");
  await page.getByLabel("إلى (لحساب الفعلي)").fill("2026-09-30");
  await targetValue.fill("0"); // هيفشل: القيمة لازم تكون موجبة

  await page.getByRole("button", { name: "+ هدف", exact: true }).click();
  await expect(page.getByText("القيمة المستهدفة مطلوبة")).toBeVisible();

  // ⚠️ جوهر الاختبار: الحقول التانية لازم تفضل زي ما هي بعد الفشل.
  await expect(period).toHaveValue(PERIOD);
  await expect(page.getByLabel("من (لحساب الفعلي)")).toHaveValue("2026-09-01");
  await expect(page.getByLabel("إلى (لحساب الفعلي)")).toHaveValue("2026-09-30");

  // وعند النجاح الفورم بيتفضّى زي الأول (السلوك ده مقصود ومش المفروض يتغيّر).
  await targetValue.fill("5000");
  await page.getByRole("button", { name: "+ هدف", exact: true }).click();
  await expect(page.getByRole("cell", { name: PERIOD })).toBeVisible();
});
