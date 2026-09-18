import { test, expect } from "@playwright/test";

test("Command Palette: فتح بالزرار، فلترة بالبحث، وتنقّل فعلي", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "بحث سريع" }).click();
  const input = page.getByPlaceholder("روح لأي صفحة...");
  await expect(input).toBeVisible();

  await input.fill("ضرائب");
  await expect(page.getByRole("button", { name: "الضرائب" })).toBeVisible();
  await expect(page.getByRole("button", { name: "المنتجات" })).not.toBeVisible();

  await page.getByRole("button", { name: "الضرائب" }).click();
  await expect(page).toHaveURL(/\/accounting\/tax-records/);
  // الـpalette لازم تتقفل تلقائيًا بعد التنقّل.
  await expect(input).not.toBeVisible();
});

test("Command Palette: Ctrl+K بيفتحها وEscape بيقفلها", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder("روح لأي صفحة...");

  await page.keyboard.press("Control+k");
  await expect(input).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(input).not.toBeVisible();
});
