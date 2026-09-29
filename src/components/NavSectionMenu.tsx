"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { NavLink } from "@/lib/navigation";

/**
 * قسم واحد في القائمة العلوية — زرار بيفتح قايمة منسدلة بروابط القسم.
 *
 * القسم بيتعلّم كنشط لو الصفحة الحالية جواه، عشان المستخدم يعرف هو فين من غير ما يفتح
 * القايمة. المطابقة بالبادئة (`startsWith`) مش بالتساوي، عشان صفحات التفاصيل
 * (`/deals/<id>`) تفضل مكرّمة لقسمها.
 */
export default function NavSectionMenu({
  label,
  links,
  badges,
}: {
  label: string;
  links: NavLink[];
  /** عدّادات تنبيه على روابط بعينها — المفتاح هو `href`. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const isActive = links.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));
  const sectionCount = links.reduce((sum, l) => sum + (badges?.[l.href] ?? 0), 0);

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm outline-none transition-colors",
          "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {sectionCount > 0 && (
          <Badge className="h-5 min-w-5 justify-center bg-rose-600 px-1 text-white hover:bg-rose-600">{sectionCount}</Badge>
        )}
        <ChevronDownIcon className="size-3.5 opacity-60" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="z-50">
          <Menu.Popup className="max-h-[70vh] min-w-52 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg outline-none">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              const count = badges?.[l.href] ?? 0;
              return (
                <Menu.Item
                  key={l.href}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm outline-none select-none",
                    "data-highlighted:bg-muted",
                    active ? "font-medium text-primary" : "text-foreground/80"
                  )}
                  render={<Link href={l.href} />}
                >
                  {l.label}
                  {count > 0 && (
                    <Badge className="h-5 min-w-5 justify-center bg-rose-600 px-1 text-white hover:bg-rose-600">{count}</Badge>
                  )}
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
