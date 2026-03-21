# Learnova LMS - Master Implementation Plan

This document is the execution blueprint for building Learnova end to end.
It is aligned to the problem statement and tech stack, and resolves mismatches from earlier notes.

## 1) Source of Truth and Final Product Rules

### 1.1 Authoritative spec priority
1. `problem-statement.md` is the final business source of truth.
2. `tech-stack.md` is the final technology source of truth.
3. `workflow (1).md` is a process aid, but where it conflicts with the above, this plan follows (1) and (2).

### 1.2 Resolved spec mismatches
- Visibility values are: `EVERYONE`, `SIGNED_IN`.
- Access rules are: `OPEN`, `INVITATION`, `PAYMENT`.
- Badge levels are:
	- Newbie: 20
	- Explorer: 40
	- Achiever: 60
	- Specialist: 80
	- Expert: 100
	- Master: 120
- Quizzes are lessons of type `QUIZ` and are attempted in the full-screen player with one question per page.
- Certificates are not explicitly required by the problem statement, so they are out of scope for v1.

## 2) Target Architecture

## 2.1 High-level system
```text
Next.js Web (Learner + Instructor/Admin UI)
				|
				v
Node.js + Express API (REST /api/v1)
				|
				v
PostgreSQL (Supabase) via Prisma
				|
				+-- Supabase Auth (JWT)
				+-- Supabase Storage (documents/images/attachments)
```

### 2.2 Monorepo structure
```text
learnova/
	apps/
		web/                      # Next.js App Router + TypeScript + Tailwind
		api/                      # Express + TypeScript
	packages/
		shared-types/             # DTOs, enums, validation schemas
	infra/
		docker/                   # Optional local infra configs
	docs/
		api-contracts/
		architecture/
```

## 3) Core Domain Model

### 3.1 Main entities
- User
- Course
- CourseTag
- CourseAttendee (invitation/enrollment mapping)
- Lesson
- LessonAttachment
- Quiz
- QuizQuestion
- QuizOption
- QuizAttempt
- QuizAttemptAnswer
- LessonProgress
- CourseProgress
- Review
- PointLedger
- BadgeDefinition
- UserBadge

### 3.2 Prisma schema outline (v1)
- `User`
	- id, email, fullName, role (`ADMIN` | `INSTRUCTOR` | `LEARNER`), createdAt
- `Course`
	- id, title, description, website, imageUrl, published, visibility, accessRule, price, responsibleUserId, createdById
- `CourseTag`
	- id, courseId, tag
- `CourseAttendee`
	- id, courseId, userId, invitedById, invitedAt, enrolledAt
	- unique(courseId, userId)
- `Lesson`
	- id, courseId, orderIndex, title, type (`VIDEO` | `DOCUMENT` | `IMAGE` | `QUIZ`), description, responsibleUserId
	- videoUrl, durationSeconds, fileUrl, allowDownload
- `LessonAttachment`
	- id, lessonId, kind (`FILE` | `LINK`), fileUrl, externalUrl, label
- `Quiz`
	- id, lessonId, title
	- rewardAttempt1, rewardAttempt2, rewardAttempt3, rewardAttempt4Plus
- `QuizQuestion`
	- id, quizId, orderIndex, text
- `QuizOption`
	- id, questionId, text, isCorrect
- `QuizAttempt`
	- id, quizId, userId, attemptNumber, scorePercent, earnedPoints, completedAt
- `QuizAttemptAnswer`
	- id, attemptId, questionId, optionId
- `LessonProgress`
	- id, lessonId, userId, status (`NOT_STARTED` | `IN_PROGRESS` | `COMPLETED`), startedAt, completedAt, timeSpentSeconds
	- unique(lessonId, userId)
- `CourseProgress`
	- id, courseId, userId, completionPercent, completedLessons, totalLessons, status, startedAt, completedAt
	- unique(courseId, userId)
- `Review`
	- id, courseId, userId, rating, text, createdAt
	- unique(courseId, userId)
- `PointLedger`
	- id, userId, sourceType (`QUIZ` | `MANUAL_ADJUSTMENT`), sourceRefId, points, createdAt
- `BadgeDefinition`
	- id, name, thresholdPoints
- `UserBadge`
	- id, userId, badgeId, achievedAt
	- unique(userId, badgeId)

### 3.3 Non-negotiable constraints
- One review per learner per course.
- One attendee/enrollment row per learner per course.
- Lesson ordering must be deterministic with `orderIndex`.
- Quiz attempt number is sequential per user per quiz.
- Points are append-only via `PointLedger`.

## 4) AuthN and RBAC

### 4.1 Authentication
- Supabase Auth email/password.
- API receives JWT in `Authorization: Bearer <token>`.
- Backend validates token, maps auth user to app `User` record.

### 4.2 Authorization matrix
- Admin
	- full backoffice access.
- Instructor
	- manage own courses, lessons, quizzes, attendees, reporting.
- Learner
	- browse by visibility rules, join/start/continue courses, attempt quizzes, review.

### 4.3 Guardrails
- Ownership checks for instructor course mutations.
- Admin override on reporting/settings.
- Learner cannot access unpublished courses unless instructor/admin preview mode.

## 5) API Design (REST /api/v1)

### 5.1 Auth and users
- `POST /auth/register`
- `POST /auth/sync-user`
- `GET /users/me`

### 5.2 Courses
- `GET /courses` (supports search, filters, view mode metadata)
- `POST /courses`
- `GET /courses/:courseId`
- `PATCH /courses/:courseId`
- `POST /courses/:courseId/publish`
- `POST /courses/:courseId/unpublish`
- `POST /courses/:courseId/share-link`

### 5.3 Attendees and communication
- `POST /courses/:courseId/attendees/invite`
- `POST /courses/:courseId/attendees/contact`
- `GET /courses/:courseId/attendees`

### 5.4 Lessons and content
- `GET /courses/:courseId/lessons`
- `POST /courses/:courseId/lessons`
- `PATCH /lessons/:lessonId`
- `DELETE /lessons/:lessonId`
- `PATCH /courses/:courseId/lessons/reorder`
- `POST /lessons/:lessonId/attachments`

### 5.5 Quizzes
- `POST /courses/:courseId/quizzes`
- `GET /quizzes/:quizId`
- `PATCH /quizzes/:quizId`
- `DELETE /quizzes/:quizId`
- `POST /quizzes/:quizId/questions`
- `PATCH /questions/:questionId`
- `DELETE /questions/:questionId`
- `GET /quizzes/:quizId/take`
- `POST /quizzes/:quizId/submit`

### 5.6 Learner flow
- `POST /courses/:courseId/join`
- `POST /lessons/:lessonId/start`
- `POST /lessons/:lessonId/complete`
- `GET /courses/:courseId/progress`

### 5.7 Reviews and ratings
- `GET /courses/:courseId/reviews`
- `POST /courses/:courseId/reviews`
- `PATCH /courses/:courseId/reviews/me`

### 5.8 Reporting
- `GET /reports/course-progress`
- `GET /reports/course-progress/export.csv`

## 6) Business Logic Rules

### 6.1 Course discoverability and access
- Visibility decides discoverability:
	- `EVERYONE`: visible to guests and signed-in users.
	- `SIGNED_IN`: visible only to authenticated users.
- Access rule decides ability to start lessons:
	- `OPEN`: any eligible viewer can join/start.
	- `INVITATION`: only attendees can start.
	- `PAYMENT`: start only after successful payment flag.
- Guests can browse allowed courses but must sign in to join/start.

### 6.2 Quiz scoring and points
- Learner can attempt quiz multiple times.
- Attempt count `n` is 1-based and monotonic.
- Earned points per attempt:
	- `n=1`: `rewardAttempt1`
	- `n=2`: `rewardAttempt2`
	- `n=3`: `rewardAttempt3`
	- `n>=4`: `rewardAttempt4Plus`
- Award points only when quiz is completed/submitted successfully.

### 6.3 Badge assignment
- Total points = sum of all rows in `PointLedger`.
- Highest earned badge is displayed on profile.
- Badge thresholds:
	- Newbie 20, Explorer 40, Achiever 60, Specialist 80, Expert 100, Master 120.

### 6.4 Progress state machine
- Per lesson: `NOT_STARTED -> IN_PROGRESS -> COMPLETED`.
- Per course:
	- Yet to Start: no lesson started.
	- In Progress: at least one lesson started/completed and not all complete.
	- Completed: all lessons complete and learner clicked "Complete this course" action.

## 7) Frontend Route Plan (Next.js App Router)

### 7.1 Public/Learner
- `/courses` - published courses listing with visibility filters.
- `/my-courses` - learner dashboard with profile panel, points, badges.
- `/courses/[courseId]` - overview, progress, lessons, reviews tab.
- `/learn/[courseId]/[lessonId]` - full-screen player.

### 7.2 Instructor/Admin backoffice
- `/backoffice/courses` - kanban/list dashboard, search, quick create popup.
- `/backoffice/courses/[courseId]` - course form with tabs:
	- Content
	- Description
	- Options
	- Quiz
- `/backoffice/reports` - cards + table + column chooser + export.

### 7.3 Shared UI components
- Course card, lesson status chip, quiz renderer (one question/page), points popup, badge indicator, column selector drawer.

## 8) Implementation Phases and Milestones

### Phase 0 - Foundation (2 days)
- Create monorepo structure.
- Set up linting, formatting, TS configs, env validation.
- Configure Supabase project and local secrets.

Definition of done:
- API and web apps boot successfully.
- CI runs lint + typecheck.

### Phase 1 - Auth + RBAC + Core Course CRUD (3 days)
- JWT validation middleware and role guards.
- Course create/edit/list/publish/unpublish.
- Backoffice course dashboard (list + kanban + search + quick create popup).

Definition of done:
- Instructor can create and publish a course.
- Learner sees only published, allowed courses.

### Phase 2 - Lessons + Attachments + Full-screen Player (4 days)
- Lesson CRUD with type-specific fields.
- Additional attachment support (file/link).
- Full-screen player with sidebar toggle and next content navigation.
- Lesson completion tracking and course progress summary.

Definition of done:
- Learner can start and continue course content end to end.

### Phase 3 - Quiz Builder + Learner Quiz Runtime (4 days)
- Instructor quiz builder: question list, options, correct answers.
- Reward configuration per attempt bucket.
- Learner quiz flow in player: intro, one question per page, completion.
- Attempt persistence and point awarding.

Definition of done:
- Multiple quiz attempts work and points decrease by attempt configuration.

### Phase 4 - Reviews + Gamification + My Courses polish (3 days)
- Ratings/reviews tab and aggregate rating.
- Points popup after quiz completion.
- Badge display with threshold progression.

Definition of done:
- User can review completed course and see accurate badge progression.

### Phase 5 - Reporting + Admin quality pass (3 days)
- Reporting cards and filterable table.
- Column visibility panel and CSV export.
- Access-control hardening and edge-case handling.

Definition of done:
- Instructor/Admin can view learner progress reliably per course.

## 9) Quality Strategy

### 9.1 Automated tests
- API unit tests for services:
	- course visibility/access
	- quiz scoring and points
	- badge assignment
	- progress calculation
- API integration tests for key endpoints.
- Frontend component tests for quiz runner and lesson player navigation.

### 9.2 Manual acceptance checklist
1. Instructor creates course and adds video/document/image/quiz lessons.
2. Instructor configures options (visibility + access rule + price when payment).
3. Instructor invites attendee and publishes course.
4. Learner can discover course under correct visibility rule.
5. Learner can join/start according to access rule.
6. Learner completes lessons and sees progress updates.
7. Learner completes quiz and gets attempt-based points popup.
8. Learner earns badge when crossing threshold.
9. Learner adds review/rating.
10. Instructor reporting cards and table match learner state.

## 10) Performance, Security, and Reliability

### 10.1 Performance
- Paginated list endpoints.
- Indexes on course publication/visibility, enrollment pairs, progress lookups.
- Query-level projections for reporting.

### 10.2 Security
- Strict RBAC at API layer.
- Input validation via schema library (zod).
- Signed upload flows for storage.
- Sanitized rich text output.

### 10.3 Reliability
- Idempotent joins/invitations.
- Transactional quiz submission (attempt + answers + points + badges).
- Central error handling with trace IDs.

## 11) Launch Sequence

1. Seed badge definitions and roles.
2. Create demo users (admin, instructor, learner).
3. Create two demo courses (one open, one invitation-only).
4. Run acceptance checklist.
5. Deploy API, web, and production env vars.
6. Smoke test critical routes and report export.

## 12) Post-v1 Backlog (After Hackathon)

- Payment provider integration for `PAYMENT` rule.
- Mobile app shell reusing same API.
- Rich analytics charts and cohort tracking.
- Notifications (email/in-app) for invites and completions.
- Optional certificate generation.

## 13) Jury Readiness Closure Plan (Execution)

This section tracks closure of the final jury checklist with a strict priority order.

### 13.1 Current closure status
- Completed in this pass:
	- Public courses catalog is accessible and no longer hard-gated by auth.
	- Enrollment actions are wired in learner UI (`Join`, `Start`, `Continue`, `Review` state labels).
	- Course detail supports enrollment and review submission UI.
	- Quiz has a proper intro step before question flow.
	- Hardcoded/broken dashboard quiz shortcut removed.
	- Backend hardening added for review eligibility and duplicate enrollment handling.
	- Progress state machine logic corrected for started-vs-completed distinction.
	- Quiz submit is transactional and protected against duplicate attempt races.

### 13.2 Remaining high-priority items
1. Invitation workflow completeness:
	- Add instructor attendee invitation endpoints and corresponding UI flow.
2. Reporting completion:
	- Expand reporting payload and build dedicated reporting screen with required columns/filters/export.
3. Player polish:
	- Current lesson highlight/status markers in sidebar and smoother resume logic.
4. Operational sign-off:
	- Final lint/typecheck/build pass and full end-to-end scripted rehearsal.

### 13.3 Execution order
1. Finish invitation and reporting (backend + UI).
2. Finalize player/sidebar UX and error/empty states.
3. Run complete jury checklist twice with evidence capture.
