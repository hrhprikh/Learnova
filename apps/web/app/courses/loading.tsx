export default function CoursesLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12 lg:px-12 lg:py-16">
      <div className="h-12 w-72 bg-white rounded animate-pulse mb-12" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
        <aside className="lg:col-span-3 space-y-4">
          <div className="h-24 bg-white rounded-3xl border border-[var(--edge)] animate-pulse" />
          <div className="h-72 bg-white rounded-3xl border border-[var(--edge)] animate-pulse" />
        </aside>
        <section className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={index} className="bg-white rounded-[2.5rem] border border-[var(--edge)] overflow-hidden animate-pulse">
              <div className="aspect-[16/9] bg-gray-100" />
              <div className="p-8 space-y-4">
                <div className="h-3 w-1/3 bg-gray-100 rounded" />
                <div className="h-8 w-3/4 bg-gray-100 rounded" />
                <div className="h-3 w-full bg-gray-100 rounded" />
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
