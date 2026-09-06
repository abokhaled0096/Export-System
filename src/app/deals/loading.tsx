export default function DealsLoading() {
  const columns = 5;
  return (
    <main className="mx-auto max-w-7xl animate-pulse px-6 py-10">
      <div className="h-7 w-32 rounded bg-muted" />
      <div className="mt-2 h-4 w-24 rounded bg-muted" />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border bg-card" />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-5">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl border-t-4 border-t-muted bg-muted/40 p-3" />
        ))}
      </div>
    </main>
  );
}
