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
