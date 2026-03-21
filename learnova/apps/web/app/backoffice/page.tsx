"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, token]);

  const draftCourses = courses.filter((course) => !course.published);
  const publishedCourses = courses.filter((course) => course.published);

  return (
    <RoleGate role={role} allow={["ADMIN", "INSTRUCTOR"]}>
      <div className="min-h-screen bg-[var(--bg)] pb-20">
        <header className="fixed top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[1200px] z-50 bg-white/70 backdrop-blur-xl border border-[var(--edge)] px-6 py-4 rounded-2xl shadow-[0_10px_30px_-20px_rgba(0,0,0,0.1)] flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-heading font-semibold tracking-tight text-lg text-[var(--ink)]">Learnova.Lab</span>
            <div className="h-5 w-px bg-[var(--edge)]" />
            <nav className="hidden md:flex gap-6 font-mono text-xs">
              <Link href="/backoffice" className="text-[var(--ink)] font-bold">Modules</Link>
              <Link href="/dashboard" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">Dashboard</Link>
              <Link href="/courses" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">Catalog</Link>
            </nav>
          </div>
          <button onClick={() => setShowCreatePopup(true)} className="bg-[var(--ink)] text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-[#2a2d43] transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Module
          </button>
        </header>

        <main className="mx-auto pt-36 w-full max-w-6xl gap-6 px-6 lg:px-12 grid lg:grid-cols-[1.2fr_0.8fr]">
          <section className="paper-panel">
            <p className="mono-note">instructor panel</p>
            <h1 className="display-title mt-4">Course Studio</h1>
            <p className="body-copy mt-4 max-w-2xl">
              Modular content blocks replace traditional dashboard tables. Each card is a workspace unit for
              course setup, attendees, publishing, and reporting.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={() => setShowCreatePopup(true)} className="action-chip">+ Quick create</button>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search courses by name"
                className="min-w-[240px] flex-1 rounded-xl border border-[var(--edge)] bg-white/80 px-3 py-2 outline-none"
              />
              <div className="inline-flex rounded-xl border border-[var(--edge)] bg-white/70 p-1">
                <button
                  onClick={() => setViewMode("KANBAN")}
                  className={`rounded-lg px-3 py-1 text-sm ${viewMode === "KANBAN" ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]"}`}
                >
                  Kanban
                </button>
                <button
                  onClick={() => setViewMode("LIST")}
                  className={`rounded-lg px-3 py-1 text-sm ${viewMode === "LIST" ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]"}`}
                >
                  List
                </button>
              </div>
            </div>

            {viewMode === "KANBAN" ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <section className="panel-soft space-y-3">
                  <p className="mono-note">draft ({draftCourses.length})</p>
                  {draftCourses.map((course) => (
                    <article key={course.id} className="course-float">
                      <h3 className="text-lg font-semibold">{course.title}</h3>
                      <p className="body-copy mt-2">{course.description ?? "No description yet"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {course.tags.map((tag) => (
                          <span key={tag.id} className="mono-tag">{tag.tag}</span>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <Link href={`/backoffice/courses/${course.id}`} className="floating-link inline-flex">Open</Link>
                        <button onClick={() => togglePublish(course.id, true)} className="floating-link">Publish</button>
                      </div>
                    </article>
                  ))}
                </section>

                <section className="panel-soft space-y-3">
                  <p className="mono-note">published ({publishedCourses.length})</p>
                  {publishedCourses.map((course) => (
                    <article key={course.id} className="course-float">
                      <h3 className="text-lg font-semibold">{course.title}</h3>
                      <p className="body-copy mt-2">{course.description ?? "No description yet"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {course.tags.map((tag) => (
                          <span key={tag.id} className="mono-tag">{tag.tag}</span>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <Link href={`/backoffice/courses/${course.id}`} className="floating-link inline-flex">Open</Link>
                        <button onClick={() => togglePublish(course.id, false)} className="floating-link">Unpublish</button>
                      </div>
                    </article>
                  ))}
                </section>
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--edge)] bg-white/70">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--edge)] text-left text-[var(--ink-soft)]">
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Tags</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course.id} className="border-b border-[var(--edge)]/60">
                        <td className="px-4 py-3 font-medium">{course.title}</td>
                        <td className="px-4 py-3">{course.tags.map((tag) => tag.tag).join(", ") || "-"}</td>
                        <td className="px-4 py-3">{course.published ? "Published" : "Draft"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/backoffice/courses/${course.id}`} className="floating-link inline-flex">Open</Link>
                            <button
                              onClick={() => togglePublish(course.id, !course.published)}
                              className="floating-link"
                            >
                              {course.published ? "Unpublish" : "Publish"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
