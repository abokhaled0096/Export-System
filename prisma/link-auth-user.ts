// يربط حساب Supabase Auth (اتعمل من الـDashboard: Authentication → Add User)
// بصف public.User — بلا حاجة لـservice_role key، لأن اتصالنا أصلًا بدور postgres
// قادر يقرأ سكيمة auth مباشرة.
//
// الاستخدام: npx tsx prisma/link-auth-user.ts <email> "<الاسم الكامل>" <Role>
// مثال:      npx tsx prisma/link-auth-user.ts admin@aboheiba.com "مدير النظام" Admin
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const VALID_ROLES = [
  "SalesRep",
  "SalesManager",
  "Finance",
  "ComplianceOfficer",
  "ProcurementOfficer",
  "QualityManager",
  "LogisticsOfficer",
  "CompanyOwner",
  "Admin",
] as const;

async function main() {
  const [email, fullName, role] = process.argv.slice(2);
  if (!email || !fullName || !role) {
    console.error('الاستخدام: npx tsx prisma/link-auth-user.ts <email> "<الاسم>" <Role>');
    console.error(`Role لازم يكون واحد من: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }
  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    console.error(`❌ Role غير صالح: ${role}. لازم يكون واحد من: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  const authUsers = await prisma.$queryRaw<{ id: string; email: string }[]>`
    SELECT id, email FROM auth.users WHERE email = ${email} LIMIT 1
  `;

  if (authUsers.length === 0) {
    console.error(
      `❌ مفيش حساب Supabase Auth بالإيميل ده. اعمله الأول من Dashboard → Authentication → Add User.`
    );
    process.exit(1);
  }

  const authUserId = authUsers[0].id;
  const org = await prisma.organization.findFirstOrThrow();
  const roleRow = await prisma.role.findFirstOrThrow({
    where: { orgId: org.id, name: role },
  });

  const user = await prisma.user.upsert({
    where: { id: authUserId },
    create: {
      id: authUserId,
      orgId: org.id,
      fullName,
      email,
      roleId: roleRow.id,
    },
    update: { fullName, roleId: roleRow.id },
    include: { role: true },
  });

  console.log(`✓ اترَبَط: ${user.email} (${user.role.name}) → ${user.id}`);
}

main()
  .catch((e) => {
    console.error("❌ فشل الربط:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
