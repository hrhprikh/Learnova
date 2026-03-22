export default function CourseDetailLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] pb-24">
      <header className="px-6 py-8 lg:px-12 flex items-center justify-between">
        <div className="h-5 w-36 bg-white rounded animate-pulse" />
        <div className="h-8 w-20 bg-white rounded animate-pulse" />
      </header>
      <main className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
          <div className="lg:col-span-7 space-y-6">
            <div className="aspect-video bg-white rounded-3xl animate-pulse" />
            <div className="h-12 w-2/3 bg-white rounded animate-pulse" />
            <div className="h-4 w-full bg-white rounded animate-pulse" />
          </div>
          <div className="lg:col-span-5 h-72 bg-white border border-[var(--edge)] rounded-3xl animate-pulse" />
        </div>
      </main>
    </div>
  );
}
