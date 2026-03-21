"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Award, BookOpen, Clock, TrendingUp, GraduationCap } from "lucide-react";
import { ProtectedPage } from "@/components/protected-page";
import { NotificationBell } from "@/components/NotificationBell";
import { UserProfileMenu } from "@/components/user-profile-menu";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

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

type AuthoredCourse = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  tags: Array<{ id: string; tag: string }>;
  attendeesCount?: number;
  completedCount?: number;
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
  const [profile, setProfile] = useState<MeResponse["user"]>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [authoredCourses, setAuthoredCourses] = useState<AuthoredCourse[]>([]);
  const [summary, setSummary] = useState<ProgressSummaryResponse["summary"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

        const isInstructor = response.user?.role === "INSTRUCTOR" || response.user?.role === "ADMIN";

        if (isInstructor) {
          const mineResponse = await apiRequest<{ courses: AuthoredCourse[] }>("/courses?mine=true", { token });
          if (active) {
            setProfile(response.user);
            setAuthoredCourses(mineResponse.courses);
          }
        } else {
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
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load profile");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const roleLabel = profile?.role?.toLowerCase() ?? "workspace";

  if (isLoading) {
    return (
      <ProtectedPage>
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[var(--ink)] flex items-center justify-center animate-pulse">
            <span className="text-white font-mono text-xl font-bold">L</span>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  if (profile?.role === "INSTRUCTOR" || profile?.role === "ADMIN") {
    const totalStudents = authoredCourses.reduce((acc, c) => acc + (c.attendeesCount ?? 0), 0);
    const totalCompleted = authoredCourses.reduce((acc, c) => acc + (c.completedCount ?? 0), 0);
    const avgGraduation = totalStudents > 0 ? Math.round((totalCompleted / totalStudents) * 100) : 0;

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
              <Link href="/backoffice" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">Instructor Lab</Link>
            </nav>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <div className="px-3 py-1.5 rounded-full bg-white/70 border border-[var(--edge)] font-mono text-xs flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-[var(--accent-peach)]" />
                <span>{roleLabel}</span>
                <span className="text-[var(--ink-soft)] ml-2">{profile?.totalPoints ?? 0} pts</span>
              </div>
              <UserProfileMenu fullNameSeed={profile?.fullName ?? "Instructor"} />
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-8 flex flex-col gap-12">
              <section>
                <h1 className="font-heading text-5xl lg:text-7xl font-semibold leading-[1.1] text-[var(--ink)] mb-6">
                  {`Morning, ${profile?.fullName}.`}
                </h1>
                <p className="font-mono text-sm text-[var(--ink-soft)] max-w-md leading-relaxed">
                  Instructor console. Track your course performance, enrollments, and completion rates.
                </p>
              </section>

              <section className="relative mt-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-heading text-2xl font-medium">Your Modules</h2>
                  <Link href="/backoffice" className="font-mono text-xs text-[var(--ink)] hover:text-[var(--accent-blue)] transition-colors flex items-center gap-1">
                    Manage <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                  {authoredCourses.length > 0 ? authoredCourses.slice(0, 4).map((course, index) => (
                    <Link
                      key={course.id}
                      href={`/backoffice/courses/${course.id}`}
                      className={`group bg-white p-6 rounded-2xl border border-[var(--edge)] hover:shadow-[0_20px_40px_-15px_rgba(26,28,41,0.05)] hover:-translate-y-1 transition-all duration-300 ${index % 2 === 0 ? "md:-translate-y-4" : ""}`}
                    >
                      <div className={`inline-block px-2 py-1 font-mono text-[10px] uppercase tracking-wider rounded mb-4 ${course.published ? "bg-[#f2f0eb] text-[var(--ink-soft)]" : "bg-[var(--accent-peach)]/20 text-[var(--ink)]"}`}>
                        {course.published ? "Published" : "Draft"}
                      </div>
                      <h3 className="font-heading text-2xl font-medium mb-3 group-hover:text-[var(--accent-blue)] transition-colors">{course.title}</h3>
                      <p className="text-[var(--ink-soft)] text-sm mb-8 line-clamp-2">{course.description ?? "No description"}</p>

                      <div className="mt-auto border-t border-[var(--edge)]/40 pt-4 flex items-center justify-between font-mono text-xs text-[var(--ink-soft)]">
                        <span>{course.attendeesCount ?? 0} Students</span>
                        <span>{course.attendeesCount ? Math.round(((course.completedCount ?? 0) / course.attendeesCount) * 100) : 0}% Graduated</span>
                      </div>
                    </Link>
                  )) : (
                    <article className="bg-white p-6 rounded-2xl border border-[var(--edge)] md:col-span-2">
                      <h3 className="font-heading text-2xl">No modules built yet</h3>
                      <p className="text-[var(--ink-soft)] text-sm mt-2">Create your first course to start teaching.</p>
                      <Link href="/backoffice" className="action-chip mt-4 inline-flex">Go to Lab</Link>
                    </article>
                  )}
                </div>
              </section>
            </div>

            <div className="lg:col-span-4 lg:pl-8">
              <div className="sticky top-12 flex flex-col gap-6">
                <div className="bg-[var(--ink)] text-white p-8 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                  <h3 className="font-mono text-xs opacity-70 mb-6 tracking-widest uppercase">Global Impact</h3>

                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-heading text-5xl font-semibold">{totalStudents}</span>
                    <span className="font-mono text-sm opacity-70">students</span>
                  </div>
                  <p className="text-sm opacity-80 leading-relaxed mb-8">
                    Total completions across all modules: {totalCompleted}.
                  </p>

                  <div className="flex items-center gap-4 text-sm font-mono border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between w-full">
                      <span className="opacity-70">Average completion rate</span>
                      <span className="font-medium text-[var(--accent-peach)]">{avgGraduation}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[var(--edge)] p-6 rounded-3xl">
                  <h3 className="font-mono text-xs text-[var(--ink-soft)] mb-6 tracking-widest uppercase">Profile</h3>
                  <ul className="flex flex-col gap-4 text-sm text-[var(--ink)]">
                    <li className="border-b border-[var(--edge)]/60 pb-3">{profile.email}</li>
                    <li className="border-b border-[var(--edge)]/60 pb-3 font-semibold">{profile.role}</li>
                    <li>Member since {new Date(profile.createdAt).toLocaleDateString()}</li>
                  </ul>
                </div>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  // Calculate rank based on totalPoints
  const rank = profile?.currentBadge ??
               ((profile?.totalPoints ?? 0) < 20 ? "Newbie" :
               (profile?.totalPoints ?? 0) < 40 ? "Explorer" :
               (profile?.totalPoints ?? 0) < 60 ? "Achiever" :
               (profile?.totalPoints ?? 0) < 80 ? "Specialist" :
               (profile?.totalPoints ?? 0) < 100 ? "Expert" :
               "Master");

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
          </nav>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="px-3 py-1.5 rounded-full bg-white/70 border border-[var(--edge)] font-mono text-xs flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
              <span className="text-[var(--ink-soft)]">Rank:</span>
              <span className="font-bold text-[var(--ink)]">{rank}</span>
            </div>
            <UserProfileMenu fullNameSeed={profile?.fullName ?? "Learner"} />
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
              <div className="bg-[var(--ink)] text-white p-8 rounded-3xl relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                <h3 className="font-mono text-[10px] opacity-70 mb-6 tracking-widest uppercase">Badge Progression</h3>
                
                <div className="space-y-6">
                  {/* Badge Progress Bar */}
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="font-heading text-4xl font-black">{profile?.totalPoints ?? 0} <span className="text-xs font-mono opacity-50 uppercase tracking-widest">Points</span></span>
                      <span className="font-mono text-[10px] opacity-70 uppercase">Next Rank at {
                        (profile?.totalPoints ?? 0) < 20 ? 20 : 
                        (profile?.totalPoints ?? 0) < 40 ? 40 : 
                        (profile?.totalPoints ?? 0) < 60 ? 60 : 
                        (profile?.totalPoints ?? 0) < 80 ? 80 : 
                        (profile?.totalPoints ?? 0) < 100 ? 100 : 120
                      }</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-peach)] transition-all duration-1000"
                        style={{ width: `${Math.min(((profile?.totalPoints ?? 0) / 120) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Badge Tiers */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: "Newbie", pts: 20 },
                      { name: "Explorer", pts: 40 },
                      { name: "Achiever", pts: 60 },
                      { name: "Specialist", pts: 80 },
                      { name: "Expert", pts: 100 },
                      { name: "Master", pts: 120 }
                    ].map((tier) => {
                      const isUnlocked = (profile?.totalPoints ?? 0) >= tier.pts;
                      return (
                        <div 
                          key={tier.name}
                          className={`p-3 rounded-2xl border transition-all ${isUnlocked ? "bg-white/10 border-white/20" : "bg-black/20 border-white/5 opacity-40"}`}
                        >
                          <p className="font-heading text-[10px] font-bold mb-1 truncate">{tier.name}</p>
                          <p className="font-mono text-[8px] opacity-50">{tier.pts}pts</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-[var(--accent-peach)]" />
                  </div>
                  <p className="text-[10px] font-mono opacity-70 leading-snug">
                    Complete quizzes to earn points and climb the ranks.
                  </p>
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
