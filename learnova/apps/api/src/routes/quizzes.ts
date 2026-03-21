import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const idSchema = z.string().min(1);

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      optionId: z.string().min(1)
    })
  )
});

function pointsForAttempt(attemptNumber: number, rewards: { r1: number; r2: number; r3: number; r4: number }) {
  if (attemptNumber <= 1) return rewards.r1;
  if (attemptNumber === 2) return rewards.r2;
  if (attemptNumber === 3) return rewards.r3;
  return rewards.r4;
}

async function assignBadges(tx: any, userId: string, totalPoints: number) {
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

    const answerByQuestion = new Map(payload.answers.map((a) => [a.questionId, a.optionId]));
    const total = quiz.questions.length;
    const correct = quiz.questions.reduce((acc: number, q: (typeof quiz.questions)[number]) => {
      const selectedOptionId = answerByQuestion.get(q.id);
      if (!selectedOptionId) return acc;
      const selected = q.options.find((opt: (typeof q.options)[number]) => opt.id === selectedOptionId);
      return selected?.isCorrect ? acc + 1 : acc;
    }, 0);

    const scorePercent = total === 0 ? 0 : Math.round((correct / total) * 100);

    const rewardConfig = {
      r1: quiz.rewardAttempt1,
      r2: quiz.rewardAttempt2,
      r3: quiz.rewardAttempt3,
      r4: quiz.rewardAttempt4Plus
    };

    const transactionResult = await prisma.$transaction(async (tx: any) => {
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
            create: payload.answers.map((answer) => ({
              questionId: answer.questionId,
              optionId: answer.optionId
            }))
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
