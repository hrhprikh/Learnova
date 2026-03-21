"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Video, FileText, Image as ImageIcon, HelpCircle, Plus, Edit2, Trash2, X, Link as LinkIcon, Paperclip, Clock, User as UserIcon, Type, FileUp, Globe, CheckCircle2, Circle, Eye, Settings, Share2, Tag, Users, Mail } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";
import { uploadFile } from "@/lib/storage";
import QuizQuestionEditor from "@/components/QuizQuestionEditor";

type LocalOption = { text: string; isCorrect: boolean };
type LocalQuestion = { tempId: string; text: string; options: LocalOption[] };

type Lesson = {
    id: string;
    title: string;
    description: string | null;
    type: "VIDEO" | "DOCUMENT" | "IMAGE" | "QUIZ";
    durationSeconds: number;
    videoUrl?: string | null;
    fileUrl?: string | null;
    allowDownload: boolean;
    responsibleUserId?: string | null;
    attachments?: Array<{ id: string; label: string; kind: "FILE" | "LINK"; fileUrl?: string; externalUrl?: string }>;
    quiz?: { id: string; title: string } | null;
};

type Instructor = {
    id: string;
    fullName: string;
    role: string;
};

type CourseDetail = {
    id: string;
    title: string;
    description: string | null;
    published: boolean;
    visibility: "EVERYONE" | "SIGNED_IN";
    accessRule: "OPEN" | "INVITATION" | "PAYMENT";
    price: number | null;
    imageUrl: string | null;
    website: string | null;
    responsibleUserId: string | null;
    tags: Array<{ id: string; tag: string }>;
    lessons: Lesson[];
};

export default function InstructorCourseEditor({ params }: { params: { courseId: string } }) {
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [instructors] = useState<Instructor[]>([]);
    
    // Course-level tab state
    const [courseTab, setCourseTab] = useState<"CONTENT" | "SETTINGS" | "DESCRIPTION" | "OPTIONS" | "ATTENDEES">("CONTENT");
    const [courseForm, setCourseForm] = useState({
        title: "",
        description: "",
        imageUrl: "",
        website: "",
        visibility: "EVERYONE" as "EVERYONE" | "SIGNED_IN",
        accessRule: "OPEN" as "OPEN" | "INVITATION" | "PAYMENT",
        price: "",
        responsibleUserId: "",
        tagsInput: ""
    });
    const [isSavingCourse, setIsSavingCourse] = useState(false);
    const [courseSaveMsg, setCourseSaveMsg] = useState<string | null>(null);
    
    // Attendees state
    type AttendeeItem = { id: string; userId: string; fullName: string; email: string; enrolledAt: string };
    const [attendees, setAttendees] = useState<AttendeeItem[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [attendeeMsg, setAttendeeMsg] = useState<string | null>(null);
    const [isInviting, setIsInviting] = useState(false);
    
    // Editor State
    const [showLessonPopup, setShowLessonPopup] = useState(false);
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactForm, setContactForm] = useState({ subject: "", message: "" });
    const [isSendingMail, setIsSendingMail] = useState(false);
    const [activeTab, setActiveTab] = useState<"CONTENT" | "DESCRIPTION" | "ATTACHMENTS" | "QUESTIONS">("CONTENT");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [lessonForm, setLessonForm] = useState({
        title: "",
        type: "VIDEO" as Lesson["type"],
        description: "",
        durationSeconds: 0,
        videoUrl: "",
        fileUrl: "",
        allowDownload: false,
        responsibleUserId: ""
    });
    
    const [attachments, setAttachments] = useState<Lesson["attachments"]>([]);
    const [showAttachmentAdd, setShowAttachmentAdd] = useState<"FILE" | "LINK" | null>(null);
    const [attachmentForm, setAttachmentForm] = useState({ label: "", url: "" });

    // Local quiz questions for new lessons (before publish)
    const [localQuizQuestions, setLocalQuizQuestions] = useState<LocalQuestion[]>([]);
    const [editingLocalQIdx, setEditingLocalQIdx] = useState<number | null>(null);

    useEffect(() => {
        let active = true;
        async function fetchCourse() {
            try {
                const { data } = await getCurrentSession();
                const t = data.session?.access_token;
                if (!t) throw new Error("Not authenticated");
                setToken(t);

                const response = await apiRequest<{ course: CourseDetail }>(`/courses/${params.courseId}`, { token: t });
                if (active) {
                    setCourse(response.course);
                    setCourseForm({
                        title: response.course.title,
                        description: response.course.description || "",
                        imageUrl: response.course.imageUrl || "",
                        website: response.course.website || "",
                        visibility: response.course.visibility || "EVERYONE",
                        accessRule: response.course.accessRule || "OPEN",
                        price: response.course.price?.toString() || "",
                        responsibleUserId: response.course.responsibleUserId || "",
                        tagsInput: response.course.tags?.map(t2 => t2.tag).join(", ") || ""
                    });
                }
            } catch {
                if (active) setError("Could not load course details");
            }
        }
        fetchCourse();
        return () => { active = false; };
    }, [params.courseId]);

    function openAddLesson() {
        setEditingLessonId(null);
        setLessonForm({
            title: "",
            type: "VIDEO",
            description: "",
            durationSeconds: 0,
            videoUrl: "",
            fileUrl: "",
            allowDownload: false,
            responsibleUserId: ""
        });
        setAttachments([]);
        setLocalQuizQuestions([]);
        setEditingLocalQIdx(null);
        setActiveTab("CONTENT");
        setShowLessonPopup(true);
    }

    function openEditLesson(lesson: Lesson) {
        setEditingLessonId(lesson.id);
        setLessonForm({
            title: lesson.title,
            type: lesson.type,
            description: lesson.description || "",
            durationSeconds: lesson.durationSeconds,
            videoUrl: lesson.videoUrl || "",
            fileUrl: lesson.fileUrl || "",
            allowDownload: lesson.allowDownload,
            responsibleUserId: lesson.responsibleUserId || ""
        });
        setAttachments(lesson.attachments || []);
        setLocalQuizQuestions([]);
        setEditingLocalQIdx(null);
        setActiveTab("CONTENT");
        setShowLessonPopup(true);
    }

    async function handleSaveLesson(e: React.FormEvent) {
        e.preventDefault();
        if (!token || !lessonForm.title.trim()) return;
        setIsSubmitting(true);
        try {
            const method = editingLessonId ? "PATCH" : "POST";
            const url = editingLessonId 
                ? `/lessons/${editingLessonId}` 
                : `/courses/${params.courseId}/lessons`;
            
            await apiRequest<{ lesson: Lesson }>(url, {
                method,
                token,
                body: {
                    title: lessonForm.title.trim(),
                    type: lessonForm.type,
                    description: lessonForm.description || null,
                    durationSeconds: Number(lessonForm.durationSeconds) || 0,
                    videoUrl: lessonForm.videoUrl || null,
                    fileUrl: lessonForm.fileUrl || null,
                    allowDownload: lessonForm.allowDownload,
                    responsibleUserId: lessonForm.responsibleUserId || null
                }
            });
            
            // If creating a new Quiz lesson with local questions, batch-save them
            if (!editingLessonId && lessonForm.type === 'QUIZ' && localQuizQuestions.length > 0) {
                // Refresh to get the newly-created quiz ID
                const refreshed = await apiRequest<{ course: CourseDetail }>(`/courses/${params.courseId}`, { token });
                const newLesson = refreshed.course.lessons.find(l => l.title === lessonForm.title.trim() && l.type === 'QUIZ');
                const quizId = newLesson?.quiz?.id;
                if (quizId) {
                    for (const lq of localQuizQuestions) {
                        if (!lq.text.trim() || lq.options.length < 2) continue;
                        const created = await apiRequest<{ question: { id: string } }>(`/quizzes/${quizId}/questions`, {
                            method: "POST", token, body: { text: lq.text }
                        });
                        await apiRequest(`/quizzes/${quizId}/questions/${created.question.id}`, {
                            method: "PUT", token, body: { text: lq.text, options: lq.options }
                        });
                    }
                }
            }
            
            // Refresh course
            const response = await apiRequest<{ course: CourseDetail }>(`/courses/${params.courseId}`, { token });
            setCourse(response.course);
            setShowLessonPopup(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save lesson");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function deleteLesson(id: string) {
        if (!confirm("Are you sure you want to delete this lesson?")) return;
        if (!token) return;
        try {
            await apiRequest(`/lessons/${id}`, { method: "DELETE", token });
            // Refresh
            const response = await apiRequest<{ course: CourseDetail }>(`/courses/${params.courseId}`, { token });
            setCourse(response.course);
        } catch {
            alert("Failed to delete lesson");
        }
    }

    async function handleAddAttachment() {
        if (!token || !editingLessonId || !attachmentForm.label.trim() || !attachmentForm.url.trim()) return;
        setIsSubmitting(true);
        try {
            const body = {
                kind: showAttachmentAdd,
                label: attachmentForm.label.trim(),
                ...(showAttachmentAdd === "FILE" ? { fileUrl: attachmentForm.url } : { externalUrl: attachmentForm.url })
            };
            
            await apiRequest(`/lessons/${editingLessonId}/attachments`, {
                method: "POST",
                token,
                body
            });
            
            // Refresh lesson data (for simplicity, refresh entire course)
            const response = await apiRequest<{ course: CourseDetail }>(`/courses/${params.courseId}`, { token });
            setCourse(response.course);
            
            // Update local attachments
            const updatedLesson = response.course.lessons.find(l => l.id === editingLessonId);
            if (updatedLesson) setAttachments(updatedLesson.attachments || []);
            
            setAttachmentForm({ label: "", url: "" });
            setShowAttachmentAdd(null);
        } catch {
            alert("Failed to add attachment");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDeleteAttachment(attachmentId: string) {
        if (!token || !confirm("Remove this attachment?")) return;
        try {
            await apiRequest(`/attachments/${attachmentId}`, { method: "DELETE", token });
            
            // Refresh
            const response = await apiRequest<{ course: CourseDetail }>(`/courses/${params.courseId}`, { token });
            setCourse(response.course);
            
            const updatedLesson = response.course.lessons.find(l => l.id === editingLessonId);
            if (updatedLesson) setAttachments(updatedLesson.attachments || []);
        } catch {
            alert("Failed to delete attachment");
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

    async function saveCourseSettings() {
        if (!token || !course) return;
        setIsSavingCourse(true);
        setCourseSaveMsg(null);
        try {
            const tagsArr = courseForm.tagsInput.split(",").map(t2 => t2.trim()).filter(Boolean);
            await apiRequest(`/courses/${params.courseId}`, {
                method: "PATCH",
                token,
                body: {
                    title: courseForm.title.trim() || undefined,
                    description: courseForm.description || undefined,
                    imageUrl: courseForm.imageUrl || undefined,
                    website: courseForm.website || undefined,
                    visibility: courseForm.visibility,
                    accessRule: courseForm.accessRule,
                    ...(courseForm.accessRule === "PAYMENT" && courseForm.price ? { price: Number(courseForm.price) } : {}),
                    responsibleUserId: courseForm.responsibleUserId || undefined,
                    tags: tagsArr
                }
            });
            const response = await apiRequest<{ course: CourseDetail }>(`/courses/${params.courseId}`, { token });
            setCourse(response.course);
            setCourseSaveMsg("Saved successfully!");
            setTimeout(() => setCourseSaveMsg(null), 3000);
        } catch (err) {
            setCourseSaveMsg(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setIsSavingCourse(false);
        }
    }

    async function togglePublish() {
        if (!token || !course) return;
        try {
            await apiRequest(`/courses/${params.courseId}/${course.published ? "unpublish" : "publish"}`, {
                method: "POST", token
            });
            const response = await apiRequest<{ course: CourseDetail }>(`/courses/${params.courseId}`, { token });
            setCourse(response.course);
        } catch {
            alert("Failed to change publish state");
        }
    }

    async function loadAttendees() {
        if (!token) return;
        try {
            const res = await apiRequest<{ attendees: AttendeeItem[] }>(`/courses/${params.courseId}/attendees`, { token });
            setAttendees(res.attendees);
        } catch {
            setAttendees([]);
        }
    }

    async function inviteAttendee() {
        if (!token || !inviteEmail.trim()) return;
        setIsInviting(true);
        setAttendeeMsg(null);
        try {
            await apiRequest(`/courses/${params.courseId}/attendees`, {
                method: "POST", token, body: { email: inviteEmail.trim() }
            });
            setInviteEmail("");
            setAttendeeMsg("User added successfully!");
            await loadAttendees();
            setTimeout(() => setAttendeeMsg(null), 3000);
        } catch (err) {
            setAttendeeMsg(err instanceof Error ? err.message : "Failed to add user");
        } finally {
            setIsInviting(false);
        }
    }

    async function removeAttendee(userId: string) {
        if (!token || !confirm("Remove this attendee?")) return;
        try {
            await apiRequest(`/courses/${params.courseId}/attendees/${userId}`, { method: "DELETE", token });
            await loadAttendees();
        } catch {
            alert("Failed to remove attendee");
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
            <header className="px-6 py-5 lg:px-12 flex items-center justify-between border-b border-[var(--edge)] bg-white/50 backdrop-blur-md sticky top-0 z-40">
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
                <div className="flex items-center gap-3">
                    <NotificationBell />
                    <button onClick={() => setShowContactModal(true)} className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-xl border border-[var(--edge)] hover:bg-gray-50 transition-colors">
                        <Mail className="w-3.5 h-3.5" /> Contact Attendees
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/courses/${course.id}`); alert("Link copied!"); }} className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-xl border border-[var(--edge)] hover:bg-gray-50 transition-colors">
                        <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                    <Link href={`/courses/${course.id}`} target="_blank" className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-xl border border-[var(--edge)] hover:bg-gray-50 transition-colors">
                        <Eye className="w-3.5 h-3.5" /> Preview
                    </Link>
                    <button onClick={togglePublish} className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-colors ${course.published ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'}`}>
                        {course.published ? "✓ Published" : "Publish"}
                    </button>
                    <button onClick={openAddLesson} className="action-chip flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add Lesson
                    </button>
                </div>
            </header>

            {/* Course-level tabs */}
            <div className="px-6 lg:px-12 flex border-b border-[var(--edge)] bg-white sticky top-[73px] z-30">
                {(["CONTENT", "SETTINGS", "DESCRIPTION", "OPTIONS", "ATTENDEES"] as const).map(tab => (
                    <button key={tab} onClick={() => { setCourseTab(tab); if (tab === "ATTENDEES") loadAttendees(); }} className={`px-5 py-3.5 text-sm font-medium transition-all relative ${courseTab === tab ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
                        <div className="flex items-center gap-2">
                            {tab === "CONTENT" && <FileText className="w-3.5 h-3.5" />}
                            {tab === "SETTINGS" && <Settings className="w-3.5 h-3.5" />}
                            {tab === "DESCRIPTION" && <Type className="w-3.5 h-3.5" />}
                            {tab === "OPTIONS" && <Globe className="w-3.5 h-3.5" />}
                            {tab === "ATTENDEES" && <Users className="w-3.5 h-3.5" />}
                            {tab.charAt(0) + tab.slice(1).toLowerCase()}
                        </div>
                        {courseTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--ink)]" />}
                    </button>
                ))}
            </div>

            <main className="max-w-4xl mx-auto mt-8 px-6">

                {/* ===== CONTENT TAB ===== */}
                {courseTab === "CONTENT" && (
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
                                    
                                    <div className="flex items-center gap-3">
                                        {lesson.type === 'VIDEO' && lesson.videoUrl && (
                                            <span className="font-mono text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Video Attached</span>
                                        )}
                                        {lesson.type === 'QUIZ' && lesson.quiz && (
                                            <Link href={`/backoffice/quizzes/${lesson.quiz.id}`} className="action-chip text-[10px] py-1 px-3">
                                                Edit Quiz
                                            </Link>
                                        )}
                                        <button onClick={() => openEditLesson(lesson)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors" title="Edit Lesson">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteLesson(lesson.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors" title="Delete Lesson">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ===== SETTINGS TAB ===== */}
                {courseTab === "SETTINGS" && (
                    <section className="paper-panel space-y-8">
                        <div>
                            <p className="mono-note mb-6">Course settings</p>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Course Title</label>
                                    <input className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors" value={courseForm.title} onChange={e => setCourseForm({...courseForm, title: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">
                                        <span className="flex items-center gap-2"><Tag className="w-3 h-3" /> Tags</span>
                                    </label>
                                    <input className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors font-mono text-sm" placeholder="web, design, react (comma separated)" value={courseForm.tagsInput} onChange={e => setCourseForm({...courseForm, tagsInput: e.target.value})} />
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {courseForm.tagsInput.split(",").map(t2 => t2.trim()).filter(Boolean).map((tag, i) => (
                                            <span key={i} className="mono-tag">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Course Image</label>
                                        <div className="flex gap-2">
                                            <input className="flex-1 px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors font-mono text-sm" placeholder="https://..." value={courseForm.imageUrl} onChange={e => setCourseForm({...courseForm, imageUrl: e.target.value})} />
                                            <label className="action-chip flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                                <FileUp className="w-3.5 h-3.5" />
                                                Upload
                                                <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    try {
                                                        const url = await uploadFile(file);
                                                        setCourseForm({ ...courseForm, imageUrl: url });
                                                    } catch (err) {
                                                        alert("Upload failed: " + (err instanceof Error ? err.message : "Internal error"));
                                                    }
                                                }} />
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Website URL</label>
                                        <input className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors font-mono text-sm" placeholder="https://..." value={courseForm.website} onChange={e => setCourseForm({...courseForm, website: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Responsible / Course Admin</label>
                                    <input className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors font-mono text-sm" placeholder="User ID (optional)" value={courseForm.responsibleUserId} onChange={e => setCourseForm({...courseForm, responsibleUserId: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 pt-4 border-t border-[var(--edge)]">
                            <button onClick={saveCourseSettings} disabled={isSavingCourse} className="action-chip px-8">{isSavingCourse ? "Saving..." : "Save Settings"}</button>
                            {courseSaveMsg && <span className="text-sm font-mono text-green-600">{courseSaveMsg}</span>}
                        </div>
                    </section>
                )}

                {/* ===== DESCRIPTION TAB ===== */}
                {courseTab === "DESCRIPTION" && (
                    <section className="paper-panel space-y-6">
                        <div>
                            <p className="mono-note mb-6">Course description</p>
                            <p className="text-sm text-[var(--ink-soft)] mb-4">This description is shown to learners on the course detail page.</p>
                            <textarea
                                rows={14}
                                className="w-full p-6 rounded-2xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors leading-relaxed"
                                value={courseForm.description}
                                onChange={e => setCourseForm({...courseForm, description: e.target.value})}
                                placeholder="Write a compelling course description..."
                            />
                            <p className="text-xs text-[var(--ink-soft)] italic mt-2">Markdown is supported for basic formatting.</p>
                        </div>
                        <div className="flex items-center gap-4 pt-4 border-t border-[var(--edge)]">
                            <button onClick={saveCourseSettings} disabled={isSavingCourse} className="action-chip px-8">{isSavingCourse ? "Saving..." : "Save Description"}</button>
                            {courseSaveMsg && <span className="text-sm font-mono text-green-600">{courseSaveMsg}</span>}
                        </div>
                    </section>
                )}

                {/* ===== OPTIONS TAB ===== */}
                {courseTab === "OPTIONS" && (
                    <section className="paper-panel space-y-8">
                        <div>
                            <p className="mono-note mb-6">Access &amp; Visibility</p>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Visibility — Who can see this course?</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(["EVERYONE", "SIGNED_IN"] as const).map(v => (
                                            <button key={v} onClick={() => setCourseForm({...courseForm, visibility: v})} className={`p-4 rounded-xl border-2 text-left transition-all ${courseForm.visibility === v ? 'border-[var(--ink)] bg-[#f2f0eb]' : 'border-[var(--edge)] bg-white hover:border-gray-300'}`}>
                                                <p className="text-sm font-medium">{v === "EVERYONE" ? "Everyone" : "Signed-in Users"}</p>
                                                <p className="text-[10px] text-[var(--ink-soft)] mt-1">{v === "EVERYONE" ? "Course is visible to all visitors" : "Only logged-in users can see this course"}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Access Rule — Who can start learning?</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(["OPEN", "INVITATION", "PAYMENT"] as const).map(v => (
                                            <button key={v} onClick={() => setCourseForm({...courseForm, accessRule: v})} className={`p-4 rounded-xl border-2 text-left transition-all ${courseForm.accessRule === v ? 'border-[var(--ink)] bg-[#f2f0eb]' : 'border-[var(--edge)] bg-white hover:border-gray-300'}`}>
                                                <p className="text-sm font-medium">{v === "OPEN" ? "Open" : v === "INVITATION" ? "By Invitation" : "Paid"}</p>
                                                <p className="text-[10px] text-[var(--ink-soft)] mt-1">{v === "OPEN" ? "Anyone can join" : v === "INVITATION" ? "Only invited users" : "Requires payment"}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {courseForm.accessRule === "PAYMENT" && (
                                    <div>
                                        <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Price (₹)</label>
                                        <input type="number" className="w-full max-w-xs px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors font-mono" placeholder="499" value={courseForm.price} onChange={e => setCourseForm({...courseForm, price: e.target.value})} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4 pt-4 border-t border-[var(--edge)]">
                            <button onClick={saveCourseSettings} disabled={isSavingCourse} className="action-chip px-8">{isSavingCourse ? "Saving..." : "Save Options"}</button>
                            {courseSaveMsg && <span className="text-sm font-mono text-green-600">{courseSaveMsg}</span>}
                        </div>
                    </section>
                )}

                {/* ===== ATTENDEES TAB ===== */}
                {courseTab === "ATTENDEES" && (
                    <section className="paper-panel space-y-6">
                        <div>
                            <p className="mono-note mb-4">Attendees ({attendees.length})</p>
                            <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Invite by Email</label>
                                    <input
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors font-mono text-sm"
                                        placeholder="learner@example.com"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && inviteAttendee()}
                                    />
                                </div>
                                <button onClick={inviteAttendee} disabled={isInviting || !inviteEmail.trim()} className="action-chip px-6">
                                    {isInviting ? "Adding..." : "Add Attendee"}
                                </button>
                            </div>
                            {attendeeMsg && <p className="text-sm font-mono text-green-600 mt-2">{attendeeMsg}</p>}
                        </div>
                        <div className="space-y-2">
                            {attendees.length === 0 ? (
                                <div className="py-8 text-center rounded-2xl border border-dashed border-[var(--edge)]">
                                    <p className="body-copy">No attendees enrolled yet. Invite learners by email above.</p>
                                </div>
                            ) : (
                                attendees.map(att => (
                                    <div key={att.id} className="lesson-row justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-[#f2f0eb] flex items-center justify-center border border-[var(--edge)]">
                                                <Users className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-sm">{att.fullName}</h4>
                                                <p className="text-xs text-[var(--ink-soft)] font-mono">{att.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono text-[var(--ink-soft)]">{new Date(att.enrolledAt).toLocaleDateString()}</span>
                                            <button onClick={() => removeAttendee(att.userId)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors" title="Remove">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                )}
            </main>

            {showLessonPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md">
                    <div className="w-full h-full bg-[#fcfbfa] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-[var(--edge)] flex items-center justify-between bg-[#fcfbfa]">
                            <div className="flex items-center gap-4">
                                <span className="mono-note">{editingLessonId ? "Edit Mode" : "Creation"}</span>
                                <h2 className="font-heading text-2xl font-medium">{editingLessonId ? "Update Lesson" : "New Lesson"}</h2>
                            </div>
                            <button onClick={() => setShowLessonPopup(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="px-8 flex border-b border-[var(--edge)] bg-white">
                            <button 
                                onClick={() => setActiveTab("CONTENT")}
                                className={`px-6 py-4 text-sm font-medium transition-all relative ${activeTab === "CONTENT" ? "text-[var(--ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Type className="w-4 h-4" /> Content
                                </div>
                                {activeTab === "CONTENT" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--ink)]" />}
                            </button>
                            <button 
                                onClick={() => setActiveTab("DESCRIPTION")}
                                className={`px-6 py-4 text-sm font-medium transition-all relative ${activeTab === "DESCRIPTION" ? "text-[var(--ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}
                            >
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Description
                                </div>
                                {activeTab === "DESCRIPTION" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--ink)]" />}
                            </button>
                            <button 
                                onClick={() => setActiveTab("ATTACHMENTS")}
                                className={`px-6 py-4 text-sm font-medium transition-all relative ${activeTab === "ATTACHMENTS" ? "text-[var(--ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Paperclip className="w-4 h-4" /> Attachments
                                </div>
                                {activeTab === "ATTACHMENTS" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--ink)]" />}
                            </button>

                        </div>

                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto p-8 bg-[#fcfbfa]">
                            
                            {activeTab === "CONTENT" && (
                                <div className="max-w-2xl mx-auto space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)]">Title</label>
                                            <input 
                                                className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors font-medium" 
                                                value={lessonForm.title}
                                                onChange={e => setLessonForm({...lessonForm, title: e.target.value})}
                                                placeholder="e.g. Introduction to Figma"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)]">Type</label>
                                            <select 
                                                className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors font-medium"
                                                value={lessonForm.type}
                                                onChange={e => setLessonForm({...lessonForm, type: e.target.value as Lesson["type"]})}
                                            >
                                                <option value="VIDEO">Video</option>
                                                <option value="DOCUMENT">Document</option>
                                                <option value="IMAGE">Image</option>
                                                <option value="QUIZ">Quiz</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] flex items-center gap-2">
                                            <UserIcon className="w-3 h-3" /> Responsible (Optional)
                                        </label>
                                        <select 
                                            className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors"
                                            value={lessonForm.responsibleUserId}
                                            onChange={e => setLessonForm({...lessonForm, responsibleUserId: e.target.value})}
                                        >
                                            <option value="">Unassigned</option>
                                            {instructors.map(ins => (
                                                <option key={ins.id} value={ins.id}>{ins.fullName} ({ins.role})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {lessonForm.type === 'VIDEO' && (
                                        <div className="space-y-6 p-6 rounded-2xl border border-blue-100 bg-blue-50/30">
                                            <div className="space-y-2">
                                                <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] flex items-center gap-2">
                                                    <Globe className="w-3 h-3" /> YouTube / Video URL
                                                </label>
                                                <input 
                                                    className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-white outline-none focus:border-blue-500 transition-all font-mono text-sm" 
                                                    value={lessonForm.videoUrl}
                                                    onChange={e => setLessonForm({...lessonForm, videoUrl: e.target.value})}
                                                    placeholder="https://youtube.com/watch?v=..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] flex items-center gap-2">
                                                    <Clock className="w-3 h-3" /> Duration (Seconds)
                                                </label>
                                                <input 
                                                    type="number"
                                                    className="w-32 px-4 py-3 rounded-xl border border-blue-200 bg-white outline-none focus:border-blue-500 transition-all text-right" 
                                                    value={lessonForm.durationSeconds}
                                                    onChange={e => setLessonForm({...lessonForm, durationSeconds: parseInt(e.target.value) || 0})}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {(lessonForm.type === 'DOCUMENT' || lessonForm.type === 'IMAGE') && (
                                         <div className="space-y-6 p-6 rounded-2xl border border-dashed border-[var(--edge)] bg-white">
                                            <div className="flex flex-col items-center justify-center py-8">
                                                <FileUp className="w-12 h-12 text-[var(--ink-soft)] mb-3" />
                                                <p className="text-sm font-medium">Upload {lessonForm.type.toLowerCase()}</p>
                                                <p className="text-xs text-[var(--ink-soft)] mt-1">Recommended: PDF or JPEG under 10MB</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <input 
                                                    className="flex-1 px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none" 
                                                    value={lessonForm.fileUrl}
                                                    onChange={e => setLessonForm({...lessonForm, fileUrl: e.target.value})}
                                                    placeholder="Direct file URL (e.g. S3 Bucket Link)"
                                                />
                                                <label className="action-chip flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                                    <FileUp className="w-3.5 h-3.5" />
                                                    Upload
                                                    <input type="file" className="hidden" accept={lessonForm.type === 'IMAGE' ? 'image/*' : '*/*'} onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        try {
                                                            const url = await uploadFile(file);
                                                            setLessonForm({ ...lessonForm, fileUrl: url });
                                                        } catch (err) {
                                                            alert("Upload failed: " + (err instanceof Error ? err.message : "Internal error"));
                                                        }
                                                    }} />
                                                </label>
                                            </div>
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={lessonForm.allowDownload}
                                                    onChange={e => setLessonForm({...lessonForm, allowDownload: e.target.checked})}
                                                />
                                                <span className="text-sm font-medium">Allow students to download this file</span>
                                            </label>
                                         </div>
                                    )}

                                    {lessonForm.type === 'QUIZ' && !editingLessonId && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-lg font-medium">Quiz Questions</h3>
                                                    <p className="text-sm text-[var(--ink-soft)]">Add your MCQ / MSQ questions below. They will be saved when you publish.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLocalQuizQuestions(prev => [...prev, { tempId: crypto.randomUUID(), text: "", options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] }]);
                                                        setEditingLocalQIdx(localQuizQuestions.length);
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-purple-300 text-purple-600 text-xs font-bold hover:bg-purple-50 transition-colors"
                                                >
                                                    <Plus className="w-3 h-3" /> Add Question
                                                </button>
                                            </div>

                                            {localQuizQuestions.length === 0 && (
                                                <div className="p-12 rounded-3xl border border-dashed border-purple-200 bg-purple-50/30 text-center">
                                                    <HelpCircle className="w-12 h-12 text-purple-200 mx-auto mb-3" />
                                                    <p className="text-sm text-[var(--ink-soft)]">No questions yet. Click <strong>"Add Question"</strong> to start building your quiz.</p>
                                                </div>
                                            )}

                                            {localQuizQuestions.map((lq, qIdx) => (
                                                <div key={lq.tempId} className={`rounded-2xl border p-5 transition-all ${editingLocalQIdx === qIdx ? 'border-purple-300 bg-white shadow-sm' : 'border-[var(--edge)] bg-[#fcfbfa] cursor-pointer hover:border-purple-200'}`}
                                                    onClick={() => setEditingLocalQIdx(qIdx)}
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <span className="font-mono text-[10px] text-[var(--ink-soft)]">Q{qIdx + 1}</span>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setLocalQuizQuestions(prev => prev.filter((_, i) => i !== qIdx)); if (editingLocalQIdx === qIdx) setEditingLocalQIdx(null); }} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                    {editingLocalQIdx === qIdx ? (
                                                        <div className="space-y-4" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                className="w-full text-base font-medium bg-transparent outline-none border-b border-purple-200 focus:border-purple-400 pb-2 transition-colors"
                                                                placeholder="Type your question here..."
                                                                value={lq.text}
                                                                onChange={e => setLocalQuizQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, text: e.target.value } : q))}
                                                            />
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--ink-soft)]">Options (click circle to mark correct)</p>
                                                                {lq.options.map((opt, oIdx) => (
                                                                    <div key={oIdx} className={`flex items-center gap-3 p-2.5 rounded-xl border ${opt.isCorrect ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'}`}>
                                                                        <button type="button" onClick={() => setLocalQuizQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: q.options.map((o, j) => j === oIdx ? { ...o, isCorrect: !o.isCorrect } : o) } : q))}>
                                                                            {opt.isCorrect ? <CheckCircle2 className="w-5 h-5 text-purple-600" /> : <Circle className="w-5 h-5 text-gray-300" />}
                                                                        </button>
                                                                        <input
                                                                            className="flex-1 bg-transparent outline-none text-sm"
                                                                            placeholder={`Option ${oIdx + 1}`}
                                                                            value={opt.text}
                                                                            onChange={e => setLocalQuizQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: q.options.map((o, j) => j === oIdx ? { ...o, text: e.target.value } : o) } : q))}
                                                                        />
                                                                        {lq.options.length > 2 && (
                                                                            <button type="button" onClick={() => setLocalQuizQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: q.options.filter((_, j) => j !== oIdx) } : q))} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                <button type="button" onClick={() => setLocalQuizQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: [...q.options, { text: "", isCorrect: false }] } : q))} className="text-[10px] font-bold text-purple-600 flex items-center gap-1 mt-1">
                                                                    <Plus className="w-3 h-3" /> ADD OPTION
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="text-sm font-medium">{lq.text || <span className="italic text-[var(--ink-soft)]">Untitled Question</span>}</p>
                                                            <p className="text-[10px] text-[var(--ink-soft)] mt-1">{lq.options.length} options · {lq.options.filter(o => o.isCorrect).length} correct</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {lessonForm.type === 'QUIZ' && editingLessonId && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-lg font-medium">Quiz Questions</h3>
                                                    <p className="text-sm text-[var(--ink-soft)]">Manage your MCQ/MSQ questions below.</p>
                                                </div>
                                            </div>
                                            <QuizQuestionEditor 
                                                quizId={course?.lessons.find(l => l.id === editingLessonId)?.quiz?.id || ""} 
                                                token={token || ""} 
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === "DESCRIPTION" && (
                                <div className="max-w-2xl mx-auto">
                                    <div className="space-y-4">
                                        <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)]">Detailed Description</label>
                                        <textarea 
                                            rows={12}
                                            className="w-full p-6 rounded-2xl border border-[var(--edge)] bg-white outline-none focus:border-[var(--ink)] transition-colors leading-relaxed"
                                            value={lessonForm.description}
                                            onChange={e => setLessonForm({...lessonForm, description: e.target.value})}
                                            placeholder="Introduce the specific objectives of this lesson..."
                                        />
                                        <p className="text-xs text-[var(--ink-soft)] italic">Markdown is supported for basic formatting.</p>
                                    </div>
                                </div>
                            )}

                            {activeTab === "ATTACHMENTS" && (
                                <div className="max-w-2xl mx-auto space-y-8">
                                     <div className="bg-white rounded-3xl border border-[var(--edge)] p-8">
                                        <h3 className="text-lg font-medium mb-2">Lesson Resources</h3>
                                        <p className="body-copy-sm mb-6">Attach extra reading, code snippets, or asset files here.</p>
                                        
                                        <div className="space-y-3 mb-8">
                                            {attachments?.length === 0 ? (
                                                <p className="text-sm text-[var(--ink-soft)] italic">No attachments yet.</p>
                                            ) : (
                                                attachments?.map(att => (
                                                    <div key={att.id} className="flex items-center justify-between p-3 rounded-xl bg-[#fcfbfa] border border-[var(--edge)] shadow-sm">
                                                        <div className="flex items-center gap-3">
                                                            {att.kind === 'LINK' ? <LinkIcon className="w-4 h-4 text-blue-500" /> : <Paperclip className="w-4 h-4 text-purple-500" />}
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium">{att.label}</span>
                                                                <span className="text-[10px] text-[var(--ink-soft)] truncate max-w-[200px]">{att.externalUrl || att.fileUrl}</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => { e.preventDefault(); handleDeleteAttachment(att.id); }}
                                                            className="text-red-500 hover:bg-red-50 p-1 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {!editingLessonId ? (
                                            <p className="text-xs text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100 italic">Please save the lesson first before adding attachments.</p>
                                        ) : showAttachmentAdd ? (
                                            <div className="p-6 rounded-2xl border border-[var(--edge)] bg-[#fcfbfa] space-y-4 animate-in fade-in slide-in-from-top-2">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)]">Add {showAttachmentAdd}</span>
                                                    <button onClick={() => setShowAttachmentAdd(null)} className="text-[var(--ink-soft)] hover:text-[var(--ink)]"><X className="w-4 h-4" /></button>
                                                </div>
                                                <input 
                                                    className="w-full px-4 py-2 rounded-xl border border-[var(--edge)] outline-none focus:border-[var(--ink)] transition-colors text-sm" 
                                                    placeholder="Attachment Label (e.g. Source Code)"
                                                    value={attachmentForm.label}
                                                    onChange={e => setAttachmentForm({...attachmentForm, label: e.target.value})}
                                                />
                                                <div className="flex gap-2">
                                                    <input 
                                                        className="flex-1 px-4 py-2 rounded-xl border border-[var(--edge)] outline-none focus:border-[var(--ink)] transition-colors text-sm font-mono" 
                                                        placeholder={showAttachmentAdd === "LINK" ? "https://github.com/..." : "https://s3.amazonaws.com/..."}
                                                        value={attachmentForm.url}
                                                        onChange={e => setAttachmentForm({...attachmentForm, url: e.target.value})}
                                                    />
                                                    {showAttachmentAdd === "FILE" && (
                                                        <label className="action-chip flex items-center gap-2 cursor-pointer whitespace-nowrap py-2">
                                                            <FileUp className="w-3.5 h-3.5" />
                                                            Upload
                                                            <input type="file" className="hidden" onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (!file) return;
                                                                try {
                                                                    const url = await uploadFile(file);
                                                                    setAttachmentForm({ ...attachmentForm, url: url });
                                                                } catch (err) {
                                                                    alert("Upload failed: " + (err instanceof Error ? err.message : "Internal error"));
                                                                }
                                                            }} />
                                                        </label>
                                                    )}
                                                </div>
                                                <button 
                                                    onClick={handleAddAttachment}
                                                    disabled={isSubmitting}
                                                    className="w-full py-2 bg-[var(--ink)] text-white rounded-xl text-sm font-medium hover:bg-[#2a2d43] transition-colors"
                                                >
                                                    {isSubmitting ? "Adding..." : "Add Resource"}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4">
                                                <button 
                                                    onClick={() => setShowAttachmentAdd("FILE")}
                                                    className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-[var(--edge)] hover:bg-gray-50 transition-colors text-sm font-medium"
                                                >
                                                    <FileUp className="w-4 h-4" /> Add File
                                                </button>
                                                <button 
                                                    onClick={() => setShowAttachmentAdd("LINK")}
                                                    className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-[var(--edge)] hover:bg-gray-50 transition-colors text-sm font-medium"
                                                >
                                                    <LinkIcon className="w-4 h-4" /> Add Link
                                                </button>
                                            </div>
                                        )}
                                     </div>
                                </div>
                            )}


                        </div>

                        {/* Footer Actions */}
                        <div className="px-8 py-6 border-t border-[var(--edge)] flex items-center justify-between bg-white sticky bottom-0">
                            <button onClick={() => setShowLessonPopup(false)} className="px-6 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">Cancel</button>
                            <button 
                                onClick={handleSaveLesson}
                                disabled={isSubmitting} 
                                className="action-chip px-12 group"
                            >
                                {isSubmitting ? "Saving changes..." : (editingLessonId ? "Update Lesson" : "Publish Lesson")}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* Contact Modal */}
            {showContactModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <button onClick={() => setShowContactModal(false)} className="absolute top-8 right-8 text-[var(--ink-soft)] hover:text-[var(--ink)]"><X className="w-6 h-6" /></button>
                        <h2 className="font-heading text-3xl font-bold mb-2">Contact Attendees</h2>
                        <p className="body-copy-sm mb-8">Send an email notification to all {attendees.length} enrolled learners of this course.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Subject</label>
                                <input 
                                    className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] outline-none focus:border-[var(--ink)] transition-colors" 
                                    placeholder="Important update about..."
                                    value={contactForm.subject}
                                    onChange={e => setContactForm({...contactForm, subject: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Message</label>
                                <textarea 
                                    rows={8}
                                    className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] outline-none focus:border-[var(--ink)] transition-colors leading-relaxed" 
                                    placeholder="Draft your message to the learners..."
                                    value={contactForm.message}
                                    onChange={e => setContactForm({...contactForm, message: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-[var(--ink-soft)] uppercase tracking-wider">{attendees.length} Recipients targeted</span>
                            <button 
                                onClick={async () => {
                                    if (!token) return;
                                    setIsSendingMail(true);
                                    try {
                                        await apiRequest(`/courses/${params.courseId}/contact`, {
                                            method: "POST",
                                            token,
                                            body: {
                                                subject: contactForm.subject,
                                                body: contactForm.message
                                            }
                                        });
                                        setShowContactModal(false);
                                        setContactForm({ subject: "", message: "" });
                                        alert("Message broadcasted to all attendees!");
                                    } catch (err) {
                                        alert("Failed to send message: " + (err instanceof Error ? err.message : "Error"));
                                    } finally {
                                        setIsSendingMail(false);
                                    }
                                }}
                                disabled={isSendingMail || !contactForm.subject || !contactForm.message}
                                className="action-chip px-8 disabled:opacity-50"
                            >
                                {isSendingMail ? "Sending..." : "Send Message"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
