import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = [
    { email: "admin@learnova.dev", fullName: "Learnova Admin", role: "ADMIN" },
    { email: "instructor@learnova.dev", fullName: "Learnova Instructor", role: "INSTRUCTOR" },
    { email: "learner@learnova.dev", fullName: "Learnova Learner", role: "LEARNER" }
  ];

  const userMap = new Map();

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: { fullName: user.fullName, role: user.role },
      create: user,
      select: { id: true, email: true }
    });

    userMap.set(created.email, created.id);
  }

  const instructorId = userMap.get("instructor@learnova.dev");
  const learnerId = userMap.get("learner@learnova.dev");
  if (!instructorId) {
    throw new Error("Instructor seed user missing");
  }
  if (!learnerId) {
    throw new Error("Learner seed user missing");
  }

  const courseSeeds = [
    {
      title: "Design Sprint Foundations",
      description: "Build and test ideas quickly with studio-style lessons.",
      website: "https://learnova.dev/courses/design-sprint-foundations",
      published: true,
      visibility: "EVERYONE",
      accessRule: "OPEN",
      tags: ["design", "sprint", "studio"]
    },
    {
      title: "Learning Systems Thinking",
      description: "Learn to map learning journeys as adaptive systems.",
      website: "https://learnova.dev/courses/learning-systems-thinking",
      published: true,
      visibility: "SIGNED_IN",
      accessRule: "OPEN",
      tags: ["systems", "strategy"]
    },
    {
      title: "Private Cohort Workshop",
      description: "Invite-only live cohort with guided checkpoints.",
      website: "https://learnova.dev/courses/private-cohort-workshop",
      published: false,
      visibility: "SIGNED_IN",
      accessRule: "INVITATION",
      tags: ["cohort", "invite"]
    }
  ];

  for (const seed of courseSeeds) {
    const existing = await prisma.course.findFirst({
      where: {
        title: seed.title,
        createdById: instructorId
      },
      select: { id: true }
    });

    if (!existing) {
      await prisma.course.create({
        data: {
          title: seed.title,
          description: seed.description,
          website: seed.website,
          published: seed.published,
          visibility: seed.visibility,
          accessRule: seed.accessRule,
          createdById: instructorId,
          responsibleUserId: instructorId,
          tags: {
            create: seed.tags.map((tag) => ({ tag }))
          }
        }
      });
      continue;
    }

    await prisma.course.update({
      where: { id: existing.id },
      data: {
        description: seed.description,
        website: seed.website,
        published: seed.published,
        visibility: seed.visibility,
        accessRule: seed.accessRule,
        responsibleUserId: instructorId,
        tags: {
          deleteMany: {},
          create: seed.tags.map((tag) => ({ tag }))
        }
      }
    });
  }

  const primaryCourse = await prisma.course.findFirst({
    where: {
      title: "Design Sprint Foundations",
      createdById: instructorId
    },
    select: { id: true }
  });

  if (!primaryCourse) {
    throw new Error("Primary seeded course not found");
  }

  await prisma.lesson.deleteMany({ where: { courseId: primaryCourse.id } });

  const lessonSeeds = [
    {
      title: "Orientation and Learning Contract",
      description: "Understand how this learning lab works and define your output goals.",
      type: "VIDEO",
      orderIndex: 0,
      durationSeconds: 480,
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      allowDownload: false
    },
    {
      title: "Studio Notes: Design Systems",
      description: "Read the notebook-style summary and apply hierarchy principles.",
      type: "DOCUMENT",
      orderIndex: 1,
      durationSeconds: 720,
      fileUrl: "https://example.com/learnova/design-systems-notes.pdf",
      allowDownload: true
    },
    {
      title: "Prototype Walkthrough",
      description: "Visual walk-through of interaction decisions and trade-offs.",
      type: "IMAGE",
      orderIndex: 2,
      durationSeconds: 360,
      fileUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3",
      allowDownload: true
    },
    {
      title: "Checkpoint Quiz",
      description: "One question per page, focused and guided.",
      type: "QUIZ",
      orderIndex: 3,
      durationSeconds: 300,
      allowDownload: false
    }
  ];

  const createdLessons = [];

  for (const lessonSeed of lessonSeeds) {
    const lesson = await prisma.lesson.create({
      data: {
        courseId: primaryCourse.id,
        title: lessonSeed.title,
        description: lessonSeed.description,
        type: lessonSeed.type,
        orderIndex: lessonSeed.orderIndex,
        durationSeconds: lessonSeed.durationSeconds,
        videoUrl: lessonSeed.videoUrl,
        fileUrl: lessonSeed.fileUrl,
        allowDownload: lessonSeed.allowDownload,
        attachments:
          lessonSeed.type === "DOCUMENT"
            ? {
                create: [
                  {
                    kind: "FILE",
                    label: "Design system worksheet",
                    fileUrl: "https://example.com/learnova/design-worksheet.pdf"
                  },
                  {
                    kind: "LINK",
                    label: "Reference article",
                    externalUrl: "https://www.nngroup.com/articles/visual-hierarchy-ux-definition/"
                  }
                ]
              }
            : undefined
      }
    });

    createdLessons.push(lesson);
  }

  const quizLesson = createdLessons.find((lesson) => lesson.type === "QUIZ");
  if (!quizLesson) {
    throw new Error("Quiz lesson not created");
  }

  const quiz = await prisma.quiz.create({
    data: {
      lessonId: quizLesson.id,
      title: "Checkpoint Quiz",
      rewardAttempt1: 20,
      rewardAttempt2: 14,
      rewardAttempt3: 9,
      rewardAttempt4Plus: 5,
      questions: {
        create: [
          {
            orderIndex: 0,
            text: "Which element should carry the strongest visual weight in this LMS theme?",
            options: {
              create: [
                { text: "Dense sidebars", isCorrect: false },
                { text: "Typography hierarchy", isCorrect: true },
                { text: "Bright gradients", isCorrect: false },
                { text: "Heavy icon sets", isCorrect: false }
              ]
            }
          },
          {
            orderIndex: 1,
            text: "What keeps the interface memorable without becoming noisy?",
            options: {
              create: [
                { text: "Random colors", isCorrect: false },
                { text: "Consistent spatial rhythm", isCorrect: true },
                { text: "Animated backgrounds", isCorrect: false },
                { text: "Complex widgets", isCorrect: false }
              ]
            }
          }
        ]
      }
    }
  });

  await prisma.lessonProgress.upsert({
    where: {
      lessonId_userId: {
        lessonId: createdLessons[0].id,
        userId: learnerId
      }
    },
    update: {
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date()
    },
    create: {
      lessonId: createdLessons[0].id,
      userId: learnerId,
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date()
    }
  });

  await prisma.lessonProgress.upsert({
    where: {
      lessonId_userId: {
        lessonId: createdLessons[1].id,
        userId: learnerId
      }
    },
    update: {
      status: "IN_PROGRESS",
      startedAt: new Date()
    },
    create: {
      lessonId: createdLessons[1].id,
      userId: learnerId,
      status: "IN_PROGRESS",
      startedAt: new Date()
    }
  });

  if (!quiz?.id) {
    throw new Error("Seeded quiz not created");
  }

  const badgeSeeds = [
    { name: "Newbie", thresholdPoints: 20 },
    { name: "Explorer", thresholdPoints: 40 },
    { name: "Achiever", thresholdPoints: 60 },
    { name: "Specialist", thresholdPoints: 80 },
    { name: "Expert", thresholdPoints: 100 },
    { name: "Master", thresholdPoints: 120 }
  ];

  for (const badge of badgeSeeds) {
    await prisma.badgeDefinition.upsert({
      where: { name: badge.name },
      update: { thresholdPoints: badge.thresholdPoints },
      create: badge
    });
  }

  if (learnerId) {
    const publishedCourses = await prisma.course.findMany({ where: { published: true }, select: { id: true } });
    for (const course of publishedCourses) {
      await prisma.courseAttendee.upsert({
        where: {
          userId_courseId: {
            userId: learnerId,
            courseId: course.id
          }
        },
        update: {},
        create: {
          userId: learnerId,
          courseId: course.id
        }
      });

      const totalLessons = await prisma.lesson.count({ where: { courseId: course.id } });
      await prisma.courseProgress.upsert({
        where: {
          userId_courseId: {
            userId: learnerId,
            courseId: course.id
          }
        },
        update: {
          totalLessons,
          completedLessons: 0,
          completionPercent: 0,
          status: "YET_TO_START"
        },
        create: {
          userId: learnerId,
          courseId: course.id,
          totalLessons,
          completedLessons: 0,
          completionPercent: 0,
          status: "YET_TO_START"
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
