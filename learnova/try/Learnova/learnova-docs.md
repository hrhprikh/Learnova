# 📚 Learnova – Complete Project Documentation
# Learning Management System (LMS)

**Version:** 2.0  
**Status:** Final  
**Prepared By:** Learnova Engineering Team  
**Date:** 2026-03-21  

---

> **Document Index**
> - [Part 1 — SRS](#part-1--software-requirements-specification-srs)
> - [Part 2 — SDD](#part-2--software-design-document-sdd)
> - [Part 3 — Tech Stack](#part-3--technology-stack)

---

# Part 1 — Software Requirements Specification (SRS)

---

## 1. Introduction

### 1.1 Purpose
Defines functional and non-functional requirements of Learnova, a web-based LMS for Admins, Instructors, and Learners.

### 1.2 Scope
- Instructors create and publish courses
- Learners consume content and take quizzes
- Admins manage the platform

---

## 2. System Overview

```text
Next.js Web App ──→ Node.js Backend (Express) ──→ PostgreSQL (Supabase)
```

---

## 3. User Roles

| Role       | Description                  |
|------------|------------------------------|
| Admin      | Full system control          |
| Instructor | Course creation & management |
| Learner    | Course consumption           |
| Guest      | Browse only                  |

---

## 4. System Flow

```text
Create Course → Add Lessons → Add Quiz → Publish →
Learner Enrolls → Learns → Attempts Quiz →
Earns Points → Completes Course → Reviews →
Instructor Views Analytics
```

---

## 5. State Transitions

```text
Course:   Draft → Published → Unpublished
Progress: Not Started → In Progress → Completed
```

---

## 6. Functional Requirements

### 6.1 Authentication
- Register/Login via Supabase Auth
- Supabase JWT sessions
- RBAC (Admin / Instructor / Learner)

### 6.2 Course Management
- Create/Edit/Delete, Publish/Unpublish
- Visibility: Public / Private / Unlisted

### 6.3 Lesson Management
- Types: Video (URL only), PDF, Image, Text
- File uploads via Supabase Storage
- Mark preview content

### 6.4 Quiz System
- MCQ / Multi-answer / True-False
- Multiple attempts, attempt-based scoring
- Auto evaluation

### 6.5 Learning Module
- Full-screen lesson player
- Course sidebar, Next/Previous navigation

### 6.6 Progress Tracking
- Track completion, calculate %, store position

### 6.7 Gamification

**Scoring by Attempt**

| Attempt | Points        |
|---------|---------------|
| 1st     | Full          |
| 2nd     | Reduced       |
| 3rd     | Lower         |
| 4th+    | Minimum       |

**Badges:** 🥉 Bronze · 🥈 Silver · 🥇 Gold · 💎 Platinum

### 6.8 Reviews
- Rating + review after course completion

### 6.9 Reporting
- Analytics, learner progress, export reports

---

## 7. Non-Functional Requirements

| Category    | Requirement                    |
|-------------|-------------------------------|
| Performance | API < 300ms, Page load < 2s   |
| Security    | Supabase Auth, HTTPS, Zod     |
| Scalability | Railway horizontal scaling    |

---

## 8. Constraints

- **Platform:** Web only
- **Backend:** Node.js + Express + TypeScript
- **Frontend:** Next.js + Tailwind CSS
- **ORM:** Prisma · **DB:** Supabase PostgreSQL
- **Videos:** URL only (YouTube/external)

---

# Part 2 — Software Design Document (SDD)

---

## 1. Architecture

```text
Next.js Web App (Browser)
        │
        ▼
Node.js Backend (Express)
        │
        ▼
PostgreSQL (Supabase)
        │
        ├── Supabase Auth
        └── Supabase Storage
```

---

## 2. Module Design

### 2.1 Auth Module
- Supabase Auth · JWT sessions · RBAC

### 2.2 Course Module
- CRUD · visibility · publish logic

### 2.3 Lesson Module
- Video (URL) · PDF/Image upload (Supabase Storage)

### 2.4 Quiz Module
```text
GET Quiz → Submit → Evaluate → Store → Update Points → Return Result
```

### 2.5 Progress Engine
```text
Lesson Complete → Update Progress → Check Completion → Certificate
```

### 2.6 Gamification Engine
```text
Quiz Result → Calculate Points → Update Total → Check Badge → Award
```

### 2.7 Reporting
- Aggregate DB data · analytics · export

---

## 3. Database Entities *(Prisma ORM on Supabase)*

Users · Courses · Lessons · Quizzes · Attempts · Progress · Reviews · Badges

---

## 4. API Design

**Base URL:** `/api/v1/`

| Method | Endpoint       | Role               | Description        |
|--------|----------------|--------------------|--------------------|
| POST   | /auth/login    | All                | Login              |
| GET    | /courses       | All                | List courses       |
| POST   | /courses       | Instructor / Admin | Create course      |
| GET    | /courses/{id}  | All                | Course detail      |
| POST   | /lessons       | Instructor         | Add lesson         |
| POST   | /quiz/submit   | Learner            | Submit quiz        |
| GET    | /progress      | Learner            | Get progress       |
| GET    | /reports       | Instructor / Admin | Reports            |

---

## 5. File Storage

| Type   | Strategy                      |
|--------|-------------------------------|
| PDF    | Supabase Storage              |
| Images | Supabase Storage              |
| Videos | External URL (YouTube/Vimeo)  |

---

## 6. Security

- Supabase Auth JWT · HTTPS · Zod validation · RBAC middleware · CORS

---

## 7. Error Format

```json
{ "error": { "code": "ERROR_CODE", "message": "Description" } }
```

---

## 8. Deployment

```text
Next.js  →  Vercel
Express  →  Railway
DB + Auth + Storage  →  Supabase
```

---

# Part 3 — Technology Stack

---

## Frontend (Web)

| Item              | Choice                     |
|-------------------|----------------------------|
| Framework         | Next.js (App Router)       |
| Language          | TypeScript                 |
| Styling           | Tailwind CSS               |
| State Management  | React Query                |
| UI Components     | shadcn/ui (optional)       |
| HTTP Client       | Fetch / Axios              |

---

## Backend

| Item      | Choice              |
|-----------|---------------------|
| Runtime   | Node.js             |
| Framework | Express             |
| Language  | TypeScript          |
| API Style | REST `/api/v1/`     |

---

## Database & BaaS (Supabase)

| Item        | Choice           |
|-------------|------------------|
| Database    | PostgreSQL        |
| ORM         | Prisma           |
| Auth        | Supabase Auth    |
| Storage     | Supabase Storage |
| Hosting     | Supabase         |

---

## Deployment

| Platform  | Service           |
|-----------|-------------------|
| Frontend  | Vercel            |
| Backend   | Railway / Render  |
| DB / BaaS | Supabase          |

---

## Monitoring

- **Errors:** Sentry
- **Logs:** Winston / Pino

---

## Final Architecture

```text
Next.js Web App (All Users)
        │
        ▼
Node.js Backend (Express)
        │
        ▼
PostgreSQL (Supabase)
        │
        ├── Supabase Auth
        └── Supabase Storage
```
