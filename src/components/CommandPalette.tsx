"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export type NavLink = { href: string; label: string };

/** Command Palette (BACKLOG.md § P3) — Cmd/Ctrl+K من أي صفحة. قائمة الروابط بتوصل جاهزة من
 * Nav.tsx (Server Component) بعد فلترة الصلاحيات هناك بالظبط — نفس الروابط اللي المستخدم شايفها
 * في القائمة العلوية، مفيش قائمة مستقلة تتفلتر لوحدها وتنحرف عن صلاحيات الوصول الفعلية. */
export default function CommandPalette({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function openPalette() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          openPalette();
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    // زرار مرئي في الهيدر (CommandPaletteTrigger) بيفتح الـpalette بنفس آلية الاختصار، لمين
    // مش عارف Cmd/Ctrl+K أو بيستخدم الموبايل.
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", openPalette);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", openPalette);
    };
  }, [open]);

  // التركيز على مربع البحث لما الـpalette تتفتح — أثر جانبي على الـDOM (مش setState)، مسموح جوه Effect.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const trimmed = query.trim();
  const filtered = trimmed
    ? links.filter((l) => l.label.includes(trimmed) || l.href.toLowerCase().includes(trimmed.toLowerCase()))
    : links;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[activeIndex];
      if (target) go(target.href);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="التنقّل السريع"
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="روح لأي صفحة..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">مفيش نتيجة.</p>
          ) : (
            filtered.map((l, i) => (
              <button
                key={l.href}
                type="button"
                onClick={() => go(l.href)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`block w-full rounded-lg px-3 py-2 text-right text-sm ${
                  i === activeIndex ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted"
                }`}
              >
                {l.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
