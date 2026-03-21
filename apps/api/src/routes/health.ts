import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "learnova-api" });
});

healthRouter.get("/health/db", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", database: "reachable" });
  } catch (error) {
    next(error);
  }
});
