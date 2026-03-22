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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enrolledStatusByCourse, setEnrolledStatusByCourse] = useState<
    Record<string, "YET_TO_START" | "IN_PROGRESS" | "COMPLETED">
  >({});

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);

    return () => {
      clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data } = await getCurrentSession();
      if (active) {
        setSessionToken(data.session?.access_token ?? null);
      }
    }

    loadSession().catch(() => {
      if (active) {
        setSessionToken(null);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCourses() {
      setIsLoading(true);
      const [response, enrolled] = await Promise.all([
        apiRequest<CoursesResponse>(`/courses?search=${encodeURIComponent(debouncedQuery)}`, {
          token: sessionToken ?? undefined,
          cacheTtlMs: 20000
        }),
        sessionToken
          ? apiRequest<EnrolledResponse>("/courses/enrolled", { token: sessionToken, cacheTtlMs: 10000 })
          : Promise.resolve<EnrolledResponse>({ courses: [] })
      ]);

      const enrolledMap = Object.fromEntries(
        enrolled.courses.map((course) => [course.id, course.progressStatus])
      );

      if (active) {
        setCourses(response.courses);
        setEnrolledStatusByCourse(enrolledMap);
        setIsLoading(false);
      }
    }

    loadCourses().catch(() => {
      if (active) {
        setCourses([]);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [debouncedQuery, sessionToken]);

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
                  className={`text-left px-4 py-2 rounded-xl text-xs font-mono border transition-all ${!selectedTag ? "bg-[#1E1E1E] border-[#1E1E1E] text-white" : "bg-white border-[#EAE7E2] text-[#6B6B6B] hover:border-[#1E1E1E] hover:text-[#1E1E1E]"}`}
                >
                  All Categories
                </button>
                {allTags.map(tag => (
                  <button 
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`text-left px-4 py-2 rounded-xl text-xs font-mono border transition-all ${selectedTag === tag ? "bg-[#1E1E1E] border-[#1E1E1E] text-white" : "bg-white border-[#EAE7E2] text-[#6B6B6B] hover:border-[#1E1E1E] hover:text-[#1E1E1E]"}`}
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
                  className="group bg-white rounded-[2rem] border border-[var(--edge)] overflow-hidden hover:shadow-[0_24px_48px_-22px_rgba(0,0,0,0.16)] transition-all duration-300 flex flex-col"
                >
                  <div className="aspect-[16/9] relative overflow-hidden bg-gray-100">
                    {course.imageUrl ? (
                      <img src={course.imageUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--ink-soft)] font-mono text-[10px]">No Preview</div>
                    )}
                    <div className="absolute top-4 left-4 flex flex-wrap gap-2.5 pr-4">
                      {course.tags.slice(0, 2).map((tag) => (
                        <span key={tag.id} className="px-4 py-1.5 bg-white/90 backdrop-blur-sm shadow-sm rounded-full font-mono text-xs uppercase tracking-wider text-[var(--ink)] font-semibold">
                          {tag.tag}
                        </span>
                      ))}
                      <span className={`px-4 py-1.5 backdrop-blur-sm shadow-sm rounded-full font-mono text-xs uppercase tracking-widest font-bold ${course.accessRule === 'PAYMENT' ? 'bg-[var(--accent-peach)] text-white' : 'bg-white/90 text-[var(--ink)]'}`}>
                        {course.accessRule === 'PAYMENT' ? `$${course.price}` : 'Free'}
                      </span>
                    </div>
                  </div>

                  <div className="p-7 lg:p-8 flex-1 flex flex-col">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent-peach)] mb-3">{course.instructorName}</p>
                    <h3 className="font-heading text-2xl font-semibold mb-3 leading-tight group-hover:text-[var(--accent-blue)] transition-colors">{course.title}</h3>
                    <p className="text-[var(--ink-soft)] text-sm mb-7 line-clamp-2 leading-relaxed min-h-[3rem]">{course.description ?? "Embark on this learning journey to master new skills and perspectives."}</p>
                    
                    <div className="mt-auto pt-5 border-t border-[var(--edge)]/60 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4 text-[var(--ink-soft)] font-mono text-xs">
                        <span>{course.lessonCount} lessons</span>
                        <span>{Math.round(course.durationSeconds / 60)} min</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Link
                          href={`/courses/${course.id}`}
                          className="inline-flex h-10 px-4 items-center justify-center rounded-xl border border-[#D9D7D2] text-sm font-semibold text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[#F6F5F2] transition-colors"
                        >
                          View details
                        </Link>
                        {status ? (
                          <Link
                            href={`/courses/${course.id}`}
                            className="inline-flex h-10 px-5 items-center justify-center rounded-xl bg-[var(--ink)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                          >
                            {status === "IN_PROGRESS" ? "Continue" : status === "COMPLETED" ? "Review" : "Start now"}
                          </Link>
                        ) : (
                          <button
                            onClick={() => onEnroll(course.id)}
                            className="inline-flex h-10 px-5 items-center justify-center rounded-xl bg-[var(--ink)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                          >
                            {sessionToken ? "Join" : "Login"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            {isLoading && filteredCourses.length === 0 ? (
              Array.from({ length: 4 }).map((_, index) => (
                <article
                  key={`loading-${index}`}
                  className="bg-white rounded-[2.5rem] border border-[var(--edge)] overflow-hidden animate-pulse"
                >
                  <div className="aspect-[16/9] bg-gray-100" />
                  <div className="p-8 space-y-4">
                    <div className="h-3 w-1/3 bg-gray-100 rounded" />
                    <div className="h-8 w-3/4 bg-gray-100 rounded" />
                    <div className="h-3 w-full bg-gray-100 rounded" />
                    <div className="h-3 w-5/6 bg-gray-100 rounded" />
                    <div className="pt-4 border-t border-[var(--edge)]/50 flex items-center justify-between">
                      <div className="h-3 w-24 bg-gray-100 rounded" />
                      <div className="h-9 w-20 bg-gray-100 rounded-full" />
                    </div>
                  </div>
                </article>
              ))
            ) : null}
            {filteredCourses.length === 0 && !isLoading ? (
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
