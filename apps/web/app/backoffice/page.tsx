"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Eye, BarChart2, Share2, Layout, Grid, Search, Clock, BookOpen, Users, MoreVertical, Filter, Mail } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { RoleGate } from "@/components/role-gate";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type MeResponse = {
  user: {
    id: string;
    role: "ADMIN" | "INSTRUCTOR" | "LEARNER";
  } | null;
};

type AppRole = "ADMIN" | "INSTRUCTOR" | "LEARNER";

type CourseItem = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  tags: Array<{ id: string; tag: string }>;
  attendeesCount?: number;
  completedCount?: number;
  viewsCount: number;
  lessonCount: number;
  durationSeconds: number;
};

type CoursesResponse = {
  courses: CourseItem[];
};

export default function BackofficePage() {
  const [status, setStatus] = useState("Checking access...");
  const [role, setRole] = useState<AppRole | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"LIST" | "KANBAN">("KANBAN");
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      try {
        const { data } = await getCurrentSession();
        const token = data.session?.access_token;

        if (!token) {
          throw new Error("No session token");
        }

        const me = await apiRequest<MeResponse>("/users/me", { token });
        const mine = await apiRequest<CoursesResponse>("/courses?mine=true", { token });
        if (active) {
          setRole(me.user?.role ?? null);
          setCourses(mine.courses);
          setToken(token);
        }

        await apiRequest<{ message: string }>("/protected/backoffice", { token });
        if (active) {
          setStatus("Access granted. Backoffice routes are protected correctly.");
        }
      } catch (error) {
        if (active) {
          setStatus(error instanceof Error ? error.message : "Access denied");
        }
      }
    }

    verifyAccess();

    return () => {
      active = false;
    };
  }, []);

  async function refreshCourses() {
    if (!token) return;
    const searchParam = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
    const mine = await apiRequest<CoursesResponse>(`/courses?mine=true${searchParam}`, { token });
    setCourses(mine.courses);
  }

  async function createCourse() {
    if (!token || !newTitle.trim()) return;
    setActionError(null);
    try {
      await apiRequest<{ course: CourseItem }>("/courses", {
        method: "POST",
        token,
        body: {
          title: newTitle.trim(),
          description: "New course draft",
          visibility: "EVERYONE",
          accessRule: "OPEN",
          tags: ["new"]
        }
      });
      setNewTitle("");
      setShowCreatePopup(false);
      await refreshCourses();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not create course");
    }
  }

  async function togglePublish(courseId: string, publish: boolean) {
    if (!token) return;
    setActionError(null);
    try {
      await apiRequest<{ course: CourseItem }>(`/courses/${courseId}/${publish ? "publish" : "unpublish"}`, {
        method: "POST",
        token
      });
      await refreshCourses();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not update publish state");
    }
  }

  useEffect(() => {
    if (!token) return;
    refreshCourses().catch((error) => {
      setActionError(error instanceof Error ? error.message : "Could not fetch courses");
    });
  }, [search, token]);

  function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function copyShareLink(courseId: string) {
    const url = `${window.location.origin}/courses/${courseId}`;
    navigator.clipboard.writeText(url);
    alert("Course link copied to clipboard!");
  }

  const draftCourses = courses.filter((course) => !course.published);
  const publishedCourses = courses.filter((course) => course.published);

  const CourseCard = ({ course }: { course: CourseItem }) => (
    <article className="course-float group">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold leading-tight group-hover:text-[var(--ink)] transition-colors line-clamp-2">{course.title}</h3>
        <button onClick={() => copyShareLink(course.id)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[var(--ink)] transition-all" title="Share Course">
          <Share2 className="w-4 h-4" />
        </button>
      </div>
      <p className="body-copy mt-2 line-clamp-2 text-sm">{course.description ?? "No description yet"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {course.tags.map((tag) => (
          <span key={tag.id} className="mono-tag text-[10px]">{tag.tag}</span>
        ))}
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-y-3 gap-x-4 font-mono text-[10px] text-[var(--ink-soft)] border-t border-[var(--edge)]/40 pt-4">
        <div className="flex items-center gap-1.5" title="Total Enrolled Students">
          <Users className="w-3 h-3" />
          <span>{course.attendeesCount ?? 0} Enrolled</span>
        </div>
        <div className="flex items-center gap-1.5" title="Views">
          <Eye className="w-3 h-3" />
          <span>{course.viewsCount ?? 0} Views</span>
        </div>
        <div className="flex items-center gap-1.5" title="Lessons">
          <BookOpen className="w-3 h-3" />
          <span>{course.lessonCount} Lessons</span>
        </div>
        <div className="flex items-center gap-1.5" title="Duration">
          <Clock className="w-3 h-3" />
          <span>{formatDuration(course.durationSeconds)}</span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-[var(--edge)]/40 pt-4">
        <div className="flex gap-2">
          <Link href={`/backoffice/courses/${course.id}`} className="action-chip text-[10px] py-1.5 px-3">Manage</Link>
          <Link href={`/backoffice/reporting?courseId=${course.id}`} className="flex items-center gap-1.5 text-[10px] font-mono hover:text-[var(--ink)] transition-colors">
            <BarChart2 className="w-3 h-3" /> Report
          </Link>
        </div>
        <button 
          onClick={() => togglePublish(course.id, !course.published)} 
          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${course.published ? 'text-green-600 bg-green-50 border-green-100' : 'text-orange-600 bg-orange-50 border-orange-100'}`}
        >
          {course.published ? "Unpublish" : "Publish"}
        </button>
      </div>
    </article>
  );

  return (
    <RoleGate role={role} allow={["ADMIN", "INSTRUCTOR"]}>
      <div className="min-h-screen bg-[var(--bg)] pb-20">
        <header className="fixed top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[1200px] z-50 bg-white/70 backdrop-blur-xl border border-[var(--edge)] px-6 py-4 rounded-2xl shadow-[0_10px_30px_-20px_rgba(0,0,0,0.1)] flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-heading font-semibold tracking-tight text-lg text-[var(--ink)]">Learnova.Lab</span>
            <div className="h-5 w-px bg-[var(--edge)]" />
            <nav className="hidden md:flex gap-6 font-mono text-xs">
              <Link href="/backoffice" className="text-[var(--ink)] font-bold">Modules</Link>
              <Link href="/backoffice/reporting" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">Reporting</Link>
              <Link href="/dashboard" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">Dashboard</Link>
              <Link href="/courses" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">Catalog</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <button onClick={() => setShowCreatePopup(true)} className="bg-[var(--ink)] text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-[#2a2d43] transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Module
            </button>
          </div>
        </header>

        <main className="mx-auto pt-36 w-full max-w-6xl gap-6 px-6 lg:px-12 grid lg:grid-cols-[1.2fr_0.8fr]">
          <section className="paper-panel">
            <div className="flex items-center justify-between">
              <p className="mono-note">instructor panel</p>
              <div className="flex items-center bg-white/70 border border-[var(--edge)] rounded-xl p-0.5">
                <button
                  onClick={() => setViewMode("KANBAN")}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === "KANBAN" ? "bg-[var(--ink)] text-white shadow-md" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}
                  title="Kanban View"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("LIST")}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === "LIST" ? "bg-[var(--ink)] text-white shadow-md" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}
                  title="List View"
                >
                  <Layout className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <h1 className="display-title mt-4">Course Studio</h1>
            <p className="body-copy mt-4 max-w-2xl text-sm">
              Modular content blocks for course setup, attendees, publishing, and reporting.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter by name..."
                  className="w-full rounded-xl border border-[var(--edge)] bg-white/80 pl-10 pr-4 py-2.5 outline-none focus:border-[var(--ink)] transition-all text-sm"
                />
              </div>
              <button 
                onClick={() => setShowCreatePopup(true)} 
                className="bg-[var(--ink)] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Course
              </button>
            </div>

            {viewMode === "KANBAN" ? (
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <section className="space-y-4">
                  <p className="mono-note flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    draft ({draftCourses.length})
                  </p>
                  {draftCourses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                  {draftCourses.length === 0 && (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-[var(--edge)] bg-white/30">
                      <p className="text-xs text-[var(--ink-soft)] font-mono">No drafts</p>
                    </div>
                  )}
                </section>

                <section className="space-y-4">
                  <p className="mono-note flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    published ({publishedCourses.length})
                  </p>
                  {publishedCourses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                  {publishedCourses.length === 0 && (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-[var(--edge)] bg-white/30">
                      <p className="text-xs text-[var(--ink-soft)] font-mono">No published courses</p>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--edge)] bg-white shadow-sm">
                <table className="min-w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[var(--edge)] text-left text-[var(--ink-soft)] uppercase tracking-tight">
                      <th className="px-6 py-4">Course Details</th>
                      <th className="px-4 py-4 text-center">Lessons</th>
                      <th className="px-4 py-4 text-center">Views</th>
                      <th className="px-4 py-4 text-center">Enrolled</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--edge)]/40">
                    {courses.map((course) => (
                      <tr key={course.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-[var(--ink)] leading-none mb-1">{course.title}</p>
                          <div className="flex gap-2">
                            {course.tags.slice(0, 2).map(t => <span key={t.id} className="text-[9px] opacity-60">#{t.tag}</span>)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center font-bold">{course.lessonCount}</td>
                        <td className="px-4 py-4 text-center opacity-70">{course.viewsCount}</td>
                        <td className="px-4 py-4 text-center opacity-70">{course.attendeesCount ?? 0}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${course.published ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                            {course.published ? "LIVE" : "DRAFT"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => copyShareLink(course.id)} className="p-1.5 hover:bg-white border border-transparent hover:border-[var(--edge)] rounded-lg text-gray-400 hover:text-[var(--ink)] transition-all">
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <Link href={`/backoffice/reporting?courseId=${course.id}`} className="p-1.5 hover:bg-white border border-transparent hover:border-[var(--edge)] rounded-lg text-gray-400 hover:text-[var(--ink)] transition-all">
                              <BarChart2 className="w-3.5 h-3.5" />
                            </Link>
                            <Link href={`/backoffice/courses/${course.id}`} className="px-3 py-1.5 border border-[var(--edge)] rounded-lg hover:border-[var(--ink)] transition-all font-bold">Edit</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {courses.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-[var(--ink-soft)]">No courses found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {courses.length === 0 ? (
              <article className="course-float mt-4">
                <p className="mono-note">empty</p>
                <h3 className="mt-3 text-xl font-semibold">No courses created yet</h3>
                <p className="body-copy mt-2">Use quick create to add your first course draft.</p>
              </article>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <article className="course-float">
                <p className="mono-note">attendees</p>
                <h3 className="mt-3 text-xl font-semibold">Invite and contact learners</h3>
                <p className="body-copy mt-2">Invitation workflow is queued for the next implementation batch.</p>
                <p className="mono-note mt-4">No pending action on this card</p>
              </article>
              <article className="course-float">
                <p className="mono-note">reporting</p>
                <h3 className="mt-3 text-xl font-semibold">Progress snapshots</h3>
                <p className="body-copy mt-2">Detailed reporting view is in progress and will be added as a dedicated route.</p>
                <p className="mono-note mt-4">No pending action on this card</p>
              </article>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="panel-soft">
              <p className="mono-note">access state</p>
              <p className="body-copy mt-3">{status}</p>
              {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="mono-tag">role: {role ?? "checking"}</span>
                <span className="mono-tag">rbac: active</span>
              </div>
            </section>
            <section className="panel-soft">
              <p className="mono-note">workflow</p>
              <p className="body-copy mt-3">Login to role resolve to backoffice controls to course workspace.</p>
            </section>
          </aside>
        </main>

        {showCreatePopup ? (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 px-4">
            <div className="w-full max-w-md rounded-2xl border border-[var(--edge)] bg-[var(--paper)] p-5 shadow-xl">
              <p className="mono-note">quick create</p>
              <h3 className="mt-2 text-xl font-semibold">Create new course draft</h3>
              <input
                autoFocus
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Course title"
                className="mt-4 w-full rounded-xl border border-[var(--edge)] bg-white/80 px-3 py-2 outline-none"
              />
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setShowCreatePopup(false)} className="floating-link">Cancel</button>
                <button onClick={createCourse} className="action-chip">Create</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </RoleGate>
  );
}
