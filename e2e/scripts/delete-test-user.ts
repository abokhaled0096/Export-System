import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import { deleteAuthUser } from "../../src/lib/authAdmin";

const ORG_ID = "01a03e31-14f2-7418-8a9e-ede6a898e6ad";
const E2E_USER_NAME = "E2E Test Admin";

async function main() {
  const admin = await prisma.user.findFirst({ where: { orgId: ORG_ID, fullName: E2E_USER_NAME } });
  if (admin) {
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => {});
    await deleteAuthUser(admin.id);
    console.log(`E2E test user deleted: ${admin.id}`);
  }
}

main().finally(() => prisma.$disconnect());
