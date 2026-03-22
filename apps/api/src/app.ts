import cors from "cors";
import express from "express";
import morgan from "morgan";
import { createRequire } from "node:module";
import { ZodError } from "zod";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { coursesRouter } from "./routes/courses.js";
import { healthRouter } from "./routes/health.js";
import { lessonsRouter } from "./routes/lessons.js";
import { protectedRouter } from "./routes/protected.js";
import { progressRouter } from "./routes/progress.js";
import { quizzesRouter } from "./routes/quizzes.js";
import { reportsRouter } from "./routes/reports.js";
import { notificationsRouter } from "./routes/notifications.js";

export const app = express();

const require = createRequire(import.meta.url);
const helmet = require("helmet") as () => express.RequestHandler;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.use("/api/v1", healthRouter);
app.use("/api/v1", authRouter);
app.use("/api/v1", adminRouter);
app.use("/api/v1", coursesRouter);
app.use("/api/v1", lessonsRouter);
app.use("/api/v1", progressRouter);
app.use("/api/v1", quizzesRouter);
app.use("/api/v1", reportsRouter);
app.use("/api/v1", notificationsRouter);
app.use("/api/v1", protectedRouter);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  void _next;
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation error",
      issues: error.flatten()
    });
  }

  const message = error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ message });
});

export default app;
