"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { searchEverything, type SearchHit } from "@/app/search-actions";

export type NavLink = { href: string; label: string };

/** صف واحد في القائمة — إما صفحة أو سجل من البيانات. */
type Row = { href: string; label: string; kind: string | null; subtitle: string | null };

const DEBOUNCE_MS = 220;
const MIN_QUERY = 2;

/** Command Palette (BACKLOG.md § P3) — Cmd/Ctrl+K من أي صفحة.
 *
 * بيدوّر في حاجتين: **الصفحات** (قائمة جاهزة من Nav.tsx بعد فلترة الصلاحيات هناك بالظبط،
 * فمفيش قائمة مستقلة تنحرف عن صلاحيات الوصول الفعلية)، و**البيانات نفسها** (عملاء،
 * منتجات، فواتير، موردين، فرص) عبر `searchEverything` اللي بيفحص الصلاحيات على السيرفر.
 *
 * قبل كده كان بيفلتر أسماء الصفحات بس — شكله بحث لكن مابيلاقيش عميل باسمه ولا فاتورة
 * برقمها، وده أكتر حاجة بتتعمل يوميًا. */
export default function CommandPalette({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  // النتائج متخزّنة مع الاستعلام اللي جابها — كده نعرف نميّز النتيجة البايتة عن الحالية
  // من غير ما نفضّيها بـsetState جوه الـeffect (react-hooks/set-state-in-effect).
  const [hits, setHits] = useState<{ query: string; results: SearchHit[] }>({ query: "", results: [] });
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function openPalette() {
    setQuery("");
    setActiveIndex(0);
    setHits({ query: "", results: [] });
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

  // البحث في البيانات — مؤجَّل عشان ما نضربش السيرفر مع كل حرف.
  const trimmed = query.trim();
  useEffect(() => {
    if (!open || trimmed.length < MIN_QUERY) return;
    // `cancelled` بيمنع نتيجة استعلام قديم إنها تكتب فوق نتيجة أحدث لو وصلت متأخرة.
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchEverything(trimmed);
        if (!cancelled) setHits({ query: trimmed, results });
      } catch {
        // فشل البحث مايوقّفش التنقّل بين الصفحات — بنسجّل الاستعلام بنتيجة فاضية عشان
        // مؤشّر التحميل يقف بدل ما يفضل لفّ للأبد.
        if (!cancelled) setHits({ query: trimmed, results: [] });
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, trimmed]);

  if (!open) return null;

  const pageRows: Row[] = (
    trimmed ? links.filter((l) => l.label.includes(trimmed) || l.href.toLowerCase().includes(trimmed.toLowerCase())) : links
  ).map((l) => ({ href: l.href, label: l.label, kind: null, subtitle: null }));

  // النتائج بتتعرض بس لو هي بتاعة الاستعلام الحالي — يعني نتيجة استعلام قديم مابتظهرش.
  const fresh = hits.query === trimmed ? hits.results : [];
  const searching = trimmed.length >= MIN_QUERY && hits.query !== trimmed;
  const dataRows: Row[] = fresh.map((h) => ({ href: h.href, label: h.title, kind: h.kind, subtitle: h.subtitle }));

  // البيانات الأول: لما حد يكتب اسم عميل، هو عايز العميل مش صفحة اسمها قريبة منه.
  const rows = [...dataRows, ...pageRows];

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = rows[activeIndex];
      if (target) go(target.href);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="البحث السريع"
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
            placeholder="دوّر على عميل أو منتج أو فاتورة، أو روح لأي صفحة..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searching && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {searching ? "بيدوّر..." : trimmed.length === 1 ? "اكتب حرفين على الأقل للبحث في البيانات." : "مفيش نتيجة."}
            </p>
          ) : (
            rows.map((r, i) => (
              <button
                key={`${r.kind ?? "page"}-${r.href}`}
                type="button"
                onClick={() => go(r.href)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm ${
                  i === activeIndex ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted"
                }`}
              >
                {r.kind && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.kind}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-right">{r.label}</span>
                {r.subtitle && <span className="shrink-0 truncate text-xs text-muted-foreground">{r.subtitle}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
