export type UserRole = "ADMIN" | "INSTRUCTOR" | "LEARNER";

export type HealthResponse = {
  status: "ok";
  service?: string;
  database?: "reachable";
};

export type LessonType = "VIDEO" | "DOCUMENT" | "IMAGE" | "QUIZ";

export type CourseSectionLesson = {
  id: string;
  courseId: string;
  sectionId: string | null;
  title: string;
  description: string | null;
  type: LessonType;
  orderIndex: number;
  durationSeconds: number;
  videoUrl: string | null;
  fileUrl: string | null;
  allowDownload: boolean;
  responsibleUserId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  quiz?: {
    id: string;
    title: string;
  } | null;
};

export type CourseSection = {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  isFallback?: boolean;
  lessons: CourseSectionLesson[];
};

export type CourseContentMode = "SECTIONED" | "FALLBACK";

export type CourseContentPayload = {
  mode: CourseContentMode;
  sections: CourseSection[];
};
