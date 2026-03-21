"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type CourseListItem = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  instructorName: string;
  tags: Array<{ id: string; tag: string }>;
  lessonCount: number;
  durationSeconds: number;
  published: boolean;
  price: number | null;
  accessRule: "OPEN" | "SIGNED_IN" | "PAYMENT" | "INVITATION";
};

type CoursesResponse = {
  courses: CourseListItem[];
};

type EnrolledResponse = {
  courses: Array<{
    id: string;
    progressStatus: "YET_TO_START" | "IN_PROGRESS" | "COMPLETED";
  }>;
};

export default function ExploreCoursesPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [enrolledStatusByCourse, setEnrolledStatusByCourse] = useState<
    Record<string, "YET_TO_START" | "IN_PROGRESS" | "COMPLETED">
  >({});

  useEffect(() => {
    let active = true;

    async function loadCourses() {
      const { data } = await getCurrentSession();
      const token = data.session?.access_token;

      if (active) {
        setSessionToken(token ?? null);
      }

      const response = await apiRequest<CoursesResponse>(`/courses?search=${encodeURIComponent(query)}`, { token });

      let enrolledMap: Record<string, "YET_TO_START" | "IN_PROGRESS" | "COMPLETED"> = {};
      if (token) {
        const enrolled = await apiRequest<EnrolledResponse>("/courses/enrolled", { token });
        enrolledMap = Object.fromEntries(
          enrolled.courses.map((course) => [course.id, course.progressStatus])
        );
      }

      if (active) {
        setCourses(response.courses);
        setEnrolledStatusByCourse(enrolledMap);
      }
    }

    loadCourses().catch(() => {
      if (active) {
        setCourses([]);
      }
    });

    return () => {
      active = false;
    };
  }, [query]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    courses.forEach(c => c.tags.forEach(t => tags.add(t.tag)));
    return Array.from(tags).sort();
  }, [courses]);

  const filteredCourses = useMemo(() => {
    if (!selectedTag) return courses;
    return courses.filter(c => c.tags.some(t => t.tag === selectedTag));
  }, [courses, selectedTag]);

  const totalHours = useMemo(
    () => Math.round(courses.reduce((acc, course) => acc + course.durationSeconds, 0) / 3600),
    [courses]
  );

  async function onEnroll(courseId: string) {
    if (!sessionToken) {
      router.push("/login");
      return;
    }

    try {
      await apiRequest(`/courses/${courseId}/enroll`, {
        method: "POST",
        token: sessionToken
      });

      setEnrolledStatusByCourse((previous) => ({
        ...previous,
        [courseId]: "YET_TO_START"
      }));
    } catch {
      // Keep catalog resilient even if enrollment fails; detail page surfaces server messages.
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12 lg:px-12 lg:py-16">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-14 gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--ink-soft)]">Catalog</p>
          <h1 className="font-heading text-5xl lg:text-6xl leading-[1.05] mt-2 tracking-tight">Expand Your Mind</h1>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <Link href="/dashboard" className="font-mono text-xs text-[var(--ink)] hover:text-[var(--accent-blue)] transition-colors flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-white border border-[var(--edge)] flex items-center justify-center group-hover:border-[var(--ink)]">
               <ArrowRight className="w-4 h-4" />
            </div>
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
        <aside className="lg:col-span-3">
          <div className="sticky top-12 space-y-10">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mb-4">Search Catalog</p>
              <div className="relative">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, instructor..."
                  className="w-full rounded-2xl border border-[var(--edge)] bg-white pl-4 pr-10 py-3 outline-none font-mono text-xs focus:border-[var(--ink)] transition-colors"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mb-4">Filter by Theme</p>
              <div className="flex flex-wrap lg:flex-col gap-2">
                <button 
                  onClick={() => setSelectedTag(null)}
                  className={`text-left px-4 py-2 rounded-xl text-xs font-mono transition-all ${!selectedTag ? "bg-[var(--ink)] text-white shadow-lg" : "bg-white border border-[var(--edge)] text-[var(--ink-soft)] hover:border-[var(--ink)]"}`}
                >
                  All Categories
                </button>
                {allTags.map(tag => (
                  <button 
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`text-left px-4 py-2 rounded-xl text-xs font-mono transition-all ${selectedTag === tag ? "bg-[var(--accent-blue)] text-white shadow-lg" : "bg-white border border-[var(--edge)] text-[var(--ink-soft)] hover:border-[var(--ink)]"}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[var(--ink)] text-white p-8 rounded-3xl relative overflow-hidden shadow-2xl">
              <h3 className="font-mono text-[10px] opacity-70 mb-6 tracking-widest uppercase">Community Stats</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-heading text-5xl font-semibold">{courses.length}</span>
                <span className="font-mono text-xs opacity-70">modules</span>
              </div>
              <p className="text-xs opacity-80 leading-relaxed font-mono mt-4">~{totalHours} hours of curated content available.</p>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-9">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredCourses.map((course) => {
              const status = enrolledStatusByCourse[course.id];

              return (
                <article
                  key={course.id}
                  className="group bg-white rounded-[2.5rem] border border-[var(--edge)] overflow-hidden hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] transition-all duration-500 flex flex-col"
                >
                  <div className="aspect-[16/9] relative overflow-hidden bg-gray-100">
                    {course.imageUrl ? (
                      <img src={course.imageUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--ink-soft)] font-mono text-[10px]">No Preview</div>
                    )}
                    <div className="absolute top-4 left-4 flex gap-2">
                      {course.tags.slice(0, 2).map((tag) => (
                        <span key={tag.id} className="px-3 py-1 bg-white/90 backdrop-blur-sm shadow-sm rounded-full font-mono text-[9px] uppercase tracking-wider text-[var(--ink)]">
                          {tag.tag}
                        </span>
                      ))}
                      <span className={`px-3 py-1 backdrop-blur-sm shadow-sm rounded-full font-mono text-[9px] uppercase tracking-widest font-bold ${course.accessRule === 'PAYMENT' ? 'bg-[var(--accent-peach)] text-white' : 'bg-white/90 text-[var(--ink)]'}`}>
                        {course.accessRule === 'PAYMENT' ? `$${course.price}` : 'Free'}
                      </span>
                    </div>
                  </div>

                  <div className="p-8 flex-1 flex flex-col">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-peach)] mb-3">{course.instructorName}</p>
                    <h3 className="font-heading text-2xl font-semibold mb-3 leading-tight group-hover:text-[var(--accent-blue)] transition-colors">{course.title}</h3>
                    <p className="text-[var(--ink-soft)] text-sm mb-8 line-clamp-2 leading-relaxed">{course.description ?? "Embark on this learning journey to master new skills and perspectives."}</p>
                    
                    <div className="mt-auto pt-6 border-t border-[var(--edge)]/50 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-[var(--ink-soft)] font-mono text-[10px]">
                        <span>{course.lessonCount} Lessons</span>
                        <span>{Math.round(course.durationSeconds / 60)}m</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link href={`/courses/${course.id}`} className="text-[var(--ink)] text-xs font-bold hover:underline transition-all">Details</Link>
                        {status ? (
                          <Link href={`/courses/${course.id}`} className="bg-[var(--ink)] text-white px-5 py-2.5 rounded-full text-[10px] font-bold shadow-lg hover:scale-105 active:scale-95 transition-all">
                            {status === "IN_PROGRESS" ? "Continue" : status === "COMPLETED" ? "Review" : "Start"}
                          </Link>
                        ) : (
                          <button onClick={() => onEnroll(course.id)} className="bg-[var(--ink)] text-white px-5 py-2.5 rounded-full text-[10px] font-bold shadow-lg hover:scale-105 active:scale-95 transition-all">
                            {sessionToken ? "Join" : "Login"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            {filteredCourses.length === 0 ? (
              <div className="col-span-full py-24 text-center">
                 <p className="text-[var(--ink-soft)] font-mono text-sm mb-4">No learning modules found matching your filters.</p>
                 <button onClick={() => { setQuery(""); setSelectedTag(null); }} className="text-[var(--accent-blue)] text-xs font-bold hover:underline">Clear all filters</button>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
