"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X } from "lucide-react";

type NavLink = { href: string; label: string };

export default function NavMobileMenu({
  links,
  canApprove,
  pendingApprovalsCount,
  logisticsAttentionCount,
  isRoleAdmin,
  userLabel,
  onLogout,
}: {
  links: NavLink[];
  canApprove: boolean;
  pendingApprovalsCount: number;
  logisticsAttentionCount: number;
  isRoleAdmin: boolean;
  userLabel: string;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ms-auto md:hidden">
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="القائمة">
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      {open && (
        <nav className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-border bg-background p-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {l.label}
              {l.href === "/logistics" && logisticsAttentionCount > 0 && (
                <Badge className="h-5 min-w-5 justify-center bg-rose-600 px-1 text-white hover:bg-rose-600">
                  {logisticsAttentionCount}
                </Badge>
              )}
            </Link>
          ))}
          {canApprove && (
            <Link
              href="/approvals"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              الموافقات
              {pendingApprovalsCount > 0 && (
                <Badge className="h-5 min-w-5 justify-center bg-rose-600 px-1 text-white hover:bg-rose-600">
                  {pendingApprovalsCount}
                </Badge>
              )}
            </Link>
          )}
          {isRoleAdmin && (
            <Link
              href="/admin/users"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              الأدوار
            </Link>
          )}
          {isRoleAdmin && (
            <Link
              href="/admin/audit-log"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              سجل التدقيق
            </Link>
          )}
          {isRoleAdmin && (
            <Link
              href="/admin/teams"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              الفرق
            </Link>
          )}
          {isRoleAdmin && (
            <Link
              href="/admin/errors"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              الأخطاء
            </Link>
          )}
          {isRoleAdmin && (
            <Link
              href="/admin/ai-settings"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              إعدادات AI
            </Link>
          )}
          {isRoleAdmin && (
            <Link
              href="/admin/accounting-settings"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              إعدادات المحاسبة
            </Link>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <Link
              href="/account/mfa"
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
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
