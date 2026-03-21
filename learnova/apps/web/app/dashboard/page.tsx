"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Award, BookOpen, Clock, TrendingUp } from "lucide-react";
import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { getCurrentSession, signOutSession } from "@/lib/supabase-auth";

type MeResponse = {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: "ADMIN" | "INSTRUCTOR" | "LEARNER";
    totalPoints: number;
    currentBadge: string | null;
    createdAt: string;
  } | null;
};

type CourseSummary = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  tags: Array<{ id: string; tag: string }>;
  progressPercent: number;
  progressStatus: "YET_TO_START" | "IN_PROGRESS" | "COMPLETED";
};

type CoursesResponse = {
  courses: CourseSummary[];
};

type ProgressSummaryResponse = {
  summary: {
    totalCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    yetToStartCourses: number;
  };
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<MeResponse["user"]>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [summary, setSummary] = useState<ProgressSummaryResponse["summary"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const { data } = await getCurrentSession();
        const token = data.session?.access_token;
        if (!token) {
          throw new Error("No active session found.");
        }

        const response = await apiRequest<MeResponse>("/users/me", {
          token
        });

        const courseResponse = await apiRequest<CoursesResponse>("/courses/enrolled", {
          token
        });

        const progressSummary = await apiRequest<ProgressSummaryResponse>("/progress/summary", {
          token
        });

        if (active) {
          setProfile(response.user);
          setCourses(courseResponse.courses.slice(0, 3));
          setSummary(progressSummary.summary);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load profile");
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function onSignOut() {
    await signOutSession();
    router.replace("/login");
  }

  const roleLabel = profile?.role?.toLowerCase() ?? "workspace";

  return (
    <ProtectedPage>
      <div className="max-w-[1400px] mx-auto px-6 py-12 lg:px-12 lg:py-16">
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--ink)] flex items-center justify-center">
              <span className="text-white font-mono text-sm font-bold">L</span>
            </div>
            <span className="font-heading font-semibold text-xl tracking-tight">Learnova</span>
          </div>
          <nav className="flex items-center gap-8 font-mono text-sm">
            <Link href="/dashboard" className="text-[var(--ink)] border-b border-[var(--ink)] pb-1">Dashboard</Link>
            <Link href="/courses" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">Explore</Link>
            {(profile?.role === "ADMIN" || profile?.role === "INSTRUCTOR") ? (
              <Link href="/backoffice" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">Instructor Lab</Link>
            ) : null}
          </nav>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 rounded-full bg-white/70 border border-[var(--edge)] font-mono text-xs flex items-center gap-2">
              <Award className="w-3.5 h-3.5 text-[var(--accent-peach)]" />
              <span>{profile?.currentBadge ?? roleLabel}</span>
              <span className="text-[var(--ink-soft)] ml-2">{profile?.totalPoints ?? 0} pts</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#f2f0eb] overflow-hidden border border-[var(--edge)]">
              <img
                src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(profile?.fullName ?? "Learner")}&backgroundColor=F8F7F4`}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <button onClick={onSignOut} className="floating-link">Sign out</button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-8 flex flex-col gap-12">
            <section>
              <h1 className="font-heading text-5xl lg:text-7xl font-semibold leading-[1.1] text-[var(--ink)] mb-6">
                {profile ? `Morning, ${profile.fullName}.` : "Welcome to your workspace."}
              </h1>
              <p className="font-mono text-sm text-[var(--ink-soft)] max-w-md leading-relaxed">
                Enrolled courses: {summary?.totalCourses ?? 0}. Active now: {summary?.inProgressCourses ?? 0}. Keep the streak moving.
              </p>
            </section>

            <section className="relative mt-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-heading text-2xl font-medium">Active Modules</h2>
                <Link href="/courses" className="font-mono text-xs text-[var(--ink)] hover:text-[var(--accent-blue)] transition-colors flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                {courses.length > 0 ? courses.map((course, index) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className={`group bg-white p-6 rounded-2xl border border-[var(--edge)] hover:shadow-[0_20px_40px_-15px_rgba(26,28,41,0.05)] hover:-translate-y-1 transition-all duration-300 ${index % 2 === 0 ? "md:-translate-y-4" : ""}`}
                  >
                    <div className={`inline-block px-2 py-1 font-mono text-[10px] uppercase tracking-wider rounded mb-4 ${course.progressStatus === "IN_PROGRESS" ? "bg-[var(--accent-peach)]/20 text-[var(--ink)]" : "bg-[#f2f0eb] text-[var(--ink-soft)]"}`}>
                      {course.progressStatus === "IN_PROGRESS" ? "In Progress" : course.progressStatus === "COMPLETED" ? "Completed" : "Next Up"}
                    </div>
                    <h3 className="font-heading text-2xl font-medium mb-3 group-hover:text-[var(--accent-blue)] transition-colors">{course.title}</h3>
                    <p className="text-[var(--ink-soft)] text-sm mb-8 line-clamp-2">{course.description ?? "Continue your learning journey."}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full bg-[#f2f0eb] border-2 border-white flex items-center justify-center relative z-20"><BookOpen className="w-3 h-3 text-[var(--ink-soft)]" /></div>
                        <div className="w-6 h-6 rounded-full bg-[#f2f0eb] border-2 border-white flex items-center justify-center relative z-10"><Clock className="w-3 h-3 text-[var(--ink-soft)]" /></div>
                      </div>
                      <span className="font-mono text-xs">{course.progressPercent}%</span>
                    </div>
                    <div className="relative w-full h-[2px] bg-[#f2f0eb] mt-3 rounded-full overflow-hidden">
                      <div className="absolute top-0 left-0 h-full bg-[var(--ink)]" style={{ width: `${course.progressPercent}%` }} />
                    </div>
                  </Link>
                )) : (
                  <article className="bg-white p-6 rounded-2xl border border-[var(--edge)] md:col-span-2">
                    <h3 className="font-heading text-2xl">No active modules yet</h3>
                    <p className="text-[var(--ink-soft)] text-sm mt-2">Explore and enroll in a course to start your path.</p>
                    <Link href="/courses" className="action-chip mt-4 inline-flex">Explore courses</Link>
                  </article>
                )}
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 lg:pl-8">
            <div className="sticky top-12 flex flex-col gap-6">
              <div className="bg-[var(--ink)] text-white p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                <h3 className="font-mono text-xs opacity-70 mb-6 tracking-widest uppercase">Weekly Activity</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-heading text-5xl font-semibold">{summary?.inProgressCourses ?? 0}</span>
                  <span className="font-mono text-sm opacity-70">active</span>
                </div>
                <p className="text-sm opacity-80 leading-relaxed mb-8">
                  Completed courses: {summary?.completedCourses ?? 0}. Yet to start: {summary?.yetToStartCourses ?? 0}.
                </p>
                <div className="flex items-center gap-4 text-sm font-mono border-t border-white/10 pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[var(--accent-peach)]" />
                    <span>Learning momentum</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[var(--edge)] p-6 rounded-3xl">
                <h3 className="font-mono text-xs text-[var(--ink-soft)] mb-6 tracking-widest uppercase">Profile</h3>
                {profile ? (
                  <ul className="flex flex-col gap-4 text-sm text-[var(--ink)]">
                    <li className="border-b border-[var(--edge)]/60 pb-3">{profile.email}</li>
                    <li className="border-b border-[var(--edge)]/60 pb-3">{profile.role}</li>
                    <li>Member since {new Date(profile.createdAt).toLocaleDateString()}</li>
                  </ul>
                ) : (
                  <p className="text-[var(--ink-soft)] text-sm">Loading profile...</p>
                )}
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
