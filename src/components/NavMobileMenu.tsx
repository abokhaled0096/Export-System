"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavLink, NavSection } from "@/lib/navigation";

/**
 * قائمة الموبايل — نفس أقسام `navigation.ts` بالظبط، بس كأكورديون بدل قوايم منسدلة.
 *
 * القسم اللي فيه الصفحة الحالية بيفتح لوحده أول ما القائمة تتفتح، عشان المستخدم يلاقي
 * نفسه على طول بدل ما يفتح خمس أقسام يدوّر.
 */
export default function NavMobileMenu({
  sections,
  adminLinks,
  approvalLinks,
  badges,
  userLabel,
  onLogout,
}: {
  sections: NavSection[];
  adminLinks: NavLink[];
  approvalLinks: NavLink[];
  badges?: Record<string, number>;
  userLabel: string;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const inSection = (links: NavLink[]) => links.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));
  const activeSectionId = sections.find((s) => inSection(s.links))?.id ?? null;
  const [expanded, setExpanded] = useState<string | null>(activeSectionId);

  const allSections: NavSection[] = [
    ...sections,
    ...(approvalLinks.length > 0 ? [{ id: "approvals", label: "الموافقات", links: approvalLinks }] : []),
    ...(adminLinks.length > 0 ? [{ id: "admin", label: "الإدارة", links: adminLinks }] : []),
  ];

  const close = () => setOpen(false);

  return (
    <div className="ms-auto md:hidden">
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="القائمة">
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      {open && (
        <nav className="absolute inset-x-0 top-full max-h-[80vh] overflow-y-auto border-b border-border bg-background p-3">
          <Link
            href="/"
            onClick={close}
            className="flex rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            لوحة القيادة
          </Link>

          {allSections.map((section) => {
            const isOpen = expanded === section.id;
            const count = section.links.reduce((sum, l) => sum + (badges?.[l.href] ?? 0), 0);
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : section.id)}
                  aria-expanded={isOpen}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm",
                    inSection(section.links) ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {section.label}
                    {count > 0 && (
                      <Badge className="h-5 min-w-5 justify-center bg-rose-600 px-1 text-white hover:bg-rose-600">{count}</Badge>
                    )}
                  </span>
                  <ChevronDown className={cn("size-4 opacity-60 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="border-s border-border ms-4 ps-2">
                    {section.links.map((l) => {
                      const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
                      const linkCount = badges?.[l.href] ?? 0;
                      return (
                        <Link
                          key={l.href}
                          href={l.href}
                          onClick={close}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm hover:bg-muted hover:text-foreground",
                            active ? "font-medium text-primary" : "text-muted-foreground"
                          )}
                        >
                          {l.label}
                          {linkCount > 0 && (
                            <Badge className="h-5 min-w-5 justify-center bg-rose-600 px-1 text-white hover:bg-rose-600">
                              {linkCount}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <Link
            href="/notifications"
            onClick={close}
            className="flex rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            الإشعارات
          </Link>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <Link href="/account/mfa" onClick={close} className="text-sm text-muted-foreground hover:text-foreground">
              {userLabel}
            </Link>
            <form action={onLogout}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                خروج
              </Button>
            </form>
          </div>
        </nav>
      )}
    </div>
  );
}
