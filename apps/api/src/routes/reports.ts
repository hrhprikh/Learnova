import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const idSchema = z.string().min(1);

type ReportRow = {
  participantName: string;
  participantEmail: string;
  enrolledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  timeSpentSeconds: number;
  completedLessons: number;
  totalLessons: number;
  completionPercent: number;
  status: "YET_TO_START" | "IN_PROGRESS" | "COMPLETED";
};

export const reportsRouter = Router();

reportsRouter.get(
  "/reports/course-progress",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  async (req, res, next) => {
    try {
      const courseId = idSchema.parse(req.query.courseId);

      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          lessons: {
            select: { id: true }
          }
        }
      });

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (req.user!.role !== "ADMIN" && course.createdById !== req.user!.id) {
        return res.status(403).json({ message: "You can only view reports for your own courses" });
      }

      const totalLessons = course.lessons.length;

      // Get progress
      const progress = await prisma.courseProgress.findMany({
        where: { courseId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true }
          }
        }
      });

      // Get enrollment dates
      const attendees = await prisma.courseAttendee.findMany({
        where: { courseId },
        select: { userId: true, enrolledAt: true }
      });
      const enrollmentMap = new Map<string, Date | null>(
        attendees.map((a: { userId: string; enrolledAt: Date | null }) => [a.userId, a.enrolledAt])
      );

      // Get time spent (aggregated from lesson progress)
      const lessonProgress = await prisma.lessonProgress.findMany({
        where: {
          userId: { in: progress.map((p: { userId: string }) => p.userId) },
          lesson: { courseId }
        },
        select: { userId: true, timeSpentSeconds: true }
      });

      const timeSpentMap = new Map<string, number>();
      for (const lp of lessonProgress) {
        timeSpentMap.set(lp.userId, (timeSpentMap.get(lp.userId) || 0) + lp.timeSpentSeconds);
      }

      const rows: ReportRow[] = (progress as unknown as Array<{
        userId: string;
        user: { fullName: string; email: string };
        startedAt: Date | null;
        completedAt: Date | null;
        completedLessons: number;
        totalLessons: number | null;
        completionPercent: number;
        status: string;
      }>).map((p) => ({
        participantName: p.user.fullName,
        participantEmail: p.user.email,
        enrolledAt: enrollmentMap.get(p.userId) ?? null,
        startedAt: p.startedAt,
        completedAt: p.completedAt,
        timeSpentSeconds: timeSpentMap.get(p.userId) || 0,
        completedLessons: p.completedLessons,
        totalLessons: p.totalLessons || totalLessons,
        completionPercent: p.completionPercent,
        status: p.status as "YET_TO_START" | "IN_PROGRESS" | "COMPLETED"
      }));

      return res.status(200).json({
        overview: {
          totalParticipants: rows.length,
          yetToStart: rows.filter((r) => r.status === "YET_TO_START").length,
          inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
          completed: rows.filter((r) => r.status === "COMPLETED").length
        },
        rows
      });
    } catch (error) {
      return next(error);
    }
  }
);
