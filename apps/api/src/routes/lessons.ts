import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const lessonTypeValues = ["VIDEO", "DOCUMENT", "IMAGE", "QUIZ"] as const;
const attachmentKindValues = ["FILE", "LINK"] as const;
const idSchema = z.string().min(1);

const lessonInputSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  type: z.enum(lessonTypeValues),
  orderIndex: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().int().nonnegative().default(0),
  videoUrl: z.string().url().optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
  allowDownload: z.boolean().default(false),
  responsibleUserId: z.string().optional().nullable()
});

const attachmentInputSchema = z.object({
  kind: z.enum(attachmentKindValues),
  label: z.string().min(1),
  fileUrl: z.string().url().optional(),
  externalUrl: z.string().url().optional()
});

async function assertCourseOwner(courseId: string, userId: string, role: "ADMIN" | "INSTRUCTOR" | "LEARNER") {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { createdById: true }
  });

  if (!course) {
    return { error: { status: 404, message: "Course not found" } };
  }

  if (role === "ADMIN") {
    return { error: null };
  }

  if (role !== "INSTRUCTOR" || course.createdById !== userId) {
    return { error: { status: 403, message: "You can only modify your own course content" } };
  }

  return { error: null };
}

async function assertLearnerCanAccessCourseContent(courseId: string, userId: string, role: "ADMIN" | "INSTRUCTOR" | "LEARNER") {
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
    return { error: { status: 403, message: "Enroll in this course to access lessons" } };
  }

  return { error: null };
}

export const lessonsRouter = Router();

lessonsRouter.get("/lessons/:lessonId", requireAuth, async (req, res, next) => {
  try {
    const lessonId = idSchema.parse(req.params.lessonId);

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        attachments: true,
        quiz: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const permission = await assertLearnerCanAccessCourseContent(
      lesson.courseId,
      req.user!.id,
      req.user!.role
    );
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    return res.status(200).json({ lesson });
  } catch (error) {
    return next(error);
  }
});

lessonsRouter.get("/courses/:courseId/lessons", requireAuth, async (req, res, next) => {
  try {
    const courseId = idSchema.parse(req.params.courseId);

    const permission = await assertLearnerCanAccessCourseContent(courseId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      orderBy: { orderIndex: "asc" },
      include: {
        attachments: true,
        quiz: {
          select: { id: true, title: true }
        }
      }
    });

    const progress = await prisma.lessonProgress.findMany({
      where: {
        userId: req.user!.id,
        lesson: {
          courseId
        }
      },
      select: {
        lessonId: true,
        status: true
      }
    });

    const progressByLesson = new Map(
      progress.map((item: { lessonId: string; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" }) => [
        item.lessonId,
        item.status
      ])
    );

    return res.status(200).json({
      lessons: lessons.map((lesson: (typeof lessons)[number]) => ({
        ...lesson,
        learnerStatus: progressByLesson.get(lesson.id) ?? "NOT_STARTED"
      }))
    });
  } catch (error) {
    return next(error);
  }
});

lessonsRouter.post(
  "/courses/:courseId/lessons",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res, next) => {
    try {
      const courseId = idSchema.parse(req.params.courseId);
      const payload = lessonInputSchema.parse(req.body);

      const permission = await assertCourseOwner(courseId, req.user!.id, req.user!.role);
      if (permission.error) {
        return res.status(permission.error.status).json({ message: permission.error.message });
      }

      const count = await prisma.lesson.count({ where: { courseId } });
      const lesson = await prisma.lesson.create({
        data: {
          courseId,
          title: payload.title,
          description: payload.description,
          type: payload.type,
          orderIndex: payload.orderIndex ?? count,
          durationSeconds: payload.durationSeconds,
          videoUrl: payload.videoUrl,
          fileUrl: payload.fileUrl,
          allowDownload: payload.allowDownload,
          responsibleUserId: payload.responsibleUserId
        }
      });

      if (payload.type === "QUIZ") {
        await prisma.quiz.create({
          data: {
            lessonId: lesson.id,
            title: `${payload.title} Quiz`
          }
        });
      }

      return res.status(201).json({ lesson });
    } catch (error) {
      return next(error);
    }
  }
);

lessonsRouter.patch(
  "/lessons/:lessonId",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res, next) => {
    try {
      const lessonId = idSchema.parse(req.params.lessonId);
      const payload = lessonInputSchema.partial().parse(req.body);

      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { courseId: true }
      });

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      const permission = await assertCourseOwner(lesson.courseId, req.user!.id, req.user!.role);
      if (permission.error) {
        return res.status(permission.error.status).json({ message: permission.error.message });
      }

      const updated = await prisma.lesson.update({
        where: { id: lessonId },
        data: {
          ...(payload.title !== undefined ? { title: payload.title } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.type !== undefined ? { type: payload.type } : {}),
          ...(payload.orderIndex !== undefined ? { orderIndex: payload.orderIndex } : {}),
          ...(payload.durationSeconds !== undefined ? { durationSeconds: payload.durationSeconds } : {}),
          ...(payload.videoUrl !== undefined ? { videoUrl: payload.videoUrl } : {}),
          ...(payload.fileUrl !== undefined ? { fileUrl: payload.fileUrl } : {}),
          ...(payload.allowDownload !== undefined ? { allowDownload: payload.allowDownload } : {}),
          ...(payload.responsibleUserId !== undefined ? { responsibleUserId: payload.responsibleUserId } : {})
        }
      });

      return res.status(200).json({ lesson: updated });
    } catch (error) {
      return next(error);
    }
  }
);

lessonsRouter.delete(
  "/lessons/:lessonId",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res, next) => {
    try {
      const lessonId = idSchema.parse(req.params.lessonId);

      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { courseId: true }
      });

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      const permission = await assertCourseOwner(lesson.courseId, req.user!.id, req.user!.role);
      if (permission.error) {
        return res.status(permission.error.status).json({ message: permission.error.message });
      }

      await prisma.lesson.delete({ where: { id: lessonId } });
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
);

lessonsRouter.post(
  "/lessons/:lessonId/attachments",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res, next) => {
    try {
      const lessonId = idSchema.parse(req.params.lessonId);
      const payload = attachmentInputSchema.parse(req.body);

      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { courseId: true }
      });

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      const permission = await assertCourseOwner(lesson.courseId, req.user!.id, req.user!.role);
      if (permission.error) {
        return res.status(permission.error.status).json({ message: permission.error.message });
      }

      const attachment = await prisma.lessonAttachment.create({
        data: {
          lessonId,
          kind: payload.kind,
          label: payload.label,
          fileUrl: payload.fileUrl,
          externalUrl: payload.externalUrl
        }
      });

      return res.status(201).json({ attachment });
    } catch (error) {
      return next(error);
    }
  }
);

lessonsRouter.delete(
  "/attachments/:attachmentId",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res, next) => {
    try {
      const attachmentId = idSchema.parse(req.params.attachmentId);

      const attachment = await prisma.lessonAttachment.findUnique({
        where: { id: attachmentId },
        include: {
          lesson: {
            select: { courseId: true }
          }
        }
      });

      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      const permission = await assertCourseOwner(attachment.lesson.courseId, req.user!.id, req.user!.role);
      if (permission.error) {
        return res.status(permission.error.status).json({ message: permission.error.message });
      }

      await prisma.lessonAttachment.delete({ where: { id: attachmentId } });
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
);
