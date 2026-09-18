import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/prisma";
import { createAuthUser } from "../../src/lib/authAdmin";

/** ⚠️ لازم يتشغّل بـ`tsx` مش بمحمّل Playwright نفسه — الـPrisma Client المولَّد ESM (`import.meta`)
 * وPlaywright بيحمّل ملفات globalSetup/globalTeardown بسياق مابيدعمش كده. نفس نمط باقي سكريبتات
 * الـscratch admin المستخدمة يدويًا طول الجلسة، بس مؤتمتة هنا. */
const ORG_ID = "01a03e31-14f2-7418-8a9e-ede6a898e6ad";
const ADMIN_ROLE_ID = "01a04325-de00-7fe6-85f3-a5a37919ed27";
export const E2E_USER_NAME = "E2E Test Admin";
export const E2E_PASSWORD = "E2ETestPass123!";

async function main() {
  const stale = await prisma.user.findFirst({ where: { orgId: ORG_ID, fullName: E2E_USER_NAME } });
  if (stale) {
    await prisma.user.delete({ where: { id: stale.id } }).catch(() => {});
  }

  const email = `e2e-${Date.now()}@test.local`;
  const { id } = await createAuthUser(email, E2E_PASSWORD);
  await prisma.user.create({
    data: { id, orgId: ORG_ID, roleId: ADMIN_ROLE_ID, fullName: E2E_USER_NAME, email, isActive: true },
  });

  const credsFile = path.join(__dirname, "..", ".auth", "credentials.json");
  fs.mkdirSync(path.dirname(credsFile), { recursive: true });
  fs.writeFileSync(credsFile, JSON.stringify({ id, email, password: E2E_PASSWORD }, null, 2));
  console.log(`E2E test user created: ${email}`);
}

main().finally(() => prisma.$disconnect());
