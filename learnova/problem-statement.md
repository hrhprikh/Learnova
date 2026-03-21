Build a responsive eLearning platform with two sides:
1. Instructor/Admin (Backoffice): create and manage courses, lessons, quizzes,
attendees, publish courses to the website, and track learner progress.
2. Learner (Website/App): browse/join courses, learn in a full-screen player,
attempt quizzes (one question per page), earn points/badges, and post
ratings/reviews.
Create a complete learning experience where:
● Instructors can build courses made of video/document/image/quiz lessons.
● Learners can start/continue learning, track progress, and complete a course.
● Quizzes support multiple attempts and award points based on the attempt
number.
● Learners get badges based on total points.
● Instructors can see course-wise learner progress through reporting.
A) Admin
● Full access to back-office features.
● Can manage courses, reporting, and settings.
B) Instructor / Course Manager
Learnova (eLearning Platform)
1) Objective
2) Roles
● Creates and edits courses
● Adds lessons and quizzes
● Publishes/unpublishes courses
● Adds attendees (invites users)
● Views reporting
C) Learner (User)
● View published courses (based on course rules)
● Purchase/Starts/continues lessons
● Attempts quizzes
● Earns points and badges
● Adds ratings and reviews
Guests (not logged in) can view courses only if allowed, but must log in to
start learning.
Module A — Instructor/Admin Backoffice
A1) Courses Dashboard (Kanban/List)
A dashboard that lists all courses.
Must have
● Two views: Kanban and List
● Search courses by name
● For each course show:
○ Course title
○ Tags
○ Views count
3) What you need to build
○ Total lessons count
○ Total duration
○ Published badge (if published on website)
● Actions on each course:
○ Edit (open course form)
○ Share (copy/generate course link)
● Create course:
○ + button opens a small pop-up to enter the course name and create it.
A2) Course Form (Edit Course)
This is the main page to configure a course.
Header actions
● Publish on website toggle (ON/OFF)
● Preview (open learner view)
● Add Attendees (opens wizard to directly add the learner to the course by
sending email)
● Contact Attendees ( opens wizard to contact the attendees by mail)
● Course image upload
Course fields
● Title (required)
● Tags
● Website (required when published)
● Responsible / Course Admin (select a user)
Tabs
1. Content (lessons list)
2. Description (course-level description shown to learners)
3. Options (visibility/access rules + course admin)
4. Quiz (list of quizzes for this course)
A3) Lessons / Content Management
Inside the Content tab:
● Show a list of lessons with:
○ Lesson title
○ Type (Video / Document / Image / Quiz)
○ 3-dot menu: Edit / Delete (delete needs confirmation)
● Button: Add content (opens lesson editor popup)
A4) Lesson/content Editor (Add/Edit Lesson)
Popup editor with 3 tabs:
1) Content tab
● Lesson title (required)
● Lesson type selector: Video / Document / Image
● Responsible (optional)
● Type-specific fields:
○ Video: URL (YouTube/Drive link) + duration
○ Document: upload file + Allow Download toggle
○ Image: upload image + Allow Download toggle
2) Description tab
● Text area or rich editor: lesson description shown to learners.
3) Additional attachment tab
● Add extra resources as:
○ File upload, OR
○ External link (URL)
These attachments must appear on learner's side under the lesson.
A5) Course Options (Access Rules)
In the Options tab configure:
Visibility (“Show course to”)
● Everyone
● Signed In
Access rule
● Open
● On Invitation
● On Payment ( Display ‘Price’ field when Payment access rule is selected)
Course Admin
● Select course admin/responsible person
Meaning
● Visibility decides who can see the course.
● Access rule decides who can start/learn the course.
A6) Quizzes (Instructor side)
In the Quiz tab:
● Show list of quizzes linked to the course.
● Each quiz has Edit/Delete (with confirmation).
● Button: Add Quiz → opens quiz builder.
A7) Quiz Builder (Instructor)
A page to create quiz questions.
Left panel
● Question list (Question 1, Question 2, …)
● Buttons:
○ Add Question
○ Rewards
Question editor
● Question text
● Multiple options (add new option)
● Mark correct option(s)
Rewards
Set points based on attempt number:
● First try → X points
● Second try → Y points
● Third try → Z points
● Fourth try and more → W points
A8) Reporting Dashboard (Instructor/Admin)
Reporting shows course-wise learner progress.
Overview cards
● Total Participants
● Yet to Start
● In Progress
● Completed
Clicking a card filters the table below.
Users table
Each row shows one learner’s progress in one course:
● Sr no.
● Course name
● Participant name
● Enrolled date
● Start date
● Time spent
● Completion percentage
● Completed date
● Status (Yet to Start / In Progress / Completed)
Customizable columns
A side panel allows show/hide columns using checkboxes.
Module B — Learner Website/App
B1) Website Navbar → Courses
A basic website layout with a Courses menu in navbar.
● Clicking it shows all published courses (based on visibility rules).
B2) My Courses Page (Learner Dashboard)
This page shows course cards and learner profile info.
Course cards show
● Cover image
● Title
● Short description
● Tags
● Button changes based on state:
○ Join Course (user not logged in)
○ Start (logged in, not started)
○ Continue (course in progress)
○ Buy course (when the course is paid)
Search
● Search courses by name.
My Profile panel (only on My Courses page)
● Total points
● Badge levels (based on points):
○ Newbie (20 points)
○ Explorer (40 points)
○ Achiever (60 points)
○ Specialist (80 points)
○ Expert (100 points)
○ Master (120 points)
B3) Course Detail Page
Shows course details and progress.
Course Overview tab
● Course title, image, short description
● Progress bar (% completed)
● Total lessons count
● Completed count
● Incomplete count
● Lessons list with status icons:
○ In progress state
○ Completed state (blue tick)
● Search lesson by name
● Clicking a lesson opens the full-screen player.
B4) Ratings & Reviews Tab
Inside the course page:
● Average rating (stars)
● Reviews list (avatar + name + review text)
● Button: Add Review
○ Logged-in user can add rating + review text
B5) Full-Screen Lesson Player
A focused learning view.
Left sidebar
● Course title
● % completed
● Lesson list + status icons
● Show additional attachments under lesson name
● Button/icon to show/hide sidebar
Main area
● Lesson title
● Lesson description (shown at top)
● Viewer area:
○ Video player / Document viewer / Image viewer / Quiz intro/questions
Buttons
● Back (go back to My Courses page)
● Next Content (move to next lesson)
B6) Quiz on Learner Side
Quiz is done inside the full-screen player.
Quiz intro screen
● Shows total questions
● Shows “Multiple attempts”
● Button: Start Quiz
Question pages
● One question per page
● User selects an option and clicks Proceed
● Last question button becomes Proceed and Complete Quiz
After completing quiz:
● Quiz becomes completed (tick in sidebar)
● User earns points based on attempt reward rules
B7) Points Popup + Course Completion
When learner earns points (usually after quiz):
● Show popup: “You have earned X points”
● Show progress to next rank
When all lessons are completed:
● Show button: Complete this course
● Clicking it marks the course as completed.
Publishing
● Only published courses appear on the website/app.
Visibility
● Everyone: course visible to all
● Signed In: only logged-in users can see
Access
● Open: user can start normally
● On Invitation: only invited/enrolled users can access lessons
Progress
● Track lesson completion and show:
○ completed/incomplete status per lesson
○ course % completion
Quiz attempts & points
● Multiple attempts allowed
● Points reduce with more attempts based on the rewards settings
● Total points decide badge level
Why This Hackathon Problem is Important
4) Rules (Simple and Clear)
Real-world learning workflow: Shows how a complete learning platform works
end-to-end (Course setup → Publish → Enrollment/Access → Learning player →
Quiz → Completion → Reviews → Reporting).
Business logic focus: Teaches handling real product rules like visibility vs invitation
access, progress calculation, attempt-based scoring, points/badges, and reporting
accuracy — not just UI screens.
Industry-ready system thinking: Builds a production-like solution with role-based
permissions, structured content management, downloadable resources control,
gamification, and analytics dashboards that reflect actual user behavior.
Mockup: https://link.excalidraw.com/l/65VNwvy7c4X/1lPnE6enQuF