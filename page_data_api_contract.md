# Learnova - Page-wise Data Contract Status

This file tracks page data requirements against implemented APIs and DB mappings.

## 1) Dashboard (Learner)
- Data shown: user profile, total points, current badge, enrolled courses, progress summary.
- API calls:
  - `GET /users/me`
  - `GET /courses/enrolled`
  - `GET /progress/summary`
- DB mappings:
  - `User.fullName`, `User.totalPoints`
  - `CourseAttendee`
  - `CourseProgress`
  - `UserBadge`, `BadgeDefinition`

## 2) Explore Courses Page
- Data shown: title, image, tags, lesson count, total duration, published status.
- API call:
  - `GET /courses?search=&filter=`
- DB mappings:
  - `Course`
  - `CourseTag`
  - `Lesson`

## 3) Course Detail Page
- Data shown: course details, lessons list, progress, rating/reviews.
- API calls:
  - `GET /courses/:id`
  - `GET /courses/:id/lessons`
  - `GET /courses/:id/progress`
  - `GET /courses/:id/reviews`
- DB mappings:
  - `Course`
  - `Lesson`
  - `CourseProgress`
  - `Review`

## 4) Enrollment Action
- API call:
  - `POST /courses/:id/join`
- DB mappings:
  - `CourseAttendee`
  - `CourseProgress`

## 5) Learning Player
- API calls:
  - `GET /courses/:courseId/lessons`
  - `GET /lessons/:lessonId`
  - `POST /lessons/:lessonId/start`
  - `POST /lessons/:lessonId/complete`
- DB mappings:
  - `Lesson`
  - `LessonProgress`

## 6) Quiz Page
- API calls:
  - `GET /quizzes/:id/take`
  - `POST /quizzes/:id/submit`
- DB mappings:
  - `Quiz`
  - `QuizQuestion`
  - `QuizOption`
  - `QuizAttempt`

## 7) Quiz Result + Points
- API response fields:
  - `scorePercent`, `earnedPoints`, `attemptNumber`, `totalPoints`
- DB mappings:
  - `QuizAttempt`
  - `User.totalPoints`

## 8) Progress Tracking
- API call:
  - `GET /courses/:id/progress`
- DB mappings:
  - `LessonProgress`
  - `CourseProgress`

## 9) Reviews
- API calls:
  - `GET /courses/:id/reviews`
  - `POST /courses/:id/reviews`
- DB mappings:
  - `Review`
  - `User`

## 10) Instructor Course Dashboard
- API call:
  - `GET /instructor/courses`
- DB mappings:
  - `Course`
  - `Lesson`

## 11) Course Creation Page
- API calls:
  - `POST /courses`
  - `PATCH /courses/:id`
- DB mappings:
  - `Course`
  - `CourseTag`

## 12) Lesson Management
- API calls:
  - `POST /courses/:id/lessons`
  - `PATCH /lessons/:id`
  - `DELETE /lessons/:id`
- DB mappings:
  - `Lesson`
  - `LessonAttachment`

## 13) Quiz Builder (Instructor)
- Current API:
  - `POST /courses/:id/lessons` with `type=QUIZ` creates quiz stub
  - `GET /quizzes/:id/take`
  - `POST /quizzes/:id/submit`
- Planned expansion:
  - dedicated question CRUD endpoints to fully match builder contract
- DB mappings:
  - `Quiz`
  - `QuizQuestion`
  - `QuizOption`

## 14) Reporting Dashboard
- API call:
  - `GET /reports/course-progress?courseId=...`
- DB mappings:
  - `CourseProgress`
  - `User`
  - `Course`

## 15) Access Control
- Visibility controls discoverability via `Course.visibility`.
- Access rule controls start eligibility via `Course.accessRule`.
- Enrollment controls learner participation via `CourseAttendee`.
