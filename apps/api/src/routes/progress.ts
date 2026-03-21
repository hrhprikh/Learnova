import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const idSchema = z.string().min(1);

function computeCourseStatus(
  completed: number,
  total: number,
  startedOrCompleted: number
): "YET_TO_START" | "IN_PROGRESS" | "COMPLETED" {
  if (total === 0) {
    return "YET_TO_START";
  }
  if (completed >= total) {
    return "COMPLETED";
  }
  if (startedOrCompleted > 0) {
    return "IN_PROGRESS";
  }
  return "YET_TO_START";
}

async function refreshCourseProgress(userId: string, courseId: string) {
  const [totalLessons, completedLessons, startedOrCompleted, existing] = await Promise.all([
    prisma.lesson.count({ where: { courseId } }),
    prisma.lessonProgress.count({
      where: {
        userId,
        status: "COMPLETED",
        lesson: { courseId }
      }
    }),
    prisma.lessonProgress.count({
      where: {
        userId,
        status: {
          in: ["IN_PROGRESS", "COMPLETED"]
        },
        lesson: { courseId }
      }
    }),
    prisma.courseProgress.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId
        }
      },
      select: {
        startedAt: true,
        completedAt: true
      }
    })
  ]);

  const completionPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  const status = computeCourseStatus(completedLessons, totalLessons, startedOrCompleted);

  const startedAt =
    status === "YET_TO_START" ? null : (existing?.startedAt ?? new Date());
  const completedAt = status === "COMPLETED" ? (existing?.completedAt ?? new Date()) : null;

  await prisma.courseProgress.upsert({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    },
    update: {
      totalLessons,
      completedLessons,
      completionPercent,
      status,
      startedAt,
      completedAt
    },
    create: {
      userId,
      courseId,
      totalLessons,
      completedLessons,
      completionPercent,
      status,
      startedAt,
      completedAt
    }
  });
}

async function assertLearnerCanTrackCourse(courseId: string, userId: string, role: "ADMIN" | "INSTRUCTOR" | "LEARNER") {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      published: true,
      createdById: true
    }
  });

  if (!course) {
    return { error: { status: 404, message: "Course not found" } };
  }

  if (role === "ADMIN" || (role === "INSTRUCTOR" && course.createdById === userId)) {
    return { error: null };
  }

  if (!course.published) {
    return { error: { status: 404, message: "Course not found" } };
  }

  const attendee = await prisma.courseAttendee.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    },
    select: { id: true }
  });

  if (!attendee) {
    return { error: { status: 403, message: "Enroll in this course to track progress" } };
  }

  return { error: null };
}

export const progressRouter = Router();

progressRouter.post("/lessons/:lessonId/start", requireAuth, async (req, res, next) => {
  try {
    const lessonId = idSchema.parse(req.params.lessonId);

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true }
    });
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const permission = await assertLearnerCanTrackCourse(lesson.courseId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    const progress = await prisma.lessonProgress.upsert({
      where: {
        lessonId_userId: {
          lessonId,
          userId: req.user!.id
        }
      },
      update: {
        status: "IN_PROGRESS",
        startedAt: new Date()
      },
      create: {
        lessonId,
        userId: req.user!.id,
        status: "IN_PROGRESS",
        startedAt: new Date()
      }
    });

    await refreshCourseProgress(req.user!.id, lesson.courseId);

    return res.status(200).json({ progress });
  } catch (error) {
    return next(error);
  }
});

progressRouter.post("/lessons/:lessonId/complete", requireAuth, async (req, res, next) => {
  try {
    const lessonId = idSchema.parse(req.params.lessonId);

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true }
    });
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const permission = await assertLearnerCanTrackCourse(lesson.courseId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    const progress = await prisma.lessonProgress.upsert({
      where: {
        lessonId_userId: {
          lessonId,
          userId: req.user!.id
        }
      },
      update: {
        status: "COMPLETED",
        completedAt: new Date()
      },
      create: {
        lessonId,
        userId: req.user!.id,
        status: "COMPLETED",
        startedAt: new Date(),
        completedAt: new Date()
      }
    });

    await refreshCourseProgress(req.user!.id, lesson.courseId);

    return res.status(200).json({ progress });
  } catch (error) {
    return next(error);
  }
});

progressRouter.get("/progress/summary", requireAuth, async (req, res, next) => {
  try {
    const rows = await prisma.courseProgress.findMany({
      where: { userId: req.user!.id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            imageUrl: true
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return res.status(200).json({
      summary: {
        totalCourses: rows.length,
        completedCourses: rows.filter((row: (typeof rows)[number]) => row.status === "COMPLETED").length,
        inProgressCourses: rows.filter((row: (typeof rows)[number]) => row.status === "IN_PROGRESS").length,
        yetToStartCourses: rows.filter((row: (typeof rows)[number]) => row.status === "YET_TO_START").length
      },
      courses: rows
    });
  } catch (error) {
    return next(error);
  }
});

progressRouter.get("/courses/:courseId/progress", requireAuth, async (req, res, next) => {
  try {
    const courseId = idSchema.parse(req.params.courseId);

    const permission = await assertLearnerCanTrackCourse(courseId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    const [totalLessons, completedLessons] = await Promise.all([
      prisma.lesson.count({ where: { courseId } }),
      prisma.lessonProgress.count({
        where: {
          userId: req.user!.id,
          status: "COMPLETED",
          lesson: { courseId }
        }
      })
    ]);

    const completionPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
    const startedOrCompleted = await prisma.lessonProgress.count({
      where: {
        userId: req.user!.id,
        status: {
          in: ["IN_PROGRESS", "COMPLETED"]
        },
        lesson: { courseId }
      }
    });
    const status = computeCourseStatus(completedLessons, totalLessons, startedOrCompleted);

    return res.status(200).json({
      progress: {
        courseId,
        totalLessons,
        completedLessons,
        incompleteLessons: Math.max(totalLessons - completedLessons, 0),
        completionPercent,
        status
      }
    });
  } catch (error) {
    return next(error);
  }
});
