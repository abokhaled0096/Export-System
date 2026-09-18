import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// بلا storageState المشترك — الهدف هنا اختبار فورم الدخول نفسه، مش الاعتماد على جلسة جاهزة.
test.use({ storageState: { cookies: [], origins: [] } });

const credsFile = path.join(__dirname, "..", ".auth", "credentials.json");
const { email, password } = JSON.parse(fs.readFileSync(credsFile, "utf-8"));

test("تسجيل دخول صحيح يوصل للوحة القيادة", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox").first().fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "لوحة القيادة" })).toBeVisible();
});

test("كلمة سر غلط بترفض وتفضل في صفحة الدخول", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox").first().fill(email);
  await page.locator('input[type="password"]').fill("WrongPassword123!");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();

  // مفيش تنقّل للوحة القيادة — لسه في صفحة الدخول برسالة خطأ.
  await expect(page).toHaveURL(/\/login/);
});
