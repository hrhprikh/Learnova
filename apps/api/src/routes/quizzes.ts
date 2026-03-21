import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const idSchema = z.string().min(1);

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      optionIds: z.array(z.string().min(1))
    })
  )
});

const rewardsSchema = z.object({
  rewardAttempt1: z.number().int().nonnegative(),
  rewardAttempt2: z.number().int().nonnegative(),
  rewardAttempt3: z.number().int().nonnegative(),
  rewardAttempt4Plus: z.number().int().nonnegative()
});

const optionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  isCorrect: z.boolean().default(false)
});

const questionSchema = z.object({
  text: z.string().min(1),
  orderIndex: z.number().int().nonnegative().optional(),
});

const questionUpdateSchema = z.object({
  text: z.string().min(1),
  orderIndex: z.number().int().nonnegative().optional(),
  options: z.array(optionSchema).min(2)
});

function pointsForAttempt(attemptNumber: number, rewards: { r1: number; r2: number; r3: number; r4: number }) {
  if (attemptNumber <= 1) return rewards.r1;
  if (attemptNumber === 2) return rewards.r2;
  if (attemptNumber === 3) return rewards.r3;
  return rewards.r4;
}

async function assignBadges(tx: Prisma.TransactionClient, userId: string, totalPoints: number) {
  const badges = await tx.badgeDefinition.findMany({
    where: {
      thresholdPoints: {
        lte: totalPoints
      }
    }
  });

  for (const badge of badges) {
    await tx.userBadge.upsert({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id
        }
      },
      update: {},
      create: {
        userId,
        badgeId: badge.id
      }
    });
  }
}

async function assertLearnerCanAccessQuiz(quizId: string, userId: string, role: "ADMIN" | "INSTRUCTOR" | "LEARNER") {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lesson: {
        select: {
          courseId: true,
          course: {
            select: {
              published: true,
              createdById: true
            }
          }
        }
      }
    }
  });

  if (!quiz) {
    return { error: { status: 404, message: "Quiz not found" } };
  }

  const course = quiz.lesson.course;

  if (role === "ADMIN" || (role === "INSTRUCTOR" && course.createdById === userId)) {
    return { error: null };
  }

  if (!course.published) {
    return { error: { status: 404, message: "Quiz not found" } };
  }

  const attendee = await prisma.courseAttendee.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId: quiz.lesson.courseId
      }
    },
    select: { id: true }
  });

  if (!attendee) {
    return { error: { status: 403, message: "Enroll in this course to access quiz" } };
  }

  return { error: null };
}

async function assertInstructorCanModifyQuiz(quizId: string, userId: string, role: "ADMIN" | "INSTRUCTOR" | "LEARNER") {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      lesson: {
        select: {
          course: {
            select: { createdById: true }
          }
        }
      }
    }
  });

  if (!quiz) {
    return { error: { status: 404, message: "Quiz not found" } };
  }

  if (role === "ADMIN") {
    return { error: null };
  }

  if (role !== "INSTRUCTOR" || quiz.lesson.course.createdById !== userId) {
    return { error: { status: 403, message: "You can only modify your own course quizzes" } };
  }

  return { error: null };
}

export const quizzesRouter = Router();

quizzesRouter.get("/quizzes/:quizId/take", requireAuth, async (req, res, next) => {
  try {
    const quizId = idSchema.parse(req.params.quizId);

    const permission = await assertLearnerCanAccessQuiz(quizId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            options: {
              select: { id: true, text: true }
            }
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const attemptsCount = await prisma.quizAttempt.count({
      where: {
        quizId,
        userId: req.user!.id
      }
    });

    return res.status(200).json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        totalQuestions: quiz.questions.length,
        nextAttemptNumber: attemptsCount + 1,
        questions: quiz.questions
      }
    });
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.post("/quizzes/:quizId/submit", requireAuth, async (req, res, next) => {
  try {
    const quizId = idSchema.parse(req.params.quizId);
    const payload = submitSchema.parse(req.body);

    const permission = await assertLearnerCanAccessQuiz(quizId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const answerByQuestion = new Map(payload.answers.map((a) => [a.questionId, a.optionIds]));
    const total = quiz.questions.length;
    const correct = quiz.questions.reduce((acc: number, q: (typeof quiz.questions)[number]) => {
      const selectedOptionIds = answerByQuestion.get(q.id) || [];
      const correctOptionIds = q.options.filter(opt => opt.isCorrect).map(opt => opt.id);
      
      if (selectedOptionIds.length !== correctOptionIds.length) return acc;
      const isPerfectMatch = selectedOptionIds.every(id => correctOptionIds.includes(id));
      
      return isPerfectMatch ? acc + 1 : acc;
    }, 0);

    const scorePercent = total === 0 ? 0 : Math.round((correct / total) * 100);

    const rewardConfig = {
      r1: quiz.rewardAttempt1,
      r2: quiz.rewardAttempt2,
      r3: quiz.rewardAttempt3,
      r4: quiz.rewardAttempt4Plus
    };

    const transactionResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const attemptsCount = await tx.quizAttempt.count({
        where: {
          quizId,
          userId: req.user!.id
        }
      });

      const attemptNumber = attemptsCount + 1;
      const earnedPoints = pointsForAttempt(attemptNumber, rewardConfig);

      const attempt = await tx.quizAttempt.create({
        data: {
          quizId,
          userId: req.user!.id,
          attemptNumber,
          scorePercent,
          earnedPoints,
          answers: {
            create: payload.answers.flatMap((answer) => 
              answer.optionIds.map(oid => ({
                questionId: answer.questionId,
                optionId: oid
              }))
            )
          }
        }
      });

      const updatedUser = await tx.user.update({
        where: { id: req.user!.id },
        data: {
          totalPoints: {
            increment: earnedPoints
          }
        },
        select: {
          totalPoints: true
        }
      });

      await assignBadges(tx, req.user!.id, updatedUser.totalPoints);

      return {
        attempt,
        attemptNumber,
        earnedPoints,
        totalPoints: updatedUser.totalPoints
      };
    });

    return res.status(200).json({
      result: {
        attemptId: transactionResult.attempt.id,
        attemptNumber: transactionResult.attemptNumber,
        scorePercent,
        totalQuestions: total,
        correctAnswers: correct,
        earnedPoints: transactionResult.earnedPoints,
        totalPoints: transactionResult.totalPoints
      }
    });
  } catch (error) {
    const prismaCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : null;
    if (prismaCode === "P2002") {
      return res.status(409).json({ message: "Duplicate quiz submission detected. Please retry." });
    }
    return next(error);
  }
});

quizzesRouter.get("/quizzes/:quizId", requireAuth, requireRole("ADMIN", "INSTRUCTOR"), async (req, res, next) => {
  try {
    const quizId = idSchema.parse(req.params.quizId);

    const permission = await assertInstructorCanModifyQuiz(quizId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            options: true
          }
        }
      }
    });

    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    return res.status(200).json({ quiz });
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.put("/quizzes/:quizId/rewards", requireAuth, requireRole("ADMIN", "INSTRUCTOR"), async (req, res, next) => {
  try {
    const quizId = idSchema.parse(req.params.quizId);
    const payload = rewardsSchema.parse(req.body);

    const permission = await assertInstructorCanModifyQuiz(quizId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    const updated = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        rewardAttempt1: payload.rewardAttempt1,
        rewardAttempt2: payload.rewardAttempt2,
        rewardAttempt3: payload.rewardAttempt3,
        rewardAttempt4Plus: payload.rewardAttempt4Plus
      }
    });

    return res.status(200).json({ quiz: updated });
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.post("/quizzes/:quizId/questions", requireAuth, requireRole("ADMIN", "INSTRUCTOR"), async (req, res, next) => {
  try {
    const quizId = idSchema.parse(req.params.quizId);
    const payload = questionSchema.parse(req.body);

    const permission = await assertInstructorCanModifyQuiz(quizId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    const count = await prisma.quizQuestion.count({ where: { quizId } });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId,
        text: payload.text,
        orderIndex: payload.orderIndex ?? count,
      },
      include: {
        options: true
      }
    });

    return res.status(201).json({ question });
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.put("/quizzes/:quizId/questions/:questionId", requireAuth, requireRole("ADMIN", "INSTRUCTOR"), async (req, res, next) => {
  try {
    const quizId = idSchema.parse(req.params.quizId);
    const questionId = idSchema.parse(req.params.questionId);
    const payload = questionUpdateSchema.parse(req.body);

    const permission = await assertInstructorCanModifyQuiz(quizId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    const updatedQuestion = await prisma.$transaction(async (tx) => {
      await tx.quizQuestion.update({
        where: { id: questionId },
        data: {
          text: payload.text,
          ...(payload.orderIndex !== undefined ? { orderIndex: payload.orderIndex } : {})
        }
      });

      await tx.quizOption.deleteMany({
        where: {
          questionId,
          id: { notIn: payload.options.map(o => o.id).filter(id => id !== undefined) as string[] }
        }
      });

      for (const opt of payload.options) {
        if (opt.id) {
          await tx.quizOption.update({
            where: { id: opt.id },
            data: { text: opt.text, isCorrect: opt.isCorrect }
          });
        } else {
          await tx.quizOption.create({
            data: {
              questionId,
              text: opt.text,
              isCorrect: opt.isCorrect
            }
          });
        }
      }

      return await tx.quizQuestion.findUnique({
        where: { id: questionId },
        include: { options: true }
      });
    });

    return res.status(200).json({ question: updatedQuestion });
  } catch (error) {
    return next(error);
  }
});

quizzesRouter.delete("/quizzes/:quizId/questions/:questionId", requireAuth, requireRole("ADMIN", "INSTRUCTOR"), async (req, res, next) => {
  try {
    const quizId = idSchema.parse(req.params.quizId);
    const questionId = idSchema.parse(req.params.questionId);

    const permission = await assertInstructorCanModifyQuiz(quizId, req.user!.id, req.user!.role);
    if (permission.error) {
      return res.status(permission.error.status).json({ message: permission.error.message });
    }

    await prisma.quizQuestion.delete({
      where: { id: questionId }
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

