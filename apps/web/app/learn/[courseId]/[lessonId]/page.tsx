"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Menu, ChevronLeft, ChevronRight, CheckCircle2, HelpCircle, X, Download, ExternalLink } from "lucide-react";
import YouTube, { YouTubeProps } from "react-youtube";
import { ProtectedPage } from "@/components/protected-page";
import { NotificationBell } from "@/components/NotificationBell";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type LessonItem = {
  id: string;
  title: string;
  description: string | null;
  type: "VIDEO" | "DOCUMENT" | "IMAGE" | "QUIZ";
  videoUrl: string | null;
  fileUrl: string | null;
  attachments: Array<{ id: string; label: string; kind: "FILE" | "LINK"; fileUrl: string | null; externalUrl: string | null }>;
  quiz: { id: string; title: string } | null;
  learnerStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  responsibleUser: { id: string; fullName: string } | null;
};

type LessonsResponse = {
  lessons: LessonItem[];
};

function getYouTubeVideoId(url: string) {
  let videoId = "";
  try {
    if (url.includes("youtube.com/watch")) {
      videoId = new URL(url).searchParams.get("v") || "";
    } else if (url.includes("youtu.be/")) {
      videoId = new URL(url).pathname.slice(1);
    } else if (url.includes("youtube.com/embed/")) {
      videoId = new URL(url).pathname.split("/").pop() || "";
    }
  } catch {
    return null;
  }
  return videoId || null;
}

export default function LessonPlayerPage({ params }: { params: { courseId: string; lessonId: string } }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await getCurrentSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return;
      
      const response = await apiRequest<LessonsResponse>(`/courses/${params.courseId}/lessons`, { token: accessToken });
      if (active) {
        setLessons(response.lessons);
        setToken(accessToken);
      }
    }

    load().catch(() => {
      if (active) setLessons([]);
    });

    return () => { active = false; };
  }, [params.courseId]);

  const currentIndex = useMemo(() => lessons.findIndex((m) => m.id === params.lessonId), [lessons, params.lessonId]);
  const current = currentIndex >= 0 ? lessons[currentIndex] : null;
  const previous = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  useEffect(() => {
    async function markStart() {
      if (!token || !current) return;
      await apiRequest(`/lessons/${current.id}/start`, { method: "POST", token });
    }
    markStart().catch(() => null);
  }, [token, current?.id]);

  async function markComplete() {
    if (!token || !current) return;
    try {
      await apiRequest(`/lessons/${current.id}/complete`, { method: "POST", token });
      setLessons(prev => prev.map(l => l.id === current.id ? { ...l, learnerStatus: "COMPLETED" } : l));
    } catch (err) {
      console.error(err);
    }
  }

  const onPlayerEnd: YouTubeProps['onEnd'] = async () => {
    await markComplete();
  };

  const progressPercent = lessons.length ? Math.round((lessons.filter(l => l.learnerStatus === "COMPLETED").length / lessons.length) * 100) : 0;

  return (
    <ProtectedPage>
      <div className="h-screen bg-white flex overflow-hidden font-sans text-[var(--ink)]">
        {/* Sidebar */}
        <aside 
          className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-[var(--edge)] transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:block"}`}
        >
          <div className="flex flex-col h-full">
            <header className="h-16 flex items-center px-6 border-b border-[var(--edge)] shrink-0">
              <Link href={`/courses/${params.courseId}`} className="flex items-center gap-2 group">
                <ChevronLeft className="w-4 h-4 text-[var(--ink-soft)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest font-semibold">Course Home</span>
              </Link>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="mb-6 px-2">
                <p className="font-mono text-[9px] uppercase tracking-tighter text-[var(--ink-soft)] mb-2">Module Progress</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--ink)] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <span className="font-mono text-[10px]">{progressPercent}%</span>
                </div>
              </div>

              <nav className="space-y-1">
                {lessons.map((lesson, idx) => (
                  <Link
                    key={lesson.id}
                    href={`/learn/${params.courseId}/${lesson.id}`}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all ${lesson.id === params.lessonId ? "bg-[var(--ink)] text-white shadow-lg" : "text-[var(--ink-soft)] hover:bg-gray-50"}`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border font-mono text-[9px] ${lesson.id === params.lessonId ? "border-white/30 bg-white/10" : "border-[var(--edge)] bg-white"}`}>
                      {lesson.learnerStatus === "COMPLETED" ? <CheckCircle2 className="w-3 h-3" /> : idx + 1}
                    </div>
                    <span className="flex-1 truncate font-medium">{lesson.title}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </aside>

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#FCFBFA] relative">
          <header className="h-16 flex items-center justify-between px-6 border-b border-[var(--edge)] bg-white/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors lg:flex"
              >
                <Menu className="w-5 h-5 text-[var(--ink-soft)]" />
              </button>
              <div className="h-4 w-px bg-[var(--edge)] hidden sm:block" />
              <div className="hidden sm:block">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--ink-soft)] mb-0.5">Currently Learning</p>
                <h2 className="text-xs font-semibold truncate max-w-[200px] lg:max-w-md">{current?.title}</h2>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell />
              <Link
                href={`/courses/${params.courseId}`}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-[var(--ink-soft)]"
              >
                <X className="w-5 h-5" />
              </Link>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
               <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                     <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-mono text-[10px] uppercase tracking-widest font-bold border border-blue-100">{current?.type}</span>
                     {current?.responsibleUser && (
                        <span className="font-mono text-[10px] text-[var(--ink-soft)] uppercase tracking-widest flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                           Expert: {current.responsibleUser.fullName}
                        </span>
                     )}
                  </div>
                  <h1 className="font-heading text-4xl lg:text-5xl font-semibold tracking-tight text-[var(--ink)] leading-[1.1]">{current?.title}</h1>
               </div>
               
               {current?.description && (
                  <p className="mt-6 text-lg text-[var(--ink-soft)] leading-relaxed font-serif max-w-2xl">
                    {current.description}
                  </p>
                )}
              </div>

              <div className="bg-white rounded-[2.5rem] border border-[var(--edge)] shadow-sm overflow-hidden min-h-[400px]">
                {current?.type === "VIDEO" && current.videoUrl && (
                  <div className="p-4 bg-[#f2f0eb]">
                    <div className="relative w-full aspect-video rounded-[1.5rem] overflow-hidden bg-[var(--ink)] shadow-2xl">
                      <YouTube
                        videoId={getYouTubeVideoId(current.videoUrl) || ""}
                        opts={{ width: '100%', height: '100%', playerVars: { autoplay: 0, rel: 0, modestbranding: 1, color: 'white' } }}
                        onEnd={onPlayerEnd}
                        className="absolute inset-0 w-full h-full"
                      />
                    </div>
                  </div>
                )}

                {current?.type === "IMAGE" && current.fileUrl && (
                  <div className="p-4 flex items-center justify-center bg-[#f2f0eb]">
                    <div className="relative rounded-[1.5rem] overflow-hidden shadow-2xl max-h-[80vh]">
                      <img src={current.fileUrl} alt={current.title} className="max-w-full h-auto object-contain" />
                    </div>
                  </div>
                )}

                {current?.type === "DOCUMENT" && current.fileUrl && (
                  <div className="h-[70vh] flex flex-col bg-white">
                    <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--edge)] bg-gray-50/50">
                      <span className="font-mono text-[10px] text-[var(--ink-soft)]">Document Viewer</span>
                      <a href={current.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                        Open in New Tab <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <iframe src={current.fileUrl} className="flex-1 w-full border-0" title="Document Preview" />
                  </div>
                )}

                {current?.type === "QUIZ" && current.quiz && (
                  <div className="p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6">
                      <HelpCircle className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-semibold mb-2">Knowledge Check</h3>
                    <p className="text-[var(--ink-soft)] mb-8 max-w-sm">This lesson requires completing a quiz to proceed.</p>
                    <Link href={`/quiz/${current.quiz.id}`} className="action-chip px-12 py-4 text-base">Start Quiz</Link>
                  </div>
                )}
              </div>

              {current?.attachments && current.attachments.length > 0 && (
                <div className="mt-12 p-8 rounded-3xl border border-[var(--edge)] bg-white">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mb-4">Resources</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {current.attachments.map(att => (
                      <a key={att.id} href={att.kind === "LINK" ? att.externalUrl! : att.fileUrl!} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--edge)] hover:bg-gray-50 transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-[var(--edge)] group-hover:bg-white transition-colors text-[var(--ink-soft)]">
                          {att.kind === "LINK" ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-semibold truncate">{att.label}</p>
                          <p className="text-[10px] font-mono text-[var(--ink-soft)] uppercase">{att.kind}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>

          <footer className="h-20 bg-white border-t border-[var(--edge)] flex items-center justify-between px-6 lg:px-12 sticky bottom-0 z-30 shrink-0">
            <Link href={previous ? `/learn/${params.courseId}/${previous.id}` : "#"} className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition-all ${previous ? "hover:bg-gray-50 text-[var(--ink)]" : "opacity-30 pointer-events-none"}`}>
              <ChevronLeft className="w-4 h-4" /> Previous
            </Link>

            <button onClick={markComplete} className="bg-[var(--ink)] text-white text-xs font-bold px-8 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50">
              {current?.learnerStatus === "COMPLETED" ? "✓ Completed" : "Mark as Complete"}
            </button>

            <Link href={next ? `/learn/${params.courseId}/${next.id}` : "#"} className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition-all ${next ? "bg-[var(--ink)] text-white shadow-md hover:bg-[#2a2d43]" : "opacity-30 pointer-events-none"}`}>
              Next Lesson <ChevronRight className="w-4 h-4" />
            </Link>
          </footer>
        </div>
      </div>
    </ProtectedPage>
  );
}

