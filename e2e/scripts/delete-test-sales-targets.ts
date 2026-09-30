import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

const PERIOD = process.argv[2];

async function main() {
  if (!PERIOD) throw new Error("usage: delete-test-sales-targets.ts <period>");
  const deleted = await prisma.salesTarget.deleteMany({ where: { period: PERIOD } });
  console.log(`test sales targets deleted: ${deleted.count}`);
}

main().finally(() => prisma.$disconnect());
