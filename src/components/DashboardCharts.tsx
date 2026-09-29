"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { MonthlyRevenue, StageCount } from "@/lib/dashboard";
import { opportunityStageLabel } from "@/lib/opportunityLabels";
import { formatNumber } from "@/lib/format";

/**
 * رسوم لوحة القيادة. Client Component لأن Recharts محتاج DOM.
 *
 * ⚠️ الأرقام بتوصل هنا كـ`number` عادي مش `Prisma.Decimal` — الـDecimal مابيعديش حدود
 * الـRSC (نفس العيب اللي عطّل صفحة الصفقة في 19 سبتمبر). التحويل بيحصل في `dashboard.ts`.
 */

const BRAND = "#7A0F3D";
const BRAND_SOFT = "#C9A7B8";

function EmptyChart({ message }: { message: string }) {
  return <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">{message}</div>;
}

export function RevenueChart({ data, currency }: { data: MonthlyRevenue[]; currency: string }) {
  const hasData = data.some((d) => d.revenue !== 0);
  if (!hasData) return <EmptyChart message="مفيش إيراد مرحَّل في آخر ٦ شهور." />;

  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#737373" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "#737373" }}
          axisLine={false}
          tickLine={false}
          width={70}
          tickFormatter={(v: number) => formatNumber(v, 0)}
          orientation="right"
        />
        <Tooltip
          formatter={(v) => [`${formatNumber(Number(v))} ${currency}`, "الإيراد"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12, direction: "rtl" }}
          cursor={{ fill: "rgba(122,15,61,0.06)" }}
        />
        <Bar dataKey="revenue" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StageChart({ data }: { data: StageCount[] }) {
  if (data.length === 0) return <EmptyChart message="مفيش فرص مسجّلة لسه." />;

  const rows = [...data]
    .sort((a, b) => b.count - a.count)
    .map((d) => ({ ...d, label: opportunityStageLabel[d.stage] ?? d.stage }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(224, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 12, fill: "#525252" }}
          axisLine={false}
          tickLine={false}
          width={110}
          orientation="right"
        />
        <Tooltip
          formatter={(v) => [`${Number(v)}`, "عدد الفرص"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12, direction: "rtl" }}
          cursor={{ fill: "rgba(122,15,61,0.06)" }}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {rows.map((_, i) => (
            <Cell key={i} fill={i === 0 ? BRAND : BRAND_SOFT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
