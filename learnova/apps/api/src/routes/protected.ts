import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

export const protectedRouter = Router();

protectedRouter.get("/protected/learner-or-higher", requireAuth, (_req, res) => {
  res.status(200).json({ message: "Authenticated route access granted" });
});

protectedRouter.get(
  "/protected/backoffice",
  requireAuth,
  requireRole("ADMIN", "INSTRUCTOR"),
  (_req, res) => {
    res.status(200).json({ message: "Backoffice route access granted" });
  }
);

protectedRouter.get("/protected/admin", requireAuth, requireRole("ADMIN"), (_req, res) => {
  res.status(200).json({ message: "Admin route access granted" });
});
