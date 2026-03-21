import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = [
    { email: "admin@learnova.dev", fullName: "Learnova Admin", role: "ADMIN" as const },
    {
      email: "instructor@learnova.dev",
      fullName: "Learnova Instructor",
      role: "INSTRUCTOR" as const
    },
    { email: "learner@learnova.dev", fullName: "Learnova Learner", role: "LEARNER" as const }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { fullName: user.fullName, role: user.role },
      create: user
    });
  }

  const badgeLevels = [
    { name: "Newbie", thresholdPoints: 20 },
    { name: "Explorer", thresholdPoints: 40 },
    { name: "Achiever", thresholdPoints: 60 },
    { name: "Specialist", thresholdPoints: 80 },
    { name: "Expert", thresholdPoints: 100 },
    { name: "Master", thresholdPoints: 120 }
  ];

  for (const badge of badgeLevels) {
    await prisma.badgeDefinition.upsert({
      where: { name: badge.name },
      update: { thresholdPoints: badge.thresholdPoints },
      create: badge
    });
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
