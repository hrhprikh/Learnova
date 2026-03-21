import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireSupabaseToken } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const syncUserSchema = z.object({
  fullName: z.string().min(2),
  role: z.enum(["LEARNER", "INSTRUCTOR"]).optional()
});

export const authRouter = Router();

authRouter.post("/auth/sync-user", requireSupabaseToken, async (req, res, next) => {
  try {
    const payload = syncUserSchema.parse(req.body);
    const email = req.authEmail;

    if (!email) {
      return res.status(401).json({ message: "Invalid access token" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    let user;
    if (existing) {
      user = await prisma.user.update({
        where: { email },
        data: {
          fullName: payload.fullName,
          ...(payload.role && existing.role !== "ADMIN" ? { role: payload.role } : {})
        },
        select: { id: true, email: true, fullName: true, role: true }
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          fullName: payload.fullName,
          role: payload.role ?? "LEARNER"
        },
        select: { id: true, email: true, fullName: true, role: true }
      });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/users/instructors", requireAuth, requireRole("ADMIN", "INSTRUCTOR"), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ["INSTRUCTOR", "ADMIN"] }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true
      },
      orderBy: { fullName: "asc" }
    });
    return res.status(200).json({ users });
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/users/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        totalPoints: true,
        createdAt: true,
        badges: {
          include: {
            badge: true
          },
          orderBy: {
            achievedAt: "desc"
          }
        }
      }
    });

    return res.status(200).json({
      user: user
        ? {
          ...user,
          currentBadge: user.badges[0]?.badge?.name ?? null
        }
        : null
    });
  } catch (error) {
    return next(error);
  }
});
