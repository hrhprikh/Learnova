"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import YouTube, { YouTubeProps } from "react-youtube";
import { ProtectedPage } from "@/components/protected-page";
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
  const [showOverlay, setShowOverlay] = useState(false);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await getCurrentSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        return;
      }
      const response = await apiRequest<LessonsResponse>(`/courses/${params.courseId}/lessons`, { token: accessToken });
      if (active) {
        setLessons(response.lessons);
        setToken(accessToken);
      }
    }

    load().catch(() => {
      if (active) {
        setLessons([]);
      }
    });

    return () => {
      active = false;
    };
  }, [params.courseId]);

  const currentIndex = useMemo(() => lessons.findIndex((lesson) => lesson.id === params.lessonId), [lessons, params.lessonId]);
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
    await apiRequest(`/lessons/${current.id}/complete`, { method: "POST", token });
  }

  const onPlayerEnd: YouTubeProps['onEnd'] = async () => {
    await markComplete();
  };

  const progressPercent = lessons.length ? Math.round(((currentIndex + 1) / lessons.length) * 100) : 0;

  return (
    <ProtectedPage>
      <div className="h-screen bg-white flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b border-[var(--edge)] bg-white z-20">
          <div className="flex items-center gap-4">
            <Link href={`/courses/${params.courseId}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="h-4 w-px bg-[var(--edge)]" />
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--ink-soft)] truncate max-w-[260px]">{current?.title ?? "Lesson"}</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 font-mono text-xs">
              <span className="text-[var(--ink-soft)]">Progress</span>
              <div className="w-24 h-1.5 bg-[#f2f0eb] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--accent-blue)]" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="ml-1">{progressPercent}%</span>
            </div>
            <button className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded bg-[#f2f0eb] hover:bg-[#e9e6df] transition-colors group" onClick={() => setShowOverlay((v) => !v)}>
              <Menu className="w-4 h-4 text-[var(--ink-soft)] group-hover:text-[var(--ink)]" />
              <span>Index</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative flex justify-center bg-[#FCFBFA]">
          {showOverlay ? (
            <aside className="fixed top-20 right-6 z-30 w-[320px] max-w-[85vw] rounded-2xl border border-[var(--edge)] bg-white p-4 shadow-2xl">
              <p className="mono-note">course index</p>
              <ul className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/learn/${params.courseId}/${lesson.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm ${lesson.id === current?.id ? "bg-[#f2f0eb] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:bg-[#f7f5f0]"}`}
                    >
                      {lesson.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}

          <div className="w-full max-w-4xl py-12 px-6 lg:py-24 lg:px-16 pb-40 lg:pb-48">
            <div className="mb-12">
              <span className="font-mono text-sm text-[var(--accent-peach)] mb-4 block">Lesson {String(Math.max(currentIndex + 1, 1)).padStart(2, "0")}</span>
              <h1 className="font-heading text-4xl lg:text-5xl font-semibold text-[var(--ink)] leading-tight">{current?.title ?? "Loading lesson..."}</h1>
            </div>

            <div className="prose prose-lg prose-headings:font-heading prose-headings:font-medium prose-p:text-[var(--ink)]/80 prose-p:leading-relaxed mx-auto">
              <p>{current?.description ?? "Keep distractions low and focus on one lesson at a time."}</p>
            </div>

            <article className="mt-10 bg-white border border-[var(--edge)] rounded-2xl p-6">
              {current?.type === "VIDEO" && current.videoUrl ? (
                <div className="space-y-3 mb-8">
                  <h2 className="text-xl font-semibold mb-4">Video Lesson</h2>
                  {getYouTubeVideoId(current.videoUrl) ? (
                    <div className="w-full rounded-2xl lg:rounded-[2rem] p-2 bg-[#f2f0eb] border border-[var(--edge)] shadow-inner mb-4 relative z-10 transition-transform">
                      <div className="relative w-full aspect-video rounded-xl lg:rounded-2xl overflow-hidden bg-[var(--ink)] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.4)] border border-[var(--ink)]">
                        <YouTube
                          videoId={getYouTubeVideoId(current.videoUrl)!}
                          opts={{
                            width: '100%',
                            height: '100%',
                            playerVars: {
                              autoplay: 0,
                              rel: 0,
                              modestbranding: 1,
                              color: 'white',
                              iv_load_policy: 3,
                              controls: 1
                            }
                          }}
                          onEnd={onPlayerEnd}
                          className="absolute inset-0 w-full h-full"
                          iframeClassName="w-full h-full"
                        />
                      </div>
                    </div>
                  ) : (
                    <a href={current.videoUrl} target="_blank" rel="noreferrer" className="floating-link inline-flex">Open video source</a>
                  )}
                </div>
              ) : null}

              {current?.type === "DOCUMENT" && current.fileUrl ? (
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold">Document Lesson</h2>
                  <a href={current.fileUrl} target="_blank" rel="noreferrer" className="floating-link inline-flex">Open document</a>
                </div>
              ) : null}

              {current?.type === "IMAGE" && current.fileUrl ? (
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold">Image Lesson</h2>
                  <a href={current.fileUrl} target="_blank" rel="noreferrer" className="floating-link inline-flex">Open image resource</a>
                </div>
              ) : null}

              {current?.type === "QUIZ" && current.quiz ? (
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold">Quiz Lesson</h2>
                  <Link href={`/quiz/${current.quiz.id}`} className="action-chip inline-flex">Start quiz</Link>
                </div>
              ) : null}

              {current?.attachments?.length ? (
                <div className="mt-5 space-y-2">
                  <p className="mono-note">attachments</p>
                  {current.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.externalUrl ?? attachment.fileUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="floating-link inline-flex mr-2"
                    >
                      {attachment.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          </div>
        </main>

        <footer className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-lg border border-[var(--edge)] px-4 py-3 rounded-full shadow-2xl flex items-center gap-4 z-20">
          <Link href={previous ? `/learn/${params.courseId}/${previous.id}` : "#"} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${previous ? "text-[var(--ink-soft)] hover:bg-[#f2f0eb]" : "text-[var(--edge)] pointer-events-none"}`}>
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="px-2">
            <button
              onClick={async () => {
                await markComplete();
              }}
              className="bg-[var(--ink)] text-white text-sm font-medium px-6 py-2.5 rounded-full hover:bg-[#2a2d43] transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Mark Complete
            </button>
          </div>
          <Link href={next ? `/learn/${params.courseId}/${next.id}` : "#"} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${next ? "text-[var(--ink)] bg-[#f2f0eb] hover:bg-[#e9e6df]" : "text-[var(--edge)] pointer-events-none"}`}>
            <ChevronRight className="w-5 h-5" />
          </Link>
        </footer>
      </div>
    </ProtectedPage>
  );
}
