import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const roleSchema = z.enum(["ADMIN", "INSTRUCTOR", "LEARNER"]);
const searchSchema = z.string().trim().optional();

const updateRoleSchema = z.object({ role: roleSchema });
const updatePointsSchema = z.object({ totalPoints: z.number().int().min(0) });
const reportQuerySchema = z.object({
  courseId: z.string().min(1).optional(),
  status: z.enum(["YET_TO_START", "IN_PROGRESS", "COMPLETED"]).optional(),
  search: z.string().trim().optional()
});

export const adminRouter = Router();

adminRouter.use("/admin", requireAuth, requireRole("ADMIN"));

adminRouter.get("/admin/overview", async (_req, res, next) => {
  try {
    const [totalUsers, totalCourses, publishedCourses, totalEnrollments, averageProgress, progressStatus] =
      await Promise.all([
        prisma.user.count(),
        prisma.course.count(),
        prisma.course.count({ where: { published: true } }),
        prisma.courseAttendee.count(),
        prisma.courseProgress.aggregate({ _avg: { completionPercent: true } }),
        prisma.courseProgress.groupBy({ by: ["status"], _count: { _all: true } })
      ]);

    const statusMap = new Map(progressStatus.map((item) => [item.status, item._count._all]));

    return res.status(200).json({
      overview: {
        totalUsers,
        totalCourses,
        publishedCourses,
        totalEnrollments,
        yetToStart: statusMap.get("YET_TO_START") ?? 0,
        inProgress: statusMap.get("IN_PROGRESS") ?? 0,
        completed: statusMap.get("COMPLETED") ?? 0,
        averageCompletionPercent: Math.round(averageProgress._avg.completionPercent ?? 0)
      }
    });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/admin/users", async (req, res, next) => {
  try {
    const search = searchSchema.parse(req.query.search);

    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } }
            ]
          }
        : undefined,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        totalPoints: true,
        createdAt: true,
        _count: {
          select: {
            createdCourses: true,
            attendeeCourses: true,
            courseProgress: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return res.status(200).json({ users });
  } catch (error) {
    return next(error);
  }
});

adminRouter.patch("/admin/users/:userId/role", async (req, res, next) => {
  try {
    const userId = z.string().min(1).parse(req.params.userId);
    const payload = updateRoleSchema.parse(req.body);

    if (req.user!.id === userId && payload.role !== "ADMIN") {
      return res.status(400).json({ message: "You cannot remove your own admin role" });
    }

    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: payload.role },
      select: { id: true, fullName: true, email: true, role: true, totalPoints: true }
    });

    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
});

adminRouter.patch("/admin/users/:userId/points", async (req, res, next) => {
  try {
    const userId = z.string().min(1).parse(req.params.userId);
    const payload = updatePointsSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { totalPoints: payload.totalPoints },
      select: { id: true, fullName: true, email: true, role: true, totalPoints: true }
    });

    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/admin/reports/course-progress", async (req, res, next) => {
  try {
    const query = reportQuerySchema.parse(req.query);

    const rows = await prisma.courseProgress.findMany({
      where: {
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        course: { select: { id: true, title: true } }
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    const userIds = Array.from(new Set(rows.map((row) => row.userId)));
    const courseIds = Array.from(new Set(rows.map((row) => row.courseId)));

    const [attendees, lessonProgress] = await Promise.all([
      prisma.courseAttendee.findMany({
        where: { userId: { in: userIds }, courseId: { in: courseIds } },
        select: { userId: true, courseId: true, enrolledAt: true }
      }),
      prisma.lessonProgress.findMany({
        where: { userId: { in: userIds }, lesson: { courseId: { in: courseIds } } },
        select: { userId: true, timeSpentSeconds: true, lesson: { select: { courseId: true } } }
      })
    ]);

    const enrollmentMap = new Map<string, Date | null>();
    for (const attendee of attendees) {
      enrollmentMap.set(`${attendee.userId}:${attendee.courseId}`, attendee.enrolledAt);
    }

    const timeSpentMap = new Map<string, number>();
    for (const lp of lessonProgress) {
      const key = `${lp.userId}:${lp.lesson.courseId}`;
      timeSpentMap.set(key, (timeSpentMap.get(key) ?? 0) + lp.timeSpentSeconds);
    }

    let reportRows = rows.map((row, index) => {
      const key = `${row.userId}:${row.courseId}`;
      return {
        srNo: index + 1,
        courseId: row.courseId,
        courseName: row.course.title,
        participantName: row.user.fullName,
        participantEmail: row.user.email,
        enrolledAt: enrollmentMap.get(key) ?? null,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        timeSpentSeconds: timeSpentMap.get(key) ?? 0,
        completedLessons: row.completedLessons,
        totalLessons: row.totalLessons,
        completionPercent: row.completionPercent,
        status: row.status
      };
    });

    if (query.search) {
      const needle = query.search.toLowerCase();
      reportRows = reportRows.filter(
        (row) =>
          row.courseName.toLowerCase().includes(needle) ||
          row.participantName.toLowerCase().includes(needle) ||
          row.participantEmail.toLowerCase().includes(needle)
      );
    }

    reportRows = reportRows.map((row, index) => ({ ...row, srNo: index + 1 }));

    return res.status(200).json({
      overview: {
        totalParticipants: reportRows.length,
        yetToStart: reportRows.filter((row) => row.status === "YET_TO_START").length,
        inProgress: reportRows.filter((row) => row.status === "IN_PROGRESS").length,
        completed: reportRows.filter((row) => row.status === "COMPLETED").length
      },
      rows: reportRows
    });
  } catch (error) {
    return next(error);
  }
});
