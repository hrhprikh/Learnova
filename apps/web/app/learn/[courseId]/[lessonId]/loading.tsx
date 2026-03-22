export default function LessonLoading() {
  return (
    <div className="h-screen bg-white flex overflow-hidden font-sans text-[var(--ink)]">
      <aside className="w-72 border-r border-[var(--edge)] p-4 space-y-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </aside>
      <div className="flex-1 p-8 space-y-6 bg-[#FCFBFA]">
        <div className="h-8 w-1/3 bg-gray-100 rounded animate-pulse" />
        <div className="aspect-video bg-gray-200 rounded-3xl animate-pulse" />
        <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  );
}
