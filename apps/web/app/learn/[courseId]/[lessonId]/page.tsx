"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, ChevronLeft, ChevronRight, CheckCircle2, HelpCircle, X, Download, ExternalLink } from "lucide-react";
import YouTube, { YouTubeProps } from "react-youtube";
import { ProtectedPage } from "@/components/protected-page";
import { NotificationBell } from "@/components/NotificationBell";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

const VIDEO_COMPLETION_THRESHOLD = 0.8;

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
  section: { id: string; title: string; orderIndex: number } | null;
};

type LessonsResponse = {
  lessons: LessonItem[];
};

type SectionGroup = {
  id: string;
  title: string;
  orderIndex: number;
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
  const watchProgressIntervalRef = useRef<number | null>(null);
  const isMarkingCompleteRef = useRef(false);

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

  const groupedSections = useMemo<SectionGroup[]>(() => {
    const sectionMap = new Map<string, SectionGroup>();
    const fallback: LessonItem[] = [];

    for (const lesson of lessons) {
      if (!lesson.section) {
        fallback.push(lesson);
        continue;
      }
      const existing = sectionMap.get(lesson.section.id);
      if (existing) {
        existing.lessons.push(lesson);
      } else {
        sectionMap.set(lesson.section.id, {
          id: lesson.section.id,
          title: lesson.section.title,
          orderIndex: lesson.section.orderIndex,
          lessons: [lesson]
        });
      }
    }

    const groups = [...sectionMap.values()].sort((a, b) => a.orderIndex - b.orderIndex);
    if (groups.length === 0) {
      return [
        {
          id: "fallback-course-content",
          title: "Course Content",
          orderIndex: 0,
          lessons: [...fallback].sort((a, b) => lessons.findIndex((x) => x.id === a.id) - lessons.findIndex((x) => x.id === b.id))
        }
      ];
    }

    if (fallback.length > 0) {
      groups.push({
        id: "fallback-uncategorized",
        title: "Uncategorized",
        orderIndex: groups.length,
        lessons: [...fallback].sort((a, b) => lessons.findIndex((x) => x.id === a.id) - lessons.findIndex((x) => x.id === b.id))
      });
    }

    return groups;
  }, [lessons]);

  const unlockedSectionIds = useMemo(() => {
    const unlocked = new Set<string>();
    for (let index = 0; index < groupedSections.length; index += 1) {
      const section = groupedSections[index];
      if (!section) {
        continue;
      }

      if (index === 0) {
        unlocked.add(section.id);
        continue;
      }

      const previousSection = groupedSections[index - 1];
      if (!previousSection) {
        continue;
      }

      const previousCompleted = previousSection.lessons.length > 0 && previousSection.lessons.every((lesson) => lesson.learnerStatus === "COMPLETED");
      if (previousCompleted) {
        unlocked.add(section.id);
      }
    }
    return unlocked;
  }, [groupedSections]);

  useEffect(() => {
    async function markStart() {
      if (!token || !current) return;
      await apiRequest(`/lessons/${current.id}/start`, { method: "POST", token });
    }
    markStart().catch(() => null);
  }, [token, current?.id]);

  const stopWatchProgressTracking = useCallback(() => {
    if (watchProgressIntervalRef.current !== null) {
      window.clearInterval(watchProgressIntervalRef.current);
      watchProgressIntervalRef.current = null;
    }
  }, []);

  const markComplete = useCallback(async () => {
    if (!token || !current) return;
    if (current.learnerStatus === "COMPLETED" || isMarkingCompleteRef.current) {
      return;
    }

    isMarkingCompleteRef.current = true;
    try {
      await apiRequest(`/lessons/${current.id}/complete`, { method: "POST", token });
      setLessons(prev => prev.map(l => l.id === current.id ? { ...l, learnerStatus: "COMPLETED" } : l));
    } catch (err) {
      console.error(err);
    } finally {
      isMarkingCompleteRef.current = false;
    }
  }, [token, current]);

  const onPlayerEnd: YouTubeProps['onEnd'] = async () => {
    await markComplete();
  };

  const onPlayerStateChange: YouTubeProps["onStateChange"] = (event) => {
    if (!current || current.type !== "VIDEO") {
      stopWatchProgressTracking();
      return;
    }

    if (event.data === 1) {
      stopWatchProgressTracking();
      watchProgressIntervalRef.current = window.setInterval(() => {
        const duration = event.target.getDuration();
        const currentTime = event.target.getCurrentTime();

        if (!duration || duration <= 0) {
          return;
        }

        if (currentTime / duration >= VIDEO_COMPLETION_THRESHOLD) {
          stopWatchProgressTracking();
          void markComplete();
        }
      }, 1500);
      return;
    }

    if (event.data === 0) {
      stopWatchProgressTracking();
      void markComplete();
      return;
    }

    if (event.data === 2 || event.data === -1 || event.data === 5) {
      stopWatchProgressTracking();
    }
  };

  useEffect(() => {
    stopWatchProgressTracking();
  }, [current?.id, stopWatchProgressTracking]);

  useEffect(() => {
    return () => {
      stopWatchProgressTracking();
    };
  }, [stopWatchProgressTracking]);

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

              <nav className="space-y-4">
                {groupedSections.map((section, sectionIndex) => {
                  const isSectionUnlocked = unlockedSectionIds.has(section.id);
                  return (
                    <div key={section.id} className="space-y-1">
                      <p className="px-2 font-mono text-[9px] uppercase tracking-widest text-[var(--ink-soft)]">
                        Chapter {String(sectionIndex + 1).padStart(2, "0")} · {section.title}
                      </p>
                      {section.lessons.map((lesson) => {
                        const globalIndex = lessons.findIndex((item) => item.id === lesson.id);
                        const isCurrent = lesson.id === params.lessonId;
                        const isLocked = !isSectionUnlocked && !isCurrent;
                        return (
                          <Link
                            key={lesson.id}
                            href={isLocked ? "#" : `/learn/${params.courseId}/${lesson.id}`}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all ${isCurrent ? "bg-[var(--ink)] text-white shadow-lg" : isLocked ? "text-[var(--ink-soft)] opacity-50 cursor-not-allowed" : "text-[var(--ink-soft)] hover:bg-gray-50"}`}
                            onClick={(event) => {
                              if (isLocked) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border font-mono text-[9px] ${isCurrent ? "border-white/30 bg-white/10" : "border-[var(--edge)] bg-white"}`}>
                              {lesson.learnerStatus === "COMPLETED" ? <CheckCircle2 className="w-3 h-3" /> : globalIndex + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="block truncate font-medium">{lesson.title}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
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
                        onStateChange={onPlayerStateChange}
                        className="absolute inset-0 w-full h-full"
                      />
                    </div>
                    <p className="mt-3 text-xs text-[var(--ink-soft)] font-mono uppercase tracking-wider text-center">
                      Auto completes at 80% watched
                    </p>
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

            {current?.type === "QUIZ" ? (
              <span className="text-xs font-semibold text-[var(--ink-soft)]">Completes automatically after quiz submission</span>
            ) : current?.type === "VIDEO" ? (
              <div className="flex flex-col items-center gap-1">
                <button onClick={markComplete} className="bg-[var(--ink)] text-white text-xs font-bold px-8 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50">
                  {current?.learnerStatus === "COMPLETED" ? "✓ Completed" : "Mark as Complete"}
                </button>
                <span className="text-[10px] text-[var(--ink-soft)] font-mono uppercase tracking-wide">Auto-completes at 80% watched too</span>
              </div>
            ) : (
              <button onClick={markComplete} className="bg-[var(--ink)] text-white text-xs font-bold px-8 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50">
                {current?.learnerStatus === "COMPLETED" ? "✓ Completed" : "Mark as Complete"}
              </button>
            )}

            <Link href={next ? `/learn/${params.courseId}/${next.id}` : "#"} className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition-all ${next ? "bg-[var(--ink)] text-white shadow-md hover:bg-[#2a2d43]" : "opacity-30 pointer-events-none"}`}>
              Next Lesson <ChevronRight className="w-4 h-4" />
            </Link>
          </footer>
        </div>
      </div>
    </ProtectedPage>
  );
}

