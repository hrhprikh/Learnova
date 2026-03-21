"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Video, FileText, Image as ImageIcon, HelpCircle, Plus } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type Lesson = {
    id: string;
    title: string;
    type: "VIDEO" | "DOCUMENT" | "IMAGE" | "QUIZ";
    durationSeconds: number;
    videoUrl?: string | null;
    fileUrl?: string | null;
};

type CourseDetail = {
    id: string;
    title: string;
    description: string | null;
    published: boolean;
    lessons: Lesson[];
};

export default function InstructorCourseEditor({ params }: { params: { courseId: string } }) {
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showLessonPopup, setShowLessonPopup] = useState(false);

    const [newLessonTitle, setNewLessonTitle] = useState("");
    const [newLessonType, setNewLessonType] = useState<Lesson["type"]>("VIDEO");
    const [newVideoUrl, setNewVideoUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let active = true;
        async function fetchCourse() {
            try {
                const { data } = await getCurrentSession();
                const t = data.session?.access_token;
                if (!t) throw new Error("Not authenticated");
                setToken(t);

                const response = await apiRequest<{ course: CourseDetail }>(`/courses/${params.courseId}`, { token: t });
                if (active) setCourse(response.course);
            } catch {
                if (active) setError("Could not load course details");
            }
        }
        fetchCourse();
        return () => { active = false; };
    }, [params.courseId]);

    async function createLesson(e: React.FormEvent) {
        e.preventDefault();
        if (!token || !newLessonTitle.trim()) return;
        setIsSubmitting(true);
        try {
            await apiRequest(`/courses/${params.courseId}/lessons`, {
                method: "POST",
                token,
                body: {
                    title: newLessonTitle.trim(),
                    type: newLessonType,
                    videoUrl: newLessonType === "VIDEO" ? newVideoUrl.trim() : undefined,
                    durationSeconds: 0
                }
            });
            // Refresh course
            const response = await apiRequest<{ course: CourseDetail }>(`/courses/${params.courseId}`, { token });
            setCourse(response.course);
            setShowLessonPopup(false);
            setNewLessonTitle("");
            setNewVideoUrl("");
            setNewLessonType("VIDEO");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create lesson");
        } finally {
            setIsSubmitting(false);
        }
    }

    function renderLessonIcon(type: Lesson["type"]) {
        switch (type) {
            case "VIDEO": return <Video className="w-4 h-4 text-blue-500" />;
            case "DOCUMENT": return <FileText className="w-4 h-4 text-gray-500" />;
            case "IMAGE": return <ImageIcon className="w-4 h-4 text-green-500" />;
            case "QUIZ": return <HelpCircle className="w-4 h-4 text-purple-500" />;
        }
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[var(--bg)] p-12">
                <Link href="/backoffice" className="floating-link inline-flex"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Link>
                <p className="mt-8 text-red-600">{error}</p>
            </div>
        );
    }

    if (!course) return <div className="min-h-screen bg-[var(--bg)] p-12"><p className="mono-note">Loading...</p></div>;

    return (
        <div className="min-h-screen bg-[var(--bg)] pb-24">
            <header className="px-6 py-8 lg:px-12 flex items-center justify-between border-b border-[var(--edge)] bg-white/50 backdrop-blur-md sticky top-0 z-40">
                <div className="flex items-center gap-6">
                    <Link href="/backoffice" className="inline-flex items-center gap-2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors font-mono text-sm group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span>Modules</span>
                    </Link>
                    <div className="h-4 w-px bg-[var(--edge)]" />
                    <h1 className="font-heading text-xl">{course.title}</h1>
                    {course.published ? (
                        <span className="mono-tag bg-green-50 text-green-700 border-green-200">Published</span>
                    ) : (
                        <span className="mono-tag">Draft</span>
                    )}
                </div>
                <button onClick={() => setShowLessonPopup(true)} className="action-chip flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Lesson
                </button>
            </header>

            <main className="max-w-4xl mx-auto mt-12 px-6">
                <section className="paper-panel">
                    <p className="mono-note mb-4">Course outline</p>
                    <div className="space-y-4">
                        {course.lessons.length === 0 ? (
                            <div className="py-12 text-center rounded-2xl border border-dashed border-[var(--edge)]">
                                <p className="body-copy">No lessons added yet. Start by adding a video or document.</p>
                            </div>
                        ) : null}
                        {course.lessons.map((lesson, idx) => (
                            <div key={lesson.id} className="lesson-row justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-[var(--edge)]">
                                        {renderLessonIcon(lesson.type)}
                                    </div>
                                    <div>
                                        <span className="font-mono text-[10px] text-[var(--ink-soft)]">PART {String(idx + 1).padStart(2, '0')}</span>
                                        <h3 className="font-medium text-[var(--ink)]">{lesson.title}</h3>
                                    </div>
                                </div>
                                {lesson.type === 'VIDEO' && lesson.videoUrl && (
                                    <span className="font-mono text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded">Video Link Attached</span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {showLessonPopup && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 backdrop-blur-sm">
                    <form onSubmit={createLesson} className="w-full max-w-md bg-white border border-[var(--edge)] rounded-3xl p-8 shadow-2xl">
                        <p className="mono-note mb-4">New Lesson</p>
                        <h2 className="font-heading text-2xl mb-6">Add Content</h2>

                        <label className="block text-sm font-medium mb-4">
                            Lesson Title
                            <input required value={newLessonTitle} onChange={e => setNewLessonTitle(e.target.value)} placeholder="e.g. Introduction to Design" className="mt-1 w-full rounded-xl border border-[var(--edge)] px-3 py-2 outline-none" />
                        </label>

                        <label className="block text-sm font-medium mb-4">
                            Content Type
                            <select value={newLessonType} onChange={e => setNewLessonType(e.target.value as Lesson["type"])} className="mt-1 w-full rounded-xl border border-[var(--edge)] px-3 py-2 outline-none">
                                <option value="VIDEO">Video (YouTube/External)</option>
                                <option value="DOCUMENT">Document</option>
                                <option value="IMAGE">Image</option>
                                <option value="QUIZ">Quiz</option>
                            </select>
                        </label>

                        {newLessonType === "VIDEO" && (
                            <label className="block text-sm font-medium mb-6">
                                YouTube / Video URL
                                <input type="url" required value={newVideoUrl} onChange={e => setNewVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="mt-1 w-full rounded-xl border border-[var(--edge)] px-3 py-2 outline-none" />
                            </label>
                        )}

                        <div className="flex items-center justify-end gap-3 mt-8">
                            <button type="button" onClick={() => setShowLessonPopup(false)} className="floating-link">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="action-chip">{isSubmitting ? "Saving..." : "Save Lesson"}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
