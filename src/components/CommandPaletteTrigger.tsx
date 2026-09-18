"use client";

import { Search } from "lucide-react";

/** زرار مرئي يفتح CommandPalette (بيبعت CustomEvent، بدل ما يمسك حالة الفتح بنفسه) — نفس
 * الاختصار Cmd/Ctrl+K لمين مش عارف بيه. */
export default function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
      className="hidden items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted md:flex"
      aria-label="بحث سريع"
    >
      <Search className="size-3.5" />
      <span>بحث سريع</span>
      <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">Ctrl K</kbd>
    </button>
  );
}
