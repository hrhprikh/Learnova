import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const notificationsRouter = Router();

// GET all notifications for current user
notificationsRouter.get("/notifications", requireAuth, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50 // Limit to latest 50
    });

    return res.status(200).json({ notifications });
  } catch (error) {
    return next(error);
  }
});

// PATCH mark as read
notificationsRouter.patch("/notifications/:id/read", requireAuth, async (req, res, next) => {
  try {
    const id = z.string().parse(req.params.id);
    
    await prisma.notification.updateMany({
      where: { id, userId: req.user!.id },
      data: { read: true }
    });

    return res.status(200).json({ message: "Marked as read" });
  } catch (error) {
    return next(error);
  }
});

// PATCH mark all as read
notificationsRouter.patch("/notifications/read-all", requireAuth, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true }
    });

    return res.status(200).json({ message: "All marked as read" });
  } catch (error) {
    return next(error);
  }
});

// DELETE notification
notificationsRouter.delete("/notifications/:id", requireAuth, async (req, res, next) => {
  try {
    const id = z.string().parse(req.params.id);

    await prisma.notification.deleteMany({
      where: { id, userId: req.user!.id }
    });

    return res.status(200).json({ message: "Notification deleted" });
  } catch (error) {
    return next(error);
  }
});
