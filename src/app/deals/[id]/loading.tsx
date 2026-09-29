export default function DealDetailLoading() {
  return (
    <main className="mx-auto max-w-5xl animate-pulse px-6 py-10">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="mt-3 h-7 w-64 rounded bg-muted" />
      <div className="mt-2 h-4 w-40 rounded bg-muted" />

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mt-8">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="mt-3 h-32 rounded-xl border border-border bg-card" />
        </div>
      ))}
    
    </main>
  );
}
