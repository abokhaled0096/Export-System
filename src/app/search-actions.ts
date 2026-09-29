"use server";

import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope } from "@/lib/permissions";
import { Prisma } from "@/generated/prisma/client";
import { opportunityStageLabel } from "@/lib/opportunityLabels";

/**
 * البحث في البيانات للـCommand Palette (Cmd/Ctrl+K).
 *
 * قبل كده الـpalette كانت بتفلتر **أسماء الصفحات** بس — بتبان كأنها بحث لكن مابتلاقيش
 * عميل باسمه ولا فاتورة برقمها. ده أكتر شيء بيتعمل يوميًا في أي نظام حقيقي.
 *
 * **الأمان**: الاستعلامات كلها عبر `getScopedPrisma()` فعزل المنظمة مفروض بالـRLS على
 * مستوى القاعدة. وفوق كده بنفحص صلاحية `View` لكل نوع على حدة ونتخطّى اللي المستخدم
 * مايقدرش يشوفه — ومع نطاق `Own` بنفلتر بالمالك، عشان البحث ما يبقاش قناة جانبية
 * تسرّب وجود سجلات المستخدم أصلًا مش مفروض يشوفها.
 */

export type SearchHit = {
  id: string;
  /** نوع السجل بالعربي — بيظهر كشارة جنب النتيجة. */
  kind: string;
  title: string;
  subtitle: string | null;
  href: string;
};

const PER_TYPE = 5;
const MAX_RESULTS = 20;

export async function searchEverything(rawQuery: string): Promise<SearchHit[]> {
  const q = rawQuery.trim();
  // حرفين على الأقل — حرف واحد بيرجّع نص القاعدة بلا فايدة.
  if (q.length < 2) return [];

  const user = await requireCurrentUser();
  const prisma = await getScopedPrisma();
  const contains = { contains: q, mode: Prisma.QueryMode.insensitive } as const;
  const hits: SearchHit[] = [];

  // ⚠️ كل الاستعلامات متسلسلة مش Promise.all — راجع BACKLOG.md (P2028).

  // ---------- الشركات/العملاء ----------
  const companyScope = await getPermissionScope(user.roleId, "Company", "View");
  if (companyScope) {
    const rows = await prisma.company.findMany({
      where: {
        orgId: user.orgId,
        deletedAt: null,
        ...(companyScope === "Own" ? { ownerId: user.id } : {}),
        OR: [{ legalName: contains }, { country: contains }],
      },
      select: { id: true, legalName: true, country: true },
      take: PER_TYPE,
      orderBy: { legalName: "asc" },
    });
    hits.push(...rows.map((c) => ({ id: c.id, kind: "شركة", title: c.legalName, subtitle: c.country, href: `/companies/${c.id}` })));
  }

  // ---------- المنتجات ----------
  const productScope = await getPermissionScope(user.roleId, "Product", "View");
  if (productScope) {
    const rows = await prisma.product.findMany({
      where: {
        orgId: user.orgId,
        deletedAt: null,
        OR: [{ nameAr: contains }, { nameEn: contains }, { hsCode: contains }],
      },
      select: { id: true, nameAr: true, nameEn: true, hsCode: true },
      take: PER_TYPE,
      orderBy: { nameAr: "asc" },
    });
    hits.push(
      ...rows.map((p) => ({ id: p.id, kind: "منتج", title: p.nameAr, subtitle: `${p.nameEn} · HS ${p.hsCode}`, href: `/products/${p.id}` }))
    );
  }

  // ---------- الفواتير ----------
  const invoiceScope = await getPermissionScope(user.roleId, "Invoice", "View");
  if (invoiceScope) {
    const rows = await prisma.invoice.findMany({
      where: { orgId: user.orgId, invoiceNumber: contains },
      select: { id: true, invoiceNumber: true, totalAmount: true, currency: true },
      take: PER_TYPE,
      orderBy: { invoiceNumber: "desc" },
    });
    hits.push(
      ...rows.map((i) => ({
        id: i.id,
        kind: "فاتورة",
        title: i.invoiceNumber,
        subtitle: `${i.totalAmount.toFixed(2)} ${i.currency}`,
        href: `/accounting/invoices/${i.id}`,
      }))
    );
  }

  // ---------- الموردين ----------
  const supplierScope = await getPermissionScope(user.roleId, "Supplier", "View");
  if (supplierScope) {
    const rows = await prisma.supplier.findMany({
      where: { orgId: user.orgId, deletedAt: null, OR: [{ legalName: contains }, { country: contains }] },
      select: { id: true, legalName: true, country: true },
      take: PER_TYPE,
      orderBy: { legalName: "asc" },
    });
    hits.push(...rows.map((s) => ({ id: s.id, kind: "مورّد", title: s.legalName, subtitle: s.country, href: `/suppliers/${s.id}` })));
  }

  // ---------- الفرص ----------
  const oppScope = await getPermissionScope(user.roleId, "Opportunity", "View");
  if (oppScope) {
    const rows = await prisma.opportunity.findMany({
      where: {
        orgId: user.orgId,
        deletedAt: null,
        ...(oppScope === "Own" ? { ownerId: user.id } : {}),
        OR: [{ company: { legalName: contains } }, { product: { nameAr: contains } }],
      },
      select: { id: true, stage: true, company: { select: { legalName: true } }, product: { select: { nameAr: true } } },
      take: PER_TYPE,
      orderBy: { createdAt: "desc" },
    });
    hits.push(
      ...rows.map((o) => ({
        id: o.id,
        kind: "فرصة",
        title: `${o.company.legalName} — ${o.product.nameAr}`,
        subtitle: opportunityStageLabel[o.stage] ?? o.stage,
        href: `/opportunities/${o.id}`,
      }))
    );
  }

  return hits.slice(0, MAX_RESULTS);
}
