"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Award, BookOpen, Clock, GraduationCap, LogOut } from "lucide-react";
import { ProtectedPage } from "@/components/protected-page";
import { NotificationBell } from "@/components/NotificationBell";
import { UserProfileMenu } from "@/components/user-profile-menu";
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
  accessRule: "OPEN" | "SIGNED_IN" | "PAYMENT" | "INVITATION";
  price: number | null;
  published: boolean;
  tags: Array<{ id: string; tag: string }>;
  enrolledAt: string;
  progressPercent: number;
  progressStatus: "YET_TO_START" | "IN_PROGRESS" | "COMPLETED";
  certificateCode: string | null;
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
  const router = useRouter();
  const [profile, setProfile] = useState<MeResponse["user"]>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [authoredCourses, setAuthoredCourses] = useState<AuthoredCourse[]>([]);
  const [summary, setSummary] = useState<ProgressSummaryResponse["summary"] | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
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
            setCourses(courseResponse.courses);
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
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    courses.forEach((course) => {
      course.tags.forEach((tag) => tags.add(tag.tag));
    });
    return Array.from(tags).sort();
  }, [courses]);

  const filteredCourses = useMemo(() => {
    if (selectedTag === "ALL") {
      return courses;
    }
    return courses.filter((course) => course.tags.some((tag) => tag.tag === selectedTag));
  }, [courses, selectedTag]);

  async function onSignOut() {
    await signOutSession();
    router.replace("/login");
  }

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
                  {authoredCourses.length > 0 ? authoredCourses.slice(0, 4).map((course) => (
                    <Link
                      key={course.id}
                      href={`/backoffice/courses/${course.id}`}
                      className="group bg-white p-6 rounded-2xl border border-[var(--edge)] hover:shadow-[0_20px_40px_-15px_rgba(26,28,41,0.05)] hover:-translate-y-1 transition-all duration-300 h-full flex flex-col"
                    >
                      <div className={`inline-block px-2 py-1 font-mono text-[10px] uppercase tracking-wider rounded mb-4 ${course.published ? "bg-[#f2f0eb] text-[var(--ink-soft)]" : "bg-[var(--accent-peach)]/20 text-[var(--ink)]"}`}>
                        {course.published ? "Published" : "Draft"}
                      </div>
                      <h3 className="font-heading text-2xl font-medium mb-3 group-hover:text-[var(--accent-blue)] transition-colors">{course.title}</h3>
                      <p className="text-[var(--ink-soft)] text-sm mb-8 line-clamp-2 min-h-[2.5rem]">{course.description ?? "No description"}</p>

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

  const completedCourses = filteredCourses.filter((course) => course.progressStatus === "COMPLETED");
  const pendingCourses = filteredCourses.filter((course) => course.progressStatus !== "COMPLETED");
  const pointsTarget = 120;
  const pointsProgress = Math.min(((profile?.totalPoints ?? 0) / pointsTarget) * 100, 100);

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
          <div className="lg:col-span-8 flex flex-col gap-8">
            <section>
              <h1 className="font-heading text-5xl lg:text-7xl font-semibold leading-[1.1] text-[var(--ink)] mb-4">
                {profile ? `Morning, ${profile.fullName}.` : "Welcome."}
              </h1>
              <p className="font-mono text-sm text-[var(--ink-soft)] max-w-2xl leading-relaxed">
                Track everything in one place: purchased and joined courses, what's completed, what's pending, and quick certificate downloads.
              </p>
            </section>

            <section className="bg-white/50 border border-white/60 rounded-3xl p-6 backdrop-blur-xl shadow-[0_12px_35px_-24px_rgba(26,28,41,0.35)]">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="font-heading text-2xl font-medium">Course Filters</h2>
                <Link href="/courses" className="font-mono text-xs text-[var(--ink)] hover:text-[var(--accent-blue)] transition-colors flex items-center gap-1">
                  Explore More <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTag("ALL")}
                  className={`px-3 py-1.5 rounded-full font-mono text-[10px] border transition-colors ${selectedTag === "ALL" ? "bg-[var(--ink)] text-white border-[var(--ink)]" : "bg-white border-[var(--edge)] text-[var(--ink-soft)] hover:border-[var(--ink)]"}`}
                >
                  All Tags
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`px-3 py-1.5 rounded-full font-mono text-[10px] border transition-colors ${selectedTag === tag ? "bg-[var(--ink)] text-white border-[var(--ink)]" : "bg-white border-[var(--edge)] text-[var(--ink-soft)] hover:border-[var(--ink)]"}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white/50 border border-white/60 rounded-3xl p-6 backdrop-blur-xl shadow-[0_12px_35px_-24px_rgba(26,28,41,0.35)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-heading text-2xl">Completed Courses</h3>
                <span className="font-mono text-xs text-[var(--ink-soft)]">{completedCourses.length}</span>
              </div>

              {completedCourses.length === 0 ? (
                <p className="text-sm text-[var(--ink-soft)]">No completed courses for this filter.</p>
              ) : (
                <div className="space-y-3">
                  {completedCourses.map((course) => (
                    <article key={course.id} className="rounded-2xl border border-white/70 p-4 bg-white/55 backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="font-semibold text-lg leading-tight">{course.title}</p>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                          {course.accessRule === "PAYMENT" ? `Purchased${course.price ? ` $${course.price}` : ""}` : "Joined"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link href={`/courses/${course.id}`} className="text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent-blue)] transition-colors">
                          Open
                        </Link>
                        {course.certificateCode ? (
                          <Link
                            href={`/courses/${course.id}/certificate?download=1`}
                            target="_blank"
                            className="rounded-xl border border-[var(--edge)] bg-white px-3 py-2 text-[10px] font-semibold hover:border-[var(--ink)] transition-colors"
                          >
                            Download Certificate
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white/50 border border-white/60 rounded-3xl p-6 backdrop-blur-xl shadow-[0_12px_35px_-24px_rgba(26,28,41,0.35)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-heading text-2xl">Pending Courses</h3>
                <span className="font-mono text-xs text-[var(--ink-soft)]">{pendingCourses.length}</span>
              </div>

              {pendingCourses.length === 0 ? (
                <p className="text-sm text-[var(--ink-soft)]">No pending courses for this filter.</p>
              ) : (
                <div className="space-y-3">
                  {pendingCourses.map((course) => (
                    <article key={course.id} className="rounded-2xl border border-white/70 p-4 bg-white/55 backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="font-semibold text-lg leading-tight">{course.title}</p>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                          {course.progressStatus === "IN_PROGRESS" ? "In Progress" : "Yet To Start"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[var(--ink-soft)]">{course.progressPercent}%</span>
                        <Link href={`/courses/${course.id}`} className="rounded-xl bg-[var(--ink)] text-white px-3 py-2 text-[10px] font-semibold hover:opacity-90 transition-opacity">
                          Continue
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-4 lg:pl-8">
            <div className="sticky top-12 space-y-5">
              <div className="rounded-3xl border border-[#EAE7E2] bg-[#F7F6F4] text-[#1E1E1E] p-6">
                <p className="font-mono text-[11px] tracking-widest uppercase text-[#6B6B6B] mb-4">My Profile</p>
                <div className="mx-auto w-[230px] h-[230px] rounded-full border border-[#EAE7E2] p-3 flex items-center justify-center">
                  <div
                    className="w-full h-full rounded-full p-3 flex items-center justify-center"
                    style={{ background: `conic-gradient(#3B82F6 ${pointsProgress}%, #EAE7E2 ${pointsProgress}% 100%)` }}
                  >
                    <div className="w-full h-full rounded-full border border-[#EAE7E2] bg-[radial-gradient(circle_at_35%_35%,#FFFFFF,#EEF2FF)] flex flex-col items-center justify-center text-center px-6">
                      <p className="text-[#6B6B6B] text-sm">Total {(profile?.totalPoints ?? 0)} Points</p>
                      <p className="font-heading text-4xl mt-2 text-[#8B5CF6]">{rank}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#FFFFFF] rounded-3xl border border-[#EAE7E2] p-5 shadow-[0_12px_28px_-24px_rgba(30,30,30,0.18)]">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#6B6B6B]">Learner Summary</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-[#EAE7E2] bg-[#F1EFEA] p-2">
                    <p className="text-xl font-heading text-[#1E1E1E]">{summary?.totalCourses ?? 0}</p>
                    <p className="font-mono text-[9px] text-[#A3A3A3] uppercase">Total</p>
                  </div>
                  <div className="rounded-xl border border-[#EAE7E2] bg-[#EEF2FF] p-2">
                    <p className="text-xl font-heading text-[#3B82F6]">{completedCourses.length}</p>
                    <p className="font-mono text-[9px] text-[#A3A3A3] uppercase">Done</p>
                  </div>
                  <div className="rounded-xl border border-[#EAE7E2] bg-[#F1EFEA] p-2">
                    <p className="text-xl font-heading text-[#8B5CF6]">{pendingCourses.length}</p>
                    <p className="font-mono text-[9px] text-[#A3A3A3] uppercase">Pending</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={onSignOut}
                    className="text-xs font-semibold px-4 py-2.5 rounded-xl bg-[#1E1E1E] text-white hover:opacity-90 transition-opacity inline-flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </div>

              {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
