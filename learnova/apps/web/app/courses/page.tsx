"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type CourseListItem = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  tags: Array<{ id: string; tag: string }>;
  lessonCount: number;
  durationSeconds: number;
  published: boolean;
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
      <header className="flex justify-between items-center mb-14">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--ink-soft)]">Catalog</p>
          <h1 className="font-heading text-5xl lg:text-6xl leading-[1.05] mt-2">Explore Learning Modules</h1>
        </div>
        <Link href="/dashboard" className="font-mono text-xs text-[var(--ink)] hover:text-[var(--accent-blue)] transition-colors flex items-center gap-1">
          Back to Dashboard <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <section className="lg:col-span-8">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title"
            className="w-full rounded-2xl border border-[var(--edge)] bg-white px-4 py-3 outline-none font-mono text-sm"
          />

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {courses.map((course, index) => {
              const status = enrolledStatusByCourse[course.id];

              return (
                <article
                  key={course.id}
                  className={`group bg-white p-6 rounded-2xl border border-[var(--edge)] hover:shadow-[0_20px_40px_-15px_rgba(26,28,41,0.05)] hover:-translate-y-1 transition-all duration-300 ${index % 2 === 0 ? "md:-translate-y-4" : ""}`}
                >
                  <div className="inline-block px-2 py-1 bg-[#f2f0eb] text-[var(--ink-soft)] font-mono text-[10px] uppercase tracking-wider rounded mb-4">
                    {course.published ? "Published" : "Draft"}
                  </div>
                  <h3 className="font-heading text-2xl font-medium mb-3 group-hover:text-[var(--accent-blue)] transition-colors">{course.title}</h3>
                  <p className="text-[var(--ink-soft)] text-sm mb-6 line-clamp-2">{course.description ?? "No description"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="mono-tag">{course.lessonCount} lessons</span>
                    <span className="mono-tag">{Math.round(course.durationSeconds / 60)} min</span>
                    {course.tags.map((tag) => (
                      <span key={tag.id} className="mono-tag">{tag.tag}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link href={`/courses/${course.id}`} className="floating-link inline-flex">View course</Link>
                    {status ? (
                      <Link href={`/courses/${course.id}`} className="action-chip inline-flex">
                        {status === "IN_PROGRESS" ? "Continue" : status === "COMPLETED" ? "Review" : "Start"}
                      </Link>
                    ) : (
                      <button onClick={() => onEnroll(course.id)} className="action-chip">
                        {sessionToken ? "Join course" : "Login to join"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            {courses.length === 0 ? <p className="text-[var(--ink-soft)]">No courses found.</p> : null}
          </div>
        </section>

        <aside className="lg:col-span-4 lg:pl-8">
          <div className="sticky top-12 flex flex-col gap-6">
            <div className="bg-[var(--ink)] text-white p-8 rounded-3xl relative overflow-hidden">
              <h3 className="font-mono text-xs opacity-70 mb-6 tracking-widest uppercase">Catalog Summary</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-heading text-5xl font-semibold">{courses.length}</span>
                <span className="font-mono text-sm opacity-70">courses</span>
              </div>
              <p className="text-sm opacity-80 leading-relaxed">Total duration around {totalHours} hours across currently listed modules.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
