import { chromium, type FullConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const authFile = path.join(__dirname, ".auth", "state.json");
const credsFile = path.join(__dirname, ".auth", "credentials.json");

export default async function globalSetup(config: FullConfig) {
  // بيتشغّل كـsubprocess بـtsx — راجع تعليق create-test-user.ts لسبب الفصل ده. node مباشرة على
  // tsx/cli (بلا npx/shell) عشان مسار المشروع فيه مسافات ("Abu Heiba Export System") وshell:true
  // على Windows مابيعملش quote صحيح للمسارات دي.
  execFileSync(process.execPath, [require.resolve("tsx/cli"), path.join(__dirname, "scripts", "create-test-user.ts")], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });

  const { email, password } = JSON.parse(fs.readFileSync(credsFile, "utf-8"));

  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByRole("textbox").first().fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForURL(baseURL + "/");
  await page.context().storageState({ path: authFile });
  await browser.close();
}
