"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Video, FileText, Image as ImageIcon, HelpCircle, Plus, Edit2, Trash2, X, Link as LinkIcon, Paperclip, Clock, User as UserIcon, Type, FileUp, Globe, CheckCircle2, Circle, Save } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";
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
    lessons: Lesson[];
};

export default function InstructorCourseEditor({ params }: { params: { courseId: string } }) {
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    
    // Editor State
    const [showLessonPopup, setShowLessonPopup] = useState(false);
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
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
                if (active) setCourse(response.course);
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
            
            const result = await apiRequest<{ lesson: Lesson }>(url, {
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
        } catch (err) {
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
        } catch (err) {
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
        } catch (err) {
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
                <button onClick={openAddLesson} className="action-chip flex items-center gap-2">
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
                                            <input 
                                                className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] bg-white outline-none" 
                                                value={lessonForm.fileUrl}
                                                onChange={e => setLessonForm({...lessonForm, fileUrl: e.target.value})}
                                                placeholder="Direct file URL (e.g. S3 Bucket Link)"
                                            />
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
                                                <input 
                                                    className="w-full px-4 py-2 rounded-xl border border-[var(--edge)] outline-none focus:border-[var(--ink)] transition-colors text-sm font-mono" 
                                                    placeholder={showAttachmentAdd === "LINK" ? "https://github.com/..." : "https://s3.amazonaws.com/..."}
                                                    value={attachmentForm.url}
                                                    onChange={e => setAttachmentForm({...attachmentForm, url: e.target.value})}
                                                />
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
        </div>
    );
}
