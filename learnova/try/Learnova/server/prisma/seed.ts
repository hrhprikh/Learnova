import { PrismaClient, Role, Visibility, CourseState, BadgeType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database with Learnova test data...');

    // 1. Create Users (Admin, Instructor, Learners)
    const admin = await prisma.user.upsert({
        where: { email: 'admin@learnova.com' },
        update: {},
        create: {
            email: 'admin@learnova.com',
            password: 'testPassword123!', // Used for API test data, Supabase uses Auth directly
            name: 'System Admin',
            role: Role.ADMIN,
        },
    });

    const instructor = await prisma.user.upsert({
        where: { email: 'instructor@learnova.com' },
        update: {},
        create: {
            email: 'instructor@learnova.com',
            password: 'testPassword123!',
            name: 'Prof. Alex Rivera',
            role: Role.INSTRUCTOR,
        },
    });

    const learner1 = await prisma.user.upsert({
        where: { email: 'learner1@learnova.com' },
        update: {},
        create: {
            email: 'learner1@learnova.com',
            password: 'testPassword123!',
            name: 'Sarah Jenkins',
            role: Role.LEARNER,
            totalPoints: 120, // Bronze range
        },
    });

    const learner2 = await prisma.user.upsert({
        where: { email: 'learner2@learnova.com' },
        update: {},
        create: {
            email: 'learner2@learnova.com',
            password: 'testPassword123!',
            name: 'Michael Chen',
            role: Role.LEARNER,
            totalPoints: 600, // Silver range
        },
    });

    // 2. Create Badges
    await prisma.badge.create({
        data: { userId: learner1.id, type: BadgeType.BRONZE },
    });
    await prisma.badge.create({
        data: { userId: learner2.id, type: BadgeType.SILVER },
    });

    // 3. Create Courses
    const course1 = await prisma.course.create({
        data: {
            title: 'Advanced UI Systems',
            description: 'Understand the spatial relationships between components in modern digital architecture.',
            category: 'Design',
            visibility: Visibility.PUBLIC,
            state: CourseState.PUBLISHED,
            instructorId: instructor.id,
            lessons: {
                create: [
                    {
                        title: 'The Physics of Layout',
                        content: 'Layouts are physical phenomena governed by tension and space.',
                        order: 1,
                    },
                    {
                        title: 'Fluid Typography Scales',
                        content: 'The baseline grid is dead. Embrace fluid typography using CSS clamp.',
                        videoUrl: 'https://youtube.com/watch?v=example1',
                        order: 2,
                    },
                ]
            }
        }
    });

    const course2 = await prisma.course.create({
        data: {
            title: 'Typography Lab',
            description: 'Master the use of experimental layout grids and type scales for the web.',
            category: 'Design',
            visibility: Visibility.PUBLIC,
            state: CourseState.PUBLISHED,
            instructorId: instructor.id,
            lessons: {
                create: [
                    {
                        title: 'Anatomy of Type',
                        order: 1,
                        videoUrl: 'https://youtube.com/watch?v=example2',
                    }
                ]
            }
        }
    });

    // 4. Enroll Learners
    await prisma.enrollment.create({
        data: { userId: learner1.id, courseId: course1.id }
    });
    await prisma.enrollment.create({
        data: { userId: learner2.id, courseId: course1.id }
    });
    await prisma.enrollment.create({
        data: { userId: learner2.id, courseId: course2.id }
    });

    // 5. Create a Quiz for Course 1, Lesson 2
    const lesson2 = await prisma.lesson.findFirst({ where: { title: 'Fluid Typography Scales' } });

    if (lesson2) {
        const quiz1 = await prisma.quiz.create({
            data: {
                title: 'Typography Core Concepts',
                lessonId: lesson2.id,
                questions: {
                    create: [
                        {
                            text: 'When dealing with a fluid typographic scale utilizing CSS clamp, which core problem does it solve in modern layout architecture?',
                            type: 'MCQ',
                            options: JSON.stringify([
                                'Forces all typography to use relative EMS based exclusively on the parent container element.',
                                'Interpolates smoothly between a minimum and maximum font size based on the current viewport width.',
                                'Automatically adjusts line-height calculations irrespective of font-family kerning data.'
                            ]),
                            correctAnswer: 'Interpolates smoothly between a minimum and maximum font size based on the current viewport width.',
                            points: 50,
                        }
                    ]
                }
            }
        });

        // 6. Create attempt for learner2
        await prisma.attempt.create({
            data: {
                userId: learner2.id,
                quizId: quiz1.id,
                score: 100,
                attemptNumber: 1,
                pointsEarned: 50,
            }
        });
    }

    // 7. Track Progress
    const lesson1 = await prisma.lesson.findFirst({ where: { title: 'The Physics of Layout' } });
    if (lesson1) {
        await prisma.progress.create({
            data: {
                userId: learner1.id,
                courseId: course1.id,
                lessonId: lesson1.id,
                completed: true,
            }
        });
    }

    console.log('Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
