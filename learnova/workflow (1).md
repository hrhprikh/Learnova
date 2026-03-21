# Learnova – System Workflow
# Learning Management System (LMS)

---

## 1. Authentication Flow

```text
User opens application
→ Selects Login or Register
→ Enters credentials
→ Supabase Auth validates
→ JWT session issued
→ Role assigned (Admin / Instructor / Learner)
→ User redirected to Dashboard
```

---

## 2. Dashboard Flow

After login, dashboard loads and displays:

- User Profile (name, role, badge level, total points)
- My Courses (enrolled courses with status)
- Progress Overview (completion % per course)
- Gamification Panel (points and badge)

---

## 3. Course Discovery Flow

```text
User selects "Explore Courses"
→ Course listing loads (published + public courses)
→ User searches / filters
→ Selects a course
→ Course Detail Page opens
```

---

## 4. Access Control Flow *(Important)*

Before a learner can access course content:

```text
Course Visibility Check
        │
        ├── Public → Visible to all users
        ├── Unlisted → Accessible via direct link only
        └── Private → Invite / restricted enrollment only
                │
                ▼
        Enrollment Check
                │
                ├── Enrolled → Allow access to lessons
                └── Not Enrolled → Show Enroll button / Deny lesson access
```

---

## 5. Enrollment Flow *(Explicit)*

```text
Learner views Course Detail Page
→ Clicks "Enroll"
→ POST /api/v1/courses/:id/enroll
→ Backend creates Enrollment record
→ Learner added to course
→ Redirect to Lesson Player (first lesson)
```

> Enrollment is stored in the `enrollments` table (user_id + course_id unique pair).
> Duplicate enrollment attempts return a 409 Conflict.

---

## 6. Course & Progress State Transitions

### 6.1 Course State

```text
Draft ──→ Published ──→ Unpublished
  ↑                         │
  └─────────────────────────┘
       (re-publish allowed)
```

| State       | Visible to Learners? |
|-------------|----------------------|
| Draft       | ❌ No                |
| Published   | ✅ Yes               |
| Unpublished | ❌ No                |

### 6.2 User Progress State

```text
Not Started ──→ In Progress ──→ Completed
```

| State       | Trigger                                      |
|-------------|----------------------------------------------|
| Not Started | Enrolled but no lesson opened                |
| In Progress | At least one lesson marked complete          |
| Completed   | All lessons complete (progress = 100%)       |

---

## 7. Learning Flow

```text
User selects "Start" or "Continue"
→ Full-Screen Lesson Player opens
```

**Player Layout**
- Sidebar: course title · lesson list · lesson status (✅ / 🔵)
- Main area: Video (YouTube embed) / PDF / Image / Text
- Navigation: Previous lesson · Next lesson

**Progress Update Logic**
```text
User completes lesson (watches video / reads content)
→ POST /progress/lesson/:id/complete
→ Backend marks lesson complete
→ Course % recalculated
→ Dashboard reflects updated progress
```

---

## 8. Quiz Flow

**Start**
```text
User reaches quiz lesson
→ Quiz intro screen (title, rules, attempt count shown)
→ User clicks "Start Quiz"
```

**Execution**
```text
Question shown → User selects answer → Next question → Submit
```

**Backend Processing**
```text
Evaluate all answers
→ Calculate score %
→ Determine attempt number (1st / 2nd / 3rd+)
→ Assign points based on attempt multiplier
→ Store attempt record
→ Return result
```

**Result Screen**
- Score %, Correct answers revealed, Points earned this attempt

---

## 9. Gamification Flow

```text
Quiz submitted
→ Points awarded (attempt-based)
→ User total_points updated
→ Badge threshold checked
       │
       ├── Threshold not reached → No change
       └── Threshold reached → Badge assigned + user notified
```

**Badge Thresholds**

| Badge     | Points Required |
|-----------|-----------------|
| 🥉 Bronze | 100 pts         |
| 🥈 Silver | 500 pts         |
| 🥇 Gold   | 1,500 pts       |
| 💎 Platinum | 5,000 pts     |

---

## 10. Course Completion & Certificate Flow

```text
All lessons marked complete (progress = 100%)
→ Backend detects full completion
→ Certificate record generated (unique certificate UID)
→ Certificate PDF created
→ Certificate stored (Supabase Storage or DB reference)
→ User notified: "🎉 Course Completed!"
→ User can download certificate from Profile → Certificates page
```

> Certificate includes: Learner name · Course title · Instructor name · Completion date · Unique Certificate ID

---

## 11. Review Flow

```text
After course completion:
User submits rating (1–5 stars) + optional written review
→ Stored in DB
→ Course average rating recalculated
→ Review displayed on course detail page
```

---

## 12. Instructor Workflow

### Course Creation
```text
Instructor Dashboard
→ Create new course (title, description, category, thumbnail)
→ Save as Draft
```

### Content Management
```text
Add lessons
→ Video: paste YouTube / external URL
→ Document: upload PDF (→ Supabase Storage)
→ Image: upload (→ Supabase Storage)
→ Text: write rich text content
→ Add downloadable attachments
```

### Quiz Creation
```text
Add quiz to course / lesson
→ Add questions (MCQ / Multi / True-False)
→ Set correct answers
→ Set points per question
→ Configure max attempts (optional)
```

### Publishing
```text
Set course visibility (Public / Unlisted / Private)
→ Click Publish
→ Course state: Draft → Published
→ Visible to learners in course catalog
```

---

## 13. Reporting Flow

```text
Instructor Dashboard → Analytics tab
→ View per-course data:
   - Total learners enrolled
   - Progress distribution (Not Started / In Progress / Completed)
   - Avg quiz score
   - Avg course rating
→ Export CSV report (per-learner breakdown)
```

---

## 14. Error & Edge Case Handling

```text
Token expiry       → Supabase auto-refresh
Duplicate enroll   → 409 Conflict returned
Quiz interruption  → Attempt can be resumed or restarted
Upload failure     → Client retries with error feedback
Network error      → Graceful error message shown to user
Private course     → Access denied if not invited/enrolled
```

---

## 15. Summary Flow

```text
Login →
Dashboard →
Explore Courses →
[Access Control Check] →
Enroll →
Learn Lessons (Not Started → In Progress) →
Attempt Quizzes →
Earn Points & Badges →
Complete Course (In Progress → Completed) →
Certificate Generated → Download →
Leave Review →
Instructor Analyzes Performance
```