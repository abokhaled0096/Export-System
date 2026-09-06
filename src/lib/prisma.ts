import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// نمط singleton قياسي لـNext.js — يمنع فتح اتصالات جديدة مع كل Hot Reload في التطوير.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// max:1 كان Workaround مؤقت لعدم استقرار قاعدة التطوير المحلية (npx prisma dev) —
// اتشال بعد الانتقال لـSupabase الحقيقي (pgbouncer transaction pooler بيدير التعدد فعليًا).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
