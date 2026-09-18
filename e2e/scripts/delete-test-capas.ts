import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

const ROOT_CAUSE = process.argv[2];

async function main() {
  if (!ROOT_CAUSE) throw new Error("usage: delete-test-capas.ts <rootCause>");
  const deleted = await prisma.cAPA.deleteMany({ where: { rootCause: ROOT_CAUSE } });
  console.log(`test CAPAs deleted: ${deleted.count}`);
}

main().finally(() => prisma.$disconnect());
