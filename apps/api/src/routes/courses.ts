import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, tryAttachUser } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const visibilityValues = ["EVERYONE", "SIGNED_IN"] as const;
const accessRuleValues = ["OPEN", "INVITATION", "PAYMENT"] as const;

const courseInputSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  website: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  visibility: z.enum(visibilityValues).default("EVERYONE"),
  accessRule: z.enum(accessRuleValues).default("OPEN"),
  price: z.number().positive().optional(),
  tags: z.array(z.string().min(1).max(40)).default([]),
  responsibleUserId: z.string().min(1).optional()
});

const createCourseSchema = courseInputSchema
  .superRefine((value, ctx) => {
    if (value.accessRule === "PAYMENT" && value.price === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Price is required when accessRule is PAYMENT",
        path: ["price"]
      });
    }
  });

const updateCourseSchema = courseInputSchema.partial().superRefine((value, ctx) => {
  if (value.accessRule === "PAYMENT" && value.price === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Price is required when accessRule is PAYMENT",
      path: ["price"]
    });
  }
});

const courseIdSchema = z.string().min(1);

function parseBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

async function enrollLearnerInCourse(courseId: string, userId: string) {
  let attendee;
  try {
    attendee = await prisma.courseAttendee.create({
      data: {
        userId,
        courseId
      }
    });
  } catch (error) {
    const prismaCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : null;
    if (prismaCode === "P2002") {
      return { error: { status: 409, message: "User already enrolled in this course" } };
    }
    throw error;
  }

  await prisma.courseProgress.upsert({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    },
    update: {},
    create: {
      userId,
      courseId,
      status: "YET_TO_START"
    }
  });

  return { attendee };
}

type AppRole = "ADMIN" | "INSTRUCTOR" | "LEARNER";

async function assertCanMutateCourse(courseId: string, userId: string, role: AppRole) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, createdById: true }
  });

  if (!course) {
    return { error: { status: 404, message: "Course not found" } };
  }

  if (role === "ADMIN") {
    return { error: null };
  }

  if (role !== "INSTRUCTOR" || course.createdById !== userId) {
    return { error: { status: 403, message: "You can only modify your own courses" } };
  }

  return { error: null };
}

export const coursesRouter = Router();

coursesRouter.get("/courses/enrolled", requireAuth, async (req, res, next) => {
  try {
    const enrolled = await prisma.courseAttendee.findMany({
      where: { userId: req.user!.id },
      include: {
        course: {
          include: {
            tags: {
              select: { id: true, tag: true }
            },
            lessons: {
              select: { durationSeconds: true }
            }
          }
        }
      },
      orderBy: { enrolledAt: "desc" }
    });

    const progressRows = await prisma.courseProgress.findMany({
      where: { userId: req.user!.id },
      select: {
        courseId: true,
        completionPercent: true,
        status: true
      }
    });

    const progressByCourse = new Map<string, { completionPercent: number; status: string }>(
      progressRows.map((item: { courseId: string; completionPercent: number; status: string }) => [
        item.courseId,
        item
      ])
    );

    return res.status(200).json({
      courses: enrolled.map((item: (typeof enrolled)[number]) => {
        const totalDuration = item.course.lessons.reduce(
          (acc: number, lesson: { durationSeconds: number }) => acc + lesson.durationSeconds,
          0
        );
        const progress = progressByCourse.get(item.course.id);
        return {
          id: item.course.id,
          title: item.course.title,
          description: item.course.description,
          imageUrl: item.course.imageUrl,
          tags: item.course.tags,
          lessonCount: item.course.lessons.length,
          durationSeconds: totalDuration,
          enrolledAt: item.enrolledAt,
          progressPercent: progress?.completionPercent ?? 0,
          progressStatus: progress?.status ?? "YET_TO_START"
        };
      })
    });
  } catch (error) {
    return next(error);
  }
});

coursesRouter.get("/instructor/courses", requireAuth, requireRole("ADMIN", "INSTRUCTOR"), async (req, res, next) => {
  try {
    const where = req.user!.role === "ADMIN" ? {} : { createdById: req.user!.id };

    const courses = await prisma.course.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        tags: {
          select: { id: true, tag: true }
        },
        lessons: {
          select: { durationSeconds: true }
        }
      }
    });

    return res.status(200).json({
      courses: courses.map((course: (typeof courses)[number]) => ({
        ...course,
        lessonCount: course.lessons.length,
        durationSeconds: course.lessons.reduce(
          (acc: number, lesson: { durationSeconds: number }) => acc + lesson.durationSeconds,
          0
        )
      }))
    });
  } catch (error) {
    return next(error);
  }
});

coursesRouter.get("/courses", tryAttachUser, async (req, res, next) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const mine = parseBoolean(req.query.mine);
    const user = req.user;

    if (mine) {
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (user.role !== "ADMIN" && user.role !== "INSTRUCTOR") {
        return res.status(403).json({ message: "Only instructors/admin can use mine filter" });
      }
    }

    const where: Record<string, unknown> = {
      ...(search
        ? {
          title: {
            contains: search,
            mode: "insensitive"
          }
        }
        : {})
    };

    if (mine && user) {
      if (user.role !== "ADMIN") {
        where.createdById = user.id;
      }
    } else {
      where.published = true;
      where.visibility = user ? { in: ["EVERYONE", "SIGNED_IN"] } : "EVERYONE";
    }

    const courses = await prisma.course.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        tags: {
          select: { id: true, tag: true }
        },
        lessons: {
          select: { durationSeconds: true }
        },
        _count: {
          select: {
            attendees: true,
            progress: {
              where: { status: "COMPLETED" }
            }
          }
        }
      }
    });

    return res.status(200).json({
      courses: courses.map((course: (typeof courses)[number]) => ({
        ...course,
        lessonCount: course.lessons.length,
        durationSeconds: course.lessons.reduce(
          (acc: number, lesson: { durationSeconds: number }) => acc + lesson.durationSeconds,
          0
        ),
        attendeesCount: course._count?.attendees ?? 0,
        completedCount: course._count?.progress ?? 0
      }))
    });
  } catch (error) {
    return next(error);
  }
});

coursesRouter.post("/courses/:courseId/join", requireAuth, async (req, res, next) => {
  try {
    const courseId = courseIdSchema.parse(req.params.courseId);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, published: true, visibility: true, accessRule: true }
    });

    if (!course || !course.published) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.accessRule === "INVITATION") {
      return res.status(403).json({ message: "This course requires invitation" });
    }

    if (course.accessRule === "PAYMENT") {
      return res.status(402).json({ message: "This course requires payment" });
    }

    const result = await enrollLearnerInCourse(courseId, req.user!.id);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(200).json({ attendee: result.attendee });
  } catch (error) {
    return next(error);
  }
});

coursesRouter.post("/courses/:courseId/enroll", requireAuth, async (req, res, next) => {
  try {
    const courseId = courseIdSchema.parse(req.params.courseId);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, published: true, visibility: true, accessRule: true }
    });

    if (!course || !course.published) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.accessRule === "INVITATION") {
      return res.status(403).json({ message: "This course requires invitation" });
    }

    if (course.accessRule === "PAYMENT") {
      return res.status(402).json({ message: "This course requires payment" });
    }

    const result = await enrollLearnerInCourse(courseId, req.user!.id);
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(200).json({ attendee: result.attendee });
  } catch (error) {
    return next(error);
  }
});

coursesRouter.get("/courses/:courseId", tryAttachUser, async (req, res, next) => {
  try {
    const courseId = courseIdSchema.parse(req.params.courseId);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        tags: {
          select: { id: true, tag: true }
        },
        lessons: {
          orderBy: { orderIndex: "asc" },
          include: {
            quiz: {
              select: { id: true, title: true }
            }
          }
        }
      }
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const user = req.user;
    const isOwner = !!user && (user.role === "ADMIN" || course.createdById === user.id);

    if (!course.published && !isOwner) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.visibility === "SIGNED_IN" && !user && !isOwner) {
      return res.status(401).json({ message: "Sign in required to access this course" });
    }

    let progress = {
      totalLessons: course.lessons.length,
      completedLessons: 0,
      completionPercent: 0
    };

    if (user) {
      const completedLessons = await prisma.lessonProgress.count({
        where: {
          userId: user.id,
          status: "COMPLETED",
          lesson: { courseId }
        }
      });
      progress = {
        totalLessons: course.lessons.length,
        completedLessons,
        completionPercent:
          course.lessons.length === 0 ? 0 : Math.round((completedLessons / course.lessons.length) * 100)
      };
    }

    return res.status(200).json({ course, progress });
  } catch (error) {
    return next(error);
  }
});

coursesRouter.post(
  "/courses",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res, next) => {
    try {
      const payload = createCourseSchema.parse(req.body);

      const course = await prisma.course.create({
        data: {
          title: payload.title,
          description: payload.description,
          website: payload.website,
          imageUrl: payload.imageUrl,
          visibility: payload.visibility,
          accessRule: payload.accessRule,
          price: payload.price,
          createdById: req.user!.id,
          responsibleUserId: payload.responsibleUserId,
          tags: {
            create: payload.tags.map((tag) => ({ tag }))
          }
        },
        include: {
          tags: {
            select: { id: true, tag: true }
          }
        }
      });

      return res.status(201).json({ course });
    } catch (error) {
      return next(error);
    }
  }
);

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(2000)
});

coursesRouter.get("/courses/:courseId/reviews", async (req, res, next) => {
  try {
    const courseId = courseIdSchema.parse(req.params.courseId);

    const reviews = await prisma.review.findMany({
      where: { courseId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const averageRating =
      reviews.length === 0
        ? 0
        : Number(
          (
            reviews.reduce((acc: number, item: (typeof reviews)[number]) => acc + item.rating, 0) /
            reviews.length
          ).toFixed(1)
        );

    return res.status(200).json({
      averageRating,
      reviews
    });
  } catch (error) {
    return next(error);
  }
});

coursesRouter.post("/courses/:courseId/reviews", requireAuth, async (req, res, next) => {
  try {
    const courseId = courseIdSchema.parse(req.params.courseId);
    const payload = reviewSchema.parse(req.body);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, published: true }
    });

    if (!course || !course.published) {
      return res.status(404).json({ message: "Course not found" });
    }

    const attendee = await prisma.courseAttendee.findUnique({
      where: {
        userId_courseId: {
          userId: req.user!.id,
          courseId
        }
      },
      select: { id: true }
    });

    if (!attendee) {
      return res.status(403).json({ message: "Enroll in this course before reviewing" });
    }

    const completion = await prisma.courseProgress.findUnique({
      where: {
        userId_courseId: {
          userId: req.user!.id,
          courseId
        }
      },
      select: { status: true }
    });

    if (completion?.status !== "COMPLETED") {
      return res.status(403).json({ message: "Complete the course before submitting a review" });
    }

    const review = await prisma.review.upsert({
      where: {
        userId_courseId: {
          userId: req.user!.id,
          courseId
        }
      },
      update: {
        rating: payload.rating,
        text: payload.text
      },
      create: {
        userId: req.user!.id,
        courseId,
        rating: payload.rating,
        text: payload.text
      }
    });

    return res.status(200).json({ review });
  } catch (error) {
    return next(error);
  }
});

coursesRouter.patch(
  "/courses/:courseId",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res, next) => {
    try {
      const courseId = courseIdSchema.parse(req.params.courseId);
      const payload = updateCourseSchema.parse(req.body);

      const permission = await assertCanMutateCourse(courseId, req.user!.id, req.user!.role);
      if (permission.error) {
        return res.status(permission.error.status).json({ message: permission.error.message });
      }

      const updated = await prisma.course.update({
        where: { id: courseId },
        data: {
          ...(payload.title !== undefined ? { title: payload.title } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.website !== undefined ? { website: payload.website } : {}),
          ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
          ...(payload.visibility !== undefined ? { visibility: payload.visibility } : {}),
          ...(payload.accessRule !== undefined ? { accessRule: payload.accessRule } : {}),
          ...(payload.price !== undefined ? { price: payload.price } : {}),
          ...(payload.responsibleUserId !== undefined
            ? { responsibleUserId: payload.responsibleUserId }
            : {}),
          ...(payload.tags
            ? {
              tags: {
                deleteMany: {},
                create: payload.tags.map((tag) => ({ tag }))
              }
            }
            : {})
        },
        include: {
          tags: {
            select: { id: true, tag: true }
          }
        }
      });

      return res.status(200).json({ course: updated });
    } catch (error) {
      return next(error);
    }
  }
);

coursesRouter.post(
  "/courses/:courseId/publish",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res, next) => {
    try {
      const courseId = courseIdSchema.parse(req.params.courseId);
      const permission = await assertCanMutateCourse(courseId, req.user!.id, req.user!.role);
      if (permission.error) {
        return res.status(permission.error.status).json({ message: permission.error.message });
      }

      const course = await prisma.course.update({
        where: { id: courseId },
        data: { published: true }
      });

      return res.status(200).json({ course });
    } catch (error) {
      return next(error);
    }
  }
);

coursesRouter.post(
  "/courses/:courseId/unpublish",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res, next) => {
    try {
      const courseId = courseIdSchema.parse(req.params.courseId);
      const permission = await assertCanMutateCourse(courseId, req.user!.id, req.user!.role);
      if (permission.error) {
        return res.status(permission.error.status).json({ message: permission.error.message });
      }

      const course = await prisma.course.update({
        where: { id: courseId },
        data: { published: false }
      });

      return res.status(200).json({ course });
    } catch (error) {
      return next(error);
    }
  }
);
