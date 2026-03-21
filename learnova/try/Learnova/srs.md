# Software Requirements Specification (SRS)
# Learnova – Learning Management System (LMS)

**Version:** 2.0  
**Status:** Final  
**Prepared By:** Learnova Engineering Team  

---

## 1. Introduction

### 1.1 Purpose
This document defines the functional and non-functional requirements of Learnova, a web-based LMS for Admins, Instructors, and Learners.

### 1.2 Scope
Learnova enables:
- Instructors to create and publish courses
- Learners to consume content and take quizzes
- Admins to manage system operations

---

## 2. System Overview

### 2.1 Architecture Overview
```text
Next.js Web App ──→ Node.js Backend (Express) ──→ PostgreSQL (Supabase)
```
> 👉 Backend acts as single source of truth

---

## 3. User Roles

| Role       | Description                   |
|------------|-------------------------------|
| Admin      | Full system control           |
| Instructor | Course creation & management  |
| Learner    | Course consumption            |
| Guest      | Browse only                   |

---

## 4. System Flow (End-to-End)

```text
Create Course → Add Lessons → Add Quiz → Publish →
User Enroll → Learn → Attempt Quiz →
Earn Points → Complete Course → Review →
Instructor Views Analytics
```

---

## 5. State Transitions

### 5.1 Course State
```text
Draft → Published → Unpublished
```

### 5.2 User Progress State
```text
Not Started → In Progress → Completed
```

---

## 6. Functional Requirements

### 6.1 Authentication
- Register/Login via Supabase Auth
- Supabase JWT session management
- Role-based access (Admin / Instructor / Learner)

### 6.2 Course Management
- Create/Edit/Delete course
- Publish/Unpublish
- Set visibility (Public / Private / Unlisted)

### 6.3 Lesson Management
- Add video (YouTube/external URL), document (PDF), image, text
- Upload attachments (PDFs, images via Supabase Storage)
- Mark preview content

### 6.4 Quiz System
- Create questions (MCQ, Multi, True/False)
- Multiple attempts with reduced points per attempt
- Auto evaluation

### 6.5 Learning Module
- Full-screen lesson player
- Course sidebar navigation
- Next / Previous lesson

### 6.6 Progress Tracking
- Track lesson completion
- Calculate % completion
- Store last position

### 6.7 Gamification

**Attempt-Based Scoring**

| Attempt | Points Awarded  |
|---------|-----------------|
| 1st     | Full Points     |
| 2nd     | Reduced Points  |
| 3rd     | Lower Points    |
| 4th+    | Minimum Points  |

**Badge Levels**
- 🥉 Bronze
- 🥈 Silver
- 🥇 Gold
- 💎 Platinum

### 6.8 Reviews
- Add rating & review after course completion
- Display average rating

### 6.9 Reporting
- Course analytics
- Learner progress
- Export reports

---

## 7. Data Flow Diagram (DFD)

```text
User → Browser → API → Backend (Express) → PostgreSQL (Supabase)
                              ↓
                       Supabase Storage
                       Supabase Auth
```

---

## 8. Non-Functional Requirements

**Performance**
- API < 300ms
- Page load < 2s

**Security**
- Supabase Auth (JWT-based)
- HTTPS
- Input validation (Zod)

**Scalability**
- Horizontal scaling via Railway

---

## 9. Constraints

- Platform: **Web only**
- Backend: Node.js + Express + TypeScript
- Frontend: Next.js + Tailwind CSS
- ORM: Prisma
- DB: PostgreSQL on **Supabase**
- Videos: URL only (YouTube/external) — no direct upload

---

## 10. Assumptions

- Stable internet connection
- Modern web browser
- Supabase and Railway services available