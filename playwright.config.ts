import { defineConfig, devices } from "@playwright/test";

/**
 * E2E حقيقي بـPlaywright (BACKLOG.md § P3). بيشتغل على org الإنتاج الحقيقي على Supabase —
 * مفيش قاعدة بيانات تجريبية منفصلة للمشروع ده — فـglobal-setup.ts بينشئ مستخدم Admin تجريبي
 * جديد (نفس نمط createAuthUser المتّبع في كل التحقق اليدوي طول المشروع) وglobal-teardown.ts
 * بيمسحه بعد التستات، بلا أي أثر على بيانات إنتاج حقيقية.
 */
export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false, // مستخدم Admin واحد مشترك بين كل التستات — تشغيل متوازي هيسبب تضارب جلسات.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    storageState: "./e2e/.auth/state.json",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
