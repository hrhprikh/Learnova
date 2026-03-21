import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const idSchema = z.string().min(1);

type ReportRow = {
  participantName: string;
  participantEmail: string;
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

      const progress = await prisma.courseProgress.findMany({
        where: {
          courseId
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      });

      const byUser = new Map<string, ReportRow>();

      for (const item of progress) {
        const key = item.user.id;
        byUser.set(key, {
          participantName: item.user.fullName,
          participantEmail: item.user.email,
          completedLessons: item.completedLessons,
          totalLessons: item.totalLessons || totalLessons,
          completionPercent: item.completionPercent,
          status: item.status
        });
      }

      const rows = Array.from(byUser.values());

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
